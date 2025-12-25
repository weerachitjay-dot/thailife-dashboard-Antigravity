import { GlobalState, SimulationScenario } from '../types';

const LTV_ASSUMPTION = 3000; // THB

export const SimulationAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    // 1. Guardrail: Halt if data invalid or empty (soft halt)
    if (!state.data.raw_insights || state.data.raw_insights.length === 0) {
        console.warn("SimulationAgent: No insights to simulate.");
        return {};
    }

    const { total_spend, total_leads, avg_cpl } = state.data.aggregated_metrics;
    const currentProfit = (total_leads * LTV_ASSUMPTION) - total_spend;

    // Baseline
    const baseline: SimulationScenario = {
        id: 'baseline',
        name: 'Current Trajectory',
        description: 'Maintaining current daily spend and performance.',
        assumptions: 'CPL remains constant.',
        risk_level: 'low',
        projected: {
            spend: total_spend,
            leads: total_leads,
            cpl: avg_cpl,
            revenue: total_leads * LTV_ASSUMPTION,
            profit: currentProfit
        }
    };

    // Scenario 1: Increase 20%
    // Rule: "Never assume linear scaling >30%"
    // Assumption: Spend +20% -> Leads +15% (Diminishing returns start kicking in slightly, but for <30% we can be optimistic-ish)
    // Actually, prompt says: "CPL increases 5-10%"
    // Let's model Spend +20%, CPL +7%
    const spend20 = total_spend * 1.20;
    const cpl20 = avg_cpl > 0 ? avg_cpl * 1.07 : 0;
    const leads20 = cpl20 > 0 ? spend20 / cpl20 : 0;

    const scenario20: SimulationScenario = {
        id: 'increase_20_percent',
        name: 'Scale Aggressively (+20%)',
        description: 'Increase budget by 20% to capture more volume.',
        assumptions: 'Market saturation causes 7% CPL increase.',
        risk_level: 'low',
        projected: {
            spend: spend20,
            leads: Math.round(leads20),
            cpl: cpl20,
            revenue: leads20 * LTV_ASSUMPTION,
            profit: (leads20 * LTV_ASSUMPTION) - spend20
        }
    };

    // Scenario 2: Increase 50%
    // Rule: "Assumption: CPL increases 15-30%" -> Let's use 20%
    const spend50 = total_spend * 1.50;
    const cpl50 = avg_cpl > 0 ? avg_cpl * 1.20 : 0;
    const leads50 = cpl50 > 0 ? spend50 / cpl50 : 0;

    const scenario50: SimulationScenario = {
        id: 'increase_50_percent',
        name: 'Dominate Market (+50%)',
        description: 'Major budget push to maximize market share.',
        assumptions: 'Significant efficiency loss. CPL +20%.',
        risk_level: 'medium',
        projected: {
            spend: spend50,
            leads: Math.round(leads50),
            cpl: cpl50,
            revenue: leads50 * LTV_ASSUMPTION,
            profit: (leads50 * LTV_ASSUMPTION) - spend50
        }
    };

    // Scenario 3: Pause Low Perf
    // Assumption: Pause bottom 20% of spend that has high CPL. CPL Improves.
    // Simple model: Assume we cut 10% of spend that yields 0 leads or 2x CPL.
    // Model: Spend -10%, Leads constant (Efficiency gain) or Leads -2%?
    // Let's assume improvement: Spend -10%, Leads same (cutting waste).
    const spendCut = total_spend * 0.90;
    const leadsCut = total_leads; // Maintaining leads while cutting waste
    const cplCut = leadsCut > 0 ? spendCut / leadsCut : 0;

    const scenarioOptimize: SimulationScenario = {
        id: 'pause_low_perf',
        name: 'Optimize Efficiency',
        description: 'Pause high-CPL ads (bottom 10% efficiency).',
        assumptions: 'Maintains lead volume while reducing waste.',
        risk_level: 'low',
        projected: {
            spend: spendCut,
            leads: leadsCut,
            cpl: cplCut,
            revenue: leadsCut * LTV_ASSUMPTION,
            profit: (leadsCut * LTV_ASSUMPTION) - spendCut
        }
    };

    return {
        intelligence: {
            ...state.intelligence,
            simulation: {
                baseline,
                scenarios: [scenario20, scenario50, scenarioOptimize]
            }
        }
    };
};
