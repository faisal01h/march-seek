<?php

return [
    'provider'     => env('LLM_PROVIDER', 'openrouter'),
    'api_base_url' => env('LLM_API_BASE_URL', 'https://openrouter.ai/api/v1'),
    'api_key'      => env('LLM_API_KEY'),
    'model'        => env('LLM_MODEL', 'openai/gpt-4o-mini'),
];
