import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { useState } from 'react';

interface Setting {
    id?: number;
    provider: string;
}

interface Props {
    setting: Setting;
}

export default function GeocodingSettings({ setting }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        provider: setting.provider || 'mapbox',
        api_key: '',
    });

    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put('/admin/geocoding-settings');
    };

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch('/admin/geocoding-settings/test', { method: 'POST' });
            const json = await res.json();
            setTestResult(json);
        } catch (e) {
            setTestResult({ error: 'Request failed' });
        } finally {
            setTesting(false);
        }
    };

    return (
        <>
            <Head title="Geocoding Settings" />
            <div className="max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Provider</label>
                        <select
                            value={data.provider}
                            onChange={(e) => setData('provider', e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        >
                            <option value="mapbox">Mapbox</option>
                            <option value="openstreetmap">OpenStreetMap (Nominatim)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">
                            API Key (optional - only needed for Mapbox if overriding the env token)
                        </label>
                        <input
                            type="password"
                            value={data.api_key}
                            onChange={(e) => setData('api_key', e.target.value)}
                            placeholder="pk.ey..."
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        />
                        {errors.api_key && <p className="text-xs text-red-400 mt-1">{errors.api_key}</p>}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={processing} className="px-6 py-2.5 rounded-xl bg-white text-gray-950 font-medium text-sm">
                            {processing ? 'Saving…' : 'Save settings'}
                        </button>
                        <button type="button" onClick={testConnection} disabled={testing} className="px-6 py-2.5 rounded-xl border border-white/20 text-sm">
                            {testing ? 'Testing…' : 'Test connection'}
                        </button>
                    </div>
                </form>

                {testResult && (
                    <pre className="mt-6 text-xs bg-black/60 p-4 rounded-2xl overflow-auto border border-white/10">{JSON.stringify(testResult, null, 2)}</pre>
                )}

                <div className="mt-6 text-xs text-gray-500 space-y-1">
                    <p><strong>Mapbox:</strong> Uses your MAPBOX_TOKEN (or the api_key above). Good accuracy, rate limited by token.</p>
                    <p><strong>OpenStreetMap (Nominatim):</strong> Free, no key required. Please be respectful of rate limits (1 request/sec recommended). May be less precise for some locations.</p>
                </div>
            </div>
        </>
    );
}

GeocodingSettings.layout = {
    breadcrumbs: [
        {
            title: 'Admin',
            href: '/admin',
        },
        {
            title: 'Geocoding Settings',
            href: '/admin/geocoding-settings',
        },
    ],
};
