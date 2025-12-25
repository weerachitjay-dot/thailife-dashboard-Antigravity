
import { AlertTriangle, CheckCircle, Clock, Lightbulb, RefreshCw, TrendingUp, XCircle, Zap } from 'lucide-react';

export interface CampaignStats {
    cost: number;
    leads: number;
    cpl: number;
    daysActive: number;
    ctr?: number;
    frequency?: number;
}

export type RecommendationType = 'success' | 'warning' | 'danger' | 'neutral' | 'learning';

export interface Recommendation {
    type: RecommendationType;
    action: string;
    reason: string;
    icon: any;
    color: string;
}

export const getSmartRecommendation = (stats: CampaignStats, targetCpl: number): Recommendation => {
    const { cost, leads, cpl, daysActive } = stats;

    // 1. Learning Phase Check
    if (daysActive < 4) {
        return {
            type: 'learning',
            action: 'WAIT',
            reason: `Learning Phase (${daysActive}/4 days)`,
            color: 'text-yellow-600 bg-yellow-100',
            icon: Clock
        };
    }

    if (!targetCpl) return { type: 'neutral', action: '-', reason: 'No Target', color: 'text-gray-500 bg-gray-100', icon: Lightbulb };

    // 2. Performance Check
    const cplRatio = cpl / targetCpl;

    if (cost > 0 && leads === 0 && daysActive > 4) {
        return { type: 'danger', action: 'STOP', reason: 'Zero Leads', color: 'text-rose-700 bg-rose-100', icon: XCircle };
    }

    if (cplRatio < 0.8) {
        return { type: 'success', action: 'SCALE', reason: 'Cheap CPL (High Potential)', color: 'text-emerald-700 bg-emerald-100', icon: Zap };
    }
    if (cplRatio <= 1.1) {
        return { type: 'success', action: 'MAINTAIN', reason: 'On Target', color: 'text-blue-700 bg-blue-100', icon: CheckCircle };
    }
    if (cplRatio <= 1.5) {
        return { type: 'warning', action: 'MONITOR', reason: 'Slightly Expensive', color: 'text-amber-700 bg-amber-100', icon: AlertTriangle };
    }

    return { type: 'danger', action: 'STOP/FIX', reason: 'CPL Too High', color: 'text-rose-700 bg-rose-100', icon: XCircle };
};
