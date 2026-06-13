import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

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
    search?: string;
}

export default function PreprocessedNews({ news, search = '' }: Props) {
    const [selected, setSelected] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState(search);

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

    const toggleSelect = (id: string) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const currentIds = news.data.map(i => i.id);
        const allSelected = currentIds.length > 0 && currentIds.every(id => selected.includes(id));

        if (allSelected) {
            setSelected(prev => prev.filter(id => !currentIds.includes(id)));
        } else {
            setSelected(prev => [...new Set([...prev, ...currentIds])]);
        }
    };

    const isAllSelected = news.data.length > 0 && news.data.every(item => selected.includes(item.id));

    const handleBulkReassess = () => {
        if (selected.length === 0) return;
        if (!confirm(`Reassess ${selected.length} selected items?`)) return;

        router.post('/admin/preprocessed-news/bulk-reassess', { ids: selected }, {
            onSuccess: () => setSelected([]),
        });
    };

    // Remove any selected IDs that are no longer in the current page data
    useEffect(() => {
        const currentIds = news.data.map(i => i.id);
        setSelected(prev => prev.filter(id => currentIds.includes(id)));
    }, [news.data]);

    return (
        <>
            <Head title="Preprocessed / Geocoded Events" />
            <p className="text-sm text-gray-400 mb-4">Events successfully located by the LLM and shown on the public map.</p>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    router.get('/admin/preprocessed-news', { search: searchTerm }, {
                        preserveState: true,
                        preserveScroll: true,
                    });
                }}
                className="mb-4 flex gap-2"
            >
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search title, content, or hashtags..."
                    className="flex-1 rounded-xl border border-white/10 bg-gray-900 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <button
                    type="submit"
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white"
                >
                    Search
                </button>
                {search && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            router.get('/admin/preprocessed-news', {}, { preserveState: true });
                        }}
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-gray-800"
                    >
                        Clear
                    </button>
                )}
            </form>

            {selected.length > 0 && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900/60 px-4 py-2 text-sm">
                    <span className="text-gray-300">{selected.length} selected</span>
                    <button
                        onClick={handleBulkReassess}
                        className="rounded-lg bg-blue-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                    >
                        Reassess selected
                    </button>
                    <button
                        onClick={() => setSelected([])}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-900/50">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400 border-b border-white/10">
                        <tr>
                            <th className="w-8 px-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={toggleSelectAll}
                                    className="accent-orange-500"
                                />
                            </th>
                            <th className="px-4 py-3 font-normal">Headline</th>
                            <th className="px-4 py-3 font-normal">Place</th>
                            <th className="px-4 py-3 font-normal">Confidence</th>
                            <th className="px-4 py-3 font-normal">Lat / Lng</th>
                            <th className="px-4 py-3 font-normal">Fetched</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {news.data.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No processed events.</td></tr>}
                        {news.data.map((item) => (
                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="accent-orange-500"
                                    />
                                </td>
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
        </>
    );
}

PreprocessedNews.layout = {
    breadcrumbs: [
        {
            title: 'Admin',
            href: '/admin',
        },
        {
            title: 'Preprocessed',
            href: '/admin/preprocessed-news',
        },
    ],
};
