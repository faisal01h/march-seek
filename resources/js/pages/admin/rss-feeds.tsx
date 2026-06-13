import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

interface RssFeed {
    id: number;
    url: string;
    title?: string;
    active: boolean;
    last_fetched_at?: string;
    created_at: string;
}

interface Paginator<T> {
    data: T[];
    links?: any;
    meta?: any;
}

interface Props {
    feeds: Paginator<RssFeed>;
}

export default function RssFeeds({ feeds }: Props) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const addFeed = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setSubmitting(true);
        router.post('/admin/rss-feeds', {
            url,
            title: title || null,
        }, {
            onSuccess: () => {
                setUrl('');
                setTitle('');
            },
            onFinish: () => setSubmitting(false),
        });
    };

    const toggleActive = (feed: RssFeed) => {
        router.put(`/admin/rss-feeds/${feed.id}`, {
            url: feed.url,
            title: feed.title,
            active: !feed.active,
        });
    };

    const destroy = (id: number) => {
        if (!confirm('Delete this RSS feed?')) return;
        router.delete(`/admin/rss-feeds/${id}`);
    };

    return (
        <>
            <Head title="RSS Feeds" />
            <p className="text-sm text-gray-400 mb-4">
                Configure RSS/Atom feeds to ingest news from. Active feeds are checked during news:fetch.
            </p>

            {/* Add new feed form */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-gray-900/50 p-4">
                <form onSubmit={addFeed} className="flex flex-col gap-3 md:flex-row">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/feed.xml"
                        required
                        className="flex-1 rounded-xl border border-white/10 bg-gray-800 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Optional title (e.g. BBC World)"
                        className="w-full rounded-xl border border-white/10 bg-gray-800 px-4 py-2 text-sm focus:border-orange-500 focus:outline-none md:w-64"
                    />
                    <button
                        type="submit"
                        disabled={submitting || !url}
                        className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                        {submitting ? 'Adding…' : 'Add Feed'}
                    </button>
                </form>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-900/50">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-400 border-b border-white/10">
                        <tr>
                            <th className="px-4 py-3 font-normal">URL / Title</th>
                            <th className="px-4 py-3 font-normal">Active</th>
                            <th className="px-4 py-3 font-normal">Last Fetched</th>
                            <th className="px-4 py-3 font-normal">Added</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {feeds.data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                    No RSS feeds configured yet. Add some above.
                                </td>
                            </tr>
                        )}
                        {feeds.data.map((feed) => (
                            <tr key={feed.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-200 break-all">{feed.url}</div>
                                    {feed.title && (
                                        <div className="text-xs text-gray-400">{feed.title}</div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => toggleActive(feed)}
                                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                            feed.active
                                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                        }`}
                                    >
                                        {feed.active ? 'Active' : 'Paused'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                    {feed.last_fetched_at
                                        ? new Date(feed.last_fetched_at).toLocaleString()
                                        : 'Never'}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500">
                                    {new Date(feed.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => destroy(feed.id)}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-xs text-gray-500">
                {feeds.data.length} feed(s) • RSS items are fetched during the hourly news ingestion and deduplicated by URL.
            </div>
        </>
    );
}

RssFeeds.layout = {
    breadcrumbs: [
        {
            title: 'Admin',
            href: '/admin',
        },
        {
            title: 'RSS Feeds',
            href: '/admin/rss-feeds',
        },
    ],
};
