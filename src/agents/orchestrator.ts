import { GlobalState, createInitialState } from './types';
import * as Validators from './core/ValidationAgents';
import * as DataEngineers from './core/DataAgents';
import * as Intelligence from './core/IntelligenceAgents';
// IngestionAgent is effectively the existing Sync Logic wrapped
// For this MVP refactor, we will inject the data from the existing sync job result into the state
// rather than rewriting the entire sync job *inside* the agent file immediately, 
// to avoid breaking the verified hourly sync logic. 
// We will call the Orchestrator with pre-populated data or fetch it.

export class AgentOrchestrator {
    private state: GlobalState;

    constructor(initialData?: Partial<GlobalState>) {
        this.state = createInitialState(initialData);
    }

    async run() {
        console.log("🚀 Orchestrator: Starting 10-Agent Pipeline...");

        try {
            // --- VALIDATION PHASE ---
            this.state = { ...this.state, ...(await Validators.FacebookAuthAgent(this.state)) };
            if (!this.state.auth_status?.valid) throw new Error(`A1 Failed: ${this.state.auth_status?.error}`);

            this.state = { ...this.state, ...(await Validators.SupabaseSchemaAgent(this.state)) };
            if (!this.state.schema_status?.valid) throw new Error(`A2 Failed: Schema Invalid`);

            this.state = { ...this.state, ...(await Validators.FacebookAccountAgent(this.state)) };

            // --- DATA PHASE ---
            this.state = { ...this.state, ...(await DataEngineers.FacebookInsightsAgent(this.state)) };
            this.state = { ...this.state, ...(await DataEngineers.MetricsComputeAgent(this.state)) };
            this.state = { ...this.state, ...(await DataEngineers.SupabaseIngestAgent(this.state)) };

            // --- INTELLIGENCE PHASE ---
            this.state = { ...this.state, ...(await Intelligence.TestAgent(this.state)) };
            this.state = { ...this.state, ...(await Intelligence.SimulationAgent(this.state)) };
            this.state = { ...this.state, ...(await Intelligence.OptimizationAgent(this.state)) };
            this.state = { ...this.state, ...(await Intelligence.ExecutiveSummaryAgent(this.state)) };

            console.log("✅ Orchestrator: Pipeline Complete.");
            return this.state;

        } catch (error: any) {
            console.error("💥 Orchestrator Crashed:", error);
            this.state.errors.push(error.message);
            return this.state;
        }
    }
}
