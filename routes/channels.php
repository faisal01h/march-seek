<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Public channels for MarchSeek realtime updates (map dots and chat)
Broadcast::channel('public-map', fn () => true);
Broadcast::channel('public-chat', fn () => true);
