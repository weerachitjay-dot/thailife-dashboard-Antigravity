
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { FacebookService, transformInsight } from '@/services/facebook';
import { parseCampaignName } from '@/services/campaignParser';
import { decryptToken, encryptToken } from '@/utils/crypto';

// Force dynamic to allow cron/manual execution
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 1. Fetch Active, Valid Tokens
        const { data: tokens, error: tokenError } = await supabaseAdmin
            .from('facebook_tokens')
            .select('*')
            .eq('is_valid', true);

        if (tokenError) throw new Error(`DB Error: ${tokenError.message}`);
        if (!tokens || tokens.length === 0) {
            return NextResponse.json({ message: 'No active tokens found' }, { status: 200 });
        }

        const runResults = [];
        const clientId = process.env.FACEBOOK_CLIENT_ID;
        const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

        // 2. Iterate Tokens
        for (const token of tokens) {
            let accessToken: string;

            try {
                // Decrypt
                const { decryptToken } = await import('@/utils/crypto'); // Dynamic import to avoid crypto error on edge if any (though this is standard node runtime env)
                // Actually standard import is fine at top level but let's keep it safe or move to top.
                // Moving to top level import is better practice.
                // Assuming top level import exists. 
                accessToken = decryptToken(token.encrypted_access_token);
            } catch (e) {
                console.error(`Token Decryption Failed for ID ${token.id}`, e);
                // Mark invalid?
                await supabaseAdmin.from('facebook_tokens').update({ is_valid: false }).eq('id', token.id);
                continue;
            }

            // 3. Auto-Refresh Logic
            if (clientId && clientSecret && token.expires_at) {
                const now = new Date();
                const expiry = new Date(token.expires_at);
                const diffTime = expiry.getTime() - now.getTime();
                const daysRemaining = diffTime / (1000 * 3600 * 24);

                if (daysRemaining < 7) {
                    console.log(`Token ${token.id} expiring soon (${daysRemaining.toFixed(1)} days). Refreshing...`);
                    try {
                        const { access_token: newToken, expires_in } = await FacebookService.getLongLivedToken(accessToken, clientId, clientSecret);

                        // Update DB
                        const newExpiry = new Date();
                        newExpiry.setSeconds(newExpiry.getSeconds() + expires_in);
                        const { encryptToken } = await import('@/utils/crypto');
                        const newEncrypted = encryptToken(newToken);

                        await supabaseAdmin.from('facebook_tokens').update({
                            encrypted_access_token: newEncrypted,
                            expires_at: newExpiry.toISOString(),
                            last_refreshed_at: new Date().toISOString()
                        }).eq('id', token.id);

                        accessToken = newToken; // Use new token for sync
                        console.log(`Token ${token.id} refreshed successfully.`);
                    } catch (refreshErr) {
                        console.error(`Token Refresh Failed for ${token.id}`, refreshErr);
                        // Per requirements: If refresh fails, mark expired? 
                        // Or if it's just a network blip? 
                        // If it fails, likely token is already bad or config error.
                        // Let's mark specific error status or leave valid until actual hard failure? 
                        // Requirement: "If refresh fails: Mark token as expired".
                        await supabaseAdmin.from('facebook_tokens').update({ is_valid: false }).eq('id', token.id);
                        runResults.push({ userId: token.user_id, status: 'error', error: 'Token Refresh Failed' });
                        continue; // Skip sync for this token
                    }
                }
            }

            // 4. Fetch Linked & SELECTED Accounts
            const { data: accounts } = await supabaseAdmin
                .from('accounts')
                .select('*')
                .eq('token_id', token.id)
                .eq('is_active', true)
                .eq('is_selected', true); // CRITICAL: Only sync selected account

            if (!accounts || accounts.length === 0) {
                console.log(`No selected accounts for token ${token.id}`);
                continue;
            }

            // 5. Sync Selected Account (Hourly Data)
            for (const account of accounts) {
                try {
                    console.log(`Syncing Account: ${account.name} (${account.account_id})`);

                    // ---------------------------------------------------------
                    // 🧠 LANGGRAPH 10-AGENT PIPELINE
                    // ---------------------------------------------------------

                    // We now delegate the entire Sync & Intelligence flow to the Orchestrator.
                    // The Orchestrator will run A4 (Ingest) and A6 (Upsert) internally.
                    // We just provide the configuration.

                    const { AgentOrchestrator } = await import('@/agents/orchestrator');

                    const orchestrator = new AgentOrchestrator({
                        config: {
                            userId: token.user_id,
                            accessToken: accessToken, // Decrypted
                            ad_account_id: account.account_id,
                            date_range: { start: 'last_30d', end: 'today', cycle_type: 'campaign' }
                        }
                    });

                    const finalState = await orchestrator.run();

                    // Check results from the State
                    if (finalState.write_status?.success) {
                        runResults.push({ userId: token.user_id, account: account.account_id, status: 'success', insights: finalState.write_status.inserted_count });
                    } else {
                        // If Orchestrator failed or A6 failed
                        const err = finalState.errors.join(', ') || finalState.write_status?.error || 'Unknown Pipeline Error';
                        runResults.push({ userId: token.user_id, account: account.account_id, status: 'error', error: err });
                    }

                    if (finalState.executive_summary) {
                        console.log("\n--- EXECUTIVE REPORT ---");
                        console.log(finalState.executive_summary);
                        console.log("------------------------\n");
                    }

                    // End of Loop for this Account

                } catch (accountErr: any) {
                    console.error(`Sync Error for Account ${account.account_id}`, accountErr);
                    runResults.push({ userId: token.user_id, account: account.account_id, status: 'error', error: accountErr.message });

                    if (accountErr.message.includes('Error validating access token') || accountErr.message.includes('Session has expired')) {
                        await supabaseAdmin.from('facebook_tokens').update({ is_valid: false }).eq('id', token.id);
                        break;
                    }
                }
            }
        }

        return NextResponse.json({ success: true, results: runResults });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
