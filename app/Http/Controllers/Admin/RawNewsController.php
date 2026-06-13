<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\FetchNewsJob;
use App\Models\RawNews;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RawNewsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/raw-news', [
            'news' => RawNews::latest('fetched_at')->paginate(50),
        ]);
    }

    public function fetch(): RedirectResponse
    {
        FetchNewsJob::dispatch();
        return back()->with('success', 'Fetch job dispatched.');
    }

    public function destroy(RawNews $rawNews): RedirectResponse
    {
        $rawNews->delete();
        return back()->with('success', 'Deleted.');
    }

    public function bulkDestroy(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'integer|exists:raw_news,id',
        ]);

        $count = RawNews::whereIn('id', $validated['ids'])->delete();

        return back()->with('success', "{$count} items deleted.");
    }
}
