'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function FacebookConnectStatus({ userId }: { userId: string }) {
    const [status, setStatus] = useState<'loading' | 'healthy' | 'warning' | 'expired' | 'not_connected'>('loading');
    const [expiresIn, setExpiresIn] = useState<number | null>(null);

    useEffect(() => {
        if (!userId) return; // Wait for auth
        fetch(`/api/auth/facebook/status?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                setStatus(data.status);
                setExpiresIn(data.expires_in_days);
            })
            .catch(() => setStatus('not_connected'));
    }, [userId]);

    const handleReconnect = () => {
        // Trigger FB OAuth flow. 
        // In a real app, this redirects to FB Dialog.
        // For now, we can alert or log, as the full OAuth client-side setup needs client ID.
        // We can assume a window.location.href to a route that redirects to FB.
        // e.g. /api/auth/facebook/login (which we haven't built, or just direct link)
        // Let's assume user has a login handler or we provide the link.
        const clientId = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID; // Need to ensure this is exposed
        const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/facebook/callback` : '';

        if (!clientId) {
            alert('Missing NEXT_PUBLIC_FACEBOOK_CLIENT_ID');
            return;
        }

        const fbUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=ads_read,read_insights`;
        window.location.href = fbUrl;
    };

    if (status === 'loading') return <div className="text-xs text-gray-500">Checking connection...</div>;

    if (status === 'healthy') {
        return (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Connected (Expires: {expiresIn}d)
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-2 ${status === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                <span className={`w-2 h-2 rounded-full ${status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                {status === 'warning' ? `Expiring Soon (${expiresIn}d)` : 'Connection Lost'}
            </div>
            <Button variant="outline" size="sm" onClick={handleReconnect} className="h-7 text-xs">
                Reconnect
            </Button>
        </div>
    );
}
