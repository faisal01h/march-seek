<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasUuids;

    protected $fillable = ['content', 'ip_hash'];
}
