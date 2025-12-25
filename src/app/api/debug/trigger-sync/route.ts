
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { decryptToken } from '@/utils/crypto';
import { AgentOrchestrator } from '@/agents/orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max out Vercel function duration

export async function GET(request: Request) {
    const log: any[] = [];
    const report = (msg: string, data?: any) => log.push({ msg, data });

    try {
        report("🚀 Starting Debug Sync...");
        const userId = 'user-123';

        // 1. Get Token
        const { data: token } = await supabaseAdmin
            .from('facebook_tokens')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!token) {
            report("❌ No Token Found");
            return NextResponse.json({ log });
        }

        // 2. Get Selected Account
        const { data: accounts } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('token_id', token.id)
            .eq('is_selected', true);

        if (!accounts || accounts.length === 0) {
            report("❌ No Selected Account Found");
            return NextResponse.json({ log });
        }
        const account = accounts[0];
        report("✅ Account Found", account.account_id);

        // 3. Decrypt
        const accessToken = decryptToken(token.encrypted_access_token);
        report("✅ Token Decrypted");

        // 4. Run Orchestrator
        const orchestrator = new AgentOrchestrator({
            config: {
                userId: userId,
                accessToken: accessToken,
                ad_account_id: account.account_id,
                // Using 'lifetime' as FB presets like 'maximum' can be finicky in specific API versions
                date_range: { start: 'lifetime', end: 'today', cycle_type: 'campaign' }
            }
        });

        report("🔄 Orchestrator Started (Preset: lifetime)");

        // AWAIT FULLY - No Race Condition
        const result = await orchestrator.run();

        report("✅ Orchestrator Finished", result);

        return NextResponse.json({ success: true, log, result });

    } catch (error: any) {
        report("❌ CRITICAL ERROR", { message: error.message, stack: error.stack });
        return NextResponse.json({ success: false, log, error: error.message }, { status: 500 });
    }
}
