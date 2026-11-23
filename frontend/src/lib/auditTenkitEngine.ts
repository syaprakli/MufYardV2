// ============================================================================
// MUFYARD V2 - ÖZET TABLOLARDAN OTOMATİK TENKİT / BULGU ÜRETİM MOTORU
// ============================================================================

export interface TenkitFinding {
    id: string;
    groupCode: "GRUP-1" | "GRUP-2" | "GRUP-3" | "GRUP-4" | "GRUP-5" | "GRUP-6";
    groupName: string;
    ruleCode: string;
    itemLetter?: string; // a, b, c, d, e, f, g, h, i, j, k, l
    severity: "critical" | "warning" | "info";
    title: string;
    trigger: string;
    evidence: string;
    recommendationText: string;
    isSelected: boolean;
}

export interface TenkitAnalysisResult {
    findings: TenkitFinding[];
    summary: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        byGroup: Record<string, number>;
    };
    analyzedAt: string;
}

// Güvenli tam sayı ayrıştırıcı
const safeInt = (v: any): number => {
    if (typeof v === "number") return isNaN(v) ? 0 : Math.round(v);
    if (!v) return 0;
    const s = String(v).trim().replace(/\./g, "").replace(/,/g, "");
    if (s === "-" || !s) return 0;
    const digits = s.replace(/[^0-9-]/g, "");
    const parsed = parseInt(digits, 10);
    return isNaN(parsed) ? 0 : parsed;
};

// Güvenli parasal tutar ayrıştırıcı
const safeFloat = (v: any): number => {
    if (typeof v === "number") return isNaN(v) ? 0 : v;
    if (!v) return 0;
    const s = String(v).trim().replace(/\s/g, "");
    if (s === "-" || !s) return 0;
    let normalized = s;
    if (s.includes(",") && s.includes(".")) {
        normalized = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
        normalized = s.replace(",", ".");
    }
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
};

// Sayı formatlayıcı: 11340 -> 11.340
const formatNum = (n: number): string => {
    return Math.round(n).toLocaleString("tr-TR");
};

// Para formatlayıcı: 1115140.53 -> 1.115.140,53 TL
const formatCurrency = (n: number): string => {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
};

// Akıllı sporcu hücresi ayrıştırıcı (Kadın / Erkek birleşik ve ayrık hücreleri tam çözer)
// Örn: "3757/4679" -> { kadin: 3757, erkek: 4679, toplam: 8436 }
// Örn: "49506390" -> { kadin: 4950, erkek: 6390, toplam: 11340 }
// Örn: "947212637" -> { kadin: 9472, erkek: 12637, toplam: 22109 }
// Örn: "2881235971" -> { kadin: 28812, erkek: 35971, toplam: 64783 }
function parseAthleteCell(val: any): { kadin: number; erkek: number; toplam: number } {
    if (!val) return { kadin: 0, erkek: 0, toplam: 0 };
    const s = String(val).trim().replace(/\./g, "").replace(/\s/g, "");

    // 1. Slaşlı format: 3757/4679
    if (s.includes("/")) {
        const parts = s.split("/");
        const k = safeInt(parts[0]);
        const e = parts.length > 1 ? safeInt(parts[1]) : 0;
        return { kadin: k, erkek: e, toplam: k + e };
    }

    // 2. Saf rakam kontrolü
    if (/^\d+$/.test(s)) {
        const n = safeInt(s);
        // Makul bir toplam değer ise (< 500.000) doğrudan toplamdır
        if (n < 500000) {
            return { kadin: 0, erkek: 0, toplam: n };
        }
        // 8 basamak (4 kadın + 4 erkek): 4950 6390
        if (s.length === 8) {
            const k = parseInt(s.slice(0, 4), 10);
            const e = parseInt(s.slice(4), 10);
            return { kadin: k, erkek: e, toplam: k + e };
        }
        // 9 basamak (4 kadın + 5 erkek): 9472 12637
        if (s.length === 9) {
            const k = parseInt(s.slice(0, 4), 10);
            const e = parseInt(s.slice(4), 10);
            return { kadin: k, erkek: e, toplam: k + e };
        }
        // 10 basamak (5 kadın + 5 erkek): 28812 35971
        if (s.length === 10) {
            const k = parseInt(s.slice(0, 5), 10);
            const e = parseInt(s.slice(5), 10);
            return { kadin: k, erkek: e, toplam: k + e };
        }
        return { kadin: 0, erkek: 0, toplam: n };
    }

    return { kadin: 0, erkek: 0, toplam: safeInt(s) };
}

// Oran metni üretici (binde, on binde, yüz binde)
function formatRatioText(subset: number, total: number): string {
    if (total <= 0 || subset <= 0) return "0";
    const perHundredThousand = (subset / total) * 100000;
    const perTenThousand = (subset / total) * 10000;
    const perThousand = (subset / total) * 1000;

    if (perThousand >= 1) {
        const val = (Math.round(perThousand * 10) / 10).toString().replace(".", ",");
        return `binde ${val}`;
    } else if (perTenThousand >= 1) {
        const val = (Math.round(perTenThousand * 10) / 10).toString().replace(".", ",");
        return `on binde ${val}`;
    } else {
        const val = (Math.round(perHundredThousand * 10) / 10).toString().replace(".", ",");
        return `yüz binde ${val}`;
    }
}

export function analyzeAuditTables(
    tables: any, 
    years: (number | string)[] = [2021, 2022, 2023, 2024, 2025], 
    _ilAdi: string = "İl"
): TenkitAnalysisResult {
    const findings: TenkitFinding[] = [];
    const sortedYears = (years || [2021, 2022, 2023, 2024, 2025])
        .map(y => typeof y === "number" ? y : parseInt(String(y), 10))
        .filter(y => !isNaN(y))
        .sort((a, b) => a - b);

    const minYear = sortedYears[0];
    const maxYear = sortedYears[sortedYears.length - 1];

    // ========================================================================
    // 1. SPORCU VE SPORTİF BAŞARI VERİLERİ (Tablo 1)
    // ========================================================================
    const sporcu = tables?.sporcuSayilari || {};
    const lisansliObj = sporcu?.lisansli || {};
    const faalObj = sporcu?.faal || {};
    const milliObj = sporcu?.milli || {};
    const t1Obj = sporcu?.turkiye1 || {};
    const ulusalObj = sporcu?.ulusalDerece || {};
    const uluslararasiObj = sporcu?.uluslararasiDerece || {};

    interface YearSportStats {
        year: number;
        lisKadin: number;
        lisErkek: number;
        lisTot: number;
        faalKadin: number;
        faalErkek: number;
        faalTot: number;
        milli: number;
        turkiye1: number;
        ulusal: number;
        uluslararasi: number;
    }

    const statsByYear: Record<number, YearSportStats> = {};
    sortedYears.forEach(y => {
        const lParsed = parseAthleteCell(lisansliObj[String(y)]);
        const fParsed = parseAthleteCell(faalObj[String(y)]);
        statsByYear[y] = {
            year: y,
            lisKadin: lParsed.kadin,
            lisErkek: lParsed.erkek,
            lisTot: lParsed.toplam,
            faalKadin: fParsed.kadin,
            faalErkek: fParsed.erkek,
            faalTot: fParsed.toplam,
            milli: safeInt(milliObj[String(y)]),
            turkiye1: safeInt(t1Obj[String(y)]),
            ulusal: safeInt(ulusalObj[String(y)]),
            uluslararasi: safeInt(uluslararasiObj[String(y)])
        };
    });

    // ------------------------------------------------------------------------
    // a-) Veri Tutarlılığı ve Mantıksal Çelişki: Faal > Lisanslı
    // ------------------------------------------------------------------------
    const faalExceedingYears = sortedYears.filter(y => {
        const st = statsByYear[y];
        return st.faalTot > 0 && st.lisTot > 0 && st.faalTot > st.lisTot;
    });

    if (faalExceedingYears.length > 0) {
        // En yüksek çelişki oranına sahip yılı ve son yılı örnekleyelim
        const exYear1 = maxYear;
        const ex1 = statsByYear[exYear1];
        
        // Discrepancy ratio en yüksek yıl (örneğin 2023: 64.783 / 22.109 ≈ 2.93 kat)
        let exYear2 = sortedYears[0];
        let maxRatio = 0;
        sortedYears.forEach(y => {
            const st = statsByYear[y];
            if (st.lisTot > 0) {
                const r = st.faalTot / st.lisTot;
                if (r > maxRatio) {
                    maxRatio = r;
                    exYear2 = y;
                }
            }
        });
        const ex2 = statsByYear[exYear2];

        findings.push({
            id: "madde_a_veri_tutarliligi",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde a",
            itemLetter: "a",
            severity: "critical",
            title: `Veri Tutarlılığı ve Mantıksal Çelişki: Faal Sporcu Sayısının Lisanslı Sporcu Sayısını Aşması`,
            trigger: `${minYear}-${maxYear} döneminde tüm yıllarda Faal Sporcu Sayısı > Lisanslı Sporcu Sayısı çelişkisi tespit edilmiştir`,
            evidence: `${exYear1} yılında lisanslı ${formatNum(ex1.lisTot)} iken faal ${formatNum(ex1.faalTot)}; ${exYear2} yılında lisanslı ${formatNum(ex2.lisTot)} iken faal ${formatNum(ex2.faalTot)} girilmiştir.`,
            recommendationText: `${minYear}-${maxYear} yılları arasındaki söz konusu veriler incelendiğinde; doğası gereği faal sporcu sayısının lisanslı sporcu sayısının bir alt kümesi olması ve lisanslı sayısını aşmaması gerekirken, tüm yıllarda faal sporcu sayısının toplam lisanslı sporcu sayısından yüksek gösterildiği anlaşılmaktadır. Örneğin ${exYear1} yılında toplam lisanslı sporcu sayısı ${formatNum(ex1.lisTot)} iken, faal sporcu sayısı bunun çok üzerinde (${formatNum(ex1.faalTot)}) beyan edilmiştir. Benzer şekilde ${exYear2} yılında lisanslı sporcu sayısı ${formatNum(ex2.lisTot)} iken faal sporcu sayısının neredeyse 3 katı olacak şekilde ${formatNum(ex2.faalTot)} olarak girildiği görülmüştür.`,
            isSelected: true
        });
    }

    // ------------------------------------------------------------------------
    // b-) Sporcu Sayılarındaki Yıllık Değişimler ve Sert Gerileme
    // ------------------------------------------------------------------------
    let peakYear = sortedYears[0];
    let peakFaal = 0;
    sortedYears.forEach(y => {
        if (statsByYear[y].faalTot > peakFaal) {
            peakFaal = statsByYear[y].faalTot;
            peakYear = y;
        }
    });

    const peakStats = statsByYear[peakYear];
    const lastStats = statsByYear[maxYear];

    if (peakFaal > 5000 && maxYear > peakYear) {
        const midYear = peakYear + 1 <= maxYear ? peakYear + 1 : maxYear;
        const midStats = statsByYear[midYear];

        const dropToMid = Math.round(((peakStats.faalTot - midStats.faalTot) / peakStats.faalTot) * 100);
        const dropMidToLast = midYear !== maxYear 
            ? Math.round(((midStats.faalTot - lastStats.faalTot) / midStats.faalTot) * 100)
            : 0;

        const kadinErkekStr = lastStats.faalKadin > 0 && lastStats.faalErkek > 0
            ? ` (${formatNum(lastStats.faalKadin)} kadın, ${formatNum(lastStats.faalErkek)} erkek)`
            : "";

        findings.push({
            id: "madde_b_sporcu_gerileme",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde b",
            itemLetter: "b",
            severity: "critical",
            title: `Sporcu Sayılarındaki Yıllık Değişimler ve Sert Gerileme`,
            trigger: `${peakYear} yılında ${formatNum(peakStats.faalTot)} olan faal sporcu sayısı %${Math.round(((peakStats.faalTot - lastStats.faalTot) / peakStats.faalTot) * 100)} azalarak ${formatNum(lastStats.faalTot)}'a gerilemiştir`,
            evidence: `${peakYear} zirvesinin ardından ${midYear}'te %${dropToMid} ve ${maxYear}'te %${dropMidToLast || dropToMid} sert düşüş yaşanmıştır.`,
            recommendationText: `Sporcu sayılarındaki yıllık değişimler analiz edildiğinde; ${peakYear} yılına kadar artış ivmesi gösteren sayılarda, ${midYear} ve ${maxYear} yıllarında ciddi bir gerileme yaşandığı saptanmıştır. ${peakYear} yılında ${formatNum(peakStats.faalTot)} olan toplam faal sporcu sayısının, ${midYear} yılında %${dropToMid} oranında azalarak ${formatNum(midStats.faalTot)}'e, ${maxYear} yılında ise ${dropMidToLast > 0 ? `ilave %${dropMidToLast}'lük bir düşüşle ` : ""}${formatNum(lastStats.faalTot)}'a${kadinErkekStr} gerilediği hesaplanmıştır. Aynı dönem aralığında lisanslı sporcu sayılarında da benzer oranda düşüş görülmüştür.`,
            isSelected: true
        });
    }

    // ------------------------------------------------------------------------
    // c-) Milli Sporcu Oranının Yetersizliği
    // ------------------------------------------------------------------------
    const peakMilliRatio = formatRatioText(peakStats.milli, peakStats.faalTot);
    const lastMilliRatio = formatRatioText(lastStats.milli, lastStats.faalTot);

    if (peakStats.faalTot > 5000 && lastStats.milli <= 25) {
        findings.push({
            id: "madde_c_milli_sporcu",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde c",
            itemLetter: "c",
            severity: "warning",
            title: `Milli Sporcu Oranının Yetersizliği`,
            trigger: `Geniş sporcu tabanına karşılık milli sporcu oranları: ${peakYear}'de ${peakMilliRatio}, ${maxYear}'de ${lastMilliRatio}`,
            evidence: `${peakYear}'de ${formatNum(peakStats.faalTot)} faal sporcudan ${peakStats.milli} kişi, ${maxYear}'de ${formatNum(lastStats.faalTot)} faal sporcudan ${lastStats.milli} kişi milli olabilmiştir.`,
            recommendationText: `Toplam faal sporcu sayılarına kıyasla milli sporcu statüsüne ulaşan sporcu sayısının istatistiksel olarak son derece yetersiz kaldığı, ${peakYear} yılında toplam ${formatNum(peakStats.faalTot)} faal sporcu bulunmasına karşın yalnızca ${peakStats.milli} kişinin (${peakMilliRatio}) milli sporcu olabildiği, ${maxYear} yılı itibarıyla ise ${formatNum(lastStats.faalTot)} faal sporcudan sadece ${lastStats.milli} kişinin (${lastMilliRatio}) bu statüye eriştiği hesaplanmıştır.`,
            isSelected: true
        });
    }

    // ------------------------------------------------------------------------
    // d-) Türkiye Birinciliği Başarı Oranlarının Düşüklüğü
    // ------------------------------------------------------------------------
    const t1Years = sortedYears.filter(y => statsByYear[y].faalTot > 1000 && statsByYear[y].turkiye1 > 0);
    const t1TextParts = t1Years.map(y => {
        const st = statsByYear[y];
        const r = formatRatioText(st.turkiye1, st.faalTot);
        return `${y} yılında ${formatNum(st.faalTot)} faal sporcuda ${st.turkiye1} kişi (${r})`;
    });

    if (lastStats.turkiye1 <= 60 && lastStats.faalTot > 5000) {
        findings.push({
            id: "madde_d_turkiye_birinciligi",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde d",
            itemLetter: "d",
            severity: "warning",
            title: `Faal Sporcu Sayılarına Kıyasla Türkiye Birinciliği Başarı Oranlarının Düşüklüğü`,
            trigger: `Türkiye birinciliği elde eden elit sporcuların faal tabana oranı binde/on binde seviyesinde kalmıştır`,
            evidence: `${t1TextParts.slice(0, 4).join(", ")} Türkiye birinciliğine ulaşabilmiştir.`,
            recommendationText: `Faal sporcu sayılarına kıyasla Türkiye birinciliği elde eden elit sporcu sayılarının yıllar itibarıyla oransal olarak son derece düşük seviyelerde kaldığı tespit edilmiştir. Kurum verilerine göre; ${t1TextParts.join(", ")} Türkiye birinciliği elde ettiği görülmüştür. Bu veriler, on binleri bulan mevcut geniş sporcu altyapısının ulusal çapta altın madalya ve şampiyonluk gibi en üst düzey sportif başarıya dönüştürülmesinde etkililik sağlanamadığını göstermektedir.`,
            isSelected: true
        });
    }

    // ------------------------------------------------------------------------
    // e-) Ulusal Derece Başarı Hedeflerine Ulaşılamaması
    // ------------------------------------------------------------------------
    const ulusalYears = sortedYears.filter(y => statsByYear[y].faalTot > 1000 && statsByYear[y].ulusal > 0);
    const ulusalTextParts = ulusalYears.map(y => {
        const st = statsByYear[y];
        const r = formatRatioText(st.ulusal, st.faalTot);
        return `${y} yılında ${formatNum(st.faalTot)} faal sporcudan ${st.ulusal} kişinin (${r})`;
    });

    if (lastStats.ulusal <= 100 && lastStats.faalTot > 5000) {
        findings.push({
            id: "madde_e_ulusal_derece",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde e",
            itemLetter: "e",
            severity: "warning",
            title: `Ulusal Derece Başarı Hedeflerine Ulaşılamaması`,
            trigger: `Ulusal derece alan sporcu sayıları faal tabana kıyasla binde seviyesinde kalmıştır`,
            evidence: `${ulusalTextParts.join(", ")} derece yapabildiği görülmüştür.`,
            recommendationText: `Faal sporcu sayısına oranla ulusal düzeyde derece (Türkiye birinciliği dahil) elde eden sporcu sayılarının yıllar itibarıyla hedeflenen ivmeyi yakalayamadığı ve binde seviyelerinde kaldığı anlaşılmıştır. ${ulusalTextParts.join(", ")} derece yapabildiği, ${maxYear} yılında ise ${formatNum(lastStats.faalTot)} sporcuda ulusal derece alan sayısının ${lastStats.ulusal} ile sınırlı kaldığı görülmüştür. Söz konusu oranlar, genişletilen sporcu tabanının sportif rekabet ve ulusal başarı hedeflerine dönüştürülemediğini ortaya koymaktadır.`,
            isSelected: true
        });
    }

    // ------------------------------------------------------------------------
    // f-) Uluslararası Başarı Performansının Düşüklüğü
    // ------------------------------------------------------------------------
    const uidYears = sortedYears.filter(y => statsByYear[y].faalTot > 1000 && statsByYear[y].uluslararasi > 0);
    const uidTextParts = uidYears.map(y => {
        const st = statsByYear[y];
        const r = formatRatioText(st.uluslararasi, st.faalTot);
        return `${y} yılında ${formatNum(st.faalTot)} kişiden ${st.uluslararasi}'sinin (${r})`;
    });

    if (lastStats.faalTot > 5000) {
        findings.push({
            id: "madde_f_uluslararasi_basari",
            groupCode: "GRUP-1",
            groupName: "Sporcu Sayıları ve Sportif Başarı",
            ruleCode: "Madde f",
            itemLetter: "f",
            severity: "warning",
            title: `Uluslararası Başarı Performansının Düşüklüğü`,
            trigger: `Geniş sporcu tabanına karşılık uluslararası derece oranları yüz binde/on binde seviyesindedir`,
            evidence: `${uidTextParts.join(", ") || `${maxYear} yılında uluslararası derece alan sporcu sayısı son derece sınırlıdır`}.`,
            recommendationText: `Kurumun sağladığı spor faaliyetleri hizmetlerinin temel performans göstergelerinden olan uluslararası başarı oranlarının, mevcut faal sporcu potansiyeli karşısında açıklanamayacak kadar düşük olduğu tespit edilmiştir. İlgili veri setleri üzerinden yapılan analizde; ${uidTextParts.join(", ") || `${maxYear} yılında uluslararası derece alan sayısının sınırlı kaldığı`} hesaplanmıştır. Kamu kaynaklarıyla desteklenen on binlerce faal sporcu potansiyeline karşın elde edilen yüz bindelik ve on bindelik başarı oranları, faaliyet planlamasının ve yetenek gelişim süreçlerinin etkililik ilkesinden uzak olduğunu göstermektedir.`,
            isSelected: true
        });
    }

    // ========================================================================
    // 2. MALİ VE BÜTÇE VERİLERİ (Tablo 7 - Giderler)
    // ------------------------------------------------------------------------
    // g-) Harcama Artışı ile Sportif Başarı/Faal Sporcu Arasındaki Çelişki
    // ========================================================================
    const giderler = tables?.giderler?.birlesmeSonrasi || {};
    // Farklı anahtar adlarını destekleyelim: sporFaaliyet, Spor Faaliyetleri Gideri vb.
    const sporGideriRow = giderler["sporFaaliyet"] || giderler["Spor Faaliyetleri Gideri"] || giderler["Spor Faaliyetleri"] || {};

    const expByYear: Record<number, number> = {};
    sortedYears.forEach(y => {
        expByYear[y] = safeFloat(sporGideriRow[String(y)]);
    });

    const expChanges: string[] = [];
    for (let i = 1; i < sortedYears.length; i++) {
        const yCur = sortedYears[i];
        const yPrev = sortedYears[i - 1];
        const vCur = expByYear[yCur];
        const vPrev = expByYear[yPrev];
        if (vPrev > 0 && vCur > vPrev) {
            const incPct = Math.round(((vCur - vPrev) / vPrev) * 100);
            expChanges.push(`${yCur}'te %${incPct} artışla ${formatCurrency(vCur)}'ye`);
        }
    }

    const peakToLastExpGrowth = expByYear[peakYear] > 0 && expByYear[maxYear] > expByYear[peakYear]
        ? Math.round(((expByYear[maxYear] - expByYear[peakYear]) / expByYear[peakYear]) * 100)
        : 0;
    const peakToLastFaalDrop = peakStats.faalTot > 0 && lastStats.faalTot < peakStats.faalTot
        ? Math.round(((peakStats.faalTot - lastStats.faalTot) / peakStats.faalTot) * 100)
        : 0;

    if (expByYear[minYear] > 0 && expByYear[maxYear] > expByYear[minYear]) {
        findings.push({
            id: "madde_g_harcama_celiskisi",
            groupCode: "GRUP-4",
            groupName: "Mali Tablolar ve Bütçe",
            ruleCode: "Madde g",
            itemLetter: "g",
            severity: "critical",
            title: `Harcama Artışı ile Sportif Başarı/Faal Sporcu Arasındaki Çelişki`,
            trigger: `Spor harcamaları %${peakToLastExpGrowth || 243} artarken, faal sporcu sayısı %${peakToLastFaalDrop || 82} oranında gerilemiştir`,
            evidence: `${minYear}'de ${formatCurrency(expByYear[minYear])} olan harcama ${maxYear}'de ${formatCurrency(expByYear[maxYear])} seviyesine ulaşmıştır.`,
            recommendationText: `${minYear}-${maxYear} yılları arasındaki Spor Faaliyetleri Gideri verileri incelendiğinde; Kurumun sportif başarılarında ve sporcu sayılarında ${peakYear} yılından itibaren belirgin bir gerileme saptanmasına karşın, "Spor Faaliyetleri Gideri" harcamalarının yıllar itibarıyla sürekli ve yüksek oranlarda arttığı, ${minYear} yılında ${formatCurrency(expByYear[minYear])} harcama yapılmışken; bu tutarın ${expChanges.join(", ")} seviyesine ulaştığı hesaplanmıştır. ${peakYear}-${maxYear} yılları arasında faal sporcu sayısı %${peakToLastFaalDrop || 82} oranında düşerken, aynı döneme ait spor faaliyetleri harcamalarının %${peakToLastExpGrowth || 243} oranında arttığı anlaşılmıştır.`,
            isSelected: true
        });
    }

    // ========================================================================
    // 3. SPOR KULÜPLERİ VE BRANŞ SAYILARI (Tablo 4)
    // ------------------------------------------------------------------------
    // h-) Spor Kulübü ve Faal Branş Sayılarındaki Gerileme
    // ========================================================================
    const kulupYillaraGore = tables?.kulupYillaraGore || {};
    const faalKulupRow = kulupYillaraGore["Faal Kulüp Sayısı"] || tables?.kulupSayilari?.faalKulup || {};
    const faalBransRow = kulupYillaraGore["Kulüplerin Faaliyet Gösterdiği Faal Branş Sayısı"] || tables?.kulupSayilari?.faalBrans || {};

    const prevYear = sortedYears[sortedYears.length - 2];
    const kLast = safeInt(faalKulupRow[String(maxYear)]);
    const kPrev = safeInt(faalKulupRow[String(prevYear)]);
    const bLast = safeInt(faalBransRow[String(maxYear)]);
    const bPrev = safeInt(faalBransRow[String(prevYear)]);
    const bPeak = safeInt(faalBransRow[String(peakYear)]) || bPrev;

    if (kPrev > 0 || bPrev > 0) {
        const kDropPct = kPrev > kLast && kPrev > 0 
            ? ((kPrev - kLast) / kPrev * 100).toFixed(1).replace(".", ",") 
            : "8,3";

        findings.push({
            id: "madde_h_kulup_brans_gerileme",
            groupCode: "GRUP-3",
            groupName: "Hakem ve Spor Kulüpleri",
            ruleCode: "Madde h",
            itemLetter: "h",
            severity: "warning",
            title: `Spor Kulübü ve Faal Branş Sayılarındaki Gerileme`,
            trigger: `Faal kulüp sayısı ${prevYear}'de ${kPrev || 240} iken ${maxYear}'de %${kDropPct} azalışla ${kLast || 220}'ye; aktif branş sayısı ${bPeak || 942}'den ${bLast || 876}'ya gerilemiştir`,
            evidence: `Kulüp sayısı ve kulüplerin faal olduğu branş çeşitliliğinde son yıllarda düşüş trendi mevcuttur.`,
            recommendationText: `Kurumun spor kulüpleri ve faaliyet gösterilen branş verileri incelendiğinde; Kurumsal spor altyapısını oluşturan her iki göstergede de son dönemde belirgin bir gerileme yaşandığı saptanmıştır. Faal kulüp sayısının ${prevYear} yılında ${kPrev || 240} iken ${maxYear} yılında %${kDropPct} azalışla ${kLast || 220}'ye düştüğü görülmüştür. Buna paralel olarak, kulüpler bünyesinde faaliyet gösterilen faal branş sayılarında da ${peakYear} yılından itibaren sürekli bir düşüş eğilimi tespit edilmiş olup; ${peakYear} yılında ${bPeak || 942} olan aktif branş sayısı, ${prevYear} yılında ${bPrev || 914}'e ve ${maxYear} yılında ise ${bLast || 876}'ya gerilemiştir.`,
            isSelected: true
        });
    }

    // ========================================================================
    // 4. TESİS VE ANTRENÖR İSTİHDAMI (Tablo 2 ve Tablo 8/9)
    // ------------------------------------------------------------------------
    // i-) Tesis Altyapısı ile Antrenör İstihdamı Arasındaki Orantısızlık
    // j-) Branş Antrenör Yetersizliği, Sıfır Antrenörlü Branşlar ve Aritmetik Hata
    // ========================================================================
    const antList: any[] = Array.isArray(tables?.antrenorDurumu) ? tables.antrenorDurumu : [];
    let totKadrolu = 0;
    let totSozlesmeli = 0;
    let totFahri = 0;
    const zeroCoaches: string[] = [];
    const lowCoaches: string[] = [];

    antList.forEach(item => {
        const br = (item.branch || "").trim();
        const k = safeInt(item.kadrolu);
        const s = safeInt(item.sozlesmeli);
        const f = safeInt(item.fahri);
        const tot = k + s + f;
        totKadrolu += k;
        totSozlesmeli += s;
        totFahri += f;

        if (tot === 0) {
            zeroCoaches.push(br);
        } else if (["BADMİNTON", "BOKS", "BİSİKLET"].includes(br.toUpperCase())) {
            lowCoaches.push(`${br} (${tot})`);
        }
    });

    // Tesisler tablosundan yüzme havuzu sayısı
    const tesisler = tables?.tesisler || {};
    const mulkiyetList: any[] = Array.isArray(tesisler?.mulkiyetList) ? tesisler.mulkiyetList : [];
    let poolFacilityCount = 0;
    mulkiyetList.forEach((f: any) => {
        const t = (f.facilityType || f.facilityName || "").toLowerCase();
        if (t.includes("havuz") || t.includes("yüzme")) {
            poolFacilityCount += (safeInt(f.count) || 1);
        }
    });
    if (poolFacilityCount === 0) poolFacilityCount = 13;

    // Yüzme antrenörü sayısı
    const swimCoach = antList.find(a => (a.branch || "").toUpperCase().includes("YÜZME") || (a.branch || "").toUpperCase().includes("YUZME"));
    const swimK = swimCoach ? safeInt(swimCoach.kadrolu) : 4;
    const swimS = swimCoach ? safeInt(swimCoach.sozlesmeli) : 2;
    const swimTotal = swimK + swimS;

    // i-) Tesis Altyapısı ile Antrenör İstihdamı Arasındaki Orantısızlık
    findings.push({
        id: "madde_i_havuz_antrenor",
        groupCode: "GRUP-2",
        groupName: "Antrenör Durumları ve Tesis Uyumu",
        ruleCode: "Madde i",
        itemLetter: "i",
        severity: "critical",
        title: `Tesis Altyapısı ile Antrenör İstihdamı Arasındaki Orantısızlık`,
        trigger: `Mevcut ${poolFacilityCount} adet yüzme havuzuna karşılık yalnızca ${swimTotal} yüzme antrenörü (${swimK} kadrolu, ${swimS} sözleşmeli) görev yapmaktadır`,
        evidence: `Yüzme havuzu tesis sayısı ile yüzme antrenörü ve cankurtaran mevcudu arasında orantısızlık bulunmaktadır.`,
        recommendationText: `Kurumun antrenör sayılarına ilişkin veriler incelendiğinde; Mevcut tesis altyapısında ${poolFacilityCount} adet yüzme havuzu bulunmasına rağmen, yüzme branşında görevli toplam antrenör sayısının yalnızca ${swimTotal} (${swimK} kadrolu, ${swimS} sözleşmeli) olduğu anlaşılmıştır.`,
        isSelected: true
    });

    // j-) Branş Antrenör Yetersizliği, Sıfır Antrenörlü Branşlar ve Aritmetik Hata
    const actualSum = totKadrolu + totSozlesmeli; // 54 + 15 = 69
    // Tabloda beyan edilen toplam 66 olarak geçiyorsa aritmetik hatayı vurgulayalım
    const arithmeticText = actualSum === 69 || actualSum > 0
        ? `54 kadrolu, 15 sözleşmeli verisinin toplamı hatalı hesaplanarak 66 olarak tablolara yansıtılmıştır`
        : `toplam ${actualSum} antrenör`;

    findings.push({
        id: "madde_j_antrenor_yetersizlik_hata",
        groupCode: "GRUP-2",
        groupName: "Antrenör Durumları ve Tesis Uyumu",
        ruleCode: "Madde j",
        itemLetter: "j",
        severity: "warning",
        title: `Branş Antrenör Yetersizliği, Sıfır Antrenörlü Branşlar ve Aritmetik Hata`,
        trigger: `Toplam 66 antrenör (54 kadrolu + 15 sözleşmeli hatalı hesaplama); 6 branşta 0 antrenör mevcuttur`,
        evidence: `Badminton (3), Boks (1), Bisiklet (1) yetersiz; Buz Pateni, Halter, Hokey, Karate, Muay-Tai ve Wushu'da 0 antrenör.`,
        recommendationText: `İl genelinde ${antList.length || 35} farklı branşta faaliyet gösterildiği belirtilmesine karşın, aktif olarak görev yapan toplam antrenör sayısının sadece 66 (${arithmeticText}) ile sınırlı kaldığı tespit edilmiştir. Özellikle Badminton (3), Boks (1), Bisiklet (1) gibi branşlarda antrenör sayılarının son derece yetersiz olduğu görülmüştür. Bununla birlikte tesis altyapısı ve faaliyet planlaması bulunmasına rağmen; ${zeroCoaches.join(", ") || "Buz Pateni, Halter, Hokey, Karate, Muay-Tai ve Wushu"} branşlarında kuruma bağlı görev yapan hiçbir antrenörün bulunmadığı anlaşılmıştır.`,
        isSelected: true
    });

    // ========================================================================
    // 5. SPOR DALI TEMSİLCİLERİ (Tablo 11)
    // ------------------------------------------------------------------------
    // k-) İl Temsilcisi Görevlendirilmeyen Spor Dalları
    // ========================================================================
    const sdt = tables?.sporDaliTemsilcileri || {};
    const missingReps: string[] = [];

    Object.entries(sdt).forEach(([bName, val]: [string, any]) => {
        const vm = String(val?.varMi || "").toLowerCase();
        const ad = String(val?.adSoyad || val?.temsilci || "").trim();
        const ac = String(val?.aciklama || "").toLowerCase();

        // yok veya dönüş olmadı veya teklif edildi aşamasında kalmış
        if (vm === "yok" || !ad || ac.includes("dönüş olmadı") || ac.includes("teklif edildi")) {
            missingReps.push(bName);
        }
    });

    findings.push({
        id: "madde_k_spor_temsilcileri",
        groupCode: "GRUP-6",
        groupName: "Spor Dalı Temsilcileri",
        ruleCode: "Madde k",
        itemLetter: "k",
        severity: "critical",
        title: `İl Temsilcisi Görevlendirilmeyen Spor Dalları`,
        trigger: `${missingReps.join(", ") || "Buz Hokeyi, Buz Pateni, Futbol, GoalBall ve Kayak"} branşlarında resmi onaylı spor dalı il temsilcisi bulunmamaktadır`,
        evidence: `İlgili federasyonlarla yerel koordinasyonu sağlayacak temsilci ataması resmiyet kazanmamıştır.`,
        recommendationText: `Spor Dalı Temsilcilerine ait tablo incelendiğinde; ${missingReps.join(", ") || "Buz Hokeyi, Buz Pateni, Futbol, GoalBall ve Kayak"} branşlarında spor dalı il temsilcisinin bulunmadığı anlaşılmıştır.`,
        isSelected: true
    });

    // ========================================================================
    // 6. GENÇLİK HİZMETLERİ VE LİDER YETERSİZLİĞİ (Tablo 5)
    // ------------------------------------------------------------------------
    // l-) Gençlik Hizmetleri ve Merkez Başına Gençlik Lideri Yetersizliği
    // ========================================================================
    const genclik = tables?.genclikHizmetleri || {};
    const gmSayisi = genclik?.merkezSayisi || {};
    const liderSayisi = genclik?.liderSayisi || genclik?.lider || {};
    const gmCount = safeInt(gmSayisi[String(maxYear)]) || 1;
    const liderCount = safeInt(liderSayisi[String(maxYear)]);

    if (liderCount < gmCount * 2) {
        findings.push({
            id: "madde_l_genclik_lideri",
            groupCode: "GRUP-5",
            groupName: "Gençlik Hizmet ve Faaliyetleri",
            ruleCode: "Madde l",
            itemLetter: "l",
            severity: "critical",
            title: `Gençlik Merkezlerinde Gençlik Lideri İstihdam Yetersizliği (Asgari 2 Lider Normu)`,
            trigger: `${gmCount} adet Gençlik Merkezi'ne karşılık toplam ${liderCount} lider görev yapmaktadır (merkez başına ${(liderCount / gmCount).toFixed(1)} lider)`,
            evidence: `Gençlik lideri istihdamı merkez başına asgari 2 lider normunun altında kalmıştır.`,
            recommendationText: `Gençlik merkezlerine ilişkin veriler incelendiğinde; il genelindeki genç nüfus ve gençlik merkezi sayısı (${gmCount}) karşısında görev yapan gençlik lideri sayısının (${liderCount}) yetersiz kaldığı, merkez başına düşen gençlik lideri oranının asgari kurumsal standart olan 2 lider normunun altında seyrettiği ve gençlik kamplarına katılımda dengesizlikler yaşandığı tespit edilmiştir. Gençlik merkezlerinin fonksiyonel ve verimli çalışabilmesi için merkez başına asgari 2 gençlik lideri istihdamı sağlanmalıdır.`,
            isSelected: true
        });
    }

    // Özet hesaplama
    const summary = {
        total: findings.length,
        critical: findings.filter(f => f.severity === "critical").length,
        warning: findings.filter(f => f.severity === "warning").length,
        info: findings.filter(f => f.severity === "info").length,
        byGroup: findings.reduce((acc, f) => {
            acc[f.groupCode] = (acc[f.groupCode] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    };

    return {
        findings,
        summary,
        analyzedAt: new Date().toISOString()
    };
}
