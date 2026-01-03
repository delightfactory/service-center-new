// ============================================================
// Export Utilities
// ============================================================

/**
 * Convert data to CSV format and download
 */
export function exportToCSV(
    data: Record<string, any>[],
    filename: string,
    headers?: { key: string; label: string }[]
): void {
    if (!data || data.length === 0) {
        console.warn('No data to export');
        return;
    }

    // Determine columns
    const columns = headers || Object.keys(data[0]).map(key => ({ key, label: key }));

    // Build CSV content
    const headerRow = columns.map(col => `"${col.label}"`).join(',');
    const dataRows = data.map(row =>
        columns.map(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            return String(value);
        }).join(',')
    );

    // Add BOM for proper Arabic support in Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + [headerRow, ...dataRows].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Print current page or specific element
 */
export function printElement(elementId?: string): void {
    if (elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`Element with id "${elementId}" not found`);
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>طباعة التقرير</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background-color: #f5f5f5; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .date { color: #666; font-size: 12px; }
                    @media print { body { -webkit-print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>تقرير</h1>
                    <p class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                ${element.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    } else {
        window.print();
    }
}

/**
 * Export table data to Excel-compatible format (HTML table)
 */
export function exportToExcel(
    data: Record<string, any>[],
    filename: string,
    headers?: { key: string; label: string }[],
    title?: string
): void {
    if (!data || data.length === 0) {
        console.warn('No data to export');
        return;
    }

    const columns = headers || Object.keys(data[0]).map(key => ({ key, label: key }));

    const tableHTML = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Report</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayRightToLeft/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            ${title ? `<h2>${title}</h2>` : ''}
            <table border="1">
                <thead>
                    <tr>${columns.map(col => `<th>${col.label}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.map(row =>
        `<tr>${columns.map(col => {
            const value = row[col.key];
            return `<td>${value ?? ''}</td>`;
        }).join('')}</tr>`
    ).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
