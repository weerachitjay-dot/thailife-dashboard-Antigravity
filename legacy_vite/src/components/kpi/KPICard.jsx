import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const KPICard = ({ title, value, subtext, icon: Icon, gradient, trend }) => (
    <div className={`glass-card p-6 rounded-2xl border border-white/40 flex flex-col justify-between h-full group transition-all duration-300 hover:shadow-2xl`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
            </div>
            {trend !== undefined && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        <div>
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{title}</p>
            {subtext && <p className="text-xs text-slate-400 mt-2 font-medium">{subtext}</p>}
        </div>
    </div>
);

export default KPICard;
