<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GeocodingSetting extends Model
{
    protected $fillable = ['provider', 'api_key'];

    protected $casts = [
        'api_key' => 'encrypted',
    ];

    public static function current(): self
    {
        return static::firstOrCreate([], [
            'provider' => 'mapbox',
        ]);
    }
}
