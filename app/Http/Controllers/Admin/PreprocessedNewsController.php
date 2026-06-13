<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PreprocessedNews;
use App\Services\LlmGeocoderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PreprocessedNewsController extends Controller
{
    public function index(Request $request): Response
    {
        $query = PreprocessedNews::query()->latest('fetched_at');

        if ($search = $request->input('search')) {
            $query->search($search);
        }

        return Inertia::render('admin/preprocessed-news', [
            'news' => $query->paginate(50)->withQueryString(),
            'search' => $search,
        ]);
    }

    public function destroy(PreprocessedNews $preprocessedNews): RedirectResponse
    {
        $preprocessedNews->delete();

        return back()->with('success', 'Deleted.');
    }

    public function reassess(PreprocessedNews $preprocessedNews, LlmGeocoderService $geocoder): RedirectResponse
    {
        $result = $geocoder->geocode(
            $preprocessedNews->headline,
            $preprocessedNews->content ?? $preprocessedNews->summary ?? ''
        );

        if ($result && ($result['confidence'] ?? 'none') !== 'none') {
            $preprocessedNews->update([
                'place_name' => $result['place_name'],
                'latitude' => $result['latitude'],
                'longitude' => $result['longitude'],
                'geocode_confidence' => $result['confidence'],
                'fetched_at' => now(),
            ]);

            if (! empty($result['hashtags'])) {
                $preprocessedNews->syncHashtagsAndSearchVector($result['hashtags']);
            } else {
                $preprocessedNews->updateSearchVector();
            }

            return back()->with('success', 'Location reassessed (LLM → Mapbox).');
        }

        return back()->with('error', 'Could not reassess location.');
    }

    public function bulkReassess(Request $request, LlmGeocoderService $geocoder): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'string|exists:preprocessed_news,id',
        ]);

        $count = 0;

        foreach ($validated['ids'] as $id) {
            $preprocessedNews = PreprocessedNews::find($id);
            if (! $preprocessedNews) {
                continue;
            }

            $result = $geocoder->geocode(
                $preprocessedNews->headline,
                $preprocessedNews->content ?? $preprocessedNews->summary ?? ''
            );

            if ($result && ($result['confidence'] ?? 'none') !== 'none') {
                $preprocessedNews->update([
                    'place_name' => $result['place_name'],
                    'latitude' => $result['latitude'],
                    'longitude' => $result['longitude'],
                    'geocode_confidence' => $result['confidence'],
                    'fetched_at' => now(),
                ]);

                if (! empty($result['hashtags'])) {
                    $preprocessedNews->syncHashtagsAndSearchVector($result['hashtags']);
                } else {
                    $preprocessedNews->updateSearchVector();
                }

                $count++;
            }
        }

        return back()->with('success', "{$count} items reassessed.");
    }
}
