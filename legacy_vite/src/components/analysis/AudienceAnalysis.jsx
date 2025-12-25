import React, { useState, useEffect, useMemo } from 'react';
import { Layers, ArrowUpDown, RotateCcw, Download, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { getAudienceRecommendation } from '../../utils/formatters';
import { useSortableData } from '../../hooks/useSortableData';
import { useExcelExport } from '../../hooks/useExcelExport';

const AudienceAnalysis = ({ data, targetCpl }) => {
    const [productFilter, setProductFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [breakdown, setBreakdown] = useState('None'); // New State: None | Day | Week

    // Auto-Init Date Range
    useEffect(() => {
        if (!data || data.length === 0) return;

        const dates = data.map(d => d.Day).filter(Boolean).sort();
        if (dates.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStartDate(prev => prev || dates[0]);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEndDate(prev => prev || dates[dates.length - 1]);
        }
    }, [data]);

    // Extract Unique Products
    const products = useMemo(() => {
        const unique = new Set(data.map(d => d.Product).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [data]);

    // Helper: Get Start of Week (Monday)
    const getStartOfWeek = (dateStr) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    };

    const audienceStats = useMemo(() => {
        const stats = {};

        data.forEach(row => {
            // Filter by Product
            if (productFilter !== 'All' && row.Product !== productFilter) return;

            // Filter by Date
            const date = row.Day;
            if (startDate && new Date(date) < new Date(startDate)) return;
            if (endDate && new Date(date) > new Date(endDate)) return;

            const interest = row.Category_Normalized || 'Unknown';
            const category = row.Category_Group || 'Other'; // Get Category Group

            // Determine Group Key based on Breakdown
            let groupKey = interest;
            let timeLabel = '';

            if (breakdown === 'Day') {
                timeLabel = date;
                groupKey = `${interest}_${date}`;
            } else if (breakdown === 'Week') {
                timeLabel = getStartOfWeek(date);
                groupKey = `${interest}_${timeLabel}`;
            }

            if (!stats[groupKey]) {
                stats[groupKey] = {
                    key: groupKey,
                    interest,
                    category, // Store category
                    timeLabel: breakdown !== 'None' ? timeLabel : null, // Store date/week if applicable
                    cost: 0,
                    leads: 0,
                    impressions: 0,
                    clicks: 0,
                    reach: 0
                };
            }
            stats[groupKey].cost += (row.Cost || 0);
            stats[groupKey].leads += (row.Leads || 0); // Using FB Leads
            stats[groupKey].impressions += (row.Impressions || 0);
            stats[groupKey].clicks += (row.Clicks || 0);
            stats[groupKey].reach += (row.Reach || 0);
        });

        return Object.values(stats).map(item => {
            const cpl = item.leads > 0 ? item.cost / item.leads : 0;
            const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
            const cvr = item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0;
            const frequency = item.reach > 0 ? item.impressions / item.reach : 0;

            const rec = getAudienceRecommendation({ ...item, cpl, ctr, frequency }, targetCpl);

            return { ...item, cpl, ctr, cvr, frequency, rec };
        }).sort((a, b) => {
            // If breakdown is active, maybe sort by Date desc first, then Cost?
            // Or keep sorting by Cost by default. Let's stick to Cost for now.
            if (breakdown !== 'None') {
                // Sort by Time Label Descending (Newest first) then Cost
                if (a.timeLabel !== b.timeLabel) {
                    return new Date(b.timeLabel) - new Date(a.timeLabel);
                }
            }
            return b.cost - a.cost;
        });

    }, [data, productFilter, startDate, endDate, targetCpl, breakdown]);

    // AI Summary Logic
    const summaryInsights = useMemo(() => {
        if (!targetCpl) return null;

        const winners = [];
        const losers = [];
        const fatigue = [];
        const opportunities = [];

        audienceStats.forEach(item => {
            // Only consider meaningful spend or meaningful metrics
            if (item.cost < 100) return; // Ignore very low spend

            const cplRatio = item.cpl / targetCpl;

            // Winners: Cheap CPL and Good Volume
            if (cplRatio < 0.8 && item.leads >= 2) {
                winners.push(`${item.interest} (CPL ฿${item.cpl.toFixed(0)})`);
            }

            // Losers: Expensive
            if (cplRatio > 1.5 && item.leads > 0) {
                losers.push(`${item.interest} (CPL ฿${item.cpl.toFixed(0)})`);
            } else if (item.cost > targetCpl * 2 && item.leads === 0) {
                losers.push(`${item.interest} (No Leads)`);
            }

            // Fatigue
            if (item.frequency > 4) {
                fatigue.push(`${item.interest} (Freq ${item.frequency.toFixed(1)})`);
            }

            // Opportunities: High CTR, Low Spend/Leads logic
            if (item.ctr > 1.5 && item.cost < targetCpl * 1.5 && cplRatio < 1.0) {
                // Good CTR, haven't spent too much yet, but looks promising or cheap enough
                opportunities.push(`${item.interest} (CTR ${item.ctr.toFixed(1)}%)`);
            }
        });

        // Limit to top 3 for brevity
        return {
            winners: winners.slice(0, 3),
            losers: losers.slice(0, 3),
            fatigue: fatigue.slice(0, 3),
            opportunities: opportunities.slice(0, 3),
            count: winners.length + losers.length + fatigue.length + opportunities.length
        };
    }, [audienceStats, targetCpl]);

    const { items: sortedAudienceStats, requestSort, sortConfig, resetSort } = useSortableData(audienceStats);
    const { exportToExcel } = useExcelExport();

    const handleExport = () => {
        const columns = [
            ...(breakdown !== 'None' ? [{ key: 'timeLabel', label: breakdown === 'Day' ? 'Date' : 'Week Of' }] : []),
            { key: 'interest', label: 'Audience / Interest' },
            { key: 'category', label: 'Category' },
            { key: 'frequency', label: 'Freq', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'ctr', label: 'CTR (%)', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'cvr', label: 'CVR (%)', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'cost', label: 'Spend' },
            { key: 'leads', label: 'Leads' },
            { key: 'cpl', label: 'CPL', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'rec', label: 'Action', formatter: (val) => val.action },
            { key: 'rec', label: 'Reason', formatter: (val) => val.reason }
        ];
        exportToExcel(sortedAudienceStats, 'Audience_Analysis', columns);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Layers className="w-6 h-6 text-indigo-500" />
                        Smart Audience Analysis
                    </h2>
                    <p className="text-slate-500 mt-1">Deep dive into Interest & Behavior performance.</p>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Breakdown</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['None', 'Day', 'Week'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setBreakdown(mode)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${breakdown === mode
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Filter Product</label>
                        <select
                            className="glass-input px-3 py-2 rounded-xl text-sm min-w-[200px]"
                            value={productFilter}
                            onChange={e => setProductFilter(e.target.value)}
                        >
                            {products.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Start Date</label>
                        <input type="date" className="glass-input px-3 py-2 rounded-xl text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">End Date</label>
                        <input type="date" className="glass-input px-3 py-2 rounded-xl text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-card p-0 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 uppercase">Audience Performance {breakdown !== 'None' && `(By ${breakdown})`}</h3>
                    <div className="flex gap-2">
                        {sortConfig && (
                            <button
                                onClick={resetSort}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white hover:text-indigo-600 rounded-lg transition-colors border border-slate-200 shadow-sm"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset Sort
                            </button>
                        )}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-white hover:text-indigo-800 rounded-lg transition-colors border border-slate-200 shadow-sm ml-2"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                    </div>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                        <tr>
                            {[
                                ...(breakdown !== 'None' ? [{ label: breakdown === 'Day' ? 'Date' : 'Week Of', key: 'timeLabel', align: 'left' }] : []),
                                { label: 'Audience / Interest', key: 'interest', align: 'left' },
                                { label: 'Freq', key: 'frequency', align: 'center' },
                                { label: 'CTR', key: 'ctr', align: 'center' },
                                { label: 'CVR', key: 'cvr', align: 'center' },
                                { label: 'Spend', key: 'cost', align: 'right' },
                                { label: 'Leads', key: 'leads', align: 'right' },
                                { label: 'CPL', key: 'cpl', align: 'right' },
                                { label: 'Action', key: 'rec.action', align: 'center' }
                            ].map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => requestSort(col.key)}
                                    className={`px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                >
                                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                        {col.label}
                                        <ArrowUpDown className={`w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors ${sortConfig?.key === col.key ? 'text-amber-500' : ''}`} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedAudienceStats.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                {breakdown !== 'None' && (
                                    <td className="px-4 py-4 font-bold text-slate-500 whitespace-nowrap">
                                        {row.timeLabel}
                                    </td>
                                )}
                                <td className="px-4 py-4 font-bold text-slate-700">
                                    {row.interest}
                                    <div className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold mt-1 bg-indigo-50 inline-block px-1.5 py-0.5 rounded">
                                        {row.category}
                                    </div>
                                </td>
                                <td className="px-2 py-4 text-center text-slate-600">{row.frequency.toFixed(2)}</td>
                                <td className="px-2 py-4 text-center">
                                    <div className={`inline-block px-2 py-1 rounded ${row.ctr > 1.5 ? 'bg-green-50 text-green-700 font-bold' : row.ctr < 0.5 ? 'bg-red-50 text-red-700' : 'text-slate-600'}`}>
                                        {row.ctr.toFixed(2)}%
                                    </div>
                                </td>
                                <td className="px-2 py-4 text-center text-slate-600">{row.cvr.toFixed(2)}%</td>
                                <td className="px-3 py-4 text-right">฿{row.cost.toLocaleString()}</td>
                                <td className="px-3 py-4 text-right">{row.leads}</td>
                                <td className="px-3 py-4 text-right font-bold">฿{row.cpl.toFixed(0)}</td>
                                <td className="px-4 py-4 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${row.rec.color}`}>
                                        {row.rec.icon && <row.rec.icon className="w-3.5 h-3.5" />}
                                        {row.rec.action}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">{row.rec.reason}</div>
                                </td>
                            </tr>
                        ))}
                        {sortedAudienceStats.length === 0 && (
                            <tr><td colSpan={breakdown === 'None' ? 8 : 9} className="text-center py-8 text-slate-400">No data available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* AI Summary Section */}
            {summaryInsights && summaryInsights.count > 0 && (
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-1 rounded-2xl shadow-lg">
                    <div className="bg-white rounded-xl p-6">
                        <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
                            AI Insight Summary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Winners */}
                            {summaryInsights.winners.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4" />
                                        Scale / Winners
                                    </div>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                        {summaryInsights.winners.map((txt, i) => <li key={i}>• {txt}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Opportunities */}
                            {summaryInsights.opportunities.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4" />
                                        Opportunities (High CTR)
                                    </div>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                        {summaryInsights.opportunities.map((txt, i) => <li key={i}>• {txt}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Losers */}
                            {summaryInsights.losers.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4" />
                                        Stop / Expensive
                                    </div>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                        {summaryInsights.losers.map((txt, i) => <li key={i}>• {txt}</li>)}
                                    </ul>
                                </div>
                            )}

                            {/* Fatigue */}
                            {summaryInsights.fatigue.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <RotateCcw className="w-4 h-4" />
                                        Audience Fatigue
                                    </div>
                                    <ul className="text-sm text-slate-600 space-y-1">
                                        {summaryInsights.fatigue.map((txt, i) => <li key={i}>• {txt}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudienceAnalysis;
