import { Head, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';

export default function AdminLogin() {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/admin/login');
    };

    return (
        <>
            <Head title="Admin Login" />
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
                <div className="w-full max-w-sm">
                    <div className="mb-8 text-center">
                        <div className="font-semibold tracking-[3px] text-sm mb-1">MARCHSEEK</div>
                        <h1 className="text-2xl">Admin Login</h1>
                    </div>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <input
                                type="email"
                                placeholder="Email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none"
                                required
                            />
                            {errors.email && <div className="text-red-400 text-xs mt-1">{errors.email}</div>}
                        </div>

                        <div>
                            <input
                                type="password"
                                placeholder="Password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-orange-500 outline-none"
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-gray-400">
                                <input
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                />
                                Remember me
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-60"
                        >
                            {processing ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 mt-6">Default: admin@example.com / password</p>
                    <a href="/" className="block text-center text-xs text-gray-500 mt-2 hover:text-gray-400">← Back to map</a>
                </div>
            </div>
        </>
    );
}
