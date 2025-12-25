export interface FacebookInsightRow {
    ad_id: string;
    ad_name: string;
    campaign_id: string;
    campaign_name: string;
    spend: number;
    leads: number;
    impressions: number;
    clicks: number;
    // ... any other raw fields needed
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
    action: 'PAUSE' | 'SCALE' | 'MONITOR';
    entity_id: string;
    entity_type: 'ad' | 'campaign';
    reason: string;
    expected_impact: string;
}

export interface GlobalState {
    config: {
        userId?: string;
        date_range: {
            start: string;
            end: string;
            cycle_type: "campaign" | "partner" | "calendar" | "custom";
        };
        selected_account_id?: string;
    };

    status: {
        schema_valid: boolean;
        token_valid: boolean;
        token_expires_in_days?: number;
        errors: string[];
    };

    data: {
        raw_insights: FacebookInsightRow[];
        aggregated_metrics: {
            total_spend: number;
            total_leads: number;
            avg_cpl: number;
        };
    };

    intelligence: {
        simulation?: SimulationOutput;
        recommendations?: OptimizationRecommendation[];
        executive_summary?: string;
    };
}

// Initial State Factory
export const createInitialState = (): GlobalState => ({
    config: {
        date_range: {
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            cycle_type: "campaign"
        }
    },
    status: {
        schema_valid: true, // Optimistic default
        token_valid: true,
        errors: []
    },
    data: {
        raw_insights: [],
        aggregated_metrics: { total_spend: 0, total_leads: 0, avg_cpl: 0 }
    },
    intelligence: {}
});
