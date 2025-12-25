import React, { useMemo, useState } from 'react';
import { FlaskConical, TrendingUp, AlertTriangle, Info, Filter, Layers, Download } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useExcelExport } from '../hooks/useExcelExport';

const OptimizationLabPage = () => {
    const { appendData, targetCpl } = useData();
    const { exportToExcel } = useExcelExport();
    const [productFilter, setProductFilter] = useState('All');
    const [groupBy, setGroupBy] = useState('Creative'); // 'Creative' | 'Product'

    // Extract Unique Products for Filter
    const products = useMemo(() => {
        if (!appendData) return ['All'];
        const unique = new Set(appendData.map(d => d.Product).filter(Boolean));
        return ['All', ...Array.from(unique).sort()];
    }, [appendData]);

    // --- LOGIC: Matrix Data ---
    const matrixData = useMemo(() => {
        if (!appendData || appendData.length === 0) return { rows: [], cols: [], matrix: {} };

        const rows = new Set(); // Can be Creatives or Products
        const cols = new Set(); // Audiences
        const matrix = {}; // Key: "RowID|ColID" -> { cost, leads, ... }

        appendData.forEach(row => {
            // 1. Filter
            if (productFilter !== 'All' && row.Product !== productFilter) return;

            // 2. Determine Row Entity
            const rowKey = groupBy === 'Product' ? (row.Product || 'Unknown') : (row.Creative || 'Unknown');
            const colKey = row.Category_Normalized || 'Unknown';

            rows.add(rowKey);
            cols.add(colKey);

            const key = `${rowKey}|${colKey}`;
            if (!matrix[key]) {
                matrix[key] = { cost: 0, leads: 0 };
            }
            matrix[key].cost += parseFloat(row.Cost || 0);
            matrix[key].leads += parseFloat(row.Leads || 0);
        });

        // Convert to Arrays & Sort
        // Sort Rows by Total Spend
        const sortedRows = Array.from(rows).sort((a, b) => {
            const spendA = Object.keys(matrix).filter(k => k.startsWith(a + '|')).reduce((acc, k) => acc + matrix[k].cost, 0);
            const spendB = Object.keys(matrix).filter(k => k.startsWith(b + '|')).reduce((acc, k) => acc + matrix[k].cost, 0);
            return spendB - spendA;
        });

        const sortedCols = Array.from(cols).sort();

        return { rows: sortedRows, cols: sortedCols, matrix };
    }, [appendData, productFilter, groupBy]);

    // Helper to get Color
    const getCellColor = (cost, leads) => {
        if (cost === 0) return 'bg-slate-50';
        if (leads === 0) {
            return cost > (targetCpl || 300) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400';
        }

        const cpl = cost / leads;
        const target = targetCpl || 300; // Fallback

        if (cpl < target * 0.8) return 'bg-emerald-100 text-emerald-700 font-bold'; // Winner
        if (cpl < target * 1.2) return 'bg-blue-50 text-blue-700'; // OK
        if (cpl < target * 1.5) return 'bg-amber-50 text-amber-700'; // Warning
        return 'bg-rose-100 text-rose-700'; // Expensive
    };

    // Handle Export
    const handleExport = () => {
        if (matrixData.rows.length === 0) return;

        const exportData = matrixData.rows.map(rowId => {
            const row = { [groupBy]: rowId };
            matrixData.cols.forEach(colId => {
                const key = `${rowId}|${colId}`;
                const data = matrixData.matrix[key];
                if (data) {
                    const cpl = data.leads > 0 ? (data.cost / data.leads).toFixed(0) : 0;
                    row[`${colId} (Leads)`] = data.leads;
                    row[`${colId} (CPL)`] = cpl > 0 ? cpl : '-';
                } else {
                    row[`${colId} (Leads)`] = 0;
                    row[`${colId} (CPL)`] = '-';
                }
            });
            return row;
        });

        exportToExcel(exportData, `Optimization_Matrix_${groupBy}`);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FlaskConical className="w-6 h-6 text-indigo-600" />
                        Optimization Lab
                    </h2>
                    <p className="text-slate-500 mt-1">Experimental views to find hidden opportunities.</p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Export Info */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg shadow-sm font-semibold text-sm transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>

                    {/* Product Filter */}
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={productFilter}
                            onChange={(e) => setProductFilter(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
                        >
                            {products.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Grouping Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setGroupBy('Product')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${groupBy === 'Product' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layers className="w-3 h-3" />
                            By Product
                        </button>
                        <button
                            onClick={() => setGroupBy('Creative')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${groupBy === 'Creative' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layers className="w-3 h-3" />
                            By Creative
                        </button>
                    </div>
                </div>
            </div>

            {/* Matrix Card */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Performance Matrix: {groupBy} vs Audience
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-200"></div>Cheap</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-200"></div>Expensive</div>
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 text-left font-bold text-slate-500 border-b border-slate-200 bg-slate-50 min-w-[400px] sticky left-0 z-20">
                                    {groupBy} \ Audience
                                </th>
                                {matrixData.cols.map(colId => (
                                    <th key={colId} className="p-3 font-bold text-slate-600 border-b border-r border-slate-200 bg-slate-50 min-w-[120px] whitespace-nowrap">
                                        {colId}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {matrixData.rows.map(rowId => (
                                <tr key={rowId} className="hover:bg-slate-50/50">
                                    <td className="p-3 text-left font-bold text-slate-700 border-r border-slate-200 bg-white sticky left-0 z-10 truncate max-w-[400px]" title={rowId}>
                                        {rowId}
                                    </td>
                                    {matrixData.cols.map(colId => {
                                        const key = `${rowId}|${colId}`;
                                        const data = matrixData.matrix[key];

                                        if (!data || data.cost < 10) return <td key={colId} className="p-2 border-r border-slate-100 text-slate-300">-</td>;

                                        const cpl = data.leads > 0 ? data.cost / data.leads : 0;
                                        return (
                                            <td key={colId} className={`p-2 border-r border-slate-100 transition-colors ${getCellColor(data.cost, data.leads)}`}>
                                                <div className="flex flex-col items-center">
                                                    {data.leads > 0 ? (
                                                        <>
                                                            <span>฿{cpl.toFixed(0)}</span>
                                                            <span className="text-[10px] opacity-70">({data.leads})</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px]">฿{data.cost.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OptimizationLabPage;
