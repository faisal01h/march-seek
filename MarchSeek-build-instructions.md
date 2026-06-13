# MarchSeek — Build Instructions for LLM Coding Agent

You are building **MarchSeek**, a public dissatisfaction monitor that fetches protest/demonstration news, geocodes events using an LLM, and displays them as dots on an interactive map. Follow these instructions precisely and completely.

---

## Stack

- **Backend:** Laravel 13, PHP 8.5
- **Frontend:** Inertia.js + React 18, TailwindCSS v4
- **Database:** PostgreSQL 16
- **Realtime:** Laravel Reverb (WebSocket server) + Laravel Echo (client)
- **Queue/Scheduler:** Laravel Queue (database driver), Laravel Scheduler
- **Maps:** Mapbox GL JS
- **Auth:** Laravel Sanctum (session-based, admin only)
- **Containerization:** Docker Compose

---

## Repository Structure

```
march-seek/
├── app/
│   ├── Broadcasting/
│   ├── Console/
│   │   └── Commands/
│   ├── Events/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Admin/
│   │   │   └── Public/
│   │   └── Middleware/
│   ├── Jobs/
│   ├── Models/
│   └── Services/
├── database/
│   └── migrations/
├── resources/
│   └── js/
│       ├── Components/
│       ├── Layouts/
│       └── Pages/
│           ├── Admin/
│           └── Public/
├── routes/
│   ├── web.php
│   ├── api.php
│   └── channels.php
├── docker/
│   ├── nginx/
│   │   └── default.conf
│   └── php/
│       └── Dockerfile
├── docker-compose.yml
├── .env.example
└── vite.config.js
```

---

## Step 1 — Docker Setup

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - .:/var/www/html
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    networks:
      - marchseek

  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    volumes:
      - .:/var/www/html
    environment:
      - APP_ENV=local
    depends_on:
      - postgres
    networks:
      - marchseek

  reverb:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    command: php artisan reverb:start --host=0.0.0.0 --port=8080
    ports:
      - "8080:8080"
    volumes:
      - .:/var/www/html
    depends_on:
      - postgres
    networks:
      - marchseek

  queue:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    command: php artisan queue:work --sleep=3 --tries=3
    volumes:
      - .:/var/www/html
    depends_on:
      - postgres
    networks:
      - marchseek

  scheduler:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    command: php artisan schedule:work
    volumes:
      - .:/var/www/html
    depends_on:
      - postgres
    networks:
      - marchseek

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: marchseek
      POSTGRES_USER: marchseek
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Do not publish the port to the host. Postgres is only accessible
    # from other containers on the "marchseek" Docker network using the
    # hostname "postgres" on port 5432.
    networks:
      - marchseek

volumes:
  pgdata:

networks:
  marchseek:
    driver: bridge
```

### `docker/php/Dockerfile`

```dockerfile
FROM php:8.5-fpm-alpine

RUN apk add --no-cache \
    git curl zip unzip libpng-dev libpq-dev nodejs npm

RUN docker-php-ext-install pdo pdo_pgsql gd pcntl bcmath

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --optimize-autoloader
RUN npm ci && npm run build

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

CMD ["php-fpm"]
```

### `docker/nginx/default.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html/public;
    index index.php;

    # Pass real client IP through Docker NAT
    real_ip_header X-Forwarded-For;
    set_real_ip_from 172.16.0.0/12;
    set_real_ip_from 10.0.0.0/8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_param HTTP_X_FORWARDED_FOR $remote_addr;
        fastcgi_param HTTP_X_REAL_IP $remote_addr;
    }
}
```

---

## Step 2 — Environment Variables

### `.env.example`

```dotenv
APP_NAME=MarchSeek
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=marchseek
DB_USERNAME=marchseek
DB_PASSWORD=secret

QUEUE_CONNECTION=database

BROADCAST_CONNECTION=reverb

REVERB_APP_ID=marchseek
REVERB_APP_KEY=marchseek-key
REVERB_APP_SECRET=marchseek-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

# Client-side Reverb config (used by Vite/Echo)
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

# Mapbox (public token, safe to expose)
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token_here

# News API keys
GNEWS_API_KEY=
NEWSDATA_API_KEY=

# LLM defaults (can be overridden in admin UI → llm_settings table)
LLM_PROVIDER=openrouter
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=
LLM_MODEL=openai/gpt-4o-mini

# Trusted proxies (trust all internal Docker subnet)
TRUSTED_PROXIES=*
```

---

## Step 3 — Laravel Configuration

### `app/Http/Middleware/TrustProxies.php`

Ensure all proxies are trusted so that IP-based rate limiting works correctly behind nginx:

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    protected $proxies = '*';

    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
```

Register this middleware in `bootstrap/app.php` (Laravel 13 style):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->trustProxies(at: '*');
})
```

---

## Step 4 — Database Migrations

Create these migrations in order.

### `create_raw_news_table`

```php
Schema::create('raw_news', function (Blueprint $table) {
    $table->id();
    $table->string('headline');
    $table->longText('content')->nullable();
    $table->string('news_source_url')->unique();
    $table->string('news_provider')->nullable();
    $table->string('url_hash', 64)->unique(); // sha256 of news_source_url
    $table->enum('status', ['pending', 'processed', 'failed'])->default('pending');
    $table->timestamp('fetched_at')->nullable();
    $table->timestamps();
});
```

### `create_preprocessed_news_table`

```php
Schema::create('preprocessed_news', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignId('raw_news_id')->constrained('raw_news')->onDelete('cascade');
    $table->string('headline');
    $table->longText('content')->nullable();
    $table->text('summary')->nullable();
    $table->string('news_source_url');
    $table->string('news_provider')->nullable();
    $table->string('place_name')->nullable();
    $table->decimal('latitude', 10, 7)->nullable();
    $table->decimal('longitude', 10, 7)->nullable();
    $table->string('geocode_confidence')->nullable(); // city, region, country, none
    $table->timestamp('fetched_at')->nullable();
    $table->timestamps();

    $table->index(['latitude', 'longitude']);
});
```

### `create_chat_messages_table`

```php
Schema::create('chat_messages', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->text('content');
    $table->string('ip_hash', 64)->nullable(); // sha256 of IP for rate limiting reference
    $table->timestamps();
    $table->index('created_at'); // for efficient 48-hour pruning
});
```

### `create_llm_settings_table`

```php
Schema::create('llm_settings', function (Blueprint $table) {
    $table->id();
    $table->string('provider')->default('openrouter'); // openrouter, lmstudio, deepseek
    $table->string('api_base_url')->default('https://openrouter.ai/api/v1');
    $table->text('api_key')->nullable(); // encrypted
    $table->string('model_slug')->default('openai/gpt-4o-mini');
    $table->timestamps();
});
```

---

## Step 5 — Eloquent Models

### `app/Models/RawNews.php`

```php
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
```

### `app/Models/PreprocessedNews.php`

```php
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
```

### `app/Models/ChatMessage.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    use HasUuids;

    protected $fillable = ['content', 'ip_hash'];
}
```

### `app/Models/LlmSetting.php`

```php
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
```

---

## Step 6 — Services

### `app/Services/NewsIngestionService.php`

This service fetches from all configured news providers and saves deduplicated results to `raw_news`.

```php
<?php

namespace App\Services;

use App\Jobs\GeocodeNewsJob;
use App\Models\RawNews;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NewsIngestionService
{
    private array $keywords = [
        'protest', 'demonstration', 'rally', 'strike', 'riot',
        'march', 'uprising', 'dissent', 'civil unrest', 'demonstration',
    ];

    public function fetchAll(): int
    {
        $count = 0;
        $count += $this->fetchFromGNews();
        $count += $this->fetchFromNewsData();
        return $count;
    }

    private function fetchFromGNews(): int
    {
        $key = config('services.gnews.api_key');
        if (!$key) return 0;

        $count = 0;
        foreach (array_chunk($this->keywords, 3) as $chunk) {
            $query = implode(' OR ', $chunk);
            try {
                $response = Http::timeout(15)->get('https://gnews.io/api/v4/search', [
                    'q'       => $query,
                    'token'   => $key,
                    'lang'    => 'en',
                    'max'     => 10,
                    'sortby'  => 'publishedAt',
                ]);

                foreach ($response->json('articles', []) as $article) {
                    if ($this->save($article['url'], $article['title'], $article['content'] ?? $article['description'] ?? '', 'gnews')) {
                        $count++;
                    }
                }
            } catch (\Exception $e) {
                Log::error('GNews fetch error: ' . $e->getMessage());
            }
        }
        return $count;
    }

    private function fetchFromNewsData(): int
    {
        $key = config('services.newsdata.api_key');
        if (!$key) return 0;

        $count = 0;
        try {
            $response = Http::timeout(15)->get('https://newsdata.io/api/1/news', [
                'apikey'   => $key,
                'q'        => implode(' OR ', array_slice($this->keywords, 0, 5)),
                'language' => 'en',
            ]);

            foreach ($response->json('results', []) as $article) {
                $url = $article['link'] ?? null;
                if (!$url) continue;
                if ($this->save($url, $article['title'], $article['content'] ?? $article['description'] ?? '', 'newsdata')) {
                    $count++;
                }
            }
        } catch (\Exception $e) {
            Log::error('NewsData fetch error: ' . $e->getMessage());
        }
        return $count;
    }

    private function save(string $url, string $headline, string $content, string $provider): bool
    {
        $hash = hash('sha256', $url);

        if (RawNews::where('url_hash', $hash)->exists()) {
            return false;
        }

        $news = RawNews::create([
            'headline'       => $headline,
            'content'        => $content,
            'news_source_url'=> $url,
            'news_provider'  => $provider,
            'url_hash'       => $hash,
            'status'         => 'pending',
            'fetched_at'     => now(),
        ]);

        GeocodeNewsJob::dispatch($news);

        return true;
    }
}
```

### `app/Services/LlmGeocoderService.php`

```php
<?php

namespace App\Services;

use App\Models\LlmSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LlmGeocoderService
{
    private string $systemPrompt = <<<'PROMPT'
You are a geolocation extractor. Given a news article, identify the most specific real-world location where the event described occurred.

Return ONLY a valid JSON object — no markdown, no explanation, no extra text:
{
  "place_name": "City, Country",
  "latitude": 0.0,
  "longitude": 0.0,
  "confidence": "city|region|country|none"
}

Rules:
- "city" = you can identify the specific city
- "region" = state, province, or region only
- "country" = country only
- "none" = location cannot be determined
- If confidence is "none", set place_name, latitude, longitude to null
- Use the most specific location the article explicitly mentions
- latitude and longitude must be numbers, not strings
PROMPT;

    public function geocode(string $headline, string $content): ?array
    {
        $setting = LlmSetting::current();

        $userMessage = "Headline: {$headline}\n\nContent: " . mb_substr($content, 0, 1500);

        try {
            $response = Http::timeout(30)
                ->withToken($setting->api_key)
                ->withHeaders(array_filter([
                    'HTTP-Referer' => config('app.url'),
                    'X-Title'      => config('app.name'),
                ]))
                ->post(rtrim($setting->api_base_url, '/') . '/chat/completions', [
                    'model'       => $setting->model_slug,
                    'max_tokens'  => 200,
                    'temperature' => 0,
                    'messages'    => [
                        ['role' => 'system', 'content' => $this->systemPrompt],
                        ['role' => 'user', 'content' => $userMessage],
                    ],
                ]);

            $raw = $response->json('choices.0.message.content', '');
            $data = json_decode(trim($raw), true);

            if (!is_array($data)) {
                Log::warning('LLM geocoder: invalid JSON response', ['raw' => $raw]);
                return null;
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('LLM geocoder error: ' . $e->getMessage());
            return null;
        }
    }
}
```

---

## Step 7 — Jobs

### `app/Jobs/FetchNewsJob.php`

```php
<?php

namespace App\Jobs;

use App\Services\NewsIngestionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class FetchNewsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;
    public int $tries = 2;

    public function handle(NewsIngestionService $service): void
    {
        $service->fetchAll();
    }
}
```

### `app/Jobs/GeocodeNewsJob.php`

```php
<?php

namespace App\Jobs;

use App\Events\NewsGeocoded;
use App\Models\PreprocessedNews;
use App\Models\RawNews;
use App\Services\LlmGeocoderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class GeocodeNewsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 60;
    public int $tries = 3;

    public function __construct(private RawNews $news) {}

    public function handle(LlmGeocoderService $geocoder): void
    {
        $result = $geocoder->geocode($this->news->headline, $this->news->content ?? '');

        if (!$result || ($result['confidence'] ?? 'none') === 'none') {
            $this->news->update(['status' => 'failed']);
            return;
        }

        // Generate a plain-text summary (first 300 chars of content)
        $summary = mb_substr(strip_tags($this->news->content ?? $this->news->headline), 0, 300);

        $preprocessed = PreprocessedNews::create([
            'id'              => Str::uuid(),
            'raw_news_id'     => $this->news->id,
            'headline'        => $this->news->headline,
            'content'         => $this->news->content,
            'summary'         => $summary,
            'news_source_url' => $this->news->news_source_url,
            'news_provider'   => $this->news->news_provider,
            'place_name'      => $result['place_name'],
            'latitude'        => $result['latitude'],
            'longitude'       => $result['longitude'],
            'geocode_confidence' => $result['confidence'],
            'fetched_at'      => $this->news->fetched_at,
        ]);

        $this->news->update(['status' => 'processed']);

        broadcast(new NewsGeocoded($preprocessed));
    }
}
```

---

## Step 8 — Console Commands & Scheduler

### `app/Console/Commands/FetchNewsCommand.php`

```php
<?php

namespace App\Console\Commands;

use App\Jobs\FetchNewsJob;
use Illuminate\Console\Command;

class FetchNewsCommand extends Command
{
    protected $signature = 'news:fetch';
    protected $description = 'Dispatch the news fetch job';

    public function handle(): void
    {
        FetchNewsJob::dispatch();
        $this->info('FetchNewsJob dispatched.');
    }
}
```

### `app/Console/Commands/PruneChatMessages.php`

```php
<?php

namespace App\Console\Commands;

use App\Models\ChatMessage;
use Illuminate\Console\Command;

class PruneChatMessages extends Command
{
    protected $signature = 'chat:prune';
    protected $description = 'Delete chat messages older than 48 hours';

    public function handle(): void
    {
        $deleted = ChatMessage::where('created_at', '<', now()->subHours(48))->delete();
        $this->info("Pruned {$deleted} chat messages.");
    }
}
```

### Scheduler in `routes/console.php` (or `app/Console/Kernel.php`)

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('news:fetch')->hourly();
Schedule::command('chat:prune')->everyFifteenMinutes();
```

---

## Step 9 — Events & Broadcasting

### `app/Events/NewsGeocoded.php`

```php
<?php

namespace App\Events;

use App\Models\PreprocessedNews;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewsGeocoded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public PreprocessedNews $news) {}

    public function broadcastOn(): array
    {
        return [new Channel('public-map')];
    }

    public function broadcastAs(): string
    {
        return 'news.geocoded';
    }

    public function broadcastWith(): array
    {
        return [
            'id'         => $this->news->id,
            'headline'   => $this->news->headline,
            'summary'    => $this->news->summary,
            'source_url' => $this->news->news_source_url,
            'provider'   => $this->news->news_provider,
            'place_name' => $this->news->place_name,
            'latitude'   => $this->news->latitude,
            'longitude'  => $this->news->longitude,
            'fetched_at' => $this->news->fetched_at?->toISOString(),
        ];
    }
}
```

### `app/Events/ChatMessageSent.php`

```php
<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ChatMessage $message) {}

    public function broadcastOn(): array
    {
        return [new Channel('public-chat')];
    }

    public function broadcastAs(): string
    {
        return 'chat.message';
    }

    public function broadcastWith(): array
    {
        return [
            'id'         => $this->message->id,
            'content'    => $this->message->content,
            'created_at' => $this->message->created_at->toISOString(),
        ];
    }
}
```

---

## Step 10 — Routes

### `routes/web.php`

```php
<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Public as PublicControllers;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/', [PublicControllers\MapController::class, 'index'])->name('home');

// Admin auth
Route::get('/admin/login', [Admin\AuthController::class, 'showLogin'])->name('admin.login');
Route::post('/admin/login', [Admin\AuthController::class, 'login']);
Route::post('/admin/logout', [Admin\AuthController::class, 'logout'])->name('admin.logout');

// Admin (protected)
Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [Admin\DashboardController::class, 'index'])->name('dashboard');

    Route::get('/raw-news', [Admin\RawNewsController::class, 'index'])->name('raw-news.index');
    Route::post('/raw-news/fetch', [Admin\RawNewsController::class, 'fetch'])->name('raw-news.fetch');
    Route::delete('/raw-news/{rawNews}', [Admin\RawNewsController::class, 'destroy'])->name('raw-news.destroy');

    Route::get('/preprocessed-news', [Admin\PreprocessedNewsController::class, 'index'])->name('preprocessed-news.index');
    Route::delete('/preprocessed-news/{preprocessedNews}', [Admin\PreprocessedNewsController::class, 'destroy'])->name('preprocessed-news.destroy');

    Route::get('/llm-settings', [Admin\LlmSettingsController::class, 'index'])->name('llm-settings.index');
    Route::put('/llm-settings', [Admin\LlmSettingsController::class, 'update'])->name('llm-settings.update');
    Route::post('/llm-settings/test', [Admin\LlmSettingsController::class, 'test'])->name('llm-settings.test');

    Route::get('/chat', [Admin\ChatController::class, 'index'])->name('chat.index');
    Route::delete('/chat/prune', [Admin\ChatController::class, 'prune'])->name('chat.prune');
});
```

### `routes/api.php`

```php
<?php

use App\Http\Controllers\Api;
use Illuminate\Support\Facades\Route;

// Map data endpoint (public)
Route::get('/map-data', [Api\MapDataController::class, 'index']);

// Chat (rate-limited — 5 messages per minute per IP)
Route::middleware(['throttle:chat'])->group(function () {
    Route::get('/chat/messages', [Api\ChatController::class, 'index']);
    Route::post('/chat/messages', [Api\ChatController::class, 'store']);
});
```

### Rate limiter in `AppServiceProvider` or `bootstrap/app.php`

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('chat', function (Request $request) {
    return Limit::perMinute(5)->by(hash('sha256', $request->ip()));
});
```

### `routes/channels.php`

```php
<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('public-map', fn() => true);
Broadcast::channel('public-chat', fn() => true);
```

---

## Step 11 — Controllers

### `app/Http/Controllers/Api/MapDataController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreprocessedNews;
use Illuminate\Http\JsonResponse;

class MapDataController extends Controller
{
    public function index(): JsonResponse
    {
        $features = PreprocessedNews::whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereNotIn('geocode_confidence', ['none'])
            ->latest('fetched_at')
            ->limit(1000)
            ->get()
            ->map(fn($n) => [
                'type' => 'Feature',
                'geometry' => [
                    'type'        => 'Point',
                    'coordinates' => [(float) $n->longitude, (float) $n->latitude],
                ],
                'properties' => [
                    'id'         => $n->id,
                    'headline'   => $n->headline,
                    'summary'    => $n->summary,
                    'source_url' => $n->news_source_url,
                    'provider'   => $n->news_provider,
                    'place_name' => $n->place_name,
                    'fetched_at' => $n->fetched_at?->toISOString(),
                ],
            ]);

        return response()->json([
            'type'     => 'FeatureCollection',
            'features' => $features,
        ]);
    }
}
```

### `app/Http/Controllers/Api/ChatController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Events\ChatMessageSent;
use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function index(): JsonResponse
    {
        $messages = ChatMessage::where('created_at', '>=', now()->subHours(48))
            ->orderBy('created_at')
            ->get(['id', 'content', 'created_at']);

        return response()->json($messages);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => 'required|string|min:1|max:500',
        ]);

        $message = ChatMessage::create([
            'id'      => Str::uuid(),
            'content' => $validated['content'],
            'ip_hash' => hash('sha256', $request->ip()),
        ]);

        broadcast(new ChatMessageSent($message))->toOthers();

        return response()->json([
            'id'         => $message->id,
            'content'    => $message->content,
            'created_at' => $message->created_at->toISOString(),
        ], 201);
    }
}
```

### `app/Http/Controllers/Admin/RawNewsController.php`

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\FetchNewsJob;
use App\Models\RawNews;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class RawNewsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/RawNews', [
            'news' => RawNews::latest('fetched_at')->paginate(50),
        ]);
    }

    public function fetch(): RedirectResponse
    {
        FetchNewsJob::dispatch();
        return back()->with('success', 'Fetch job dispatched.');
    }

    public function destroy(RawNews $rawNews): RedirectResponse
    {
        $rawNews->delete();
        return back()->with('success', 'Deleted.');
    }
}
```

### `app/Http/Controllers/Admin/LlmSettingsController.php`

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LlmSetting;
use App\Services\LlmGeocoderService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LlmSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/LlmSettings', [
            'setting' => LlmSetting::current()->makeHidden('api_key'),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'provider'     => 'required|in:openrouter,lmstudio,deepseek',
            'api_base_url' => 'required|url',
            'api_key'      => 'nullable|string',
            'model_slug'   => 'required|string|max:200',
        ]);

        $setting = LlmSetting::current();
        // Only update api_key if a new one was provided
        if (empty($validated['api_key'])) {
            unset($validated['api_key']);
        }
        $setting->update($validated);

        return back()->with('success', 'LLM settings updated.');
    }

    public function test()
    {
        $geocoder = app(LlmGeocoderService::class);
        $result = $geocoder->geocode(
            'Protesters march in Jakarta against fuel price hike',
            'Thousands of demonstrators gathered in central Jakarta on Monday...'
        );

        return response()->json(['result' => $result]);
    }
}
```

---

## Step 12 — Frontend (React + Inertia)

### `resources/js/app.jsx`

```jsx
import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'
import '../css/app.css'

createInertiaApp({
  resolve: name => {
    const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true })
    return pages[`./Pages/${name}.jsx`]
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
```

### `resources/js/Pages/Public/Map.jsx`

This is the main public page. It loads Mapbox GL JS, renders dots and heatmap, handles click-to-expand article panel, and includes the chat widget.

```jsx
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import ChatWidget from '@/Components/ChatWidget'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

window.Pusher = Pusher
const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
  wssPort: import.meta.env.VITE_REVERB_PORT,
  forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
})

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [heatmapVisible, setHeatmapVisible] = useState(false)

  useEffect(() => {
    if (map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 2,
    })

    map.current.on('load', async () => {
      // Fetch initial GeoJSON
      const res = await fetch('/api/map-data')
      const geojson = await res.json()

      map.current.addSource('news', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 40,
      })

      // Heatmap layer
      map.current.addLayer({
        id: 'news-heatmap',
        type: 'heatmap',
        source: 'news',
        maxzoom: 12,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,255,0)',
            0.2, 'royalblue',
            0.4, 'cyan',
            0.6, 'lime',
            0.8, 'yellow',
            1, 'red',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 9, 30],
          'heatmap-opacity': 0.7,
        },
        layout: { visibility: 'none' },
      })

      // Dot layer (individual points)
      map.current.addLayer({
        id: 'news-dots',
        type: 'circle',
        source: 'news',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#ef4444',
          'circle-radius': 7,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.85,
        },
      })

      // Cluster circles
      map.current.addLayer({
        id: 'news-clusters',
        type: 'circle',
        source: 'news',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      })

      // Cluster count labels
      map.current.addLayer({
        id: 'news-cluster-count',
        type: 'symbol',
        source: 'news',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fff' },
      })

      // Click on dot → show detail panel
      map.current.on('click', 'news-dots', (e) => {
        const props = e.features[0].properties
        setSelectedFeature(props)
      })

      // Click on cluster → zoom in
      map.current.on('click', 'news-clusters', (e) => {
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['news-clusters'] })
        const clusterId = features[0].properties.cluster_id
        map.current.getSource('news').getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.current.easeTo({ center: features[0].geometry.coordinates, zoom })
        })
      })

      map.current.on('mouseenter', 'news-dots', () => {
        map.current.getCanvas().style.cursor = 'pointer'
      })
      map.current.on('mouseleave', 'news-dots', () => {
        map.current.getCanvas().style.cursor = ''
      })
    })

    // Realtime: append new features without full reload
    echo.channel('public-map').listen('.news.geocoded', (data) => {
      const source = map.current?.getSource('news')
      if (!source) return
      const current = source._data
      current.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [data.longitude, data.latitude] },
        properties: {
          id: data.id,
          headline: data.headline,
          summary: data.summary,
          source_url: data.source_url,
          provider: data.provider,
          place_name: data.place_name,
          fetched_at: data.fetched_at,
        },
      })
      source.setData(current)
    })

    return () => {
      echo.leave('public-map')
      map.current?.remove()
    }
  }, [])

  const toggleHeatmap = () => {
    const visibility = heatmapVisible ? 'none' : 'visible'
    map.current?.setLayoutProperty('news-heatmap', 'visibility', visibility)
    setHeatmapVisible(!heatmapVisible)
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-gray-900/90 text-white px-3 py-2 rounded-lg text-sm font-semibold tracking-wide">
          MarchSeek
        </div>
        <button
          onClick={toggleHeatmap}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            heatmapVisible
              ? 'bg-orange-500 text-white'
              : 'bg-gray-800/90 text-gray-200 hover:bg-gray-700/90'
          }`}
        >
          {heatmapVisible ? 'Hide heatmap' : 'Show heatmap'}
        </button>
      </div>

      {/* Article detail panel */}
      {selectedFeature && (
        <div className="absolute top-4 right-4 z-10 w-80 bg-gray-900/95 text-white rounded-xl shadow-xl p-4 border border-gray-700">
          <div className="flex justify-between items-start gap-2 mb-2">
            <span className="text-xs text-orange-400 font-medium uppercase tracking-wide">
              {selectedFeature.place_name}
            </span>
            <button
              onClick={() => setSelectedFeature(null)}
              className="text-gray-400 hover:text-white text-lg leading-none"
            >×</button>
          </div>
          <h3 className="text-sm font-semibold mb-2 leading-snug">{selectedFeature.headline}</h3>
          {selectedFeature.summary && (
            <p className="text-xs text-gray-300 mb-3 leading-relaxed">{selectedFeature.summary}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{selectedFeature.provider}</span>
            <a
              href={selectedFeature.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Read source →
            </a>
          </div>
        </div>
      )}

      {/* Chat widget */}
      <ChatWidget echo={echo} />
    </div>
  )
}
```

### `resources/js/Components/ChatWidget.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'

export default function ChatWidget({ echo }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    // Load existing messages
    fetch('/api/chat/messages')
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {})

    // Subscribe to new messages
    echo.channel('public-chat').listen('.chat.message', (data) => {
      setMessages(prev => [...prev, data])
    })

    return () => echo.leave('public-chat')
  }, [])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const send = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ content: input.trim() }),
      })

      if (res.status === 429) {
        setError('Too many messages. Please wait a moment.')
        return
      }

      if (!res.ok) {
        setError('Failed to send.')
        return
      }

      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setInput('')
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
             style={{ height: '420px' }}>
          <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Public chat</span>
            <span className="text-xs text-gray-500">Anonymous · messages expire in 48 h</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-gray-500 text-center mt-8">No messages yet. Say something.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-sm text-gray-100 break-words">{msg.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="text-xs text-red-400 px-4 pb-1">{error}</p>
          )}

          <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={500}
              placeholder="Type a message…"
              className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-600 focus:border-gray-400 placeholder-gray-500"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="bg-orange-500 hover:bg-orange-400 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors text-xl"
        title="Toggle public chat"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}
```

---

## Step 13 — Admin Pages (React/Inertia)

Create the following Inertia pages. Each receives data as props from its controller.

### `resources/js/Pages/Admin/Dashboard.jsx`
Props: `{ rawCount, preprocessedCount, lastFetchedAt, queuedJobs }`
Render a stat grid showing those four values.

### `resources/js/Pages/Admin/RawNews.jsx`
Props: `{ news }` (Laravel paginator object)
Render a paginated table with columns: id, headline (truncated), news\_provider, status, fetched\_at. Include a **Refetch now** button that posts to `/admin/raw-news/fetch`. Include a delete button per row.

### `resources/js/Pages/Admin/PreprocessedNews.jsx`
Props: `{ news }` (paginator)
Columns: headline, place\_name, geocode\_confidence, latitude, longitude, fetched\_at. Include per-row delete button.

### `resources/js/Pages/Admin/LlmSettings.jsx`
Props: `{ setting }`
Form with fields: provider (select: openrouter/lmstudio/deepseek), api\_base\_url, api\_key (password input, leave blank to keep current), model\_slug. Include a **Test connection** button that calls `/admin/llm-settings/test` via fetch and shows the JSON result.

### `resources/js/Pages/Admin/Chat.jsx`
Props: `{ messages }` (paginator)
Table of chat messages. Include a **Prune all old messages** button that posts to `/admin/chat/prune`.

### `resources/js/Pages/Admin/Login.jsx`
Standard email + password form posting to `/admin/login`.

### Admin layout
Wrap all admin pages in a shared layout `resources/js/Layouts/AdminLayout.jsx` with a sidebar nav containing links to Dashboard, Raw news, Preprocessed news, LLM settings, Chat, and a Logout button.

---

## Step 14 — Vite Config

### `vite.config.js`

```js
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/app.jsx', 'resources/css/app.css'],
      refresh: true,
    }),
    react(),
  ],
  resolve: {
    alias: { '@': '/resources/js' },
  },
})
```

### Required npm packages

```bash
npm install mapbox-gl laravel-echo pusher-js @inertiajs/react @vitejs/plugin-react
```

---

## Step 15 — Additional Config Files

### `config/llm.php`

```php
<?php

return [
    'provider'     => env('LLM_PROVIDER', 'openrouter'),
    'api_base_url' => env('LLM_API_BASE_URL', 'https://openrouter.ai/api/v1'),
    'api_key'      => env('LLM_API_KEY'),
    'model'        => env('LLM_MODEL', 'openai/gpt-4o-mini'),
];
```

### `config/services.php` additions

```php
'gnews' => [
    'api_key' => env('GNEWS_API_KEY'),
],
'newsdata' => [
    'api_key' => env('NEWSDATA_API_KEY'),
],
```

---

## Step 16 — Seeder

Create a `LlmSettingSeeder` that calls `LlmSetting::current()` to insert the default row from config if none exists. Run it in `DatabaseSeeder`.

---

## Step 17 — Build & Run

```bash
# 1. Copy env
cp .env.example .env

# 2. Fill in: MAPBOX_TOKEN, GNEWS_API_KEY, NEWSDATA_API_KEY, LLM_API_KEY
#    Leave DB settings as-is (they match docker-compose)

# 3. Build and start containers
docker compose up -d --build

# 4. Generate app key
docker compose exec app php artisan key:generate

# 5. Run migrations + seeders
docker compose exec app php artisan migrate --seed

# 6. Trigger first news fetch manually
docker compose exec app php artisan news:fetch

# 7. Open http://localhost
# Admin: http://localhost/admin
#   Default admin user: create via tinker or add a seeder
```

### Create admin user via tinker

```bash
docker compose exec app php artisan tinker
>>> \App\Models\User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => bcrypt('password')]);
```

---

## Key Implementation Notes

1. **Rate limiting behind Docker**: The `TRUSTED_PROXIES=*` env var and the `TrustProxies` middleware are mandatory. Without them, `$request->ip()` always returns the nginx container IP, making rate limiting useless. This is set up in Step 3.

2. **LM Studio support**: Set `LLM_PROVIDER=lmstudio`, `LLM_API_BASE_URL=http://host.docker.internal:1234/v1`, `LLM_API_KEY=not-needed`. LM Studio's API is OpenAI-compatible, so `LlmGeocoderService` works without modification.

3. **DeepSeek**: Set `LLM_API_BASE_URL=https://api.deepseek.com/v1` and use a DeepSeek API key. Use model `deepseek-chat`.

4. **Mapbox token scoping**: In the Mapbox dashboard, restrict your public token to your domain and to only the `styles:read` and `tiles:read` API scopes.

5. **GeoJSON null island exclusion**: Articles where the LLM returns `confidence: none` are stored with null lat/lng and excluded from the `/api/map-data` query via the `whereNotNull` clauses.

6. **Broadcasting queue**: Ensure `QUEUE_CONNECTION=database` and that the `queue` container is running. Without it, `ShouldBroadcast` events queue up and never fire.

7. **Reverb CORS**: If the frontend and Reverb are on different ports in production, configure `REVERB_HOST` and allowed origins in `config/reverb.php`.
