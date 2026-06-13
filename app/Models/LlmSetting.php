<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LlmSetting extends Model
{
    protected $fillable = ['provider', 'api_base_url', 'api_key', 'model_slug'];

    protected $casts = [
        'api_key' => 'encrypted',
    ];

    public static function current(): self
    {
        return static::firstOrCreate([], [
            'provider'     => config('llm.provider'),
            'api_base_url' => config('llm.api_base_url'),
            'api_key'      => config('llm.api_key'),
            'model_slug'   => config('llm.model'),
        ]);
    }
}
