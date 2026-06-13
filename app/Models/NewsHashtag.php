<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NewsHashtag extends Model
{
    protected $fillable = ['name'];

    public function preprocessedNews()
    {
        return $this->belongsToMany(PreprocessedNews::class, 'preprocessed_news_hashtag');
    }
}
