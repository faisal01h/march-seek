<?php

namespace App\Http\Controllers\Api;

use App\Events\ChatMessageSent;
use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function index(): JsonResponse
    {
        $messages = ChatMessage::where('created_at', '>=', now()->subHours(48))
            ->orderBy('created_at')
            ->get(['id', 'content', 'created_at']);

        return response()->json($messages);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => 'required|string|min:1|max:500',
        ]);

        $message = ChatMessage::create([
            'id'      => Str::uuid(),
            'content' => $validated['content'],
            'ip_hash' => hash('sha256', $request->ip()),
        ]);

        broadcast(new ChatMessageSent($message))->toOthers();

        return response()->json([
            'id'         => $message->id,
            'content'    => $message->content,
            'created_at' => $message->created_at->toISOString(),
        ], 201);
    }
}
