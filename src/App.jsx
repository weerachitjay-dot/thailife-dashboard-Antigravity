import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, ReferenceArea, ReferenceLine, Cell, LabelList, PieChart, Pie
} from 'recharts';
import {
  Upload, Filter, Calculator, Calendar, DollarSign, Users, Target, TrendingUp,
  AlertCircle, FileSpreadsheet, Timer, ArrowUpRight, ArrowDownRight, Activity,
  Zap, Brain, ChevronUp, ChevronDown, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appendData, setAppendData] = useState([]);
  const [sentData, setSentData] = useState([]);
  const [targetData, setTargetData] = useState([]);

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
        // Helper to fetch and parse either xlsx or csv
        const fetchData = async (baseName) => {
          // Try XLSX first
          try {
            const xlsxRes = await fetch(`/data/${baseName}.xlsx`);
            if (xlsxRes.ok) {
              const buffer = await xlsxRes.arrayBuffer();
              const workbook = XLSX.read(buffer, { type: 'array' });
              const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
              return { text: csvText, type: 'xlsx' };
            }
          } catch (e) {
            // Ignore xlsx error, proceed to csv
          }

          // Try CSV
          try {
            const csvRes = await fetch(`/data/${baseName}.csv`);
            if (csvRes.ok) {
              return { text: await csvRes.text(), type: 'csv' };
            }
          } catch (e) {
            return null;
          }
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
          setAppendData(processAppendData(parseCSV(SNIPPET_APPEND)));
        }

        setSentData(sentRes && sentRes.text ? processSentData(parseCSV(sentRes.text)) : processSentData(parseCSV(SNIPPET_APPENDSENT)));
        setTargetData(targetRes && targetRes.text ? parseCSV(targetRes.text) : parseCSV(SNIPPET_TARGET));

      } catch (error) {
        console.error("Failed to load auto data", error);
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
            <p className="text-slate-500 mt-2 font-medium">Real-time insight into lead distribution and campaign performance.</p>
          </div>
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
        </div>

        {/* View Switcher */}
        <div className="flex justify-center">
          <div className="glass-card p-1 rounded-xl inline-flex">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              Overview Dashboard
            </button>
            <button
              onClick={() => setActiveTab('intelligence')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'intelligence' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              Campaign Intelligence
            </button>
          </div>
        </div>

        {/* Controls */}
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
                      <h4 className="font-bold text-emerald-900">Top Performing Interest</h4>
                      <p className="text-sm text-emerald-700 mt-1">
                        "{interestAnalysis[0]?.Interest}" is generating the lowest CPL ({interestAnalysis[0]?.CPL.toFixed(0)}). Consider increasing budget by 20%.
                      </p>
                    </div>
                  </div>

                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex gap-3">
                    <div className="p-2 bg-rose-100 rounded-lg h-fit text-rose-600"><AlertTriangle className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-rose-900">Cost Alert</h4>
                      <p className="text-sm text-rose-700 mt-1">
                        Current CPL of ฿{metrics.cplSent.toFixed(0)} is {metrics.cplSent > metrics.cplMeta ? 'higher' : 'lower'} than Meta reported CPL.
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-blue-900">Best Day to Scale</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        {dayOfWeekAnalysis.sort((a, b) => (a.cpl || 9999) - (b.cpl || 9999))[0]?.name} has the lowest CPL historically.
                      </p>
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

export default App;
