<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PreprocessedNews;
use App\Models\RawNews;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $rawCount = RawNews::count();
        $preprocessedCount = PreprocessedNews::count();
        $lastFetchedAt = RawNews::max('fetched_at');
        $queuedJobs = DB::table('jobs')->count();

        return Inertia::render('admin/dashboard', [
            'rawCount' => $rawCount,
            'preprocessedCount' => $preprocessedCount,
            'lastFetchedAt' => $lastFetchedAt,
            'queuedJobs' => $queuedJobs,
        ]);
    }
}
