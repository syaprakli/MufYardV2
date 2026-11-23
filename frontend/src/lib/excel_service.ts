import ExcelJS from 'exceljs';
import { worksheetToMatrix } from './excelHelpers';
import type { InspectorCreate } from './api/inspectors';

export interface ExcelImportResult {
  data: InspectorCreate[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

/**
 * Parses an Excel file and maps columns to InspectorCreate interface.
 * Expected headers: "Ad Soyad", "E-posta", "Ünvan", "Dahili No", "Cep No", "Kat/Oda"
 */
export async function parseInspectorsExcel(file: File): Promise<ExcelImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          resolve({ data: [], summary: { total: 0, valid: 0, invalid: 0 } });
          return;
        }
        const matrix = worksheetToMatrix(worksheet);
        const headers = (matrix[0] || []).map((h: any) => String(h ?? '').trim());
        const rawRows: Record<string, any>[] = matrix.slice(1).map((vals) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            if (h) obj[h] = vals[idx] ?? '';
          });
          return obj;
        });
        
        const validDocs: InspectorCreate[] = [];
        let invalidCount = 0;

        rawRows.forEach(row => {
          // Normalize column names (handling potential spaces or casing)
          const name = row["Ad Soyad"] || row["ad soyad"] || row["Name"] || row["Adı Soyadı"];
          const email = row["E-posta"] || row["e-posta"] || row["Email"] || row["E-Posta"];
          const title = row["Ünvan"] || row["unvan"] || row["Title"] || "Müfettiş";
          const extension = row["Dahili No"] || row["dahili"] || row["Dahili"];
          const phone = row["Cep No"] || row["cep"] || row["Cep Telefonu"] || row["Phone"];
          const room = row["Kat/Oda"] || row["oda"] || row["Oda No"] || row["Kat"];

          if (name && email) {
            validDocs.push({
              name: String(name).trim(),
              email: String(email).trim().toLowerCase(),
              title: String(title).trim(),
              extension: extension ? String(extension).trim() : undefined,
              phone: phone ? String(phone).trim() : undefined,
              room: room ? String(room).trim() : undefined
            });
          } else {
            invalidCount++;
          }
        });

        resolve({
          data: validDocs,
          summary: {
            total: rawRows.length,
            valid: validDocs.length,
            invalid: invalidCount
          }
        });
      } catch (err) {
        reject(new Error("Excel dosyası okunamadı. Lütfen formatı kontrol edin."));
      }
    };

    reader.onerror = () => reject(new Error("Dosya okuma hatası."));
    reader.readAsArrayBuffer(file);
  });
}
