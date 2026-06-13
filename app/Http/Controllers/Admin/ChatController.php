<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ChatController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/chat', [
            'messages' => ChatMessage::latest('created_at')->paginate(100),
        ]);
    }

    public function prune(): RedirectResponse
    {
        $deleted = ChatMessage::where('created_at', '<', now()->subHours(48))->delete();
        return back()->with('success', "Pruned {$deleted} messages.");
    }
}
