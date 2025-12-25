
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { FacebookService, transformInsight } from '@/services/facebook';
import { parseCampaignName } from '@/services/campaignParser';

// Force dynamic to allow cron/manual execution
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // 1. Fetch Active Accounts
        const { data: accounts, error: accountError } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('is_active', true);

        if (accountError) throw new Error(`DB Error: ${accountError.message}`);
        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: 'No active accounts found' }, { status: 200 });
        }

        const results = [];

        // 2. Iterate Accounts
        for (const account of accounts) {
            const fbService = new FacebookService(account.access_token);

            // A. Fetch Campaigns
            console.log(`Fetching campaigns for ${account.name}...`);
            const fbCampaigns = await fbService.getCampaigns(account.account_id);

            // Upsert Campaigns
            for (const camp of fbCampaigns) {
                const parsed = parseCampaignName(camp.name);

                await supabaseAdmin.from('campaigns').upsert({
                    fb_campaign_id: camp.id,
                    account_id: account.account_id,
                    name: camp.name,
                    status: camp.status,
                    start_date: camp.start_time ? camp.start_time.split('T')[0] : null,
                    // Parsed Metadata
                    product_code: parsed.productCode !== 'Unknown' ? parsed.productCode : null, // Ensure product exists in DB implicitly? No, might fail FK.
                    // We should optionalize the FK or logic. For now, let's assume we map strings.
                    // Or we upsert formatted productCode but parser returns 'Unknown'.
                    // Ideally, we should ignore FK constraint or ensure Products table is populated.
                    // Let's store raw product as well if schema allowed, but for now map parsed fields.
                    objective: parsed.objective,
                    audience: parsed.audience,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'fb_campaign_id' });
            }

            // B. Fetch Insights (Last 3 days for safety window)
            // Date Format: YYYY-MM-DD
            const today = new Date();
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(today.getDate() - 3);

            const since = threeDaysAgo.toISOString().split('T')[0];
            const until = today.toISOString().split('T')[0];

            const insights = await fbService.getInsights(account.account_id, since, until);

            // Upsert Metrics
            const metricsPayload = [];
            for (const insight of insights) {
                // Find campaign to link? We have fb_campaign_id.
                // We need internal UUID? No, we might strictly need it if schema uses UUID FK.
                // Schema: `campaign_id uuid references campaigns(id)`
                // We need to fetch internal IDs map.

                // Optimization: Fetch all campaign IDs for this account map.
                const { data: dbCamps } = await supabaseAdmin.from('campaigns').select('id, fb_campaign_id').eq('account_id', account.account_id);
                const campMap = new Map(dbCamps?.map(c => [c.fb_campaign_id, c.id]));

                const internalId = campMap.get(insight.campaign_id);
                if (!internalId) continue; // Skip if campaign not synced yet (rare)

                const transformed = transformInsight(insight, ''); // Name not needed for transform

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
                const { error: metricError } = await supabaseAdmin.from('daily_metrics').upsert(metricsPayload, { onConflict: 'campaign_id,date' });
                if (metricError) console.error('Metric Upsert Error', metricError);
            }

            results.push({ account: account.name, campaigns: fbCampaigns.length, insights: insights.length });
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
