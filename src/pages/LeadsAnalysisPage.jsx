import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { normalizeProduct, DAY_NAMES } from '../utils/formatters';
import { Calendar, Filter, Download, BarChart2, Layers } from 'lucide-react';
import { useExcelExport } from '../hooks/useExcelExport';
import DateRangePicker from '../components/common/DateRangePicker';

const LeadsAnalysisPage = () => {
    const { appendData, sentData, telesalesData, dateRange, setDateRange } = useData();
    const { exportToExcel } = useExcelExport();

    // View State
    const [viewMode, setViewMode] = useState('LEADS_META'); // Options: LEADS_META, COST_META, CPL_META, LEADS_SENT, CPL_SENT, LEADS_TL, CPL_TL
    const [breakdown, setBreakdown] = useState('Day'); // Options: Day, Week

    // Helper: Get Week Info
    const getWeekInfo = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { id: 'Unknown', label: 'Unknown' };
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
        return {
            id: `${d.getFullYear()}-W${weekNum}`,
            label: `Week ${weekNum} (${d.getFullYear()})`
        };
    };

    // --- LOGIC: Process Data ---
    const { tableData, columns, grandTotal } = useMemo(() => {
        const inputDates = dateRange.start && dateRange.end ? dateRange : { start: '2000-01-01', end: '2099-12-31' };

        // 1. Identify all Unique Products and Dates within Range
        const productsSet = new Set();
        const rowMap = new Map(); // Key: Date (or WeekID), Value: { dateLabel, metrics: { ProdA: { ...metrics } } }

        // Helper to init row
        const getRow = (dateStr) => {
            let rowKey = dateStr;
            let rowLabel = dateStr;

            if (breakdown === 'Week') {
                const info = getWeekInfo(dateStr);
                rowKey = info.id;
                rowLabel = info.label;
            }

            if (!rowMap.has(rowKey)) {
                rowMap.set(rowKey, {
                    key: rowKey,
                    label: rowLabel,
                    products: {}, // { 'ProductA': { leadsMeta: 0, cost: 0, ... } }
                    total: { leadsMeta: 0, cost: 0, leadsSent: 0, leadsTL: 0 }
                });
            }
            return rowMap.get(rowKey);
        };

        // Helper to update metrics
        const updateMetric = (dateStr, rawProduct, type, value) => {
            if (!dateStr || dateStr < inputDates.start || dateStr > inputDates.end) return;
            const product = normalizeProduct(rawProduct);
            productsSet.add(product);

            const row = getRow(dateStr);
            if (!row.products[product]) {
                row.products[product] = { leadsMeta: 0, cost: 0, leadsSent: 0, leadsTL: 0 };
            }

            const val = parseFloat(value) || 0;
            const metrics = row.products[product];

            if (type === 'meta_lead') {
                metrics.leadsMeta += val;
                row.total.leadsMeta += val;
            } else if (type === 'meta_cost') {
                metrics.cost += val;
                row.total.cost += val;
            } else if (type === 'sent_lead') {
                metrics.leadsSent += val;
                row.total.leadsSent += val;
            } else if (type === 'tl_lead') {
                metrics.leadsTL += val;
                row.total.leadsTL += val;
            }
        };

        // 2. Process Datasets
        appendData.forEach(row => {
            updateMetric(row.Day, row.Product, 'meta_lead', row.Leads);
            updateMetric(row.Day, row.Product, 'meta_cost', row.Cost);
        });

        sentData.forEach(row => {
            updateMetric(row.Day, row.Product_Normalized, 'sent_lead', row.Leads_Sent);
        });

        telesalesData.forEach(row => {
            // Unify product key from TL data
            const pName = row.Product || row.Product_Target || row.Product_Normalized || 'Unknown';
            updateMetric(row.Day, pName, 'tl_lead', row.Leads_TL);
        });

        // 3. Sort Columns & Rows
        const sortedProducts = Array.from(productsSet).sort();
        const sortedRows = Array.from(rowMap.values()).sort((a, b) => a.key.localeCompare(b.key));

        // 4. Calculate Column Totals (Grand Totals)
        const totalRow = {
            label: 'GRAND TOTAL',
            products: {},
            total: { leadsMeta: 0, cost: 0, leadsSent: 0, leadsTL: 0 }
        };

        sortedProducts.forEach(p => {
            totalRow.products[p] = { leadsMeta: 0, cost: 0, leadsSent: 0, leadsTL: 0 };
        });

        sortedRows.forEach(row => {
            // Sum per product
            Object.entries(row.products).forEach(([p, m]) => {
                const t = totalRow.products[p];
                if (t) {
                    t.leadsMeta += m.leadsMeta;
                    t.cost += m.cost;
                    t.leadsSent += m.leadsSent;
                    t.leadsTL += m.leadsTL;
                }
            });
            // Sum total
            totalRow.total.leadsMeta += row.total.leadsMeta;
            totalRow.total.cost += row.total.cost;
            totalRow.total.leadsSent += row.total.leadsSent;
            totalRow.total.leadsTL += row.total.leadsTL;
        });

        return {
            tableData: sortedRows,
            columns: sortedProducts,
            grandTotal: totalRow
        };

    }, [appendData, sentData, telesalesData, dateRange, breakdown]);

    // --- RENDER HELPERS ---
    const getValue = (metrics) => {
        if (!metrics) return 0;
        switch (viewMode) {
            case 'LEADS_META': return metrics.leadsMeta;
            case 'COST_META': return metrics.cost;
            case 'CPL_META': return metrics.leadsMeta > 0 ? metrics.cost / metrics.leadsMeta : 0;
            case 'LEADS_SENT': return metrics.leadsSent;
            case 'CPL_SENT': return metrics.leadsSent > 0 ? metrics.cost / metrics.leadsSent : 0;
            case 'LEADS_TL': return metrics.leadsTL;
            case 'CPL_TL': return metrics.leadsTL > 0 ? metrics.cost / metrics.leadsTL : 0;
            default: return 0;
        }
    };

    const formatValue = (val) => {
        const num = Math.round(val);
        if (viewMode.includes('CPL') || viewMode.includes('COST')) {
            return `฿${num.toLocaleString()}`;
        }
        return num.toLocaleString();
    };

    const getViewTitle = () => {
        switch (viewMode) {
            case 'LEADS_META': return 'Meta Leads';
            case 'COST_META': return 'Meta Cost';
            case 'CPL_META': return 'CPL Meta';
            case 'LEADS_SENT': return 'Leads Sent';
            case 'CPL_SENT': return 'CPL (Sent)';
            case 'LEADS_TL': return 'TL Leads';
            case 'CPL_TL': return 'CPL TL';
            default: return '';
        }
    };

    const getCellColor = (val, isTotal = false) => {
        if (val === 0) return 'text-gray-300';
        if (viewMode.includes('CPL') || viewMode.includes('COST')) {
            if (viewMode.includes('CPL') && val > 500) return 'text-red-600 font-bold'; // Only red for high CPL
            return isTotal ? 'text-indigo-700 font-bold' : 'text-gray-900';
        }
        return isTotal ? 'text-indigo-700 font-bold' : 'text-gray-900';
    };

    const handleExport = () => {
        const rows = tableData.map(row => {
            const rowObj = { Date: row.label };
            columns.forEach(prod => {
                rowObj[prod] = getValue(row.products[prod]);
            });
            rowObj['TOTAL'] = getValue(row.total);
            return rowObj;
        });

        // Add Grand Total Row
        const totalObj = { Date: 'GRAND TOTAL' };
        columns.forEach(prod => {
            totalObj[prod] = getValue(grandTotal.products[prod]);
        });
        totalObj['TOTAL'] = getValue(grandTotal.total);
        rows.push(totalObj);

        exportToExcel(rows, `Leads_Analysis_${viewMode}`);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Controls */}
            <div className="glass-card p-6 rounded-2xl flex flex-wrap gap-6 items-center justify-between">
                <div className="flex items-center gap-3">
                    <Layers className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-800">Leads Analysis</h2>
                </div>

                {/* Date Picker */}
                <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onChange={setDateRange}
                />

                {/* View Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg gap-1 overflow-x-auto max-w-full">
                    {[
                        { id: 'LEADS_META', label: 'Meta Leads' },
                        { id: 'COST_META', label: 'Meta Cost' },
                        { id: 'CPL_META', label: 'Meta CPL' },
                        { id: 'LEADS_SENT', label: 'Sent Leads' },
                        { id: 'CPL_SENT', label: 'Sent CPL' },
                        { id: 'LEADS_TL', label: 'TL Leads' },
                        { id: 'CPL_TL', label: 'TL CPL' },
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => setViewMode(btn.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-all ${viewMode === btn.id
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Breakdown Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                    {['Day', 'Week'].map(b => (
                        <button
                            key={b}
                            onClick={() => setBreakdown(b)}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${breakdown === b
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {b}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export
                </button>
            </div>

            {/* Pivot Table */}
            <div className="glass-card overflow-hidden rounded-xl border border-gray-100 shadow-lg">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-r border-gray-200 w-48 shadow-sm">
                                    {breakdown === 'Week' ? 'Week' : 'Date'}
                                </th>
                                {columns.map(prod => (
                                    <th key={prod} className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                                        {prod.replace('SAVING-', '').replace('LIFE-', '').replace('HEALTH-', '')}
                                    </th>
                                ))}
                                <th className="px-6 py-4 text-right text-xs font-black text-indigo-700 uppercase tracking-wider sticky right-0 bg-indigo-50/50 z-10 border-l border-indigo-100">
                                    TOTAL
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {tableData.map((row, idx) => (
                                <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-gray-100">
                                        {row.label}
                                    </td>
                                    {columns.map(prod => (
                                        <td key={`${row.key}-${prod}`} className={`px-4 py-3 text-right text-sm ${getCellColor(getValue(row.products[prod]))}`}>
                                            {formatValue(getValue(row.products[prod]))}
                                        </td>
                                    ))}
                                    <td className={`px-6 py-3 whitespace-nowrap text-right text-sm font-bold border-l border-indigo-50 sticky right-0 bg-indigo-50/30 z-10 ${getCellColor(getValue(row.total), true)}`}>
                                        {formatValue(getValue(row.total))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-indigo-50/80 font-bold border-t-2 border-indigo-100">
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-900 sticky left-0 bg-indigo-100 z-20 border-r border-indigo-200 shadow-sm">
                                    GRAND TOTAL
                                </td>
                                {columns.map(prod => (
                                    <td key={`total-${prod}`} className="px-4 py-4 text-right text-sm text-indigo-900">
                                        {formatValue(getValue(grandTotal.products[prod] || 0))}
                                    </td>
                                ))}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-indigo-900 sticky right-0 bg-indigo-200 z-20 border-l border-indigo-200">
                                    {formatValue(getValue(grandTotal.total))}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Legend / Info */}
            <div className="flex justify-end text-xs text-gray-400 px-2 gap-4">
                <span>* Rows filtered by selected date range</span>
                <span>* CPL calculated as (Total Cost / Leads)</span>
            </div>
        </div>
    );
};

export default LeadsAnalysisPage;
