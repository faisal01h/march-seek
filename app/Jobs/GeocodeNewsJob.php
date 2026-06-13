<?php

namespace App\Jobs;

use App\Events\NewsGeocoded;
use App\Models\PreprocessedNews;
use App\Models\RawNews;
use App\Services\LlmGeocoderService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class GeocodeNewsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;

    public int $tries = 3;

    public function __construct(private RawNews $news) {}

    public function handle(LlmGeocoderService $geocoder): void
    {
        $result = $geocoder->geocode($this->news->headline, $this->news->content ?? '');

        if (! $result || ($result['confidence'] ?? 'none') === 'none') {
            $this->news->update(['status' => 'failed']);

            return;
        }

        // Generate a plain-text summary (first 300 chars of content)
        $summary = mb_substr(strip_tags($this->news->content ?? $this->news->headline), 0, 300);

        $preprocessed = PreprocessedNews::create([
            'id' => Str::uuid(),
            'raw_news_id' => $this->news->id,
            'headline' => $this->news->headline,
            'content' => $this->news->content,
            'summary' => $summary,
            'news_source_url' => $this->news->news_source_url,
            'news_provider' => $this->news->news_provider,
            'place_name' => $result['place_name'],
            'latitude' => $result['latitude'],
            'longitude' => $result['longitude'],
            'geocode_confidence' => $result['confidence'],
            'fetched_at' => $this->news->fetched_at,
        ]);

        if (! empty($result['hashtags'])) {
            $preprocessed->syncHashtagsAndSearchVector($result['hashtags']);
        } else {
            $preprocessed->updateSearchVector();
        }

        $this->news->update(['status' => 'processed']);

        broadcast(new NewsGeocoded($preprocessed));
    }
}
