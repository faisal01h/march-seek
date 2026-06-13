<?php

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

// Map data endpoint (public)
Route::get('/map-data', [Api\MapDataController::class, 'index']);

// Chat (rate-limited — 5 messages per minute per IP)
Route::middleware(['throttle:chat'])->group(function () {
    Route::get('/chat/messages', [Api\ChatController::class, 'index']);
    Route::post('/chat/messages', [Api\ChatController::class, 'store']);
});
