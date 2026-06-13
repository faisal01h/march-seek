<?php

namespace App\Http\Middleware;

use App\Models\MapSetting;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'mapboxToken' => config('services.mapbox.token'),
            'mapConfig' => (function () {
                try {
                    $setting = MapSetting::current();

                    return [
                        'provider' => $setting->provider ?? 'mapbox',
                        'mapboxToken' => $setting->mapbox_token ?: config('services.mapbox.token'),
                        'osmStyle' => $setting->osm_style ?? 'positron',
                    ];
                } catch (\Throwable $e) {
                    // Graceful fallback if table doesn't exist yet (pre-migration) or DB issue
                    return [
                        'provider' => 'mapbox',
                        'mapboxToken' => config('services.mapbox.token'),
                        'osmStyle' => 'positron',
                    ];
                }
            })(),
        ];
    }
}
