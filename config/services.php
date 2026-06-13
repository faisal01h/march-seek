<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gnews' => [
        'api_key' => env('GNEWS_API_KEY'),
    ],

    'newsdata' => [
        'api_key' => env('NEWSDATA_API_KEY'),
        'country' => env('NEWSDATA_COUNTRY', 'id'),
    ],

    'thenewsapi' => [
        'api_key' => env('THENEWSAPI_API_KEY'),
    ],

    'news_keyword_filter' => env('NEWS_KEYWORD_FILTER', 'protest,demo,unjuk rasa,aksi,perlawanan,kerusuhan,protes,strike,gas air mata'),

    'mapbox' => [
        'token' => env('MAPBOX_TOKEN'),
    ],

];
