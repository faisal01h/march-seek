<?php

namespace App\Events;

use App\Models\PreprocessedNews;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewsGeocoded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public PreprocessedNews $news) {}

    public function broadcastOn(): array
    {
        return [new Channel('public-map')];
    }

    public function broadcastAs(): string
    {
        return 'news.geocoded';
    }

    public function broadcastWith(): array
    {
        $hashtags = $this->news->hashtags()->pluck('name')->toArray();

        return [
            'id' => $this->news->id,
            'headline' => $this->news->headline,
            'summary' => $this->news->summary,
            'source_url' => $this->news->news_source_url,
            'provider' => $this->news->news_provider,
            'place_name' => $this->news->place_name,
            'latitude' => $this->news->latitude,
            'longitude' => $this->news->longitude,
            'fetched_at' => $this->news->fetched_at?->toISOString(),
            'hashtags' => $hashtags,
        ];
    }
}
