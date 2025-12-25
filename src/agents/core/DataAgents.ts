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
        const raw = await FacebookService.getHourlyAdInsights(accessToken, ad_account_id);
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
export const SupabaseIngestAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("💾 Agent A6 (Writer): Upserting to Supabase...");
    const rows = state.normalized_metrics;
    if (!rows || rows.length === 0) return { write_status: { success: true, inserted_count: 0 } };

    const chunkSize = 500;
    let inserted = 0;

    // We can't actually do a massive loop inside one agent step if we want it fast, 
    // but typically we await it.
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);

        // Supabase upsert
        const { error } = await supabaseAdmin
            .from('facebook_ads_insights')
            .upsert(chunk, { onConflict: 'ad_id,date_start,hour' });

        if (error) {
            console.error("A6 Write Error:", error);
            // In strict mode we might stop, or we log partial failure
            return { write_status: { success: false, inserted_count: inserted, error: error.message } };
        }
        inserted += chunk.length;
    }

    // Update Account Last Synced (Side effect)
    if (state.config.ad_account_id) {
        await supabaseAdmin.from('accounts')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('account_id', state.config.ad_account_id);
    }

    return { write_status: { success: true, inserted_count: inserted } };
};
