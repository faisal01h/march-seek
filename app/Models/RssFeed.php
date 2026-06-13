<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RssFeed extends Model
{
    protected $fillable = ['url', 'title', 'active'];

    protected $casts = [
        'active' => 'boolean',
        'last_fetched_at' => 'datetime',
    ];
}
