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
        window.location.href = '/api/auth/facebook/login';
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
