
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

                    const rawInsights = await FacebookService.getHourlyAdInsights(accessToken, account.account_id);
                    console.log(`Fetched ${rawInsights.length} hourly records`);

                    // Transform & Upsert
                    const records = rawInsights.map((row: any) => {
                        // Parse Actions
                        const actions = row.actions || [];
                        const leads = actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.lead')?.value || 0;
                        const onFbLeads = actions.find((a: any) => a.action_type === 'leadgen')?.value || 0;
                        // const msgConvos = actions.find((a: any) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0;

                        const totalLeads = Number(leads) + Number(onFbLeads);
                        const spend = Number(row.spend || 0);
                        const impressions = Number(row.impressions || 0);
                        const reach = Number(row.reach || 0);

                        // Calculations
                        const cpl = totalLeads > 0 ? spend / totalLeads : 0;
                        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                        const frequency = reach > 0 ? impressions / reach : 0;

                        // Parse Hour from Timezone String (e.g. "00:00:00 - 00:59:59")
                        const timeRange = row.hourly_stats_aggregated_by_advertiser_time_zone || "00:00:00 - 00:59:59";
                        const hourStr = timeRange.split(':')[0] || "00";
                        const hour = parseInt(hourStr, 10);

                        return {
                            ad_account_id: account.account_id,
                            ad_account_name: account.name,
                            campaign_id: row.campaign_id,
                            campaign_name: row.campaign_name,
                            adset_id: row.adset_id,
                            adset_name: row.adset_name,
                            ad_id: row.ad_id,
                            ad_name: row.ad_name,
                            date_start: row.date_start,
                            hour: isNaN(hour) ? 0 : hour,
                            reach,
                            impressions,
                            clicks: Number(row.clicks || 0),
                            spend,
                            leads: totalLeads,
                            cpl,
                            cpm,
                            frequency
                        };
                    });

                    // Bulk Upsert (Chunking)
                    const chunkSize = 100;
                    for (let i = 0; i < records.length; i += chunkSize) {
                        const chunk = records.slice(i, i + chunkSize);
                        const { error } = await supabaseAdmin
                            .from('facebook_ads_insights')
                            .upsert(chunk, { onConflict: 'ad_id,date_start,hour' });

                        if (error) {
                            console.error('Upsert Error:', error);
                            // Don't throw, log and continue
                        }
                    }

                    // Update Account Sync Time
                    await supabaseAdmin.from('accounts').update({ last_synced_at: new Date().toISOString() }).eq('account_id', account.account_id);

                    runResults.push({ userId: token.user_id, account: account.account_id, status: 'success', insights: rawInsights.length });

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
