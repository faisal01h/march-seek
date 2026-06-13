<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RssFeed;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RssFeedsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/rss-feeds', [
            'feeds' => RssFeed::orderBy('created_at', 'desc')->paginate(20),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'url' => 'required|url|unique:rss_feeds,url',
            'title' => 'nullable|string|max:255',
        ]);

        RssFeed::create([
            'url' => $validated['url'],
            'title' => $validated['title'] ?? null,
            'active' => true,
        ]);

        return back()->with('success', 'RSS feed added.');
    }

    public function update(Request $request, RssFeed $rssFeed): RedirectResponse
    {
        $validated = $request->validate([
            'url' => 'required|url|unique:rss_feeds,url,' . $rssFeed->id,
            'title' => 'nullable|string|max:255',
            'active' => 'boolean',
        ]);

        $rssFeed->update($validated);

        return back()->with('success', 'RSS feed updated.');
    }

    public function destroy(RssFeed $rssFeed): RedirectResponse
    {
        $rssFeed->delete();

        return back()->with('success', 'RSS feed deleted.');
    }
}
