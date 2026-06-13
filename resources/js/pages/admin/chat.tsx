import { router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';

interface ChatMessage {
    id: string;
    content: string;
    created_at: string;
}

interface Props {
    messages: { data: ChatMessage[] };
}

export default function AdminChat({ messages }: Props) {
    const prune = () => {
        if (!confirm('Prune all messages older than 48 hours?')) {
return;
}

        router.delete('/admin/chat/prune');
    };

    return (
        <AdminLayout title="Public Chat Moderation">
            <div className="mb-4 flex justify-between">
                <p className="text-sm text-gray-400">Messages older than 48 hours are automatically pruned by scheduler.</p>
                <button onClick={prune} className="px-4 py-2 text-sm rounded-xl border border-red-500/40 text-red-400 hover:bg-red-950/40">Prune old messages</button>
            </div>

            <div className="space-y-2 max-w-3xl">
                {messages.data.length === 0 && <p className="text-gray-500">No recent messages.</p>}
                {messages.data.map((m) => (
                    <div key={m.id} className="bg-gray-900/70 border border-white/10 rounded-2xl px-4 py-3 text-sm">
                        <div className="text-gray-100">{m.content}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                    </div>
                ))}
            </div>
        </AdminLayout>
    );
}
