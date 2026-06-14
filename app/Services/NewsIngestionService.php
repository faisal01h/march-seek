<?php

namespace App\Services;

use App\Jobs\GeocodeNewsJob;
use App\Models\RawNews;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NewsIngestionService
{
    public function __construct(
        private array $keywords = []
    ) {
        $this->keywords = $keywords ?: explode(',', config('services.news_keyword_filter', ''));
    }

    public function fetchAll(): int
    {
        $count = 0;
        $count += $this->fetchFromGNews();
        $count += $this->fetchFromNewsData();
        $count += $this->fetchFromTheNewsAPI();
        $count += $this->fetchFromRssFeeds();
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
                    'lang'    => 'id',
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
            $response = Http::timeout(15)->get('https://newsdata.io/api/1/latest', [
                'apikey'   => $key,
                'q'        => implode(' OR ', array_slice($this->keywords, 0, 5)),
                'language' => 'id',
                'country'  => config('services.newsdata.country', 'id'),
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

    private function fetchFromTheNewsAPI(): int
    {
        $key = config('services.thenewsapi.api_key');
        if (!$key) return 0;

        $count = 0;
        $page = 1;
        $limit = 50;
        $maxPages = 20; // safety cap to avoid excessive API usage

        try {
            do {
                $response = Http::timeout(15)->get('https://api.thenewsapi.com/v1/news/all', [
                    'api_token' => $key,
                    'search'    => implode('|', array_slice($this->keywords, 0, 10)),
                    'language'  => 'id',
                    'limit'     => $limit,
                    'page'      => $page,
                    'published_after' => now()->subDays(1)->format('Y-m-d\TH:i:s'), // only fetch news from the last day
                ]);

                $data = $response->json('data', []);
                $meta = $response->json('meta', []);

                foreach ($data as $article) {
                    $url = $article['url'] ?? null;
                    if (!$url) continue;

                    $headline = $article['title'] ?? '';
                    $content = $article['description'] ?? $article['snippet'] ?? '';

                    if ($this->save($url, $headline, $content, 'thenewsapi')) {
                        $count++;
                    }
                }

                $found = $meta['found'] ?? 0;
                $currentLimit = $meta['limit'] ?? $limit;
                $currentPage = $meta['page'] ?? $page;

                // If we've fetched all available results, stop
                if ($currentPage * $currentLimit >= $found || empty($data)) {
                    break;
                }

                $page++;
            } while ($page <= $maxPages);
        } catch (\Exception $e) {
            Log::error('TheNewsAPI fetch error: ' . $e->getMessage());
        }

        return $count;
    }

    private function fetchFromRssFeeds(): int
    {
        $feeds = \App\Models\RssFeed::where('active', true)->get();
        if ($feeds->isEmpty()) {
            return 0;
        }

        $count = 0;
        $keywords = $this->keywords; // for optional keyword filtering

        foreach ($feeds as $feed) {
            try {
                $response = Http::timeout(20)
                    ->withHeaders(['User-Agent' => 'MarchSeek/1.0'])
                    ->get($feed->url);

                if (!$response->successful()) {
                    Log::warning('RSS feed fetch failed', ['url' => $feed->url, 'status' => $response->status()]);
                    continue;
                }

                $xmlString = $response->body();
                $xml = @simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);

                if (!$xml) {
                    Log::warning('Failed to parse RSS feed XML', ['url' => $feed->url]);
                    continue;
                }

                $items = [];
                if (isset($xml->channel->item)) {
                    $items = $xml->channel->item; // RSS 2.0
                } elseif (isset($xml->entry)) {
                    $items = $xml->entry; // Atom
                }

                $i = 0;
                $maxPerFeed = 30;

                foreach ($items as $item) {
                    if ($i++ >= $maxPerFeed) break;

                    $title = trim((string) ($item->title ?? ''));
                    $link = trim((string) ($item->link ?? $item->link['href'] ?? ''));

                    // Description / content
                    $desc = (string) ($item->description ?? '');
                    if (empty($desc) && isset($item->{'content:encoded'})) {
                        $desc = (string) $item->{'content:encoded'};
                    } elseif (empty($desc) && isset($item->content)) {
                        $desc = (string) $item->content;
                    }
                    $content = strip_tags($desc);

                    if (empty($link) || empty($title)) {
                        continue;
                    }

                    // Optional: light keyword filter (if keywords are set)
                    if (!empty($keywords)) {
                        $haystack = strtolower($title . ' ' . $content);
                        $matchesKeyword = false;
                        foreach ($keywords as $kw) {
                            if (str_contains($haystack, strtolower(trim($kw)))) {
                                $matchesKeyword = true;
                                break;
                            }
                        }
                        if (!$matchesKeyword) {
                            continue;
                        }
                    }

                    $provider = 'rss:' . parse_url($feed->url, PHP_URL_HOST);

                    if ($this->save($link, $title, $content, $provider)) {
                        $count++;
                    }
                }

                // Update last fetched
                $feed->last_fetched_at = now();
                $feed->save();

            } catch (\Exception $e) {
                Log::error('RSS feed error: ' . $e->getMessage(), ['url' => $feed->url]);
            }
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
