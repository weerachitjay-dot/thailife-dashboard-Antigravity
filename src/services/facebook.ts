
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
            limit: '500', // Adjust strictly if scaling
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }])
        });
        return data.data || [];
    }

    async getInsights(accountId: string, since: string, until: string): Promise<FBInsight[]> {
        // Level: campaign
        // Time Increment: 1 (Daily breakdown)
        const data = await this.fetch(`${accountId}/insights`, {
            level: 'campaign',
            time_increment: '1',
            time_range: JSON.stringify({ since, until }),
            fields: 'campaign_id,date_start,spend,impressions,clicks,actions',
            limit: '500' // Pagination logic needed for prod, but sufficient for MVCP
        });
        return data.data || [];
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
