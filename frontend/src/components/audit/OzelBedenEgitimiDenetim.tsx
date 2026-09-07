import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
    Table,
    MapPin,
    Calendar,
    FileSpreadsheet,
    Upload,
    Download,
    ExternalLink,
    Printer,
    Save,
    RotateCcw,
    Loader2,
    CheckCircle2,
    XCircle,
    MinusCircle,
    Search,
    FileText,
    Building2,
    Award,
    ShieldAlert,
    Scale,
    Filter,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { useConfirm } from "../../lib/context/ConfirmContext";

// ---------------------------------------------------------------------------
// TYPES & INTERFACES
// ---------------------------------------------------------------------------

export type ItemStatus = "var" | "yok" | "muaf" | "";

export interface CheckItem {
    id: string;
    no: string;
    madde: string;
    mevzuatRef?: string;
    aciklama?: string;
}

export interface FacilityAuditItem {
    status: ItemStatus;
    note: string;
}

export interface FacilityData {
    id: string;
    tesisAdi: string;
    tur: "gercek" | "tuzel";
    isleticiSahip: string;
    tcVkn: string;
    telefon: string;
    adres: string;
    ilce: string;
    branslar: string;
    acilisTarihi: string;
    sonVizeTarihi: string;
    tescilNo: string;
    genelSonuc: "uygun" | "eksik" | "ipc" | "kapatma" | "incelemede";
    mufettisNotu: string;

    // Evrak Uygunluğu (Gerçek veya Tüzel)
    evraklar: Record<string, FacilityAuditItem>;

    // Komisyon & Harç
    komisyon: {
        valiOnayi: ItemStatus;
        komisyonKararTarihi: string;
        komisyonKararNo: string;
        ilMudurBaskan: string;
        sporSbMd: string;
        tesislerSbMd: string;
        fedTemsilcisi: string;
        saglikTemsilcisi: string;
        tescilUcretiTahsilat: ItemStatus;
        tescilUcretiTutar: string;
        genelMudurPayiYatırıldı: ItemStatus; // %50
        ilMudurPayiYatırıldı: ItemStatus;    // %50
        cokluBransHarci: ItemStatus;
        dosyaDagitimiTam: ItemStatus;        // 4 veya 5 nüsha
        aciklama: string;
    };

    // Fiziki & Teknik Şartlar (Md. 8 - 9)
    fizikiSartlar: Record<string, FacilityAuditItem>;

    // Antrenör & Personel (Md. 22 - 23)
    antrenorPersonel: Record<string, FacilityAuditItem>;

    // Sağlık & Sporcu Kayıtları (Md. 16, 24, 25)
    saglikSporcu: Record<string, FacilityAuditItem>;

    // Yıllık Vize & Yaptırımlar (Md. 13, 26)
    vizeYaptirim: {
        yillikVizeYapildiMi: ItemStatus;
        vizeOnayTarihi: string;
        oncekiDenetimVarMi: ItemStatus;
        oncekiIpcDurumu: string;
        verilenSureVarMi: string;
        tespitAykiriliklar: string;
        sonucKarari: string;
    };
}

interface OzelBedenEgitimiDenetimProps {
    localAuditData: any;
    setLocalAuditData: React.Dispatch<React.SetStateAction<any>>;
    onSave?: (data: any) => Promise<any> | void;
    isSaving?: boolean;
    selectedReport?: any;
    profile?: any;
}

// ---------------------------------------------------------------------------
// MEVZUAT VE EXCEL SABİTLERİ
// ---------------------------------------------------------------------------

export const GERCEK_KISI_EVRAKLARI: CheckItem[] = [
    { id: "g1", no: "1-", madde: "Tesisin adı ve adresi ile uygulanacak spor dallarını belirtir dilekçe", mevzuatRef: "Yön. Md. 6/a" },
    { id: "g2", no: "2-", madde: "Tesis işletmecisinin T.C. kimlik fotokopisi", mevzuatRef: "Yön. Md. 6/b" },
    { id: "g3", no: "3-", madde: "Tesis sahibi veya vekâlet edecek tesis sorumlusunun açık adresi ile adli sicil beyanı", mevzuatRef: "Yön. Md. 6/c" },
    { id: "g4", no: "4-", madde: "Tesis sorumlusu/sahibinin ikametgâh/yerleşim yeri beyanı", mevzuatRef: "Yön. Md. 6/d" },
    { id: "g6", no: "6-", madde: "Faaliyette bulunulacak her spor dalının çalıştırıcısına ait antrenör, masör veya diğer eğiticilerle yapılan bir yıllık sözleşmenin ilgili federasyon veya il müdürlüğünden tasdikli sureti", mevzuatRef: "Yön. Md. 6/e" },
    { id: "g7", no: "7-", madde: "Tesisin yetkili mimar veya mühendisce onaylı 1/100 ölçekli yerleşim planı", mevzuatRef: "Yön. Md. 6/f" },
    { id: "g8", no: "8-", madde: "Belediyelerce verilecek İşyeri Açma ve Çalışma Ruhsatı", mevzuatRef: "Yön. Md. 6/g" },
    { id: "g9", no: "9-", madde: "İtfaiye yangın güvenlik uygunluk raporu", mevzuatRef: "Yön. Md. 6/h" },
    { id: "g10", no: "10-", madde: "İllerde İl Sağlık Müdürlüğü, ilçelerde İlçe Sağlık Müdürlüğü uygunluk raporu", mevzuatRef: "Yön. Md. 6/ı" },
    { id: "g11", no: "11-", madde: "Mahallin güvenlik teşkilatından alınacak genel güvenlik ve asayiş açısından kolluk kuvveti görüşü", mevzuatRef: "Yön. Md. 6/i" },
    { id: "g12", no: "12-", madde: "Faaliyette bulunulacak spor dalları federasyonlarınca düzenlenecek Yeterlilik Belgesi", mevzuatRef: "Yön. Md. 10" },
    { id: "g13", no: "13-", madde: "Adli sicil kaydı sorgusu (İl Müdürlüğünce resmi yazışması yapılmış mı?)", mevzuatRef: "Yön. Md. 6/c" },
    { id: "g14", no: "14-", madde: "İl Müdürlüğünce yerinde yapılan tetkik tutanağı ve verilen Yeterlilik Belgesi (8. ve 9. maddelerdeki şartların taşındığına dair)", mevzuatRef: "Yön. Md. 11" }
];

export const TUZEL_KISI_EVRAKLARI: CheckItem[] = [
    { id: "t1", no: "1-", madde: "Kuruluşun, tesisin adı ve adresi ile uygulanacak spor dallarını belirtir dilekçe", mevzuatRef: "Yön. Md. 7/a" },
    { id: "t2", no: "2-", madde: "Tesis sorumlusu veya vekâlet edecek tesis amirinin açık adresi ve adli sicil beyanları", mevzuatRef: "Yön. Md. 7/b" },
    { id: "t3", no: "3-", madde: "Faaliyette bulunulacak her spor dalının çalıştırıcısına ait antrenör, masör veya diğer eğiticilerle yapılan bir yıllık sözleşmenin ilgili federasyon veya il müdürlüğünden tasdikli sureti", mevzuatRef: "Yön. Md. 7/c" },
    { id: "t4", no: "4-", madde: "Tesisin onaylı 1/100 ölçekli yerleşim planı", mevzuatRef: "Yön. Md. 7/d" },
    { id: "t5", no: "5-", madde: "Belediyelerce verilecek İşyeri Açma ve Çalışma Ruhsatı", mevzuatRef: "Yön. Md. 7/e" },
    { id: "t6", no: "6-", madde: "İtfaiye yangın güvenlik uygunluk raporu", mevzuatRef: "Yön. Md. 7/f" },
    { id: "t7", no: "7-", madde: "İllerde İl Sağlık Müdürlüğü, ilçelerde İlçe Sağlık Müdürlüğü uygunluk raporu", mevzuatRef: "Yön. Md. 7/g" },
    { id: "t8", no: "8-", madde: "Kolluk kuvvetlerinden alınacak genel güvenlik ve asayiş açısından kolluk görüşü", mevzuatRef: "Yön. Md. 7/h" },
    { id: "t9", no: "9-", madde: "Şirketler için Türkiye Ticaret Sicili Gazetesi ilanı; kulüpler/vakıflar için ana tüzük veya vakıf senedi", mevzuatRef: "Yön. Md. 7/ı" },
    { id: "t10", no: "10-", madde: "Tesis açma konusunda yetkili organ kararı (Yönetim Kurulu Kararı vb.)", mevzuatRef: "Yön. Md. 7/i" },
    { id: "t11", no: "11-", madde: "Faaliyette bulunulacak spor dalları federasyonlarınca düzenlenecek Yeterlilik Belgesi", mevzuatRef: "Yön. Md. 10" },
    { id: "t12", no: "12-", madde: "Adli sicil kaydı resmi sorgulaması", mevzuatRef: "Yön. Md. 7/b" },
    { id: "t13", no: "13-", madde: "İl Müdürlüğünce yerinde yapılan tetkik tutanağı ve verilen Yeterlilik Belgesi", mevzuatRef: "Yön. Md. 11" }
];

export const FIZIKI_SARTLAR_LISTESI: CheckItem[] = [
    { id: "f1", no: "1-", madde: "Tesis taban alanı yeterliliği ve tavan yüksekliği uygunluğu (Federasyon talimatında belirtilen ölçüler, yoksa min. 2.40m)", mevzuatRef: "Yön. Md. 8/a" },
    { id: "f2", no: "2-", madde: "Havalandırma sistemi yeterliliği (doğal havalandırma veya mekanik klima/havalandırma tesisatı)", mevzuatRef: "Yön. Md. 8/b" },
    { id: "f3", no: "3-", madde: "Aydınlatma ve elektrik tesisatının sporcu emniyetine uygunluğu, acil aydınlatma armatürleri", mevzuatRef: "Yön. Md. 8/c" },
    { id: "f4", no: "4-", madde: "Isıtma sisteminin standartlara uygunluğu (merkezi/kombi/klima vb., min. 18°C)", mevzuatRef: "Yön. Md. 8/d" },
    { id: "f5", no: "5-", madde: "Bayan ve bay sporcular için ayrı giyinme-soyunma odaları, kilitli dolaplar ve banklar", mevzuatRef: "Yön. Md. 8/e" },
    { id: "f6", no: "6-", madde: "Duş ve tuvaletlerin hijyenik şartları, sıcak su tertibatı, sabun/kağıt havlu donanımı", mevzuatRef: "Yön. Md. 8/f" },
    { id: "f7", no: "7-", madde: "Yangın söndürme tüpleri, yangın dolabı/hidrantı ve periyodik kontrol etiketleri", mevzuatRef: "Yön. Md. 8/g" },
    { id: "f8", no: "8-", madde: "Acil çıkış kapısı, kaçış yönlendirme tabelaları ve tahliye planı", mevzuatRef: "Yön. Md. 8/h" },
    { id: "f9", no: "9-", madde: "Engelli bireylerin tesise erişimine yönelik düzenlemeler (rampa, engelli WC vb.)", mevzuatRef: "Yön. Md. 8/ı" },
    { id: "f10", no: "10-", madde: "Kullanılan spor alet ve ekipmanlarının TSE/CE veya uluslararası federasyon güvenlik normlarına uygunluğu", mevzuatRef: "Yön. Md. 9" },
    { id: "f11", no: "11-", madde: "Zemin kaplamasının yapılan spor dalının gerektirdiği darbe emici ve kaymaz malzemeden olması", mevzuatRef: "Yön. Md. 9/b" }
];

export const ANTRENOR_PERSONEL_LISTESI: CheckItem[] = [
    { id: "a1", no: "1-", madde: "Tesiste faaliyette bulunulan her branş için en az kademe/seviye antrenör sözleşmesi var mı?", mevzuatRef: "Yön. Md. 22" },
    { id: "a2", no: "2-", madde: "Antrenör sözleşmeleri ilgili federasyon veya İl Müdürlüğü tarafından onaylanmış ve vize edilmiş mi?", mevzuatRef: "Yön. Md. 22/b" },
    { id: "a3", no: "3-", madde: "Antrenörlerin ilgili spor dalındaki antrenörlük belgesi ve güncel vize pulu/durumu kontrol edildi mi?", mevzuatRef: "Yön. Md. 22/c" },
    { id: "a4", no: "4-", madde: "Sözleşmeli antrenörlerin SGK prim bildirgeleri veya serbest meslek makbuzları düzenli yatırılıyor mu?", mevzuatRef: "5510 Sayılı Kanun" },
    { id: "a5", no: "5-", madde: "Antrenörlerin çalışma saatleri ve tesis programı görünür bir panoya asılmış mı?", mevzuatRef: "Yön. Md. 22/d" },
    { id: "a6", no: "6-", madde: "Yönetmelik uyarınca onaylı ücret tarifesi (İl Müdürlüğü tasdikli) tesisin girişinde asılı mı?", mevzuatRef: "Yön. Md. 23" },
    { id: "a7", no: "7-", madde: "Tahsil edilen üyelik ve spor ücretleri için fatura/serbest meslek makbuzu/fiş düzenleniyor mu?", mevzuatRef: "VUK & Yön. Md. 23" },
    { id: "a8", no: "8-", madde: "İl Müdürlüğünce onaylanan tarifeden daha yüksek ücret alınıp alınmadığı kontrol edildi mi?", mevzuatRef: "Yön. Md. 23/b" }
];

export const SAGLIK_SPORCU_LISTESI: CheckItem[] = [
    { id: "s1", no: "1-", madde: "Tesiste ilk yardım dolabı ve standartlara uygun tam teşekküllü ilk yardım malzemeleri mevcut mu?", mevzuatRef: "Yön. Md. 16" },
    { id: "s2", no: "2-", madde: "Sağlık Bakanlığı onaylı İlk Yardım Sertifikası olan personel görevlendirildi mi?", mevzuatRef: "Yön. Md. 16/b" },
    { id: "s3", no: "3-", madde: "Tesise üye olan/spor yapan kişilerden spor yapmaya elverişli olduklarına dair Sağlık Raporu alınıyor mu?", mevzuatRef: "Yön. Md. 24" },
    { id: "s4", no: "4-", madde: "Tüm sporcuların T.C. kimlik, adres, iletişim ve branş bilgilerini içeren onaylı Sporcu Kayıt Defteri tutuluyor mu?", mevzuatRef: "Yön. Md. 25" },
    { id: "s5", no: "5-", madde: "18 yaşından küçük sporcular için veli/vasi izin belgesi dosyalanıyor mu?", mevzuatRef: "Yön. Md. 25/b" },
    { id: "s6", no: "6-", madde: "Doping ve sağlığa zararlı maddelerin kullanımını önleyici bilgilendirme levhaları asılı mı?", mevzuatRef: "Yön. Md. 16/c" }
];

// Varsayılan Tesis Verisi Oluşturucu
export const createDefaultFacility = (tesisAdi: string = "Özel Beden Eğitimi ve Spor Tesisi"): FacilityData => ({
    id: "fac_default",
    tesisAdi: tesisAdi,
    tur: "gercek",
    isleticiSahip: "",
    tcVkn: "",
    telefon: "",
    adres: "",
    ilce: "",
    branslar: "Fitness, Vücut Geliştirme",
    acilisTarihi: new Date().toISOString().split("T")[0],
    sonVizeTarihi: new Date().toISOString().split("T")[0],
    tescilNo: "",
    genelSonuc: "incelemede",
    mufettisNotu: "",
    evraklar: {},
    komisyon: {
        valiOnayi: "var",
        komisyonKararTarihi: "",
        komisyonKararNo: "",
        ilMudurBaskan: "",
        sporSbMd: "",
        tesislerSbMd: "",
        fedTemsilcisi: "",
        saglikTemsilcisi: "",
        tescilUcretiTahsilat: "var",
        tescilUcretiTutar: "",
        genelMudurPayiYatırıldı: "var",
        ilMudurPayiYatırıldı: "var",
        cokluBransHarci: "muaf",
        dosyaDagitimiTam: "var",
        aciklama: ""
    },
    fizikiSartlar: {},
    antrenorPersonel: {},
    saglikSporcu: {},
    vizeYaptirim: {
        yillikVizeYapildiMi: "var",
        vizeOnayTarihi: "",
        oncekiDenetimVarMi: "yok",
        oncekiIpcDurumu: "",
        verilenSureVarMi: "",
        tespitAykiriliklar: "",
        sonucKarari: ""
    }
});

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export const OzelBedenEgitimiDenetim: React.FC<OzelBedenEgitimiDenetimProps> = ({
    localAuditData,
    setLocalAuditData,
    onSave,
    isSaving = false,
    selectedReport,
    profile
}) => {
    const confirm = useConfirm();
    const excelFileInputRef = useRef<HTMLInputElement>(null);

    // Meta State: İl ve Dönem
    const [ilAdi, setIlAdi] = useState<string>(() => {
        return (
            localAuditData?.ozelBedenEgitimi?.il ||
            selectedReport?.il ||
            localAuditData?.info?.il ||
            "VAN"
        ).toUpperCase();
    });

    const defaultYear = new Date().getFullYear();
    const [startYear, setStartYear] = useState<number>(() => {
        return localAuditData?.ozelBedenEgitimi?.startYear || (defaultYear - 1);
    });
    const [endYear, setEndYear] = useState<number>(() => {
        return localAuditData?.ozelBedenEgitimi?.endYear || defaultYear;
    });

    // Loading & UI States
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const [isExportingWord, setIsExportingWord] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    // Dışarı tıklayınca indirme menüsünü kapat
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sekmeler ve Arama
    const [activeSection, setActiveSection] = useState<string>("all");
    const [filterOnlyMissing, setFilterOnlyMissing] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isMetaExpanded, setIsMetaExpanded] = useState<boolean>(true);

    // Aktif Tesis Verisi
    const activeFacility: FacilityData = useMemo(() => {
        const ob = localAuditData?.ozelBedenEgitimi;
        if (ob) {
            if (Array.isArray(ob.tesisler) && ob.tesisler.length > 0) {
                return ob.tesisler[0];
            }
            if (ob.tesisAdi || ob.tur) {
                return ob;
            }
        }
        return createDefaultFacility("Özel Beden Eğitimi ve Spor Tesisi");
    }, [localAuditData?.ozelBedenEgitimi]);

    // Tesis güncelleme fonksiyonu
    const updateActiveFacility = useCallback((updater: (prev: FacilityData) => FacilityData) => {
        setLocalAuditData((prev: any) => {
            const ob = prev?.ozelBedenEgitimi;
            const currentFac = (ob?.tesisler && ob.tesisler[0]) || (ob?.id ? ob : activeFacility);
            const updated = updater(currentFac);
            return {
                ...prev,
                ozelBedenEgitimi: {
                    ...updated,
                    il: ilAdi,
                    startYear,
                    endYear,
                    tesisler: [updated]
                }
            };
        });
    }, [activeFacility, setLocalAuditData, ilAdi, startYear, endYear]);

    // Temel bilgi güncelleme
    const handleInfoChange = (field: keyof FacilityData, val: any) => {
        updateActiveFacility(prev => ({
            ...prev,
            [field]: val
        }));
    };

    // İtem durum ve not güncelleme
    const handleCheckItemChange = (
        section: "evraklar" | "fizikiSartlar" | "antrenorPersonel" | "saglikSporcu",
        itemId: string,
        status: ItemStatus,
        note?: string
    ) => {
        updateActiveFacility(prev => {
            const secData = { ...(prev[section] || {}) };
            const existing = secData[itemId] || { status: "", note: "" };
            secData[itemId] = {
                status: status !== undefined ? status : existing.status,
                note: note !== undefined ? note : existing.note
            };
            return {
                ...prev,
                [section]: secData
            };
        });
    };

    // Komisyon alanları güncelleme
    const handleKomisyonChange = (field: string, val: any) => {
        updateActiveFacility(prev => ({
            ...prev,
            komisyon: {
                ...prev.komisyon,
                [field]: val
            }
        }));
    };

    // Vize/Yaptırım alanları güncelleme
    const handleVizeChange = (field: string, val: any) => {
        updateActiveFacility(prev => ({
            ...prev,
            vizeYaptirim: {
                ...prev.vizeYaptirim,
                [field]: val
            }
        }));
    };

    // Kaydetme Fonksiyonu
    const handleSave = async () => {
        const payload = {
            ...localAuditData,
            ozelBedenEgitimi: {
                ...activeFacility,
                il: ilAdi,
                startYear,
                endYear,
                tesisler: [activeFacility],
                updatedAt: new Date().toISOString()
            }
        };
        setLocalAuditData(payload);
        if (onSave) {
            await onSave(payload);
        }
        toast.success("Denetim bilgileri kaydedildi.");
    };

    // ---------------------------------------------------------------------------
    // İSTATİSTİKLER VE UYUM HESAPLAMALARI
    // ---------------------------------------------------------------------------

    const evrakList = useMemo(() => {
        return activeFacility.tur === "gercek" ? GERCEK_KISI_EVRAKLARI : TUZEL_KISI_EVRAKLARI;
    }, [activeFacility.tur]);

    const stats = useMemo(() => {
        const totalItems = evrakList.length + FIZIKI_SARTLAR_LISTESI.length + ANTRENOR_PERSONEL_LISTESI.length + SAGLIK_SPORCU_LISTESI.length;

        let varCount = 0;
        let yokCount = 0;
        let muafCount = 0;

        const countItems = (list: CheckItem[], secKey: "evraklar" | "fizikiSartlar" | "antrenorPersonel" | "saglikSporcu") => {
            list.forEach(it => {
                const st = activeFacility[secKey]?.[it.id]?.status;
                if (st === "var") varCount++;
                else if (st === "yok") yokCount++;
                else if (st === "muaf") muafCount++;
            });
        };

        countItems(evrakList, "evraklar");
        countItems(FIZIKI_SARTLAR_LISTESI, "fizikiSartlar");
        countItems(ANTRENOR_PERSONEL_LISTESI, "antrenorPersonel");
        countItems(SAGLIK_SPORCU_LISTESI, "saglikSporcu");

        const netBase = totalItems - muafCount;
        const uyumYuzdesi = netBase > 0 ? Math.round((varCount / netBase) * 100) : 0;

        return { totalItems, varCount, yokCount, muafCount, uyumYuzdesi };
    }, [activeFacility, evrakList]);

    // ---------------------------------------------------------------------------
    // EXCEL DIŞA AKTAR / İÇE AKTAR
    // ---------------------------------------------------------------------------

    const handleDownloadExcel = (isBlank: boolean) => {
        try {
            setIsExportingExcel(true);
            const wb = XLSX.utils.book_new();
            const fac = isBlank ? createDefaultFacility("Özel Beden Eğitimi ve Spor Tesisi") : activeFacility;
            const currentEvraklar = fac.tur === "gercek" ? GERCEK_KISI_EVRAKLARI : TUZEL_KISI_EVRAKLARI;

            // Sheet 1: Künye
            const sheetKunyeData = [
                ["T.C. GENÇLİK VE SPOR BAKANLIĞI"],
                [`${ilAdi || "İL"} GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ TEFTİŞİ`],
                ["ÖZEL BEDEN EĞİTİMİ VE SPOR TESİSLERİ DENETİM ÇİZELGESİ"],
                [],
                ["TESİS BİLGİSİ / ALAN", "DEĞER"],
                ["İl", ilAdi],
                ["Denetim Dönemi", `${startYear} - ${endYear}`],
                ["Tesis Adı", fac.tesisAdi],
                ["Tesis Statüsü", fac.tur === "gercek" ? "Gerçek Kişi" : "Tüzel Kişi"],
                ["İşletici / Sorumlu", fac.isleticiSahip],
                ["T.C. / Vergi No", fac.tcVkn],
                ["Faaliyet Branşları", fac.branslar],
                ["İlçe ve Adres", fac.adres],
                ["Açılış Tarihi", fac.acilisTarihi],
                ["Son Vize Tarihi", fac.sonVizeTarihi],
                ["Genel Uyum Skoru", isBlank ? "" : `%${stats.uyumYuzdesi}`],
                ["Müfettiş Kararı", isBlank ? "" : fac.genelSonuc.toUpperCase()]
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetKunyeData), "Tesis_Kunyesi");

            const addSectionSheet = (title: string, sheetName: string, items: CheckItem[], secKey: "evraklar" | "fizikiSartlar" | "antrenorPersonel" | "saglikSporcu") => {
                const rows: any[][] = [
                    [title],
                    ["No", "Mevzuat Maddesi / İstenen Belge", "Yönetmelik Dayanağı", "Durum (VAR / YOK / MUAF)", "Müfettiş Tespit Notu"]
                ];
                items.forEach(it => {
                    const cur = isBlank ? { status: "", note: "" } : (fac[secKey]?.[it.id] || { status: "", note: "" });
                    const st = cur.status === "var" ? "VAR" : cur.status === "yok" ? "YOK" : cur.status === "muaf" ? "MUAF" : "";
                    rows.push([it.no, it.madde, it.mevzuatRef || "", st, cur.note || ""]);
                });
                XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
            };

            addSectionSheet("1. AÇILIŞ VE RUHSAT EVRAKLARI", "1_Acilis_Evrak", currentEvraklar, "evraklar");

            // 2. Komisyon
            const komRows: any[][] = [
                ["2. AÇILIŞ İZNİ KOMİSYONU VE HARÇ KONTROLÜ"],
                ["Kriter / Görevli", "Durum / Bilgi", "Ek Açıklama"],
                ["Vali Onayı", isBlank ? "" : (fac.komisyon.valiOnayi === "var" ? "VAR" : "YOK"), ""],
                ["Komisyon Karar Tarihi / No", isBlank ? "" : `${fac.komisyon.komisyonKararTarihi} - ${fac.komisyon.komisyonKararNo}`, ""],
                ["Komisyon Başkanı (İl Müdürü)", isBlank ? "" : fac.komisyon.ilMudurBaskan, ""],
                ["Spor Faaliyetleri Şb. Md.", isBlank ? "" : fac.komisyon.sporSbMd, ""],
                ["Tesisler Şb. Md.", isBlank ? "" : fac.komisyon.tesislerSbMd, ""],
                ["Federasyon Temsilcisi", isBlank ? "" : fac.komisyon.fedTemsilcisi, ""],
                ["İl Sağlık Müd. Temsilcisi", isBlank ? "" : fac.komisyon.saglikTemsilcisi, ""],
                ["Tescil Harcı Tahsilatı", isBlank ? "" : (fac.komisyon.tescilUcretiTahsilat === "var" ? "TAHSİL EDİLDİ" : "EDİLMEDİ"), isBlank ? "" : fac.komisyon.tescilUcretiTutar],
                ["Genel Müdürlük Payı (%50)", isBlank ? "" : (fac.komisyon.genelMudurPayiYatırıldı === "var" ? "YATIRILDI" : "YATIRILMADI"), ""],
                ["İl Müdürlüğü Payı (%50)", isBlank ? "" : (fac.komisyon.ilMudurPayiYatırıldı === "var" ? "YATIRILDI" : "YATIRILMADI"), ""]
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(komRows), "2_Komisyon_Harc");

            addSectionSheet("3. FİZİKİ VE TEKNİK ŞARTLAR (Md. 8-9)", "3_Fiziki_Sartlar", FIZIKI_SARTLAR_LISTESI, "fizikiSartlar");
            addSectionSheet("4. ANTRENÖR VE PERSONEL ŞARTLARI (Md. 22-23)", "4_Antrenor_Personel", ANTRENOR_PERSONEL_LISTESI, "antrenorPersonel");
            addSectionSheet("5. SAĞLIK VE SPORCU KAYITLARI (Md. 16, 24, 25)", "5_Saglik_Sporcu", SAGLIK_SPORCU_LISTESI, "saglikSporcu");

            const fname = isBlank
                ? `Ozel_Beden_Egitimi_Bos_Denetim_Sablonu.xlsx`
                : `Ozel_Beden_Egitimi_Denetim_${(fac.tesisAdi || "Tesis").replace(/\s+/g, '_')}.xlsx`;
            XLSX.writeFile(wb, fname);
            toast.success(isBlank ? "Boş Excel şablonu indirildi." : "Excel denetim raporu indirildi.");
        } catch (e: any) {
            toast.error("Excel oluşturulurken hata: " + e.message);
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handleExcelUploadClick = () => {
        if (excelFileInputRef.current) {
            excelFileInputRef.current.value = "";
            excelFileInputRef.current.click();
        }
    };

    const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImportingExcel(true);
        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });

            updateActiveFacility(prev => {
                const updated = { ...prev };

                const parseSheetIntoMap = (sheetName: string, targetMap: Record<string, FacilityAuditItem>, list: CheckItem[]) => {
                    const ws = wb.Sheets[sheetName];
                    if (!ws) return;
                    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    rows.forEach(row => {
                        if (!row || row.length < 4) return;
                        const noCol = String(row[0] || "").trim();
                        const textCol = String(row[1] || "").trim();
                        const statusCol = String(row[3] || "").toUpperCase().trim();
                        const noteCol = String(row[4] || "").trim();

                        const matchedItem = list.find(it =>
                            (noCol && it.no.replace(/[^0-9]/g, "") === noCol.replace(/[^0-9]/g, "")) ||
                            (textCol && it.madde.toLowerCase().includes(textCol.substring(0, 15).toLowerCase()))
                        );

                        if (matchedItem) {
                            let st: ItemStatus = "";
                            if (statusCol.includes("VAR") || statusCol.includes("UYGUN") || statusCol === "EVET") st = "var";
                            else if (statusCol.includes("YOK") || statusCol.includes("DEĞİL") || statusCol === "HAYIR") st = "yok";
                            else if (statusCol.includes("MUAF")) st = "muaf";

                            targetMap[matchedItem.id] = {
                                status: st,
                                note: noteCol || targetMap[matchedItem.id]?.note || ""
                            };
                        }
                    });
                };

                const currentEvrakList = prev.tur === "gercek" ? GERCEK_KISI_EVRAKLARI : TUZEL_KISI_EVRAKLARI;
                const newEvrak = { ...(prev.evraklar || {}) };
                const newFiziki = { ...(prev.fizikiSartlar || {}) };
                const newAntrenor = { ...(prev.antrenorPersonel || {}) };
                const newSaglik = { ...(prev.saglikSporcu || {}) };

                parseSheetIntoMap("1_Acilis_Evrak", newEvrak, currentEvrakList);
                parseSheetIntoMap("3_Fiziki_Sartlar", newFiziki, FIZIKI_SARTLAR_LISTESI);
                parseSheetIntoMap("4_Antrenor_Personel", newAntrenor, ANTRENOR_PERSONEL_LISTESI);
                parseSheetIntoMap("5_Saglik_Sporcu", newSaglik, SAGLIK_SPORCU_LISTESI);

                updated.evraklar = newEvrak;
                updated.fizikiSartlar = newFiziki;
                updated.antrenorPersonel = newAntrenor;
                updated.saglikSporcu = newSaglik;

                return updated;
            });

            toast.success("Excel dosyasındaki denetim verileri sisteme başarıyla aktarıldı.");
        } catch (e: any) {
            toast.error("Excel yüklenirken hata oluştu: " + e.message);
        } finally {
            setIsImportingExcel(false);
            if (excelFileInputRef.current) excelFileInputRef.current.value = "";
        }
    };

    // ---------------------------------------------------------------------------
    // WORD (.DOC) DIŞA AKTAR
    // ---------------------------------------------------------------------------

    const handleDownloadWord = (isBlank: boolean) => {
        setIsExportingWord(true);
        try {
            const fac = isBlank ? createDefaultFacility("Özel Beden Eğitimi ve Spor Tesisi") : activeFacility;
            const currentEvrakList = fac.tur === "gercek" ? GERCEK_KISI_EVRAKLARI : TUZEL_KISI_EVRAKLARI;

            const renderWordTableRows = (items: CheckItem[], secKey: "evraklar" | "fizikiSartlar" | "antrenorPersonel" | "saglikSporcu") => {
                return items.map(it => {
                    const cur = isBlank ? { status: "", note: "" } : (fac[secKey]?.[it.id] || { status: "", note: "" });
                    const stBadge = cur.status === "var"
                        ? `<span class="badge-var">UYGUN</span>`
                        : cur.status === "yok"
                        ? `<span class="badge-yok">EKSİK</span>`
                        : cur.status === "muaf"
                        ? `<span class="badge-muaf">MUAF</span>`
                        : isBlank ? `[ ] Uygun &nbsp; [ ] Eksik &nbsp; [ ] Muaf` : `-`;
                    return `
                        <tr>
                            <td class="center bold">${it.no}</td>
                            <td>${it.madde}</td>
                            <td class="center">${it.mevzuatRef || "-"}</td>
                            <td class="center">${stBadge}</td>
                            <td>${cur.note || (isBlank ? "" : "-")}</td>
                        </tr>
                    `;
                }).join("");
            };

            const html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
            <meta charset='utf-8'>
            <title>Özel Beden Eğitimi ve Spor Tesisleri Denetim Tutanağı</title>
            <style>
                body { font-family: 'Calibri', 'Times New Roman', Arial, sans-serif; font-size: 10.5pt; color: #000; }
                h1 { text-align: center; font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase; }
                h2 { text-align: center; font-size: 11pt; font-weight: bold; margin: 3pt 0 14pt 0; }
                h3 { font-size: 11pt; font-weight: bold; margin: 12pt 0 4pt 0; color: #1e3a8a; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 2pt; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
                th, td { border: 1pt solid #475569; padding: 4.5pt 6pt; font-size: 9pt; vertical-align: top; }
                th { background-color: #f1f5f9; font-weight: bold; text-align: left; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .badge-var { color: #047857; font-weight: bold; }
                .badge-yok { color: #b91c1c; font-weight: bold; }
                .badge-muaf { color: #475569; font-weight: bold; }
                .meta-table td { border: 1pt solid #94a3b8; padding: 4pt 6pt; }
                .meta-table th { background-color: #f8fafc; font-weight: bold; width: 22%; }
                .sig-box { margin-top: 24pt; width: 100%; }
                .sig-col { width: 50%; text-align: center; font-size: 9.5pt; }
            </style>
            </head>
            <body>
                <h1>T.C. GENÇLİK VE SPOR BAKANLIĞI</h1>
                <h2>REHBERLİK VE DENETİM BAŞKANLIĞI / ${ilAdi || "GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ"} TEFTİŞİ<br/>ÖZEL BEDEN EĞİTİMİ VE SPOR TESİSLERİ DENETİM ÇİZELGESİ</h2>
                
                <table class="meta-table">
                    <tr>
                        <th>Tesis Adı:</th>
                        <td class="bold">${fac.tesisAdi || "-"}</td>
                        <th>Tesis Statüsü:</th>
                        <td>${fac.tur === "gercek" ? "Gerçek Kişi Tesisi" : "Tüzel Kişi (Şirket / Kulüp)"}</td>
                    </tr>
                    <tr>
                        <th>İşletici / Sorumlu:</th>
                        <td>${fac.isleticiSahip || "-"}</td>
                        <th>T.C. / Vergi No:</th>
                        <td>${fac.tcVkn || "-"}</td>
                    </tr>
                    <tr>
                        <th>Faaliyet Branşları:</th>
                        <td>${fac.branslar || "-"}</td>
                        <th>İlçe ve Adres:</th>
                        <td>${fac.adres || "-"}</td>
                    </tr>
                    <tr>
                        <th>Açılış Tarihi:</th>
                        <td>${fac.acilisTarihi || "-"}</td>
                        <th>Son Vize Tarihi:</th>
                        <td>${fac.sonVizeTarihi || "-"}</td>
                    </tr>
                    <tr>
                        <th>Denetim Dönemi:</th>
                        <td>${startYear} - ${endYear}</td>
                        <th>Genel Uyum Oranı:</th>
                        <td class="bold">${isBlank ? "-" : `%${stats.uyumYuzdesi} (${fac.genelSonuc.toUpperCase()})`}</td>
                    </tr>
                </table>

                <h3>1. AÇILIŞ VE İZİN EVRAK KONTROLÜ (${fac.tur === "gercek" ? "Gerçek Kişi" : "Tüzel Kişi"})</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 32px;" class="center">No</th>
                            <th>Mevzuat Maddesi / İstenen Belge</th>
                            <th style="width: 85px;" class="center">Dayanak</th>
                            <th style="width: 80px;" class="center">Durum</th>
                            <th style="width: 140px;">Müfettiş Tespit Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderWordTableRows(currentEvrakList, "evraklar")}
                    </tbody>
                </table>

                <h3>2. AÇILIŞ İZNİ KOMİSYONU VE HARÇ KONTROLÜ</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40%;">Kriter / İnceleme Konusu</th>
                            <th style="width: 30%;">Durum / İlgili Kişi</th>
                            <th style="width: 30%;">Tespit Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Vali Onayı Bulunuyor mu?</td><td class="bold">${isBlank ? "[ ] Var  [ ] Yok" : (fac.komisyon.valiOnayi === "var" ? "VAR" : "YOK")}</td><td>-</td></tr>
                        <tr><td>Komisyon Karar Tarihi ve Sayısı</td><td>${isBlank ? "..... / ..... / 20..  - Sayı: ....." : `${fac.komisyon.komisyonKararTarihi || "-"} / ${fac.komisyon.komisyonKararNo || "-"}`}</td><td>-</td></tr>
                        <tr><td>Komisyon Başkanı (İl Müdürü)</td><td>${isBlank ? "........................................" : fac.komisyon.ilMudurBaskan || "-"}</td><td>-</td></tr>
                        <tr><td>Spor Faaliyetleri Şube Müdürü</td><td>${isBlank ? "........................................" : fac.komisyon.sporSbMd || "-"}</td><td>-</td></tr>
                        <tr><td>Tesisler Şube Müdürü</td><td>${isBlank ? "........................................" : fac.komisyon.tesislerSbMd || "-"}</td><td>-</td></tr>
                        <tr><td>Federasyon İl Temsilcisi</td><td>${isBlank ? "........................................" : fac.komisyon.fedTemsilcisi || "-"}</td><td>-</td></tr>
                        <tr><td>İl Sağlık Müdürlüğü Temsilcisi</td><td>${isBlank ? "........................................" : fac.komisyon.saglikTemsilcisi || "-"}</td><td>-</td></tr>
                        <tr><td>Tescil Ücreti / Harcı Tahsilatı</td><td class="bold">${isBlank ? "[ ] Tahsil Edildi  [ ] Edilmedi" : (fac.komisyon.tescilUcretiTahsilat === "var" ? "TAHSİL EDİLDİ" : "EDİLMEDİ")}</td><td>${fac.komisyon.tescilUcretiTutar ? `${fac.komisyon.tescilUcretiTutar} TL` : "-"}</td></tr>
                        <tr><td>Genel Müdürlük Payı (%50) Yatırıldı mı?</td><td>${isBlank ? "[ ] Evet  [ ] Hayır" : (fac.komisyon.genelMudurPayiYatırıldı === "var" ? "YATIRILDI" : "YATIRILMADI")}</td><td>-</td></tr>
                        <tr><td>İl Müdürlüğü Payı (%50) Yatırıldı mı?</td><td>${isBlank ? "[ ] Evet  [ ] Hayır" : (fac.komisyon.ilMudurPayiYatırıldı === "var" ? "YATIRILDI" : "YATIRILMADI")}</td><td>-</td></tr>
                    </tbody>
                </table>

                <h3>3. FİZİKİ VE TEKNİK ŞARTLAR (Md. 8 - 9)</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 32px;" class="center">No</th>
                            <th>Fiziki ve Teknik Standart</th>
                            <th style="width: 85px;" class="center">Dayanak</th>
                            <th style="width: 80px;" class="center">Durum</th>
                            <th style="width: 140px;">Müfettiş Tespit Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderWordTableRows(FIZIKI_SARTLAR_LISTESI, "fizikiSartlar")}
                    </tbody>
                </table>

                <h3>4. ANTRENÖR VE PERSONEL ŞARTLARI (Md. 22 - 23)</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 32px;" class="center">No</th>
                            <th>Antrenör & Ücret Kriteri</th>
                            <th style="width: 85px;" class="center">Dayanak</th>
                            <th style="width: 80px;" class="center">Durum</th>
                            <th style="width: 140px;">Müfettiş Tespit Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderWordTableRows(ANTRENOR_PERSONEL_LISTESI, "antrenorPersonel")}
                    </tbody>
                </table>

                <h3>5. SAĞLIK, İLKYARDIM VE SPORCU KAYITLARI (Md. 16, 24, 25)</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 32px;" class="center">No</th>
                            <th>Sağlık & Sporcu Kayıt Kriteri</th>
                            <th style="width: 85px;" class="center">Dayanak</th>
                            <th style="width: 80px;" class="center">Durum</th>
                            <th style="width: 140px;">Müfettiş Tespit Notu</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderWordTableRows(SAGLIK_SPORCU_LISTESI, "saglikSporcu")}
                    </tbody>
                </table>

                <h3>6. YILLIK VİZE, İPC VE NİHAİ KANAAT (Md. 13, 26)</h3>
                <table>
                    <tr>
                        <th style="width: 35%;">Yıllık Vize Yapıldı mı?</th>
                        <td>${isBlank ? "[ ] Evet  [ ] Hayır" : (fac.vizeYaptirim.yillikVizeYapildiMi === "var" ? "VİZELİ" : "VİZESİZ")}</td>
                        <th style="width: 20%;">Vize Tarihi:</th>
                        <td>${fac.vizeYaptirim.vizeOnayTarihi || "-"}</td>
                    </tr>
                    <tr>
                        <th>Önceki Denetimde İPC Durumu:</th>
                        <td colspan="3">${fac.vizeYaptirim.oncekiIpcDurumu || "-"}</td>
                    </tr>
                    <tr>
                        <th>Eksiklik Giderme İçin Verilen Süre:</th>
                        <td colspan="3">${fac.vizeYaptirim.verilenSureVarMi || "-"}</td>
                    </tr>
                    <tr>
                        <th>Tespit Edilen Aykırılıklar:</th>
                        <td colspan="3">${fac.vizeYaptirim.tespitAykiriliklar || "-"}</td>
                    </tr>
                    <tr>
                        <th>Nihai Müfettiş Kararı & Kanaati:</th>
                        <td colspan="3" class="bold" style="min-height: 40pt;">${fac.vizeYaptirim.sonucKarari || (isBlank ? "" : "Mevzuata uygun faaliyet göstermektedir.")}</td>
                    </tr>
                </table>

                <table class="sig-box" style="border: none;">
                    <tr style="border: none;">
                        <td class="sig-col" style="border: none;">
                            <strong>Tesis Yetkilisi / İşletici</strong><br/>
                            ${fac.isleticiSahip || "Ad Soyad"}<br/>
                            İmza / Kaşe
                        </td>
                        <td class="sig-col" style="border: none;">
                            <strong>Denetimi Yapan Bakanlık Müfettişi</strong><br/>
                            ${profile?.full_name || "Bakanlık Müfettişi"}<br/>
                            İmza
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `;

            const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = isBlank
                ? `Ozel_Beden_Egitimi_Bos_Denetim_Sablonu.doc`
                : `Ozel_Beden_Egitimi_Denetim_Raporu_${(fac.tesisAdi || "Tesis").replace(/\s+/g, '_')}.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(isBlank ? "Boş Word şablonu indirildi." : "Word denetim raporu indirildi.");
        } catch (e: any) {
            toast.error("Word belgesi oluşturulurken hata: " + e.message);
        } finally {
            setIsExportingWord(false);
        }
    };

    // ---------------------------------------------------------------------------
    // YAZDIRMA VE SIFIRLAMA
    // ---------------------------------------------------------------------------

    const handlePrint = () => {
        window.print();
    };

    const handleResetAudit = async () => {
        const isConfirmed = await confirm({
            title: "Denetimi Sıfırla",
            message: "Özel beden eğitimi tesisleri denetim formundaki tüm verileri sıfırlamak istediğinize emin misiniz? Doldurulan tüm evrak ve kontrol bilgileri temizlenecektir. Bu işlem geri alınamaz.",
            confirmText: "Evet, Formu Sıfırla",
            cancelText: "Vazgeç",
            variant: "danger"
        });

        if (!isConfirmed) return;

        const fresh = createDefaultFacility("Özel Beden Eğitimi ve Spor Tesisi");
        setLocalAuditData((prev: any) => ({
            ...prev,
            ozelBedenEgitimi: {
                ...fresh,
                il: ilAdi,
                startYear,
                endYear,
                tesisler: [fresh]
            }
        }));
        toast.success("Denetim formu sıfırlandı.");
    };

    // Tümünü Uygun İşaretle (aktif sekme için)
    const handleMarkAllValid = async (sectionKey: "evrak" | "fiziki" | "antrenor" | "saglik") => {
        const isConfirmed = await confirm({
            title: "Tümünü Uygun İşaretle",
            message: "Bu bölümdeki tüm kriterler 'Var / Uygun' olarak işaretlenecektir. Onaylıyor musunuz?",
            confirmText: "Tümünü Uygun Yap",
            cancelText: "Vazgeç",
            variant: "info"
        });

        if (!isConfirmed) return;

        updateActiveFacility(prev => {
            const updated = { ...prev };
            if (sectionKey === "evrak") {
                const list = prev.tur === "gercek" ? GERCEK_KISI_EVRAKLARI : TUZEL_KISI_EVRAKLARI;
                const map = { ...(prev.evraklar || {}) };
                list.forEach(item => {
                    map[item.id] = { status: "var", note: map[item.id]?.note || "" };
                });
                updated.evraklar = map;
            } else if (sectionKey === "fiziki") {
                const map = { ...(prev.fizikiSartlar || {}) };
                FIZIKI_SARTLAR_LISTESI.forEach(item => {
                    map[item.id] = { status: "var", note: map[item.id]?.note || "" };
                });
                updated.fizikiSartlar = map;
            } else if (sectionKey === "antrenor") {
                const map = { ...(prev.antrenorPersonel || {}) };
                ANTRENOR_PERSONEL_LISTESI.forEach(item => {
                    map[item.id] = { status: "var", note: map[item.id]?.note || "" };
                });
                updated.antrenorPersonel = map;
            } else if (sectionKey === "saglik") {
                const map = { ...(prev.saglikSporcu || {}) };
                SAGLIK_SPORCU_LISTESI.forEach(item => {
                    map[item.id] = { status: "var", note: map[item.id]?.note || "" };
                });
                updated.saglikSporcu = map;
            }
            return updated;
        });
        toast.success("Kriterler uygun olarak işaretlendi.");
    };

    // ---------------------------------------------------------------------------
    // KATEGORİZE TABLO RENDER HELPER
    // ---------------------------------------------------------------------------

    const renderSectionTable = (
        title: string,
        sectionNumber: number,
        sectionKey: "evraklar" | "fizikiSartlar" | "antrenorPersonel" | "saglikSporcu",
        items: CheckItem[],
        shortKey: "evrak" | "fiziki" | "antrenor" | "saglik"
    ) => {
        const filteredItems = items.filter(item => {
            const cur = activeFacility[sectionKey]?.[item.id] || { status: "", note: "" };
            if (filterOnlyMissing && cur.status !== "yok") return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const text = `${item.no} ${item.madde} ${item.mevzuatRef || ""} ${cur.note || ""}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        return (
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">
                            {sectionNumber}
                        </span>
                        <span className="uppercase">{title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {items.length} Kriter
                        </span>
                    </h4>

                    <div className="flex items-center gap-2 print:hidden">
                        <button
                            type="button"
                            onClick={() => handleMarkAllValid(shortKey)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800 transition-colors"
                            title="Bu bölümdeki tüm kriterleri uygun olarak işaretler"
                        >
                            <CheckCircle2 size={12} />
                            <span>Tümünü Uygun Yap</span>
                        </button>
                    </div>
                </div>

                {/* Masaüstü Görünüm: Yüksek Yoğunluklu Tablo */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                                <th className="p-2.5 text-center w-12 border-r border-slate-200 dark:border-slate-700">NO</th>
                                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[280px]">MEVZUAT MADDESİ / İSTENEN BELGE</th>
                                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-32">DAYANAK</th>
                                <th className="p-2.5 text-center border-r border-slate-200 dark:border-slate-700 w-56">DURUM</th>
                                <th className="p-2.5 min-w-[200px]">MÜFETTİŞ TESPİT NOTU</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                                        Filtreye uygun kriter bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, idx) => {
                                    const cur = activeFacility[sectionKey]?.[item.id] || { status: "", note: "" };
                                    const rowBg = cur.status === "var"
                                        ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                                        : cur.status === "yok"
                                        ? "bg-rose-50/50 dark:bg-rose-950/20"
                                        : cur.status === "muaf"
                                        ? "bg-slate-50 dark:bg-slate-800/30"
                                        : idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20";

                                    return (
                                        <tr key={item.id} className={`${rowBg} border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors`}>
                                            <td className="p-2 text-center font-black text-blue-600 dark:text-blue-400 border-r border-slate-200 dark:border-slate-700">
                                                {item.no}
                                            </td>
                                            <td className="p-2 font-medium text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700 leading-snug">
                                                {item.madde}
                                            </td>
                                            <td className="p-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                                                {item.mevzuatRef ? (
                                                    <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                        {item.mevzuatRef}
                                                    </span>
                                                ) : "-"}
                                            </td>
                                            <td className="p-1.5 border-r border-slate-200 dark:border-slate-700 text-center">
                                                <div className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "var" ? "" : "var")}
                                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                            cur.status === "var"
                                                                ? "bg-emerald-600 text-white shadow-sm"
                                                                : "text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                                                        }`}
                                                    >
                                                        <CheckCircle2 size={12} />
                                                        <span>Uygun</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "yok" ? "" : "yok")}
                                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                            cur.status === "yok"
                                                                ? "bg-rose-600 text-white shadow-sm"
                                                                : "text-slate-600 dark:text-slate-300 hover:text-rose-600"
                                                        }`}
                                                    >
                                                        <XCircle size={12} />
                                                        <span>Eksik</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "muaf" ? "" : "muaf")}
                                                        className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                                            cur.status === "muaf"
                                                                ? "bg-slate-500 text-white shadow-sm"
                                                                : "text-slate-400 hover:text-slate-700"
                                                        }`}
                                                    >
                                                        <MinusCircle size={11} />
                                                        <span>Muaf</span>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-1.5">
                                                <input
                                                    type="text"
                                                    value={cur.note || ""}
                                                    onChange={e => handleCheckItemChange(sectionKey, item.id, cur.status, e.target.value)}
                                                    placeholder="Tespit notu..."
                                                    className="w-full h-7 px-2 text-xs rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobil Görünüm: Dokunmatik Kart Listesi (Sıfır Yatay Kaydırma) */}
                <div className="block md:hidden space-y-2.5">
                    {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                            Filtreye uygun kriter bulunamadı.
                        </div>
                    ) : (
                        filteredItems.map((item) => {
                            const cur = activeFacility[sectionKey]?.[item.id] || { status: "", note: "" };
                            const cardBorder = cur.status === "var"
                                ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10"
                                : cur.status === "yok"
                                ? "border-rose-300 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/10"
                                : cur.status === "muaf"
                                ? "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

                            return (
                                <div key={item.id} className={`p-3 rounded-xl border ${cardBorder} shadow-sm space-y-2.5 transition-all`}>
                                    {/* Madde No & Açıklama & Dayanak */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                            <span className="font-black text-xs text-blue-600 dark:text-blue-400 shrink-0">
                                                {item.no}
                                            </span>
                                            <p className="text-xs font-semibold text-slate-850 dark:text-slate-100 leading-snug">
                                                {item.madde}
                                            </p>
                                        </div>
                                        {item.mevzuatRef && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 whitespace-nowrap shrink-0">
                                                {item.mevzuatRef}
                                            </span>
                                        )}
                                    </div>

                                    {/* Mobil Dokunmatik Durum Butonları */}
                                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "var" ? "" : "var")}
                                            className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                                cur.status === "var"
                                                    ? "bg-emerald-600 text-white shadow-sm"
                                                    : "text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            <CheckCircle2 size={13} />
                                            <span>Uygun</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "yok" ? "" : "yok")}
                                            className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                                cur.status === "yok"
                                                    ? "bg-rose-600 text-white shadow-sm"
                                                    : "text-slate-600 dark:text-slate-300"
                                            }`}
                                        >
                                            <XCircle size={13} />
                                            <span>Eksik</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCheckItemChange(sectionKey, item.id, cur.status === "muaf" ? "" : "muaf")}
                                            className={`h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                                cur.status === "muaf"
                                                    ? "bg-slate-500 text-white shadow-sm"
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            <MinusCircle size={12} />
                                            <span>Muaf</span>
                                        </button>
                                    </div>

                                    {/* Müfettiş Notu Girişi */}
                                    <input
                                        type="text"
                                        value={cur.note || ""}
                                        onChange={e => handleCheckItemChange(sectionKey, item.id, cur.status, e.target.value)}
                                        placeholder="Müfettiş tespit notu girin..."
                                        className="w-full h-8 px-2.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    // ---------------------------------------------------------------------------
    // BÖLÜM LİSTESİ
    // ---------------------------------------------------------------------------

    // Gruplandırılmış Ana Kategoriler (Tek butonda ilgili tablolar açılsın)
    const CATEGORY_GROUPS = useMemo(() => [
        {
            id: "all",
            label: "Tümü (Tüm Tablolar)",
            icon: Table,
            count: `${stats.totalItems} Kriter`,
            sectionKeys: ["evrak", "komisyon", "fiziki", "antrenor", "saglik", "vize"]
        },
        {
            id: "idari",
            label: "1. İdari & İzin İşlemleri",
            icon: Scale,
            count: `${evrakList.length + 6} Kriter`,
            sectionKeys: ["evrak", "komisyon"]
        },
        {
            id: "fiziki",
            label: "2. Fiziki ve Teknik Standartlar",
            icon: Building2,
            count: `${FIZIKI_SARTLAR_LISTESI.length} Kriter`,
            sectionKeys: ["fiziki"]
        },
        {
            id: "personel_saglik",
            label: "3. Personel, Antrenör & Sağlık",
            icon: Award,
            count: `${ANTRENOR_PERSONEL_LISTESI.length + SAGLIK_SPORCU_LISTESI.length} Kriter`,
            sectionKeys: ["antrenor", "saglik"]
        },
        {
            id: "vize_yaptirim",
            label: "4. Yıllık Vize & Cezai Yaptırımlar",
            icon: ShieldAlert,
            count: "6 Kriter",
            sectionKeys: ["vize"]
        }
    ], [evrakList.length, stats.totalItems]);

    const shouldShowSection = (sec: "evrak" | "komisyon" | "fiziki" | "antrenor" | "saglik" | "vize") => {
        if (activeSection === "all") return true;
        const group = CATEGORY_GROUPS.find(g => g.id === activeSection);
        return group?.sectionKeys.includes(sec) ?? false;
    };

    // ---------------------------------------------------------------------------
    // RENDER MAIN COMPONENT
    // ---------------------------------------------------------------------------

    return (
        <div className="flex-1 flex flex-col gap-4 p-1 animate-in fade-in duration-300">
            {/* 1. ÜST ARAÇ ÇUBUĞU (Kullanıcının İstediği Tasarım) */}
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                {/* Sol Başlık & İkon */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shrink-0">
                        <Table size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-slate-100 flex flex-wrap items-center gap-1.5 sm:gap-2 leading-snug">
                            <span>Özel Beden Eğitimi ve Spor Tesisleri Denetimi</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                6 Konu / {stats.totalItems} Kriter
                            </span>
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                            {ilAdi ? `${ilAdi} Gençlik ve Spor İl Müdürlüğü` : "İl Müdürlüğü"} Teftişi Bilgi & Denetim Çizelgesi
                        </p>
                    </div>
                </div>

                {/* Sağ Araçlar: İl, Dönem ve Aksiyon Butonları */}
                <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2.5 w-full lg:w-auto">
                    {/* Meta Alanlar: İl & Yıl (Büyütülmüş & Düzenlenmiş & Mobilde Tam Uyumlu) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-nowrap items-center gap-2 w-full lg:w-auto">
                        {/* İl Seçici */}
                        <div className="flex items-center gap-2 h-9 sm:h-10 bg-slate-50 dark:bg-slate-800/90 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-sm min-w-0">
                            <MapPin size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider shrink-0">İl:</span>
                            <input
                                type="text"
                                value={ilAdi}
                                onChange={(e) => setIlAdi(e.target.value.toUpperCase())}
                                onBlur={handleSave}
                                placeholder="ÖRN: VAN"
                                className="h-7 sm:h-8 w-full sm:w-36 px-2 text-xs sm:text-sm font-black uppercase bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner text-center tracking-wide outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all min-w-0"
                                title="Denetlenen il adı"
                            />
                        </div>

                        {/* Dönem Yıl Seçici */}
                        <div className="flex items-center gap-2 h-9 sm:h-10 bg-slate-50 dark:bg-slate-800/90 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-sm min-w-0">
                            <Calendar size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider shrink-0">Dönem:</span>
                            <div className="flex items-center gap-1 flex-1 sm:flex-initial">
                                <input
                                    type="number"
                                    value={startYear}
                                    onChange={(e) => setStartYear(parseInt(e.target.value) || 2024)}
                                    className="h-7 sm:h-8 w-full sm:w-20 px-1 text-xs sm:text-sm font-black text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                    min={2000}
                                    max={2040}
                                    title="Başlangıç Yılı"
                                />
                                <span className="font-black text-slate-400 text-xs px-0.5 shrink-0">-</span>
                                <input
                                    type="number"
                                    value={endYear}
                                    onChange={(e) => setEndYear(parseInt(e.target.value) || 2025)}
                                    className="h-7 sm:h-8 w-full sm:w-20 px-1 text-xs sm:text-sm font-black text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                    min={2000}
                                    max={2040}
                                    title="Bitiş Yılı"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Gizli Excel Input */}
                    <input
                        type="file"
                        ref={excelFileInputRef}
                        onChange={handleExcelFileSelected}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />

                    {/* Aksiyon Butonları Grubu */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
                        {/* 1. TEK İNDİR BUTONU (Tıklanınca 4 Seçenek Açılır) */}
                        <div className="relative w-full sm:w-auto" ref={downloadMenuRef}>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                                className={`w-full sm:w-auto rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-sm px-2.5 sm:px-3 flex items-center justify-between sm:justify-start gap-1.5 ${isDownloadMenuOpen ? "bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-500/20" : ""}`}
                                title="Excel ve Word şablonlarını indirme seçenekleri"
                            >
                                <div className="flex items-center gap-1.5 truncate">
                                    {isExportingExcel || isExportingWord ? (
                                        <Loader2 size={13} className="animate-spin mr-1 shrink-0" />
                                    ) : (
                                        <Download size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                    )}
                                    <span className="truncate">İndir / Şablon</span>
                                </div>
                                <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${isDownloadMenuOpen ? "rotate-180" : ""}`} />
                            </Button>

                            {isDownloadMenuOpen && (
                                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-64 max-w-[calc(100vw-2.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Excel Formatı (.xlsx)
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDownloadExcel(true);
                                            setIsDownloadMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition-colors text-left group"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <FileSpreadsheet size={15} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-slate-850 dark:text-white">Boş Excel Şablonu</div>
                                            <div className="text-[10px] text-slate-400">Kuruma gönderilecek boş .xlsx</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDownloadExcel(false);
                                            setIsDownloadMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition-colors text-left group"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <FileSpreadsheet size={15} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-slate-850 dark:text-white">Excel Denetim Çizelgesi</div>
                                            <div className="text-[10px] text-slate-400">Mevcut verilerle dolu .xlsx</div>
                                        </div>
                                    </button>

                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                    <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Word Formatı (.doc / .docx)
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDownloadWord(false);
                                            setIsDownloadMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors text-left group"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <FileText size={15} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-slate-850 dark:text-white">Word Denetim Raporu</div>
                                            <div className="text-[10px] text-slate-400">Çift imzalı resmi teftiş tutanağı</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleDownloadWord(true);
                                            setIsDownloadMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors text-left group"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <FileText size={15} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-slate-850 dark:text-white">Boş Word Tutanağı</div>
                                            <div className="text-[10px] text-slate-400">Yerinde teftiş için boş şablon</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Excel Yükle */}
                        <Button
                            size="sm"
                            onClick={handleExcelUploadClick}
                            disabled={isImportingExcel || isSaving}
                            className="w-full sm:w-auto rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 px-2.5 sm:px-3 justify-center"
                            title="Doldurulan Excel dosyasını seçip sisteme aktarır"
                        >
                            {isImportingExcel ? (
                                <Loader2 size={13} className="animate-spin mr-1 sm:mr-1.5 shrink-0" />
                            ) : (
                                <Upload size={13} className="mr-1 sm:mr-1.5 shrink-0" />
                            )}
                            <span className="truncate">Excel Yükle</span>
                        </Button>

                        {/* HTML Aç */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open('/ozel_beden_egitimi_tesisleri_denetimi.html', '_blank')}
                            className="w-full sm:w-auto rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-semibold border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2 sm:px-3 justify-center"
                            title="Bağımsız interaktif HTML formunu yeni sekmede açar"
                        >
                            <ExternalLink size={13} className="mr-1 sm:mr-1.5 shrink-0" />
                            <span className="truncate">HTML Aç</span>
                        </Button>

                        {/* Yazdır */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePrint}
                            className="w-full sm:w-auto rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 px-2 sm:px-3 justify-center"
                        >
                            <Printer size={13} className="mr-1 sm:mr-1.5 shrink-0" />
                            <span className="truncate">Yazdır</span>
                        </Button>

                        {/* Kaydet & Sıfırla Grubu (Mobilde tam genişlikte birlikte durur) */}
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 w-full sm:w-auto">
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 sm:flex-initial rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 px-3 justify-center"
                            >
                                {isSaving ? <Loader2 size={13} className="animate-spin mr-1.5 shrink-0" /> : <Save size={13} className="mr-1.5 shrink-0" />}
                                <span>Kaydet</span>
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleResetAudit}
                                disabled={isSaving}
                                className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold border-rose-300 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 justify-center shrink-0"
                                title="Formdaki tüm verileri sıfırlar"
                            >
                                <RotateCcw size={13} className="shrink-0" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. TESİS KÜNYESİ VE UYUM ÖZET ŞERİDİ (Kompakt ve Katlanabilir) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-blue-600 shrink-0" />
                            <h3 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-slate-100">
                                Tesis Künyesi
                            </h3>
                        </div>
                        {/* Kişi Türü Hapı */}
                        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => handleInfoChange("tur", "gercek")}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    activeFacility.tur === "gercek"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                Gerçek Kişi
                            </button>
                            <button
                                type="button"
                                onClick={() => handleInfoChange("tur", "tuzel")}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    activeFacility.tur === "tuzel"
                                        ? "bg-indigo-600 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                Tüzel Kişi
                            </button>
                        </div>
                    </div>

                    {/* Sağ Taraf: Uyum Skoru & Katlama Butonu */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5">
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 flex-1 sm:flex-initial justify-between sm:justify-start">
                            <span className="font-bold text-slate-500">Uyum:</span>
                            <span className={`font-black ${stats.uyumYuzdesi >= 80 ? "text-emerald-600" : stats.uyumYuzdesi >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                                %{stats.uyumYuzdesi}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                ({stats.varCount} Uygun / {stats.yokCount} Eksik)
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsMetaExpanded(prev => !prev)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 sm:border-0 shrink-0"
                            title={isMetaExpanded ? "Künyeyi Gizle" : "Künyeyi Göster"}
                        >
                            {isMetaExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>

                {/* Katlanabilir Künye Form Alanları */}
                {isMetaExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs pt-1">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Tesis Adı</label>
                            <input
                                type="text"
                                value={activeFacility.tesisAdi}
                                onChange={e => handleInfoChange("tesisAdi", e.target.value)}
                                placeholder="Örn: Efsane Spor Tesisi"
                                className="w-full h-7 px-2 font-semibold rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">İşletici / Sorumlu</label>
                            <input
                                type="text"
                                value={activeFacility.isleticiSahip}
                                onChange={e => handleInfoChange("isleticiSahip", e.target.value)}
                                placeholder="Ad Soyad"
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">T.C. / Vergi No</label>
                            <input
                                type="text"
                                value={activeFacility.tcVkn}
                                onChange={e => handleInfoChange("tcVkn", e.target.value)}
                                placeholder="T.C. veya VKN"
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Spor Branşları</label>
                            <input
                                type="text"
                                value={activeFacility.branslar}
                                onChange={e => handleInfoChange("branslar", e.target.value)}
                                placeholder="Fitness, Pilates..."
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">İlçe ve Adres</label>
                            <input
                                type="text"
                                value={activeFacility.adres}
                                onChange={e => handleInfoChange("adres", e.target.value)}
                                placeholder="Mahalle, cadde, no..."
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Açılış İzin Tarihi</label>
                            <input
                                type="date"
                                value={activeFacility.acilisTarihi}
                                onChange={e => handleInfoChange("acilisTarihi", e.target.value)}
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Son Vize Tarihi</label>
                            <input
                                type="date"
                                value={activeFacility.sonVizeTarihi}
                                onChange={e => handleInfoChange("sonVizeTarihi", e.target.value)}
                                className="w-full h-7 px-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 3. KATEGORİ HIZLI GEÇİŞ ÇUBUĞU (Pills) VE FİLTRELER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
                {/* Kategori Butonları */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scroll-smooth [&::-webkit-scrollbar]:hidden">
                    {CATEGORY_GROUPS.map(cat => {
                        const Icon = cat.icon;
                        const isActive = activeSection === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveSection(cat.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                                    isActive
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                                        : "bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                            >
                                <Icon size={13} className="shrink-0" />
                                <span>{cat.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isActive ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-500"}`}>
                                    {cat.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filtre ve Arama */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                        type="button"
                        onClick={() => setFilterOnlyMissing(prev => !prev)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            filterOnlyMissing
                                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                        title="Sadece eksik/uygunsuz olan maddeleri gösterir"
                    >
                        <Filter size={12} />
                        <span>Sadece Eksikler</span>
                    </button>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Maddelerde ara..."
                            className="h-8 pl-8 pr-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-48"
                        />
                    </div>
                </div>
            </div>

            {/* 4. KATEGORİZE TABLOLAR */}

            {/* BÖLÜM 1: AÇILIŞ EVRAKLARI */}
            {shouldShowSection("evrak") && (
                renderSectionTable(
                    `1. AÇILIŞ VE İZİN EVRAK KONTROLÜ (${activeFacility.tur === "gercek" ? "Gerçek Kişi" : "Tüzel Kişi"})`,
                    1,
                    "evraklar",
                    evrakList,
                    "evrak"
                )
            )}

            {/* BÖLÜM 2: KOMİSYON & HARÇ KONTROLÜ */}
            {shouldShowSection("komisyon") && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">
                                2
                            </span>
                            <span className="uppercase">AÇILIŞ İZNİ KOMİSYONU VE HARÇ KONTROLÜ</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Yön. Md. 11, 12, 14
                            </span>
                        </h4>
                    </div>

                    {/* Masaüstü Görünüm: Tablo */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[240px]">İNCELEME KONUSU</th>
                                    <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 w-48 text-center">DURUM</th>
                                    <th className="p-2.5 min-w-[280px]">BİLGİ / AÇIKLAMA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Vali Onayı */}
                                <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/20">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Vali Onayı Bulunuyor mu?
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border">
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("valiOnayi", "var")}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.valiOnayi === "var" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
                                            >
                                                Var
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("valiOnayi", "yok")}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.valiOnayi === "yok" ? "bg-rose-600 text-white" : "text-slate-600"}`}
                                            >
                                                Yok
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.komisyonKararTarihi}
                                            onChange={e => handleKomisyonChange("komisyonKararTarihi", e.target.value)}
                                            placeholder="Vali Onay Tarihi / Sayısı..."
                                            className="w-full h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                    </td>
                                </tr>

                                {/* Komisyon Kararı */}
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/30">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Komisyon Karar Numarası & Dosya Dağıtımı
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border">
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("dosyaDagitimiTam", "var")}
                                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.dosyaDagitimiTam === "var" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
                                            >
                                                Tam (5 Nüsha)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("dosyaDagitimiTam", "yok")}
                                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.dosyaDagitimiTam === "yok" ? "bg-rose-600 text-white" : "text-slate-600"}`}
                                            >
                                                Eksik
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.komisyonKararNo}
                                            onChange={e => handleKomisyonChange("komisyonKararNo", e.target.value)}
                                            placeholder="Karar No ve dağıtım notu..."
                                            className="w-full h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                    </td>
                                </tr>

                                {/* Komisyon Üyeleri İsimleri */}
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Komisyon Başkanı & Şube Müdürleri
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 font-bold text-[11px]">
                                        İl Müdürü & Şb. Md.
                                    </td>
                                    <td className="p-2 space-y-1">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.ilMudurBaskan}
                                            onChange={e => handleKomisyonChange("ilMudurBaskan", e.target.value)}
                                            placeholder="İl Müdürü (Komisyon Bşk.)..."
                                            className="w-full h-6 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 mb-1"
                                        />
                                        <div className="grid grid-cols-2 gap-1">
                                            <input
                                                type="text"
                                                value={activeFacility.komisyon.sporSbMd}
                                                onChange={e => handleKomisyonChange("sporSbMd", e.target.value)}
                                                placeholder="Spor Şb. Md."
                                                className="w-full h-6 px-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                            />
                                            <input
                                                type="text"
                                                value={activeFacility.komisyon.tesislerSbMd}
                                                onChange={e => handleKomisyonChange("tesislerSbMd", e.target.value)}
                                                placeholder="Tesisler Şb. Md."
                                                className="w-full h-6 px-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                            />
                                        </div>
                                    </td>
                                </tr>

                                {/* Temsilciler */}
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/30">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Federasyon ve İl Sağlık Temsilcileri
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 font-bold text-[11px]">
                                        Temsilciler
                                    </td>
                                    <td className="p-2 grid grid-cols-2 gap-1">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.fedTemsilcisi}
                                            onChange={e => handleKomisyonChange("fedTemsilcisi", e.target.value)}
                                            placeholder="Federasyon İl Temsilcisi..."
                                            className="w-full h-6 px-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.saglikTemsilcisi}
                                            onChange={e => handleKomisyonChange("saglikTemsilcisi", e.target.value)}
                                            placeholder="İl Sağlık Müd. Temsilcisi..."
                                            className="w-full h-6 px-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                    </td>
                                </tr>

                                {/* Tescil Harcı Tahsilatı */}
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Tescil Harcı / Ücreti Tahsilatı
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border">
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("tescilUcretiTahsilat", "var")}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.tescilUcretiTahsilat === "var" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
                                            >
                                                Tahsil Edildi
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleKomisyonChange("tescilUcretiTahsilat", "yok")}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.tescilUcretiTahsilat === "yok" ? "bg-rose-600 text-white" : "text-slate-600"}`}
                                            >
                                                Edilmedi
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.tescilUcretiTutar}
                                            onChange={e => handleKomisyonChange("tescilUcretiTutar", e.target.value)}
                                            placeholder="Tahsil edilen tutar (TL) ve makbuz no..."
                                            className="w-full h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                    </td>
                                </tr>

                                {/* Genel Müdürlük ve İl Müdürlüğü Payı (%50) */}
                                <tr className="bg-slate-50/30">
                                    <td className="p-2.5 font-medium border-r border-slate-200 dark:border-slate-700">
                                        Genel Müdürlük (%50) ve İl Müd. (%50) Payları
                                    </td>
                                    <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                                        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleKomisyonChange("genelMudurPayiYatırıldı", "var");
                                                    handleKomisyonChange("ilMudurPayiYatırıldı", "var");
                                                }}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.genelMudurPayiYatırıldı === "var" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
                                            >
                                                Yatırıldı
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleKomisyonChange("genelMudurPayiYatırıldı", "yok");
                                                    handleKomisyonChange("ilMudurPayiYatırıldı", "yok");
                                                }}
                                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${activeFacility.komisyon.genelMudurPayiYatırıldı === "yok" ? "bg-rose-600 text-white" : "text-slate-600"}`}
                                            >
                                                Yatırılmadı
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="text"
                                            value={activeFacility.komisyon.aciklama}
                                            onChange={e => handleKomisyonChange("aciklama", e.target.value)}
                                            placeholder="Dekont ve hesap aktarım bilgileri..."
                                            className="w-full h-7 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Mobil Görünüm: Dokunmatik Kartlar */}
                    <div className="block md:hidden space-y-2.5">
                        {/* 1. Vali Onayı */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Vali Onayı Bulunuyor mu?
                            </div>
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("valiOnayi", "var")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.valiOnayi === "var" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Var
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("valiOnayi", "yok")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.valiOnayi === "yok" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Yok
                                </button>
                            </div>
                            <input
                                type="text"
                                value={activeFacility.komisyon.komisyonKararTarihi}
                                onChange={e => handleKomisyonChange("komisyonKararTarihi", e.target.value)}
                                placeholder="Vali Onay Tarihi / Sayısı..."
                                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {/* 2. Komisyon Kararı */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Komisyon Karar Numarası & Dosya Dağıtımı
                            </div>
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("dosyaDagitimiTam", "var")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.dosyaDagitimiTam === "var" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Tam (5 Nüsha)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("dosyaDagitimiTam", "yok")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.dosyaDagitimiTam === "yok" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Eksik
                                </button>
                            </div>
                            <input
                                type="text"
                                value={activeFacility.komisyon.komisyonKararNo}
                                onChange={e => handleKomisyonChange("komisyonKararNo", e.target.value)}
                                placeholder="Karar No ve dağıtım notu..."
                                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {/* 3. Komisyon Üyeleri */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Komisyon Başkanı & Şube Müdürleri
                            </div>
                            <input
                                type="text"
                                value={activeFacility.komisyon.ilMudurBaskan}
                                onChange={e => handleKomisyonChange("ilMudurBaskan", e.target.value)}
                                placeholder="İl Müdürü (Komisyon Başkanı)..."
                                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={activeFacility.komisyon.sporSbMd}
                                    onChange={e => handleKomisyonChange("sporSbMd", e.target.value)}
                                    placeholder="Spor Şb. Md."
                                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                                />
                                <input
                                    type="text"
                                    value={activeFacility.komisyon.tesislerSbMd}
                                    onChange={e => handleKomisyonChange("tesislerSbMd", e.target.value)}
                                    placeholder="Tesisler Şb. Md."
                                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* 4. Temsilciler */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Federasyon ve İl Sağlık Temsilcileri
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={activeFacility.komisyon.fedTemsilcisi}
                                    onChange={e => handleKomisyonChange("fedTemsilcisi", e.target.value)}
                                    placeholder="Federasyon İl Temsilcisi..."
                                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                                />
                                <input
                                    type="text"
                                    value={activeFacility.komisyon.saglikTemsilcisi}
                                    onChange={e => handleKomisyonChange("saglikTemsilcisi", e.target.value)}
                                    placeholder="İl Sağlık Müd. Temsilcisi..."
                                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* 5. Tescil Harcı */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Tescil Harcı / Ücreti Tahsilatı
                            </div>
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("tescilUcretiTahsilat", "var")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.tescilUcretiTahsilat === "var" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Tahsil Edildi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleKomisyonChange("tescilUcretiTahsilat", "yok")}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.tescilUcretiTahsilat === "yok" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Edilmedi
                                </button>
                            </div>
                            <input
                                type="text"
                                value={activeFacility.komisyon.tescilUcretiTutar}
                                onChange={e => handleKomisyonChange("tescilUcretiTutar", e.target.value)}
                                placeholder="Tahsil edilen tutar (TL) ve makbuz no..."
                                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {/* 6. Genel Müdürlük Payı */}
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
                            <div className="text-xs font-bold text-slate-850 dark:text-white">
                                Genel Müdürlük (%50) ve İl Müd. (%50) Payları
                            </div>
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleKomisyonChange("genelMudurPayiYatırıldı", "var");
                                        handleKomisyonChange("ilMudurPayiYatırıldı", "var");
                                    }}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.genelMudurPayiYatırıldı === "var" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Yatırıldı
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleKomisyonChange("genelMudurPayiYatırıldı", "yok");
                                        handleKomisyonChange("ilMudurPayiYatırıldı", "yok");
                                    }}
                                    className={`h-8 rounded-lg text-xs font-bold transition-all ${activeFacility.komisyon.genelMudurPayiYatırıldı === "yok" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    Yatırılmadı
                                </button>
                            </div>
                            <input
                                type="text"
                                value={activeFacility.komisyon.aciklama}
                                onChange={e => handleKomisyonChange("aciklama", e.target.value)}
                                placeholder="Dekont ve hesap aktarım bilgileri..."
                                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* BÖLÜM 3: FİZİKİ VE TEKNİK ŞARTLAR */}
            {shouldShowSection("fiziki") && (
                renderSectionTable(
                    "3. FİZİKİ VE TEKNİK ŞARTLAR (Md. 8 - 9)",
                    3,
                    "fizikiSartlar",
                    FIZIKI_SARTLAR_LISTESI,
                    "fiziki"
                )
            )}

            {/* BÖLÜM 4: ANTRENÖR VE PERSONEL ŞARTLARI */}
            {shouldShowSection("antrenor") && (
                renderSectionTable(
                    "4. ANTRENÖR VE PERSONEL ŞARTLARI (Md. 22 - 23)",
                    4,
                    "antrenorPersonel",
                    ANTRENOR_PERSONEL_LISTESI,
                    "antrenor"
                )
            )}

            {/* BÖLÜM 5: SAĞLIK VE SPORCU KAYITLARI */}
            {shouldShowSection("saglik") && (
                renderSectionTable(
                    "5. SAĞLIK, İLKYARDIM VE SPORCU KAYITLARI (Md. 16, 24, 25)",
                    5,
                    "saglikSporcu",
                    SAGLIK_SPORCU_LISTESI,
                    "saglik"
                )
            )}

            {/* BÖLÜM 6: YILLIK VİZE, İPC VE NİHAİ KANAAT */}
            {shouldShowSection("vize") && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">
                                6
                            </span>
                            <span className="uppercase">YILLIK VİZE, CEZAİ YAPTIRIMLAR VE NİHAİ KARAR (Md. 13, 26)</span>
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-2.5 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    Yıllık Vize Durumu (Her yıl Aralık ayında)
                                </label>
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                    <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 border shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleVizeChange("yillikVizeYapildiMi", "var")}
                                            className={`px-3 py-1 rounded text-xs font-bold ${activeFacility.vizeYaptirim.yillikVizeYapildiMi === "var" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
                                        >
                                            Vize Yapıldı
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleVizeChange("yillikVizeYapildiMi", "yok")}
                                            className={`px-3 py-1 rounded text-xs font-bold ${activeFacility.vizeYaptirim.yillikVizeYapildiMi === "yok" ? "bg-rose-600 text-white" : "text-slate-600"}`}
                                        >
                                            Vizesiz
                                        </button>
                                    </div>
                                    <input
                                        type="date"
                                        value={activeFacility.vizeYaptirim.vizeOnayTarihi}
                                        onChange={e => handleVizeChange("vizeOnayTarihi", e.target.value)}
                                        className="h-8 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs w-full sm:w-auto"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    Önceki Denetim ve Uygulanan İPC Durumu
                                </label>
                                <input
                                    type="text"
                                    value={activeFacility.vizeYaptirim.oncekiIpcDurumu}
                                    onChange={e => handleVizeChange("oncekiIpcDurumu", e.target.value)}
                                    placeholder="Örn: 2023 yılında 10 gün süre verilmiş, süre sonunda uygun bulunmuştur."
                                    className="w-full h-8 px-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    Eksikliklerin Giderilmesi İçin Verilen Süre (Md. 26)
                                </label>
                                <input
                                    type="text"
                                    value={activeFacility.vizeYaptirim.verilenSureVarMi}
                                    onChange={e => handleVizeChange("verilenSureVarMi", e.target.value)}
                                    placeholder="Örn: Yangın tüpü eksikliği için 15 gün süre tanındı."
                                    className="w-full h-8 px-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    Genel Denetim Sonuç Kararı
                                </label>
                                <select
                                    value={activeFacility.genelSonuc}
                                    onChange={e => handleInfoChange("genelSonuc", e.target.value)}
                                    className="w-full h-8 px-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                                >
                                    <option value="incelemede">İncelemede / Devam Ediyor</option>
                                    <option value="uygun">Mevzuata Tam Uygun</option>
                                    <option value="eksik">Süre Verildi (Eksikliklerin Giderilmesi)</option>
                                    <option value="ipc">İdari Para Cezası Teklifi (Md. 26)</option>
                                    <option value="kapatma">Faaliyetten Men / İptal (Md. 26/Son)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                    Müfettiş Nihai Kanaati ve Açıklamalar
                                </label>
                                <textarea
                                    rows={4}
                                    value={activeFacility.vizeYaptirim.sonucKarari}
                                    onChange={e => handleVizeChange("sonucKarari", e.target.value)}
                                    placeholder="Tesisin genel teftiş sonucu, yönetmelik maddelerine uyumu ve önerilen tedbirler..."
                                    className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
