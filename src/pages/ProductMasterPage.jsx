import React, { useState, useMemo } from 'react';
import {
    Calendar, ChevronDown, ChevronRight, DollarSign,
    TrendingUp, Filter, Download, AlertCircle, BarChart2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { normalizeProduct, DAY_NAMES } from '../utils/formatters';
import { useExcelExport } from '../hooks/useExcelExport';

const ProductMasterPage = () => {
    const { appendData, sentData, targetData, telesalesData, dateRange, setDateRange } = useData();
    const [expandedProducts, setExpandedProducts] = useState({});
    const [selectedProducts, setSelectedProducts] = useState([]); // Empty = All, or use ['All'] logic. Let's use internal logic: Empty array = All? Or UI shows 'All'. Let's default to specific logic.
    // Better: Helper to check if "All" is selected or array is empty.
    const isAllSelected = selectedProducts.length === 0;
    // New: Target Date Range separate from View Date Range
    const [targetDateRange, setTargetDateRange] = useState({ start: '', end: '' });
    const { exportToExcel } = useExcelExport();

    // --- LOGIC: Process Data ---
    const { productGroups, grandTotals, uniqueProducts } = useMemo(() => {
        const groups = {}; // { 'Product A': { total: {...}, days: { '2025-12-01': {...} } } }
        const totals = {
            spend: 0,
            leadsMeta: 0,
            leadsSent: 0,
            leadsTL: 0,
            target: 0, // New
            revenue: 0,
            profit: 0
        };
        const inputDates = dateRange.start && dateRange.end ? dateRange : { start: '2000-01-01', end: '2099-12-31' };

        // Determine Target Calculation Days
        // If Target Date Range is set, use it. Otherwise, use View Date Range.
        const tStart = targetDateRange.start ? new Date(targetDateRange.start) : (dateRange.start ? new Date(dateRange.start) : new Date());
        const tEnd = targetDateRange.end ? new Date(targetDateRange.end) : (dateRange.end ? new Date(dateRange.end) : new Date());

        // Calculate days difference (inclusive)
        const timeDiff = tEnd.getTime() - tStart.getTime();
        const targetDays = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

        // Helper to get group
        const getGroup = (prodName) => {
            const normalized = normalizeProduct(prodName);
            if (!groups[normalized]) {
                groups[normalized] = {
                    name: normalized,
                    total: {
                        spend: 0, leadsMeta: 0, leadsSent: 0, leadsTL: 0, revenue: 0, profit: 0,
                        cplMeta: 0, cplSent: 0, cplTL: 0, roi: 0,
                        target: 0, missing: 0, achievement: 0 // New
                    },
                    days: {}
                };
            }
            return groups[normalized];
        };

        // Helper to get day
        const getDay = (group, dayStr) => {
            if (!group.days[dayStr]) {
                group.days[dayStr] = {
                    date: dayStr,
                    spend: 0, leadsMeta: 0, leadsSent: 0, leadsTL: 0, revenue: 0, profit: 0
                };
            }
            return group.days[dayStr];
        };

        // 1. Process Append Data (Spend, Meta Leads)
        appendData.forEach(row => {
            if (!row.Product || !row.Day) return;
            if (row.Day < inputDates.start || row.Day > inputDates.end) return;

            const group = getGroup(row.Product);
            const day = getDay(group, row.Day);

            const cost = parseFloat(row.Cost) || 0;
            const leads = parseFloat(row.Leads) || 0;

            day.spend += cost;
            day.leadsMeta += leads;

            group.total.spend += cost;
            group.total.leadsMeta += leads;

            totals.spend += cost;
            totals.leadsMeta += leads;
        });

        // 2. Process Sent Data (Leads Sent)
        sentData.forEach(row => {
            if (!row.Product_Normalized || !row.Day) return;
            if (row.Day < inputDates.start || row.Day > inputDates.end) return;

            const group = getGroup(row.Product_Normalized);
            const day = getDay(group, row.Day);

            const sent = parseFloat(row.Leads_Sent) || 0;

            day.leadsSent += sent;
            group.total.leadsSent += sent;
            totals.leadsSent += sent;
        });


        // 3. Process Telesales Data (Leads_TL)
        telesalesData.forEach(row => {
            if (!row.Day) return;
            // Normalize Product: Try 'Product', 'Product_Target', etc.
            const pName = row.Product || row.Product_Target || row.Product_Normalized || 'Unknown';
            // Filter by date
            if (row.Day < inputDates.start || row.Day > inputDates.end) return;

            const group = getGroup(pName);
            const day = getDay(group, row.Day);

            const tl = parseFloat(row.Leads_TL) || 0; // Assuming column is Leads_TL

            day.leadsTL += tl;
            group.total.leadsTL += tl;
            totals.leadsTL += tl;
        });

        // 4. Process Revenue & Profit AND TARGETS
        // Build map of Target Sell Price by Product & Monthly Target
        const priceMap = {};
        const targetMap = {}; // Normalized Product -> Monthly Target

        targetData.forEach(t => {
            if (t.Product_Target) {
                const norm = normalizeProduct(t.Product_Target);
                if (t.Target_SellPrice) {
                    priceMap[norm] = parseFloat(t.Target_SellPrice) || 0;
                }
                if (t.Target_Lead_Sent) { // Using Target_Lead_Sent as the main Volume Target
                    targetMap[norm] = parseFloat(t.Target_Lead_Sent) || 0;
                }
            }
        });

        // 4. Final Calculations per Day & Group
        Object.values(groups).forEach(group => {
            const sellPrice = priceMap[group.name] || 0;
            const monthlyTarget = targetMap[group.name] || 0;

            // Calculate Target for the selected range (Pro-rated)
            // User Update: Group Total must be FULL Monthly Target.
            const computedTarget = monthlyTarget;

            // Assign to group total
            group.total.target = computedTarget;

            // Calculate Daily Computed Metrics
            // User Update: Daily Target = Full Target / Days in Target Calculation Range
            const dailyTarget = targetDays > 0 ? monthlyTarget / targetDays : 0;

            Object.values(group.days).forEach(day => {
                day.revenue = day.leadsTL * sellPrice;
                day.profit = day.revenue - day.spend;
                day.roi = day.spend > 0 ? (day.profit / day.spend) * 100 : 0;

                day.cplMeta = day.leadsMeta > 0 ? day.spend / day.leadsMeta : 0;
                day.cplSent = day.leadsSent > 0 ? day.spend / day.leadsSent : 0;
                day.cplTL = day.leadsTL > 0 ? day.spend / day.leadsTL : 0;

                // Daily Target
                day.target = dailyTarget;
                day.missing = day.target - day.leadsTL;
                day.achievement = day.target > 0 ? (day.leadsTL / day.target) * 100 : 0;

                totals.revenue += day.revenue;
                totals.profit += day.profit;
            });

            // Calculate Group Computed Metrics
            group.total.revenue = group.total.leadsTL * sellPrice;
            group.total.profit = group.total.revenue - group.total.spend;
            group.total.roi = group.total.spend > 0 ? (group.total.profit / group.total.spend) * 100 : 0;

            group.total.cplMeta = group.total.leadsMeta > 0 ? group.total.spend / group.total.leadsMeta : 0;
            group.total.cplSent = group.total.leadsSent > 0 ? group.total.spend / group.total.leadsSent : 0;
            group.total.cplTL = group.total.leadsTL > 0 ? group.total.spend / group.total.leadsTL : 0;

            // Target Metrics for Group
            group.total.missing = group.total.target - group.total.leadsTL;
            group.total.achievement = group.total.target > 0 ? (group.total.leadsTL / group.total.target) * 100 : 0;

            totals.target += group.total.target;
        });

        // Filter Groups
        let resultGroups = Object.values(groups);
        if (selectedProducts.length > 0) {
            resultGroups = resultGroups.filter(g => selectedProducts.includes(g.name));
        }

        // Sort Groups
        resultGroups.sort((a, b) => a.name.localeCompare(b.name));

        // RECACULATE GRAND TOTALS based on Filtered Result
        const filteredTotals = resultGroups.reduce((acc, group) => {
            acc.spend += group.total.spend;
            acc.leadsMeta += group.total.leadsMeta;
            acc.leadsSent += group.total.leadsSent;
            acc.leadsTL += group.total.leadsTL;
            acc.target += group.total.target;
            acc.revenue += group.total.revenue;
            acc.profit += group.total.profit;
            return acc;
        }, { spend: 0, leadsMeta: 0, leadsSent: 0, leadsTL: 0, target: 0, revenue: 0, profit: 0 });

        const derivedTotals = {
            ...filteredTotals,
            cplMeta: filteredTotals.leadsMeta > 0 ? filteredTotals.spend / filteredTotals.leadsMeta : 0,
            cplSent: filteredTotals.leadsSent > 0 ? filteredTotals.spend / filteredTotals.leadsSent : 0,
            cplTL: filteredTotals.leadsTL > 0 ? filteredTotals.spend / filteredTotals.leadsTL : 0,
            roi: filteredTotals.spend > 0 ? (filteredTotals.profit / filteredTotals.spend) * 100 : 0,
            missing: filteredTotals.target - filteredTotals.leadsTL,
            achievement: filteredTotals.target > 0 ? (filteredTotals.leadsTL / filteredTotals.target) * 100 : 0
        };

        return {
            productGroups: resultGroups,
            grandTotals: derivedTotals,
            uniqueProducts: Object.keys(groups).sort(),
            targetDays
        };

    }, [appendData, sentData, targetData, telesalesData, dateRange, selectedProducts, targetDateRange]);

    // --- UI Helpers ---
    const toggleRow = (prodName) => {
        setExpandedProducts(prev => ({
            ...prev,
            [prodName]: !prev[prodName]
        }));
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        // Format: "07 Dec 2025 (Sun)"
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const year = d.getFullYear();
        const dow = DAY_NAMES[d.getDay()].substring(0, 3);
        return `${day} ${month} ${year} (${dow})`;
    };

    const handleExport = () => {
        // Flatten for export
        const rows = [];
        productGroups.forEach(g => {
            rows.push({
                Type: 'Product',
                Date: 'Total',
                Product: g.name,
                Spend: g.total.spend,
                Leads_META: g.total.leadsMeta,
                CPL_META: g.total.cplMeta,
                Leads_Sent: g.total.leadsSent,
                CPL_Sent: g.total.cplSent,
                Leads_TL: g.total.leadsTL,
                CPL_TL: g.total.cplTL,
                Target: g.total.target,
                Missing: g.total.missing,
                Achievement: g.total.achievement,
                Revenue: g.total.revenue,
                Profit: g.total.profit,
                ROI: g.total.roi
            });
            Object.values(g.days).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
                rows.push({
                    Type: 'Daily',
                    Date: d.date,
                    Product: g.name,
                    Spend: d.spend,
                    Leads_META: d.leadsMeta,
                    CPL_META: d.cplMeta,
                    Leads_Sent: d.leadsSent,
                    CPL_Sent: d.cplSent,
                    Leads_TL: d.leadsTL,
                    CPL_TL: d.cplTL,
                    Target: d.target,
                    Missing: d.missing,
                    Achievement: d.achievement,
                    Revenue: d.revenue,
                    Profit: d.profit,
                    ROI: d.roi
                });
            });
        });
        exportToExcel(rows, 'Product_Master_Report');
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-12 animate-fade-in">
            {/* Navbar Placeholder (Already in MainLayout, but title here) */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
                <div className="flex items-center text-indigo-700 font-bold text-xl">
                    <BarChart2 className="mr-2 w-6 h-6" />
                    Product Master Report
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500 hidden sm:inline">Last updated: Today</span>
                    <button
                        onClick={handleExport}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">View Data Range</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={dateRange.start || ''}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={dateRange.end || ''}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* New Target Date Filter */}
                    <div>
                        <label className="block text-sm font-medium text-indigo-700 mb-1 flex items-center gap-1">
                            Target Date Range
                            <span className="text-xs font-normal text-indigo-500">(For Calculation)</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                className="border border-indigo-200 bg-indigo-50/30 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-indigo-700"
                                value={targetDateRange.start || dateRange.start || ''}
                                onChange={(e) => setTargetDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-indigo-300">-</span>
                            <input
                                type="date"
                                className="border border-indigo-200 bg-indigo-50/30 rounded-md px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 text-indigo-700"
                                value={targetDateRange.end || dateRange.end || ''}
                                onChange={(e) => setTargetDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>
                    {/* Filter: Product (Multi-Select) */}
                    <div className="relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors min-w-[180px]"
                        >
                            <span>
                                {selectedProducts.length === 0
                                    ? 'Select Products...'
                                    : selectedProducts.length === uniqueProducts.length
                                        ? 'All Products Selected'
                                        : `${selectedProducts.length} Product(s)`}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>

                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col max-h-[400px]">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Products</span>
                                        <button
                                            onClick={handleSelectAll}
                                            className="text-xs text-indigo-600 font-bold hover:underline"
                                        >
                                            {selectedProducts.length === uniqueProducts.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                        {uniqueProducts.map(prod => (
                                            <label key={prod} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    checked={selectedProducts.includes(prod)}
                                                    onChange={() => handleProductToggle(prod)}
                                                />
                                                <span className="text-sm text-slate-700 truncate">{prod}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex-grow"></div>
                    <div className="flex space-x-4">
                        <div className="px-4 py-2 bg-green-50 rounded-lg border border-green-200 shadow-sm">
                            <div className="text-xs text-green-600 font-bold uppercase">Total Profit</div>
                            <div className="text-lg font-bold text-green-700">
                                {grandTotals.profit >= 0 ? '+' : ''}฿{grandTotals.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                            <div className="text-xs text-blue-600 font-bold uppercase">Avg ROI</div>
                            <div className="text-lg font-bold text-blue-700">{grandTotals.roi.toFixed(0)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="bg-white shadow-lg overflow-hidden sm:rounded-lg border border-gray-200">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-64 shadow-sm border-r border-gray-200">Product / Date</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider bg-gray-100 border-l border-gray-200">Spend</th>

                                    {/* META GROUP */}
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wider border-l border-gray-200 bg-blue-50/50">Leads_META</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50">CPL_META</th>

                                    {/* SENT GROUP */}
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-yellow-700 uppercase tracking-wider border-l border-gray-200 bg-yellow-50/50">Leads Sent</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-yellow-700 uppercase tracking-wider bg-yellow-50/50">CPL (Sent)</th>

                                    {/* TELESALES GROUP (Placeholder) */}
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-purple-700 uppercase tracking-wider border-l border-gray-200 bg-purple-50/50">Leads_TL</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-purple-700 uppercase tracking-wider bg-purple-50/50">CPL_TL</th>

                                    {/* TARGET ANALYSIS (New) */}
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-indigo-700 uppercase tracking-wider border-l border-gray-200 bg-indigo-50/50">Target</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/50">Missing</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/50">% Achv</th>

                                    {/* BUSINESS OUTCOME */}
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider border-l border-gray-200">Revenue</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-green-600 uppercase tracking-wider">Profit</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">ROI</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {productGroups.map((group) => (
                                    <React.Fragment key={group.name}>
                                        {/* PARENT ROW */}
                                        <tr
                                            className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors group"
                                            onClick={() => toggleRow(group.name)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-sm group-hover:bg-gray-100 transition-colors">
                                                <div className="flex items-center">
                                                    <ChevronRight
                                                        className={`text-gray-400 mr-3 transition-transform duration-200 w-5 h-5 ${expandedProducts[group.name] ? 'transform rotate-90' : ''}`}
                                                    />
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{group.name}</div>
                                                        <div className="text-xs text-gray-500">Total (Selected)</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-bold bg-gray-100 border-l border-gray-200 group-hover:bg-gray-200 transaction-colors">
                                                ฿{group.total.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>

                                            {/* META */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-blue-700 font-semibold border-l border-gray-200 bg-blue-50/30">
                                                {group.total.leadsMeta.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-blue-700 bg-blue-50/30">
                                                ฿{group.total.cplMeta.toFixed(0)}
                                            </td>

                                            {/* SENT */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-yellow-800 font-bold border-l border-gray-200 bg-yellow-50/30">
                                                {group.total.leadsSent.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-yellow-800 bg-yellow-50/30">
                                                ฿{group.total.cplSent.toFixed(0)}
                                            </td>

                                            {/* TL */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-purple-800 font-bold border-l border-gray-200 bg-purple-50/30">
                                                {group.total.leadsTL.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-purple-800 bg-purple-50/30">
                                                ฿{group.total.cplTL.toFixed(0)}
                                            </td>

                                            {/* TARGET ANALYSIS */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-indigo-800 font-bold border-l border-gray-200 bg-indigo-50/30">
                                                {group.total.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className={`px-4 py-4 whitespace-nowrap text-right text-sm font-bold bg-indigo-50/30 ${group.total.missing > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                {group.total.missing > 0 ? '-' : '+'}{Math.abs(group.total.missing).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-indigo-800 font-bold bg-indigo-50/30 relative">
                                                {group.total.achievement.toFixed(0)}%
                                                <div className="absolute bottom-1 left-2 right-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${group.total.achievement >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(group.total.achievement, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </td>

                                            {/* OUTCOME */}
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 border-l border-gray-200">
                                                ฿{group.total.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className={`px-4 py-4 whitespace-nowrap text-right text-sm font-bold ${group.total.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {group.total.profit >= 0 ? '+' : ''}฿{group.total.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className={`px-4 py-4 whitespace-nowrap text-right text-sm font-bold ${group.total.roi >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                                                {group.total.roi.toFixed(0)}%
                                            </td>
                                        </tr>

                                        {/* CHILD ROWS (DAILY) */}
                                        {expandedProducts[group.name] && Object.values(group.days)
                                            .sort((a, b) => a.date.localeCompare(b.date)) // Sort Ascending Date
                                            .map(day => (
                                                <tr key={day.date} className="bg-white hover:bg-gray-50 transition-colors animate-fade-in-down">
                                                    <td className="px-6 py-2 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100 text-sm text-gray-500 pl-12 border-l-4 border-l-transparent hover:border-l-indigo-400 shadow-sm">
                                                        {formatDate(day.date)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600 border-l border-gray-100">
                                                        {day.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>

                                                    {/* META */}
                                                    <td className="px-4 py-2 text-right text-sm text-blue-600 border-l border-gray-100 bg-blue-50/10">
                                                        {day.leadsMeta}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-blue-600 bg-blue-50/10">
                                                        {day.cplMeta.toFixed(0)}
                                                    </td>

                                                    {/* SENT */}
                                                    <td className="px-4 py-2 text-right text-sm text-yellow-700 border-l border-gray-100 bg-yellow-50/10 font-medium">
                                                        {day.leadsSent}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-yellow-700 bg-yellow-50/10">
                                                        {day.cplSent.toFixed(0)}
                                                    </td>

                                                    {/* TL */}
                                                    <td className="px-4 py-2 text-right text-sm text-purple-700 border-l border-gray-100 bg-purple-50/10">
                                                        {day.leadsTL}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-purple-700 bg-purple-50/10">
                                                        {day.cplTL.toFixed(0)}
                                                    </td>

                                                    {/* TARGET */}
                                                    <td className="px-4 py-2 text-right text-sm text-indigo-600 border-l border-gray-100 bg-indigo-50/10">
                                                        {day.target.toFixed(1)}
                                                    </td>
                                                    <td className={`px-4 py-2 text-right text-sm bg-indigo-50/10 ${day.missing > 0 ? 'text-red-400' : 'text-green-500'}`}>
                                                        {day.missing > 0 ? '-' : ''}{Math.abs(day.missing).toFixed(0)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-sm text-indigo-600 bg-indigo-50/10">
                                                        {day.achievement.toFixed(0)}%
                                                    </td>

                                                    {/* OUTCOME */}
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600 border-l border-gray-100">
                                                        {day.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className={`px-4 py-2 text-right text-sm ${day.profit >= 0 ? 'text-green-600' : 'text-red-400'}`}>
                                                        {day.profit >= 0 ? '+' : ''}{day.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className={`px-4 py-2 text-right text-sm ${day.roi >= 0 ? 'text-gray-600' : 'text-red-400'}`}>
                                                        {day.roi.toFixed(0)}%
                                                    </td>
                                                </tr>
                                            ))
                                        }
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 border-t border-gray-200">
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-gray-100 z-10 text-sm font-bold text-gray-900 border-r border-gray-200 shadow-sm">
                                        GRAND TOTAL
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-gray-900 border-l border-gray-200">
                                        ฿{grandTotals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-blue-700 border-l border-gray-200">
                                        {grandTotals.leadsMeta.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-blue-700">
                                        ฿{grandTotals.cplMeta.toFixed(0)}
                                    </td>

                                    <td className="px-4 py-4 text-right text-sm font-bold text-yellow-800 border-l border-gray-200">
                                        {grandTotals.leadsSent.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-yellow-800">
                                        ฿{grandTotals.cplSent.toFixed(0)}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-purple-800 border-l border-gray-200">
                                        {grandTotals.leadsTL.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-purple-800">
                                        ฿{grandTotals.cplTL.toFixed(0)}
                                    </td>

                                    {/* TARGET TOTALS */}
                                    <td className="px-4 py-4 text-right text-sm font-bold text-indigo-700 border-l border-gray-200">
                                        {grandTotals.target.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={`px-4 py-4 text-right text-sm font-bold ${grandTotals.missing > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {grandTotals.missing > 0 ? '-' : '+'}{Math.abs(grandTotals.missing).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-indigo-700">
                                        {grandTotals.achievement.toFixed(0)}%
                                    </td>
                                    <td className="px-4 py-4 text-right text-sm font-bold text-gray-900 border-l border-gray-200">
                                        ฿{grandTotals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={`px-4 py-4 text-right text-sm font-bold ${grandTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {grandTotals.profit >= 0 ? '+' : ''}฿{grandTotals.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </td>
                                    <td className={`px-4 py-4 text-right text-sm font-bold ${grandTotals.roi >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                                        {grandTotals.roi.toFixed(0)}%
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductMasterPage;
