import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Clock, Sun, Moon, Calendar } from 'lucide-react';
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
            Daily_Leads: 0, Carry_Leads: 0, Total_Leads: 0, Cost: 0
        }));

        processedData.forEach(d => {
            const date = new Date(d.Day);
            if (isNaN(date.getTime())) return;
            const dayIdx = date.getDay();

            days[dayIdx].Cost += d.Cost || 0;
            days[dayIdx].Total_Leads += d.Leads || 0;
            if (d.TimeType === 'Daily') days[dayIdx].Daily_Leads += d.Leads || 0;
            else days[dayIdx].Carry_Leads += d.Leads || 0;
        });

        return days.map(d => ({
            ...d,
            CPL: d.Total_Leads > 0 ? d.Cost / d.Total_Leads : 0
        }));
    }, [processedData]);

    // --- AGGREGATION: Totals ---
    const totals = useMemo(() => {
        let daily = 0, carry = 0, cost = 0, leads = 0;
        processedData.forEach(d => {
            cost += d.Cost || 0;
            leads += d.Leads || 0;
            if (d.TimeType === 'Daily') daily += d.Leads || 0;
            else carry += d.Leads || 0;
        });
        return { daily, carry, cost, leads, cpl: leads ? cost / leads : 0 };
    }, [processedData]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" />
                Time Analysis (Daily vs Carry)
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-indigo-500">
                    <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
                        <Sun className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-semibold">Daily Leads (09:00 - 17:59)</p>
                        <h3 className="text-2xl font-bold text-slate-800">{totals.daily.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-violet-500">
                    <div className="p-3 bg-violet-100 rounded-full text-violet-600">
                        <Moon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-semibold">Carry Leads (18:00 - 08:59)</p>
                        <h3 className="text-2xl font-bold text-slate-800">{totals.carry.toLocaleString()}</h3>
                    </div>
                </div>
                <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-l-emerald-500">
                    <div className="p-3 bg-emerald-100 rounded-full text-emerald-600">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-slate-500 text-sm font-semibold">Total CPL</p>
                        <h3 className="text-2xl font-bold text-slate-800">฿{totals.cpl.toFixed(0)}</h3>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily vs Carry Donut Chart */}
                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Lead Distribution</h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Daily', value: totals.daily, color: '#6366f1' },
                                        { name: 'Carry', value: totals.carry, color: '#8b5cf6' }
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {[
                                        { name: 'Daily', value: totals.daily, color: '#6366f1' },
                                        { name: 'Carry', value: totals.carry, color: '#8b5cf6' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Day of Week Chart */}
                <div className="glass-card p-6 rounded-2xl lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Leads by Day of Week (Sun - Sat)</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dayOfWeekStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="Daily_Leads" name="Daily (09:00-17:59)" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Carry_Leads" name="Carry (18:00-08:59)" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detail Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/30 bg-white/40">
                    <h3 className="text-lg font-bold text-slate-800">Day Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold border-b border-white/50">
                            <tr>
                                <th className="px-6 py-4 text-left">Day</th>
                                <th className="px-6 py-4 text-right text-indigo-600">Daily Leads</th>
                                <th className="px-6 py-4 text-right text-violet-600">Carry Leads</th>
                                <th className="px-6 py-4 text-right text-slate-800">Total Leads</th>
                                <th className="px-6 py-4 text-right text-slate-500">Cost</th>
                                <th className="px-6 py-4 text-right text-slate-800">CPL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/40">
                            {dayOfWeekStats.map((row, idx) => (
                                <tr key={idx} className="hover:bg-white/60 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700">{row.name}</td>
                                    <td className="px-6 py-4 text-right font-medium text-indigo-600">{row.Daily_Leads}</td>
                                    <td className="px-6 py-4 text-right font-medium text-violet-600">{row.Carry_Leads}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">{row.Total_Leads}</td>
                                    <td className="px-6 py-4 text-right text-slate-500">฿{row.Cost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800">฿{row.CPL.toFixed(0)}</td>
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
