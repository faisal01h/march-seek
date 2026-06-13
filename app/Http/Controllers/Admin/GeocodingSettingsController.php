<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GeocodingSetting;
use App\Services\LlmGeocoderService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GeocodingSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/geocoding-settings', [
            'setting' => GeocodingSetting::current()->makeHidden('api_key'),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'provider' => 'required|in:mapbox,openstreetmap',
            'api_key'  => 'nullable|string',
        ]);

        $setting = GeocodingSetting::current();
        if (empty($validated['api_key'])) {
            unset($validated['api_key']);
        }
        $setting->update($validated);

        return back()->with('success', 'Geocoding settings updated.');
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
