import * as XLSX from 'xlsx';
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

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Raw JSON conversion
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        
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
