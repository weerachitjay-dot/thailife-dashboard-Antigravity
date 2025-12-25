export interface FacebookInsightRow {
    ad_id: string;
    ad_name: string;
    campaign_id: string;
    campaign_name: string;
    adset_id?: string;
    adset_name?: string;
    spend: number;
    leads: number;
    impressions: number;
    clicks: number;
    reach: number;
    cpl: number;
    cpm: number;
    frequency: number;
    date_start: string;
    hour: number;
}

export interface SimulationScenario {
    id: string;
    name: string;
    description: string;
    assumptions: string;
    risk_level: 'low' | 'medium' | 'high';
    projected: {
        spend: number;
        leads: number;
        cpl: number;
        revenue: number; // Assuming 3000 THB LTV
        profit: number;
    };
}

export type SimulationOutput = {
    baseline: SimulationScenario;
    scenarios: SimulationScenario[];
}

export type OptimizationRecommendation = {
    action: 'PAUSE' | 'SCALE' | 'HOLD';
    entity_id: string; // Ad Set or Ad ID
    entity_type: 'ad' | 'adset';
    reason: string;
    priority: 'high' | 'medium' | 'low';
}

export type TestReport = {
    valid: boolean;
    checks: { name: string; passed: boolean; details?: string }[];
}

export type WriteStatus = {
    success: boolean;
    inserted_count: number;
    error?: string;
}

export interface GlobalState {
    config: {
        userId?: string;
        accessToken?: string; // Encrypted or Decrypted? Orchestrator holds decrypted for runtime
        ad_account_id?: string;
        date_range: {
            start: string; // YYYY-MM-DD
            end: string;
            cycle_type: "campaign" | "partner" | "calendar" | "custom";
        };
        supabase_config?: {
            url: string;
            key: string;
        }
    };

    // A1 - A3
    auth_status?: { valid: boolean; error?: string };
    schema_status?: { valid: boolean; missing_tables?: string[] };
    account_metadata?: { name: string; timezone: string };

    // A4
    raw_insights: any[]; // Raw FB API response

    // A5
    normalized_metrics: FacebookInsightRow[]; // Computed CPL/CPM

    // A6
    write_status?: WriteStatus;

    // A7
    test_report?: TestReport;

    // A8
    simulation?: SimulationOutput;

    // A9
    optimization_plan?: OptimizationRecommendation[];

    // A10
    executive_summary?: string;

    // Shared
    errors: string[];
}

// Initial State Factory
export const createInitialState = (initial?: Partial<GlobalState>): GlobalState => ({
    config: {
        date_range: { start: '', end: '', cycle_type: 'campaign' },
        ...initial?.config
    },
    raw_insights: [],
    normalized_metrics: [],
    errors: [],
    ...initial
});
