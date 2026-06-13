<?php

namespace Tests\Feature;

use App\Models\PreprocessedNews;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MapDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_map_page_loads(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
    }

    public function test_map_data_api_returns_geojson_feature_collection(): void
    {
        // Need a raw row for FK constraint
        $raw = \App\Models\RawNews::create([
            'headline' => 'Raw for test',
            'news_source_url' => 'https://example.com/raw-test',
            'url_hash' => hash('sha256', 'https://example.com/raw-test'),
            'status' => 'pending',
        ]);

        PreprocessedNews::create([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'raw_news_id' => $raw->id,
            'headline' => 'Test protest in Berlin',
            'content' => 'Hundreds marched...',
            'summary' => 'Test summary',
            'news_source_url' => 'https://example.com/test',
            'news_provider' => 'test',
            'place_name' => 'Berlin, Germany',
            'latitude' => 52.52,
            'longitude' => 13.405,
            'geocode_confidence' => 'city',
            'fetched_at' => now(),
        ]);

        $response = $this->getJson('/api/map-data');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'type',
                'features' => [
                    '*' => [
                        'type',
                        'geometry' => ['type', 'coordinates'],
                        'properties' => ['id', 'headline', 'place_name'],
                    ],
                ],
            ])
            ->assertJsonPath('type', 'FeatureCollection');
    }
}
