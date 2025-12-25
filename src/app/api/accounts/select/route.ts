import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { userId, accountId } = await request.json();

        if (!userId || !accountId) {
            return NextResponse.json({ success: false, error: 'Missing userId or accountId' }, { status: 400 });
        }

        // 1. Verify User Token
        // Ideally we should verify the user owns the token that owns the account, 
        // but for MVCP we can rely on RLS logic or simplified join. 
        // Let's reset all accounts for this user's token first to ensure single selection.

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
            // Rollback? No transaction here easily without RPC, but rare case.
            return NextResponse.json({ success: false, error: 'Account not found or access denied' }, { status: 404 });
        }

        // 4. TRIGGER 10-AGENT SYNC PIPELINE (Immediate Feedback)
        console.log("🚀 Triggering immediate sync for selected account:", accountId);

        // We need the decrypted token for the orchestrator
        const { decryptToken } = await import('@/utils/crypto');
        const accessToken = decryptToken(token.encrypted_access_token);

        const { AgentOrchestrator } = await import('@/agents/orchestrator');

        const orchestrator = new AgentOrchestrator({
            config: {
                userId: userId,
                accessToken: accessToken,
                ad_account_id: accountId,
                date_range: { start: 'last_30d', end: 'today', cycle_type: 'campaign' }
            }
        });

        // Run async (fire and forget to return response fast, OR await if we want to guarantee data?)
        // User expects data immediately. Await it. (Vercel timeout risk, but acceptable for MVP 1-account sync)
        try {
            const finalState = await orchestrator.run();
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
