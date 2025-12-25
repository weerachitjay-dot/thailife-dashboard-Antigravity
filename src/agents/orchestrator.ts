import { GlobalState, createInitialState } from './types';
import { SimulationAgent } from './core/SimulationAgent';
import { ExecutiveSummaryAgent } from './core/ExecutiveSummaryAgent';
// IngestionAgent is effectively the existing Sync Logic wrapped
// For this MVP refactor, we will inject the data from the existing sync job result into the state
// rather than rewriting the entire sync job *inside* the agent file immediately, 
// to avoid breaking the verified hourly sync logic. 
// We will call the Orchestrator with pre-populated data or fetch it.

export class AgentOrchestrator {
    private state: GlobalState;

    constructor(initialData?: Partial<GlobalState>) {
        this.state = { ...createInitialState(), ...initialData };
    }

    // The "Graph" runner
    async run() {
        console.log("🚀 Orchestrator: Starting Run...");

        try {
            // 1. Ingestion / Data Load (Mocked here or Passed in)
            // In a real LangGraph, this would be a node. 
            // Here we assume state.data is populated by the caller (Sync Job) or we fetch it.
            // For Safety/Guardrail: Check if data exists.
            if (this.state.data.raw_insights.length === 0) {
                console.log("Orchestrator: No insights provided. Skipping simulation.");
                return this.state;
            }

            // 2. Simulation Agent
            console.log("🤖 Node: SimulationAgent");
            const simResult = await SimulationAgent(this.state);
            this.state = { ...this.state, ...simResult, intelligence: { ...this.state.intelligence, ...simResult.intelligence } };

            // 3. Executive Summary Agent
            console.log("📝 Node: ExecutiveSummaryAgent");
            const execResult = await ExecutiveSummaryAgent(this.state);
            this.state = { ...this.state, ...execResult, intelligence: { ...this.state.intelligence, ...execResult.intelligence } };

            // 4. Persistence (Done by Caller for now, or we could add a PersistAgent)

            console.log("✅ Orchestrator: Run Complete.");
            return this.state;

        } catch (error: any) {
            console.error("💥 Orchestrator Crashed:", error);
            this.state.status.errors.push(error.message);
            return this.state;
        }
    }
}
