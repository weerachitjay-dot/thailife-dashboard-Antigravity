import { GlobalState, SimulationScenario, OptimizationRecommendation } from '../types';

const LTV_ASSUMPTION = 3000;

// A7: TestAgent
export const TestAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🧪 Agent A7 (QA): Validating Data Integrity...");
    const ws = state.write_status;
    const rows = state.normalized_metrics;

    const checks = [
        { name: 'Write Success', passed: ws?.success === true },
        { name: 'Data Freshness', passed: rows.length > 0 }, // Simple check
        { name: 'No Negative Spend', passed: !rows.some(r => r.spend < 0) }
    ];

    const allPassed = checks.every(c => c.passed);
    return { test_report: { valid: allPassed, checks } };
};

// A8: SimulationAgent (Refactored)
export const SimulationAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🎲 Agent A8 (Sim): Running Scenarios...");
    const rows = state.normalized_metrics;
    if (rows.length === 0) return {};

    const totalSpend = rows.reduce((acc, r) => acc + r.spend, 0);
    const totalLeads = rows.reduce((acc, r) => acc + r.leads, 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const currentProfit = (totalLeads * LTV_ASSUMPTION) - totalSpend;

    // Baseline
    const baseline: SimulationScenario = {
        id: 'baseline', name: 'Baseline', description: 'Current State',
        assumptions: '-', risk_level: 'low',
        projected: { spend: totalSpend, leads: totalLeads, cpl: avgCpl, revenue: totalLeads * 3000, profit: currentProfit }
    };

    // Scenario: +20%
    const spend20 = totalSpend * 1.2;
    const cpl20 = avgCpl * 1.05; // +5% CPL
    const leads20 = cpl20 > 0 ? spend20 / cpl20 : 0;
    const scen20: SimulationScenario = {
        id: 'scale_20', name: 'Scale +20%', description: 'Moderate Scaling', assumptions: 'CPL +5%', risk_level: 'low',
        projected: { spend: spend20, leads: leads20, cpl: cpl20, revenue: leads20 * 3000, profit: (leads20 * 3000) - spend20 }
    };

    return { simulation: { baseline, scenarios: [scen20] } };
};

// A9: OptimizationAgent
export const OptimizationAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🧠 Agent A9 (Opt): Generating Plan...");
    const rows = state.normalized_metrics;
    const sim = state.simulation;
    const plans: OptimizationRecommendation[] = [];

    // Simple Rule: High CPL > 2 * Avg -> Recommendation PAUSE
    const avgCpl = sim?.baseline.projected.cpl || 200;
    const expensiveAds = rows.filter(r => r.spend > 500 && (r.cpl || (r.leads > 0 ? r.spend / r.leads : 0)) > (avgCpl * 2));

    expensiveAds.forEach(ad => {
        const currentCpl = ad.cpl || (ad.leads > 0 ? ad.spend / ad.leads : 0);
        plans.push({
            action: 'PAUSE',
            entity_id: ad.ad_id,
            entity_type: 'ad',
            reason: `CPL ${currentCpl.toFixed(0)} is > 2x Average (${avgCpl.toFixed(0)})`,
            priority: 'medium'
        });
    });

    // Simple Rule: High ROAS/Low CPL -> SCALE
    const cheapAds = rows.filter(r => r.leads > 5 && (r.cpl || (r.leads > 0 ? r.spend / r.leads : 0)) < (avgCpl * 0.7));
    cheapAds.forEach(ad => {
        const currentCpl = ad.cpl || (ad.leads > 0 ? ad.spend / ad.leads : 0);
        plans.push({
            action: 'SCALE',
            entity_id: ad.ad_id,
            entity_type: 'ad',
            reason: `Excellent CPL ${currentCpl.toFixed(0)}. Candidate for scale.`,
            priority: 'high'
        });
    });

    return { optimization_plan: plans };
};

// A10: ExecutiveSummaryAgent (Refactored)
export const ExecutiveSummaryAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("📝 Agent A10 (Report): Authoring Summary...");
    const { total_spend, total_leads } = state.normalized_metrics.reduce(
        (acc, r) => ({ total_spend: acc.total_spend + r.spend, total_leads: acc.total_leads + r.leads }),
        { total_spend: 0, total_leads: 0 }
    );
    const plan = state.optimization_plan || [];

    // Markdown generation
    const summary = `
## Executive Summary
**Performance**: ฿${total_spend.toLocaleString()} Spend | ${total_leads} Leads
**Optimization Plan**:
${plan.slice(0, 5).map(p => `- **${p.action}** ${p.entity_type} ${p.entity_id}: ${p.reason}`).join('\n')}
${plan.length > 5 ? `...and ${plan.length - 5} more actions.` : ''}
    `.trim();

    return { executive_summary: summary };
};
