<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreprocessedNews;
use Illuminate\Http\JsonResponse;

class MapDataController extends Controller
{
    public function index(): JsonResponse
    {
        $features = PreprocessedNews::whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereNotIn('geocode_confidence', ['none'])
            ->where('fetched_at', '>=', now()->subHours(24))
            ->latest('fetched_at')
            ->limit(1000)
            ->get()
            ->map(fn($n) => [
                'type' => 'Feature',
                'geometry' => [
                    'type'        => 'Point',
                    'coordinates' => [(float) $n->longitude, (float) $n->latitude],
                ],
                'properties' => [
                    'id'         => $n->id,
                    'headline'   => $n->headline,
                    'summary'    => $n->summary,
                    'source_url' => $n->news_source_url,
                    'provider'   => $n->news_provider,
                    'place_name' => $n->place_name,
                    'fetched_at' => $n->fetched_at?->toISOString(),
                ],
            ]);

        return response()->json([
            'type'     => 'FeatureCollection',
            'features' => $features,
        ]);
    }
}
