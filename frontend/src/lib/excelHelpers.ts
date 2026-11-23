import ExcelJS from "exceljs";

function sanitizeSheetName(name: string): string {
    const cleaned = (name || "Sayfa1").replace(/[:\\/?*[\]]/g, "_").trim();
    return cleaned.slice(0, 31) || "Sayfa1";
}

function getCellPrimitiveValue(value: ExcelJS.CellValue): unknown {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if ("result" in value && value.result !== undefined) return value.result;
        if ("richText" in value && Array.isArray(value.richText)) {
            return value.richText.map((part) => part.text).join("");
        }
        if ("text" in value && value.text !== undefined) return value.text;
        if (value instanceof Date) return value.toISOString().slice(0, 10);
    }
    return value;
}

export function worksheetToMatrix(ws: ExcelJS.Worksheet): unknown[][] {
    const rows: unknown[][] = [];
    let maxCols = 0;
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const vals: unknown[] = [];
        const colCount = Math.max(row.cellCount, row.actualCellCount);
        for (let c = 1; c <= colCount; c++) {
            vals.push(getCellPrimitiveValue(row.getCell(c).value));
        }
        maxCols = Math.max(maxCols, vals.length);
        while (rows.length < rowNumber - 1) {
            rows.push([]);
        }
        rows.push(vals);
    });
    return rows.map((r) => {
        while (r.length < maxCols) r.push("");
        return r;
    });
}

export function parseCsvMatrix(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === "," || ch === ";") {
            row.push(current);
            current = "";
        } else if (ch === "\r" && next === "\n") {
            row.push(current);
            rows.push(row);
            row = [];
            current = "";
            i++;
        } else if (ch === "\n" || ch === "\r") {
            row.push(current);
            rows.push(row);
            row = [];
            current = "";
        } else {
            current += ch;
        }
    }

    if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
    }
    return rows;
}

export async function downloadExcelWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

export async function exportJsonToExcel(
    records: Record<string, unknown>[],
    sheetName: string,
    filename: string,
    colWidths?: number[]
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
    if (records.length > 0) {
        const headers = Object.keys(records[0]);
        const headerRow = ws.addRow(headers);
        headerRow.font = { bold: true };
        for (const item of records) {
            ws.addRow(headers.map((h) => item[h] ?? ""));
        }
        if (colWidths) {
            colWidths.forEach((wch, idx) => {
                ws.getColumn(idx + 1).width = wch;
            });
        }
    }
    await downloadExcelWorkbook(wb, filename);
}

interface FormulaCellInput {
    v?: ExcelJS.CellValue;
    f?: string;
    z?: string;
}

function isFormulaCellInput(value: unknown): value is FormulaCellInput {
    return (
        value !== null &&
        typeof value === "object" &&
        ("v" in value || "f" in value || "z" in value)
    );
}

export async function exportAoaToExcel(
    data: unknown[][],
    sheetName: string,
    filename: string
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
    for (const rawRow of data) {
        if (!rawRow || rawRow.length === 0) {
            ws.addRow([]);
            continue;
        }
        const row = ws.addRow([]);
        rawRow.forEach((cellInput, idx) => {
            const cell = row.getCell(idx + 1);
            if (isFormulaCellInput(cellInput)) {
                if (cellInput.f) {
                    cell.value = { formula: cellInput.f };
                } else {
                    cell.value = cellInput.v ?? "";
                }
                if (cellInput.z) {
                    cell.numFmt = cellInput.z;
                }
            } else {
                cell.value = (cellInput as ExcelJS.CellValue) ?? "";
            }
        });
    }
    await downloadExcelWorkbook(wb, filename);
}
