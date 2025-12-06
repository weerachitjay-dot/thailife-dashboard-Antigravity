import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Clock, Sun, Moon, Calendar, TrendingUp, Wallet } from 'lucide-react';
import { useData } from '../context/DataContext';
import { DAY_NAMES, normalizeProduct } from '../utils/formatters';

const TimeAnalysisPage = () => {
    const { appendTimeData, targetData, filters, dateRange } = useData();

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

            {/* Detail Table */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-white/50">
                    <h3 className="text-lg font-bold text-slate-900">Day Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left tracking-wider">Day</th>
                                <th className="px-6 py-4 text-right text-indigo-700 tracking-wider">Daily Leads</th>
                                <th className="px-6 py-4 text-right text-violet-700 tracking-wider">Carry Leads</th>
                                <th className="px-6 py-4 text-right text-slate-900 tracking-wider">Total Leads</th>
                                <th className="px-6 py-4 text-right text-slate-600 tracking-wider">Cost</th>
                                <th className="px-6 py-4 text-right text-slate-900 tracking-wider">CPL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/60">
                            {dayOfWeekStats.map((row, idx) => (
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
