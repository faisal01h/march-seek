<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MapSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MapSettingsController extends Controller
{
    public function index(): Response
    {
        $setting = MapSetting::current();

        return Inertia::render('admin/map-settings', [
            'setting' => [
                'provider' => $setting->provider,
                'osm_style' => $setting->osm_style,
                // Do not expose the raw mapbox token in the form; let user enter new one if changing
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'provider' => 'required|in:mapbox,osm',
            'mapbox_token' => 'nullable|string',
            'osm_style' => 'nullable|string',
        ]);

        $setting = MapSetting::current();

        $data = [
            'provider' => $validated['provider'],
            'osm_style' => $validated['osm_style'] ?? $setting->osm_style,
        ];

        if (! empty($validated['mapbox_token'])) {
            $data['mapbox_token'] = $validated['mapbox_token'];
        }

        $setting->update($data);

        return back()->with('success', 'Map settings updated.');
    }
}
