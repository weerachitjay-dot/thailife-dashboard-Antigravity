import { GlobalState } from '../types';

export const ExecutiveSummaryAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    const { total_spend, total_leads, avg_cpl } = state.data.aggregated_metrics;
    const simulation = state.intelligence.simulation;
    const errors = state.status.errors;
    const dateRange = state.config.date_range;

    if (!simulation) {
        return {
            intelligence: {
                ...state.intelligence,
                executive_summary: "### Data Unavailable\nInsufficient data to generate executive summary."
            }
        };
    }

    const bestScenario = simulation.scenarios.reduce((prev, current) =>
        (current.projected.profit > prev.projected.profit) ? current : prev
        , simulation.baseline);

    const recommendations = simulation.scenarios.map(s =>
        `- **${s.name}**: ${s.description} (Projected Profit: ฿${s.projected.profit.toLocaleString()})`
    ).join('\n');

    const errorSection = errors.length > 0
        ? `\n\n> [!WARNING]\n> System Alerts:\n> ${errors.map(e => `- ${e}`).join('\n')}`
        : '';

    const summary = `
# Executive Summary
**Period**: ${dateRange.start} to ${dateRange.end}

## 1. Overall Performance
Our campaigns generated **${total_leads} leads** with a total spend of **฿${total_spend.toLocaleString()}**, resulting in an average **CPL of ฿${avg_cpl.toFixed(2)}**.

## 2. Forecast & Simulation
Based on current performance modeling, here are the projected outcomes for different strategic moves:

${recommendations}

### Recommended Strategy
The **${bestScenario.name}** strategy appears most profitable, potentially yielding **฿${bestScenario.projected.profit.toLocaleString()}** in profit.

## 3. Operational Risks
${errorSection ? errorSection : "- No critical system errors detected."}
- **Market Risk**: ${bestScenario.risk_level.toUpperCase()}. ${bestScenario.assumptions}
    `.trim();

    return {
        intelligence: {
            ...state.intelligence,
            executive_summary: summary
        }
    };
};
