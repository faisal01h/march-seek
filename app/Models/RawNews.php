<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RawNews extends Model
{
    protected $fillable = [
        'headline', 'content', 'news_source_url',
        'news_provider', 'url_hash', 'status', 'fetched_at',
    ];

    protected $casts = [
        'fetched_at' => 'datetime',
    ];

    public function preprocessed(): HasOne
    {
        return $this->hasOne(PreprocessedNews::class);
    }
}
