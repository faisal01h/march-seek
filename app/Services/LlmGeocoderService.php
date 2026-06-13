<?php

namespace App\Services;

use App\Models\GeocodingSetting;
use App\Models\LlmSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LlmGeocoderService
{
    private string $systemPrompt = <<<'PROMPT'
You are a geolocation extractor. Given a news article, identify the most specific real-world location where the event described occurred.

Return ONLY a valid JSON object — no markdown, no explanation, no extra text:

{
  "place_name": "Most specific location name",
  "confidence": "street|district|city|region|country|none"
}

Rules:
- "street" = a specific street or very precise address-level location (e.g. "Jalan Sudirman No. 123, Jakarta, Indonesia" or "Corner of 5th Ave and 42nd St, New York, United States").
- "district" = a neighborhood, sub-district, or local area within a city (e.g. "Kemayoran, Jakarta, Indonesia" or "Manhattan, New York, United States").
- "city" = you can identify a specific city or major urban area. When confidence is "city", place_name MUST include the country in the format "City, Country" (e.g. "Jakarta, Indonesia" or "Paris, France"). This is mandatory to avoid confusion with similarly named cities in other countries.
- "region" = state, province, or large region only. Prefer "Region, Country" when possible.
- "country" = country only.
- "none" = no clear location can be determined from the article.
- If confidence is "none", set "place_name" to null.
- Return the cleanest place name possible that is suitable for geocoding.
- Prefer the most specific level that applies and always include country when it is a city or more specific (street/district/city).
PROMPT;

    public function geocode(string $headline, string $content): ?array
    {
        $setting = LlmSetting::current();

        $userMessage = "Headline: {$headline}\n\nContent: " . mb_substr($content, 0, 1500);

        Log::info('LLM API Request', [
            'provider' => $setting->provider,
            'model' => $setting->model_slug,
            'api_base_url' => $setting->api_base_url,
            'payload' => [
                'model' => $setting->model_slug,
                'max_tokens' => 1024,
                'temperature' => 0,
                'messages' => [
                    ['role' => 'system', 'content' => $this->systemPrompt],
                    ['role' => 'user', 'content' => $userMessage],
                ],
            ],
        ]);

        try {
            $response = Http::timeout(30)
                ->withToken($setting->api_key)
                ->withHeaders(array_filter([
                    'HTTP-Referer' => config('app.url'),
                    'X-Title'      => config('app.name'),
                ]))
                ->post(rtrim($setting->api_base_url, '/') . '/chat/completions', [
                    'model'       => $setting->model_slug,
                    'max_tokens'  => 1024,
                    'temperature' => 0,
                    'messages'    => [
                        ['role' => 'system', 'content' => $this->systemPrompt],
                        ['role' => 'user', 'content' => $userMessage],
                    ],
                ]);

            Log::info('LLM API Response', [
                'provider' => $setting->provider,
                'model' => $setting->model_slug,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $message = $response->json('choices.0.message', []);
            $raw = $message['content'] ?? $message['reasoning_content'] ?? '';

            $data = $this->extractJson($raw);

            if (!is_array($data)) {
                Log::warning('LLM geocoder: invalid JSON response', [
                    'provider' => $setting->provider,
                    'raw' => $raw,
                    'message_keys' => array_keys($message),
                ]);
                return null;
            }

            $placeName = $data['place_name'] ?? null;
            $confidence = $data['confidence'] ?? 'none';

            if (!$placeName || $confidence === 'none') {
                return [
                    'place_name' => null,
                    'latitude'   => null,
                    'longitude'  => null,
                    'confidence' => 'none',
                ];
            }

            // Resolve the location name to accurate coordinates using configured geocoding provider
            $geocoding = $this->geocodePlaceName($placeName);

            if (!$geocoding) {
                Log::info('Geocoding failed for place', [
                    'place_name' => $placeName,
                    'provider'   => $setting->provider,
                ]);

                return [
                    'place_name' => $placeName,
                    'latitude'   => null,
                    'longitude'  => null,
                    'confidence' => 'none',
                ];
            }

            // When LLM is confident at city level, prefer the geocoded place name (from Mapbox/OSM)
            // that includes country/region to reduce ambiguity (e.g. "Paris, France" instead of just "Paris").
            $finalPlaceName = $placeName;
            if ($confidence === 'city' && !empty($geocoding['geocoded_place_name'])) {
                if (!str_contains($placeName, ',') || strlen($placeName) < 8) {
                    $finalPlaceName = $geocoding['geocoded_place_name'];
                }
            }

            return [
                'place_name' => $finalPlaceName,
                'latitude'   => $geocoding['latitude'],
                'longitude'  => $geocoding['longitude'],
                'confidence' => $confidence,
            ];
        } catch (\Exception $e) {
            Log::error('LLM geocoder error', [
                'provider' => $setting->provider,
                'model' => $setting->model_slug,
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Attempts to extract a valid JSON object from the LLM response text.
     * Handles cases where models put the answer in reasoning_content,
     * wrap it in markdown, or add extra explanation text.
     */
    private function extractJson(string $text): ?array
    {
        $text = trim($text);

        // Try direct parse first (best case)
        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // Try to extract the first {...} block using regex (common fallback)
        if (preg_match('/\{[\s\S]*\}/', $text, $matches)) {
            $decoded = json_decode(trim($matches[0]), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // Last resort: sometimes models put JSON after a "JSON:" or similar
        if (preg_match('/(?:json|output)[:\s]*(\{[\s\S]*\})/i', $text, $matches)) {
            $decoded = json_decode(trim($matches[1]), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    /**
     * Dispatch to the configured geocoding provider.
     */
    private function geocodePlaceName(string $placeName): ?array
    {
        $setting = GeocodingSetting::current();

        if ($setting->provider === 'openstreetmap') {
            return $this->geocodeWithOpenStreetMap($placeName, $setting);
        }

        // default to mapbox
        return $this->geocodeWithMapbox($placeName, $setting);
    }

    /**
     * Resolve a place name using Mapbox Geocoding API.
     */
    private function geocodeWithMapbox(string $placeName, GeocodingSetting $setting): ?array
    {
        $token = $setting->api_key ?: config('services.mapbox.token');

        if (!$token) {
            Log::warning('Mapbox token is not configured');
            return null;
        }

        try {
            $encoded = urlencode($placeName);

            $response = Http::timeout(10)->get(
                "https://api.mapbox.com/geocoding/v5/mapbox.places/{$encoded}.json",
                [
                    'access_token' => $token,
                    'limit'        => 1,
                    'types'        => 'address,neighborhood,district,locality,place,region,country',
                    'language'     => 'en',
                ]
            );

            if (!$response->successful()) {
                Log::warning('Mapbox Geocoding API error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return null;
            }

            $features = $response->json('features', []);

            if (empty($features)) {
                return null;
            }

            $feature = $features[0];
            $center = $feature['center'] ?? null; // [longitude, latitude]
            $geocodedPlaceName = $feature['place_name'] ?? null;

            if (!is_array($center) || count($center) < 2) {
                return null;
            }

            return [
                'latitude'            => (float) $center[1],
                'longitude'           => (float) $center[0],
                'geocoded_place_name' => $geocodedPlaceName,
            ];
        } catch (\Exception $e) {
            Log::error('Mapbox geocoding exception', [
                'place_name' => $placeName,
                'message'    => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Resolve a place name using OpenStreetMap Nominatim.
     */
    private function geocodeWithOpenStreetMap(string $placeName, GeocodingSetting $setting): ?array
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'User-Agent' => config('app.name') . '/1.0 (MarchSeek)',
                    'Accept'     => 'application/json',
                ])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q'                => $placeName,
                    'format'           => 'json',
                    'limit'            => 1,
                    'addressdetails'   => 1,
                    'accept-language'  => 'en',
                ]);

            if (!$response->successful()) {
                Log::warning('OpenStreetMap Geocoding API error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return null;
            }

            $results = $response->json();

            if (empty($results)) {
                return null;
            }

            $result = $results[0];

            return [
                'latitude'            => (float) $result['lat'],
                'longitude'           => (float) $result['lon'],
                'geocoded_place_name' => $result['display_name'] ?? null,
            ];
        } catch (\Exception $e) {
            Log::error('OpenStreetMap geocoding exception', [
                'place_name' => $placeName,
                'message'    => $e->getMessage(),
            ]);
            return null;
        }
    }
}
