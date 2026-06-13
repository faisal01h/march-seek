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
    public function index(): Response
    {
        return Inertia::render('admin/preprocessed-news', [
            'news' => PreprocessedNews::latest('fetched_at')->paginate(50),
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
                $count++;
            }
        }

        return back()->with('success', "{$count} items reassessed.");
    }
}
