import React, { useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    Cell
} from 'recharts';
import { Target, TrendingUp, DollarSign, Calculator, Timer, ArrowUpDown, RotateCcw, Download } from 'lucide-react';
import { useSortableData } from '../hooks/useSortableData';
import { useExcelExport } from '../hooks/useExcelExport';
import KPICard from '../components/kpi/KPICard';
import { useData } from '../context/DataContext';
import { TYPE_ORDER } from '../utils/formatters';

const DashboardOverview = () => {
    const { appendData, sentData, targetData, filters, dateRange, campaignConfig, setCampaignConfig } = useData();

    // --- MERGED DATA ---
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

    // --- FORECAST DATA ---
    const forecastData = useMemo(() => {
        const allDates = [...appendData.map(d => d.Day), ...sentData.map(d => d.Day)].sort();
        // Correct Logic: Forecast is "Run Rate so far" extended to "End of Period".
        // The "Run Rate" is based on data from Start Date -> Today.

        const start = new Date(campaignConfig.start);
        const end = new Date(campaignConfig.end);
        const today = new Date();

        // Normalize time to midnight to avoid partial day errors
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return { rows: [], totals: {} };

        // 1. Total Duration of the selected Campaign Period
        const totalDuration = Math.max(1, (end - start) / (1000 * 60 * 60 * 24) + 1);

        // 2. Days Elapsed: How many days of data do we have? 
        // Logic: From Start Date until Today (clamped). 
        // If Today is after End, we have full duration. If Today is before Start, we have 0 (or 1 to avoid div0).
        let processingDate = today > end ? end : today;
        if (processingDate < start) processingDate = start; // Should not happen usually if selecting future

        const daysElapsed = Math.max(1, (processingDate - start) / (1000 * 60 * 60 * 24) + 1);

        // 3. Days Remaining: How many days left to forecast?
        // Logic: Total - Elapsed.
        const daysRemaining = Math.max(0, totalDuration - daysElapsed);

        const agg = {};
        sentData.forEach(row => {
            if (row.Day < campaignConfig.start || row.Day > campaignConfig.end) return;
            const prod = row.Product_Normalized;
            if (!agg[prod]) agg[prod] = { leadsSent: 0 };
            agg[prod].leadsSent += row.Leads_Sent || 0;
        });

        let totalTarget = 0, totalActual = 0, totalForecast = 0;

        const rows = targetData.map(t => {
            if (filters.owner !== 'All' && t.OWNER !== filters.owner) return null;
            if (filters.type !== 'All' && t.TYPE !== filters.type) return null;
            if (filters.product !== 'All' && t.Product_Target !== filters.product) return null;

            const actual = agg[t.Product_Target]?.leadsSent || 0;
            const avgPerDay = actual / daysElapsed;
            const forecastAdd = avgPerDay * daysRemaining;
            const forecastTotal = actual + forecastAdd;
            const progress = t.Target_Lead_Sent ? (actual / t.Target_Lead_Sent) * 100 : 0;
            const forecastPercent = t.Target_Lead_Sent ? (forecastTotal / t.Target_Lead_Sent) * 100 : 0;

            totalTarget += t.Target_Lead_Sent || 0;
            totalActual += actual;
            totalForecast += forecastTotal;

            return { ...t, actual, avgPerDay, daysRemaining, forecastTotal, progress, forecastPercent };
        }).filter(Boolean);

        const sortedRows = rows.sort((a, b) => {
            const orderA = TYPE_ORDER[a.TYPE] || 99;
            const orderB = TYPE_ORDER[b.TYPE] || 99;
            if (orderA !== orderB) return orderA - orderB;
            return a.OWNER.localeCompare(b.OWNER) || a.Product_Target.localeCompare(b.Product_Target);
        });

        const totalForecastPercent = totalTarget > 0 ? (totalForecast / totalTarget) * 100 : 0;

        return {
            rows: sortedRows,
            totals: { totalTarget, totalActual, totalForecast, totalForecastPercent }
        };
    }, [sentData, appendData, targetData, campaignConfig, filters]);

    // --- METRICS ---
    const metrics = useMemo(() => {
        let totalCost = 0, totalLeadsSent = 0, totalMetaLeads = 0, totalLeads = 0, totalTargetSent = 0;
        const distinctProducts = new Set();
        mergedData.forEach(d => {
            totalCost += d.Cost;
            totalLeadsSent += d.Leads_Sent;
            totalMetaLeads += d.Meta_Leads;
            totalLeads += d.Leads;
            if (!distinctProducts.has(d.Product)) {
                distinctProducts.add(d.Product);
                totalTargetSent += d.Target_Lead_Sent || 0;
            }
        });
        return {
            totalCost, totalLeadsSent, totalMetaLeads,
            cplMeta: totalLeads > 0 ? totalCost / totalLeads : 0,
            cplSent: totalLeadsSent > 0 ? totalCost / totalLeadsSent : 0,
            progress: totalTargetSent > 0 ? (totalLeadsSent / totalTargetSent) * 100 : 0,
            totalTargetSent
        };
    }, [mergedData]);

    const dailyChartData = useMemo(() => {
        const grouped = {};
        mergedData.forEach(d => {
            if (!grouped[d.Day]) grouped[d.Day] = { Day: d.Day, Leads_Sent: 0, Cost: 0, Meta_Leads: 0, Leads: 0 };
            grouped[d.Day].Leads_Sent += d.Leads_Sent;
            grouped[d.Day].Cost += d.Cost;
            grouped[d.Day].Meta_Leads += d.Meta_Leads;
            grouped[d.Day].Leads += d.Leads;
        });
        return Object.values(grouped).sort((a, b) => a.Day.localeCompare(b.Day)).map(d => {
            const date = new Date(d.Day);
            return {
                ...d,
                CPL_Sent: d.Leads_Sent > 0 ? d.Cost / d.Leads_Sent : 0,
                CPL_Meta: d.Leads > 0 ? d.Cost / d.Leads : 0,
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            };
        });
    }, [mergedData]);

    const performanceData = useMemo(() => {
        return Object.values(mergedData.reduce((acc, curr) => {
            const key = `${curr.Product}`;
            if (!acc[key]) acc[key] = { ...curr, Cost: 0, Leads_Sent: 0, Leads: 0, Target: curr.Target_Lead_Sent };
            acc[key].Cost += curr.Cost;
            acc[key].Leads_Sent += curr.Leads_Sent;
            acc[key].Leads += curr.Leads;
            return acc;
        }, {})).map(row => ({
            ...row,
            CPL_Sent: row.Leads_Sent ? row.Cost / row.Leads_Sent : 0,
            CPL_FB: row.Leads ? row.Cost / row.Leads : 0,
            Percent: row.Target ? (row.Leads_Sent / row.Target) * 100 : 0
        }));
    }, [mergedData]);

    const { items: sortedPerformanceData, requestSort, sortConfig, resetSort } = useSortableData(performanceData);
    const { exportToExcel } = useExcelExport();

    const handleExportForecast = () => {
        const columns = [
            { key: 'TYPE', label: 'Type' },
            { key: 'OWNER', label: 'Owner' },
            { key: 'Product_Target', label: 'Product' },
            { key: 'Target_Lead_Sent', label: 'Target' },
            { key: 'actual', label: 'Actual' },
            { key: 'forecastTotal', label: 'Forecast', formatter: (val) => Math.round(val) },
            { key: 'forecastPercent', label: 'Status (%)', formatter: (val) => parseFloat(val.toFixed(2)) }
        ];
        exportToExcel(forecastData.rows, 'Forecast_Projections', columns);
    };

    const handleExportPerformance = () => {
        const columns = [
            { key: 'Product', label: 'Product' },
            { key: 'Cost', label: 'Cost' },
            { key: 'Leads', label: 'FB Leads' },
            { key: 'Leads_Sent', label: 'Sent Leads' },
            { key: 'Target', label: 'Target' },
            { key: 'Percent', label: 'Progress (%)', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'CPL_FB', label: 'CPL (FB)', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'CPL_Sent', label: 'CPL (Sent)', formatter: (val) => parseFloat(val.toFixed(2)) }
        ];
        exportToExcel(sortedPerformanceData, 'Performance_Detail', columns);
    };

    return (
        <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="Total Leads Sent" value={metrics.totalLeadsSent.toLocaleString()} subtext={`Target: ${metrics.totalTargetSent.toLocaleString()}`} icon={Target} gradient="from-blue-500 to-cyan-500" />
                <KPICard title="Progress to Target" value={`${metrics.progress.toFixed(1)}%`} subtext="Completion Rate" icon={TrendingUp} gradient={metrics.progress >= 100 ? "from-emerald-500 to-teal-500" : "from-orange-500 to-amber-500"} trend={metrics.progress - 100} />
                <KPICard title="CPL (Sent)" value={`฿${metrics.cplSent.toFixed(0)}`} subtext={`Meta CPL: ฿${metrics.cplMeta.toFixed(0)}`} icon={DollarSign} gradient="from-violet-500 to-purple-500" />
                <KPICard title="Total Spending" value={`฿${metrics.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subtext="Media Cost" icon={Calculator} gradient="from-slate-700 to-slate-900" />
            </div>

            {/* Forecasting */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Timer className="w-32 h-32" />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 relative z-10">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Forecast & Projections</h3>
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                            <span>Based on run rate from</span>
                            <input
                                type="date"
                                className="bg-white/50 border border-slate-200 rounded px-2 py-0.5 text-xs text-indigo-600 font-bold"
                                value={campaignConfig.start}
                                onChange={e => setCampaignConfig(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span>to</span>
                            <input
                                type="date"
                                className="bg-white/50 border border-slate-200 rounded px-2 py-0.5 text-xs text-indigo-600 font-bold"
                                value={campaignConfig.end}
                                onChange={e => setCampaignConfig(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleExportForecast}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 relative z-10"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </button>
                </div>

                <div className="overflow-x-auto relative z-10 rounded-xl border border-white/40 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-indigo-50/80 text-xs uppercase font-bold text-indigo-900">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-xl">Type</th>
                                <th className="px-6 py-4">Owner</th>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4 text-right">Target</th>
                                <th className="px-6 py-4 text-right">Actual</th>
                                <th className="px-6 py-4 text-right">Forecast</th>
                                <th className="px-6 py-4 text-center rounded-tr-xl">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white/60">
                            {forecastData.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-slate-500">{row.TYPE}</td>
                                    <td className="px-6 py-4 text-slate-600">{row.OWNER}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{row.Product_Target}</td>
                                    <td className="px-6 py-4 text-right text-slate-500">{row.Target_Lead_Sent.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{row.actual.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-violet-600">{Math.round(row.forecastTotal).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.forecastPercent >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {row.forecastPercent.toFixed(0)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-indigo-100/50 font-bold border-t border-indigo-200">
                                <td colSpan={3} className="px-6 py-4 text-indigo-900 text-right">TOTALS</td>
                                <td className="px-6 py-4 text-right text-indigo-900">{forecastData.totals.totalTarget?.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-indigo-900">{forecastData.totals.totalActual?.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-indigo-900">{Math.round(forecastData.totals.totalForecast || 0).toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${forecastData.totals.totalForecastPercent >= 100 ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                                        {forecastData.totals.totalForecastPercent?.toFixed(0)}%
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                        Daily Lead Trend
                    </h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="Day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'Outfit' }}
                                />
                                <Bar dataKey="Leads_Sent" fill="url(#colorLeads)" radius={[4, 4, 0, 0]}>
                                    {dailyChartData.map((entry, i) => <Cell key={i} fill={entry.isWeekend ? "#818cf8" : "#4f46e5"} />)}
                                </Bar>
                                <defs>
                                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-orange-500" />
                        Cost Efficiency
                    </h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="Day" hide />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val) => `฿${val.toFixed(0)}`}
                                />
                                <Legend iconType="circle" />
                                <Line type="monotone" dataKey="CPL_Meta" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="CPL_Sent" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/30 bg-white/40 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Performance Detail</h3>
                    {sortConfig && (
                        <button
                            onClick={resetSort}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100/50 hover:bg-white hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleExportPerformance}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100 ml-2"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold border-b border-white/50">
                            <tr>
                                {[
                                    { label: 'Product', key: 'Product', align: 'left' },
                                    { label: 'Cost', key: 'Cost', align: 'right' },
                                    { label: 'FB Leads', key: 'Leads', align: 'right' },
                                    { label: 'Sent Leads', key: 'Leads_Sent', align: 'right' },
                                    { label: 'Target', key: 'Target', align: 'right' },
                                    { label: 'Progress', key: 'Percent', align: 'center' },
                                    { label: 'CPL (FB)', key: 'CPL_FB', align: 'right' },
                                    { label: 'CPL (Sent)', key: 'CPL_Sent', align: 'right' }
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
                        <tbody className="divide-y divide-slate-100 bg-white/40">
                            {sortedPerformanceData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/60 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700">{row.Product}</td>
                                    <td className="px-6 py-4 text-right text-slate-500">฿{row.Cost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-medium text-indigo-600">{row.Leads.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-medium text-orange-600">{row.Leads_Sent.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-slate-400">{row.Target.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${row.Percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(row.Percent, 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold w-9">{row.Percent.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-indigo-600">฿{row.CPL_FB.toFixed(0)}</td>
                                    <td className="px-6 py-4 text-right font-medium text-orange-600">฿{row.CPL_Sent.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default DashboardOverview;
