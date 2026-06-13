import { Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AdminLayout from '@/layouts/admin-layout';

interface RawNewsItem {
    id: number;
    headline: string;
    news_provider?: string;
    status: string;
    fetched_at?: string;
}

interface Paginator<T> {
    data: T[];
    links: any;
    meta?: any;
}

interface Props {
    news: Paginator<RawNewsItem>;
}

export default function RawNews({ news }: Props) {
    const [fetching, setFetching] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);

    // Remove any selected IDs that are no longer in the current page data
    useEffect(() => {
        const currentIds = news.data.map(i => i.id);
        setSelected(prev => prev.filter(id => currentIds.includes(id)));
    }, [news.data]);

    const triggerFetch = () => {
        setFetching(true);
        router.post('/admin/raw-news/fetch', {}, {
            onFinish: () => setFetching(false),
        });
    };

    const destroy = (id: number) => {
        if (!confirm('Delete this raw item?')) {
            return;
        }
        router.delete(`/admin/raw-news/${id}`);
    };

    const toggleSelect = (id: number) => {
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

    const handleBulkDelete = () => {
        if (selected.length === 0) return;
        if (!confirm(`Delete ${selected.length} selected items?`)) return;

        router.post('/admin/raw-news/bulk-destroy', { ids: selected }, {
            onSuccess: () => setSelected([]),
        });
    };

    return (
        <AdminLayout title="Raw News">
            <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-gray-400">Unprocessed news items fetched from providers.</p>
                <button
                    onClick={triggerFetch}
                    disabled={fetching}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-sm font-medium disabled:opacity-50"
                >
                    {fetching ? 'Dispatching…' : 'Refetch now'}
                </button>
            </div>

            {selected.length > 0 && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-gray-900/60 px-4 py-2 text-sm">
                    <span className="text-gray-300">{selected.length} selected</span>
                    <button
                        onClick={handleBulkDelete}
                        className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                    >
                        Delete selected
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
                            <th className="px-4 py-3 font-normal">ID</th>
                            <th className="px-4 py-3 font-normal">Headline</th>
                            <th className="px-4 py-3 font-normal">Provider</th>
                            <th className="px-4 py-3 font-normal">Status</th>
                            <th className="px-4 py-3 font-normal">Fetched</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {news.data.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No raw news yet.</td></tr>
                        )}
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
                                <td className="px-4 py-3 tabular-nums text-gray-500">{item.id}</td>
                                <td className="px-4 py-3 pr-8 max-w-md truncate" title={item.headline}>{item.headline}</td>
                                <td className="px-4 py-3 text-gray-400">{item.news_provider || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${item.status === 'processed' ? 'bg-emerald-500/20 text-emerald-400' : item.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-xs">{item.fetched_at ? new Date(item.fetched_at).toLocaleString() : '—'}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => destroy(item.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Simple pagination info */}
            <div className="mt-4 text-xs text-gray-500">Showing {news.data.length} items • Use Laravel pagination links if more pages.</div>
        </AdminLayout>
    );
}
