/**
 * Rapor Bölüm ve Madde Yönetim Sistemi
 * Resmi Bakanlık Şablonları için Bölüm Sıralaması, Madde Ekleme/Çıkarma ve Otomatik Numaralandırma
 */

export interface ReportSectionDef {
    id: string;
    code: string;
    title: string;
    description: string;
    checklistCategory?: string; // Denetim formundaki hangi alana denk geldiği
    isNarrative?: boolean; // Giriş, genel bilgiler gibi madde numarası almayan metin alanları
    defaultNarrativeText?: string;
}

export interface ReportClause {
    id: string;
    number: number;
    title: string;
    sectionId: string;
    rawHtml: string;
}

export interface SectionAnalysis {
    section: ReportSectionDef;
    existsInDoc: boolean;
    startIndex: number;
    clauseCount: number;
    clauses: ReportClause[];
}

// 1. İL MÜDÜRLÜĞÜ GENEL TEFTİŞ RAPORU (14 ANA HUSUS)
export const IL_MUDURLUGU_SECTIONS: ReportSectionDef[] = [
    { 
        id: "giris", 
        code: "1", 
        title: "GİRİŞ", 
        description: "Makam Oluru, Görev Emri ve Teftiş Dönemi (Madde numarası almaz, resmi giriş metnidir)", 
        checklistCategory: "Genel",
        isNarrative: true,
        defaultNarrativeText: "Bakanlık Makamının Olurları ve Rehberlik ve Denetim Başkanlığının Görev Emirleri uyarınca; Gençlik ve Spor İl Müdürlüğü nezdinde teftiş dönemi işlemlerinin genel teftişi yapılmış olup, tespit ve tenkit edilen hususlar aşağıda maddeler halinde belirtilmiştir."
    },
    { id: "onceki-teftis", code: "2", title: "ÖNCEKİ TEFTİŞ", description: "Bir önceki teftişte getirilen tenkitlerin yerine getirilme durumu", checklistCategory: "Genel" },
    { id: "spor-hizmetleri", code: "3", title: "SPOR HİZMETLERİ", description: "Spor faaliyetleri, lisanslı sporcular, kulüpler ve branşlar", checklistCategory: "Spor Hizmetleri" },
    { id: "yurt-hizmetleri", code: "4", title: "YURT HİZMETLERİ", description: "KYK yurtları, barınma kapasitesi, öğrenci memnuniyeti", checklistCategory: "Yurt İşlemleri" },
    { id: "genclik-hizmetleri", code: "5", title: "GENÇLİK HİZMETLERİ", description: "Gençlik merkezleri, kamplar ve gençlik projeleri", checklistCategory: "Gençlik Hizmetleri" },
    { id: "muhasebe-mali", code: "6", title: "MUHASEBE MALİ İŞLEMLER", description: "Bütçe, gelir-gider, mutemetlik ve harcama belgeleri", checklistCategory: "Mali İşlemler" },
    { id: "destek-hizmetleri", code: "7", title: "DESTEK HİZMETLERİ", description: "Satın alma, taşınır mal yönetimi, araç ve lojistik", checklistCategory: "İdari İşlemler" },
    { id: "yatirim-isletmeler", code: "8", title: "YATIRIM VE İŞLETMELER", description: "Spor tesisleri, yapım/onarım ihaleleri, kiralamalar ve taşınmazlar", checklistCategory: "Spor Tesisi" },
    { id: "personel", code: "9", title: "PERSONEL", description: "Kadro, unvan dağılımı, fazla mesai ve görevlendirmeler", checklistCategory: "İdari İşlemler" },
    { id: "hukuk-hizmetleri", code: "10", title: "HUKUK HİZMETLERİ", description: "Dava, icra takipleri ve sözleşmeli avukatlık işlemleri", checklistCategory: "İdari İşlemler" },
    { id: "bilgi-islem", code: "11", title: "BİLGİ İŞLEM", description: "Ağ altyapısı, internet kotaları, yerel personel ve donanım", checklistCategory: "Teknik Kontrol" },
    { id: "egitim", code: "12", title: "EĞİTİM", description: "Eğitim, araştırma ve koordinasyon faaliyetleri", checklistCategory: "Diğer" },
    { id: "diger-hususlar", code: "13", title: "DİĞER HUSUSLAR", description: "Yukarıdaki bölümlere girmeyen özel tespit ve konular", checklistCategory: "Diğer" },
    { id: "merkez-birimler", code: "14", title: "MERKEZ BİRİMLERİ İLGİLENDİREN HUSUSLAR", description: "Bakanlık merkez dairelerine iletilecek öneri ve tespitler", checklistCategory: "Diğer" }
];

// 2. FEDERASYON GENEL TEFTİŞ RAPORU (8 ANA BAŞLIK)
export const FEDERASYON_SECTIONS: ReportSectionDef[] = [
    { 
        id: "fed-giris", 
        code: "1", 
        title: "GİRİŞ", 
        description: "Onay, görevlendirme ve teftiş dönemi bilgileri (Madde numarası almaz)", 
        isNarrative: true,
        defaultNarrativeText: "Bakanlık Makam Onayı ve Rehberlik ve Denetim Başkanlığı Görev Emirleri gereğince; ilgili Bağımsız Spor Federasyonu nezdinde gerçekleştirilen genel teftişte tespit edilen hususlar aşağıda maddeler halinde belirtilmiştir."
    },
    { id: "fed-onceki-teftis", code: "2", title: "ÖNCEKİ TEFTİŞ", description: "Önceki teftiş raporu tenkit maddeleri ve takibi" },
    { id: "fed-spor-sicil", code: "3", title: "SPOR FAALİYETLERİ VE SİCİL-LİSANS İŞLEMLERİ", description: "Müsabakalar, milli takım başarıları, kulüp ve sporcu sicili" },
    { id: "fed-tesisler", code: "4", title: "TESİSLER", description: "Federasyona ait veya tahsisli tesisler, bakım ve onarımlar" },
    { id: "fed-mali", code: "5", title: "MALİ İŞLEMLER", description: "7405 sayılı Kanuna uygunluk, denk bütçe, banka ve muhasebe kayıtları" },
    { id: "fed-personel", code: "6", title: "PERSONEL İŞLEMLERİ", description: "Sözleşmeli ve bakanlık personeli, maaş ve nitelikler" },
    { id: "fed-diger", code: "7", title: "DİĞER HUSUSLAR", description: "Federasyona özgü diğer inceleme alanları" },
    { id: "fed-merkez", code: "8", title: "BAKANLIK MERKEZ BİRİMLERİNİ İLGİLENDİREN HUSUSLAR", description: "Bakanlık merkez birimlerine sunulan tespitler" }
];

// 3. ÖN İNCELEME RAPORU (9 RESMİ BÖLÜM - 4483 Sayılı Kanun Taslağı)
export const ON_INCELEME_SECTIONS: ReportSectionDef[] = [
    { id: "on-giris", code: "I", title: "GİRİŞ", description: "Bakanlık Makam Onayı, Görev Emri ve Ön İnceleme Tarihleri" },
    { id: "on-muhbir", code: "II", title: "MUHBİR-MÜŞTEKİ", description: "İhbarcı/Şikayetçi bilgileri veya Kamu Hukuku" },
    { id: "on-ogrenme", code: "III", title: "YETKİLİ MERCİİN ÖĞRENME TARİHİ", description: "Yetkili merci tarafından öğrenilme tarihi" },
    { id: "on-olay-yer-tarih", code: "IV", title: "OLAY YERİ VE TARİHİ", description: "Fiil veya iddiaların işlendiği yer ve tarih" },
    { id: "on-yapilanlar", code: "V", title: "HAKKINDA ÖN İNCELEME YAPILANLAR", description: "Hakkında inceleme yapılan kamu görevlilerinin künyeleri" },
    { id: "on-konu", code: "VI", title: "ÖN İNCELEMENİN KONUSU", description: "Ön inceleme yapılması istenilen konular ve iddialar" },
    { id: "on-calismalar", code: "VII", title: "YAPILAN ÖN İNCELEME ÇALIŞMALARI", description: "Toplanan bilgi, belge, tutanak ve alınan yazılı ifadeler" },
    { id: "on-tahlil", code: "VIII", title: "OLAYLARIN TAHLİLİ VE DELİLLERİN TARTIŞILMASI", description: "Mevzuat hükümleri ile fiil ve delillerin tahlili" },
    { id: "on-sonuc", code: "IX", title: "SONUÇ, KANAAT VE TEKLİFLER", description: "4483 sayılı Kanun uyarınca Soruşturma İzni Verilmesi/Verilmemesi teklifi" }
];

// 4. İNCELEME VE SORUŞTURMA RAPORU (7 RESMİ BÖLÜM)
export const SORUSTURMA_SECTIONS: ReportSectionDef[] = [
    { id: "sor-emir", code: "I", title: "İNCELEME / SORUŞTURMA EMRİ", description: "Onay, görevlendirme emri ve ek olurlar" },
    { id: "sor-iddia", code: "II", title: "İNCELEMENİN / SORUŞTURMANIN KONUSU", description: "İnceleme ve soruşturmanın konusu, iddialar" },
    { id: "sor-tarihler", code: "III", title: "İNCELEME / SORUŞTURMA TARİHLERİ", description: "Başlama ve bitirme tarihleri" },
    { id: "sor-muhbir", code: "IV", title: "MUHBİR-MÜŞTEKİ", description: "Müşteki adı, soyadı ve dilekçesi" },
    { id: "sor-yapilanlar", code: "V", title: "HAKKINDA İNCELEME / SORUŞTURMA YAPILANLAR", description: "Soruşturulan ilgililerin unvan ve görevleri" },
    { id: "sor-tahlil", code: "VI", title: "OLAYLARIN TAHLİLİ VE DELİLLERİN TARTIŞILMASI", description: "İfadeler, bilirkişi raporları, mevzuat tartışması ve dizi pusulası" },
    { id: "sor-sonuc", code: "VII", title: "SONUÇ, KANAAT VE TEKLİFLER", description: "Adli, Disiplin, Sportif Ceza, Mali ve İdari Yönden teklifler" }
];

// 5. SPOR KULÜPLERİ GENEL DENETİMİ (5 RESMİ BÖLÜM - 01.09.2025 Taslağı)
export const SPOR_KULUPLERI_SECTIONS: ReportSectionDef[] = [
    { 
        id: "sk-giris", 
        code: "A", 
        title: "GİRİŞ", 
        description: "Bakanlık Oluru, Görev Emri ve Denetim Dönemi (Madde numarası almaz)", 
        isNarrative: true,
        defaultNarrativeText: "Bakanlık Makam Olurları uyarınca; 7405 sayılı Spor Kulüpleri ve Spor Federasyonları Kanunu kapsamında yürütülen genel denetim bulguları aşağıda maddeler halinde sunulmuştur."
    },
    { 
        id: "sk-genel", 
        code: "B", 
        title: "GENEL BİLGİLER", 
        description: "Kulüp künyesi, tüzük, organlar, insan kaynakları, menkul ve gayrimenkuller (Madde numarası almaz)", 
        isNarrative: true,
        defaultNarrativeText: "Kulübün tescil, organlar, mali genel kurul ve üye yapısına ilişkin genel durum tespiti yapılmıştır."
    },
    { id: "sk-onceki", code: "C", title: "ÖNCEKİ DENETİM", description: "Önceki denetimde tenkit edilen hususların yerine getirilme durumu" },
    { id: "sk-tespitler", code: "D", title: "DENETİM DÖNEMİ İLE İLGİLİ TESPİTLER VE ÖNERİLER", description: "7405 sayılı Kanun 20. ve 47. maddeleri uyumu, hukuki/idari sorumluluklar ve öneriler" },
    { id: "sk-bakanlik", code: "E", title: "BAKANLIĞI İLGİLENDİREN HUSUSLAR", description: "Genel denetim sürecinde Bakanlık uygulamaları ve mevzuata dair öneriler" }
];

// Resmi Şablon - Kapak Eşleştirme Tablosu
export const TEMPLATE_COVER_MAP: Record<string, string> = {
    "2-_i̇l_müdürlüğü_genel_teftiş_raporu_taslağı_docx": "1-_genel_teftiş_rapor_kapağı_taslağı_docx",
    "3-_merkez_birim_genel_teftiş_raporu_taslağı_docx": "1-_genel_teftiş_rapor_kapağı_taslağı_docx",
    "4-_federasyon_genel_teftiş_raporu_taslağı_docx": "1-_genel_teftiş_rapor_kapağı_taslağı_docx",
    "2-_ön_i̇nceleme_raporu_taslağı_docx": "1-_ön_i̇nceleme_rapor_kapağı_taslağı_docx",
    "2-_i̇nceleme_-_soruşturma_rapor_taslağı_docx": "1-_i̇nceleme-soruşturma_rapor_kapağı_taslağı_docx",
    "2-_kulüp_i̇nceleme_rapor_taslağı_docx": "1-_kulüp_i̇nceleme_rapor_kapağı_taslağı_docx",
    "2-_suç_duyurusu_raporu_taslağı_docx": "1-_suç_duyurusu_rapor_kapağı_taslağı_docx",
    "spor_kulüpleri_genel_denetim_raporu_taslağı01_09_2025_docx": "1-_kulüp_i̇nceleme_rapor_kapağı_taslağı_docx"
};

/**
 * Verilen şablon kimliğine uygun resmi kapağı bulup rapor metni ile birleştirir
 */
export function getFullReportHtmlWithCover(
    templateId: string,
    bodyHtml: string,
    templates?: { id: string; html: string }[]
): string {
    const coverId = TEMPLATE_COVER_MAP[templateId];
    if (!coverId) return bodyHtml;
    
    let coverHtml = "";
    if (templates && templates.length > 0) {
        const found = templates.find(t => t.id === coverId);
        if (found) coverHtml = found.html;
    }
    
    if (coverHtml) {
        return combineCoverWithReport(coverHtml, bodyHtml);
    }
    return bodyHtml;
}

/**
 * Belge içeriğine ve başlığına göre en uygun bölüm şemasını döndürür
 */
export function detectReportSections(html: string = "", title: string = ""): ReportSectionDef[] {
    const combined = `${title} ${html}`.toLowerCase();
    
    if (combined.includes("federasyon") || combined.includes("fed-")) {
        return FEDERASYON_SECTIONS;
    }
    if (combined.includes("ön inceleme") || combined.includes("on-inceleme") || combined.includes("4483")) {
        return ON_INCELEME_SECTIONS;
    }
    if (combined.includes("soruşturma") || combined.includes("sorusturma") || combined.includes("disiplin")) {
        return SORUSTURMA_SECTIONS;
    }
    if (combined.includes("spor kulüb") || combined.includes("kulüp inceleme") || combined.includes("7405")) {
        return SPOR_KULUPLERI_SECTIONS;
    }
    
    // Varsayılan: İl Müdürlüğü Genel Teftiş Raporu (14 Husus)
    return IL_MUDURLUGU_SECTIONS;
}

/**
 * HTML içindeki tüm bölümleri ve altındaki tenkit maddelerini analiz eder
 */
export function analyzeDocumentSections(html: string, sectionDefs: ReportSectionDef[]): SectionAnalysis[] {
    const results: SectionAnalysis[] = [];
    if (!html) return results;

    // Her bölümün pozisyonunu bul
    const sectionPositions: { section: ReportSectionDef; index: number }[] = [];

    for (const sec of sectionDefs) {
        // Öncelik 1: data-section="id"
        let idx = html.indexOf(`data-section="${sec.id}"`);
        if (idx !== -1) {
            const openBracket = html.lastIndexOf('<', idx);
            if (openBracket !== -1) idx = openBracket;
        } else {
            // Öncelik 2: id="bolum-id"
            idx = html.indexOf(`id="bolum-${sec.id}"`);
            if (idx !== -1) {
                const openBracket = html.lastIndexOf('<', idx);
                if (openBracket !== -1) idx = openBracket;
            }
        }
        if (idx === -1) {
            // Öncelik 3: <strong>BÖLÜM ADI</strong> veya <u><strong>I- BÖLÜM ADI</strong></u>
            const regex = new RegExp(`(?:<u[^>]*>)?\\s*<strong[^>]*>\\s*(?:[A-Z0-9IVX]+[\\.-]\\s*)?${escapeRegExp(sec.title)}[\\s\\S]*?<\\/strong>`, 'i');
            const match = regex.exec(html);
            if (match) {
                idx = match.index;
            }
        }

        if (idx !== -1) {
            sectionPositions.push({ section: sec, index: idx });
        }
    }

    // Pozisyona göre sırala
    sectionPositions.sort((a, b) => a.index - b.index);

    // Her bölüm için altındaki maddeleri çıkar
    for (let i = 0; i < sectionDefs.length; i++) {
        const sec = sectionDefs[i];
        const found = sectionPositions.find(p => p.section.id === sec.id);

        if (!found) {
            results.push({
                section: sec,
                existsInDoc: false,
                startIndex: -1,
                clauseCount: 0,
                clauses: []
            });
            continue;
        }

        // Bir sonraki bölümün başladığı yere kadar olan HTML parçası
        const nextFound = sectionPositions.find(p => p.index > found.index);
        const sectionChunk = nextFound 
            ? html.substring(found.index, nextFound.index)
            : html.substring(found.index);

        // Bu parça içindeki "Madde X:" bloklarını bul
        const clauses: ReportClause[] = [];
        const maddeRegex = /<(?:div|p)[^>]*?(?:data-madde-id="([^"]+)")?[^>]*?>\s*(?:<p[^>]*?>)?\s*<strong>\s*Madde\s+(\d+)\s*:\s*<\/strong>([\s\S]*?)(?:<\/(?:p|div)>)/gi;
        
        let match;
        while ((match = maddeRegex.exec(sectionChunk)) !== null) {
            const rawMaddeId = match[1] || `madde-${match[2]}-${Math.random().toString(36).substring(2, 7)}`;
            const num = parseInt(match[2], 10) || (clauses.length + 1);
            const snippet = match[3] ? match[3].replace(/<[^>]*>/g, '').trim().substring(0, 80) : '';

            clauses.push({
                id: rawMaddeId,
                number: num,
                title: snippet ? `Madde ${num}: ${snippet}...` : `Madde ${num}`,
                sectionId: sec.id,
                rawHtml: match[0]
            });
        }

        results.push({
            section: sec,
            existsInDoc: true,
            startIndex: found.index,
            clauseCount: clauses.length,
            clauses
        });
    }

    return results;
}

/**
 * Belirli bir bölümün altına yeni bir resmi madde ekler
 * Bölüm sıralarını ASLA bozmaz.
 */
export function insertClauseToSection(
    html: string,
    targetSectionId: string,
    sectionDefs: ReportSectionDef[],
    findingData?: { text?: string; note?: string; lawRef?: string }
): { updatedHtml: string; newClauseId: string; clauseNumber: number } {
    const analysis = analyzeDocumentSections(html, sectionDefs);
    
    // Rapor genelindeki toplam madde sayısını ve sonraki madde numarasını hesapla
    const totalExistingClauses = analysis.reduce((acc, curr) => acc + curr.clauseCount, 0);
    const nextClauseNum = totalExistingClauses + 1;
    const clauseId = `madde-${nextClauseNum}-${Date.now().toString(36)}`;

    // Resmi Bakanlık standart tenkit / tespit maddesi şablonu
    const topicText = findingData?.text || "Tenkit / Tespit Konusu";
    const noteText = findingData?.note || "Açıklama ve tespit edilen aykırılık...";
    const lawText = findingData?.lawRef || "Gençlik ve Spor Bakanlığı mevzuatı ve ilgili talimat hükümleri...";

    const clauseHtml = `
<div class="muf-madde-bloku" data-madde-id="${clauseId}" data-madde-num="${nextClauseNum}" style="margin: 18px 0; padding: 14px 18px; border-left: 4px solid #2563eb; background-color: #f8fafc; border-radius: 6px;">
    <p class="ql-align-justify"><strong>Madde ${nextClauseNum}: </strong><em>${escapeHtml(topicText)}</em></p>
    <p class="ql-align-justify"><em>${escapeHtml(noteText)}</em></p>
    <p class="ql-align-justify"><em>Mevzuat Dayanağı: ${escapeHtml(lawText)}</em></p>
    <p><strong>Birim Cevabı: </strong>“………………”</p>
    <p><strong>Müfettişin Son Görüşü: </strong><em>Mevzuat hükümlerine tam uyulması yönünde gerekli talimat verilmelidir.</em></p>
</div>`;

    // 1. Hedef bölümü bul
    const targetSecAnalysis = analysis.find(a => a.section.id === targetSectionId);
    
    // Eğer hedef bölüm raporda yoksa, bölümün kendisini ve başlığını ekle
    if (!targetSecAnalysis || !targetSecAnalysis.existsInDoc) {
        const targetSecDef = sectionDefs.find(s => s.id === targetSectionId);
        const secTitle = targetSecDef ? targetSecDef.title : targetSectionId.toUpperCase();
        
        // Bu bölümün şemadaki indeksini bul
        const targetIdxInDefs = sectionDefs.findIndex(s => s.id === targetSectionId);
        
        // Kendisinden sonra gelen ve raporda var olan ilk bölümü ara
        let insertBeforeIndex = -1;
        for (let j = targetIdxInDefs + 1; j < sectionDefs.length; j++) {
            const nextSec = analysis.find(a => a.section.id === sectionDefs[j].id);
            if (nextSec && nextSec.existsInDoc) {
                insertBeforeIndex = nextSec.startIndex;
                break;
            }
        }

        const sectionWithClauseHtml = `
<div id="bolum-${targetSectionId}" data-section="${targetSectionId}" class="muf-rapor-bolum">
    <p class="ql-align-justify" style="margin-top: 24px;"><strong>${secTitle}</strong></p>
    <p class="ql-align-justify" style="color: #64748b; font-size: 11px;"><em>${targetSecDef?.description || ''}</em></p>
    ${clauseHtml}
</div>`;

        if (insertBeforeIndex !== -1) {
            const updatedHtml = html.slice(0, insertBeforeIndex) + sectionWithClauseHtml + html.slice(insertBeforeIndex);
            return { updatedHtml, newClauseId: clauseId, clauseNumber: nextClauseNum };
        } else {
            const updatedHtml = html + sectionWithClauseHtml;
            return { updatedHtml, newClauseId: clauseId, clauseNumber: nextClauseNum };
        }
    }

    // Hedef bölüm zaten var! O bölümün bitiş noktasını (bir sonraki bölümün başını) veya son maddesini bul.
    const allExistingSorted = analysis.filter(a => a.existsInDoc).sort((a, b) => a.startIndex - b.startIndex);
    const currIndexInSorted = allExistingSorted.findIndex(a => a.section.id === targetSectionId);
    const nextSecInSorted = allExistingSorted[currIndexInSorted + 1];

    let insertPos = -1;
    if (nextSecInSorted) {
        insertPos = nextSecInSorted.startIndex;
    } else {
        insertPos = html.length;
    }

    const updatedHtml = html.slice(0, insertPos) + clauseHtml + html.slice(insertPos);
    return { updatedHtml, newClauseId: clauseId, clauseNumber: nextClauseNum };
}

/**
 * Belirli bir maddeyi siler ve rapor genelindeki madde numaralarını sırayla baştan numaralandırır
 */
export function removeClauseAndRenumber(html: string, clauseId: string): string {
    if (!html || !clauseId) return html;

    // 1. data-madde-id="clauseId" olan bloğu kaldır
    // Blok div ise veya p ise güvenle eşle
    const blockRegex = new RegExp(`<div[^>]*?data-madde-id="${escapeRegExp(clauseId)}"[^>]*?>[\\s\\S]*?<\\/div>`, 'gi');
    let cleaned = html.replace(blockRegex, '');

    // Eğer div bulunamadıysa p etiketi içinde ara
    if (cleaned === html) {
        const pRegex = new RegExp(`<p[^>]*?data-madde-id="${escapeRegExp(clauseId)}"[^>]*?>[\\s\\S]*?<\\/p>`, 'gi');
        cleaned = html.replace(pRegex, '');
    }

    // 2. Kalan tüm "Madde X:" ifadelerini baştan sırayla numaralandır (Madde 1, Madde 2, ...)
    let counter = 1;
    cleaned = cleaned.replace(/<strong>\s*Madde\s+\d+\s*:\s*<\/strong>/gi, () => {
        const replacement = `<strong>Madde ${counter}: </strong>`;
        counter++;
        return replacement;
    });

    return cleaned;
}

/**
 * Bir bölümü ve altındaki tüm maddeleri/içerikleri rapordan kaldırır.
 * Kalan maddeleri baştan sırayla numaralandırır.
 */
export function removeSectionFromDoc(
    html: string,
    sectionId: string,
    sectionDefs: ReportSectionDef[]
): string {
    if (!html || !sectionId) return html;

    const analysis = analyzeDocumentSections(html, sectionDefs);
    const target = analysis.find(a => a.section.id === sectionId);
    if (!target || !target.existsInDoc || target.startIndex === -1) {
        return html;
    }

    // Pozisyonları sıralı mevcut bölümler
    const existingSorted = analysis.filter(a => a.existsInDoc && a.startIndex !== -1).sort((a, b) => a.startIndex - b.startIndex);
    const currIndex = existingSorted.findIndex(a => a.section.id === sectionId);
    const nextSec = existingSorted[currIndex + 1];

    let startCut = target.startIndex;

    // Eğer target.startIndex bir <div id="bolum-..." içine denk geliyorsa veya başlık bir <p> ise,
    // o etiketin başlangıcını yakalamak için geriye doğru <div veya <p tag açılışını kontrol et
    const lookback = html.substring(Math.max(0, startCut - 160), startCut);
    const divOpeningMatch = lookback.match(/<div[^>]*?(?:data-section|id="bolum)[^>]*?>\s*$/i) ||
                            lookback.match(/<p[^>]*?>\s*$/i);
    if (divOpeningMatch) {
        startCut -= divOpeningMatch[0].length;
    }

    let endCut = html.length;
    if (nextSec && nextSec.startIndex !== -1) {
        endCut = nextSec.startIndex;
        const nextLookback = html.substring(Math.max(0, endCut - 160), endCut);
        const nextDivOpening = nextLookback.match(/<div[^>]*?(?:data-section|id="bolum)[^>]*?>\s*$/i) ||
                               nextLookback.match(/<p[^>]*?>\s*$/i);
        if (nextDivOpening) {
            endCut -= nextDivOpening[0].length;
        }
    } else {
        // Eğer bu son bölümse, imza tablosuna kadar kesmeyi gözet
        const sigIdx = html.indexOf('<table', startCut);
        if (sigIdx !== -1 && sigIdx > startCut) {
            endCut = sigIdx;
        }
    }

    let updatedHtml = html.slice(0, startCut) + html.slice(endCut);

    // Kalan tüm "Madde X:" ifadelerini baştan sırayla numaralandır (Madde 1, Madde 2, ...)
    let counter = 1;
    updatedHtml = updatedHtml.replace(/<strong>\s*Madde\s+\d+\s*:\s*<\/strong>/gi, () => {
        const replacement = `<strong>Madde ${counter}: </strong>`;
        counter++;
        return replacement;
    });

    return updatedHtml;
}

/**
 * Raporda bulunmayan bir bölümü resmi sıralamadaki ait olduğu yere geri ekler.
 */
export function restoreSectionToDoc(
    html: string,
    sectionId: string,
    sectionDefs: ReportSectionDef[]
): string {
    if (!html || !sectionId) return html;

    const analysis = analyzeDocumentSections(html, sectionDefs);
    const target = analysis.find(a => a.section.id === sectionId);
    if (target && target.existsInDoc) {
        return html; // Zaten mevcut
    }

    const targetSecDef = sectionDefs.find(s => s.id === sectionId);
    if (!targetSecDef) return html;

    const targetDefIndex = sectionDefs.findIndex(s => s.id === sectionId);

    // Kendisinden sonra gelen ve raporda mevcut olan ilk bölümü bul
    let insertBeforeIndex = -1;
    for (let i = targetDefIndex + 1; i < sectionDefs.length; i++) {
        const laterSec = analysis.find(a => a.section.id === sectionDefs[i].id);
        if (laterSec && laterSec.existsInDoc && laterSec.startIndex !== -1) {
            insertBeforeIndex = laterSec.startIndex;
            break;
        }
    }

    const sectionHtml = `
<div id="bolum-${sectionId}" data-section="${sectionId}" class="muf-rapor-bolum">
    <p class="ql-align-justify" style="margin-top: 24px;"><strong>${escapeHtml(targetSecDef.title)}</strong></p>
    <p class="ql-align-justify" style="color: #64748b; font-size: 11px;"><em>${escapeHtml(targetSecDef.description)}</em></p>
</div>`;

    if (insertBeforeIndex !== -1) {
        return html.slice(0, insertBeforeIndex) + sectionHtml + html.slice(insertBeforeIndex);
    } else {
        // İmzadan önce veya en sona ekle
        const sigIdx = html.lastIndexOf('<table');
        if (sigIdx !== -1) {
            return html.slice(0, sigIdx) + sectionHtml + html.slice(sigIdx);
        }
        return html + sectionHtml;
    }
}

/**
 * Denetim formundaki bulguları (checklist "Hayır" cevaplarını) 14 resmi başlığa akıllıca dağıtarak
 * resmi İl Teftiş Taslağına dönüştürür.
 */
export function buildIlTeftisReportHtml(
    baseTemplateHtml: string,
    findings: { text: string; area: string; note: string }[],
    facilities: any[] = []
): string {
    // Kategori eşleşme tablosu (Checklist alanları -> 14 Ana Başlık)
    const areaToSectionMap: Record<string, string> = {
        "Spor Hizmetleri": "spor-hizmetleri",
        "Spor": "spor-hizmetleri",
        "Yurt İşlemleri": "yurt-hizmetleri",
        "Yurt": "yurt-hizmetleri",
        "Gençlik Hizmetleri": "genclik-hizmetleri",
        "Gençlik": "genclik-hizmetleri",
        "Mali İşlemler": "muhasebe-mali",
        "Mali": "muhasebe-mali",
        "İdari İşlemler": "destek-hizmetleri",
        "Personel": "personel",
        "Spor Tesisi": "yatirim-isletmeler",
        "Tesis": "yatirim-isletmeler",
        "Teknik Kontrol": "bilgi-islem",
        "Bilgi İşlem": "bilgi-islem",
        "Hukuk": "hukuk-hizmetleri"
    };

    let workingHtml = baseTemplateHtml;

    // Şablon başlıklarına semantic id ve data-section özniteliklerini yerleştir
    IL_MUDURLUGU_SECTIONS.forEach(sec => {
        const regex = new RegExp(`(<p[^>]*?>\\s*<strong>\\s*${escapeRegExp(sec.title)}\\s*<\\/strong>\\s*<\\/p>)`, 'i');
        workingHtml = workingHtml.replace(regex, `<div id="bolum-${sec.id}" data-section="${sec.id}" class="muf-bolum-anchor">$1</div>`);
    });

    // Tesisler tablosu varsa Yatırım ve İşletmeler altına tabloyu ekle
    if (facilities && facilities.length > 0) {
        const facilitiesTableHtml = `
<table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px; margin: 14px 0;">
    <thead style="background-color: #f1f5f9;">
        <tr>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 40px;">No</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Tesis Adı ve Türü</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">İlçe / Mevki</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 90px;">Durumu</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Tespit Edilen Eksiklik ve Notlar</th>
        </tr>
    </thead>
    <tbody>
        ${facilities.map((fac, idx) => {
            const status = fac.durum === "faal" ? "Faal" : fac.durum === "bakimda" ? "Bakımda" : fac.durum === "kismen_faal" ? "Kısmen Faal" : "Atıl";
            return `<tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;"><strong>${escapeHtml(fac.ad || '')}</strong><br/><span style="color:#64748b;">${escapeHtml(fac.tur || '')}</span></td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(fac.ilce || '-')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${status}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${fac.bilgiNotu ? escapeHtml(fac.bilgiNotu) : '<em>Eksiklik belirtilmemiştir.</em>'}</td>
            </tr>`;
        }).join('')}
    </tbody>
</table>`;

        const yatirimAnchor = workingHtml.indexOf('data-section="yatirim-isletmeler"');
        if (yatirimAnchor !== -1) {
            const nextP = workingHtml.indexOf('</p>', yatirimAnchor);
            if (nextP !== -1) {
                workingHtml = workingHtml.slice(0, nextP + 4) + facilitiesTableHtml + workingHtml.slice(nextP + 4);
            }
        }
    }

    // Her bulguyu ilgili başlığa madde olarak ekle
    findings.forEach(f => {
        const secId = areaToSectionMap[f.area] || "diger-hususlar";
        const res = insertClauseToSection(workingHtml, secId, IL_MUDURLUGU_SECTIONS, {
            text: f.text,
            note: f.note
        });
        workingHtml = res.updatedHtml;
    });

    return workingHtml;
}

/**
 * Federasyon teftiş raporu için bulguları ilgili başlıklara yerleştirir
 */
export function buildFederasyonReportHtml(
    baseTemplateHtml: string,
    findings: { text: string; area: string; note: string }[]
): string {
    const areaToSectionMap: Record<string, string> = {
        "Spor Faaliyetleri": "fed-spor-sicil",
        "Sicil-Lisans": "fed-spor-sicil",
        "Spor": "fed-spor-sicil",
        "Tesis": "fed-tesisler",
        "Tesisler": "fed-tesisler",
        "Mali İşlemler": "fed-mali",
        "Mali": "fed-mali",
        "Personel": "fed-personel",
        "Diğer": "fed-diger"
    };

    let workingHtml = baseTemplateHtml;

    FEDERASYON_SECTIONS.forEach(sec => {
        const regex = new RegExp(`(<p[^>]*?>\\s*<strong>\\s*${escapeRegExp(sec.title)}\\s*<\\/strong>\\s*<\\/p>)`, 'i');
        workingHtml = workingHtml.replace(regex, `<div id="bolum-${sec.id}" data-section="${sec.id}" class="muf-bolum-anchor">$1</div>`);
    });

    findings.forEach(f => {
        const secId = areaToSectionMap[f.area] || "fed-diger";
        const res = insertClauseToSection(workingHtml, secId, FEDERASYON_SECTIONS, {
            text: f.text,
            note: f.note
        });
        workingHtml = res.updatedHtml;
    });

    return workingHtml;
}

/**
 * Spor Kulüpleri denetim raporu için bulguları yerleştirir
 */
export function buildSporReportHtml(
    baseTemplateHtml: string,
    findings: { text: string; area: string; note: string }[]
): string {
    let workingHtml = baseTemplateHtml;

    SPOR_KULUPLERI_SECTIONS.forEach(sec => {
        const regex = new RegExp(`(<p[^>]*?>\\s*(?:<u[^>]*>)?\\s*<strong>\\s*(?:[A-Z0-9IVX]+[\\.-]\\s*)?${escapeRegExp(sec.title)}[\\s\\S]*?<\\/strong>\\s*(?:<\\/u>)?\\s*<\\/p>)`, 'i');
        workingHtml = workingHtml.replace(regex, `<div id="bolum-${sec.id}" data-section="${sec.id}" class="muf-bolum-anchor">$1</div>`);
    });

    findings.forEach(f => {
        const res = insertClauseToSection(workingHtml, "sk-tespitler", SPOR_KULUPLERI_SECTIONS, {
            text: f.text,
            note: f.note
        });
        workingHtml = res.updatedHtml;
    });

    return workingHtml;
}

/**
 * Resmi rapor kapağını ve rapor gövdesini tek bir belgede şık bir sayfa sonu ile birleştirir
 */
export function combineCoverWithReport(coverHtml: string, reportHtml: string): string {
    if (!coverHtml) return reportHtml;
    return `
<div class="muf-rapor-kapak-container" style="margin-bottom: 2cm;">
    ${coverHtml}
</div>
<div style="page-break-before: always; border-top: 2px dashed #94a3b8; margin: 30px 0; padding-top: 20px;">
    <p style="text-align: center; color: #94a3b8; font-size: 10px; font-style: italic; margin-bottom: 20px;">--- RAPOR METNİ BAŞLANGICI ---</p>
    ${reportHtml}
</div>`;
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * HTML etiket sızıntısı veya bozuk karakter kalıntılarını temizler
 */
export function cleanCorruptedNarrativeText(text: string, defaultText: string = ""): string {
    if (!text) return defaultText;

    // Etiket ve öznitelik sızıntısı kontrolü (data-section, muf-rapor-bolum, bolum-, vb.)
    if (
        text.includes('data-section=') ||
        text.includes('muf-rapor-bolum') ||
        text.includes('bolum-') ||
        text.includes('&quot;fed-') ||
        text.includes('muf-narrative-block') ||
        text.includes('&lt;div') ||
        text.includes('<div')
    ) {
        const cleaned = text
            .replace(/data-section\s*=\s*(?:"|&quot;)[^"&]+(?:"|&quot;)/gi, '')
            .replace(/class\s*=\s*(?:"|&quot;)[^"&]+(?:"|&quot;)/gi, '')
            .replace(/style\s*=\s*(?:"|&quot;)[^"&]+(?:"|&quot;)/gi, '')
            .replace(/id\s*=\s*(?:"|&quot;)[^"&]+(?:"|&quot;)/gi, '')
            .replace(/<\/?div[^>]*>/gi, '')
            .replace(/&lt;\/?div[^&]*&gt;/gi, '')
            .replace(/&lt;[^&]*&gt;/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/Madde\s+\d+[\s:–\-]*/gi, '')
            .replace(/&quot;/g, '')
            .replace(/[<>&;"=]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned || cleaned.length < 10) {
            return defaultText;
        }
        return cleaned;
    }

    return text.trim();
}

/**
 * Dinamik Rapor Yapılandırıcı Veri Modelleri
 */
export interface DynamicClauseItem {
    id: string;
    text: string;
}

export interface DynamicSectionItem {
    sectionDef: ReportSectionDef;
    isActive: boolean;
    narrativeText?: string;
    clauses: DynamicClauseItem[];
}

export interface StructuredReportState {
    templateId?: string;
    sections: DynamicSectionItem[];
}

/**
 * HTML metninden yapılandırılmış Dinamik Yapılandırıcı durumunu çıkarır
 */
export function parseHtmlToStructuredReport(
    html: string,
    sectionDefs: ReportSectionDef[]
): StructuredReportState {
    if (!html || !html.trim()) {
        return {
            sections: sectionDefs.map(sec => ({
                sectionDef: sec,
                isActive: true,
                narrativeText: sec.isNarrative ? (sec.defaultNarrativeText || "") : undefined,
                clauses: []
            }))
        };
    }

    // 1. Tarayıcı ortamında DOMParser kullanarak güvenli ve eksiksiz ayrıştırma
    if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const sections: DynamicSectionItem[] = sectionDefs.map(sec => {
                let secEl = doc.querySelector(`[data-section="${sec.id}"]`) ||
                            doc.querySelector(`#bolum-${sec.id}`);

                if (!secEl) {
                    const headings = Array.from(doc.querySelectorAll('strong, h1, h2, h3, h4, u'));
                    const foundHeading = headings.find(h => {
                        const text = (h.textContent || "").trim().toLowerCase();
                        return text.includes(sec.title.toLowerCase());
                    });
                    if (foundHeading) {
                        secEl = (foundHeading.closest('div.muf-rapor-bolum') || foundHeading.parentElement) as HTMLElement | null;
                    }
                }

                const isActive = !!secEl;
                let narrativeText: string | undefined = undefined;
                const clauses: DynamicClauseItem[] = [];

                if (sec.isNarrative) {
                    if (secEl) {
                        const narrBlock = secEl.querySelector('.muf-narrative-block');
                        if (narrBlock) {
                            narrativeText = narrBlock.textContent?.trim();
                        } else {
                            const clone = secEl.cloneNode(true) as HTMLElement;
                            clone.querySelectorAll('p, h1, h2, h3, h4').forEach(p => {
                                const pText = (p.textContent || "").trim().toLowerCase();
                                if (pText.includes(sec.title.toLowerCase()) || (sec.description && pText.includes(sec.description.toLowerCase().slice(0, 30)))) {
                                    p.remove();
                                }
                            });
                            narrativeText = clone.textContent?.trim();
                        }
                    }
                    narrativeText = cleanCorruptedNarrativeText(narrativeText || "", sec.defaultNarrativeText || "");
                } else if (secEl) {
                    const clauseEls = Array.from(secEl.querySelectorAll('.muf-tenkit-madde-block, [data-madde-id]'));
                    if (clauseEls.length > 0) {
                        clauseEls.forEach((cEl, idx) => {
                            const id = cEl.getAttribute('data-madde-id') || `clause-${sec.id}-${idx}-${Date.now()}`;
                            let text = cEl.textContent?.trim() || "";
                            text = text.replace(/^Madde\s+\d+[\s:–\-]+/i, '').trim();
                            clauses.push({ id, text });
                        });
                    } else {
                        const pEls = Array.from(secEl.querySelectorAll('p, div'));
                        pEls.forEach((pEl, idx) => {
                            const raw = pEl.textContent?.trim() || "";
                            if (/^Madde\s+\d+[\s:–\-]/i.test(raw)) {
                                const text = raw.replace(/^Madde\s+\d+[\s:–\-]+/i, '').trim();
                                clauses.push({
                                    id: `clause-${sec.id}-${idx}-${Date.now()}`,
                                    text
                                });
                            }
                        });
                    }
                }

                return {
                    sectionDef: sec,
                    isActive,
                    narrativeText: sec.isNarrative ? (narrativeText || sec.defaultNarrativeText || "") : undefined,
                    clauses
                };
            });

            return { sections };
        } catch (e) {
            console.error("DOMParser fallback in parseHtmlToStructuredReport:", e);
        }
    }

    // 2. Fallback: DOMParser bulunmayan ortamlarda güvenli analiz
    const analysis = analyzeDocumentSections(html, sectionDefs);

    const sections: DynamicSectionItem[] = sectionDefs.map(sec => {
        const found = analysis.find(a => a.section.id === sec.id);
        const isActive = found ? found.existsInDoc : true;

        let narrativeText: string | undefined = undefined;
        if (sec.isNarrative) {
            if (found && found.startIndex !== -1) {
                const nextPos = analysis
                    .filter(a => a.startIndex > found.startIndex)
                    .sort((a, b) => a.startIndex - b.startIndex)[0];
                const chunk = nextPos 
                    ? html.substring(found.startIndex, nextPos.startIndex)
                    : html.substring(found.startIndex);

                const clean = chunk
                    .replace(/<p[^>]*?>\s*(?:<u[^>]*>)?\s*<strong[^>]*>[\s\S]*?<\/strong>[\s\S]*?<\/p>/i, '')
                    .replace(/<p[^>]*?>\s*<em[^>]*>[\s\S]*?<\/em>\s*<\/p>/i, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                narrativeText = cleanCorruptedNarrativeText(clean, sec.defaultNarrativeText || "");
            } else {
                narrativeText = sec.defaultNarrativeText || "";
            }
        }

        const clauses: DynamicClauseItem[] = sec.isNarrative ? [] : (found?.clauses || []).map(c => {
            // "Madde X: Tenkit metni" veya "Madde X- Tenkit metni" ayıkla
            let rawText = c.rawHtml.replace(/<[^>]*>/g, '').trim();
            rawText = rawText.replace(/^Madde\s+\d+[\s:–\-]+/i, '').trim();

            return {
                id: c.id,
                text: rawText || c.title.replace(/^Madde\s+\d+[\s:–\-]+/i, '').trim()
            };
        });

        return {
            sectionDef: sec,
            isActive,
            narrativeText: sec.isNarrative ? (narrativeText || sec.defaultNarrativeText || "") : undefined,
            clauses
        };
    });

    return {
        sections
    };
}

/**
 * Yapılandırılmış Dinamik Yapılandırıcı durumunu resmi Bakanlık Word/HTML formatına derler
 * Maddeleri "Madde X- Tenkit metni" formatında ardışık olarak numaralandırır.
 * Anlatı / Giriş bölümlerine tenkit madde numarası verilmez.
 */
export function compileStructuredReportToHtml(
    state: StructuredReportState,
    coverHtml?: string
): string {
    let globalClauseCounter = 1;
    let bodyHtml = "";

    const activeSections = state.sections.filter(s => s.isActive);

    activeSections.forEach(item => {
        const sec = item.sectionDef;
        let secHtml = `\n<div id="bolum-${sec.id}" data-section="${sec.id}" class="muf-rapor-bolum" style="margin-bottom: 24px;">\n`;
        secHtml += `    <p class="ql-align-justify" style="margin-top: 18px; margin-bottom: 6px;"><strong>${escapeHtml(sec.title)}</strong></p>\n`;
        secHtml += `    <p class="ql-align-justify" style="color: #64748b; font-size: 11px; margin-bottom: 12px;"><em>${escapeHtml(sec.description)}</em></p>\n`;

        if (sec.isNarrative) {
            const raw = item.narrativeText || sec.defaultNarrativeText || "";
            const text = cleanCorruptedNarrativeText(raw, sec.defaultNarrativeText || "");
            if (text.trim()) {
                secHtml += `    <div class="muf-narrative-block" style="margin-bottom: 14px; padding: 6px 0;">\n`;
                secHtml += `        <p class="ql-align-justify" style="line-height: 1.6; text-indent: 1.25cm;">${escapeHtml(text)}</p>\n`;
                secHtml += `    </div>\n`;
            }
        } else if (item.clauses.length > 0) {
            item.clauses.forEach(clause => {
                const num = globalClauseCounter++;
                secHtml += `    <div data-madde-id="${clause.id}" class="muf-tenkit-madde-block" style="margin-bottom: 14px; padding: 6px 0;">\n`;
                secHtml += `        <p class="ql-align-justify"><strong>Madde ${num}- </strong>${escapeHtml(clause.text)}</p>\n`;
                secHtml += `    </div>\n`;
            });
        }

        secHtml += `</div>\n`;
        bodyHtml += secHtml;
    });

    // İmza tablosu ekle
    bodyHtml += `
<br/>
<table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin-top: 30px;">
    <tbody>
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: top; width: 50%;">
                <p class="ql-align-center">................................</p>
                <p class="ql-align-center"><strong>Müfettiş</strong></p>
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: top; width: 50%;">
                <p class="ql-align-center">................................</p>
                <p class="ql-align-center"><strong>Başmüfettiş</strong></p>
            </td>
        </tr>
    </tbody>
</table>
`;

    if (coverHtml) {
        return combineCoverWithReport(coverHtml, bodyHtml);
    }

    return bodyHtml;
}
