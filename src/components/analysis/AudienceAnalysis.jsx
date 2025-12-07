import React, { useState, useEffect, useMemo } from 'react';
import { Layers, ArrowUpDown, RotateCcw } from 'lucide-react';
import { getAudienceRecommendation } from '../../utils/formatters';
import { useSortableData } from '../../hooks/useSortableData';

const AudienceAnalysis = ({ data, targetCpl }) => {
    const [productFilter, setProductFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Auto-Init Date Range
    useEffect(() => {
        if (data && data.length > 0) {
            const dates = data.map(d => d.Day).filter(Boolean).sort();
            if (dates.length > 0) {
                if (!startDate) setStartDate(dates[0]);
                if (!endDate) setEndDate(dates[dates.length - 1]);
            }
        }
    }, [data]);

    // Extract Unique Products
    const products = useMemo(() => {
        const unique = new Set(data.map(d => d.Product).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [data]);

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

            if (!stats[interest]) {
                stats[interest] = {
                    interest,
                    category, // Store category
                    cost: 0,
                    leads: 0,
                    impressions: 0,
                    clicks: 0,
                    reach: 0
                };
            }
            stats[interest].cost += (row.Cost || 0);
            stats[interest].leads += (row.Leads || 0); // Using FB Leads
            stats[interest].impressions += (row.Impressions || 0);
            stats[interest].clicks += (row.Clicks || 0);
            stats[interest].reach += (row.Reach || 0);
        });

        return Object.values(stats).map(item => {
            const cpl = item.leads > 0 ? item.cost / item.leads : 0;
            const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
            const cvr = item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0;
            const frequency = item.reach > 0 ? item.impressions / item.reach : 0;

            const rec = getAudienceRecommendation({ ...item, cpl, ctr, frequency }, targetCpl);

            return { ...item, cpl, ctr, cvr, frequency, rec };
        }).sort((a, b) => b.cost - a.cost);

    }, [data, productFilter, startDate, endDate, targetCpl]);

    const { items: sortedAudienceStats, requestSort, sortConfig, resetSort } = useSortableData(audienceStats);

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
                    <h3 className="text-sm font-bold text-slate-700 uppercase">Audience Performance</h3>
                    {sortConfig && (
                        <button
                            onClick={resetSort}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white hover:text-indigo-600 rounded-lg transition-colors border border-slate-200 shadow-sm"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Sort
                        </button>
                    )}
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                        <tr>
                            {[
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
                            <tr><td colSpan="8" className="text-center py-8 text-slate-400">No data available</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AudienceAnalysis;
