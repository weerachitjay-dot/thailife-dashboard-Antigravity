import * as XLSX from 'xlsx';
import { useCallback } from 'react';

/**
 * Hook to export data to Excel
 * @returns {Object} exportToExcel function
 */
export const useExcelExport = () => {
    /**
     * Export data to Excel
     * @param {Array} data - Array of objects to export
     * @param {string} fileName - Name of the file (without extension)
     * @param {Array} columns - Optional array of column definitions { key, label, formatter }
     */
    const exportToExcel = useCallback((data, fileName, columns = null) => {
        if (!data || data.length === 0) {
            console.warn('No data to export');
            return;
        }

        // Process data if columns are provided
        const processedData = columns
            ? data.map(row => {
                const newRow = {};
                columns.forEach(col => {
                    const value = row[col.key];
                    // Use formatter if provided, otherwise raw value
                    newRow[col.label] = col.formatter ? col.formatter(value, row) : value;
                });
                return newRow;
            })
            : data;

        // Create workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(processedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        // Auto-width columns (basic)
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const wscols = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            wscols.push({ wch: 20 });
        }
        worksheet['!cols'] = wscols;

        // Write file buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

        // Create Blob and Download
        const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    }, []);

    return { exportToExcel };
};
