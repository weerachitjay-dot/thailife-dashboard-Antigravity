import React, { createContext, useContext, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { SHEET_CONFIG, SNIPPET_APPEND, SNIPPET_APPENDSENT, SNIPPET_TARGET, SNIPPET_APPEND_TIME } from '../utils/constants';
import { parseCSV, processAppendData, processSentData } from '../utils/formatters';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dataSource, setDataSource] = useState('Loading...');
    const [rawData, setRawData] = useState({ append: [], sent: [], target: [], appendTime: [] });
    const [appendData, setAppendData] = useState([]);
    const [sentData, setSentData] = useState([]);
    const [targetData, setTargetData] = useState([]);
    const [appendTimeData, setAppendTimeData] = useState([]);

    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filters, setFilters] = useState({
        owner: 'All',
        type: 'All',
        product: 'All'
    });

    // Campaign Config for "Round" logic (Future proofing as per strict requirements)
    // For now, mirroring App.jsx defaults but we will make this dynamic later
    const [campaignConfig, setCampaignConfig] = useState({ start: '2025-11-01', end: '2025-11-30' });

    useEffect(() => {
        const loadDefaultData = async () => {
            try {
                const fetchData = async (baseName) => {
                    const gid = SHEET_CONFIG.GIDS[baseName];

                    // 1. Try Google Sheet Proxy
                    if (gid && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
                        try {
                            const apiRes = await fetch(`/api/sheet?gid=${gid}`);
                            const contentType = apiRes.headers.get("content-type");
                            if (apiRes.ok && contentType && !contentType.includes("text/html")) {
                                setDataSource('Online (Google Sheets)');
                                return { text: await apiRes.text(), type: 'api-csv' };
                            }
                        } catch (e) {
                            console.log('API fetch failed, fallback to local');
                        }
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

                const [appendRes, sentRes, targetRes, appendTimeRes] = await Promise.all([
                    fetchData('append'),
                    fetchData('sent'),
                    fetchData('target'),
                    fetchData('append_time')
                ]);

                const appendText = appendRes ? appendRes.text : SNIPPET_APPEND;
                const sentText = sentRes ? sentRes.text : SNIPPET_APPENDSENT;
                const targetText = targetRes ? targetRes.text : SNIPPET_TARGET;
                const appendTimeText = appendTimeRes ? appendTimeRes.text : SNIPPET_APPEND_TIME;

                if (!appendRes && !sentRes && !targetRes && !appendTimeRes) {
                    setDataSource('Demo Data (Snippets)');
                }

                const parsedAppend = parseCSV(appendText);
                const parsedSent = parseCSV(sentText);
                const parsedTarget = parseCSV(targetText);
                const parsedAppendTime = parseCSV(appendTimeText);

                setRawData({ append: parsedAppend, sent: parsedSent, target: parsedTarget, appendTime: parsedAppendTime });

                const processedAppend = processAppendData(parsedAppend);
                // Process time data earlier to include in date range
                const processedAppendTime = processAppendData(parsedAppendTime);

                setAppendData(processedAppend);
                setAppendTimeData(processedAppendTime);

                // Auto-set Date Range (Union of both datasets)
                const appendDates = processedAppend.map(d => d.Day).filter(Boolean);
                const timeDates = processedAppendTime.map(d => d.Day).filter(Boolean);
                const allDates = [...new Set([...appendDates, ...timeDates])].sort();

                if (allDates.length) {
                    setDateRange({ start: allDates[0], end: allDates[allDates.length - 1] });
                    // Also update campaign config default
                    setCampaignConfig(prev => ({ ...prev, start: allDates[0], end: allDates[allDates.length - 1] }));
                }

                setSentData(processSentData(parsedSent));
                setTargetData(parsedTarget);

            } catch (err) {
                console.error("Error loading data:", err);
                setDataSource('Error Loading Data');
            }
        };

        loadDefaultData();
    }, []);

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        // Helper to process content
        const processContent = (csvText) => {
            const parsed = parseCSV(csvText);
            if (type === 'append') {
                const processed = processAppendData(parsed);
                setAppendData(processed);
                setRawData(prev => ({ ...prev, append: parsed }));

                // Auto-update Date Range on upload
                const dates = processed.map(d => d.Day).filter(Boolean).sort();
                if (dates.length) {
                    setDateRange({ start: dates[0], end: dates[dates.length - 1] });
                }

            } else if (type === 'sent') {
                setSentData(processSentData(parsed));
                setRawData(prev => ({ ...prev, sent: parsed }));
            } else if (type === 'target') {
                setTargetData(parsed);
                setRawData(prev => ({ ...prev, target: parsed }));
            } else if (type === 'append_time') {
                setAppendTimeData(processAppendData(parsed));
                setRawData(prev => ({ ...prev, appendTime: parsed }));
            }
            setDataSource('Manual Upload');
        };

        reader.onload = (evt) => {
            const content = evt.target.result;
            if (file.name.endsWith('.xlsx')) {
                const workbook = XLSX.read(content, { type: 'binary' });
                const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
                processContent(csvText);
            } else {
                processContent(content);
            }
        };

        if (file.name.endsWith('.xlsx')) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    };

    return (
        <DataContext.Provider value={{
            dataSource,
            rawData,
            appendData,
            sentData,
            targetData,
            appendTimeData,
            campaignConfig,
            setCampaignConfig, // Allow updating config
            handleFileUpload,
            filters, setFilters,
            dateRange, setDateRange
        }}>
            {children}
        </DataContext.Provider>
    );
};
