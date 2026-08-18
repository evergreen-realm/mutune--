import * as XLSX from 'xlsx';

/**
 * Export tabular data to an Excel (.xlsx) file.
 * 
 * @param {Array<Object>} data  – array of row objects
 * @param {Array<{key: string, label: string}>} columns – column definitions
 * @param {string} filename – base filename (date is appended automatically)
 * @param {string} [sheetName='Report'] – Excel sheet tab name
 */
export function exportToExcel(data, columns, filename, sheetName = 'Report') {
  // Build rows with header labels
  const header = columns.map(c => c.label);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Auto-width columns
  ws['!cols'] = columns.map(col => ({
    wch: Math.max(
      col.label.length,
      ...rows.map(r => String(r[columns.indexOf(col)] ?? '').length)
    ) + 2
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export a multi-sheet workbook.
 * 
 * @param {Array<{name: string, data: Array<Object>, columns: Array<{key: string, label: string}>}>} sheets
 * @param {string} filename
 */
export function exportMultiSheetExcel(sheets, filename) {
  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const header = sheet.columns.map(c => c.label);
    const rows = sheet.data.map(row => sheet.columns.map(c => row[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);

    ws['!cols'] = sheet.columns.map(col => ({
      wch: Math.max(col.label.length, 15) + 2
    }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel 31-char limit
  });

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
