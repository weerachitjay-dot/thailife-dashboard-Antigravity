import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

const DateRangePicker = ({ startDate, endDate, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Helpers
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Display formatter (e.g., 09 Dec)
    const displayDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePreset = (days) => {
        const end = new Date();
        const start = new Date();

        if (days === 'yesterday') {
            end.setDate(end.getDate() - 1);
            start.setDate(start.getDate() - 1);
        } else if (days === 'today') {
            // start & end are already today
        } else {
            // Last X days (including today)
            start.setDate(end.getDate() - (days - 1));
        }

        onChange({
            start: formatDate(start),
            end: formatDate(end)
        });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm hover:border-indigo-300 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 transition-all min-w-[200px] justify-between group"
            >
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>
                        {startDate ? `${displayDate(startDate)} - ${displayDate(endDate || startDate)}` : 'Select Date Range'}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-4 z-[100] flex flex-col sm:flex-row gap-4 w-[300px] sm:w-auto animate-fade-in-up">

                    {/* Presets Column */}
                    <div className="flex flex-col gap-1 sm:w-40 border-b sm:border-b-0 sm:border-r border-slate-100 pb-4 sm:pb-0 sm:pr-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Presets</span>
                        {[
                            { label: 'Today', val: 'today' },
                            { label: 'Yesterday', val: 'yesterday' },
                            { label: 'Last 7 Days', val: 7 },
                            { label: 'Last 14 Days', val: 14 },
                            { label: 'Last 28 Days', val: 28 },
                            { label: 'Last 30 Days', val: 30 },
                        ].map(preset => (
                            <button
                                key={preset.label}
                                onClick={() => handlePreset(preset.val)}
                                className="text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-colors text-slate-600"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom Range Column */}
                    <div className="flex flex-col gap-3 min-w-[200px]">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custom Range</span>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => onChange({ start: e.target.value, end: endDate })}
                                className="w-full glass-input px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-200 focus:border-indigo-400 outline-none"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => onChange({ start: startDate, end: e.target.value })}
                                className="w-full glass-input px-3 py-2 rounded-lg text-sm text-slate-700 border border-slate-200 focus:border-indigo-400 outline-none"
                            />
                        </div>

                        <button
                            onClick={() => setIsOpen(false)}
                            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
