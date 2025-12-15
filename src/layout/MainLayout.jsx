import React from 'react';
import { Activity, FileSpreadsheet, LogOut, Filter, Calendar, LayoutDashboard, Database, BarChart2, PieChart, Users, Settings, Table, Clock, FlaskConical, Layers } from 'lucide-react';
import { useData } from '../context/DataContext';
import DateRangePicker from '../components/common/DateRangePicker';

const MainLayout = ({ children, user, onLogout, activeTab, setActiveTab }) => {
    const { dataSource, handleFileUpload, filters, setFilters, dateRange, setDateRange } = useData();

    const menuItems = [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'smart-analysis', label: 'Creative Analysis', icon: BarChart2 },
        { id: 'smart-audience', label: 'Smart Audience', icon: PieChart },
        { id: 'optimization-lab', label: 'Optimization Lab', icon: FlaskConical }, // NEW
        { id: 'intelligence', label: 'Intelligence Hub', icon: Database }, // Renamed from Raw Data
        { id: 'time-analysis', label: 'Time Analysis', icon: Clock },
        { id: 'cost-profit', label: 'Cost & Profit', icon: Table },
        { id: 'leads-analysis', label: 'Leads Analysis', icon: Layers }, // NEW
        { id: 'product-master', label: 'Product Master', icon: Table, className: 'text-xs' }, // Smaller text if needed
    ];
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
                    <div className="glass-card p-1 rounded-xl inline-flex flex-wrap justify-center gap-1">
                        {menuItems.map(item => {
                            // Hide User Management for non-admins if conditional logic needed, 
                            // though simpler to just filter array or use condition inside.
                            // Current array doesn't have 'users', it's hardcoded. Let's add 'users' to array or keep hardcoded.
                            // The 'users' button was conditional on admin. Let's keep it manual or add it conditional.
                            // Let's iterate menu items first.
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                                >
                                    {item.icon && <item.icon className="w-4 h-4" />}
                                    <span className={item.className}>{item.label}</span>
                                </button>
                            );
                        })}

                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                            >
                                <Users className="w-4 h-4" />
                                <span>Manage Users</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Global Filter Bar (Conditionally Rendered) */}
                {activeTab !== 'users' && activeTab !== 'smart-analysis' && activeTab !== 'product-master' && (
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

                        <div className="lg:col-span-4 glass-card p-6 rounded-2xl flex flex-col justify-center items-end relative z-50">
                            <div className="flex items-center gap-2 mb-4 w-full justify-end">
                                <Calendar className="w-4 h-4 text-rose-500" />
                                <label className="text-xs font-bold uppercase text-rose-500 tracking-wider">View Range</label>
                            </div>
                            <DateRangePicker
                                startDate={dateRange.start}
                                endDate={dateRange.end}
                                onChange={(newRange) => setDateRange(prev => ({ ...prev, ...newRange }))}
                            />
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
