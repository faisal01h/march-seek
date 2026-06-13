<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Public as PublicControllers;
use Illuminate\Support\Facades\Route;

// Public map (main landing)
Route::get('/', [PublicControllers\MapController::class, 'index'])->name('home');

// Admin auth (dedicated endpoints; separate from main Fortify user auth at /login)
Route::get('/admin/login', [Admin\AuthController::class, 'showLogin'])->name('admin.login');
Route::post('/admin/login', [Admin\AuthController::class, 'login']);
Route::post('/admin/logout', [Admin\AuthController::class, 'logout'])->name('admin.logout');

// Admin (protected by session auth from Fortify; any authenticated user can access for this app)
Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');

    Route::get('/raw-news', [Admin\RawNewsController::class, 'index'])->name('raw-news.index');
    Route::post('/raw-news/fetch', [Admin\RawNewsController::class, 'fetch'])->name('raw-news.fetch');
    Route::delete('/raw-news/{rawNews}', [Admin\RawNewsController::class, 'destroy'])->name('raw-news.destroy');
    Route::post('/raw-news/bulk-destroy', [Admin\RawNewsController::class, 'bulkDestroy'])->name('raw-news.bulk-destroy');

    Route::get('/preprocessed-news', [Admin\PreprocessedNewsController::class, 'index'])->name('preprocessed-news.index');
    Route::delete('/preprocessed-news/{preprocessedNews}', [Admin\PreprocessedNewsController::class, 'destroy'])->name('preprocessed-news.destroy');
    Route::post('/preprocessed-news/{preprocessedNews}/reassess', [Admin\PreprocessedNewsController::class, 'reassess'])->name('preprocessed-news.reassess');

    Route::get('/llm-settings', [Admin\LlmSettingsController::class, 'index'])->name('llm-settings.index');
    Route::put('/llm-settings', [Admin\LlmSettingsController::class, 'update'])->name('llm-settings.update');
    Route::post('/llm-settings/test', [Admin\LlmSettingsController::class, 'test'])->name('llm-settings.test');

    Route::get('/geocoding-settings', [Admin\GeocodingSettingsController::class, 'index'])->name('geocoding-settings.index');
    Route::put('/geocoding-settings', [Admin\GeocodingSettingsController::class, 'update'])->name('geocoding-settings.update');
    Route::post('/geocoding-settings/test', [Admin\GeocodingSettingsController::class, 'test'])->name('geocoding-settings.test');

    Route::get('/rss-feeds', [Admin\RssFeedsController::class, 'index'])->name('rss-feeds.index');
    Route::post('/rss-feeds', [Admin\RssFeedsController::class, 'store'])->name('rss-feeds.store');
    Route::put('/rss-feeds/{rssFeed}', [Admin\RssFeedsController::class, 'update'])->name('rss-feeds.update');
    Route::delete('/rss-feeds/{rssFeed}', [Admin\RssFeedsController::class, 'destroy'])->name('rss-feeds.destroy');

    Route::get('/chat', [Admin\ChatController::class, 'index'])->name('chat.index');
    Route::delete('/chat/prune', [Admin\ChatController::class, 'prune'])->name('chat.prune');
});

// Existing user dashboard and settings (kept for compatibility)
Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
