<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapSetting extends Model
{
    protected $fillable = ['provider', 'mapbox_token', 'osm_style'];

    public static function current(): self
    {
        return static::firstOrCreate([], [
            'provider' => 'mapbox',
            'osm_style' => 'positron',
        ]);
    }
}
