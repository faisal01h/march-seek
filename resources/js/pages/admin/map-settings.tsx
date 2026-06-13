import { Head, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

interface Props {
    setting: {
        provider: 'mapbox' | 'osm';
        osm_style?: string;
    };
}

const osmStyleOptions = [
    { value: 'positron', label: 'Positron (Light)' },
    { value: 'dark-matter', label: 'Dark Matter (Dark)' },
    { value: 'osm-bright', label: 'OSM Bright' },
    { value: 'klokantech-basic', label: 'Klokantech Basic' },
];

export default function MapSettings({ setting }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        provider: setting.provider,
        mapbox_token: '',
        osm_style: setting.osm_style || 'positron',
    });

    const [success, setSuccess] = useState<string | null>(null);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setSuccess(null);
        put('/admin/map-settings', {
            onSuccess: () => {
                setSuccess('Map settings updated successfully.');
                setData('mapbox_token', '');
            },
        });
    };

    return (
        <>
            <Head title="Map Settings" />
            <div className="max-w-2xl">
                <p className="text-sm text-gray-400 mb-6">
                    Choose the map tile provider for the public map view. Mapbox requires a (public) token for its vector styles.
                    OpenStreetMap mode uses reliable standard OSM raster tiles (for broad compatibility and to avoid external style load issues).
                    You can still select a preferred "OpenMapTiles style" name — it is used for display / future vector support.
                    Full vector OpenMapTiles styles typically require a free or paid MapTiler key.
                </p>

                <form onSubmit={submit} className="space-y-6">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Tile Provider</label>
                        <select
                            value={data.provider}
                            onChange={(e) => setData('provider', e.target.value as 'mapbox' | 'osm')}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        >
                            <option value="mapbox">Mapbox (vector, high quality)</option>
                            <option value="osm">OpenStreetMap + OpenMapTiles (free)</option>
                        </select>
                    </div>

                    {data.provider === 'mapbox' && (
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Mapbox Public Token</label>
                            <input
                                type="text"
                                value={data.mapbox_token}
                                onChange={(e) => setData('mapbox_token', e.target.value)}
                                placeholder="pk.eyJ1Ijoi..."
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave blank to keep the current token from .env or previous setting. Get one at <a href="https://account.mapbox.com/access-tokens/" target="_blank" className="text-orange-400">mapbox.com</a>.
                            </p>
                            {errors.mapbox_token && <p className="text-xs text-red-400 mt-1">{errors.mapbox_token}</p>}
                        </div>
                    )}

                    {data.provider === 'osm' && (
                        <div>
                            <label className="text-xs text-gray-400 block mb-1">OpenMapTiles Style</label>
                            <select
                                value={data.osm_style}
                                onChange={(e) => setData('osm_style', e.target.value)}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                            >
                                {osmStyleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Styles provided by OpenMapTiles. The public map will show a style switcher (Google Maps style picker) when OSM is active.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-6 py-2.5 rounded-xl bg-white text-gray-950 font-medium text-sm disabled:opacity-60"
                        >
                            {processing ? 'Saving…' : 'Save settings'}
                        </button>
                    </div>
                </form>

                {success && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                        {success}
                    </div>
                )}

                {errors.provider && <p className="text-xs text-red-400 mt-2">{errors.provider}</p>}

                <div className="mt-8 text-xs text-gray-500 space-y-2 border-t border-white/10 pt-4">
                    <p><strong>Mapbox:</strong> High-quality vector tiles, requires a public token (restricted to your domain in production).</p>
                    <p><strong>OpenStreetMap:</strong> Uses standard OSM raster tiles (https://tile.openstreetmap.org). Very reliable, no token needed. Attribution is included.</p>
                    <p className="pt-1">The style selector on the public map (when OSM is active) lets users pick a preferred OpenMapTiles look name. To use real vector styles from OpenMapTiles / MapTiler, you can extend the code with a style URL + key.</p>
                </div>
            </div>
        </>
    );
}

MapSettings.layout = {
    breadcrumbs: [
        { title: 'Admin', href: '/admin' },
        { title: 'Map Settings', href: '/admin/map-settings' },
    ],
};
