import { GlobalState, FacebookInsightRow } from '../types';
import { FacebookService } from '@/services/facebook';
import { supabaseAdmin } from '@/utils/supabase/admin';

// A4: FacebookInsightsAgent (Ingestion)
export const FacebookInsightsAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🔄 Agent A4 (Ingest): Fetching Hourly Data...");
    const { accessToken, ad_account_id } = state.config;
    if (!accessToken || !ad_account_id) throw new Error("A4: Missing Creds");

    try {
        // Calls the service we already implemented
        // Extract preset from config range (e.g. 'last_30d', 'maximum')
        const preset = state.config.date_range?.start || 'last_30d';
        console.log(`   -> Fetching for preset: ${preset}`);
        const raw = await FacebookService.getHourlyAdInsights(accessToken, ad_account_id, preset);
        console.log(`   -> Fetched ${raw.length} raw records.`);
        return { raw_insights: raw };
    } catch (e: any) {
        console.error("A4 Failed:", e);
        throw new Error(`A4 Facebook API Failure: ${e.message}`);
    }
};

// A5: MetricsComputeAgent (Transformation)
export const MetricsComputeAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🧮 Agent A5 (Metrics): Computing CPL/CPM...");
    const raw = state.raw_insights;
    if (!raw) return { normalized_metrics: [] };

    const normalized = raw.map((row: any) => {
        const actions = row.actions || [];
        const leads = actions.find((a: any) => a.action_type === 'lead' || a.action_type === 'offsite_conversion.lead')?.value || 0;
        const onFbLeads = actions.find((a: any) => a.action_type === 'leadgen')?.value || 0;

        const totalLeads = Number(leads) + Number(onFbLeads);
        const spend = Number(row.spend || 0);
        const impressions = Number(row.impressions || 0);
        const reach = Number(row.reach || 0);
        const clicks = Number(row.clicks || 0);

        // Computed
        const cpl = totalLeads > 0 ? spend / totalLeads : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const frequency = reach > 0 ? impressions / reach : 0;

        const timeRange = row.hourly_stats_aggregated_by_advertiser_time_zone || "00:00:00 - 00:59:59";
        const hourStr = timeRange.split(':')[0] || "00";
        const hour = parseInt(hourStr, 10);

        return {
            ad_account_id: state.config.ad_account_id,
            // ad_account_name: ... (from A3 via state)
            campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            adset_id: row.adset_id,
            adset_name: row.adset_name,
            ad_id: row.ad_id,
            ad_name: row.ad_name,
            date_start: row.date_start,
            hour: isNaN(hour) ? 0 : hour,
            spend,
            impressions,
            reach,
            clicks,
            leads: totalLeads,
            cpl,
            cpm,
            frequency
        } as FacebookInsightRow;
    });

    return { normalized_metrics: normalized };
};

// A6: SupabaseIngestAgent (Writer)
import { parseCampaignName } from '@/services/campaignParser';

export const SupabaseIngestAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("💾 Agent A6 (Writer): Upserting to Supabase...");
    const rows = state.normalized_metrics;
    if (!rows || rows.length === 0) return { write_status: { success: true, inserted_count: 0 } };

    // 1. Process Campaigns (Legacy Support & Metadata)
    const uniqueCampaigns = new Map();
    rows.forEach(r => {
        if (!uniqueCampaigns.has(r.campaign_id)) {
            const parsed = parseCampaignName(r.campaign_name);
            uniqueCampaigns.set(r.campaign_id, {
                fb_campaign_id: r.campaign_id,
                account_id: state.config.ad_account_id,
                name: r.campaign_name,
                product_code: parsed.productCode === 'Unknown' ? null : parsed.productCode,
                objective: parsed.objective,
                audience: parsed.audience,
                status: 'ACTIVE', // Assumed active as we fetched it
                updated_at: new Date().toISOString()
            });
        }
    });

    const campaignsToUpsert = Array.from(uniqueCampaigns.values());
    console.log(`   -> Syncing ${campaignsToUpsert.length} Campaigns...`);

    // Upsert Campaigns & Get UUIDs
    const { data: upsertedCampaigns, error: campError } = await supabaseAdmin
        .from('campaigns')
        .upsert(campaignsToUpsert, { onConflict: 'fb_campaign_id' })
        .select('id, fb_campaign_id');

    if (campError) {
        console.error("A6 Campaign Write Error:", campError);
        return { write_status: { success: false, inserted_count: 0, error: "Campaign Upsert Failed: " + campError.message } };
    }

    // Map FB_ID -> UUID
    const campaignIdMap = new Map(upsertedCampaigns?.map(c => [c.fb_campaign_id, c.id]));

    // 2. Process Daily Metrics (Legacy Support)
    // Aggregate Hourly -> Daily
    const dailyMap = new Map(); // Key: campaignId_date
    rows.forEach(r => {
        const uuid = campaignIdMap.get(r.campaign_id);
        if (!uuid) return;

        const key = `${uuid}_${r.date_start}`;
        if (!dailyMap.has(key)) {
            dailyMap.set(key, {
                campaign_id: uuid,
                date: r.date_start,
                spend: 0,
                impressions: 0,
                clicks: 0,
                leads: 0
            });
        }
        const stat = dailyMap.get(key);
        stat.spend += r.spend;
        stat.impressions += r.impressions;
        stat.clicks += r.clicks;
        stat.leads += r.leads;
    });

    const dailyMetricsToUpsert = Array.from(dailyMap.values()).map(d => ({
        ...d,
        cpl: d.leads > 0 ? d.spend / d.leads : 0,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        cpc: d.clicks > 0 ? d.spend / d.clicks : 0
    }));

    console.log(`   -> Syncing ${dailyMetricsToUpsert.length} Daily Metric Rows...`);
    const { error: dailyError } = await supabaseAdmin
        .from('daily_metrics')
        .upsert(dailyMetricsToUpsert, { onConflict: 'campaign_id,date' });

    if (dailyError) {
        console.error("A6 Daily Metrics Write Error:", dailyError);
        // We might choose to proceed, or fail. Let's fail safe 
        // return { write_status: { success: false, error: dailyError.message } };
    }

    // 3. Process Granular Hourly Data (New Table)
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabaseAdmin
            .from('facebook_ads_insights')
            .upsert(chunk, { onConflict: 'ad_id,date_start,hour' });

        if (error) {
            console.error("A6 Hourly Write Error:", error);
            return { write_status: { success: false, inserted_count: inserted, error: error.message } };
        }
        inserted += chunk.length;
    }

    // Update Account Last Synced
    if (state.config.ad_account_id) {
        await supabaseAdmin.from('accounts')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('account_id', state.config.ad_account_id);
    }

    return { write_status: { success: true, inserted_count: inserted } };
};
