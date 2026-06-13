import { Head, useForm } from '@inertiajs/react';
import type { FormEvent} from 'react';
import { useState } from 'react';

interface Setting {
    id?: number;
    provider: string;
    api_base_url: string;
    model_slug: string;
}

interface Props {
    setting: Setting;
}

export default function LlmSettings({ setting }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        provider: setting.provider || 'openrouter',
        api_base_url: setting.api_base_url || 'https://openrouter.ai/api/v1',
        api_key: '',
        model_slug: setting.model_slug || 'openai/gpt-4o-mini',
    });

    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put('/admin/llm-settings');
    };

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch('/admin/llm-settings/test', { method: 'POST' });
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
            <Head title="LLM Settings" />
            <div className="max-w-xl">
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Provider</label>
                        <select
                            value={data.provider}
                            onChange={(e) => setData('provider', e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        >
                            <option value="openrouter">openrouter</option>
                            <option value="lmstudio">lmstudio</option>
                            <option value="deepseek">deepseek</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">API Base URL</label>
                        <input
                            value={data.api_base_url}
                            onChange={(e) => setData('api_base_url', e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        />
                        {errors.api_base_url && <p className="text-xs text-red-400 mt-1">{errors.api_base_url}</p>}
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">API Key (leave blank to keep existing)</label>
                        <input
                            type="password"
                            value={data.api_key}
                            onChange={(e) => setData('api_key', e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Model Slug</label>
                        <input
                            value={data.model_slug}
                            onChange={(e) => setData('model_slug', e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                        />
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

                <p className="text-xs text-gray-500 mt-6">For LM Studio use http://host.docker.internal:1234/v1 and no key. DeepSeek: https://api.deepseek.com/v1 + model deepseek-chat.</p>
            </div>
        </>
    );
}

LlmSettings.layout = {
    breadcrumbs: [
        {
            title: 'Admin',
            href: '/admin',
        },
        {
            title: 'LLM Settings',
            href: '/admin/llm-settings',
        },
    ],
};
