<?php

namespace App\Console\Commands;

use App\Models\ChatMessage;
use Illuminate\Console\Command;

class PruneChatMessages extends Command
{
    protected $signature = 'chat:prune';

    protected $description = 'Delete chat messages older than 48 hours';

    public function handle(): void
    {
        $deleted = ChatMessage::where('created_at', '<', now()->subHours(48))->delete();
        $this->info("Pruned {$deleted} chat messages.");
    }
}
