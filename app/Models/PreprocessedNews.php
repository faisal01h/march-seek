<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PreprocessedNews extends Model
{
    use HasUuids;

    protected $fillable = [
        'raw_news_id', 'headline', 'content', 'summary',
        'news_source_url', 'news_provider', 'place_name',
        'latitude', 'longitude', 'geocode_confidence', 'fetched_at',
    ];

    protected $casts = [
        'latitude'   => 'float',
        'longitude'  => 'float',
        'fetched_at' => 'datetime',
    ];

    public function rawNews(): BelongsTo
    {
        return $this->belongsTo(RawNews::class);
    }
}
