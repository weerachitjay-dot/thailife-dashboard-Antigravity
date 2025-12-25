import React, { useState, useEffect, useMemo } from 'react';
import { Lightbulb, Search, Zap, CheckCircle, Activity, XCircle, ArrowUpDown, RotateCcw, Download } from 'lucide-react';
import { extractCreativeName, getSmartRecommendation } from '../../utils/formatters';
import { useSortableData } from '../../hooks/useSortableData';
import { useExcelExport } from '../../hooks/useExcelExport';

const CreativeAnalysis = ({ data, targetCpl }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [productFilter, setProductFilter] = useState('All');

    // Auto-Init Date Range
    useEffect(() => {
        if (!data || data.length === 0) return;

        // Find min and max dates
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

    // Process Data
    const creativeStats = useMemo(() => {
        const stats = {};

        data.forEach(row => {
            const rawName = row.Ad_name || row.Creative || 'Unknown';
            const cleanName = extractCreativeName(rawName);
            const date = row.Day; // Assuming 'Day' exists from processing logic
            const product = row.Product || 'Unknown';

            // Check Date Range
            if (startDate && new Date(date) < new Date(startDate)) return;
            if (endDate && new Date(date) > new Date(endDate)) return;

            // Check Product Filter
            if (productFilter !== 'All' && product !== productFilter) return;

            if (!stats[cleanName]) {
                stats[cleanName] = {
                    name: cleanName,
                    cost: 0,
                    leads: 0,
                    days: new Set(),
                    rawName: rawName,
                    product: product
                };
            }
            stats[cleanName].cost += (row.Cost || 0);
            stats[cleanName].leads += (row.Leads || 0); // Using FB Leads for optimization usually
            stats[cleanName].days.add(date);
        });

        return Object.values(stats).map(item => {
            const cpl = item.leads > 0 ? item.cost / item.leads : 0;
            const daysActive = item.days.size;
            const rec = getSmartRecommendation({ ...item, cpl, daysActive }, targetCpl);

            return {
                ...item,
                cpl,
                daysActive,
                rec
            };
        }).sort((a, b) => b.cost - a.cost); // Sort by Spend by default
    }, [data, startDate, endDate, targetCpl, productFilter]);

    const filteredCreatives = creativeStats.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const { items: sortedCreatives, requestSort, sortConfig, resetSort } = useSortableData(filteredCreatives);
    const { exportToExcel } = useExcelExport();

    const handleExport = () => {
        const columns = [
            { key: 'name', label: 'Creative Name' },
            { key: 'rawName', label: 'Full Ad Name' },
            { key: 'product', label: 'Product' },
            { key: 'daysActive', label: 'Days Active' },
            { key: 'cost', label: 'Spend' },
            { key: 'leads', label: 'Leads' },
            { key: 'cpl', label: 'CPL', formatter: (val) => parseFloat(val.toFixed(2)) },
            { key: 'rec', label: 'Recommendation', formatter: (val) => val.action },
            { key: 'rec', label: 'Reason', formatter: (val) => val.reason }
        ];
        exportToExcel(sortedCreatives, 'Creative_Analysis', columns);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header & Controls */}
            <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-amber-500" />
                        Smart Creative Analysis
                    </h2>
                    <p className="text-slate-500 mt-1">AI-driven insights on your ad creatives.</p>
                </div>

                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Filter Product</label>
                        <select
                            className="glass-input px-3 py-2 rounded-xl text-sm min-w-[150px]"
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
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Creative..."
                            className="glass-input pl-10 pr-4 py-2 rounded-xl text-sm w-48"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Recommendations Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['SCALE', 'MAINTAIN', 'MONITOR', 'STOP'].map(status => {
                    const count = creativeStats.filter(c => c.rec.action.includes(status)).length;
                    const colors = {
                        'SCALE': 'from-emerald-500 to-green-500',
                        'MAINTAIN': 'from-blue-500 to-cyan-500',
                        'MONITOR': 'from-amber-500 to-orange-500',
                        'STOP': 'from-rose-500 to-red-500'
                    };
                    return (
                        <div key={status} className="glass-card p-4 rounded-xl flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">{status}</p>
                                <p className="text-2xl font-bold text-slate-700">{count}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[status]} flex items-center justify-center text-white shadow-lg`}>
                                {status === 'SCALE' && <Zap className="w-5 h-5" />}
                                {status === 'MAINTAIN' && <CheckCircle className="w-5 h-5" />}
                                {status === 'MONITOR' && <Activity className="w-5 h-5" />}
                                {status === 'STOP' && <XCircle className="w-5 h-5" />}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Table */}
            <div className="glass-card p-0 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-700 uppercase">Creative Performance</h3>
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
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                        <tr>
                            {[
                                { label: 'Creative Name (Smart)', key: 'name', align: 'left' },
                                { label: 'Days Active', key: 'daysActive', align: 'center' },
                                { label: 'Spend', key: 'cost', align: 'right' },
                                { label: 'Leads', key: 'leads', align: 'right' },
                                { label: 'CPL', key: 'cpl', align: 'right' },
                                { label: 'AI Recommendation', key: 'rec.action', align: 'center' } // Sorting by rec action string
                            ].map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => requestSort(col.key)}
                                    className={`px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
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
                        {sortedCreatives.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-700">
                                    {row.name}
                                    <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate max-w-xs">{row.rawName}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.daysActive < 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {row.daysActive} Days
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">฿{row.cost.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">{row.leads}</td>
                                <td className="px-6 py-4 text-right font-bold">฿{row.cpl.toFixed(0)}</td>
                                <td className="px-6 py-4 text-center">
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${row.rec.color}`}>
                                        {row.rec.icon && <row.rec.icon className="w-3.5 h-3.5" />}
                                        {row.rec.action}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">{row.rec.reason}</div>
                                </td>
                            </tr>
                        ))}
                        {sortedCreatives.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                                    No creatives found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CreativeAnalysis;
