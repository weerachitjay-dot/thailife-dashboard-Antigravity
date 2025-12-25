'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Account {
    account_id: string;
    name: string;
    is_selected: boolean;
}

export default function AdAccountSelector({ userId, onSelect }: { userId: string, onSelect?: () => void }) {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!userId) return;
        fetch(`/api/accounts/list?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data.accounts) ? data.accounts : [];
                setAccounts(list);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch accounts", err);
                setAccounts([]);
                setLoading(false);
            });
    }, [userId]);

    const handleSelect = async (accountId: string) => {
        setSelecting(accountId);
        try {
            const res = await fetch('/api/accounts/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, accountId })
            });
            const data = await res.json();

            if (data.success) {
                // Optimistic update
                setAccounts(prev => prev.map(a => ({
                    ...a,
                    is_selected: a.account_id === accountId
                })));

                if (onSelect) onSelect();
                router.refresh();
            }
        } catch (error) {
            console.error("Selection failed", error);
        } finally {
            setSelecting(null);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/accounts/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.accounts)) {
                setAccounts(data.accounts);
                router.refresh();
            } else {
                console.error("Refresh failed:", data.error);
                alert("Could not fetch accounts: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            console.error("Refresh error", e);
            alert("Refresh failed. Please check console.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-sm text-gray-500 animate-pulse">Loading accounts...</div>;

    if (accounts.length === 0) {
        return (
            <Card className="max-w-md mx-auto mt-10 text-center">
                <CardHeader>
                    <CardTitle>No Ad Accounts Found</CardTitle>
                    <CardDescription>
                        We verified your connection, but no Ad Accounts were returned.
                        If you recently added permissions, try refreshing.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleRefresh} variant="outline" className="gap-2">
                        <span className={loading ? "animate-spin" : ""}>↻</span> Refresh Ad Accounts
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const currentSelected = accounts.find(a => a.is_selected);

    return (
        <Card className="max-w-2xl mx-auto mt-10 shadow-lg border-blue-100">
            <CardHeader className="bg-slate-50 border-b pb-6">
                <CardTitle className="text-xl text-slate-800">Select Ad Account</CardTitle>
                <CardDescription>
                    Choose the active ad account to sync with this dashboard.
                    Changing this will update the data displayed.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {accounts.map(account => (
                        <div
                            key={account.account_id}
                            className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${account.is_selected ? 'bg-blue-50/50' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${account.is_selected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {account.is_selected ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-current opacity-50" />}
                                </div>
                                <div>
                                    <h4 className={`font-medium ${account.is_selected ? 'text-blue-900' : 'text-slate-700'}`}>{account.name}</h4>
                                    <p className="text-xs text-gray-500">ID: {account.account_id}</p>
                                </div>
                            </div>

                            {account.is_selected ? (
                                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                    Active
                                </span>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSelect(account.account_id)}
                                    disabled={!!selecting}
                                    className="gap-2"
                                >
                                    Select
                                    {selecting === account.account_id && <span className="animate-spin">...</span>}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
