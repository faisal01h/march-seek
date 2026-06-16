<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreprocessedNews;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MapDataController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PreprocessedNews::whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereNotIn('geocode_confidence', ['none']);

        $hours = $request->input('hours', 24);
        $hours = max(1, min(24, (int) $hours));
        $query->where('fetched_at', '>=', now()->subHours($hours));

        if ($search = $request->input('search')) {
            $query->search($search);
        }

        if ($hashtagStr = $request->input('hashtags')) {
            $tags = array_filter(explode(',', $hashtagStr));
            foreach ($tags as $tag) {
                $query->whereHas('hashtags', fn ($q) => $q->where('name', $tag));
            }
        }

        $features = $query->with('hashtags')
            ->latest('fetched_at')
            ->limit(1000)
            ->get()
            ->map(fn ($n) => [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [(float) $n->longitude, (float) $n->latitude],
                ],
                'properties' => [
                    'id' => $n->id,
                    'headline' => $n->headline,
                    'summary' => $n->summary,
                    'source_url' => $n->news_source_url,
                    'provider' => $n->news_provider,
                    'place_name' => $n->place_name,
                    'fetched_at' => $n->fetched_at?->toISOString(),
                    'hashtags' => $n->hashtags->pluck('name')->toArray(),
                ],
            ]);

        return response()->json([
            'type' => 'FeatureCollection',
            'features' => $features,
        ]);
    }
}
