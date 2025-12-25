'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCcw, CalendarClock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SyncButton({ userId, selectedAccountId }: { userId: string, selectedAccountId?: string }) {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState("30"); // Default 30
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
                body: JSON.stringify({
                    userId,
                    accountId: selectedAccountId,
                    syncDays: parseInt(days)
                })
            });
            const data = await res.json();

            if (data.success && data.synced) {
                // Optional: alert("Sync Complete");
                setOpen(false);
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
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Sync Data
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Sync Settings</h4>
                        <p className="text-sm text-muted-foreground">
                            Fetch fresh data from Facebook.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="days">History</Label>
                            <Select value={days} onValueChange={setDays}>
                                <SelectTrigger className="col-span-2 h-8">
                                    <SelectValue placeholder="Select range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Last 7 Days</SelectItem>
                                    <SelectItem value="30">Last 30 Days (Default)</SelectItem>
                                    <SelectItem value="90">Last 3 Months</SelectItem>
                                    <SelectItem value="180">Last 6 Months</SelectItem>
                                    <SelectItem value="365">Last 1 Year</SelectItem>
                                    <SelectItem value="3650">Lifetime (Max)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button onClick={handleSync} disabled={loading} className="w-full">
                        {loading ? 'Syncing...' : 'Start Sync'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
