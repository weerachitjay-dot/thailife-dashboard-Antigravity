
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { FacebookService } from '@/services/facebook';
import { decryptToken } from '@/utils/crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const log: any[] = [];
    const report = (msg: string, data?: any) => log.push({ msg, data });

    try {
        report("start_debug_chain");

        // 1. Check Tokens
        const { data: tokens, error: tokenErr } = await supabaseAdmin.from('facebook_tokens').select('*');
        if (tokenErr) throw tokenErr;
        report(`found_${tokens?.length || 0}_tokens`);

        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ log });
        }

        // 2. Check Accounts
        const { data: accounts } = await supabaseAdmin.from('accounts').select('*');
        report(`found_${accounts?.length || 0}_accounts`, accounts);

        // 3. Try Fetching Data for First Selected Account
        const selected = accounts?.find(a => a.is_selected);
        if (!selected) {
            report("no_selected_account_found_in_db");
            return NextResponse.json({ log });
        }

        report("testing_account", selected.account_id);

        const tokenRow = tokens.find(t => t.id === selected.token_id);
        if (!tokenRow) {
            report("token_row_missing_for_account");
            return NextResponse.json({ log });
        }

        let accessToken = "";
        try {
            accessToken = decryptToken(tokenRow.encrypted_access_token);
            report("token_decrypted_successfully", { length: accessToken.length });
        } catch (e: any) {
            report("token_decryption_failed", e.message);
            return NextResponse.json({ log });
        }

        // 4. Call Facebook Service (Raw)
        try {
            report("calling_getHourlyAdInsights");
            const insights = await FacebookService.getHourlyAdInsights(accessToken, selected.account_id);
            report("api_call_complete", {
                rows_returned: insights.length,
                sample: insights.slice(0, 2)
            });
        } catch (fbErr: any) {
            report("facebook_api_error", {
                message: fbErr.message,
                stack: fbErr.stack
            });
        }

        // 5. Check Database Counts
        const { count: campaignCount } = await supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true });
        const { count: metricCount } = await supabaseAdmin.from('daily_metrics').select('*', { count: 'exact', head: true });

        report("database_state", { campaignCount, metricCount });

        return NextResponse.json({ success: true, log });

    } catch (error: any) {
        report("critical_failure", error.message);
        return NextResponse.json({ success: false, log }, { status: 500 });
    }
}
