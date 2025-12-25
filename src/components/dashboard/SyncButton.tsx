'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SyncButton({ userId, selectedAccountId }: { userId: string, selectedAccountId?: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSync = async () => {
        if (!selectedAccountId) {
            alert("Please select an ad account first.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/accounts/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, accountId: selectedAccountId })
            });
            const data = await res.json();

            if (data.success && data.synced) {
                // Optional: alert("Sync Complete");
                router.refresh();
            } else {
                alert("Sync Failed: " + (data.error || "Unknown error"));
            }
        } catch (e: any) {
            console.error("Sync Error", e);
            alert("Sync Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!selectedAccountId) return null;

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-2"
        >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync Now'}
        </Button>
    );
}
