
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export const DashboardFilters = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentProduct = searchParams.get('product') || 'All';
    const currentStart = searchParams.get('start') || '';
    const currentEnd = searchParams.get('end') || '';

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'All') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        router.push(`/?${params.toString()}`);
    };

    return (
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                    className="border rounded-md px-3 py-2 text-sm"
                    value={currentProduct}
                    onChange={(e) => handleFilterChange('product', e.target.value)}
                >
                    <option value="All">All Products</option>
                    <option value="SENIOR-MORRADOK">SENIOR-MORRADOK</option>
                    <option value="SAVING-HAPPY">SAVING-HAPPY</option>
                    {/* Add more dynamically if passed as props */}
                </select>
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                    type="date"
                    className="border rounded-md px-3 py-2 text-sm"
                    value={currentStart}
                    onChange={(e) => handleFilterChange('start', e.target.value)}
                />
            </div>

            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                    type="date"
                    className="border rounded-md px-3 py-2 text-sm"
                    value={currentEnd}
                    onChange={(e) => handleFilterChange('end', e.target.value)}
                />
            </div>

            <div className="flex flex-col justify-end">
                <button
                    className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800"
                    onClick={() => router.push('/')}
                >
                    Reset
                </button>
            </div>
        </div>
    );
};
