import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });

// Exclude the registration page at build time when registration is disabled
// This prevents trying to import a non-generated Wayfinder route (`@/routes/register`)
// when Fortify has removed the registration feature.
if (import.meta.env.VITE_REGISTRATION_ENABLED === 'false' || import.meta.env.VITE_REGISTRATION_ENABLED === false) {
    Object.keys(pages).forEach((key) => {
        if (key.includes('/auth/register')) {
            delete pages[key];
        }
    });
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        // When registration is disabled at build time, the register page is excluded
        // from the pages glob (to avoid pulling in a non-generated Wayfinder route).
        // If the page name is still requested at runtime, fall back to login.
        if (
            name === 'auth/register' &&
            (import.meta.env.VITE_REGISTRATION_ENABLED === 'false' || import.meta.env.VITE_REGISTRATION_ENABLED === false)
        ) {
            return pages['./pages/auth/login.tsx'];
        }
        return pages[`./pages/${name}.tsx`];
    },
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
            case name === 'map':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            case name.startsWith('admin/'):
                // Admin pages render their own simple layout for full control
                return null;
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
