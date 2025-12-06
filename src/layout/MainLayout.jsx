import React from 'react';
import { Activity, FileSpreadsheet, LogOut, Filter, Calendar } from 'lucide-react';
import { useData } from '../context/DataContext';

const MainLayout = ({ children, user, onLogout, activeTab, setActiveTab }) => {
    const { dataSource, handleFileUpload, filters, setFilters, dateRange, setDateRange } = useData();

    // Extract unique options for filters if needed, but for now we can rely on what we had.
    // In App.jsx, uniqueOwners etc were derived from targetData.
    // We can access targetData from context to populate dropdowns.
    const { targetData } = useData();

    const uniqueOwners = [...new Set(targetData.map(d => d.OWNER))].sort();
    // TYPE_ORDER needs to be imported if we want to sort types, or just sort alphabetically
    // For simplicity, just sort alphabetically or simple
    const uniqueTypes = [...new Set(targetData.map(d => d.TYPE))].sort();
    const uniqueProducts = [...new Set(targetData.map(d => d.Product_Target))].sort();

    return (
        <div className="min-h-screen p-6 pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 glass-card p-6 rounded-2xl">
                    <div>
                        <span className="text-xs font-bold tracking-wider text-indigo-600 uppercase mb-2 block">Premium Analytics</span>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-3">
                            <Activity className="w-10 h-10 text-indigo-600" />
                            Thailife Dashboard
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">
                            Welcome back, <span className="text-indigo-600 font-bold">{user?.name || 'User'}</span>!
                            <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-normal">Data: {dataSource}</span>
                        </p>
                    </div>
                    <div className="flex gap-3 items-end">
                        <div className="flex gap-3">
                            {['Append', 'Sent', 'Target'].map(type => (
                                <label key={type} className="cursor-pointer bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all group">
                                    <FileSpreadsheet className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                                    <div className="flex flex-col items-start">
                                        <span>{type}</span>
                                    </div>
                                    <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, type.toLowerCase())} />
                                </label>
                            ))}
                        </div>
                        <button onClick={onLogout} className="bg-white border border-rose-200 text-rose-600 shadow-sm hover:shadow-md hover:border-rose-300 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all group">
                            <LogOut className="w-4 h-4 group-hover:rotate-180 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* View Switcher */}
                <div className="flex justify-center">
                    <div className="glass-card p-1 rounded-xl inline-flex flex-wrap justify-center">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            Overview Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('smart-analysis')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'smart-analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            Smart Creative
                        </button>
                        <button
                            onClick={() => setActiveTab('smart-audience')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'smart-audience' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            Smart Audience
                        </button>
                        <button
                            onClick={() => setActiveTab('time-analysis')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'time-analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            Time Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('cost-profit')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'cost-profit' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-teal-600'}`}
                        >
                            Cost & Profit
                        </button>
                        <button
                            onClick={() => setActiveTab('intelligence')}
                            className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'intelligence' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                        >
                            Old Intelligence
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                Manage Users
                            </button>
                        )}
                    </div>
                </div>

                {/* Global Filter Bar (Conditionally Rendered) */}
                {activeTab !== 'users' && activeTab !== 'smart-analysis' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8 glass-card p-6 rounded-2xl flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-4">
                                <Filter className="w-4 h-4 text-indigo-500" />
                                <label className="text-xs font-bold uppercase text-indigo-500 tracking-wider">Data Segments</label>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <select className="glass-input px-4 py-2 rounded-lg text-sm font-medium text-slate-700 w-full sm:w-auto" value={filters.owner} onChange={e => setFilters({ ...filters, owner: e.target.value })}>
                                    <option value="All">All Owners</option>
                                    {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                                <select className="glass-input px-4 py-2 rounded-lg text-sm font-medium text-slate-700 w-full sm:w-auto" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                                    <option value="All">All Types</option>
                                    {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select className="glass-input px-4 py-2 rounded-lg text-sm font-medium text-slate-700 w-full sm:w-auto flex-grow" value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })}>
                                    <option value="All">All Products</option>
                                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <button onClick={() => setFilters({ owner: 'All', type: 'All', product: 'All' })} className="px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">Reset</button>
                            </div>
                        </div>

                        <div className="lg:col-span-4 glass-card p-6 rounded-2xl">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-4 h-4 text-rose-500" />
                                <label className="text-xs font-bold uppercase text-rose-500 tracking-wider">View Range</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="date" className="glass-input flex-1 px-3 py-2 rounded-lg text-sm text-slate-600" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                <span className="text-slate-400 font-bold">→</span>
                                <input type="date" className="glass-input flex-1 px-3 py-2 rounded-lg text-sm text-slate-600" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                {children}

            </div>
        </div>
    );
};

export default MainLayout;
