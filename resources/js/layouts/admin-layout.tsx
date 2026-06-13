import { Link, router } from '@inertiajs/react';
import type { ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function AdminLayout({ children, title = 'Admin' }: AdminLayoutProps) {
    const navItems = [
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/raw-news', label: 'Raw News' },
        { href: '/admin/preprocessed-news', label: 'Preprocessed' },
        { href: '/admin/llm-settings', label: 'LLM Settings' },
        { href: '/admin/geocoding-settings', label: 'Geocoding Settings' },
        { href: '/admin/map-settings', label: 'Map Settings' },
        { href: '/admin/rss-feeds', label: 'RSS Feeds' },
        { href: '/admin/chat', label: 'Chat' },
    ];

    const handleLogout = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/admin/logout');
    };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-200">
            <header className="border-b border-white/10 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/admin" className="font-semibold tracking-widest text-sm">MARCHSEEK ADMIN</Link>
                        <nav className="flex items-center gap-1 text-sm">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                        <Link href="/" className="text-gray-400 hover:text-white">View map</Link>
                        <form onSubmit={handleLogout}>
                            <button type="submit" className="text-gray-400 hover:text-red-400">Logout</button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <h1 className="text-2xl font-semibold mb-6 tracking-tight">{title}</h1>
                {children}
            </main>
        </div>
    );
}
