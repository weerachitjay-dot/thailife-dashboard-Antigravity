
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

            // 4. Fetch Linked Accounts
            const { data: accounts } = await supabaseAdmin
                .from('accounts')
                .select('*')
                .eq('token_id', token.id)
                .eq('is_active', true);

            if (!accounts || accounts.length === 0) {
                console.log(`No active accounts for token ${token.id}`);
                continue;
            }

            // 5. Sync Loop (Existing Logic Adapted)
            const fbService = new FacebookService(accessToken);

            for (const account of accounts) {
                try {
                    // A. Fetch Campaigns
                    const fbCampaigns = await fbService.getCampaigns(account.account_id);

                    for (const camp of fbCampaigns) {
                        const parsed = parseCampaignName(camp.name);
                        await supabaseAdmin.from('campaigns').upsert({
                            fb_campaign_id: camp.id,
                            account_id: account.account_id,
                            name: camp.name,
                            status: camp.status,
                            start_date: camp.start_time ? camp.start_time.split('T')[0] : null,
                            product_code: parsed.productCode !== 'Unknown' ? parsed.productCode : null,
                            objective: parsed.objective,
                            audience: parsed.audience,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'fb_campaign_id' });
                    }

                    // B. Fetch Insights
                    const today = new Date();
                    const threeDaysAgo = new Date();
                    threeDaysAgo.setDate(today.getDate() - 3);
                    const since = threeDaysAgo.toISOString().split('T')[0];
                    const until = today.toISOString().split('T')[0];

                    const insights = await fbService.getInsights(account.account_id, since, until);

                    // Fetch IDs map
                    const { data: dbCamps } = await supabaseAdmin.from('campaigns').select('id, fb_campaign_id').eq('account_id', account.account_id);
                    const campMap = new Map(dbCamps?.map(c => [c.fb_campaign_id, c.id]));

                    const metricsPayload = [];
                    for (const insight of insights) {
                        const internalId = campMap.get(insight.campaign_id);
                        if (!internalId) continue;

                        const transformed = transformInsight(insight, '');
                        metricsPayload.push({
                            campaign_id: internalId,
                            date: transformed.date,
                            spend: transformed.spend,
                            impressions: transformed.impressions,
                            clicks: transformed.clicks,
                            leads: transformed.leads,
                            cpl: transformed.cpl
                        });
                    }

                    if (metricsPayload.length > 0) {
                        await supabaseAdmin.from('daily_metrics').upsert(metricsPayload, { onConflict: 'campaign_id,date' });
                    }

                    runResults.push({ userId: token.user_id, account: account.account_id, status: 'success', insights: insights.length });

                } catch (accountErr: any) {
                    console.error(`Sync Error for Account ${account.account_id}`, accountErr);
                    runResults.push({ userId: token.user_id, account: account.account_id, status: 'error', error: accountErr.message });

                    // If Auth Error, invalidate Token?
                    // FacebookService throws "FB API Error". Check message?
                    if (accountErr.message.includes('Error validating access token') || accountErr.message.includes('Session has expired')) {
                        await supabaseAdmin.from('facebook_tokens').update({ is_valid: false }).eq('id', token.id);
                        break; // Stop processing this token
                    }
                }
            }
        }

        return NextResponse.json({ success: true, results: runResults });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
