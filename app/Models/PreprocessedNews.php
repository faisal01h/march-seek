<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\DB;

class PreprocessedNews extends Model
{
    use HasUuids;

    protected $fillable = [
        'raw_news_id', 'headline', 'content', 'summary',
        'news_source_url', 'news_provider', 'place_name',
        'latitude', 'longitude', 'geocode_confidence', 'fetched_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'fetched_at' => 'datetime',
    ];

    public function rawNews(): BelongsTo
    {
        return $this->belongsTo(RawNews::class);
    }

    public function hashtags(): BelongsToMany
    {
        return $this->belongsToMany(NewsHashtag::class, 'preprocessed_news_hashtag');
    }

    /**
     * Sync hashtags and update the full-text search vector including hashtags.
     */
    public function syncHashtagsAndSearchVector(array $hashtagNames): void
    {
        $hashtagIds = [];
        foreach ($hashtagNames as $name) {
            $name = strtolower(trim(preg_replace('/[^a-z0-9-]/', '', $name)));
            if (empty($name)) {
                continue;
            }

            $hashtag = NewsHashtag::firstOrCreate(['name' => $name]);
            $hashtagIds[] = $hashtag->id;
        }

        $this->hashtags()->sync($hashtagIds);
        $this->load('hashtags');

        $this->updateSearchVector();
    }

    public function updateSearchVector(): void
    {
        $hashtags = $this->hashtags()->pluck('name')->implode(' ');

        DB::statement(
            "UPDATE preprocessed_news 
             SET search_vector = to_tsvector('english', 
                 coalesce(headline, '') || ' ' || 
                 coalesce(summary, '') || ' ' || 
                 coalesce(content, '') || ' ' || 
                 ?
             ) 
             WHERE id = ?",
            [$hashtags, $this->id]
        );
    }

    public function scopeSearch($query, ?string $term)
    {
        if (empty($term)) {
            return $query;
        }

        return $query->whereRaw(
            "search_vector @@ plainto_tsquery('english', ?)",
            [$term]
        );
    }
}
