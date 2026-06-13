import { router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';

interface PreItem {
    id: string;
    headline: string;
    place_name?: string;
    geocode_confidence?: string;
    latitude?: number;
    longitude?: number;
    fetched_at?: string;
}

interface Props {
    news: { data: PreItem[] };
}

export default function PreprocessedNews({ news }: Props) {
    const destroy = (id: string) => {
        if (!confirm('Delete this geocoded event?')) {
            return;
        }
        router.delete(`/admin/preprocessed-news/${id}`);
    };

    const reassess = (id: string) => {
        if (!confirm('Re-run the LLM → Mapbox pipeline to reassess this location?')) {
            return;
        }
        router.post(`/admin/preprocessed-news/${id}/reassess`);
    };

    return (
        <AdminLayout title="Preprocessed / Geocoded Events">
            <p className="text-sm text-gray-400 mb-4">Events successfully located by the LLM and shown on the public map.</p>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-900/50">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400 border-b border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-normal">Headline</th>
                            <th className="px-4 py-3 font-normal">Place</th>
                            <th className="px-4 py-3 font-normal">Confidence</th>
                            <th className="px-4 py-3 font-normal">Lat / Lng</th>
                            <th className="px-4 py-3 font-normal">Fetched</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {news.data.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No processed events.</td></tr>}
                        {news.data.map((item) => (
                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-4 py-3 max-w-xs truncate" title={item.headline}>{item.headline}</td>
                                <td className="px-4 py-3 text-gray-300">{item.place_name || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-0.5 rounded bg-white/10">{item.geocode_confidence}</span>
                                </td>
                                <td className="px-4 py-3 tabular-nums text-xs text-gray-400">{item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</td>
                                <td className="px-4 py-3 text-xs text-gray-500">{item.fetched_at ? new Date(item.fetched_at).toLocaleString() : '—'}</td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button onClick={() => reassess(item.id)} className="text-blue-400 hover:text-blue-300 text-xs">Reassess</button>
                                    <button onClick={() => destroy(item.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
