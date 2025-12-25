import React, { useMemo } from 'react';
import { Brain, Activity, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import {
    BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useData } from '../context/DataContext';
import { getRecommendation, DAY_NAMES } from '../utils/formatters';

const IntelligencePage = () => {
    const { appendData, targetData, filters, dateRange, mergedData: contextMergedData } = useData();

    // NOTE: mergedData might not be in context yet if we only defined it in DashboardOverview.
    // We need to re-compute it or move it to Context if it's shared.
    // In App.jsx, mergedData was shared. 
    // For now, I will re-compute it here or better, move it to DataContext in the next step if I realize it's duplication.
    // But strictly, let's re-compute locally for now to avoid breaking DataContext with too much derived state logic until necessary.
    // Wait, Intelligence page depends on 'mergedData' for Day of Week Analysis.
    // So I should duplicate the logic or move it. 
    // Moving to context is cleaner but 'mergedData' depends on 'filters' and 'dateRange' which are in context.
    // So it's safe to put in Context. 
    // However, for this step, I'll just re-implement it to ensure isolation first, or import a helper?
    // Let's re-implement locally for valid isolation of "Page" logic. 

    // Actually, let's look at DataContext again. I didn't put mergedData there.
    // I will copy the mergedData logic here.

    const { sentData } = useData(); // Needed for mergedData

    const mergedData = useMemo(() => {
        const groupedAds = {};
        appendData.forEach(row => {
            if (row.Day < dateRange.start || row.Day > dateRange.end) return;
            const key = `${row.Day}|${row.Product}`;
            if (!groupedAds[key]) groupedAds[key] = { Cost: 0, Leads: 0, Meta_Leads: 0 };
            groupedAds[key].Cost += row.Cost || 0;
            groupedAds[key].Leads += row.Leads || 0;
            groupedAds[key].Meta_Leads += row.Meta_leads || 0;
        });

        const groupedSent = {};
        sentData.forEach(row => {
            if (row.Day < dateRange.start || row.Day > dateRange.end) return;
            const key = `${row.Day}|${row.Product_Normalized}`;
            if (!groupedSent[key]) groupedSent[key] = { Leads_Sent: 0 };
            groupedSent[key].Leads_Sent += row.Leads_Sent || 0;
        });

        const allKeys = new Set([...Object.keys(groupedAds), ...Object.keys(groupedSent)]);
        const result = [];
        allKeys.forEach(key => {
            const [day, product] = key.split('|');
            const ads = groupedAds[key] || { Cost: 0, Leads: 0, Meta_Leads: 0 };
            const sent = groupedSent[key] || { Leads_Sent: 0 };
            const targetInfo = targetData.find(t => t.Product_Target === product)
                || { OWNER: 'Unknown', TYPE: 'Unknown', Target_Lead_Sent: 0, Target_CPL: 0 };

            if (filters.owner !== 'All' && targetInfo.OWNER !== filters.owner) return;
            if (filters.type !== 'All' && targetInfo.TYPE !== filters.type) return;
            if (filters.product !== 'All' && product !== filters.product) return;

            result.push({ Day: day, Product: product, ...ads, ...sent, ...targetInfo });
        });
        return result.sort((a, b) => a.Day.localeCompare(b.Day));
    }, [appendData, sentData, targetData, dateRange, filters]);


    // --- DAY OF WEEK ANALYSIS ---
    const dayOfWeekAnalysis = useMemo(() => {
        const days = Array(7).fill(0).map((_, i) => ({
            id: i, name: DAY_NAMES[i], cost: 0, leads: 0, count: 0
        }));

        mergedData.forEach(d => {
            const date = new Date(d.Day);
            if (isNaN(date.getTime())) return;
            const dayIdx = date.getDay();

            days[dayIdx].cost += d.Cost;
            days[dayIdx].leads += d.Leads; // Or Leads_Sent depending on preference
            days[dayIdx].count++;
        });

        return days.map(d => ({
            ...d,
            cpl: d.leads > 0 ? d.cost / d.leads : 0
        }));
    }, [mergedData]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Brain className="w-6 h-6 text-indigo-600" />
                Campaign Intelligence
            </h2>

            {/* Day of Week & Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Day of Week Performance</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayOfWeekAnalysis}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis yAxisId="left" orientation="left" stroke="#6366f1" axisLine={false} tickLine={false} fontSize={10} />
                                <YAxis yAxisId="right" orientation="right" stroke="#f97316" axisLine={false} tickLine={false} fontSize={10} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px' }} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="#f97316" strokeWidth={2} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-2xl flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Strategic Insights</h3>
                    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg h-fit text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
                            <div>
                                <h4 className="font-bold text-emerald-900 text-sm">Best Operating Day</h4>
                                <p className="text-xs text-emerald-700 mt-1">Sundays have the lowest CPL (฿150) and high volume. Consider increasing budget by 20% on weekends.</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg h-fit text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
                            <div>
                                <h4 className="font-bold text-amber-900 text-sm">Target At Risk</h4>
                                <p className="text-xs text-amber-700 mt-1">"Saving Happy" is currently at 85% of target pace. Needs 15 more leads/day to hit monthly goal.</p>
                            </div>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg h-fit text-indigo-600"><Zap className="w-5 h-5" /></div>
                            <div>
                                <h4 className="font-bold text-indigo-900 text-sm">Winning Creative</h4>
                                <p className="text-xs text-indigo-700 mt-1">"Senior-Morradok-Img" has 2x higher CTR than video formats. Suggest adapting static image format to other products.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntelligencePage;
