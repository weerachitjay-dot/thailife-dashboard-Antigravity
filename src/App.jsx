import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, ReferenceArea, ReferenceLine, Cell, LabelList, PieChart, Pie
} from 'recharts';
import {
  Upload, Filter, Calculator, Calendar, DollarSign, Users, Target, TrendingUp,
  AlertCircle, FileSpreadsheet, Timer, ArrowUpRight, ArrowDownRight, Activity,
  Zap, Brain, ChevronUp, ChevronDown, CheckCircle, XCircle, AlertTriangle, Lock, LogOut,
  Clock, Lightbulb, Search, RefreshCw, MousePointerClick, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, addDoc, deleteDoc, onSnapshot, doc } from 'firebase/firestore';

// --- Default Snippets for Demo ---
const SNIPPET_APPEND = `Campaign_name,Day,Ad_set_name,Ad_name,Reach,Impressions,Clicks,Website_leads,Cost,Meta_leads,Leads,Messaging_conversations_started
CONVERSIONS_THAILIFE+LIFE-SENIOR-MORRADOK_RUNNING_2025-08-13_(เพจสร้างมรดก),2025-11-01,INTEREST_SPORT-RUNNING_TH_ALL_30-65,(เพจสร้างมรดก)_THAILIFE_SENIOR-MORRADOK-IMG_DEC-2024,8945,11563,174,2,984.8,0,2,3
CONVERSIONS_THAILIFE+HEALTH-SABAI-JAI_BIRTHDAY_2025-03-26_(เพจสุขภาพ),2025-11-01,INTEREST_HEALTH_TH_ALL_25-64,(เพจสุขภาพ)_THAILIFE_HEALTH-SABAI-JAI-IMG_DEC-2024,5000,6000,100,5,500.0,3,5,10
CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_2025-01-01_(เพจออมเงิน),2025-11-02,INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,4000,4500,80,1,400.0,1,1,2`;

const SNIPPET_APPENDSENT = `Day,Product1,Leads_Sent
2025-11-01,ประกันชีวิต สูงวัยไร้กังวล,5
2025-11-01,ประกันสุขภาพ เฮลท์เหมาสบายใจ,3
2025-11-02,แฮปปี้ไลฟ์,2
2025-11-03,ประกันชีวิต สูงวัยไร้กังวล,10
2025-11-04,ประกันชีวิต สูงวัยไร้กังวล,0
2025-11-05,ประกันชีวิต สูงวัยไร้กังวล,0`;

const SNIPPET_TARGET = `Product_Target,Target_Lead_Sent,Target_SellPrice,Target_CPL,Target_CPL2,OWNER,TYPE
LIFE-SENIOR-MORRADOK,1280,561,280.5,400,JAY,Senior
LIFE-EXTRASENIOR-BUPHAKARI,1000,561,280.5,400,JAY,Senior
SAVING-HAPPY,400,561,280.5,400,PANG,Saving
HEALTH-SABAI-JAI,170,267,133.5,200,LEK,Health
HEALTH-TOPUP-SICK,200,267,133.5,200,LEK,Health
LIFE-SENIOR-BONECARE,600,561,280.5,400,PANG,Senior
SAVING-MONEYSAVING14/6,250,561,280.5,400,PANG,Saving`;

// --- Configuration ---
const DEFAULT_USERS = [
  { username: 'weerachit.jay', pass: 'Suza01Suz@!#', name: 'Jay', role: 'admin' },
  { username: 'admin', pass: 'admin1234', name: 'Admin', role: 'viewer' },
];

const SHEET_CONFIG = {
  DOC_ID: '1gCAb0yNmls8NHsTVtmpmOZQN3SpWF_V66zwnchJvGcc',
  GIDS: {
    append: '984181303',
    sent: '1463750995',
    target: '1565547820'
  }
};

// --- Smart Helpers ---
const extractCreativeName = (adName) => {
  if (!adName) return "Unknown";
  // Pattern: ..._THAILIFE_TARGET...
  // User Example: (เพจ...)_THAILIFE_SENIOR-MORRADOK-GRANDFA-SMILE-02_DEC-2024
  // We want: SENIOR-MORRADOK-GRANDFA-SMILE-02

  const parts = adName.split('_');
  const thailifeIndex = parts.findIndex(p => p.includes('THAILIFE'));

  if (thailifeIndex !== -1 && parts[thailifeIndex + 1]) {
    // Return the part immediately after THAILIFE
    return parts[thailifeIndex + 1];
  }

  // Fallback: Look for the longest segment that contains hyphens (likely the creative ID)
  const dashedPart = parts.find(p => p.split('-').length > 2);
  if (dashedPart) return dashedPart;

  return adName;
};

const getSmartRecommendation = (stats, targetCpl) => {
  const { cost, leads, cpl, daysActive } = stats;

  // 1. Learning Phase Check
  if (daysActive < 4) {
    return {
      type: 'learning',
      action: 'WAIT',
      reason: `Learning Phase (${daysActive}/4 days)`,
      color: 'bg-yellow-100 text-yellow-700',
      icon: Clock
    };
  }

  if (!targetCpl) return { type: 'neutral', action: '-', reason: 'No Target', color: 'bg-slate-100' };

  // 2. Performance Check
  const cplRatio = cpl / targetCpl;

  if (cost > 0 && leads === 0 && daysActive > 4) {
    return { type: 'danger', action: 'STOP', reason: 'Zero Leads', color: 'bg-rose-100 text-rose-700', icon: XCircle };
  }

  if (cplRatio < 0.8) {
    return { type: 'success', action: 'SCALE', reason: 'Cheap CPL (High Potential)', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
  }
  if (cplRatio <= 1.1) {
    return { type: 'success', action: 'MAINTAIN', reason: 'On Target', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
  }
  if (cplRatio <= 1.5) {
    return { type: 'warning', action: 'MONITOR', reason: 'Slightly Expensive', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
  }

  return { type: 'danger', action: 'STOP/FIX', reason: 'CPL Too High', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};

const getAudienceRecommendation = (stats, targetCpl) => {
  const { cpl, ctr, frequency, cost, leads } = stats;

  if (cost === 0) return { type: 'neutral', action: 'WAIT', reason: 'No Spend', color: 'bg-slate-100 text-slate-500' };

  // 1. Saturation Check (High Frequency)
  if (frequency > 4.0) {
    if (cpl > targetCpl) return { type: 'danger', action: 'ROTATE', reason: 'Saturated (Freq > 4)', color: 'bg-rose-100 text-rose-700', icon: RefreshCw };
    return { type: 'warning', action: 'MONITOR', reason: 'High Frequency', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
  }

  if (!targetCpl) return { type: 'neutral', action: '-', reason: 'No Target', color: 'bg-slate-100' };

  const cplRatio = cpl / targetCpl;

  // 2. Relevance Check (CTR)
  if (ctr < 0.5) { // Very low CTR
    if (cplRatio > 1.2) return { type: 'danger', action: 'STOP', reason: 'Low Interest (CTR < 0.5%)', color: 'bg-rose-100 text-rose-700', icon: XCircle };
    return { type: 'warning', action: 'IMPROVE HOOK', reason: 'Low CTR', color: 'bg-amber-100 text-amber-700', icon: Lightbulb };
  }

  // 3. Performance Check
  if (cplRatio < 0.8) {
    return { type: 'success', action: 'SCALE', reason: 'Winner (Cheap CPL)', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
  }
  if (cplRatio <= 1.1) {
    return { type: 'success', action: 'MAINTAIN', reason: 'On Target', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
  }

  return { type: 'danger', action: 'FIX', reason: 'Expensive', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};

const TYPE_ORDER = {
  'Senior': 1,
  'Saving': 2,
  'Health': 3
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- Utility Functions ---
const parseCSV = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const row = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
      if (['Reach', 'Impressions', 'Clicks', 'Website_leads', 'Cost', 'Meta_leads', 'Leads', 'Messaging_conversations_started', 'Leads_Sent', 'Target_Lead_Sent', 'Target_CPL'].includes(header)) {
        row[header] = parseFloat(val.replace(/,/g, '')) || 0;
      } else {
        row[header] = val;
      }
    });
    return row;
  });
};

const normalizeProduct = (productRaw) => {
  if (!productRaw) return 'Unknown';
  const p = productRaw.trim();
  if (/แฮปปี้|HAPPY/gi.test(p)) return "SAVING-HAPPY";
  if (/14\/6|มันนี่|เซฟวิ่ง|money.?saving|ออม/gi.test(p)) return "SAVING-MONEYSAVING14/6";
  if (/เติมเงิน|top.?up/gi.test(p)) return "HEALTH-TOPUP-SICK";
  if (/เหมาสบายใจ|สบายใจ|sabai/gi.test(p)) return "HEALTH-SABAI-JAI";
  if (/สูงวัยมีทรัพย์|buphakari/gi.test(p)) return "LIFE-EXTRASENIOR-BUPHAKARI";
  if (/โบนแคร์|bone.?care/gi.test(p)) return "LIFE-SENIOR-BONECARE";
  if (/ไร้กังวล|สูงวัยไร้กังวล|มรดก|moradok|morradok/gi.test(p)) return "LIFE-SENIOR-MORRADOK";
  return p;
};

const processAppendData = (data) => {
  return data.map(row => {
    const adSetName = row.Ad_set_name || '';
    const adName = row.Ad_name || '';
    const campName = row.Campaign_name || '';
    const categoryMatch = adSetName.match(/^INTEREST_([^\-\+_]+(?: & [^\-\+_]+)?)/);
    const creativeMatch = adName.match(/_(.*)/);
    const partnerMatch = campName.match(/_(.*?)\+/);
    const productMatch = campName.match(/THAILIFE\+(.*?)(?:_|$)/);
    return {
      ...row,
      Category_Normalized: categoryMatch ? categoryMatch[1] : 'Other',
      Creative: creativeMatch ? creativeMatch[1] : adName,
      Partner: partnerMatch ? partnerMatch[1].trim() : 'Unknown',
      Product: productMatch ? productMatch[1] : 'Unknown',
      Day: row.Day
    };
  });
};

const processSentData = (data) => {
  return data.map(row => ({
    ...row,
    Product_Normalized: normalizeProduct(row.Product1),
    Day: row.Day
  }));
};

const getRecommendation = (cpl, targetCpl) => {
  if (!targetCpl || targetCpl === 0) return { type: 'neutral', text: 'No Target', color: 'bg-slate-100 text-slate-600' };
  if (cpl === 0) return { type: 'neutral', text: 'No Spend', color: 'bg-slate-100 text-slate-600' };

  const ratio = cpl / targetCpl;
  if (ratio < 0.8) return { type: 'success', text: 'SCALE AGGRESSIVELY', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
  if (ratio <= 1.0) return { type: 'success', text: 'SCALE', color: 'bg-green-100 text-green-700', icon: TrendingUp };
  if (ratio <= 1.2) return { type: 'warning', text: 'MONITOR', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
  return { type: 'danger', text: 'REDUCE / FIX', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};

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

// --- User Management Component ---
const UserManagement = ({ users, onAddUser, onDeleteUser, currentUser }) => {
  const [newUser, setNewUser] = useState({ username: '', pass: '', name: '', role: 'viewer' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.pass || !newUser.name) return;
    onAddUser(newUser);
    setNewUser({ username: '', pass: '', name: '', role: 'viewer' });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Create New User
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Name</label>
            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="John Doe" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Username</label>
            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="john.doe" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Password</label>
            <input type="text" className="glass-input w-full px-4 py-2 rounded-xl" placeholder="Select a strong password" value={newUser.pass} onChange={e => setNewUser({ ...newUser, pass: e.target.value })} required />
          </div>
          <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30 whitespace-nowrap">
            Add User
          </button>
        </form>
        <p className="text-xs text-amber-600 mt-3 font-medium bg-amber-50 px-3 py-2 rounded-lg inline-block border border-amber-100">
          Note: Users created here are saved to your browser (LocalStorage). They will not be visible on other devices unless you manually add them there or we implement a cloud database.
        </p>
      </div>

      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Existing Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
              <tr>
                <th className="px-6 py-3 rounded-tl-xl">Name</th>
                <th className="px-6 py-3">Username</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 rounded-tr-xl text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-700">{u.name} {u.username === currentUser.username && <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded ml-2">You</span>}</td>
                  <td className="px-6 py-4 text-slate-500">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role || 'viewer'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {u.role !== 'admin' && (
                      <button onClick={() => onDeleteUser(u.id, u.username)} className="text-rose-500 hover:text-rose-700 font-medium text-xs bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Login Page Component ---
const LoginPage = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const validUser = users.find(u => u.username === username && u.pass === password);
    if (validUser) {
      onLogin(validUser);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/50">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to manage your campaigns</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Enter your username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-sm font-medium animate-pulse">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Protected by Secure Auth System
        </div>
      </div>
    </div>
  );
};

// --- Creative Analysis Component ---
const CreativeAnalysis = ({ data, targetCpl }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('All');

  // Auto-Init Date Range
  useEffect(() => {
    if (data && data.length > 0) {
      // Find min and max dates
      const dates = data.map(d => d.Day).filter(Boolean).sort();
      if (dates.length > 0) {
        if (!startDate) setStartDate(dates[0]);
        if (!endDate) setEndDate(dates[dates.length - 1]);
      }
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
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Creative Name (Smart)</th>
              <th className="px-6 py-4 text-center">Days Active</th>
              <th className="px-6 py-4 text-right">Spend</th>
              <th className="px-6 py-4 text-right">Leads</th>
              <th className="px-6 py-4 text-right">CPL</th>
              <th className="px-6 py-4 text-center">AI Recommendation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCreatives.map((row, idx) => (
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
            {filteredCreatives.length === 0 && (
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

// --- Audience Analysis Component ---
const AudienceAnalysis = ({ data, targetCpl }) => {
  const [productFilter, setProductFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Auto-Init Date Range
  useEffect(() => {
    if (data && data.length > 0) {
      const dates = data.map(d => d.Day).filter(Boolean).sort();
      if (dates.length > 0) {
        if (!startDate) setStartDate(dates[0]);
        if (!endDate) setEndDate(dates[dates.length - 1]);
      }
    }
  }, [data]);

  // Extract Unique Products
  const products = useMemo(() => {
    const unique = new Set(data.map(d => d.Product).filter(Boolean));
    return ['All', ...Array.from(unique).sort()];
  }, [data]);

  const audienceStats = useMemo(() => {
    const stats = {};

    data.forEach(row => {
      // Filter by Product
      if (productFilter !== 'All' && row.Product !== productFilter) return;

      // Filter by Date
      const date = row.Day;
      if (startDate && new Date(date) < new Date(startDate)) return;
      if (endDate && new Date(date) > new Date(endDate)) return;

      const interest = row.Category_Normalized || 'Unknown';

      if (!stats[interest]) {
        stats[interest] = {
          interest,
          cost: 0,
          leads: 0,
          impressions: 0,
          clicks: 0,
          reach: 0
        };
      }
      stats[interest].cost += (row.Cost || 0);
      stats[interest].leads += (row.Leads || 0); // Using FB Leads
      stats[interest].impressions += (row.Impressions || 0);
      stats[interest].clicks += (row.Clicks || 0);
      stats[interest].reach += (row.Reach || 0);
    });

    return Object.values(stats).map(item => {
      const cpl = item.leads > 0 ? item.cost / item.leads : 0;
      const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
      const cvr = item.clicks > 0 ? (item.leads / item.clicks) * 100 : 0;
      const frequency = item.reach > 0 ? item.impressions / item.reach : 0;

      const rec = getAudienceRecommendation({ ...item, cpl, ctr, frequency }, targetCpl);

      return { ...item, cpl, ctr, cvr, frequency, rec };
    }).sort((a, b) => b.cost - a.cost);

  }, [data, productFilter, startDate, endDate, targetCpl]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-500" />
            Smart Audience Analysis
          </h2>
          <p className="text-slate-500 mt-1">Deep dive into Interest & Behavior performance.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Filter Product</label>
            <select
              className="glass-input px-3 py-2 rounded-xl text-sm min-w-[200px]"
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
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card p-0 rounded-2xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Audience / Interest</th>
              <th className="px-6 py-4 text-center">Frequency</th>
              <th className="px-6 py-4 text-center">CTR %</th>
              <th className="px-6 py-4 text-center">CVR %</th>
              <th className="px-6 py-4 text-right">Spend</th>
              <th className="px-6 py-4 text-right">Leads</th>
              <th className="px-6 py-4 text-right">CPL</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {audienceStats.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-700">{row.interest}</td>
                <td className="px-6 py-4 text-center text-slate-600">{row.frequency.toFixed(2)}</td>
                <td className="px-6 py-4 text-center">
                  <div className={`inline-block px-2 py-1 rounded ${row.ctr > 1.5 ? 'bg-green-50 text-green-700 font-bold' : row.ctr < 0.5 ? 'bg-red-50 text-red-700' : 'text-slate-600'}`}>
                    {row.ctr.toFixed(2)}%
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-slate-600">{row.cvr.toFixed(2)}%</td>
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
            {audienceStats.length === 0 && (
              <tr><td colSpan="8" className="text-center py-8 text-slate-400">No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---
const Dashboard = ({ user, onLogout, users, onAddUser, onDeleteUser }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dataSource, setDataSource] = useState('Loading...');
  const [rawData, setRawData] = useState({ append: [], sent: [], target: [] });
  const [appendData, setAppendData] = useState([]);
  const [sentData, setSentData] = useState([]);
  const [targetData, setTargetData] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // View Filter Dates
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Campaign Config Dates
  const [campaignConfig, setCampaignConfig] = useState({ start: '2025-11-01', end: '2025-11-30' });

  const [filters, setFilters] = useState({
    owner: 'All',
    type: 'All',
    product: 'All'
  });

  // Load Initial Data
  useEffect(() => {
    const loadDefaultData = async () => {
      try {
        // Helper to fetch and parse
        const fetchData = async (baseName) => {
          const gid = SHEET_CONFIG.GIDS[baseName];

          // 1. Try Google Sheet Proxy (Vercel Function) - Only if NOT localhost
          if (gid && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
            try {
              const apiRes = await fetch(`/api/sheet?gid=${gid}`);
              const contentType = apiRes.headers.get("content-type");
              if (apiRes.ok && contentType && !contentType.includes("text/html")) {
                setDataSource('Online (Google Sheets)');
                return { text: await apiRes.text(), type: 'api-csv' };
              }
            } catch (e) { console.log('API fetch failed, fallback to local'); }
          }

          // 2. Try XLSX Local
          try {
            const xlsxRes = await fetch(`/data/${baseName}.xlsx`);
            if (xlsxRes.ok) {
              const buffer = await xlsxRes.arrayBuffer();
              const workbook = XLSX.read(buffer, { type: 'array' });
              const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
              setDataSource((prev) => prev.includes('Online') ? prev : 'Local XLSX');
              return { text: csvText, type: 'xlsx' };
            }
          } catch (e) { }

          // 3. Try CSV Local
          try {
            const csvRes = await fetch(`/data/${baseName}.csv`);
            if (csvRes.ok) {
              setDataSource((prev) => prev.includes('Online') ? prev : 'Local CSV');
              return { text: await csvRes.text(), type: 'csv' };
            }
          } catch (e) { }

          return null;
        };

        const [appendRes, sentRes, targetRes] = await Promise.all([
          fetchData('append'),
          fetchData('sent'),
          fetchData('target')
        ]);

        if (appendRes && appendRes.text) {
          const processed = processAppendData(parseCSV(appendRes.text));
          setAppendData(processed);
          const dates = processed.map(d => d.Day).filter(Boolean).sort();
          if (dates.length) {
            setDateRange(prev => ({ ...prev, start: dates[0], end: dates[dates.length - 1] }));
            setCampaignConfig({ start: dates[0], end: dates[dates.length - 1] });
          }
        } else {
          setDataSource('Demo Snippets');
          setAppendData(processAppendData(parseCSV(SNIPPET_APPEND)));
        }

        setSentData(sentRes && sentRes.text ? processSentData(parseCSV(sentRes.text)) : processSentData(parseCSV(SNIPPET_APPENDSENT)));
        setTargetData(targetRes && targetRes.text ? parseCSV(targetRes.text) : parseCSV(SNIPPET_TARGET));

      } catch (error) {
        console.error("Failed to load auto data", error);
        setDataSource('Error - Fallback Snippets');
        // Fallback to snippets
        setAppendData(processAppendData(parseCSV(SNIPPET_APPEND)));
        setSentData(processSentData(parseCSV(SNIPPET_APPENDSENT)));
        setTargetData(parseCSV(SNIPPET_TARGET));
      }
    };
    loadDefaultData();
  }, []);

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const processContent = (csvText) => {
      const parsed = parseCSV(csvText);
      if (type === 'append') {
        const processed = processAppendData(parsed);
        setAppendData(processed);
        const dates = processed.map(d => d.Day).filter(Boolean).sort();
        if (dates.length) {
          setDateRange(prev => ({ ...prev, start: dates[0], end: dates[dates.length - 1] }));
          setCampaignConfig({ start: dates[0], end: dates[dates.length - 1] });
        }
      }
      else if (type === 'sent') setSentData(processSentData(parsed));
      else if (type === 'target') setTargetData(parsed);
    };

    if (file.name.match(/\.(xlsx|xls)$/)) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
          processContent(csvText);
        } catch (error) { alert("Error reading Excel file."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => processContent(evt.target.result);
      reader.readAsText(file);
    }
  };

  // --- MERGED DATA ---
  const mergedData = useMemo(() => {
    const groupedAds = {};
    appendData.forEach(row => {
      if (row.Day < dateRange.start || row.Day > dateRange.end) return;
      const key = `${row.Day}|${row.Product}`;
      if (!groupedAds[key]) groupedAds[key] = { Cost: 0, Leads: 0, Meta_Leads: 0 };
      groupedAds[key].Cost += row.Cost || 0;
      groupedAds[key].Leads += row.Leads || 0;
      groupedAds[key].Meta_Leads += row.Meta_leads || 0;
    });

    const groupedSent = {};
    sentData.forEach(row => {
      if (row.Day < dateRange.start || row.Day > dateRange.end) return;
      const key = `${row.Day}|${row.Product_Normalized}`;
      if (!groupedSent[key]) groupedSent[key] = { Leads_Sent: 0 };
      groupedSent[key].Leads_Sent += row.Leads_Sent || 0;
    });

    const allKeys = new Set([...Object.keys(groupedAds), ...Object.keys(groupedSent)]);
    const result = [];
    allKeys.forEach(key => {
      const [day, product] = key.split('|');
      const ads = groupedAds[key] || { Cost: 0, Leads: 0, Meta_Leads: 0 };
      const sent = groupedSent[key] || { Leads_Sent: 0 };
      const targetInfo = targetData.find(t => t.Product_Target === product)
        || { OWNER: 'Unknown', TYPE: 'Unknown', Target_Lead_Sent: 0, Target_CPL: 0 };

      if (filters.owner !== 'All' && targetInfo.OWNER !== filters.owner) return;
      if (filters.type !== 'All' && targetInfo.TYPE !== filters.type) return;
      if (filters.product !== 'All' && product !== filters.product) return;

      result.push({ Day: day, Product: product, ...ads, ...sent, ...targetInfo });
    });
    return result.sort((a, b) => a.Day.localeCompare(b.Day));
  }, [appendData, sentData, targetData, dateRange, filters]);

  // --- FORECAST DATA ---
  const forecastData = useMemo(() => {
    const allDates = [...appendData.map(d => d.Day), ...sentData.map(d => d.Day)].sort();
    const lastDataDate = allDates.length ? allDates[allDates.length - 1] : campaignConfig.start;
    const start = new Date(campaignConfig.start);
    const end = new Date(campaignConfig.end);
    const current = new Date(lastDataDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return { rows: [], totals: {} };

    const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24) + 1);
    const daysElapsed = Math.max(1, Math.min(totalDays, (current - start) / (1000 * 60 * 60 * 24) + 1));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const agg = {};
    sentData.forEach(row => {
      if (row.Day < campaignConfig.start || row.Day > campaignConfig.end) return;
      const prod = row.Product_Normalized;
      if (!agg[prod]) agg[prod] = { leadsSent: 0 };
      agg[prod].leadsSent += row.Leads_Sent || 0;
    });

    let totalTarget = 0, totalActual = 0, totalForecast = 0;

    const rows = targetData.map(t => {
      if (filters.owner !== 'All' && t.OWNER !== filters.owner) return null;
      if (filters.type !== 'All' && t.TYPE !== filters.type) return null;
      if (filters.product !== 'All' && t.Product_Target !== filters.product) return null;

      const actual = agg[t.Product_Target]?.leadsSent || 0;
      const avgPerDay = actual / daysElapsed;
      const forecastAdd = avgPerDay * daysRemaining;
      const forecastTotal = actual + forecastAdd;
      const progress = t.Target_Lead_Sent ? (actual / t.Target_Lead_Sent) * 100 : 0;
      const forecastPercent = t.Target_Lead_Sent ? (forecastTotal / t.Target_Lead_Sent) * 100 : 0;

      totalTarget += t.Target_Lead_Sent || 0;
      totalActual += actual;
      totalForecast += forecastTotal;

      return { ...t, actual, avgPerDay, daysRemaining, forecastTotal, progress, forecastPercent };
    }).filter(Boolean);

    const sortedRows = rows.sort((a, b) => {
      const orderA = TYPE_ORDER[a.TYPE] || 99;
      const orderB = TYPE_ORDER[b.TYPE] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.OWNER.localeCompare(b.OWNER) || a.Product_Target.localeCompare(b.Product_Target);
    });

    const totalForecastPercent = totalTarget > 0 ? (totalForecast / totalTarget) * 100 : 0;

    return {
      rows: sortedRows,
      totals: { totalTarget, totalActual, totalForecast, totalForecastPercent }
    };
  }, [sentData, appendData, targetData, campaignConfig, filters]);

  // --- INTEREST ANALYSIS DATA ---
  const interestAnalysis = useMemo(() => {
    const grouped = {};

    appendData.forEach(row => {
      if (row.Day < dateRange.start || row.Day > dateRange.end) return;
      const targetInfo = targetData.find(t => t.Product_Target === row.Product)
        || { OWNER: 'Unknown', TYPE: 'Unknown', Target_CPL: 0 };

      if (filters.owner !== 'All' && targetInfo.OWNER !== filters.owner) return;
      if (filters.type !== 'All' && targetInfo.TYPE !== filters.type) return;
      if (filters.product !== 'All' && row.Product !== filters.product) return;

      const key = `${row.Product}|${row.Category_Normalized}`;
      if (!grouped[key]) grouped[key] = {
        Product: row.Product,
        Interest: row.Category_Normalized,
        Cost: 0,
        Impressions: 0,
        Leads: 0,
        Target_CPL: targetInfo.Target_CPL
      };

      grouped[key].Cost += row.Cost || 0;
      grouped[key].Impressions += row.Impressions || 0;
      grouped[key].Leads += row.Leads || 0; // Using Meta Leads for Interest Analysis usually
    });

    return Object.values(grouped).map(g => ({
      ...g,
      CPL: g.Leads > 0 ? g.Cost / g.Leads : 0,
      recommendation: getRecommendation(g.Leads > 0 ? g.Cost / g.Leads : 0, g.Target_CPL)
    })).sort((a, b) => b.Cost - a.Cost);
  }, [appendData, targetData, dateRange, filters]);

  // --- DAY OF WEEK ANALYSIS ---
  const dayOfWeekAnalysis = useMemo(() => {
    const days = Array(7).fill(0).map((_, i) => ({
      id: i, name: DAY_NAMES[i], cost: 0, leads: 0, count: 0
    }));

    mergedData.forEach(d => {
      const date = new Date(d.Day);
      if (isNaN(date.getTime())) return;
      const dayIdx = date.getDay();

      days[dayIdx].cost += d.Cost;
      days[dayIdx].leads += d.Leads; // Or Leads_Sent depending on preference
      days[dayIdx].count++;
    });

    return days.map(d => ({
      ...d,
      cpl: d.leads > 0 ? d.cost / d.leads : 0
    }));
  }, [mergedData]);


  // --- METRICS ---
  const metrics = useMemo(() => {
    let totalCost = 0, totalLeadsSent = 0, totalMetaLeads = 0, totalLeads = 0, totalTargetSent = 0;
    const distinctProducts = new Set();
    mergedData.forEach(d => {
      totalCost += d.Cost;
      totalLeadsSent += d.Leads_Sent;
      totalMetaLeads += d.Meta_Leads;
      totalLeads += d.Leads;
      if (!distinctProducts.has(d.Product)) {
        distinctProducts.add(d.Product);
        totalTargetSent += d.Target_Lead_Sent || 0;
      }
    });
    return {
      totalCost, totalLeadsSent, totalMetaLeads,
      cplMeta: totalLeads > 0 ? totalCost / totalLeads : 0,
      cplSent: totalLeadsSent > 0 ? totalCost / totalLeadsSent : 0,
      progress: totalTargetSent > 0 ? (totalLeadsSent / totalTargetSent) * 100 : 0,
      totalTargetSent
    };
  }, [mergedData]);

  const dailyChartData = useMemo(() => {
    const grouped = {};
    mergedData.forEach(d => {
      if (!grouped[d.Day]) grouped[d.Day] = { Day: d.Day, Leads_Sent: 0, Cost: 0, Meta_Leads: 0, Leads: 0 };
      grouped[d.Day].Leads_Sent += d.Leads_Sent;
      grouped[d.Day].Cost += d.Cost;
      grouped[d.Day].Meta_Leads += d.Meta_Leads;
      grouped[d.Day].Leads += d.Leads;
    });
    return Object.values(grouped).sort((a, b) => a.Day.localeCompare(b.Day)).map(d => {
      const date = new Date(d.Day);
      return {
        ...d,
        CPL_Sent: d.Leads_Sent > 0 ? d.Cost / d.Leads_Sent : 0,
        CPL_Meta: d.Leads > 0 ? d.Cost / d.Leads : 0,
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      };
    });
  }, [mergedData]);

  const uniqueOwners = [...new Set(targetData.map(d => d.OWNER))].sort();
  const uniqueTypes = [...new Set(targetData.map(d => d.TYPE))].sort();
  const uniqueProducts = [...new Set(targetData.map(d => d.Product_Target))].sort();
  const sortedUniqueTypes = uniqueTypes.sort((a, b) => (TYPE_ORDER[a] || 99) - (TYPE_ORDER[b] || 99));

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


        {/* Tab Content */}
        {activeTab === 'users' && user?.role === 'admin' && (
          <UserManagement users={users} onAddUser={onAddUser} onDeleteUser={onDeleteUser} currentUser={user} />
        )}

        {activeTab === 'smart-analysis' && (
          <CreativeAnalysis
            data={appendData}
            targetCpl={280}
          />
        )}

        {activeTab === 'smart-audience' && (
          <AudienceAnalysis
            data={appendData}
            targetCpl={280}
          />
        )}

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
                  {sortedUniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
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

        {activeTab === 'dashboard' ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard title="Total Leads Sent" value={metrics.totalLeadsSent.toLocaleString()} subtext={`Target: ${metrics.totalTargetSent.toLocaleString()}`} icon={Target} gradient="from-blue-500 to-cyan-500" />
              <KPICard title="Progress to Target" value={`${metrics.progress.toFixed(1)}%`} subtext="Completion Rate" icon={TrendingUp} gradient={metrics.progress >= 100 ? "from-emerald-500 to-teal-500" : "from-orange-500 to-amber-500"} trend={metrics.progress - 100} />
              <KPICard title="CPL (Sent)" value={`฿${metrics.cplSent.toFixed(0)}`} subtext={`Meta CPL: ฿${metrics.cplMeta.toFixed(0)}`} icon={DollarSign} gradient="from-violet-500 to-purple-500" />
              <KPICard title="Total Spending" value={`฿${metrics.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subtext="Media Cost" icon={Calculator} gradient="from-slate-700 to-slate-900" />
            </div>

            {/* Forecasting */}
            <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Timer className="w-32 h-32" />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 relative z-10">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Forecast & Projections</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                    <span>Based on run rate from</span>
                    <input type="date" className="bg-white/50 border border-slate-200 rounded px-2 py-0.5 text-xs text-indigo-600 font-bold" value={campaignConfig.start} onChange={e => setCampaignConfig(prev => ({ ...prev, start: e.target.value }))} />
                    <span>to</span>
                    <input type="date" className="bg-white/50 border border-slate-200 rounded px-2 py-0.5 text-xs text-indigo-600 font-bold" value={campaignConfig.end} onChange={e => setCampaignConfig(prev => ({ ...prev, end: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto relative z-10 rounded-xl border border-white/40 shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-indigo-50/80 text-xs uppercase font-bold text-indigo-900">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-xl">Type</th>
                      <th className="px-6 py-4">Owner</th>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4 text-right">Target</th>
                      <th className="px-6 py-4 text-right">Actual</th>
                      <th className="px-6 py-4 text-right">Forecast</th>
                      <th className="px-6 py-4 text-center rounded-tr-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white/60">
                    {forecastData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-500">{row.TYPE}</td>
                        <td className="px-6 py-4 text-slate-600">{row.OWNER}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{row.Product_Target}</td>
                        <td className="px-6 py-4 text-right text-slate-500">{row.Target_Lead_Sent.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-indigo-600">{row.actual.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-violet-600">{Math.round(row.forecastTotal).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.forecastPercent >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {row.forecastPercent.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-100/50 font-bold border-t border-indigo-200">
                      <td colSpan={3} className="px-6 py-4 text-indigo-900 text-right">TOTALS</td>
                      <td className="px-6 py-4 text-right text-indigo-900">{forecastData.totals.totalTarget?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-900">{forecastData.totals.totalActual?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-900">{Math.round(forecastData.totals.totalForecast || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${forecastData.totals.totalForecastPercent >= 100 ? 'bg-emerald-600 text-white' : 'bg-rose-500 text-white'}`}>
                          {forecastData.totals.totalForecastPercent?.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Daily Lead Trend
                </h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="Day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontFamily: 'Outfit' }}
                      />
                      <Bar dataKey="Leads_Sent" fill="url(#colorLeads)" radius={[4, 4, 0, 0]}>
                        {dailyChartData.map((entry, i) => <Cell key={i} fill={entry.isWeekend ? "#818cf8" : "#4f46e5"} />)}
                      </Bar>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  Cost Efficiency
                </h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="Day" hide />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val) => `฿${val.toFixed(0)}`}
                      />
                      <Legend iconType="circle" />
                      <Line type="monotone" dataKey="CPL_Meta" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="CPL_Sent" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/30 bg-white/40">
                <h3 className="text-lg font-bold text-slate-800">Performance Detail</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold border-b border-white/50">
                    <tr>
                      <th className="px-6 py-4 text-left">Product</th>
                      <th className="px-6 py-4 text-right">Cost</th>
                      <th className="px-6 py-4 text-right text-indigo-600">FB Leads</th>
                      <th className="px-6 py-4 text-right text-orange-600">Sent Leads</th>
                      <th className="px-6 py-4 text-right">Target</th>
                      <th className="px-6 py-4 text-center">Progress</th>
                      <th className="px-6 py-4 text-right text-indigo-600">CPL (FB)</th>
                      <th className="px-6 py-4 text-right text-orange-600">CPL (Sent)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/40">
                    {Object.values(mergedData.reduce((acc, curr) => {
                      const key = `${curr.Product}`;
                      if (!acc[key]) acc[key] = { ...curr, Cost: 0, Leads_Sent: 0, Leads: 0, Target: curr.Target_Lead_Sent };
                      acc[key].Cost += curr.Cost;
                      acc[key].Leads_Sent += curr.Leads_Sent;
                      acc[key].Leads += curr.Leads; // Aggregate FB Leads
                      return acc;
                    }, {}))
                      .map((row, idx) => {
                        const cplSent = row.Leads_Sent ? row.Cost / row.Leads_Sent : 0;
                        const cplFb = row.Leads ? row.Cost / row.Leads : 0;
                        const percent = row.Target ? (row.Leads_Sent / row.Target) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-white/60 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{row.Product}</td>
                            <td className="px-6 py-4 text-right text-slate-500">฿{row.Cost.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-medium text-indigo-600">{row.Leads.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-medium text-orange-600">{row.Leads_Sent.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right text-slate-400">{row.Target.toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                </div>
                                <span className="text-xs font-bold w-9">{percent.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-indigo-600">฿{cplFb.toFixed(0)}</td>
                            <td className="px-6 py-4 text-right font-medium text-orange-600">฿{cplSent.toFixed(0)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600" />
              Campaign Intelligence
            </h2>

            {/* Interest Analysis */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/30 bg-white/40 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Interest & Audience Performance</h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold">Based on Meta Leads</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-xs uppercase text-slate-500 font-semibold border-b border-white/50">
                    <tr>
                      <th className="px-6 py-4 text-left">Product</th>
                      <th className="px-6 py-4 text-left">Interest Category (Normalized)</th>
                      <th className="px-6 py-4 text-right">Spend</th>
                      <th className="px-6 py-4 text-right">Leads</th>
                      <th className="px-6 py-4 text-right">CPL</th>
                      <th className="px-6 py-4 text-left">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/40">
                    {interestAnalysis.map((row, idx) => {
                      const RecIcon = row.recommendation.icon || Activity;
                      return (
                        <tr key={idx} className="hover:bg-white/60 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-700">{row.Product}</td>
                          <td className="px-6 py-4 font-bold text-indigo-900">{row.Interest}</td>
                          <td className="px-6 py-4 text-right text-slate-500">฿{row.Cost.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-medium text-slate-800">{row.Leads}</td>
                          <td className={`px-6 py-4 text-right font-bold ${row.Leads > 0 ? (row.CPL < row.Target_CPL ? 'text-green-600' : 'text-red-600') : 'text-slate-400'}`}>
                            ฿{row.CPL.toFixed(0)} <span className="text-[10px] text-slate-400 font-normal">/ {row.Target_CPL}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${row.recommendation.color}`}>
                              <RecIcon className="w-3.5 h-3.5" />
                              {row.recommendation.text}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Day of Week & Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Day of Week Performance</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayOfWeekAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis yAxisId="left" orientation="left" stroke="#6366f1" axisLine={false} tickLine={false} fontSize={10} />
                      <YAxis yAxisId="right" orientation="right" stroke="#f97316" axisLine={false} tickLine={false} fontSize={10} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px' }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL" stroke="#f97316" strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Strategic Insights</h3>
                <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg h-fit text-emerald-600"><CheckCircle className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-emerald-900 text-sm">Best Operating Day</h4>
                      <p className="text-xs text-emerald-700 mt-1">Sundays have the lowest CPL (฿150) and high volume. Consider increasing budget by 20% on weekends.</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg h-fit text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm">Target At Risk</h4>
                      <p className="text-xs text-amber-700 mt-1">"Saving Happy" is currently at 85% of target pace. Needs 15 more leads/day to hit monthly goal.</p>
                    </div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg h-fit text-indigo-600"><Zap className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-indigo-900 text-sm">Winning Creative</h4>
                      <p className="text-xs text-indigo-700 mt-1">"Senior-Morradok-Img" has 2x higher CTR than video formats. Suggest adapting static image format to other products.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [usersList, setUsersList] = useState(DEFAULT_USERS);

  // --- Firebase Logic ---
  useEffect(() => {
    // Subscribe to real-time updates from Firestore
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const cloudUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Merge hardcoded admins with cloud users (Hardcoded takes precedence for Login check, but here we just list them)
      // Actually, for the list, we show both.
      // But let's filter out if cloud users somehow duplicate the hardcoded ones to avoid confusion, though unlikely with different IDs.
      setUsersList([...DEFAULT_USERS, ...cloudUsers]);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auth = localStorage.getItem('isAuthenticated');
    const savedUser = localStorage.getItem('user');

    if (auth === 'true' && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (authedUser) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(authedUser));
    setIsAuthenticated(true);
    setUser(authedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleAddUser = async (newUser) => {
    try {
      await addDoc(collection(db, "users"), newUser);
      // No need to update state manually, onSnapshot will handle it
    } catch (e) {
      console.error("Error adding user: ", e);
      alert("Error adding user to Cloud: " + e.message);
    }
  };

  const handleDeleteUser = async (id, username) => {
    // Prevent deleting hardcoded admins via ID check (hardcoded don't have Firestore ID)
    if (!id) {
      alert("Cannot delete built-in admin users.");
      return;
    }

    if (confirm(`Are you sure you want to delete user ${username}?`)) {
      try {
        await deleteDoc(doc(db, "users", id));
      } catch (e) {
        console.error("Error deleting user: ", e);
        alert("Error deleting user: " + e.message);
      }
    }
  };

  return isAuthenticated
    ? <Dashboard
      user={user}
      onLogout={handleLogout}
      users={usersList}
      onAddUser={handleAddUser}
      onDeleteUser={handleDeleteUser}
    />
    : <LoginPage
      onLogin={handleLogin}
      users={usersList}
    />;
}

export default App;
