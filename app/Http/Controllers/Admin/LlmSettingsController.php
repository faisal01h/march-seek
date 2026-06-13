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
        return Inertia::render('admin/llm-settings', [
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
