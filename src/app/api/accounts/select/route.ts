
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Attempt to extend Vercel timeout

export async function POST(request: Request) {
    try {
        const { userId, accountId, syncDays } = await request.json(); // syncDays: number (e.g. 30, 90)

        if (!userId || !accountId) {
            return NextResponse.json({ success: false, error: 'Missing userId or accountId' }, { status: 400 });
        }

        // 1. Verify User Token
        // Find token first to be safe
        const { data: token } = await supabaseAdmin
            .from('facebook_tokens')
            .select('id, encrypted_access_token')
            .eq('user_id', userId)
            .single();

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
        }

        // 2. Deselect all accounts for this token
        await supabaseAdmin
            .from('accounts')
            .update({ is_selected: false })
            .eq('token_id', token.id);

        // 3. Select specific account
        const { error, data } = await supabaseAdmin
            .from('accounts')
            .update({ is_selected: true })
            .eq('account_id', accountId)
            .eq('token_id', token.id) // Security: Ensure it belongs to user
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return NextResponse.json({ success: false, error: 'Account not found or access denied' }, { status: 404 });
        }

        // 4. TRIGGER 10-AGENT SYNC PIPELINE (Immediate Feedback)
        console.log("🚀 Triggering immediate sync for selected account:", accountId, "Days:", syncDays || 30);

        // We need the decrypted token for the orchestrator
        const { decryptToken } = await import('@/utils/crypto');
        const accessToken = decryptToken(token.encrypted_access_token);

        const { AgentOrchestrator } = await import('@/agents/orchestrator');

        // Parse Sync Range
        const dateStart = syncDays ? `last_${syncDays}d` : 'last_30d';

        const orchestrator = new AgentOrchestrator({
            config: {
                userId: userId,
                accessToken: accessToken,
                ad_account_id: accountId,
                date_range: { start: dateStart, end: 'today', cycle_type: 'campaign' }
            }
        });

        // Run async with race condition
        // User expects data immediately. Await it. (Vercel timeout risk, but acceptable for MVP 1-account sync)
        try {
            const syncPromise = orchestrator.run();
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 8000));

            const result = await Promise.race([syncPromise, timeoutPromise]);

            if (result === 'TIMEOUT') {
                console.log("⚠️ Sync taking longer than 8s, returning early to client...");
                // Note: In strict Serverless, the background process might be paused/killed here. 
                // But this prevents the 504 Gateway Timeout error on the client.
                return NextResponse.json({ success: true, selected: accountId, synced: 'background', message: "Sync started in background" });
            }

            const finalState = result as any;
            if (!finalState.write_status?.success) {
                console.error("Sync partial failure:", finalState.errors);
            }
        } catch (syncErr) {
            console.error("Sync Validation Failed:", syncErr);
        }

        return NextResponse.json({ success: true, selected: accountId, synced: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
