import { Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';

interface Props {
    rawCount: number;
    preprocessedCount: number;
    lastFetchedAt: string | null;
    queuedJobs: number;
}

export default function Dashboard({ rawCount, preprocessedCount, lastFetchedAt, queuedJobs }: Props) {
    const stats = [
        { label: 'Raw News Items', value: rawCount },
        { label: 'Geocoded Events', value: preprocessedCount },
        { label: 'Queued Jobs', value: queuedJobs },
        { label: 'Last Fetch', value: lastFetchedAt ? new Date(lastFetchedAt).toLocaleString() : 'Never' },
    ];

    return (
        <AdminLayout title="Dashboard">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
                        <div className="text-xs uppercase tracking-widest text-gray-500">{stat.label}</div>
                        <div className="mt-2 text-3xl font-semibold tabular-nums">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/admin/raw-news" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">Manage Raw News</Link>
                <Link href="/admin/preprocessed-news" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">Manage Events</Link>
                <Link href="/admin/llm-settings" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">LLM Settings</Link>
                <Link href="/admin/chat" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10">Chat Moderation</Link>
            </div>

            <p className="mt-8 text-xs text-gray-500">Tip: Use the "Refetch now" buttons on the Raw News page or run <code>php artisan news:fetch</code> to pull fresh protest data.</p>
        </AdminLayout>
    );
}
