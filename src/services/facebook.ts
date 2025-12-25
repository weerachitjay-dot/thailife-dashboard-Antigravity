
import { ParsedCampaign, parseCampaignName } from './campaignParser';

const FB_API_VERSION = 'v18.0';

export interface FBInsight {
    campaign_id: string;
    date_start: string;
    spend: number;
    impressions: number;
    clicks: number;
    actions: Array<{ action_type: string; value: number }>;
}

export interface FBCampaign {
    id: string;
    name: string;
    status: string;
    start_time: string;
}

export class FacebookService {
    private accessToken: string;

    constructor(accessToken: string) {
        this.accessToken = accessToken;
    }

    private async fetch(endpoint: string, params: Record<string, string> = {}) {
        const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${endpoint}`);
        url.searchParams.append('access_token', this.accessToken);
        Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

        const res = await fetch(url.toString());
        if (!res.ok) {
            const error = await res.json();
            throw new Error(`FB API Error: ${error.error?.message || res.statusText}`);
        }
        return res.json();
    }

    async getCampaigns(accountId: string): Promise<FBCampaign[]> {
        const data = await this.fetch(`${accountId}/campaigns`, {
            fields: 'id,name,status,start_time',
            limit: '500',
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }])
        });
        return data.data || [];
    }

    async getInsights(accountId: string, since: string, until: string): Promise<FBInsight[]> {
        const data = await this.fetch(`${accountId}/insights`, {
            level: 'campaign',
            time_increment: '1',
            time_range: JSON.stringify({ since, until }),
            fields: 'campaign_id,date_start,spend,impressions,clicks,actions',
            limit: '500'
        });
        return data.data || [];
    }

    // --- Static Auth Helpers ---

    static async exchangeCodeForToken(code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<string> {
        const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`);
        url.searchParams.append('client_id', clientId);
        url.searchParams.append('redirect_uri', redirectUri);
        url.searchParams.append('client_secret', clientSecret);
        url.searchParams.append('code', code);

        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.error) throw new Error(`Token Exchange Error: ${data.error.message}`);
        return data.access_token;
    }

    static async getLongLivedToken(shortToken: string, clientId: string, clientSecret: string): Promise<{ access_token: string, expires_in: number }> {
        const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`);
        url.searchParams.append('grant_type', 'fb_exchange_token');
        url.searchParams.append('client_id', clientId);
        url.searchParams.append('client_secret', clientSecret);
        url.searchParams.append('fb_exchange_token', shortToken);

        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.error) throw new Error(`Long-Lived Exchange Error: ${data.error.message}`);
        return { access_token: data.access_token, expires_in: data.expires_in }; // FB returns seconds
    }

    static async debugToken(inputToken: string, accessToken: string): Promise<any> {
        const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/debug_token`);
        url.searchParams.append('input_token', inputToken);
        url.searchParams.append('access_token', accessToken);

        const res = await fetch(url.toString());
        const data = await res.json();
        return data.data;
    }

    static async getAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string }>> {
        const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/me/adaccounts`);
        url.searchParams.append('access_token', accessToken);
        url.searchParams.append('fields', 'id,name');
        url.searchParams.append('limit', '500');

        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.error) throw new Error(`Get Ad Accounts Error: ${data.error.message}`);
        return data.data || [];
    }

    static async getHourlyAdInsights(accessToken: string, accountId: string, datePreset: string = 'last_30d'): Promise<any[]> {
        // Fetch raw data with hourly breakdown
        const fields = [
            'campaign_id', 'campaign_name',
            'adset_id', 'adset_name',
            'ad_id', 'ad_name',
            'reach', 'impressions', 'clicks', 'spend',
            'actions',
            'action_values'
        ].join(',');

        const breakdowns = 'hourly_stats_aggregated_by_advertiser_time_zone';
        // Use provided preset or default
        // If preset is 'maximum', FB uses distinct param or logic. 
        // For 'maximum', we should use 'maximum' as value for date_preset if API supports it, or use time_range.
        // Insights API date_preset supports: today, yesterday, this_month, last_month, last_30d, last_90d, last_year, maximum.

        // Sanitize Account ID (Handle 'act_' prefix)
        const cleanAccId = accountId.replace(/^act_/, '');
        const targetId = `act_${cleanAccId}`;

        const url = `https://graph.facebook.com/${FB_API_VERSION}/${targetId}/insights?level=ad&fields=${fields}&breakdowns=${breakdowns}&date_preset=${datePreset}&access_token=${accessToken}&limit=500`;

        let allData: any[] = [];
        let nextUrl = url;

        // Pagination Loop
        while (nextUrl) {
            const res = await fetch(nextUrl);
            const json = await res.json();

            if (json.error) {
                console.error("Facebook Insights Error:", json.error);
                throw new Error(json.error.message);
            }

            if (json.data) {
                allData = [...allData, ...json.data];
            }

            nextUrl = json.paging?.next || null;
        }

        return allData;
    }
}

/**
 * Transforms FB Insight into Database Schema format
 */
export const transformInsight = (insight: FBInsight, campaignName: string) => {
    const actions = insight.actions || [];
    const leads = actions.find(a => a.action_type === 'lead' || a.action_type === 'contact')?.value || 0;

    // Custom Logic for 'Confirmed Leads' or specific conversions can be added here

    return {
        fb_campaign_id: insight.campaign_id,
        date: insight.date_start,
        spend: Number(insight.spend),
        impressions: Number(insight.impressions),
        clicks: Number(insight.clicks),
        leads: Number(leads),
        cpl: leads > 0 ? Number(insight.spend) / Number(leads) : 0
    };
};
