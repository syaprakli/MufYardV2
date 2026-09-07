import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

// 1- SPORCU SAYILARI SATIRLARI
export const SPORCU_ROW_DEFS = [
    { key: "lisansli", label: "Lisanslı Sporcu Sayısı (Bayan/Bay)" },
    { key: "faal", label: "Faal (Bayan/Bay)" },
    { key: "milli", label: "Milli Olmuş Sporcu Sayısı" },
    { key: "turkiye1", label: "Türkiye 1'incisi Olmuş Sporcu Sayısı (1)" },
    { key: "ulusalDerece", label: "Ulusal Derece Alan Sporcu Sayısı (1)" },
    { key: "uluslararasiDerece", label: "Uluslararası Derece Alan Sporcu Sayısı (2)" }
];

// 3- HAKEM DURUMU SATIRLARI
export const HAKEM_ROW_DEFS = [
    { key: "aday", label: "Aday (1)" },
    { key: "bolge", label: "Bölge (1)" },
    { key: "milli", label: "Milli (1)" },
    { key: "ulusal", label: "Ulusal (1)" },
    { key: "uluslararasi", label: "Uluslararası (1)" },
    { key: "toplam", label: "Toplam" }
];

// 4- KULÜP SAYILARI SATIRLARI
export const KULUP_ROW_DEFS = [
    { key: "faalKulup", label: "Faal Kulüp Sayısı" },
    { key: "faalBrans", label: "Faal Branş Sayısı (1)" }
];

// 5- GENÇLİK HİZMETLERİ SATIRLARI
export const GENCLIK_ROW_DEFS = [
    { key: "merkezSayisi", label: "Gençlik Merkezi Sayısı" },
    { key: "kayitliUye", label: "Kayıtlı Üye Sayısı" },
    { key: "aktifUye", label: "Aktif Üye Sayısı" },
    { key: "ulusalFaaliyet", label: "Ulusal Faaliyetlere Katılan Üye Sayısı" },
    { key: "uluslararasiFaaliyet", label: "Uluslararası Faal. Katılan Üye Sayısı" },
    { key: "kampGonderilen", label: "Gençlik Kamplarına Gönderilenlerin Sayısı" },
    { key: "liderSayisi", label: "Lider sayısı" },
    { key: "noktaSayisi", label: "Nokta sayısı" }
];

// 6- PERSONEL DURUMU - İDARİ
export const IDARI_PERSONEL_ROW_DEFS = [
    { key: "ilMudur", label: "İl Müdürü" },
    { key: "hizmetMudur", label: "Hizmet Müdürü" },
    { key: "subeMudur", label: "Şube Müdürü" },
    { key: "sef", label: "Şef" },
    { key: "muhendis", label: "Mühendis" },
    { key: "arastirmaci", label: "Araştırmacı" },
    { key: "memur", label: "Memur" },
    { key: "sozlesmeliToplam", label: "(1) Sözleşmeli Personel sayısı", isBold: true },
    { key: "sozlesmeliAntrenor", label: "  • Sözleşmeli Antrenör" },
    { key: "sozlesmeliUzman", label: "  • Sözleşmeli Spor Eğitim Uzmanı" },
    { key: "sozlesmeli4C", label: "  • Sözleşmeli İdari Destek Personeli 4/C" },
    { key: "sozlesmeliYurt", label: "  • Sözleşmeli Yurt Yönetim Personeli" },
    { key: "surekliIsci", label: "Sürekli İşçi Kadrosuna geçenlerin sayısı" },
    { key: "yardimciHizmet", label: "Yardımcı hizmet personeli sayısı" }
];

// 6- İLÇE PERSONEL
export const ILCE_PERSONEL_ROW_DEFS = [
    { key: "ilceMudur", label: "İlçe Müdürü" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" }
];

// 6- YURT PERSONEL
export const YURT_PERSONEL_ROW_DEFS = [
    { key: "yurtMudur", label: "Yurt Müdürü" },
    { key: "yurtMudurYrd", label: "Yurt Müdür Yrd." },
    { key: "yurtYonetimMemuru", label: "Yurt Yönetim Memuru" },
    { key: "yurtYonetimPersoneli", label: "Yurt Yönetim Personeli" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" }
];

// 6- GENÇLİK MERKEZİ PERSONEL
export const GM_PERSONEL_ROW_DEFS = [
    { key: "gmMudur", label: "Gençlik Merkezi Müdürü" },
    { key: "lider", label: "Lider" },
    { key: "nokta", label: "Nokta" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" }
];

// 7- GİDERLER SATIRLARI
export const GIDER_ROW_DEFS = [
    { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
    { key: "yatirim", label: "Yatırım Giderleri" },
    { key: "bakimOnarim", label: "Bakım Onarım" },
    { key: "personel", label: "Personel Giderleri" },
    { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
    { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
    { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
    { key: "sosyalTransfer", label: "Sosyal Transferler" },
    { key: "hizmetAlimi", label: "Hizmet Alımı" },
    { key: "toplam", label: "TOPLAM", isBold: true }
];

// 8- GELİRLER SATIRLARI
export const GELIR_ROW_DEFS = [
    { key: "gsgm", label: "GSGM Yardımı" },
    { key: "ozelIdare", label: "İl Özel İdaresinden Alınan Nakit Yardımlar" },
    { key: "ozelGelir", label: "Özel Gelirler" },
    { key: "toplam", label: "Toplam", isBold: true }
];

// 9- TESİSLER - B DAĞILIMI
export const TESIS_YILLARA_GORE_ROW_DEFS = [
    { key: "sporSalonu", label: "Spor salonu" },
    { key: "yurt", label: "Yurt" },
    { key: "yuzmeHavuzu", label: "Yüzme havuzu" },
    { key: "bagimsizAtletizm", label: "Bağımsız Atletizm sahası" },
    { key: "stadyum", label: "Stadyum" },
    { key: "futbolSahasi", label: "Futbol sahası" },
    { key: "kayak", label: "Kayak tesisi" },
    { key: "poligon", label: "Poligon" },
    { key: "kampEgitim", label: "Kamp Eğitim Merkezi" },
    { key: "sporcuEgitim", label: "Sporcu Eğitim Merkezi (1)" },
    { key: "digerKurum", label: "Diğer kurumların tesisleri (2)" },
    { key: "diger", label: "Diğer tesisler (3)" }
];

// STİL VE RENK PALETİ (Kurumsal & Modern)
const COLORS = {
    NAVY_DARK: "FF1E3A8A",      // Kurumsal Koyu Lacivert (Başlık)
    NAVY_LIGHT: "FF2563EB",     // Canlı Mavi (Alt Başlık / Vurgu)
    HEADER_BG: "FF1E40AF",      // Tablo Kolon Başlıkları
    HEADER_TEXT: "FFFFFFFF",    // Beyaz Yazı
    SECTION_BG: "FF0F172A",     // Koyu Bölüm Şeridi
    ZEBRA_BG: "FFF8FAFC",       // Çok Açık Gri Satır Dolgusu
    TOTAL_BG: "FFEFF6FF",       // Toplam Satırı Açık Mavi Dolgu
    ACCENT_AMBER: "FFFEF3C7",   // Norm Kadro / Önemli Vurgu
    BORDER_LIGHT: "FFCBD5E1",   // İnce Gri Kenarlık
    BORDER_DARK: "FF1E3A8A"     // Kalın Kenarlık
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: COLORS.BORDER_LIGHT } },
    left: { style: "thin", color: { argb: COLORS.BORDER_LIGHT } },
    bottom: { style: "thin", color: { argb: COLORS.BORDER_LIGHT } },
    right: { style: "thin", color: { argb: COLORS.BORDER_LIGHT } }
};

/**
 * Sayfa üstüne resmi bakanlık & il denetimi başlık bloğu ekler
 */
const addSheetTitleBlock = (ws: ExcelJS.Worksheet, ilAdi: string, startYear: number, endYear: number, tableTitle: string, totalCols: number) => {
    ws.views = [{ showGridLines: true }];

    // Row 1: Bakanlık Başlığı
    const r1 = ws.addRow(["T.C. GENÇLİK VE SPOR BAKANLIĞI - REHBERLİK VE TEFTİŞ BAŞKANLIĞI"]);
    r1.height = 28;
    ws.mergeCells(1, 1, 1, totalCols);
    const c1 = ws.getCell(1, 1);
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.NAVY_DARK } };
    c1.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.HEADER_TEXT } };
    c1.alignment = { vertical: "middle", horizontal: "center" };

    // Row 2: İl ve Denetim Dönemi
    const r2 = ws.addRow([`${(ilAdi || "İL").toUpperCase()} GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ TEFTİŞİ (${startYear} - ${endYear})`]);
    r2.height = 24;
    ws.mergeCells(2, 1, 2, totalCols);
    const c2 = ws.getCell(2, 1);
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c2.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: COLORS.HEADER_TEXT } };
    c2.alignment = { vertical: "middle", horizontal: "center" };

    // Row 3: Tablo Adı Şeridi
    const r3 = ws.addRow([tableTitle.toUpperCase()]);
    r3.height = 22;
    ws.mergeCells(3, 1, 3, totalCols);
    const c3 = ws.getCell(3, 1);
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.NAVY_LIGHT } };
    c3.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.HEADER_TEXT } };
    c3.alignment = { vertical: "middle", horizontal: "center" };

    // Row 4: Boşluk
    const r4 = ws.addRow([]);
    r4.height = 8;
};

/**
 * Tablo kolon başlık satırını biçimlendirir
 */
const styleHeaderRow = (row: ExcelJS.Row, startCol: number = 1, endCol?: number) => {
    row.height = 26;
    const maxCol = endCol || row.cellCount;
    for (let c = startCol; c <= maxCol; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.HEADER_BG } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.HEADER_TEXT } };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
            top: { style: "medium", color: { argb: COLORS.NAVY_DARK } },
            left: { style: "thin", color: { argb: "FF93C5FD" } },
            bottom: { style: "medium", color: { argb: COLORS.NAVY_DARK } },
            right: { style: "thin", color: { argb: "FF93C5FD" } }
        };
    }
};

/**
 * Veri satırını kenarlıklar, hizalama ve zebra renk ile biçimlendirir
 */
const styleDataRow = (row: ExcelJS.Row, isEven: boolean, isTotal: boolean = false, isNumericColsStart: number = 2, totalCols?: number) => {
    row.height = 21;
    const maxCol = totalCols || row.cellCount;
    const bg = isTotal ? COLORS.TOTAL_BG : (isEven ? COLORS.ZEBRA_BG : "FFFFFFFF");

    for (let c = 1; c <= maxCol; c++) {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = {
            name: "Calibri",
            size: 9.5,
            bold: isTotal,
            color: { argb: isTotal ? "FF0F172A" : "FF1E293B" }
        };
        cell.border = THIN_BORDER;

        if (c < isNumericColsStart) {
            cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        } else {
            cell.alignment = { vertical: "middle", horizontal: "center" };
        }
    }
};

/**
 * Excel Şablonu Oluşturur ve Gerçek Excel Tablosu Formatında İndirir
 */
export const exportAuditSummaryExcel = async (
    ilAdi: string,
    startYear: number,
    endYear: number,
    branches: string[],
    facilityTypes: string[],
    tables: any = {},
    isBlankTemplate: boolean = false
) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "MufYARD V2 - Dijital Denetim Asistanı";
    wb.lastModifiedBy = "MufYARD V2";
    wb.created = new Date();
    wb.modified = new Date();

    const years: string[] = [];
    for (let y = Math.min(startYear, endYear); y <= Math.max(startYear, endYear); y++) {
        years.push(String(y));
    }
    const currentTeftisYear = String(Math.max(startYear, endYear) + 1);
    const personelYears = [...years, currentTeftisYear];

    // ==========================================
    // 0. KILAVUZ SAYFASI
    // ==========================================
    const wsGuide = wb.addWorksheet("KILAVUZ");
    addSheetTitleBlock(wsGuide, ilAdi, startYear, endYear, "BİLGİ VE VERİ TOPLAMA KILAVUZU", 4);
    wsGuide.columns = [
        { width: 8 },
        { width: 35 },
        { width: 55 },
        { width: 20 }
    ];

    const guideIntro = wsGuide.addRow(["", "KULLANIM VE DOLDURMA TALİMATLARI", "", ""]);
    guideIntro.height = 24;
    wsGuide.mergeCells(guideIntro.number, 2, guideIntro.number, 3);
    const introCell = wsGuide.getCell(guideIntro.number, 2);
    introCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    introCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.NAVY_DARK } };
    introCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const instructions = [
        ["1", "Resmi Amaç", "Bu çalışma kitabı, Gençlik ve Spor Bakanlığı Rehberlik ve Teftiş Başkanlığı teftişine esas verilerin temini için hazırlanmıştır."],
        ["2", "Sekmeler", "Lütfen alttaki sekmeleri (1-SPORCU, 2-ANTRENOR, vb.) sırasıyla inceleyip ilgili resmi kayıtlara göre doldurunuz."],
        ["3", "Tablo Bütünlüğü", "Tablo başlıklarını, satır sıralarını veya sekme isimlerini lütfen DEĞİŞTİRMEYİNİZ veya SİLMEYİNİZ."],
        ["4", "Sayısal Alanlar", "Sayısal tablolarda hücrelere yalnızca rakam giriniz. Kaydı olmayan veya sıfır olan alanlara 0 yazınız."],
        ["5", "Geri Teslim", "Form doldurulduktan sonra aynı dosya adı ile müfettişe teslim edilecektir; MufYARD sistemi verileri otomatik aktaracaktır."]
    ];

    instructions.forEach((inst, idx) => {
        const row = wsGuide.addRow(["", `${inst[0]}. ${inst[1]}`, inst[2], ""]);
        row.height = 24;
        row.getCell(2).font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
        row.getCell(2).border = THIN_BORDER;
        row.getCell(3).font = { size: 9.5, color: { argb: "FF334155" } };
        row.getCell(3).border = THIN_BORDER;
        row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : COLORS.ZEBRA_BG } };
        row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? "FFFFFFFF" : COLORS.ZEBRA_BG } };
    });

    // ==========================================
    // 1. SPORCU SAYILARI
    // ==========================================
    const wsSporcu = wb.addWorksheet("1-SPORCU");
    const sporcuCols = 1 + years.length;
    addSheetTitleBlock(wsSporcu, ilAdi, startYear, endYear, "1- SPORCU SAYILARI VE DERECELERİ", sporcuCols);
    wsSporcu.columns = [{ width: 45 }, ...years.map(() => ({ width: 15 }))];

    const hSporcu = wsSporcu.addRow(["GÖSTERGE / SPORCU TÜRÜ", ...years]);
    styleHeaderRow(hSporcu, 1, sporcuCols);

    SPORCU_ROW_DEFS.forEach((r, idx) => {
        const rowVals = isBlankTemplate ? {} : (tables?.sporcuSayilari?.[r.key] || {});
        const dRow = wsSporcu.addRow([r.label, ...years.map(y => rowVals[y] ?? "")]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, sporcuCols);
    });

    // ==========================================
    // 2. ANTRENÖR DURUMU
    // ==========================================
    const wsAntrenor = wb.addWorksheet("2-ANTRENOR");
    addSheetTitleBlock(wsAntrenor, ilAdi, startYear, endYear, "2- ANTRENÖR DURUMU (BRANŞ BAZLI)", 5);
    wsAntrenor.columns = [{ width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];

    const hAnt = wsAntrenor.addRow(["BRANŞI", "FAHRİ", "KADROLU", "SÖZLEŞMELİ", "TOPLAM"]);
    styleHeaderRow(hAnt, 1, 5);

    const antList: any[] = tables?.antrenorDurumu || [];
    let totF = 0, totK = 0, totS = 0, totAll = 0;

    branches.forEach((br, idx) => {
        const item = isBlankTemplate ? {} : (antList.find((x: any) => x.branch === br) || {});
        const f = item.fahri ?? "";
        const k = item.kadrolu ?? "";
        const s = item.sozlesmeli ?? "";
        const fN = parseInt(f) || 0;
        const kN = parseInt(k) || 0;
        const sN = parseInt(s) || 0;
        const rowTot = (fN || kN || sN) ? (fN + kN + sN) : "";
        totF += fN; totK += kN; totS += sN; if (rowTot) totAll += Number(rowTot);

        const dRow = wsAntrenor.addRow([br, f, k, s, rowTot]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, 5);
    });

    // Toplam Satırı
    const rTotAnt = wsAntrenor.addRow(["GENEL TOPLAM", isBlankTemplate ? "" : totF, isBlankTemplate ? "" : totK, isBlankTemplate ? "" : totS, isBlankTemplate ? "" : totAll]);
    styleDataRow(rTotAnt, false, true, 2, 5);

    // ==========================================
    // 3-4. HAKEM VE KULÜP SAYILARI
    // ==========================================
    const wsHakemKulup = wb.addWorksheet("3-4-HAKEM-KULUP");
    addSheetTitleBlock(wsHakemKulup, ilAdi, startYear, endYear, "3-4- HAKEM VE SPOR KULÜBÜ SAYILARI", 2);
    wsHakemKulup.columns = [{ width: 45 }, { width: 22 }];

    // Bölüm 3 Başlığı
    const rHkSec3 = wsHakemKulup.addRow(["3- HAKEM DURUMU (KATEGORİLERİNE GÖRE)", "SAYI"]);
    styleHeaderRow(rHkSec3, 1, 2);

    HAKEM_ROW_DEFS.forEach((r, idx) => {
        const val = isBlankTemplate ? "" : (tables?.hakemDurumu?.[r.key] ?? "");
        const dRow = wsHakemKulup.addRow([r.label, val]);
        styleDataRow(dRow, idx % 2 === 1, r.key === "toplam", 2, 2);
    });

    wsHakemKulup.addRow([]); // Boşluk

    // Bölüm 4 Başlığı
    const rHkSec4 = wsHakemKulup.addRow(["4- KULÜP SAYILARI", "DEĞER"]);
    styleHeaderRow(rHkSec4, 1, 2);

    KULUP_ROW_DEFS.forEach((r, idx) => {
        const val = isBlankTemplate ? "" : (tables?.kulupSayilari?.[r.key] ?? "");
        const dRow = wsHakemKulup.addRow([r.label, val]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, 2);
    });

    // ==========================================
    // 5. GENÇLİK HİZMETLERİ
    // ==========================================
    const wsGenclik = wb.addWorksheet("5-GENCLIK");
    const genclikCols = 1 + years.length;
    addSheetTitleBlock(wsGenclik, ilAdi, startYear, endYear, "5- GENÇLİK HİZMET VE FAALİYETLERİ", genclikCols);
    wsGenclik.columns = [{ width: 45 }, ...years.map(() => ({ width: 15 }))];

    const hGenclik = wsGenclik.addRow(["FAALİYET TÜRÜ", ...years]);
    styleHeaderRow(hGenclik, 1, genclikCols);

    GENCLIK_ROW_DEFS.forEach((r, idx) => {
        const rowVals = isBlankTemplate ? {} : (tables?.genclikHizmetleri?.[r.key] || {});
        const dRow = wsGenclik.addRow([r.label, ...years.map(y => rowVals[y] ?? "")]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, genclikCols);
    });

    // ==========================================
    // 6. PERSONEL DURUMU - İDARİ
    // ==========================================
    const wsIdari = wb.addWorksheet("6-PERSONEL-IDARI");
    const idariCols = 1 + personelYears.length + 1; // Unvan + Personel Yılları + Norm Kadro
    addSheetTitleBlock(wsIdari, ilAdi, startYear, endYear, "6- PERSONEL DURUMU (İL MÜDÜRLÜĞÜ İDARİ KADROSU)", idariCols);
    wsIdari.columns = [{ width: 42 }, ...personelYears.map(() => ({ width: 14 })), { width: 18 }];

    const hIdari = wsIdari.addRow(["UNVAN", ...personelYears, "NORM KADRO"]);
    styleHeaderRow(hIdari, 1, idariCols);

    const idariData = isBlankTemplate ? {} : (tables?.personelDurumu?.idariPersonel || tables?.personelDurumu?.birlesmeSonrasi || {});
    IDARI_PERSONEL_ROW_DEFS.forEach((r, idx) => {
        const rowVals = idariData[r.key] || {};
        const dRow = wsIdari.addRow([
            r.label,
            ...personelYears.map(y => rowVals[y] ?? ""),
            rowVals.normKadro ?? ""
        ]);
        styleDataRow(dRow, idx % 2 === 1, !!r.isBold, 2, idariCols);
    });

    // ==========================================
    // 6. PERSONEL DURUMU - BİRİMLER (İLÇE, YURT, GM)
    // ==========================================
    const wsBirimler = wb.addWorksheet("6-PERSONEL-BIRIMLER");
    const birimCols = 1 + personelYears.length + 1;
    addSheetTitleBlock(wsBirimler, ilAdi, startYear, endYear, "6- PERSONEL DURUMU (İLÇE, YURT VE GENÇLİK MERKEZLERİ)", birimCols);
    wsBirimler.columns = [{ width: 38 }, ...personelYears.map(() => ({ width: 14 })), { width: 18 }];

    const addUnitSectionHeader = (title: string) => {
        const r = wsBirimler.addRow([title]);
        r.height = 26;
        wsBirimler.mergeCells(r.number, 1, r.number, birimCols);
        const cell = wsBirimler.getCell(r.number, 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.SECTION_BG } };
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.HEADER_TEXT } };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    };

    const addUnitTableHeader = (unitTitle: string) => {
        const rTitle = wsBirimler.addRow([unitTitle]);
        rTitle.height = 22;
        wsBirimler.mergeCells(rTitle.number, 1, rTitle.number, birimCols);
        const cell = wsBirimler.getCell(rTitle.number, 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.HEADER_TEXT } };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        const rHead = wsBirimler.addRow(["UNVAN", ...personelYears, "NORM KADRO"]);
        styleHeaderRow(rHead, 1, birimCols);
    };

    // A) İlçe Müdürlükleri
    addUnitSectionHeader("A) İLÇE MÜDÜRLÜKLERİ PERSONELİ");
    const ilceList: any[] = (tables?.personelDurumu?.ilcePersonelList && tables.personelDurumu.ilcePersonelList.length > 0)
        ? tables.personelDurumu.ilcePersonelList 
        : [{ name: "Örn: 1. İlçe Müdürlüğü", rows: {} }];

    ilceList.forEach((ilce) => {
        addUnitTableHeader(`İlçe: ${ilce.name || "İlçe Adı Giriniz"}`);
        ILCE_PERSONEL_ROW_DEFS.forEach((r, idx) => {
            const rowVals = isBlankTemplate ? {} : (ilce.rows?.[r.key] || {});
            const dRow = wsBirimler.addRow([
                r.label,
                ...personelYears.map(y => rowVals[y] ?? ""),
                rowVals.normKadro ?? ""
            ]);
            styleDataRow(dRow, idx % 2 === 1, false, 2, birimCols);
        });
        wsBirimler.addRow([]); // Ayırıcı
    });

    // B) Yurt Müdürlükleri
    addUnitSectionHeader("B) YURT MÜDÜRLÜKLERİ PERSONELİ");
    const yurtList: any[] = (tables?.personelDurumu?.yurtPersonelList && tables.personelDurumu.yurtPersonelList.length > 0)
        ? tables.personelDurumu.yurtPersonelList 
        : [{ name: "Örn: 1. Yurt Müdürlüğü", kapasite: "1000", rows: {} }];

    yurtList.forEach((yurt) => {
        addUnitTableHeader(`Yurt: ${yurt.name || "Yurt Adı Giriniz"} (Kapasite: ${yurt.kapasite || "-"})`);
        YURT_PERSONEL_ROW_DEFS.forEach((r, idx) => {
            const rowVals = isBlankTemplate ? {} : (yurt.rows?.[r.key] || {});
            const dRow = wsBirimler.addRow([
                r.label,
                ...personelYears.map(y => rowVals[y] ?? ""),
                rowVals.normKadro ?? ""
            ]);
            styleDataRow(dRow, idx % 2 === 1, false, 2, birimCols);
        });
        wsBirimler.addRow([]);
    });

    // C) Gençlik Merkezleri
    addUnitSectionHeader("C) GENÇLİK MERKEZİ MÜDÜRLÜKLERİ PERSONELİ");
    const gmList: any[] = (tables?.personelDurumu?.genclikMerkeziList && tables.personelDurumu.genclikMerkeziList.length > 0)
        ? tables.personelDurumu.genclikMerkeziList 
        : [{ name: "Örn: 1. Gençlik Merkezi Müdürlüğü", rows: {} }];

    gmList.forEach((gm) => {
        addUnitTableHeader(`Gençlik Merkezi: ${gm.name || "GM Adı Giriniz"}`);
        GM_PERSONEL_ROW_DEFS.forEach((r, idx) => {
            const rowVals = isBlankTemplate ? {} : (gm.rows?.[r.key] || {});
            const dRow = wsBirimler.addRow([
                r.label,
                ...personelYears.map(y => rowVals[y] ?? ""),
                rowVals.normKadro ?? ""
            ]);
            styleDataRow(dRow, idx % 2 === 1, false, 2, birimCols);
        });
        wsBirimler.addRow([]);
    });

    // ==========================================
    // 7. GİDERLER
    // ==========================================
    const wsGider = wb.addWorksheet("7-GIDERLER");
    const giderCols = 1 + years.length;
    addSheetTitleBlock(wsGider, ilAdi, startYear, endYear, "7- BÜTÇE GİDERLERİ (YILLAR İTİBARIYLA)", giderCols);
    wsGider.columns = [{ width: 38 }, ...years.map(() => ({ width: 17 }))];

    const hGider = wsGider.addRow(["GİDER KALEMİ", ...years]);
    styleHeaderRow(hGider, 1, giderCols);

    const giderData = isBlankTemplate ? {} : (tables?.giderler?.birlesmeSonrasi || tables?.giderler || {});
    GIDER_ROW_DEFS.forEach((r, idx) => {
        const rowVals = giderData[r.key] || {};
        const dRow = wsGider.addRow([r.label, ...years.map(y => rowVals[y] ?? "")]);
        styleDataRow(dRow, idx % 2 === 1, !!r.isBold, 2, giderCols);
    });

    // ==========================================
    // 8. GELİRLER
    // ==========================================
    const wsGelir = wb.addWorksheet("8-GELIRLER");
    const gelirCols = 1 + years.length;
    addSheetTitleBlock(wsGelir, ilAdi, startYear, endYear, "8- BÜTÇE GELİRLERİ (YILLAR İTİBARIYLA)", gelirCols);
    wsGelir.columns = [{ width: 42 }, ...years.map(() => ({ width: 17 }))];

    const hGelir = wsGelir.addRow(["GELİR KALEMİ", ...years]);
    styleHeaderRow(hGelir, 1, gelirCols);

    const gelirData = isBlankTemplate ? {} : (tables?.gelirler || {});
    GELIR_ROW_DEFS.forEach((r, idx) => {
        const rowVals = gelirData[r.key] || {};
        const dRow = wsGelir.addRow([r.label, ...years.map(y => rowVals[y] ?? "")]);
        styleDataRow(dRow, idx % 2 === 1, !!r.isBold, 2, gelirCols);
    });

    // ==========================================
    // 9. TESİSLER
    // ==========================================
    const wsTesis = wb.addWorksheet("9-TESISLER");
    const tesisCols = Math.max(3, 1 + years.length);
    addSheetTitleBlock(wsTesis, ilAdi, startYear, endYear, "9- TESİSLER (MÜLKİYET VE YILLIK GELİŞİM DURUMU)", tesisCols);
    wsTesis.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, ...years.map(() => ({ width: 15 }))];

    // Bölüm A: Mülkiyet
    const rTesisSecA = wsTesis.addRow(["A) TESİS TÜRÜ (MÜLKİYET / MEVCUT DURUM)", "ADET", "KAPASİTE"]);
    styleHeaderRow(rTesisSecA, 1, 3);

    const mulkiyetList: any[] = isBlankTemplate ? [] : (tables?.tesisler?.mulkiyetList || []);
    facilityTypes.forEach((ft, idx) => {
        const item = mulkiyetList.find((x: any) => x.type === ft) || {};
        const dRow = wsTesis.addRow([ft, item.adet ?? "", item.kapasite ?? ""]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, 3);
    });

    wsTesis.addRow([]); // Boşluk

    // Bölüm B: Yıllara Göre
    const rTesisSecB = wsTesis.addRow(["B) TESİSLERİN YILLARA GÖRE DAĞILIMI", ...years]);
    styleHeaderRow(rTesisSecB, 1, 1 + years.length);

    const tesisYillaraGore = isBlankTemplate ? {} : (tables?.tesisler?.yillaraGore || {});
    TESIS_YILLARA_GORE_ROW_DEFS.forEach((r, idx) => {
        const rowVals = tesisYillaraGore[r.key] || {};
        const dRow = wsTesis.addRow([r.label, ...years.map(y => rowVals[y] ?? "")]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, 1 + years.length);
    });

    // ==========================================
    // 10-11. NAKİT VE SPONSORLUK
    // ==========================================
    const wsNakit = wb.addWorksheet("10-11-NAKIT-SPONSOR");
    const nakitCols = Math.max(2, 1 + years.length);
    addSheetTitleBlock(wsNakit, ilAdi, startYear, endYear, "10-11- NAKİT DURUMU, ÖZEL İDARE VE SPONSORLUK", nakitCols);
    wsNakit.columns = [{ width: 40 }, ...years.map(() => ({ width: 17 }))];

    // 10- Nakit
    const rN1 = wsNakit.addRow(["10- NAKİT DURUMU (KASA / BANKA)", "DEĞER / TARİH"]);
    styleHeaderRow(rN1, 1, 2);

    const nakitTarih = isBlankTemplate ? "" : (tables?.nakitDurumu?.nakitTarihi || "");
    const nakitTutar = isBlankTemplate ? "" : (tables?.nakitDurumu?.nakitTutari || "");

    const dN1 = wsNakit.addRow(["Tarih İtibariyle", nakitTarih]);
    styleDataRow(dN1, false, false, 2, 2);
    const dN2 = wsNakit.addRow(["Nakit Tutarı (TL)", nakitTutar]);
    styleDataRow(dN2, true, false, 2, 2);

    wsNakit.addRow([]);

    // Özel İdare Yatırımları
    const rN2 = wsNakit.addRow(["İL ÖZEL İDARESİNDEN YAPILAN YATIRIMLAR", ...years]);
    styleHeaderRow(rN2, 1, 1 + years.length);

    const dOzel1 = wsNakit.addRow(["İl Özel İdaresi Yatırımları", ...years.map(y => (isBlankTemplate ? "" : (tables?.nakitDurumu?.ozelIdareYatirim?.[y] || "")))]);
    styleDataRow(dOzel1, false, false, 2, 1 + years.length);

    wsNakit.addRow([]);

    // 11- Sponsorluk
    const rS1 = wsNakit.addRow(["11- SPONSORLUK KAYNAKLARI (YILLIK)", ...years]);
    styleHeaderRow(rS1, 1, 1 + years.length);

    const dS1 = wsNakit.addRow(["Sponsorluk Gelirleri", ...years.map(y => (isBlankTemplate ? "" : (tables?.sponsorluk?.yillikKaynak?.[y] || "")))]);
    styleDataRow(dS1, false, false, 2, 1 + years.length);

    const dS2 = wsNakit.addRow(["Sponsorluk Açıklamaları:", isBlankTemplate ? "" : (tables?.sponsorluk?.aciklama || "")]);
    styleDataRow(dS2, true, false, 2, 2);

    // ==========================================
    // 16. SPOR DALI TEMSİLCİLERİ
    // ==========================================
    const wsTemsilci = wb.addWorksheet("16-TEMSILCILER");
    addSheetTitleBlock(wsTemsilci, ilAdi, startYear, endYear, "16- SPOR DALI TEMSİLCİLERİ VE FAALİYET PROGRAMLARI DURUMU", 5);
    wsTemsilci.columns = [{ width: 28 }, { width: 28 }, { width: 30 }, { width: 22 }, { width: 26 }];

    const hTemsilci = wsTemsilci.addRow(["SPOR BRANŞI", "TEMSİLCİ VAR MI? (Evet/Hayır)", "TEMSİLCİ ADI SOYADI", "GÖREV ONAYI VAR MI?", "YILLIK PROGRAM TASDİKLİ Mİ?"]);
    styleHeaderRow(hTemsilci, 1, 5);

    branches.forEach((br, idx) => {
        const item = isBlankTemplate ? {} : (tables?.sporDaliTemsilcileri?.[br] || {});
        const dRow = wsTemsilci.addRow([
            br,
            item.varMi ?? "",
            item.temsilciAdi ?? "",
            item.gorevOnayi ?? "",
            item.faaliyetTasdik ?? ""
        ]);
        styleDataRow(dRow, idx % 2 === 1, false, 2, 5);
    });

    // Dosyayı İndir
    const cleanCity = (ilAdi || "IL").replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]/g, "_");
    const filenamePrefix = isBlankTemplate ? "BOS_SABLON_" : "DOLU_VERILER_";
    const filename = `${filenamePrefix}Genclik_Spor_${cleanCity}_Denetim_Formu_${startYear}_${endYear}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

const cleanCellStr = (val: any): string => {
    if (val === undefined || val === null) return "";
    return String(val).trim();
};

const normalizeMatchText = (str: string): string => {
    return str
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ş/g, "S")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]/g, "")
        .trim();
};

/**
 * Kurum tarafından doldurulan Excel dosyasını okuyup ayrıştırır.
 * Mevcut alanların üzerine yazar (Option A: Overwrite).
 */
export const parseAuditSummaryExcel = async (
    file: File,
    _currentStartYear: number,
    _currentEndYear: number,
    currentTables: any = {}
): Promise<{ updatedTables: any; summary: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array" });

                const updated: any = JSON.parse(JSON.stringify(currentTables || {}));
                let matchedSheetsCount = 0;
                const changeLogs: string[] = [];

                wb.SheetNames.forEach((sheetName) => {
                    const normSheet = normalizeMatchText(sheetName);
                    const sheet = wb.Sheets[sheetName];
                    if (!sheet) return;

                    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                    if (!rawRows || rawRows.length === 0) return;

                    // 1- SPORCU
                    if (normSheet.includes("SPORCU")) {
                        matchedSheetsCount++;
                        if (!updated.sporcuSayilari) updated.sporcuSayilari = {};

                        let colYearMap: Record<number, string> = {};
                        let sporcuCount = 0;

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;

                            // Header row with years
                            const hasYears = row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)));
                            if (hasYears && Object.keys(colYearMap).length === 0) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                });
                                continue;
                            }

                            const labelStr = cleanCellStr(row[0]);
                            if (!labelStr || labelStr.startsWith("T.C.") || labelStr.includes("TEFTİŞ") || labelStr.includes("GÖSTERGE")) continue;

                            const normLabel = normalizeMatchText(labelStr);
                            const foundDef = SPORCU_ROW_DEFS.find(d => normLabel.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normLabel));
                            const rowKey = foundDef ? foundDef.key : labelStr;

                            if (!updated.sporcuSayilari[rowKey]) updated.sporcuSayilari[rowKey] = {};

                            Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                const cIdx = parseInt(cIdxStr);
                                const val = cleanCellStr(row[cIdx]);
                                if (val !== "") updated.sporcuSayilari[rowKey][y] = val;
                            });
                            sporcuCount++;
                        }
                        changeLogs.push(`Sporcu Sayıları (${sporcuCount} satır)`);
                    }

                    // 2- ANTRENÖR
                    else if (normSheet.includes("ANTRENOR")) {
                        matchedSheetsCount++;
                        const currentAntList: any[] = Array.isArray(updated.antrenorDurumu) ? [...updated.antrenorDurumu] : [];
                        let antCount = 0;

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length < 2) continue;
                            const branchName = cleanCellStr(row[0]).toUpperCase();
                            if (!branchName || branchName.startsWith("T.C.") || branchName.includes("TEFTİŞ") || branchName === "BRANŞI" || branchName === "GENEL TOPLAM" || branchName === "TOPLAM") continue;

                            const fahri = cleanCellStr(row[1]);
                            const kadrolu = cleanCellStr(row[2]);
                            const sozlesmeli = cleanCellStr(row[3]);

                            const existingIdx = currentAntList.findIndex(x => x.branch?.toUpperCase() === branchName);
                            const antItem = { branch: branchName, fahri, kadrolu, sozlesmeli };

                            if (existingIdx >= 0) {
                                currentAntList[existingIdx] = { ...currentAntList[existingIdx], ...antItem };
                            } else {
                                currentAntList.push(antItem);
                            }
                            antCount++;
                        }
                        updated.antrenorDurumu = currentAntList;
                        changeLogs.push(`Antrenör Durumu (${antCount} branş)`);
                    }

                    // 3-4- HAKEM & KULÜP
                    else if (normSheet.includes("HAKEM") || normSheet.includes("KULUP")) {
                        matchedSheetsCount++;
                        if (!updated.hakemDurumu) updated.hakemDurumu = {};
                        if (!updated.kulupSayilari) updated.kulupSayilari = {};

                        let inKulupSection = false;
                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length < 2) continue;
                            const col0 = cleanCellStr(row[0]);
                            const col1 = cleanCellStr(row[1]);

                            if (normalizeMatchText(col0).includes("KULUP") && !col0.includes("Faal")) {
                                inKulupSection = true;
                                continue;
                            }

                            const normCol0 = normalizeMatchText(col0);
                            if (inKulupSection) {
                                const foundKulup = KULUP_ROW_DEFS.find(d => normCol0.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normCol0));
                                if (foundKulup && col1 !== "") updated.kulupSayilari[foundKulup.key] = col1;
                            } else {
                                const foundHakem = HAKEM_ROW_DEFS.find(d => normCol0.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normCol0));
                                if (foundHakem && col1 !== "") updated.hakemDurumu[foundHakem.key] = col1;
                            }
                        }
                        changeLogs.push("Hakem ve Kulüp Sayıları");
                    }

                    // 5- GENÇLİK
                    else if (normSheet.includes("GENCLIK") && !normSheet.includes("MERKEZ")) {
                        matchedSheetsCount++;
                        if (!updated.genclikHizmetleri) updated.genclikHizmetleri = {};

                        let colYearMap: Record<number, string> = {};
                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;

                            const hasYears = row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)));
                            if (hasYears && Object.keys(colYearMap).length === 0) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                });
                                continue;
                            }

                            const labelStr = cleanCellStr(row[0]);
                            if (!labelStr || labelStr.startsWith("T.C.") || labelStr.includes("TEFTİŞ") || labelStr.includes("FAALİYET TÜRÜ")) continue;

                            const normLabel = normalizeMatchText(labelStr);
                            const foundDef = GENCLIK_ROW_DEFS.find(d => normLabel.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normLabel));
                            const rowKey = foundDef ? foundDef.key : labelStr;

                            if (!updated.genclikHizmetleri[rowKey]) updated.genclikHizmetleri[rowKey] = {};

                            Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                const cIdx = parseInt(cIdxStr);
                                const val = cleanCellStr(row[cIdx]);
                                if (val !== "") updated.genclikHizmetleri[rowKey][y] = val;
                            });
                        }
                        changeLogs.push("Gençlik Faaliyetleri");
                    }

                    // 6- PERSONEL - İDARİ
                    else if (normSheet.includes("PERSONEL") && normSheet.includes("IDARI")) {
                        matchedSheetsCount++;
                        if (!updated.personelDurumu) updated.personelDurumu = {};
                        if (!updated.personelDurumu.idariPersonel) updated.personelDurumu.idariPersonel = {};

                        let colYearMap: Record<number, string> = {};
                        let normKadroColIdx = -1;

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;

                            const hasYears = row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)));
                            if (hasYears && Object.keys(colYearMap).length === 0) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                    else if (normalizeMatchText(strH).includes("NORM")) normKadroColIdx = cIdx;
                                });
                                continue;
                            }

                            const labelStr = cleanCellStr(row[0]);
                            if (!labelStr || labelStr.startsWith("T.C.") || labelStr.includes("TEFTİŞ") || labelStr.includes("UNVAN")) continue;

                            const normLabel = normalizeMatchText(labelStr);
                            const foundDef = IDARI_PERSONEL_ROW_DEFS.find(d => normLabel.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normLabel));
                            const rowKey = foundDef ? foundDef.key : labelStr;

                            if (!updated.personelDurumu.idariPersonel[rowKey]) updated.personelDurumu.idariPersonel[rowKey] = {};

                            Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                const cIdx = parseInt(cIdxStr);
                                const val = cleanCellStr(row[cIdx]);
                                if (val !== "") updated.personelDurumu.idariPersonel[rowKey][y] = val;
                            });

                            if (normKadroColIdx >= 0) {
                                const normVal = cleanCellStr(row[normKadroColIdx]);
                                if (normVal !== "") updated.personelDurumu.idariPersonel[rowKey]["normKadro"] = normVal;
                            }
                        }
                        updated.personelDurumu.birlesmeSonrasi = JSON.parse(JSON.stringify(updated.personelDurumu.idariPersonel));
                        changeLogs.push("İdari Personel Kadrosu");
                    }

                    // 6- PERSONEL - BİRİMLER (İLÇE, YURT, GM)
                    else if (normSheet.includes("PERSONEL") && normSheet.includes("BIRIM")) {
                        matchedSheetsCount++;
                        if (!updated.personelDurumu) updated.personelDurumu = {};

                        let currentUnitType: "ilce" | "yurt" | "gm" | null = null;
                        let currentUnitItem: any = null;
                        let colYearMap: Record<number, string> = {};
                        let normColIdx = -1;

                        const ilceList: any[] = [];
                        const yurtList: any[] = [];
                        const gmList: any[] = [];

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;
                            const firstCell = cleanCellStr(row[0]);
                            const normFirst = normalizeMatchText(firstCell);

                            if (normFirst.includes("ILCEMUDURLUKLERI")) {
                                currentUnitType = "ilce";
                                continue;
                            } else if (normFirst.includes("YURTMUDURLUKLERI")) {
                                currentUnitType = "yurt";
                                continue;
                            } else if (normFirst.includes("GENCLIKMERKEZI") && !firstCell.startsWith("Gençlik Merkezi:")) {
                                currentUnitType = "gm";
                                continue;
                            }

                            // Birim başlık satırı
                            if (firstCell.startsWith("İlçe:") || firstCell.startsWith("Yurt:") || firstCell.startsWith("Gençlik Merkezi:") || firstCell.startsWith("GM:")) {
                                const namePart = firstCell.split(":")[1]?.trim() || "";
                                let unitName = namePart;
                                let capacity = "";

                                if (unitName.includes("Kapasite:")) {
                                    const parts = unitName.split("Kapasite:");
                                    unitName = parts[0].replace(/[\(\)-]/g, "").trim();
                                    capacity = parts[1].replace(/[\(\)]/g, "").trim();
                                }

                                currentUnitItem = {
                                    id: `unit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                    name: unitName,
                                    rows: {},
                                    customRows: []
                                };
                                if (currentUnitType === "yurt") currentUnitItem.kapasite = capacity;

                                if (currentUnitType === "ilce") ilceList.push(currentUnitItem);
                                else if (currentUnitType === "yurt") yurtList.push(currentUnitItem);
                                else if (currentUnitType === "gm") gmList.push(currentUnitItem);
                                continue;
                            }

                            // Kolon başlık satırı (UNVAN | 2021 | 2022 ...)
                            if (normFirst === "UNVAN" || row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)))) {
                                colYearMap = {};
                                normColIdx = -1;
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                    else if (normalizeMatchText(strH).includes("NORM")) normColIdx = cIdx;
                                });
                                continue;
                            }

                            // Veri satırı
                            if (currentUnitItem && firstCell) {
                                let rowDef: any = null;
                                if (currentUnitType === "ilce") rowDef = ILCE_PERSONEL_ROW_DEFS.find(d => normFirst.includes(normalizeMatchText(d.label)));
                                else if (currentUnitType === "yurt") rowDef = YURT_PERSONEL_ROW_DEFS.find(d => normFirst.includes(normalizeMatchText(d.label)));
                                else if (currentUnitType === "gm") rowDef = GM_PERSONEL_ROW_DEFS.find(d => normFirst.includes(normalizeMatchText(d.label)));

                                const rowKey = rowDef ? rowDef.key : firstCell;
                                if (!currentUnitItem.rows[rowKey]) currentUnitItem.rows[rowKey] = {};

                                Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                    const cIdx = parseInt(cIdxStr);
                                    const val = cleanCellStr(row[cIdx]);
                                    if (val !== "") currentUnitItem.rows[rowKey][y] = val;
                                });

                                if (normColIdx >= 0) {
                                    const normVal = cleanCellStr(row[normColIdx]);
                                    if (normVal !== "") currentUnitItem.rows[rowKey]["normKadro"] = normVal;
                                }
                            }
                        }

                        if (ilceList.length > 0) updated.personelDurumu.ilcePersonelList = ilceList;
                        if (yurtList.length > 0) updated.personelDurumu.yurtPersonelList = yurtList;
                        if (gmList.length > 0) updated.personelDurumu.genclikMerkeziList = gmList;
                        changeLogs.push(`Birim Personelleri (${ilceList.length} İlçe, ${yurtList.length} Yurt, ${gmList.length} Gençlik Merkezi)`);
                    }

                    // 7- GİDERLER
                    else if (normSheet.includes("GIDER")) {
                        matchedSheetsCount++;
                        if (!updated.giderler) updated.giderler = {};
                        if (!updated.giderler.birlesmeSonrasi) updated.giderler.birlesmeSonrasi = {};

                        let colYearMap: Record<number, string> = {};
                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;

                            const hasYears = row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)));
                            if (hasYears && Object.keys(colYearMap).length === 0) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                });
                                continue;
                            }

                            const labelStr = cleanCellStr(row[0]);
                            if (!labelStr || labelStr.startsWith("T.C.") || labelStr.includes("TEFTİŞ") || labelStr.includes("GİDER KALEMİ")) continue;

                            const normLabel = normalizeMatchText(labelStr);
                            const foundDef = GIDER_ROW_DEFS.find(d => normLabel.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normLabel));
                            const rowKey = foundDef ? foundDef.key : labelStr;

                            if (!updated.giderler.birlesmeSonrasi[rowKey]) updated.giderler.birlesmeSonrasi[rowKey] = {};

                            Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                const cIdx = parseInt(cIdxStr);
                                const val = cleanCellStr(row[cIdx]);
                                if (val !== "") updated.giderler.birlesmeSonrasi[rowKey][y] = val;
                            });
                        }
                        changeLogs.push("Gider Kalemleri");
                    }

                    // 8- GELİRLER
                    else if (normSheet.includes("GELIR")) {
                        matchedSheetsCount++;
                        if (!updated.gelirler) updated.gelirler = {};

                        let colYearMap: Record<number, string> = {};
                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;

                            const hasYears = row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)));
                            if (hasYears && Object.keys(colYearMap).length === 0) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) colYearMap[cIdx] = strH;
                                });
                                continue;
                            }

                            const labelStr = cleanCellStr(row[0]);
                            if (!labelStr || labelStr.startsWith("T.C.") || labelStr.includes("TEFTİŞ") || labelStr.includes("GELİR KALEMİ")) continue;

                            const normLabel = normalizeMatchText(labelStr);
                            const foundDef = GELIR_ROW_DEFS.find(d => normLabel.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normLabel));
                            const rowKey = foundDef ? foundDef.key : labelStr;

                            if (!updated.gelirler[rowKey]) updated.gelirler[rowKey] = {};

                            Object.entries(colYearMap).forEach(([cIdxStr, y]) => {
                                const cIdx = parseInt(cIdxStr);
                                const val = cleanCellStr(row[cIdx]);
                                if (val !== "") updated.gelirler[rowKey][y] = val;
                            });
                        }
                        changeLogs.push("Gelir Kalemleri");
                    }

                    // 9- TESİSLER
                    else if (normSheet.includes("TESIS")) {
                        matchedSheetsCount++;
                        if (!updated.tesisler) updated.tesisler = {};

                        const mulkiyetList: any[] = [];
                        let inYillaraGore = false;
                        const yillaraGoreColMap: Record<number, string> = {};
                        const yillaraGoreData: Record<string, Record<string, string>> = {};

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;
                            const col0 = cleanCellStr(row[0]);

                            if (normalizeMatchText(col0).includes("YILLARAGORE")) {
                                inYillaraGore = true;
                                continue;
                            }

                            if (inYillaraGore && row.some((c: any) => /^\d{4}$/.test(cleanCellStr(c)))) {
                                row.forEach((hVal: any, cIdx: number) => {
                                    const strH = cleanCellStr(hVal);
                                    if (/^\d{4}$/.test(strH)) yillaraGoreColMap[cIdx] = strH;
                                });
                                continue;
                            }

                            if (inYillaraGore) {
                                if (!col0 || col0.startsWith("T.C.") || col0.includes("TEFTİŞ")) continue;
                                const normCol0 = normalizeMatchText(col0);
                                const foundTesis = TESIS_YILLARA_GORE_ROW_DEFS.find(d => normCol0.includes(normalizeMatchText(d.label)) || normalizeMatchText(d.label).includes(normCol0));
                                const rowKey = foundTesis ? foundTesis.key : col0;

                                if (!yillaraGoreData[rowKey]) yillaraGoreData[rowKey] = {};

                                Object.entries(yillaraGoreColMap).forEach(([cIdxStr, y]) => {
                                    const cIdx = parseInt(cIdxStr);
                                    const val = cleanCellStr(row[cIdx]);
                                    if (val !== "") yillaraGoreData[rowKey][y] = val;
                                });
                            } else {
                                if (col0.startsWith("T.C.") || col0.includes("TEFTİŞ") || col0.includes("TESİS TÜRÜ") || col0 === "") continue;
                                const adet = cleanCellStr(row[1]);
                                const kapasite = cleanCellStr(row[2]);
                                if (col0 && (adet !== "" || kapasite !== "")) {
                                    mulkiyetList.push({
                                        type: col0.toUpperCase(),
                                        adet,
                                        kapasite
                                    });
                                }
                            }
                        }

                        if (mulkiyetList.length > 0) updated.tesisler.mulkiyetList = mulkiyetList;
                        if (Object.keys(yillaraGoreData).length > 0) updated.tesisler.yillaraGore = yillaraGoreData;
                        changeLogs.push("Tesis Envanteri ve Yıllara Göre Dağılım");
                    }

                    // 10-11- NAKİT & SPONSORLUK
                    else if (normSheet.includes("NAKIT") || normSheet.includes("SPONSOR")) {
                        matchedSheetsCount++;
                        if (!updated.nakitDurumu) updated.nakitDurumu = {};
                        if (!updated.sponsorluk) updated.sponsorluk = {};

                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length === 0) continue;
                            const col0 = cleanCellStr(row[0]);
                            const col1 = cleanCellStr(row[1]);

                            if (normalizeMatchText(col0).includes("TARIH")) {
                                updated.nakitDurumu.nakitTarihi = col1;
                            } else if (normalizeMatchText(col0).includes("NAKITTUTAR")) {
                                updated.nakitDurumu.nakitTutari = col1;
                            } else if (normalizeMatchText(col0).includes("SPONSORLUKACIKLAMA")) {
                                updated.sponsorluk.aciklama = col1;
                            }
                        }
                        changeLogs.push("Nakit ve Sponsorluk Verileri");
                    }

                    // 16- TEMSİLCİLER
                    else if (normSheet.includes("TEMSILCI")) {
                        matchedSheetsCount++;
                        if (!updated.sporDaliTemsilcileri) updated.sporDaliTemsilcileri = {};

                        let tCount = 0;
                        for (let rIdx = 0; rIdx < rawRows.length; rIdx++) {
                            const row = rawRows[rIdx];
                            if (!row || row.length < 2) continue;
                            const branchName = cleanCellStr(row[0]).toUpperCase();
                            if (!branchName || branchName.startsWith("T.C.") || branchName.includes("TEFTİŞ") || branchName.includes("SPOR BRANŞI")) continue;

                            const varMiRaw = cleanCellStr(row[1]).toLowerCase();
                            const varMi = (varMiRaw.includes("evet") || varMiRaw === "var") ? "var" : (varMiRaw ? "yok" : "");
                            const temsilciAdi = cleanCellStr(row[2]);
                            const gorevOnayiRaw = cleanCellStr(row[3]).toLowerCase();
                            const gorevOnayi = (gorevOnayiRaw.includes("evet") || gorevOnayiRaw === "var") ? "var" : (gorevOnayiRaw ? "yok" : "");
                            const faaliyetTasdikRaw = cleanCellStr(row[4]).toLowerCase();
                            const faaliyetTasdik = (faaliyetTasdikRaw.includes("evet") || faaliyetTasdikRaw.includes("tasdikli")) ? "tasdikli" : (faaliyetTasdikRaw ? "tasdiksiz" : "");

                            updated.sporDaliTemsilcileri[branchName] = {
                                varMi,
                                temsilciAdi,
                                gorevOnayi,
                                faaliyetTasdik
                            };
                            tCount++;
                        }
                        changeLogs.push(`Spor Dalı Temsilcileri (${tCount} branş)`);
                    }
                });

                if (matchedSheetsCount === 0) {
                    throw new Error("Yüklenen Excel dosyasında tanınan bir tablo veya sekme bulunamadı. Lütfen MufYARD tarafından üretilen şablonu kullandığınızdan emin olunuz.");
                }

                const summary = `${changeLogs.join(", ")} başarıyla okundu ve sisteme aktarıldı.`;
                resolve({ updatedTables: updated, summary });
            } catch (err: any) {
                reject(err);
            }
        };

        reader.onerror = (err) => reject(new Error("Dosya okunurken bir hata oluştu: " + err));
        reader.readAsArrayBuffer(file);
    });
};
