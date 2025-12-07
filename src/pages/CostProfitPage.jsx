import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import { BadgeDollarSign, TrendingUp, Wallet, Calculator, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useSortableData } from '../hooks/useSortableData';
import { useData } from '../context/DataContext';
import { normalizeProduct } from '../utils/formatters';

const CostProfitPage = () => {
    const { appendData, targetData, sentData, filters, dateRange } = useData();

    // --- LOGIC: Merge Target + Actuals + Sent ---
    const productStats = useMemo(() => {
        // 1. Group Actuals by Product
        const actualsMap = {};

        appendData.forEach(row => {
            if (!row.Product || !row.Day) return;

            // Apply Date Range Filter
            if (dateRange.start && row.Day < dateRange.start) return;
            if (dateRange.end && row.Day > dateRange.end) return;

            const normalized = normalizeProduct(row.Product);

            // Initialize if new
            if (!actualsMap[normalized]) {
                actualsMap[normalized] = { leads: 0, cost: 0 };
            }

            const cost = parseFloat(row.Cost) || 0;
            const leads = parseInt(row.Leads) || 0;

            actualsMap[normalized].leads += leads;
            actualsMap[normalized].cost += cost;
        });

        // 2. Group Sent Data by Product (MATCHING DASHBOARD LOGIC)
        const sentMap = {};
        sentData.forEach(row => {
            if (!row.Product_Normalized || !row.Day) return;
            if (dateRange.start && row.Day < dateRange.start) return;
            if (dateRange.end && row.Day > dateRange.end) return;

            const normalized = normalizeProduct(row.Product_Normalized);
            if (!sentMap[normalized]) sentMap[normalized] = 0;
            sentMap[normalized] += parseInt(row.Leads_Sent) || 0;
        });

        // 3. Iterate Targets to build final list
        const stats = targetData.map(target => {
            const prodName = target.Product_Target; // Assuming this is normalized in target.csv or consistent
            const actuals = actualsMap[prodName] || { leads: 0, cost: 0 };
            const actualLeadsSent = sentMap[prodName] || 0; // Use Actual Sent Data

            const targetPrice = parseFloat(target.Target_SellPrice) || 0;

            // Revenue based on ACTUAL Leads Sent (matching Dashboard)
            const estRevenue = actualLeadsSent * targetPrice;
            const profit = estRevenue - actuals.cost;
            const roi = actuals.cost > 0 ? ((estRevenue - actuals.cost) / actuals.cost) * 100 : 0;

            // Filters Check (Owner/Type)
            if (filters.owner !== 'All' && target.OWNER !== filters.owner) return null;
            if (filters.type !== 'All' && target.TYPE !== filters.type) return null;

            return {
                product: prodName,
                owner: target.OWNER,
                type: target.TYPE,
                leads: actuals.leads,
                leadsSent: actualLeadsSent, // Using Actual Sent
                cost: actuals.cost,
                targetPrice,
                estRevenue,
                profit,
                roi
            };
        }).filter(Boolean);

        // Sort by Profit Descending
        return stats.sort((a, b) => b.profit - a.profit);
    }, [appendData, targetData, sentData, filters, dateRange]);

    const { items: sortedProductStats, requestSort, sortConfig, resetSort } = useSortableData(productStats);

    // --- AGGREGATION: Totals & Forecast ---
    const totals = useMemo(() => {
        let cost = 0, revenue = 0, profit = 0, leadsSent = 0;
        productStats.forEach(p => {
            cost += p.cost;
            leadsSent += p.leadsSent;
            revenue += p.estRevenue;
            profit += p.profit;
        });

        // Forecast Logic
        // Pro-rate based on View Range (Target duration)
        let daysInRange = 30; // Default fallback
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start);
            const end = new Date(dateRange.end);
            if (!isNaN(start) && !isNaN(end)) {
                // Difference in milliseconds / (1000 * 60 * 60 * 24)
                daysInRange = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            }
        }

        // Need count of distinct days actually present in data
        const uniqueDays = new Set();
        appendData.forEach(row => {
            if (dateRange.start && row.Day < dateRange.start) return;
            if (dateRange.end && row.Day > dateRange.end) return;
            uniqueDays.add(row.Day);
        });
        const daysElapsed = uniqueDays.size || 1;

        // Forecast = Avg Daily Profit * Total Days in Range
        const avgDailyProfit = profit / daysElapsed;
        const forecast = avgDailyProfit * daysInRange;

        return { cost, revenue, profit, forecast, daysElapsed, daysInRange, leadsSent };
    }, [productStats, appendData, dateRange]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BadgeDollarSign className="w-8 h-8 text-teal-600" />
                Cost & Profit Analysis
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="glass-card p-6 rounded-2xl flex flex-col gap-2 border-l-4 border-l-orange-500">
                    <div className="flex items-center gap-3 text-orange-600">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-bold uppercase text-xs tracking-wide">Total Leads Sent</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">{totals.leadsSent.toLocaleString()}</h3>
                </div>
                <div className="glass-card p-6 rounded-2xl flex flex-col gap-2 border-l-4 border-l-slate-400">
                    <div className="flex items-center gap-3 text-slate-600">
                        <Wallet className="w-5 h-5" />
                        <span className="font-bold uppercase text-xs tracking-wide">Actual Cost</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">฿{totals.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                </div>
                <div className="glass-card p-6 rounded-2xl flex flex-col gap-2 border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-3 text-blue-600">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-bold uppercase text-xs tracking-wide">Est. Revenue</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">฿{totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                </div>
                <div className={`glass-card p-6 rounded-2xl flex flex-col gap-2 border-l-4 ${totals.profit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                    <div className={`flex items-center gap-3 ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        <BadgeDollarSign className="w-5 h-5" />
                        <span className="font-bold uppercase text-xs tracking-wide">Net Profit</span>
                    </div>
                    <h3 className={`text-3xl font-black ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {totals.profit >= 0 ? '+' : ''}฿{totals.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h3>
                </div>
                <div className="glass-card p-6 rounded-2xl flex flex-col gap-2 border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-3 text-purple-600">
                        <Calculator className="w-5 h-5" />
                        <span className="font-bold uppercase text-xs tracking-wide">Forecast ({totals.daysInRange} Days)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900">฿{totals.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                    <p className="text-xs text-slate-400">Based on {totals.daysElapsed} days run rate</p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profit by Product Bar Chart */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-3 border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Profit by Product</h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis
                                    dataKey="product"
                                    tick={{ fill: '#334155', fontSize: 10, fontWeight: 600 }}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                />
                                <YAxis tick={{ fill: '#334155' }} tickFormatter={(val) => `฿${val / 1000}k`} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    formatter={(value) => `฿${value.toLocaleString()}`}
                                    contentStyle={{ borderRadius: '12px' }}
                                />
                                <Legend />
                                <Bar dataKey="profit" name="Profit/Loss" radius={[4, 4, 0, 0]}>
                                    {productStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detail Table */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Product Profitability Breakdown</h3>
                    {sortConfig && (
                        <button
                            onClick={resetSort}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100/50 hover:bg-white hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                {[
                                    { label: 'Product', key: 'product', align: 'left' },
                                    { label: 'Owner', key: 'owner', align: 'center' },
                                    { label: 'Leads', key: 'leads', align: 'right' },
                                    { label: 'Est. Revenue', key: 'estRevenue', align: 'right' },
                                    { label: 'Actual Cost', key: 'cost', align: 'right' },
                                    { label: 'Net Profit', key: 'profit', align: 'right' },
                                    { label: 'ROI', key: 'roi', align: 'right' }
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => requestSort(col.key)}
                                        className={`px-6 py-4 cursor-pointer hover:bg-indigo-50/50 transition-colors group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                    >
                                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                            {col.label}
                                            <ArrowUpDown className={`w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors ${sortConfig?.key === col.key ? 'text-indigo-600' : ''}`} />
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/60">
                            {sortedProductStats.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800">{row.product}</td>
                                    <td className="px-6 py-4 text-center text-slate-500 text-xs font-bold bg-slate-100 rounded-full mx-auto w-fit px-2 py-0.5 mt-3 block">{row.owner}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-700">{row.leads.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-blue-700">฿{row.estRevenue.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-600">฿{row.cost.toLocaleString()}</td>
                                    <td className={`px-6 py-4 text-right font-black ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {row.profit >= 0 ? '+' : ''}฿{row.profit.toLocaleString()}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${row.roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {row.roi.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CostProfitPage;
