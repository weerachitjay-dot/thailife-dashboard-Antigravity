import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
    ComposedChart, Line, LabelList, ReferenceLine
} from 'recharts';
import { Clock, Sun, Moon, Calendar, TrendingUp, Wallet, ArrowUpDown, RotateCcw } from 'lucide-react';
import { useSortableData } from '../hooks/useSortableData';
import { useData } from '../context/DataContext';
import { DAY_NAMES, normalizeProduct } from '../utils/formatters';

const TimeAnalysisPage = () => {
    const { appendTimeData, targetData, filters, dateRange } = useData();
    const [hourlyFilter, setHourlyFilter] = React.useState('All'); // 'All', 'Daily', 'Carry'

    // --- LOGIC: Classify Daily vs Carry ---
    // Daily: 09:00 - 17:59
    // Carry: 18:00 - 08:59 (Next Day? User said "Carry" is 18:00-08:59, presumably of the same shift or relevant to the next day's processing?)
    // For standard attribution, usually "Carry" means leads that come in AFTER working hours, to be processed NEXT day.
    // But for raw analysis, we just classify them based on timestamp.
    const processedData = useMemo(() => {
        return appendTimeData.map(row => {
            if (!row.Time) return null;

            // Parse Time (Expected standard HH:mm:ss or HH:mm)
            // If it's Excel serial, we might need more logic, but assuming generic CSV Time string for now.
            const [h, m] = row.Time.split(':').map(Number);
            if (isNaN(h)) return null;

            let timeType = 'Daily';
            if (h >= 18 || h < 9) {
                timeType = 'Carry';
            }

            // Process Product normalization
            const normalizedProduct = normalizeProduct(row.Product);

            // Check filters
            if (dateRange.start && row.Day < dateRange.start) return null;
            if (dateRange.end && row.Day > dateRange.end) return null;
            if (filters.product !== 'All' && normalizedProduct !== filters.product) return null;

            // Check Owner/Type via Target Data lookup
            const targetInfo = targetData.find(t => t.Product_Target === normalizedProduct);
            if (filters.owner !== 'All' && targetInfo?.OWNER !== filters.owner) return null;
            if (filters.type !== 'All' && targetInfo?.TYPE !== filters.type) return null;

            return {
                ...row,
                TimeType: timeType,
                NormalizedProduct: normalizedProduct,
                TargetInfo: targetInfo
            };
        }).filter(Boolean);
    }, [appendTimeData, targetData, filters, dateRange]);

    // --- AGGREGATION: By Hour ---
    const hourlyStats = useMemo(() => {
        const hours = Array(24).fill(0).map((_, i) => ({
            hour: i,
            name: `${String(i).padStart(2, '0')}:00`,
            Leads: 0,
            Cost: 0
        }));

        processedData.forEach(d => {
            if (!d.Time) return;
            // Parse Time (Expected standard HH:mm:ss or HH:mm)
            const [h] = d.Time.split(':').map(Number);
            if (!isNaN(h) && h >= 0 && h < 24) {
                const cost = parseFloat(d.Cost) || 0;
                const leads = parseInt(d.Leads) || 0;
                hours[h].Cost += cost;
                hours[h].Leads += leads;
            }
        });

        return hours.map(h => ({
            ...h,
            CPL: h.Leads > 0 ? h.Cost / h.Leads : 0
        }));
    }, [processedData]);

    const filteredHourlyStats = useMemo(() => {
        if (hourlyFilter === 'All') return hourlyStats;
        if (hourlyFilter === 'Daily') {
            return hourlyStats.filter(h => h.hour >= 9 && h.hour < 18);
        }
        if (hourlyFilter === 'Carry') {
            return hourlyStats.filter(h => h.hour >= 18 || h.hour < 9);
        }
        return hourlyStats;
    }, [hourlyStats, hourlyFilter]);

    // --- AGGREGATION: By Day of Week ---
    const dayOfWeekStats = useMemo(() => {
        const days = Array(7).fill(0).map((_, i) => ({
            id: i, name: DAY_NAMES[i],
            Daily_Leads: 0, Carry_Leads: 0, Total_Leads: 0,
            Total_Cost: 0, Daily_Cost: 0, Carry_Cost: 0
        }));

        processedData.forEach(d => {
            const date = new Date(d.Day);
            if (isNaN(date.getTime())) return;
            const dayIdx = date.getDay();

            // FIX: Ensure values are numbers to avoid string concatenation "0" + "100" = "0100"
            const cost = parseFloat(d.Cost) || 0;
            const leads = parseInt(d.Leads) || 0;

            days[dayIdx].Total_Cost += cost;
            days[dayIdx].Total_Leads += leads;

            if (d.TimeType === 'Daily') {
                days[dayIdx].Daily_Leads += leads;
                days[dayIdx].Daily_Cost += cost;
            } else {
                days[dayIdx].Carry_Leads += leads;
                days[dayIdx].Carry_Cost += cost;
            }
        });

        return days.map(d => ({
            ...d,
            CPL: d.Total_Leads > 0 ? d.Total_Cost / d.Total_Leads : 0,
            Daily_CPL: d.Daily_Leads > 0 ? d.Daily_Cost / d.Daily_Leads : 0,
            Carry_CPL: d.Carry_Leads > 0 ? d.Carry_Cost / d.Carry_Leads : 0
        }));
    }, [processedData]);

    const { items: sortedDayStats, requestSort, sortConfig, resetSort } = useSortableData(dayOfWeekStats);

    // --- AGGREGATION: Totals ---
    const totals = useMemo(() => {
        let daily = 0, carry = 0, cost = 0, leads = 0;
        let dailyCost = 0, carryCost = 0;

        processedData.forEach(d => {
            const rowCost = parseFloat(d.Cost) || 0;
            const rowLeads = parseInt(d.Leads) || 0;

            cost += rowCost;
            leads += rowLeads;
            if (d.TimeType === 'Daily') {
                daily += rowLeads;
                dailyCost += rowCost;
            } else {
                carry += rowLeads;
                carryCost += rowCost;
            }
        });

        return {
            daily,
            carry,
            cost,
            leads,
            cpl: leads ? cost / leads : 0,
            dailyCpl: daily ? dailyCost / daily : 0,
            carryCpl: carry ? carryCost / carry : 0
        };
    }, [processedData]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" />
                Time Analysis (Daily vs Carry)
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Row 1: Leads */}
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-600 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-indigo-200 rounded-full text-indigo-700">
                        <Sun className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Daily Leads</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">{totals.daily.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-violet-600 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-violet-200 rounded-full text-violet-700">
                        <Moon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Carry Leads</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">{totals.carry.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-blue-200 rounded-full text-blue-700">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Total Leads</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">{totals.leads.toLocaleString()}</h3>
                    </div>
                </div>

                {/* Row 2: CPL */}
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-400 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Daily CPL</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">฿{totals.dailyCpl.toFixed(0)}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-violet-400 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-violet-100 rounded-full text-violet-600">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Carry CPL</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">฿{totals.carryCpl.toFixed(0)}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-emerald-600 shadow-sm hover:shadow-md transition-all">
                    <div className="p-3 bg-emerald-200 rounded-full text-emerald-700">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-wide">Total CPL</p>
                        <h3 className="text-3xl font-extrabold text-slate-900">฿{totals.cpl.toFixed(0)}</h3>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily vs Carry Donut Chart */}
                <div className="glass-card p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Lead Distribution</h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Daily', value: totals.daily, color: '#4f46e5' }, // Indigo-600
                                        { name: 'Carry', value: totals.carry, color: '#7c3aed' }  // Violet-600
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {[
                                        { name: 'Daily', value: totals.daily, color: '#4f46e5' },
                                        { name: 'Carry', value: totals.carry, color: '#7c3aed' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#1e293b' }} />
                                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Day of Week Chart */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-2 border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Leads by Day of Week (Sun - Sat)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayOfWeekStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#334155', fontWeight: 600 }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                                />
                                <Legend formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>} />
                                <Bar dataKey="Daily_Leads" name="Daily (09:00-17:59)" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Carry_Leads" name="Carry (18:00-08:59)" stackId="a" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* --- NEW: CPL Analysis Chart --- */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-3 border border-slate-200/60 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-2">Cost Per Lead (CPL) Analysis</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayOfWeekStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontWeight: 600 }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#334155', fontWeight: 600 }}
                                    tickFormatter={(val) => `฿${val}`}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                                    formatter={(value) => `฿${parseFloat(value).toFixed(0)}`}
                                />
                                <Legend formatter={(value) => <span className="text-slate-700 font-medium">{value}</span>} />
                                <Bar dataKey="Daily_CPL" name="Daily CPL" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="Carry_CPL" name="Carry CPL" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="CPL" name="Avg CPL" fill="#10b981" radius={[4, 4, 0, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* --- NEW: Advanced Combo Chart (Leads vs CPL) --- */}
            <div className="glass-card p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-100 pb-2">
                    <h3 className="text-lg font-bold text-slate-900">Leads vs Cost Efficiency (Daily Breakdown)</h3>
                    <div className="flex gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-200"></div>Leads Volume</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500"></div>Daily CPL</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500"></div>Carry CPL</div>
                    </div>
                </div>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dayOfWeekStats} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 600, dy: 10 }} />

                            {/* Left Y-Axis: Leads */}
                            <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} label={{ value: 'Leads', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />

                            {/* Right Y-Axis: CPL */}
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `฿${val}`} />

                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value, name) => {
                                    if (name === 'Total Leads') return [value, name];
                                    return [`฿${parseFloat(value).toFixed(0)}`, name];
                                }}
                            />

                            {/* Leads Bar */}
                            <Bar yAxisId="left" dataKey="Total_Leads" name="Total Leads" fill="#e2e8f0" radius={[8, 8, 8, 8]} barSize={40}>
                                <LabelList dataKey="Total_Leads" position="top" fill="#475569" fontSize={12} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                            </Bar>

                            {/* CPL Lines */}
                            <Line yAxisId="right" type="monotone" dataKey="Daily_CPL" name="Daily CPL" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="right" type="monotone" dataKey="Carry_CPL" name="Carry CPL" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- NEW: Hourly Breakdown Chart --- */}
            <div className="glass-card p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-slate-900">Hourly Efficiency Analysis (24H)</h3>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            {['All', 'Daily', 'Carry'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setHourlyFilter(filter)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${hourlyFilter === filter ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-200"></div>Leads Volume</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>CPL Trend</div>
                        {(hourlyFilter === 'All' || hourlyFilter === 'Daily') && <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-500 border-t border-dashed"></div>Avg Daily CPL</div>}
                        {(hourlyFilter === 'All' || hourlyFilter === 'Carry') && <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-violet-500 border-t border-dashed"></div>Avg Carry CPL</div>}
                    </div>
                </div>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredHourlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <defs>
                                <linearGradient id="splitColor" x1="0" y1="0" x2="1" y2="0">
                                    {hourlyFilter === 'All' ? (
                                        <>
                                            <stop offset="0%" stopColor="#7c3aed" />
                                            <stop offset="37.5%" stopColor="#7c3aed" />
                                            <stop offset="37.5%" stopColor="#4f46e5" />
                                            <stop offset="75%" stopColor="#4f46e5" />
                                            <stop offset="75%" stopColor="#7c3aed" />
                                            <stop offset="100%" stopColor="#7c3aed" />
                                        </>
                                    ) : hourlyFilter === 'Daily' ? (
                                        <stop offset="0%" stopColor="#4f46e5" />
                                    ) : (
                                        <stop offset="0%" stopColor="#7c3aed" />
                                    )}
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, dy: 10 }} interval={0} />

                            {/* Left Y-Axis: Leads */}
                            <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} label={{ value: 'Leads', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />

                            {/* Right Y-Axis: CPL */}
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `฿${val}`} />

                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                                formatter={(value, name) => {
                                    if (name === 'Leads') return [value, name];
                                    return [`฿${parseFloat(value).toFixed(0)}`, name];
                                }}
                            />

                            {/* Reference Lines */}
                            {(hourlyFilter === 'All' || hourlyFilter === 'Daily') && totals.dailyCpl > 0 && (
                                <ReferenceLine yAxisId="right" y={totals.dailyCpl} stroke="#4f46e5" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Daily Avg', position: 'right', fill: '#4f46e5', fontSize: 10, opacity: 0.7 }} />
                            )}
                            {(hourlyFilter === 'All' || hourlyFilter === 'Carry') && totals.carryCpl > 0 && (
                                <ReferenceLine yAxisId="right" y={totals.carryCpl} stroke="#7c3aed" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Carry Avg', position: 'right', fill: '#7c3aed', fontSize: 10, opacity: 0.7 }} />
                            )}

                            {/* Leads Bar */}
                            <Bar yAxisId="left" dataKey="Leads" name="Leads" fill="#e2e8f0" radius={[4, 4, 4, 4]} barSize={20}>
                                <LabelList dataKey="Leads" position="top" fill="#475569" fontSize={10} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                            </Bar>

                            {/* CPL Line with Gradient */}
                            <Line yAxisId="right" type="monotone" dataKey="CPL" name="CPL" stroke="url(#splitColor)" strokeWidth={3} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detail Table */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Day Breakdown</h3>
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
                                    { label: 'Day', key: 'name', align: 'left' },
                                    { label: 'Daily Leads', key: 'Daily_Leads', align: 'right' },
                                    { label: 'Carry Leads', key: 'Carry_Leads', align: 'right' },
                                    { label: 'Total Leads', key: 'Total_Leads', align: 'right' },
                                    { label: 'Cost', key: 'Total_Cost', align: 'right' },
                                    { label: 'CPL', key: 'CPL', align: 'right' }
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
                            {sortedDayStats.map((row, idx) => (
                                <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-800">{row.name}</td>
                                    <td className="px-6 py-4 text-right font-bold text-indigo-700">{row.Daily_Leads}</td>
                                    <td className="px-6 py-4 text-right font-bold text-violet-700">{row.Carry_Leads}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900">{row.Total_Leads}</td>
                                    <td className="px-6 py-4 text-right text-slate-600 font-medium">฿{row.Total_Cost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900">฿{row.CPL.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TimeAnalysisPage;
