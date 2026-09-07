import React, { useState, useMemo, useCallback, useRef } from "react";
import { 
    Table, 
    Download, 
    Printer, 
    Save, 
    Calendar, 
    MapPin,
    Users, 
    Award, 
    DollarSign, 
    Building2, 
    FileText, 
    Loader2,
    Search,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Plus,
    Trash2,
    RotateCcw,
    FileSpreadsheet,
    Upload,
    ChevronDown,
    AlertTriangle,
    LayoutGrid
} from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "react-hot-toast";
import { generateOzetTablolarDocx } from "../../lib/api/files";
import { exportAuditSummaryExcel, parseAuditSummaryExcel } from "../../lib/auditExcelHelper";

// 6- PERSONEL DURUMU SABİTLERİ (4 ALT TABLO)
const IDARI_PERSONEL_ROWS = [
    { key: "ilMudur", label: "İl Müdürü" },
    { key: "hizmetMudur", label: "Hizmet Müdürü" },
    { key: "subeMudur", label: "Şube Müdürü" },
    { key: "sef", label: "Şef" },
    { key: "muhendis", label: "Mühendis" },
    { key: "arastirmaci", label: "Araştırmacı" },
    { key: "memur", label: "Memur" },
    { key: "sozlesmeliToplam", label: "(1) Sözleşmeli Personel sayısı", bold: true },
    { key: "sozlesmeliAntrenor", label: "• Sözleşmeli Antrenör", isBullet: true },
    { key: "sozlesmeliUzman", label: "• Sözleşmeli Spor Eğitim Uzmanı", isBullet: true },
    { key: "sozlesmeli4C", label: "• Sözleşmeli İdari Destek Personeli 4/C", isBullet: true },
    { key: "sozlesmeliYurt", label: "• Sözleşmeli Yurt Yönetim Personeli", isBullet: true },
    { key: "surekliIsci", label: "Sürekli İşçi Kadrosuna geçenlerin sayısı" },
    { key: "yardimciHizmet", label: "Yardımcı hizmet personeli sayısı" },
];

const ILCE_PERSONEL_ROWS = [
    { key: "ilceMudur", label: "İlçe Müdürü" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" },
];

const YURT_PERSONEL_ROWS = [
    { key: "yurtMudur", label: "Yurt Müdürü" },
    { key: "yurtMudurYrd", label: "Yurt Müdür Yrd." },
    { key: "yurtYonetimMemuru", label: "Yurt Yönetim Memuru" },
    { key: "yurtYonetimPersoneli", label: "Yurt Yönetim Personeli" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" },
];

const GENCLIK_MERKEZI_ROWS = [
    { key: "gmMudur", label: "Gençlik Merkezi Müdürü" },
    { key: "lider", label: "Lider" },
    { key: "nokta", label: "Nokta" },
    { key: "temizlik", label: "Temizlik Personeli" },
    { key: "guvenlik", label: "Güvenlik Personeli" },
    { key: "teknik", label: "Teknik Personel" },
];

interface DenetimOzetTablolarProps {
    localAuditData: any;
    setLocalAuditData: (data: any) => void;
    onSave: (data?: any) => Promise<void>;
    isSaving: boolean;
    selectedReport: any;
    profile: any;
}

const DEFAULT_BRANCHES = [
    "ATICILIK", "ATLETİZM", "BADMİNTON", "BASKETBOL", "BED. ENG. TENİS", "BİSİKLET", "BOCCE", "BOKS",
    "BUZ HOKEYİ", "BUZ PATENİ", "CİMNASTİK", "CURLİNG", "DART", "ESKRİM", "FUTBOL", "GOALBALL",
    "GÖRME ENG. FUTBOL", "GÜREŞ", "HALTER", "HENTBOL", "HOKEY", "JUDO", "KARATE", "KAYAK",
    "KİCK-BOX", "KÜREK", "MODERN PENTATLON", "MASA TENİSİ", "MUAY-TAİ", "OKÇULUK", "TAEKWONDO",
    "TENİS", "VOLEYBOL", "WUSHU", "YÜZME"
];

const DEFAULT_FACILITY_TYPES = [
    "YURT", "DOĞAL ÇİM YÜZEYLİ STAD", "STADYUM", "TOPRAK YÜZEYLİ STAD", "SEMT SAHASI",
    "SENTETİK ÇİM YÜZEYLİ SAHA", "SPOR SALONU", "YÜZME HAVUZU", "KAMP EĞİTİM MERKEZİ",
    "ATLETİZM PİSTİ", "GENÇLİK MERKEZİ", "BUZ PİSTİ", "ATIŞ POLİGONU", "BİNİCİLİK TESİSLERİ",
    "TENİS TESİSLERİ", "GOLF SAHASI", "LOKAL BİNALARI", "BOWLİNG SALONU", "BİLARDO SALONU",
    "HOBİ KARTİNG", "DİĞER"
];

const TURKISH_PROVINCES = [
    "ADANA", "ADIYAMAN", "AFYONKARAHİSAR", "AĞRI", "AKSARAY", "AMASYA", "ANKARA", "ANTALYA", 
    "ARDAHAN", "ARTVİN", "AYDIN", "BALIKESİR", "BARTIN", "BATMAN", "BAYBURT", "BİLECİK", 
    "BİNGÖL", "BİTLİS", "BOLU", "BURDUR", "BURSA", "ÇANAKKALE", "ÇANKIRI", "ÇORUM", 
    "DENİZLİ", "DİYARBAKIR", "DÜZCE", "EDİRNE", "ELAZIĞ", "ERZİNCAN", "ERZURUM", "ESKİŞEHİR", 
    "GAZİANTEP", "GİRESUN", "GÜMÜŞHANE", "HAKKARİ", "HATAY", "IĞDIR", "ISPARTA", "İSTANBUL", 
    "İZMİR", "KAHRAMANMARAŞ", "KARABÜK", "KARAMAN", "KARS", "KASTAMONU", "KAYSERİ", "KIRIKKALE", 
    "KIRKLARELİ", "KIRŞEHİR", "KİLİS", "KOCAELİ", "KONYA", "KÜTAHYA", "MALATYA", "MANİSA", 
    "MARDİN", "MERSİN", "MUĞLA", "MUŞ", "NEVŞEHİR", "NİĞDE", "ORDU", "OSMANİYE", 
    "RİZE", "SAKARYA", "SAMSUN", "SİİRT", "SİNOP", "SİVAS", "ŞANLIURFA", "ŞIRNAK", 
    "TEKİRDAĞ", "TOKAT", "TRABZON", "TUNCELİ", "UŞAK", "VAN", "YALOVA", "YOZGAT", "ZONGULDAK"
];

export const DenetimOzetTablolar: React.FC<DenetimOzetTablolarProps> = ({
    localAuditData,
    setLocalAuditData,
    onSave,
    isSaving,
    selectedReport,
    profile
}) => {
    // Evrak talebi, görev adı veya genel bilgilerden il adını akıllıca al (81 il tespiti)
    const initialIl = () => {
        const checkSource = (str: string) => {
            if (!str) return null;
            const upper = str.toLocaleUpperCase("tr-TR").replace(/i/g, "İ").replace(/ı/g, "I");
            for (const prov of [...TURKISH_PROVINCES].sort((a, b) => b.length - a.length)) {
                const regex = new RegExp(`(?<![A-ZÇĞİÖŞÜ])${prov}(?![A-ZÇĞİÖŞÜ])`, "i");
                if (regex.test(upper)) return prov;
            }
            return null;
        };

        const fromMeta = checkSource(localAuditData?.istenecekTablolar?.meta?.il);
        if (fromMeta) return fromMeta;

        const fromInfo = checkSource(localAuditData?.info?.il);
        if (fromInfo) return fromInfo;

        const rawName = selectedReport?.title || selectedReport?.rapor_adi || selectedReport?.unit_name || "";
        const fromTitle = checkSource(rawName);
        if (fromTitle) return fromTitle;

        if (rawName) {
            const cleaned = rawName
                .replace(/^\s*\d+\s*[-–.]\s*/, "")
                .replace(/gençlik\s+ve\s+spor\s+il\s+müdürlüğü/gi, "")
                .replace(/genclik\s+ve\s+spor\s+il\s+mudurlugu/gi, "")
                .replace(/genel\s+raporu/gi, "")
                .replace(/raporu/gi, "")
                .replace(/rapor/gi, "")
                .replace(/il\s+müdürlüğü/gi, "")
                .replace(/il\s+mudurlugu/gi, "")
                .replace(/denetimi/gi, "")
                .replace(/denetim/gi, "")
                .replace(/\d+$/, "")
                .trim();
            if (cleaned) return cleaned.toUpperCase();
        }
        return "VAN";
    };

    const [ilAdi, setIlAdi] = useState<string>(initialIl);
    
    // Bulunduğumuz yıldan 1 önceki seneden 5 yıl geriye git (Örn: 2026'da ise 2021 - 2025 dönemi)
    const currentYear = new Date().getFullYear();
    const defaultEndYear = currentYear - 1; // Örn: 2026 ise 2025
    const defaultStartYear = currentYear - 5; // Örn: 2026 ise 2021 (5 yıllık denetim dönemi)
    
    // Yıl Aralığı State
    const [startYear, setStartYear] = useState<number>(() => {
        return localAuditData?.istenecekTablolar?.meta?.startYear || defaultStartYear;
    });
    const [endYear, setEndYear] = useState<number>(() => {
        return localAuditData?.istenecekTablolar?.meta?.endYear || defaultEndYear;
    });

    const [activeSection, setActiveSection] = useState<string>("all");
    const [isExportingDocx, setIsExportingDocx] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [viewMode, setViewMode] = useState<"auto" | "table" | "card">("auto");
    const excelFileInputRef = useRef<HTMLInputElement>(null);

    // Dinamik Yıllar Listesi
    const years = useMemo(() => {
        const s = Math.min(startYear, endYear);
        const e = Math.max(startYear, endYear);
        const yList: string[] = [];
        for (let y = s; y <= e; y++) {
            yList.push(String(y));
        }
        return yList;
    }, [startYear, endYear]);

    const hasPre2019 = useMemo(() => years.some(y => parseInt(y) <= 2018), [years]);
    const hasPost2019 = useMemo(() => years.some(y => parseInt(y) >= 2019), [years]);
    const isSplitPeriod = useMemo(() => hasPre2019 && hasPost2019, [hasPre2019, hasPost2019]);

    // Personel Durumu için yıllar: Denetim dönemi + Mevcut Teftiş Yılı (endYear + 1)
    // Norm Kadro ile mevcut durumu kıyaslamak için dönem 2021-2025 ise 2026, 2022-2026 ise 2027 eklenir.
    const personelYears = useMemo(() => {
        if (!years || years.length === 0) return [];
        const lastYear = parseInt(years[years.length - 1]);
        const nextYearStr = String(lastYear + 1);
        return [...years, nextYearStr];
    }, [years]);

    const preYears = useMemo(() => {
        return years.filter(y => parseInt(y) <= 2018);
    }, [years]);

    const postYears = useMemo(() => {
        return years.filter(y => parseInt(y) >= 2019);
    }, [years]);

    // Data shortcuts
    const tables = localAuditData?.istenecekTablolar || {};

    // Dinamik Branşlar, Tesisler ve Ek Maddeler
    const branches: string[] = useMemo(() => {
        return tables?.customBranches && Array.isArray(tables.customBranches) && tables.customBranches.length > 0
            ? tables.customBranches
            : DEFAULT_BRANCHES;
    }, [tables?.customBranches]);

    const facilityTypes: string[] = useMemo(() => {
        return tables?.customFacilities && Array.isArray(tables.customFacilities) && tables.customFacilities.length > 0
            ? tables.customFacilities
            : DEFAULT_FACILITY_TYPES;
    }, [tables?.customFacilities]);

    const customMaddeler: any[] = useMemo(() => {
        return Array.isArray(tables?.customMaddeler) ? tables.customMaddeler : [];
    }, [tables?.customMaddeler]);

    // Spor Dalı Temsilcileri filtre & arama
    const [temsilciSearch, setTemsilciSearch] = useState("");
    const [temsilciFilter, setTemsilciFilter] = useState<"all" | "var" | "yok">("all");

    const filteredTemsilciBranches = useMemo(() => {
        return branches.filter(b => {
            const matchesSearch = b.toLowerCase().includes(temsilciSearch.toLowerCase().trim());
            if (!matchesSearch) return false;
            
            const bData = tables?.sporDaliTemsilcileri?.[b] || {};
            const varMi = bData.varMi;
            if (temsilciFilter === "var") return varMi === "var" || varMi === "evet";
            if (temsilciFilter === "yok") return varMi === "yok" || varMi === "hayir";
            return true;
        });
    }, [branches, temsilciSearch, temsilciFilter, tables]);

    const temsilciStats = useMemo(() => {
        let varCount = 0;
        let yokCount = 0;
        let tasdikliCount = 0;
        branches.forEach(b => {
            const bData = tables?.sporDaliTemsilcileri?.[b] || {};
            if (bData.varMi === "var" || bData.varMi === "evet") varCount++;
            if (bData.varMi === "yok" || bData.varMi === "hayir") yokCount++;
            if (bData.faaliyetTasdik === "tasdikli" || bData.faaliyetTasdik === "evet") tasdikliCount++;
        });
        return { varCount, yokCount, tasdikliCount };
    }, [branches, tables]);

    const updateTableField = useCallback((path: string[], value: any) => {
        setLocalAuditData((prev: any) => {
            const copy = JSON.parse(JSON.stringify(prev || {}));
            if (!copy.istenecekTablolar) copy.istenecekTablolar = {};
            
            let curr = copy.istenecekTablolar;
            for (let i = 0; i < path.length - 1; i++) {
                const p = path[i];
                if (!curr[p]) curr[p] = {};
                curr = curr[p];
            }
            curr[path[path.length - 1]] = value;
            return copy;
        });
    }, [setLocalAuditData]);

    // İnline Giriş Durumları
    const [newBranchInput, setNewBranchInput] = useState("");
    const [newFacilityInput, setNewFacilityInput] = useState("");
    const [newSporcuInput, setNewSporcuInput] = useState("");
    const [newHakemInput, setNewHakemInput] = useState("");
    const [newKulupInput, setNewKulupInput] = useState("");
    const [newGenclikInput, setNewGenclikInput] = useState("");
    const [newPersonelInput, setNewPersonelInput] = useState("");
    const [newGiderInput, setNewGiderInput] = useState("");
    const [newGelirInput, setNewGelirInput] = useState("");
    const [newOzelIdareInput, setNewOzelIdareInput] = useState("");
    const [newSponsorInput, setNewSponsorInput] = useState("");
    // 6- Personel Alt Tablo Listeleri
    const [newIlceRowInput, setNewIlceRowInput] = useState<Record<string, string>>({});
    const [newYurtRowInput, setNewYurtRowInput] = useState<Record<string, string>>({});
    const [newGmRowInput, setNewGmRowInput] = useState<Record<string, string>>({});

    const getIlceList = (): Array<{ id: string; name: string; rows: Record<string, any>; customRows?: string[] }> => {
        const list = tables?.personelDurumu?.ilcePersonelList;
        if (Array.isArray(list) && list.length > 0) return list;
        return [{ id: "ilce_1", name: "", rows: {}, customRows: [] }];
    };

    const getYurtList = (): Array<{ id: string; name: string; kapasite?: string; rows: Record<string, any>; customRows?: string[] }> => {
        const list = tables?.personelDurumu?.yurtPersonelList;
        if (Array.isArray(list) && list.length > 0) return list;
        return [{ id: "yurt_1", name: "", kapasite: "", rows: {}, customRows: [] }];
    };

    const getGmList = (): Array<{ id: string; name: string; rows: Record<string, any>; customRows?: string[] }> => {
        const list = tables?.personelDurumu?.genclikMerkeziList;
        if (Array.isArray(list) && list.length > 0) return list;
        return [{ id: "gm_1", name: "", rows: {}, customRows: [] }];
    };

    const updateIlceField = (idx: number, field: string, val: any) => {
        const currentList = [...getIlceList()];
        if (!currentList[idx]) currentList[idx] = { id: `ilce_${Date.now()}`, name: "", rows: {}, customRows: [] };
        currentList[idx] = { ...currentList[idx], [field]: val };
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
    };

    const updateIlceRowVal = (idx: number, rowKey: string, colKey: string, val: string) => {
        const currentList = [...getIlceList()];
        if (!currentList[idx]) currentList[idx] = { id: `ilce_${Date.now()}`, name: "", rows: {}, customRows: [] };
        const rows = { ...(currentList[idx].rows || {}) };
        const rowData = { ...(rows[rowKey] || {}) };
        rowData[colKey] = val;
        rows[rowKey] = rowData;
        currentList[idx] = { ...currentList[idx], rows };
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
    };

    const handleAddIlceCustomRow = (idx: number, rName: string) => {
        const trimmed = rName.trim();
        if (!trimmed) return;
        const currentList = [...getIlceList()];
        const cRows = currentList[idx]?.customRows || [];
        if (cRows.includes(trimmed)) {
            toast.error("Bu unvan zaten mevcut.");
            return;
        }
        currentList[idx] = { ...currentList[idx], customRows: [...cRows, trimmed] };
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
        setNewIlceRowInput(prev => ({ ...prev, [idx]: "" }));
        toast.success(`"${trimmed}" unvanı eklendi.`);
        onSave();
    };

    const handleRemoveIlceCustomRow = (idx: number, rName: string) => {
        const currentList = [...getIlceList()];
        const cRows = (currentList[idx]?.customRows || []).filter(r => r !== rName);
        currentList[idx] = { ...currentList[idx], customRows: cRows };
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
        toast.success(`"${rName}" unvanı kaldırıldı.`);
        onSave();
    };

    const handleAddIlce = () => {
        const name = window.prompt("Yeni İlçe Müdürlüğü adını giriniz (Örn: İpekyolu):");
        if (!name) return;
        const currentList = [...getIlceList()];
        currentList.push({ id: `ilce_${Date.now()}`, name: name.trim(), rows: {}, customRows: [] });
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
        toast.success(`"${name}" İlçe Müdürlüğü tablosu eklendi.`);
        onSave();
    };

    const handleRemoveIlce = (idx: number) => {
        const currentList = [...getIlceList()];
        if (currentList.length <= 1) {
            toast.error("En az bir İlçe Müdürlüğü tablosu bulunmalıdır.");
            return;
        }
        if (!window.confirm("Bu İlçe Müdürlüğü tablosunu silmek istediğinize emin misiniz?")) return;
        currentList.splice(idx, 1);
        updateTableField(["personelDurumu", "ilcePersonelList"], currentList);
        toast.success("İlçe tablosu kaldırıldı.");
        onSave();
    };

    // Yurt Helpers
    const updateYurtField = (idx: number, field: string, val: any) => {
        const currentList = [...getYurtList()];
        if (!currentList[idx]) currentList[idx] = { id: `yurt_${Date.now()}`, name: "", kapasite: "", rows: {}, customRows: [] };
        currentList[idx] = { ...currentList[idx], [field]: val };
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
    };

    const updateYurtRowVal = (idx: number, rowKey: string, colKey: string, val: string) => {
        const currentList = [...getYurtList()];
        if (!currentList[idx]) currentList[idx] = { id: `yurt_${Date.now()}`, name: "", kapasite: "", rows: {}, customRows: [] };
        const rows = { ...(currentList[idx].rows || {}) };
        const rowData = { ...(rows[rowKey] || {}) };
        rowData[colKey] = val;
        rows[rowKey] = rowData;
        currentList[idx] = { ...currentList[idx], rows };
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
    };

    const handleAddYurtCustomRow = (idx: number, rName: string) => {
        const trimmed = rName.trim();
        if (!trimmed) return;
        const currentList = [...getYurtList()];
        const cRows = currentList[idx]?.customRows || [];
        if (cRows.includes(trimmed)) {
            toast.error("Bu unvan zaten mevcut.");
            return;
        }
        currentList[idx] = { ...currentList[idx], customRows: [...cRows, trimmed] };
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
        setNewYurtRowInput(prev => ({ ...prev, [idx]: "" }));
        toast.success(`"${trimmed}" unvanı eklendi.`);
        onSave();
    };

    const handleRemoveYurtCustomRow = (idx: number, rName: string) => {
        const currentList = [...getYurtList()];
        const cRows = (currentList[idx]?.customRows || []).filter(r => r !== rName);
        currentList[idx] = { ...currentList[idx], customRows: cRows };
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
        toast.success(`"${rName}" unvanı kaldırıldı.`);
        onSave();
    };

    const handleAddYurt = () => {
        const name = window.prompt("Yeni Yurt Müdürlüğü adını giriniz (Örn: Süleyman Şah):");
        if (!name) return;
        const currentList = [...getYurtList()];
        currentList.push({ id: `yurt_${Date.now()}`, name: name.trim(), kapasite: "", rows: {}, customRows: [] });
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
        toast.success(`"${name}" Yurt Müdürlüğü tablosu eklendi.`);
        onSave();
    };

    const handleRemoveYurt = (idx: number) => {
        const currentList = [...getYurtList()];
        if (currentList.length <= 1) {
            toast.error("En az bir Yurt Müdürlüğü tablosu bulunmalıdır.");
            return;
        }
        if (!window.confirm("Bu Yurt Müdürlüğü tablosunu silmek istediğinize emin misiniz?")) return;
        currentList.splice(idx, 1);
        updateTableField(["personelDurumu", "yurtPersonelList"], currentList);
        toast.success("Yurt tablosu kaldırıldı.");
        onSave();
    };

    // Gençlik Merkezi Helpers
    const updateGmField = (idx: number, field: string, val: any) => {
        const currentList = [...getGmList()];
        if (!currentList[idx]) currentList[idx] = { id: `gm_${Date.now()}`, name: "", rows: {}, customRows: [] };
        currentList[idx] = { ...currentList[idx], [field]: val };
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
    };

    const updateGmRowVal = (idx: number, rowKey: string, colKey: string, val: string) => {
        const currentList = [...getGmList()];
        if (!currentList[idx]) currentList[idx] = { id: `gm_${Date.now()}`, name: "", rows: {}, customRows: [] };
        const rows = { ...(currentList[idx].rows || {}) };
        const rowData = { ...(rows[rowKey] || {}) };
        rowData[colKey] = val;
        rows[rowKey] = rowData;
        currentList[idx] = { ...currentList[idx], rows };
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
    };

    const handleAddGmCustomRow = (idx: number, rName: string) => {
        const trimmed = rName.trim();
        if (!trimmed) return;
        const currentList = [...getGmList()];
        const cRows = currentList[idx]?.customRows || [];
        if (cRows.includes(trimmed)) {
            toast.error("Bu unvan zaten mevcut.");
            return;
        }
        currentList[idx] = { ...currentList[idx], customRows: [...cRows, trimmed] };
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
        setNewGmRowInput(prev => ({ ...prev, [idx]: "" }));
        toast.success(`"${trimmed}" unvanı eklendi.`);
        onSave();
    };

    const handleRemoveGmCustomRow = (idx: number, rName: string) => {
        const currentList = [...getGmList()];
        const cRows = (currentList[idx]?.customRows || []).filter(r => r !== rName);
        currentList[idx] = { ...currentList[idx], customRows: cRows };
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
        toast.success(`"${rName}" unvanı kaldırıldı.`);
        onSave();
    };

    const handleAddGm = () => {
        const name = window.prompt("Yeni Gençlik Merkezi adını giriniz (Örn: Tuşba):");
        if (!name) return;
        const currentList = [...getGmList()];
        currentList.push({ id: `gm_${Date.now()}`, name: name.trim(), rows: {}, customRows: [] });
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
        toast.success(`"${name}" Gençlik Merkezi tablosu eklendi.`);
        onSave();
    };

    const handleRemoveGm = (idx: number) => {
        const currentList = [...getGmList()];
        if (currentList.length <= 1) {
            toast.error("En az bir Gençlik Merkezi tablosu bulunmalıdır.");
            return;
        }
        if (!window.confirm("Bu Gençlik Merkezi tablosunu silmek istediğinize emin misiniz?")) return;
        currentList.splice(idx, 1);
        updateTableField(["personelDurumu", "genclikMerkeziList"], currentList);
        toast.success("Gençlik Merkezi tablosu kaldırıldı.");
        onSave();
    };


    // Evrensel Özel Satır Ekleme / Silme
    const handleAddCustomRow = (tableKey: string, rowName: string) => {
        const trimmed = rowName.trim();
        if (!trimmed) {
            toast.error("Lütfen bir satır/gösterge adı giriniz.");
            return;
        }
        const currentList: string[] = Array.isArray(tables?.[tableKey]) ? tables[tableKey] : [];
        if (currentList.includes(trimmed)) {
            toast.error(`"${trimmed}" zaten tabloda mevcut.`);
            return;
        }
        const updated = [...currentList, trimmed];
        updateTableField([tableKey], updated);
        toast.success(`"${trimmed}" satırı eklendi.`);
        onSave();
    };

    const handleRemoveCustomRow = (tableKey: string, rowName: string) => {
        if (!window.confirm(`"${rowName}" satırını tablodan silmek istediğinize emin misiniz?`)) return;
        const currentList: string[] = Array.isArray(tables?.[tableKey]) ? tables[tableKey] : [];
        const updated = currentList.filter(r => r !== rowName);
        updateTableField([tableKey], updated);
        toast.success(`"${rowName}" satırı kaldırıldı.`);
        onSave();
    };

    // Dinamik Branş Ekleme / Çıkarma
    const handleAddBranchName = (inputName?: string) => {
        const nameToUse = (inputName || newBranchInput).trim().toUpperCase();
        if (!nameToUse) {
            toast.error("Lütfen bir spor branşı adı giriniz.");
            return;
        }
        if (branches.includes(nameToUse)) {
            toast.error(`"${nameToUse}" branşı zaten listede mevcut.`);
            return;
        }
        const updated = [...branches, nameToUse];
        updateTableField(["customBranches"], updated);
        setNewBranchInput("");
        toast.success(`"${nameToUse}" branşı tabloya eklendi.`);
        onSave();
    };

    const handleAddBranch = () => {
        const input = window.prompt("Eklenecek yeni spor branşının adını giriniz:");
        if (input) handleAddBranchName(input);
    };

    const handleRemoveBranch = (br: string) => {
        if (branches.length <= 1) {
            toast.error("En az bir spor branşı bulunmalıdır.");
            return;
        }
        if (!window.confirm(`"${br}" branşını tablolardan silmek istediğinize emin misiniz?`)) return;
        const updated = branches.filter(b => b !== br);
        updateTableField(["customBranches"], updated);
        toast.success(`"${br}" branşı silindi.`);
        onSave();
    };

    const handleResetBranches = () => {
        if (!window.confirm("Branş listesini orijinal 35 branşa sıfırlamak istiyor musunuz?")) return;
        updateTableField(["customBranches"], DEFAULT_BRANCHES);
        toast.success("Branş listesi varsayılana sıfırlandı.");
        onSave();
    };

    // Dinamik Tesis Türü Ekleme / Çıkarma
    const handleAddFacilityName = (inputName?: string) => {
        const nameToUse = (inputName || newFacilityInput).trim().toUpperCase();
        if (!nameToUse) {
            toast.error("Lütfen bir tesis türü adı giriniz.");
            return;
        }
        if (facilityTypes.includes(nameToUse)) {
            toast.error(`"${nameToUse}" tesis türü zaten mevcut.`);
            return;
        }
        const updated = [...facilityTypes, nameToUse];
        updateTableField(["customFacilities"], updated);
        setNewFacilityInput("");
        toast.success(`"${nameToUse}" tesis türü tabloya eklendi.`);
        onSave();
    };

    const handleAddFacility = () => {
        const input = window.prompt("Eklenecek yeni tesis türünü giriniz:");
        if (input) handleAddFacilityName(input);
    };

    const handleRemoveFacility = (fac: string) => {
        if (facilityTypes.length <= 1) {
            toast.error("En az bir tesis türü bulunmalıdır.");
            return;
        }
        if (!window.confirm(`"${fac}" tesis türünü tablodan silmek istediğinize emin misiniz?`)) return;
        const updated = facilityTypes.filter(f => f !== fac);
        updateTableField(["customFacilities"], updated);
        toast.success(`"${fac}" tesis türü silindi.`);
        onSave();
    };

    const handleResetFacilities = () => {
        if (!window.confirm("Tesis listesini orijinal 21 türe sıfırlamak istiyor musunuz?")) return;
        updateTableField(["customFacilities"], DEFAULT_FACILITY_TYPES);
        toast.success("Tesis türleri varsayılana sıfırlandı.");
        onSave();
    };

    // Dinamik Ek Madde Ekleme / Çıkarma
    const handleAddCustomMadde = () => {
        const nextNum = 17 + customMaddeler.length;
        const titlePrompt = window.prompt(`${nextNum}. Madde için konu başlığı giriniz:`, `Ek İnceleme / Bilgi Talebi (${nextNum})`);
        if (titlePrompt === null) return;
        const newMadde = {
            id: `cm_${Date.now()}`,
            num: String(nextNum),
            title: titlePrompt.trim() || `Ek Konu (${nextNum})`,
            desc: "İl Müdürlüğünden talep edilecek resmi belge, onay veya açıklama konusu.",
            answer: ""
        };
        const updated = [...customMaddeler, newMadde];
        updateTableField(["customMaddeler"], updated);
        toast.success(`${nextNum}. Madde eklendi.`);
        onSave();
    };

    const handleRemoveCustomMadde = (id: string) => {
        if (!window.confirm("Bu ek talep maddesini silmek istediğinize emin misiniz?")) return;
        const updated = customMaddeler.filter(m => m.id !== id);
        const renumbered = updated.map((m, idx) => ({ ...m, num: String(17 + idx) }));
        updateTableField(["customMaddeler"], renumbered);
        toast.success("Madde silindi.");
        onSave();
    };

    const handleUpdateCustomMadde = (id: string, field: string, val: string) => {
        const updated = customMaddeler.map(m => m.id === id ? { ...m, [field]: val } : m);
        updateTableField(["customMaddeler"], updated);
    };

    const handleSave = async () => {
        const updated = {
            ...localAuditData,
            istenecekTablolar: {
                ...tables,
                meta: {
                    il: ilAdi,
                    startYear,
                    endYear,
                    years,
                    updatedAt: new Date().toISOString()
                }
            }
        };
        setLocalAuditData(updated);
        await onSave(updated);
        toast.success("Özet tablolar başarıyla kaydedildi.");
    };

    const handleDownloadDocx = async (mode: 'full' | 'blank') => {
        setIsExportingDocx(true);
        try {
            const dataToExport = mode === 'blank' ? {} : (tables || {});
            await generateOzetTablolarDocx({
                ilAdi: ilAdi.trim() || "VAN",
                denetimDonemi: `${startYear} - ${endYear}`,
                years: years,
                tables: dataToExport,
                mufettisAdi: profile?.full_name || "",
                mufettisUnvani: "Bakanlık Müfettişi",
                scope: "reports",
                path: selectedReport?.id || ""
            });
            toast.success("Özet Bilgiler Word belgesi oluşturuldu.");
        } catch (err: any) {
            toast.error(err.message || "Word belgesi oluşturulamadı.");
        } finally {
            setIsExportingDocx(false);
        }
    };

    const handleDownloadExcel = async (isBlank: boolean) => {
        try {
            setIsExportingExcel(true);
            await exportAuditSummaryExcel(
                ilAdi,
                startYear,
                endYear,
                branches,
                facilityTypes,
                tables,
                isBlank
            );
            toast.success(isBlank ? "Boş Excel veri toplama şablonu indirildi." : "Mevcut veriler Excel olarak indirildi.");
        } catch (err: any) {
            toast.error("Excel oluşturulurken bir hata oluştu: " + (err?.message || err));
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
        const toastId = toast.loading("Excel dosyası okunuyor ve sisteme aktarılıyor...");
        try {
            const result = await parseAuditSummaryExcel(file, startYear, endYear, tables);
            
            const updated = {
                ...localAuditData,
                istenecekTablolar: {
                    ...result.updatedTables,
                    meta: {
                        ...(localAuditData?.istenecekTablolar?.meta || {}),
                        il: ilAdi,
                        startYear,
                        endYear,
                        years,
                        updatedAt: new Date().toISOString()
                    }
                }
            };

            setLocalAuditData(updated);
            await onSave(updated);
            toast.success(`${ilAdi || "İl"} verileri Excel'den başarıyla aktarıldı ve kalıcı kaydedildi! (${result.summary})`, { id: toastId, duration: 5000 });
        } catch (err: any) {
            toast.error(err?.message || "Excel içe aktarılırken bir hata oluştu.", { id: toastId });
        } finally {
            setIsImportingExcel(false);
            if (excelFileInputRef.current) {
                excelFileInputRef.current.value = "";
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleResetData = async () => {
        const resetObj = {
            ...localAuditData,
            istenecekTablolar: {
                meta: {
                    ...(localAuditData?.istenecekTablolar?.meta || {}),
                    il: ilAdi,
                    startYear,
                    endYear,
                    years,
                    updatedAt: new Date().toISOString()
                }
            }
        };
        setLocalAuditData(resetObj);
        await onSave(resetObj);
        setShowResetModal(false);
        toast.success("İstenecek tablo verileri başarıyla sıfırlandı.");
    };

    // Ana Kategori Gruplaması (Her bir buton ilgili 3-4 tabloyu birlikte açar)
    const CATEGORIES = [
        { 
            id: "all", 
            label: "Tümü", 
            badge: "16 Konu / 19 Tablo", 
            icon: Table,
            sectionIds: ["sporcu", "antrenor", "hakem_kulup", "genclik", "personel", "mali", "tesisler", "kaynak_nakit", "aciklamalar"]
        },
        { 
            id: "spor", 
            label: "1. Spor Faaliyetleri & Kulüpler", 
            badge: "Tablo 1 - 4", 
            icon: Award,
            sectionIds: ["sporcu", "antrenor", "hakem_kulup"]
        },
        { 
            id: "personel_genclik", 
            label: "2. Personel & Gençlik", 
            badge: "Tablo 5 - 6 (4 Alt Tablo)", 
            icon: Users,
            sectionIds: ["genclik", "personel"]
        },
        { 
            id: "mali", 
            label: "3. Mali Durum, Gelir & Bütçe", 
            badge: "Tablo 7 - 11", 
            icon: DollarSign,
            sectionIds: ["mali", "kaynak_nakit"]
        },
        { 
            id: "tesis_idari", 
            label: "4. Tesisler, Taşınmaz & İnceleme", 
            badge: "Tablo 9, 12 - 16", 
            icon: Building2,
            sectionIds: ["tesisler", "aciklamalar"]
        }
    ];

    const isSectionVisible = (secId: string) => {
        if (activeSection === "all") return true;
        const cat = CATEGORIES.find(c => c.id === activeSection);
        if (cat) {
            return cat.sectionIds.includes(secId);
        }
        return activeSection === secId;
    };

    const showCards = viewMode === "card";
    const showTable = viewMode === "table";
    const isAuto = viewMode === "auto";

    return (
        <div className="flex flex-col gap-5 pb-16 print:p-0 print:m-0">
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 20mm;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                    }
                }
            `}</style>
            {/* ÜST ARAÇ ÇUBUĞU */}
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shrink-0">
                        <Table size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-slate-100 flex flex-wrap items-center gap-1.5 sm:gap-2 leading-snug">
                            <span>İstenecek Tablo ve Özet Bilgiler</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                16 Konu / 19 Tablo
                            </span>
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                            {ilAdi ? `${ilAdi} Gençlik ve Spor İl Müdürlüğü` : "İl Müdürlüğü"} Teftişi Bilgi & İstatistik Tabloları
                        </p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2.5 w-full md:w-auto">
                    {/* Meta Giriş Alanları: İl ve Dönem (Büyütülmüş, Düzenli & Mobil Uyumlu) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
                        {/* İl Seçici / Girişi */}
                        <div className="flex items-center gap-2 h-9 sm:h-10 bg-slate-50 dark:bg-slate-800/90 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-sm w-full">
                            <MapPin size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">İl:</span>
                            <input
                                type="text"
                                value={ilAdi}
                                onChange={(e) => setIlAdi(e.target.value.toUpperCase())}
                                onBlur={() => handleSave()}
                                placeholder="ÖRN: VAN"
                                className="h-7 sm:h-8 flex-1 min-w-0 sm:w-36 px-2 text-xs sm:text-sm font-black uppercase bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner text-center tracking-wide outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                title="Denetlenen il adı (Word ve tablo başlığında yer alır)"
                            />
                        </div>

                        {/* Yıl Seçici */}
                        <div className="flex items-center gap-2 h-9 sm:h-10 bg-slate-50 dark:bg-slate-800/90 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-sm w-full">
                            <Calendar size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Dönem:</span>
                            <div className="flex items-center gap-1 flex-1 justify-center sm:justify-start">
                                <input
                                    type="number"
                                    value={startYear}
                                    onChange={(e) => setStartYear(parseInt(e.target.value) || defaultStartYear)}
                                    className="h-7 sm:h-8 w-18 sm:w-20 px-1 text-xs sm:text-sm font-black text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    min={2000}
                                    max={2040}
                                    title="Başlangıç Yılı"
                                />
                                <span className="font-black text-slate-400 text-xs px-0.5">-</span>
                                <input
                                    type="number"
                                    value={endYear}
                                    onChange={(e) => setEndYear(parseInt(e.target.value) || defaultEndYear)}
                                    className="h-7 sm:h-8 w-18 sm:w-20 px-1 text-xs sm:text-sm font-black text-center bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    min={2000}
                                    max={2040}
                                    title="Bitiş Yılı"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Gizli Excel File Input */}
                    <input
                        type="file"
                        ref={excelFileInputRef}
                        onChange={handleExcelFileSelected}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />

                    {/* Butonlar Grubu: Mobilde dengeli sarılan ve tam oturan yapı */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* İndirme Açılır Menüsü */}
                        <div className="relative">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDownloadMenuOpen(prev => !prev)}
                                className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-sm px-2.5 sm:px-3 justify-center gap-1.5"
                                title="Excel ve Word formatında boş şablon veya dolu rapor indirme seçenekleri"
                            >
                                <Download size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
                                <span>İndir / Şablonlar</span>
                                <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${downloadMenuOpen ? "rotate-180" : ""}`} />
                            </Button>

                            {downloadMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setDownloadMenuOpen(false)} />
                                    <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            Excel Şablon & Çıktıları
                                        </div>
                                        <button
                                            onClick={() => {
                                                setDownloadMenuOpen(false);
                                                handleDownloadExcel(true);
                                            }}
                                            disabled={isExportingExcel}
                                            className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
                                        >
                                            <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                                            <div>
                                                <div className="font-bold">Boş Excel Şablonu (.xlsx)</div>
                                                <div className="text-[10px] text-slate-400 font-normal">İl Müdürlüğüne gönderilecek boş veri tablosu</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDownloadMenuOpen(false);
                                                handleDownloadExcel(false);
                                            }}
                                            disabled={isExportingExcel}
                                            className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
                                        >
                                            <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                                            <div>
                                                <div className="font-bold">Excel Veri Çizelgesi (.xlsx)</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Mevcut tüm dolu verilerle Excel çıktısı</div>
                                            </div>
                                        </button>

                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                                        <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            Word Rapor & Şablonları
                                        </div>
                                        <button
                                            onClick={() => {
                                                setDownloadMenuOpen(false);
                                                handleDownloadDocx('full');
                                            }}
                                            disabled={isExportingDocx}
                                            className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors"
                                        >
                                            <FileText size={15} className="text-blue-600 shrink-0" />
                                            <div>
                                                <div className="font-bold">Word Denetim Raporu (.docx)</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Tüm verilerin işlendiği resmi Word raporu</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDownloadMenuOpen(false);
                                                handleDownloadDocx('blank');
                                            }}
                                            disabled={isExportingDocx}
                                            className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                                        >
                                            <Download size={15} className="text-slate-500 shrink-0" />
                                            <div>
                                                <div className="font-bold">Boş Word Şablonu (.docx)</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Resmi yazı ekine konulacak boş şablon</div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Doldurulan Excel'i Yükle */}
                        <Button
                            size="sm"
                            onClick={handleExcelUploadClick}
                            disabled={isImportingExcel || isSaving}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 px-2.5 sm:px-3 justify-center gap-1.5"
                            title="İl Müdürlüğünün doldurduğu Excel dosyasını seçip doğrudan sisteme aktarır ve kalıcı olarak kaydeder"
                        >
                            {isImportingExcel ? <Loader2 size={13} className="animate-spin shrink-0" /> : <Upload size={13} className="shrink-0" />}
                            <span>Excel Yükle</span>
                        </Button>

                        {/* HTML Aç */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open('/mufettis_ozet_tablolar.html', '_blank')}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-semibold border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 px-2.5 sm:px-3 justify-center gap-1.5"
                            title="Bağımsız interaktif HTML formunu yeni pencerede/sekmede açar"
                        >
                            <ExternalLink size={13} className="shrink-0" />
                            <span>HTML Aç</span>
                        </Button>

                        {/* Yazdır */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePrint}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 px-2.5 sm:px-3 justify-center gap-1.5"
                        >
                            <Printer size={13} className="shrink-0" />
                            <span>Yazdır</span>
                        </Button>

                        {/* Görünüm Modu Değiştirici (Masaüstü Tablo vs Mobil Kart) */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewMode(prev => prev === "auto" ? "card" : prev === "card" ? "table" : "auto")}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 sm:px-3 justify-center gap-1.5"
                            title="Görünüm: Otomatik (Mobilde Kart) / Zorunlu Tablo / Zorunlu Kartlar"
                        >
                            {viewMode === "card" ? (
                                <>
                                    <LayoutGrid size={13} className="text-blue-600 shrink-0" />
                                    <span>Kartlar</span>
                                </>
                            ) : viewMode === "table" ? (
                                <>
                                    <Table size={13} className="text-indigo-600 shrink-0" />
                                    <span>Tablo</span>
                                </>
                            ) : (
                                <>
                                    <LayoutGrid size={13} className="text-slate-500 shrink-0" />
                                    <span>Görünüm: Oto</span>
                                </>
                            )}
                        </Button>

                        {/* Kaydet */}
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 px-3 sm:px-4 justify-center gap-1.5"
                        >
                            {isSaving ? <Loader2 size={13} className="animate-spin shrink-0" /> : <Save size={13} className="shrink-0" />}
                            <span>Kaydet</span>
                        </Button>

                        {/* Sıfırla */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowResetModal(true)}
                            className="rounded-xl h-8 sm:h-9 text-[11px] sm:text-xs font-bold border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 sm:px-3 justify-center gap-1.5"
                            title="Tüm tablo verilerini sıfırlar"
                        >
                            <RotateCcw size={13} className="shrink-0" />
                            <span>Sıfırla</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* SEKSİYON HIZLI GEÇİŞ BUTONLARI (GRUPLU KATEGORİLER) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 print:hidden scroll-smooth touch-pan-x [&::-webkit-scrollbar]:hidden">
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isActive = activeSection === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveSection(cat.id)}
                            className={`px-3 py-2 rounded-2xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                                isActive 
                                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md border-transparent scale-[1.01]"
                                    : "bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                            }`}
                        >
                            <Icon size={14} className={`shrink-0 ${isActive ? "text-blue-400 dark:text-blue-600" : "text-slate-400"}`} />
                            <span>{cat.label}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                isActive 
                                    ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900" 
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            }`}>
                                {cat.badge}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* SIFIRLAMA ONAY MODALI */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
                        <div className="flex items-center gap-3.5 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/40">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Tablo Verilerini Sıfırla</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Bu işlem geri alınamaz</p>
                            </div>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                            İl Müdürlüğünden istenecek tüm özet istatistik tabloları (sporcu, personel, bütçe, gelir/gider, tesis ve ilçe verileri) sıfırlanacaktır. Devam etmek istiyor musunuz?
                        </p>

                        <div className="flex items-center justify-end gap-2.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowResetModal(false)}
                                className="rounded-xl px-4 text-xs font-semibold"
                            >
                                İptal
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleResetData}
                                className="rounded-xl px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
                            >
                                Evet, Tümünü Sıfırla
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1- SPORCU SAYILARI */}
            {isSectionVisible("sporcu") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">1</span>
                            SPORCU SAYILARI
                        </h4>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 italic">(1),(2) Branş belirtilecek - Ek 1</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const input = window.prompt("Yeni sporcu göstergesi adını giriniz:");
                                    if (input) handleAddCustomRow("customSporcuRows", input);
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                title="Yeni gösterge satırı ekler"
                            >
                                <Plus size={12} /> Satır Ekle
                            </button>
                        </div>
                    </div>

                    {/* Masaüstü Tablo Görünümü */}
                    {(showTable || isAuto) && (
                        <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                        <th className="p-2.5 font-bold border border-slate-200 dark:border-slate-700 min-w-[240px]">GÖSTERGE</th>
                                        {years.map(y => (
                                            <th key={y} className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[70px]">{y}</th>
                                        ))}
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { key: "lisansli", label: "Lisanslı Sporcu Sayısı (Bayan/Bay)" },
                                        { key: "faal", label: "Faal (Bayan/Bay)" },
                                        { key: "milli", label: "Milli Olmuş Sporcu Sayısı" },
                                        { key: "turkiye1", label: "Türkiye 1'incisi Olmuş Sporcu Sayısı (1)" },
                                        { key: "ulusalDerece", label: "Ulusal Derece Alan Sporcu Sayısı (1)" },
                                        { key: "uluslararasiDerece", label: "Uluslararası Derece Alan Sporcu Sayısı (2)" }
                                    ].map((row, idx) => (
                                        <tr key={row.key} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                            <td className="p-2 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{row.label}</td>
                                            {years.map(y => (
                                                <td key={y} className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={tables?.sporcuSayilari?.[row.key]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["sporcuSayilari", row.key, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 px-1 rounded bg-transparent hover:bg-blue-50/50 focus:bg-white dark:focus:bg-slate-800 border-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-850 dark:text-slate-100"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            ))}
                                            <td className="border border-slate-200 dark:border-slate-700"></td>
                                        </tr>
                                    ))}
                                    {(tables?.customSporcuRows || []).map((cRow: string, idx: number) => (
                                        <tr key={cRow} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                            <td className="p-2 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{cRow}</td>
                                            {years.map(y => (
                                                <td key={y} className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={tables?.sporcuSayilari?.[cRow]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["sporcuSayilari", cRow, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 px-1 rounded bg-transparent hover:bg-blue-50/50 focus:bg-white dark:focus:bg-slate-800 border-none focus:ring-1 focus:ring-blue-500 font-medium text-xs text-slate-850 dark:text-slate-100"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            ))}
                                            <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customSporcuRows", cRow)}
                                                    className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    title={`"${cRow}" satırını kaldır`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                <input
                                                    type="text"
                                                    value={newSporcuInput}
                                                    onChange={(e) => setNewSporcuInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            handleAddCustomRow("customSporcuRows", newSporcuInput);
                                                            setNewSporcuInput("");
                                                        }
                                                    }}
                                                    placeholder="Yeni gösterge yazınız..."
                                                    className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </td>
                                        <td colSpan={years.length} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleAddCustomRow("customSporcuRows", newSporcuInput);
                                                    setNewSporcuInput("");
                                                }}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus size={13} /> Satır Ekle
                                            </button>
                                        </td>
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleAddCustomRow("customSporcuRows", newSporcuInput);
                                                    setNewSporcuInput("");
                                                }}
                                                className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                title="Satır Ekle"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Mobil Kart / Akordiyon Görünümü */}
                    {(showCards || isAuto) && (
                        <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                            {[
                                { key: "lisansli", label: "Lisanslı Sporcu Sayısı (Bayan/Bay)" },
                                { key: "faal", label: "Faal (Bayan/Bay)" },
                                { key: "milli", label: "Milli Olmuş Sporcu Sayısı" },
                                { key: "turkiye1", label: "Türkiye 1'incisi Olmuş Sporcu Sayısı (1)" },
                                { key: "ulusalDerece", label: "Ulusal Derece Alan Sporcu Sayısı (1)" },
                                { key: "uluslararasiDerece", label: "Uluslararası Derece Alan Sporcu Sayısı (2)" },
                                ...(tables?.customSporcuRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                            ].map(row => (
                                <div key={row.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{row.label}</span>
                                        {row.isCustom && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomRow("customSporcuRows", row.key)}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {years.map(y => (
                                            <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                <input
                                                    type="text"
                                                    value={tables?.sporcuSayilari?.[row.key]?.[y] || ""}
                                                    onChange={(e) => updateTableField(["sporcuSayilari", row.key, y], e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 2- ANTRENÖR DURUMU */}
            {isSectionVisible("antrenor") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">2</span>
                            <div>
                                <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                    ANTRENÖR DURUMU
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                        {branches.length} Branş
                                    </span>
                                </h4>
                                <span className="text-[11px] text-slate-400 italic">Fahri, Kadrolu ve Sözleşmeli Antrenör Dağılımı</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleAddBranch}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                title="Listeye yeni bir spor branşı ekler"
                            >
                                <Plus size={12} /> Branş Ekle
                            </button>
                            {branches.length !== DEFAULT_BRANCHES.length && (
                                <button
                                    type="button"
                                    onClick={handleResetBranches}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Varsayılan 35 branşa sıfırla"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Masaüstü Tablo Görünümü */}
                    {(showTable || isAuto) && (
                        <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto max-h-[480px]`}>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-sm">
                                    <tr className="text-slate-700 dark:text-slate-300">
                                        <th className="p-2.5 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">BRANŞI</th>
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-28">FAHRİ</th>
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-28">KADROLU</th>
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-28">SÖZLEŞMELİ</th>
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-28 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">TOPLAM</th>
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {branches.map((br, idx) => {
                                        const antList = tables?.antrenorDurumu || [];
                                        const item = antList.find((x: any) => x.branch === br) || {};
                                        const fVal = item.fahri || "";
                                        const kVal = item.kadrolu || "";
                                        const sVal = item.sozlesmeli || "";
                                        
                                        const numF = parseInt(fVal) || 0;
                                        const numK = parseInt(kVal) || 0;
                                        const numS = parseInt(sVal) || 0;
                                        const rowTot = (numF || numK || numS) ? (numF + numK + numS) : "";

                                        const updateBranch = (field: string, val: string) => {
                                            const current = [...(tables?.antrenorDurumu || [])];
                                            const foundIdx = current.findIndex((x: any) => x.branch === br);
                                            if (foundIdx >= 0) {
                                                current[foundIdx] = { ...current[foundIdx], [field]: val };
                                            } else {
                                                current.push({ branch: br, [field]: val });
                                            }
                                            updateTableField(["antrenorDurumu"], current);
                                        };

                                        return (
                                            <tr key={br} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                                <td className="p-2 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{br}</td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={fVal}
                                                        onChange={(e) => updateBranch("fahri", e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={kVal}
                                                        onChange={(e) => updateBranch("kadrolu", e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={sVal}
                                                        onChange={(e) => updateBranch("sozlesmeli", e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center font-bold text-xs bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                                                    {rowTot || "-"}
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBranch(br)}
                                                        className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                        title={`"${br}" branşını kaldır`}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                <input
                                                    type="text"
                                                    value={newBranchInput}
                                                    onChange={(e) => setNewBranchInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleAddBranchName();
                                                    }}
                                                    placeholder="Yeni branş adı yazınız..."
                                                    className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                                                />
                                            </div>
                                        </td>
                                        <td colSpan={4} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                            <button
                                                type="button"
                                                onClick={() => handleAddBranchName()}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus size={13} /> Branş Ekle
                                            </button>
                                        </td>
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleAddBranchName()}
                                                className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                title="Yeni Branş Ekle"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100">
                                        <td className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">GENEL TOPLAM:</td>
                                        <td className="p-2.5 border border-slate-200 dark:border-slate-700 text-center">
                                            {(tables?.antrenorDurumu || []).reduce((acc: number, curr: any) => acc + (parseInt(curr.fahri) || 0), 0)}
                                        </td>
                                        <td className="p-2.5 border border-slate-200 dark:border-slate-700 text-center">
                                            {(tables?.antrenorDurumu || []).reduce((acc: number, curr: any) => acc + (parseInt(curr.kadrolu) || 0), 0)}
                                        </td>
                                        <td className="p-2.5 border border-slate-200 dark:border-slate-700 text-center">
                                            {(tables?.antrenorDurumu || []).reduce((acc: number, curr: any) => acc + (parseInt(curr.sozlesmeli) || 0), 0)}
                                        </td>
                                        <td className="p-2.5 border border-slate-200 dark:border-slate-700 text-center bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                            {(tables?.antrenorDurumu || []).reduce((acc: number, curr: any) => {
                                                return acc + (parseInt(curr.fahri) || 0) + (parseInt(curr.kadrolu) || 0) + (parseInt(curr.sozlesmeli) || 0);
                                            }, 0)}
                                        </td>
                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Mobil Kart Görünümü */}
                    {(showCards || isAuto) && (
                        <div className={`${isAuto ? "block md:hidden" : ""} space-y-2.5 mt-2 max-h-[480px] overflow-y-auto pr-1`}>
                            {branches.map(br => {
                                const antList = tables?.antrenorDurumu || [];
                                const item = antList.find((x: any) => x.branch === br) || {};
                                const fVal = item.fahri || "";
                                const kVal = item.kadrolu || "";
                                const sVal = item.sozlesmeli || "";
                                const numF = parseInt(fVal) || 0;
                                const numK = parseInt(kVal) || 0;
                                const numS = parseInt(sVal) || 0;
                                const rowTot = (numF || numK || numS) ? (numF + numK + numS) : "";

                                const updateBrField = (field: string, val: string) => {
                                    const current = [...(tables?.antrenorDurumu || [])];
                                    const foundIdx = current.findIndex((x: any) => x.branch === br);
                                    if (foundIdx >= 0) {
                                        current[foundIdx] = { ...current[foundIdx], [field]: val };
                                    } else {
                                        current.push({ branch: br, [field]: val });
                                    }
                                    updateTableField(["antrenorDurumu"], current);
                                };

                                return (
                                    <div key={br} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-xs text-slate-850 dark:text-slate-100">{br}</span>
                                            <div className="flex items-center gap-1.5">
                                                {rowTot !== "" && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                                        Toplam: {rowTot}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveBranch(br)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                    title={`"${br}" kaldır`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                                                <span className="text-[9px] font-black text-slate-400 block mb-0.5">FAHRİ</span>
                                                <input
                                                    type="text"
                                                    value={fVal}
                                                    onChange={(e) => updateBrField("fahri", e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100"
                                                />
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                                                <span className="text-[9px] font-black text-slate-400 block mb-0.5">KADROLU</span>
                                                <input
                                                    type="text"
                                                    value={kVal}
                                                    onChange={(e) => updateBrField("kadrolu", e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100"
                                                />
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-center">
                                                <span className="text-[9px] font-black text-slate-400 block mb-0.5">SÖZLEŞMELİ</span>
                                                <input
                                                    type="text"
                                                    value={sVal}
                                                    onChange={(e) => updateBrField("sozlesmeli", e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 3-4 HAKEM & KULÜP */}
            {isSectionVisible("hakem_kulup") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 3- HAKEM DURUMU */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">3</span>
                                HAKEM DURUMU
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 italic">Ek 2</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = window.prompt("Yeni hakem kategorisi giriniz:");
                                        if (input) handleAddCustomRow("customHakemRows", input);
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                    title="Yeni hakem kategorisi ekler"
                                >
                                    <Plus size={12} /> Kategori Ekle
                                </button>
                            </div>
                        </div>

                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                    <th className="p-2.5 font-bold border border-slate-200 dark:border-slate-700">HAKEM KATEGORİSİ</th>
                                    <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-32">SAYI</th>
                                    <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { key: "aday", label: "Aday (1)" },
                                    { key: "bolge", label: "Bölge (1)" },
                                    { key: "milli", label: "Milli (1)" },
                                    { key: "ulusal", label: "Ulusal (1)" },
                                    { key: "uluslararasi", label: "Uluslararası (1)" },
                                    { key: "toplam", label: "TOPLAM" }
                                ].map(r => (
                                    <tr key={r.key} className={r.key === "toplam" ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold" : ""}>
                                        <td className="p-2 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <input
                                                type="text"
                                                value={tables?.hakemDurumu?.[r.key] || ""}
                                                onChange={(e) => updateTableField(["hakemDurumu", r.key], e.target.value)}
                                                onBlur={() => onSave()}
                                                className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                    </tr>
                                ))}
                                {(tables?.customHakemRows || []).map((cRow: string) => (
                                    <tr key={cRow}>
                                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <input
                                                type="text"
                                                value={tables?.hakemDurumu?.[cRow] || ""}
                                                onChange={(e) => updateTableField(["hakemDurumu", cRow], e.target.value)}
                                                onBlur={() => onSave()}
                                                className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomRow("customHakemRows", cRow)}
                                                className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                title={`"${cRow}" kaldır`}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                        <input
                                            type="text"
                                            value={newHakemInput}
                                            onChange={(e) => setNewHakemInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleAddCustomRow("customHakemRows", newHakemInput);
                                                    setNewHakemInput("");
                                                }
                                            }}
                                            placeholder="Yeni kategori yazınız..."
                                            className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customHakemRows", newHakemInput);
                                                setNewHakemInput("");
                                            }}
                                            className="w-full py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={13} /> Ekle
                                        </button>
                                    </td>
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customHakemRows", newHakemInput);
                                                setNewHakemInput("");
                                            }}
                                            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                            title="Ekle"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* 4- KULÜP SAYILARI */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">4</span>
                                KULÜP SAYILARI
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400 italic">Ek 3</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = window.prompt("Yeni kulüp göstergesi giriniz:");
                                        if (input) handleAddCustomRow("customKulupRows", input);
                                    }}
                                    className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                    title="Yeni kulüp göstergesi ekler"
                                >
                                    <Plus size={12} /> Gösterge Ekle
                                </button>
                            </div>
                        </div>

                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                    <th className="p-2.5 font-bold border border-slate-200 dark:border-slate-700">KULÜP GÖSTERGESİ</th>
                                    <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-32">SAYI</th>
                                    <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { key: "faalKulup", label: "Faal Kulüp Sayısı" },
                                    { key: "faalBrans", label: "Faal Branş Sayısı (1)" }
                                ].map(r => (
                                    <tr key={r.key}>
                                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium">{r.label}</td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <input
                                                type="text"
                                                value={tables?.kulupSayilari?.[r.key] || ""}
                                                onChange={(e) => updateTableField(["kulupSayilari", r.key], e.target.value)}
                                                onBlur={() => onSave()}
                                                className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                    </tr>
                                ))}
                                {(tables?.customKulupRows || []).map((cRow: string) => (
                                    <tr key={cRow}>
                                        <td className="p-2 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <input
                                                type="text"
                                                value={tables?.kulupSayilari?.[cRow] || ""}
                                                onChange={(e) => updateTableField(["kulupSayilari", cRow], e.target.value)}
                                                onBlur={() => onSave()}
                                                className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                placeholder="-"
                                            />
                                        </td>
                                        <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomRow("customKulupRows", cRow)}
                                                className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                title={`"${cRow}" kaldır`}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                        <input
                                            type="text"
                                            value={newKulupInput}
                                            onChange={(e) => setNewKulupInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleAddCustomRow("customKulupRows", newKulupInput);
                                                    setNewKulupInput("");
                                                }
                                            }}
                                            placeholder="Yeni gösterge yazınız..."
                                            className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customKulupRows", newKulupInput);
                                                setNewKulupInput("");
                                            }}
                                            className="w-full py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Plus size={13} /> Ekle
                                        </button>
                                    </td>
                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customKulupRows", newKulupInput);
                                                setNewKulupInput("");
                                            }}
                                            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                            title="Ekle"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        <p className="text-[11px] text-slate-400 italic mt-3">
                            * Kulüplerin faal oldukları branşlar ek çizelgede belirtilecektir.
                        </p>
                    </div>
                </div>
            )}

            {/* 5- GENÇLİK HİZMET VE FAALİYETLERİ */}
            {isSectionVisible("genclik") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">5</span>
                            GENÇLİK HİZMET VE FAALİYETLERİ (Gençlik Faaliyetleri Birimi)
                        </h4>
                        <button
                            type="button"
                            onClick={() => {
                                const input = window.prompt("Yeni gençlik faaliyeti göstergesi giriniz:");
                                if (input) handleAddCustomRow("customGenclikRows", input);
                            }}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                            title="Yeni faaliyet göstergesi ekler"
                        >
                            <Plus size={12} /> Faaliyet Ekle
                        </button>
                    </div>

                    {/* Masaüstü Tablo Görünümü */}
                    {(showTable || isAuto) && (
                        <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                        <th className="p-2.5 font-bold border border-slate-200 dark:border-slate-700 min-w-[240px]">FAALİYET TÜRÜ</th>
                                        {years.map(y => (
                                            <th key={y} className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[70px]">{y}</th>
                                        ))}
                                        <th className="p-2.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { key: "merkezSayisi", label: "Gençlik Merkezi Sayısı" },
                                        { key: "kayitliUye", label: "Kayıtlı Üye Sayısı" },
                                        { key: "aktifUye", label: "Aktif Üye Sayısı" },
                                        { key: "ulusalFaaliyet", label: "Ulusal Faaliyetlere Katılan Üye Sayısı" },
                                        { key: "uluslararasiFaaliyet", label: "Uluslararası Faal. Katılan Üye Sayısı" },
                                        { key: "kampGonderilen", label: "Gençlik Kamplarına Gönderilenlerin Sayısı" },
                                        { key: "liderSayisi", label: "Lider sayısı" },
                                        { key: "noktaSayisi", label: "Nokta sayısı" }
                                    ].map((r, idx) => (
                                        <tr key={r.key} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                            <td className="p-2 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                            {years.map(y => (
                                                <td key={y} className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={tables?.genclikHizmetleri?.[r.key]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["genclikHizmetleri", r.key, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            ))}
                                            <td className="border border-slate-200 dark:border-slate-700"></td>
                                        </tr>
                                    ))}
                                    {(tables?.customGenclikRows || []).map((cRow: string, idx: number) => (
                                        <tr key={cRow} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                            <td className="p-2 font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{cRow}</td>
                                            {years.map(y => (
                                                <td key={y} className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <input
                                                        type="text"
                                                        value={tables?.genclikHizmetleri?.[cRow]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["genclikHizmetleri", cRow, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                        placeholder="-"
                                                    />
                                                </td>
                                            ))}
                                            <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customGenclikRows", cRow)}
                                                    className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    title={`"${cRow}" kaldır`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                <input
                                                    type="text"
                                                    value={newGenclikInput}
                                                    onChange={(e) => setNewGenclikInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            handleAddCustomRow("customGenclikRows", newGenclikInput);
                                                            setNewGenclikInput("");
                                                        }
                                                    }}
                                                    placeholder="Yeni gençlik faaliyeti göstergesi yazınız..."
                                                    className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </td>
                                        <td colSpan={years.length} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleAddCustomRow("customGenclikRows", newGenclikInput);
                                                    setNewGenclikInput("");
                                                }}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                            >
                                                <Plus size={13} /> Faaliyet Ekle
                                            </button>
                                        </td>
                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleAddCustomRow("customGenclikRows", newGenclikInput);
                                                    setNewGenclikInput("");
                                                }}
                                                className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                title="Ekle"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Mobil Kart Görünümü */}
                    {(showCards || isAuto) && (
                        <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                            {[
                                { key: "merkezSayisi", label: "Gençlik Merkezi Sayısı" },
                                { key: "kayitliUye", label: "Kayıtlı Üye Sayısı" },
                                { key: "aktifUye", label: "Aktif Üye Sayısı" },
                                { key: "ulusalFaaliyet", label: "Ulusal Faaliyetlere Katılan Üye Sayısı" },
                                { key: "uluslararasiFaaliyet", label: "Uluslararası Faal. Katılan Üye Sayısı" },
                                { key: "kampGonderilen", label: "Gençlik Kamplarına Gönderilenlerin Sayısı" },
                                { key: "liderSayisi", label: "Lider sayısı" },
                                { key: "noktaSayisi", label: "Nokta sayısı" },
                                ...(tables?.customGenclikRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                            ].map(row => (
                                <div key={row.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{row.label}</span>
                                        {row.isCustom && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCustomRow("customGenclikRows", row.key)}
                                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {years.map(y => (
                                            <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                <input
                                                    type="text"
                                                    value={tables?.genclikHizmetleri?.[row.key]?.[y] || ""}
                                                    onChange={(e) => updateTableField(["genclikHizmetleri", row.key, y], e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 6- PERSONEL DURUMU */}
            {isSectionVisible("personel") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-8">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">6</span>
                            PERSONEL DURUMU ({startYear} - {personelYears[personelYears.length - 1] || endYear})
                        </h4>
                        <span className="text-[11px] text-slate-400 italic">4 Alt Kategori & Norm Kadro</span>
                    </div>

                    {/* a-) İL MÜDÜRLÜĞÜ İDARİ PERSONELİ */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                a-) İl Müdürlüğü İdari Personel Açısından Bakıldığında;
                            </h5>
                            <button
                                type="button"
                                onClick={() => {
                                    const input = window.prompt("İl Müdürlüğüne yeni unvan ekleyiniz:");
                                    if (input) handleAddCustomRow("customPersonelRows", input);
                                }}
                                className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                                <Plus size={11} /> Unvan Ekle
                            </button>
                        </div>
                        {/* Masaüstü Tablo Görünümü */}
                        {(showTable || isAuto) && (
                            <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                            <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[240px]">Unvan</th>
                                            {personelYears.map(y => (
                                                <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[65px]">{y}</th>
                                            ))}
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[85px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">Norm Kadro</th>
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {IDARI_PERSONEL_ROWS.map(r => (
                                            <tr key={r.key} className={r.bold ? "bg-blue-50/30 dark:bg-blue-950/20 font-bold" : ""}>
                                                <td className={`p-1.5 border border-slate-200 dark:border-slate-700 ${r.isBullet ? "pl-5 text-slate-600 dark:text-slate-400 italic" : "font-medium"}`}>
                                                    {r.label}
                                                </td>
                                                {personelYears.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.personelDurumu?.idariPersonel?.[r.key]?.[y] || tables?.personelDurumu?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                            onChange={(e) => {
                                                                updateTableField(["personelDurumu", "idariPersonel", r.key, y], e.target.value);
                                                                updateTableField(["personelDurumu", "birlesmeSonrasi", r.key, y], e.target.value);
                                                            }}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                    <input
                                                        type="text"
                                                        value={tables?.personelDurumu?.idariPersonel?.[r.key]?.normKadro || ""}
                                                        onChange={(e) => updateTableField(["personelDurumu", "idariPersonel", r.key, "normKadro"], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="border border-slate-200 dark:border-slate-700"></td>
                                            </tr>
                                        ))}
                                        {(tables?.customPersonelRows || []).map((cRow: string, idx: number) => (
                                            <tr key={cRow} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                                <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                {personelYears.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.personelDurumu?.idariPersonel?.[cRow]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["personelDurumu", "idariPersonel", cRow, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                    <input
                                                        type="text"
                                                        value={tables?.personelDurumu?.idariPersonel?.[cRow]?.normKadro || ""}
                                                        onChange={(e) => updateTableField(["personelDurumu", "idariPersonel", cRow, "normKadro"], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                        placeholder="-"
                                                    />
                                                </td>
                                                <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomRow("customPersonelRows", cRow)}
                                                        className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                        title={`"${cRow}" kaldır`}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                    <input
                                                        type="text"
                                                        value={newPersonelInput}
                                                        onChange={(e) => setNewPersonelInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleAddCustomRow("customPersonelRows", newPersonelInput);
                                                                setNewPersonelInput("");
                                                            }
                                                        }}
                                                        placeholder="Yeni idari unvan yazınız..."
                                                        className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </td>
                                            <td colSpan={personelYears.length + 1} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleAddCustomRow("customPersonelRows", newPersonelInput);
                                                        setNewPersonelInput("");
                                                    }}
                                                    disabled={!newPersonelInput.trim()}
                                                    className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-40 transition-colors"
                                                >
                                                    + Ekle
                                                </button>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleAddCustomRow("customPersonelRows", newPersonelInput);
                                                        setNewPersonelInput("");
                                                    }}
                                                    disabled={!newPersonelInput.trim()}
                                                    className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors mx-auto"
                                                    title="Ekle"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Mobil Kart Görünümü */}
                        {(showCards || isAuto) && (
                            <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                                {[
                                    ...IDARI_PERSONEL_ROWS,
                                    ...(tables?.customPersonelRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                ].map(r => (
                                    <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-xs font-bold text-slate-800 dark:text-slate-100 ${r.bold ? "font-black text-blue-600 dark:text-blue-400" : ""} ${r.isBullet ? "pl-2" : ""}`}>
                                                {r.label}
                                            </span>
                                            {r.isCustom && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customPersonelRows", r.key)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {personelYears.map(y => (
                                                <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                    <input
                                                        type="text"
                                                        value={tables?.personelDurumu?.idariPersonel?.[r.key]?.[y] || tables?.personelDurumu?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                        onChange={(e) => {
                                                            updateTableField(["personelDurumu", "idariPersonel", r.key, y], e.target.value);
                                                            updateTableField(["personelDurumu", "birlesmeSonrasi", r.key, y], e.target.value);
                                                        }}
                                                        onBlur={() => onSave()}
                                                        placeholder="-"
                                                        className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            ))}
                                            <div className="flex flex-col bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                                <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Norm Kadro</span>
                                                <input
                                                    type="text"
                                                    value={tables?.personelDurumu?.idariPersonel?.[r.key]?.normKadro || ""}
                                                    onChange={(e) => updateTableField(["personelDurumu", "idariPersonel", r.key, "normKadro"], e.target.value)}
                                                    onBlur={() => onSave()}
                                                    placeholder="-"
                                                    className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* b-) İLÇE MÜDÜRLÜĞÜ PERSONELİ */}
                    <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                b-) İlçe Müdürlüğü Personeli Açısından Bakıldığında;
                            </h5>
                            <button
                                type="button"
                                onClick={handleAddIlce}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                                <Plus size={12} /> Yeni İlçe Tablosu Ekle
                            </button>
                        </div>

                        {getIlceList().map((ilce, iIdx) => (
                            <div key={ilce.id || iIdx} className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col gap-2">
                                <div className="flex items-center justify-between pb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">İlçe:</span>
                                        <input
                                            type="text"
                                            value={ilce.name}
                                            onChange={(e) => updateIlceField(iIdx, "name", e.target.value)}
                                            onBlur={() => onSave()}
                                            placeholder="... İlçe Müdürlüğü (Örn: İpekyolu)"
                                            className="px-2 py-0.5 text-xs font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-64"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">İlçe Müdürlüğü</span>
                                    </div>
                                    {getIlceList().length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveIlce(iIdx)}
                                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Bu İlçeyi Sil
                                        </button>
                                    )}
                                </div>
                                {/* Masaüstü Tablo Görünümü */}
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                        <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">Unvan</th>
                                                    {personelYears.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[65px]">{y}</th>
                                                    ))}
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[85px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">Norm Kadro</th>
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ILCE_PERSONEL_ROWS.map(r => (
                                                    <tr key={r.key}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{r.label}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={ilce.rows?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateIlceRowVal(iIdx, r.key, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={ilce.rows?.[r.key]?.normKadro || ""}
                                                                onChange={(e) => updateIlceRowVal(iIdx, r.key, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                                    </tr>
                                                ))}
                                                {(ilce.customRows || []).map((cRow: string) => (
                                                    <tr key={cRow}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={ilce.rows?.[cRow]?.[y] || ""}
                                                                    onChange={(e) => updateIlceRowVal(iIdx, cRow, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={ilce.rows?.[cRow]?.normKadro || ""}
                                                                onChange={(e) => updateIlceRowVal(iIdx, cRow, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveIlceCustomRow(iIdx, cRow)}
                                                                className="p-1 rounded text-slate-300 hover:text-rose-600 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-200">
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={newIlceRowInput[iIdx] || ""}
                                                            onChange={(e) => setNewIlceRowInput(prev => ({ ...prev, [iIdx]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleAddIlceCustomRow(iIdx, newIlceRowInput[iIdx] || "");
                                                            }}
                                                            placeholder="Yeni unvan ekle..."
                                                            className="w-full px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td colSpan={personelYears.length + 2} className="p-1 border border-slate-200 dark:border-slate-700 text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddIlceCustomRow(iIdx, newIlceRowInput[iIdx] || "")}
                                                            className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                                                        >
                                                            + Ekle
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {/* Mobil Kart Görünümü */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                                        {[
                                            ...ILCE_PERSONEL_ROWS.map(r => ({ ...r, isCustom: false })),
                                            ...(ilce.customRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                        ].map((r: any) => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{r.label}</span>
                                                    {r.isCustom && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveIlceCustomRow(iIdx, r.key)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {personelYears.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={ilce.rows?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateIlceRowVal(iIdx, r.key, y, e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="-"
                                                                className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex flex-col bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Norm Kadro</span>
                                                        <input
                                                            type="text"
                                                            value={ilce.rows?.[r.key]?.normKadro || ""}
                                                            onChange={(e) => updateIlceRowVal(iIdx, r.key, "normKadro", e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="-"
                                                            className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <input
                                                type="text"
                                                value={newIlceRowInput[iIdx] || ""}
                                                onChange={(e) => setNewIlceRowInput(prev => ({ ...prev, [iIdx]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddIlceCustomRow(iIdx, newIlceRowInput[iIdx] || "");
                                                }}
                                                placeholder="Yeni unvan ekle..."
                                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddIlceCustomRow(iIdx, newIlceRowInput[iIdx] || "")}
                                                className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                + Ekle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* c-) YURT MÜDÜRLÜKLERİ PERSONELİ */}
                    <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                c-) Yurt Müdürlükleri Personeli Açısından Bakıldığında;
                            </h5>
                            <button
                                type="button"
                                onClick={handleAddYurt}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                                <Plus size={12} /> Yeni Yurt Tablosu Ekle
                            </button>
                        </div>

                        {getYurtList().map((yurt, yIdx) => (
                            <div key={yurt.id || yIdx} className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col gap-2">
                                <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Yurt Adı:</span>
                                        <input
                                            type="text"
                                            value={yurt.name}
                                            onChange={(e) => updateYurtField(yIdx, "name", e.target.value)}
                                            onBlur={() => onSave()}
                                            placeholder="... Yurt Müdürlüğü (Örn: Süleyman Şah)"
                                            className="px-2 py-0.5 text-xs font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-56"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">Yurt Müdürlüğü</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Kapasite:</span>
                                        <input
                                            type="text"
                                            value={yurt.kapasite || ""}
                                            onChange={(e) => updateYurtField(yIdx, "kapasite", e.target.value)}
                                            onBlur={() => onSave()}
                                            placeholder="Örn: 1500"
                                            className="px-2 py-0.5 text-xs font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-24 text-center"
                                        />
                                        {getYurtList().length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveYurt(yIdx)}
                                                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 ml-2"
                                            >
                                                <Trash2 size={12} /> Bu Yurdu Sil
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* Masaüstü Tablo Görünümü */}
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                        <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">Unvan</th>
                                                    {personelYears.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[65px]">{y}</th>
                                                    ))}
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[85px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">Norm Kadro</th>
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {YURT_PERSONEL_ROWS.map(r => (
                                                    <tr key={r.key}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{r.label}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={yurt.rows?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateYurtRowVal(yIdx, r.key, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={yurt.rows?.[r.key]?.normKadro || ""}
                                                                onChange={(e) => updateYurtRowVal(yIdx, r.key, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                                    </tr>
                                                ))}
                                                {(yurt.customRows || []).map((cRow: string) => (
                                                    <tr key={cRow}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={yurt.rows?.[cRow]?.[y] || ""}
                                                                    onChange={(e) => updateYurtRowVal(yIdx, cRow, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={yurt.rows?.[cRow]?.normKadro || ""}
                                                                onChange={(e) => updateYurtRowVal(yIdx, cRow, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveYurtCustomRow(yIdx, cRow)}
                                                                className="p-1 rounded text-slate-300 hover:text-rose-600 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-200">
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={newYurtRowInput[yIdx] || ""}
                                                            onChange={(e) => setNewYurtRowInput(prev => ({ ...prev, [yIdx]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleAddYurtCustomRow(yIdx, newYurtRowInput[yIdx] || "");
                                                            }}
                                                            placeholder="Yeni unvan ekle..."
                                                            className="w-full px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td colSpan={personelYears.length + 2} className="p-1 border border-slate-200 dark:border-slate-700 text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddYurtCustomRow(yIdx, newYurtRowInput[yIdx] || "")}
                                                            className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                                                        >
                                                            + Ekle
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {/* Mobil Kart Görünümü */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                                        {[
                                            ...YURT_PERSONEL_ROWS.map(r => ({ ...r, isCustom: false })),
                                            ...(yurt.customRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                        ].map((r: any) => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{r.label}</span>
                                                    {r.isCustom && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveYurtCustomRow(yIdx, r.key)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {personelYears.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={yurt.rows?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateYurtRowVal(yIdx, r.key, y, e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="-"
                                                                className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex flex-col bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Norm Kadro</span>
                                                        <input
                                                            type="text"
                                                            value={yurt.rows?.[r.key]?.normKadro || ""}
                                                            onChange={(e) => updateYurtRowVal(yIdx, r.key, "normKadro", e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="-"
                                                            className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <input
                                                type="text"
                                                value={newYurtRowInput[yIdx] || ""}
                                                onChange={(e) => setNewYurtRowInput(prev => ({ ...prev, [yIdx]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddYurtCustomRow(yIdx, newYurtRowInput[yIdx] || "");
                                                }}
                                                placeholder="Yeni unvan ekle..."
                                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddYurtCustomRow(yIdx, newYurtRowInput[yIdx] || "")}
                                                className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                + Ekle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* d-) GENÇLİK MERKEZİ MÜDÜRLÜĞÜ PERSONELİ */}
                    <div className="flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                d-) Gençlik Merkezi Müdürlüğü Personeli Açısından Bakıldığında;
                            </h5>
                            <button
                                type="button"
                                onClick={handleAddGm}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                                <Plus size={12} /> Yeni Gençlik Merkezi Ekle
                            </button>
                        </div>

                        {getGmList().map((gm, gIdx) => (
                            <div key={gm.id || gIdx} className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/40 dark:bg-slate-800/30 flex flex-col gap-2">
                                <div className="flex items-center justify-between pb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Merkez:</span>
                                        <input
                                            type="text"
                                            value={gm.name}
                                            onChange={(e) => updateGmField(gIdx, "name", e.target.value)}
                                            onBlur={() => onSave()}
                                            placeholder="... Gençlik Merkezi (Örn: Tuşba)"
                                            className="px-2 py-0.5 text-xs font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-64"
                                        />
                                        <span className="text-xs font-semibold text-slate-500">Gençlik Merkezi Müdürlüğü</span>
                                    </div>
                                    {getGmList().length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveGm(gIdx)}
                                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                                        >
                                            <Trash2 size={12} /> Bu Merkezi Sil
                                        </button>
                                    )}
                                </div>
                                {/* Masaüstü Tablo Görünümü */}
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                        <table className="w-full text-xs text-left border-collapse bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                                            <thead>
                                                <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">Unvan</th>
                                                    {personelYears.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[65px]">{y}</th>
                                                    ))}
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[85px] bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">Norm Kadro</th>
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İşlem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {GENCLIK_MERKEZI_ROWS.map(r => (
                                                    <tr key={r.key}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{r.label}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={gm.rows?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateGmRowVal(gIdx, r.key, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={gm.rows?.[r.key]?.normKadro || ""}
                                                                onChange={(e) => updateGmRowVal(gIdx, r.key, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                                    </tr>
                                                ))}
                                                {(gm.customRows || []).map((cRow: string) => (
                                                    <tr key={cRow}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                        {personelYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={gm.rows?.[cRow]?.[y] || ""}
                                                                    onChange={(e) => updateGmRowVal(gIdx, cRow, y, e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="-"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center bg-amber-50/20 dark:bg-amber-950/10">
                                                            <input
                                                                type="text"
                                                                value={gm.rows?.[cRow]?.normKadro || ""}
                                                                onChange={(e) => updateGmRowVal(gIdx, cRow, "normKadro", e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-center py-1 rounded bg-transparent font-bold text-xs text-amber-900 dark:text-amber-300"
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveGmCustomRow(gIdx, cRow)}
                                                                className="p-1 rounded text-slate-300 hover:text-rose-600 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-50/60 dark:bg-blue-950/30 border-t border-blue-200">
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={newGmRowInput[gIdx] || ""}
                                                            onChange={(e) => setNewGmRowInput(prev => ({ ...prev, [gIdx]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleAddGmCustomRow(gIdx, newGmRowInput[gIdx] || "");
                                                            }}
                                                            placeholder="Yeni unvan ekle..."
                                                            className="w-full px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td colSpan={personelYears.length + 2} className="p-1 border border-slate-200 dark:border-slate-700 text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddGmCustomRow(gIdx, newGmRowInput[gIdx] || "")}
                                                            className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                                                        >
                                                            + Ekle
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {/* Mobil Kart Görünümü */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                                        {[
                                            ...GENCLIK_MERKEZI_ROWS.map(r => ({ ...r, isCustom: false })),
                                            ...(gm.customRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                        ].map((r: any) => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{r.label}</span>
                                                    {r.isCustom && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveGmCustomRow(gIdx, r.key)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {personelYears.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={gm.rows?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateGmRowVal(gIdx, r.key, y, e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="-"
                                                                className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex flex-col bg-amber-50/60 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                                                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Norm Kadro</span>
                                                        <input
                                                            type="text"
                                                            value={gm.rows?.[r.key]?.normKadro || ""}
                                                            onChange={(e) => updateGmRowVal(gIdx, r.key, "normKadro", e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="-"
                                                            className="w-full text-center text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <input
                                                type="text"
                                                value={newGmRowInput[gIdx] || ""}
                                                onChange={(e) => setNewGmRowInput(prev => ({ ...prev, [gIdx]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddGmCustomRow(gIdx, newGmRowInput[gIdx] || "");
                                                }}
                                                placeholder="Yeni unvan ekle..."
                                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleAddGmCustomRow(gIdx, newGmRowInput[gIdx] || "")}
                                                className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                + Ekle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 7 & 8 MALİ TABLOLAR (GİDERLER & GELİRLER) */}
            {isSectionVisible("mali") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">7-8</span>
                            GİDERLER VE GELİRLER TABLOLARI
                        </h4>
                    </div>

                    {/* 7- Giderler */}
                    <div>
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            {isSplitPeriod 
                                ? "7- GİDERLER (Birleşme Öncesi ve Birleşme Sonrası):" 
                                : `7- GİDERLER (${startYear} - ${endYear}):`}
                        </h5>
                        
                        {isSplitPeriod ? (
                            <>
                                {/* Birleşme Öncesi Giderler */}
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto mb-4`}>
                                        <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                                            A) Birleşme Öncesi Dönem ({preYears[0]}-{preYears[preYears.length - 1]})
                                        </span>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">GİDER KALEMİ</th>
                                                    {preYears.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[75px]">{y}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                                    { key: "yatirim", label: "Yatırım Giderleri" },
                                                    { key: "bakimOnarim", label: "Bakım Onarım" },
                                                    { key: "personel", label: "Personel Giderleri" },
                                                    { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                                    { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                                    { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                                    { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                                    { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                                    { key: "toplam", label: "TOPLAM", bold: true }
                                                ].map(r => (
                                                    <tr key={r.key} className={r.bold ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold" : ""}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                                        {preYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={tables?.giderler?.birlesmeOncesi?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateTableField(["giderler", "birlesmeOncesi", r.key, y], e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="0,00"
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Birleşme Öncesi Mobil Kartlar */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mb-4`}>
                                        <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                                            A) Birleşme Öncesi Dönem ({preYears[0]}-{preYears[preYears.length - 1]})
                                        </span>
                                        {[
                                            { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                            { key: "yatirim", label: "Yatırım Giderleri" },
                                            { key: "bakimOnarim", label: "Bakım Onarım" },
                                            { key: "personel", label: "Personel Giderleri" },
                                            { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                            { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                            { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                            { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                            { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                            { key: "toplam", label: "TOPLAM", bold: true }
                                        ].map(r => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                                                <span className={`text-xs font-bold ${r.bold ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-100"}`}>{r.label}</span>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {preYears.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={tables?.giderler?.birlesmeOncesi?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateTableField(["giderler", "birlesmeOncesi", r.key, y], e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="0,00"
                                                                className="w-full text-right text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Birleşme Sonrası Giderler */}
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto mb-4`}>
                                        <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                                            B) Birleşme Sonrası Dönem ({postYears[0]}-{postYears[postYears.length - 1]})
                                        </span>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">GİDER KALEMİ</th>
                                                    {postYears.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[75px]">{y}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                                    { key: "yatirim", label: "Yatırım Giderleri" },
                                                    { key: "bakimOnarim", label: "Bakım Onarım" },
                                                    { key: "personel", label: "Personel Giderleri" },
                                                    { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                                    { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                                    { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                                    { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                                    { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                                    { key: "toplam", label: "TOPLAM", bold: true }
                                                ].map(r => (
                                                    <tr key={r.key} className={r.bold ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold" : ""}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                                        {postYears.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={tables?.giderler?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateTableField(["giderler", "birlesmeSonrasi", r.key, y], e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="0,00"
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Birleşme Sonrası Mobil Kartlar */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mb-4`}>
                                        <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                                            B) Birleşme Sonrası Dönem ({postYears[0]}-{postYears[postYears.length - 1]})
                                        </span>
                                        {[
                                            { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                            { key: "yatirim", label: "Yatırım Giderleri" },
                                            { key: "bakimOnarim", label: "Bakım Onarım" },
                                            { key: "personel", label: "Personel Giderleri" },
                                            { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                            { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                            { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                            { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                            { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                            { key: "toplam", label: "TOPLAM", bold: true }
                                        ].map(r => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                                                <span className={`text-xs font-bold ${r.bold ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-100"}`}>{r.label}</span>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {postYears.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={tables?.giderler?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateTableField(["giderler", "birlesmeSonrasi", r.key, y], e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="0,00"
                                                                className="w-full text-right text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            /* TEK DÖNEM (Örn: 2020-2025) - BİRLEŞME İBARESİ YOK, TEK BİR TABLO */
                            <>
                                {(showTable || isAuto) && (
                                    <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto mb-4`}>
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                                    <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">GİDER KALEMİ</th>
                                                    {years.map(y => (
                                                        <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[75px]">{y}</th>
                                                    ))}
                                                    <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[
                                                    { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                                    { key: "yatirim", label: "Yatırım Giderleri" },
                                                    { key: "bakimOnarim", label: "Bakım Onarım" },
                                                    { key: "personel", label: "Personel Giderleri" },
                                                    { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                                    { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                                    { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                                    { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                                    { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                                    { key: "toplam", label: "TOPLAM", bold: true }
                                                ].map(r => (
                                                    <tr key={r.key} className={r.bold ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold" : ""}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                                        {years.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={tables?.giderler?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                                    onChange={(e) => updateTableField(["giderler", "birlesmeSonrasi", r.key, y], e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="0,00"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="border border-slate-200 dark:border-slate-700"></td>
                                                    </tr>
                                                ))}
                                                {(tables?.customGiderRows || []).map((cRow: string, idx: number) => (
                                                    <tr key={cRow} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                                        <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                        {years.map(y => (
                                                            <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                                <input
                                                                    type="text"
                                                                    value={tables?.giderler?.birlesmeSonrasi?.[cRow]?.[y] || ""}
                                                                    onChange={(e) => updateTableField(["giderler", "birlesmeSonrasi", cRow, y], e.target.value)}
                                                                    onBlur={() => onSave()}
                                                                    className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                    placeholder="0,00"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCustomRow("customGiderRows", cRow)}
                                                                className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                                title={`"${cRow}" kaldır`}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                            <input
                                                                type="text"
                                                                value={newGiderInput}
                                                                onChange={(e) => setNewGiderInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        handleAddCustomRow("customGiderRows", newGiderInput);
                                                                        setNewGiderInput("");
                                                                    }
                                                                }}
                                                                placeholder="Yeni gider kalemi yazınız..."
                                                                className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td colSpan={years.length} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleAddCustomRow("customGiderRows", newGiderInput);
                                                                setNewGiderInput("");
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Plus size={13} /> Gider Kalemi Ekle
                                                        </button>
                                                    </td>
                                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleAddCustomRow("customGiderRows", newGiderInput);
                                                                setNewGiderInput("");
                                                            }}
                                                            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                            title="Ekle"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {/* Tek Dönem Mobil Kartlar */}
                                {(showCards || isAuto) && (
                                    <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mb-4`}>
                                        {[
                                            { key: "sporFaaliyet", label: "Spor Faaliyet Giderleri" },
                                            { key: "yatirim", label: "Yatırım Giderleri" },
                                            { key: "bakimOnarim", label: "Bakım Onarım" },
                                            { key: "personel", label: "Personel Giderleri" },
                                            { key: "genclikHizmet", label: "Gençlik Hizmetleri Giderleri" },
                                            { key: "yurtHizmet", label: "Yurt Hizmetleri Giderleri" },
                                            { key: "hizmetYonetim", label: "Hizmet Yönetim Giderleri" },
                                            { key: "sosyalTransfer", label: "Sosyal Transferler" },
                                            { key: "hizmetAlimi", label: "Hizmet Alımı" },
                                            { key: "toplam", label: "TOPLAM", bold: true },
                                            ...(tables?.customGiderRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                        ].map(r => (
                                            <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-xs font-bold ${r.bold ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-100"}`}>{r.label}</span>
                                                    {r.isCustom && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomRow("customGiderRows", r.key)}
                                                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {years.map(y => (
                                                        <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                            <input
                                                                type="text"
                                                                value={tables?.giderler?.birlesmeSonrasi?.[r.key]?.[y] || ""}
                                                                onChange={(e) => updateTableField(["giderler", "birlesmeSonrasi", r.key, y], e.target.value)}
                                                                onBlur={() => onSave()}
                                                                placeholder="0,00"
                                                                className="w-full text-right text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <input
                                                type="text"
                                                value={newGiderInput}
                                                onChange={(e) => setNewGiderInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleAddCustomRow("customGiderRows", newGiderInput);
                                                        setNewGiderInput("");
                                                    }
                                                }}
                                                placeholder="Yeni gider kalemi..."
                                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleAddCustomRow("customGiderRows", newGiderInput);
                                                    setNewGiderInput("");
                                                }}
                                                className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                + Ekle
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* 8- Gelirler */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">8- GELİRLER:</h5>
                            <button
                                type="button"
                                onClick={() => {
                                    const input = window.prompt("Yeni gelir kalemi giriniz:");
                                    if (input) handleAddCustomRow("customGelirRows", input);
                                }}
                                className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                                <Plus size={11} /> Gelir Kalemi Ekle
                            </button>
                        </div>
                        {/* Masaüstü Tablo Görünümü */}
                        {(showTable || isAuto) && (
                            <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                            <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">GELİR KALEMİ</th>
                                            {years.map(y => (
                                                <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[75px]">{y}</th>
                                            ))}
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: "gsgm", label: "GSGM Yardımı" },
                                            { key: "ozelIdare", label: "İl Özel İdaresinden Alınan Nakit Yardımlar" },
                                            { key: "ozelGelir", label: "Özel Gelirler" },
                                            { key: "toplam", label: "TOPLAM", bold: true }
                                        ].map(r => (
                                            <tr key={r.key} className={r.bold ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold" : ""}>
                                                <td className="p-1.5 border border-slate-200 dark:border-slate-700">{r.label}</td>
                                                {years.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.gelirler?.[r.key]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["gelirler", r.key, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="0,00"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="border border-slate-200 dark:border-slate-700"></td>
                                            </tr>
                                        ))}
                                        {(tables?.customGelirRows || []).map((cRow: string, idx: number) => (
                                            <tr key={cRow} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                                <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                {years.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.gelirler?.[cRow]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["gelirler", cRow, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="0,00"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomRow("customGelirRows", cRow)}
                                                        className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                        title={`"${cRow}" kaldır`}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                    <input
                                                        type="text"
                                                        value={newGelirInput}
                                                        onChange={(e) => setNewGelirInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleAddCustomRow("customGelirRows", newGelirInput);
                                                                setNewGelirInput("");
                                                            }
                                                        }}
                                                        placeholder="Yeni gelir kalemi yazınız..."
                                                        className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </td>
                                            <td colSpan={years.length} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleAddCustomRow("customGelirRows", newGelirInput);
                                                        setNewGelirInput("");
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Plus size={13} /> Gelir Kalemi Ekle
                                                </button>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleAddCustomRow("customGelirRows", newGelirInput);
                                                        setNewGelirInput("");
                                                    }}
                                                    className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                    title="Ekle"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Mobil Kart Görünümü */}
                        {(showCards || isAuto) && (
                            <div className={`${isAuto ? "block md:hidden" : ""} space-y-3 mt-2`}>
                                {[
                                    { key: "gsgm", label: "GSGM Yardımı" },
                                    { key: "ozelIdare", label: "İl Özel İdaresinden Alınan Nakit Yardımlar" },
                                    { key: "ozelGelir", label: "Özel Gelirler" },
                                    { key: "toplam", label: "TOPLAM", bold: true },
                                    ...(tables?.customGelirRows || []).map((cRow: string) => ({ key: cRow, label: cRow, isCustom: true }))
                                ].map(r => (
                                    <div key={r.key} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-xs font-bold ${r.bold ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-100"}`}>{r.label}</span>
                                            {r.isCustom && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customGelirRows", r.key)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {years.map(y => (
                                                <div key={y} className="flex flex-col bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{y}</span>
                                                    <input
                                                        type="text"
                                                        value={tables?.gelirler?.[r.key]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["gelirler", r.key, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="0,00"
                                                        className="w-full text-right text-xs font-bold py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                    <input
                                        type="text"
                                        value={newGelirInput}
                                        onChange={(e) => setNewGelirInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleAddCustomRow("customGelirRows", newGelirInput);
                                                setNewGelirInput("");
                                            }
                                        }}
                                        placeholder="Yeni gelir kalemi..."
                                        className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleAddCustomRow("customGelirRows", newGelirInput);
                                            setNewGelirInput("");
                                        }}
                                        className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        + Ekle
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 9- SPOR TESİSLERİ VE YURTLAR */}
            {isSectionVisible("tesisler") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">9</span>
                            <div>
                                <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                    SPOR TESİSLERİ - YURT - MÜLKİYET DURUMU
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                        {facilityTypes.length} Tesis Türü
                                    </span>
                                </h4>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleAddFacility}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                title="Yeni bir tesis türü ekler"
                            >
                                <Plus size={12} /> Tesis Türü Ekle
                            </button>
                            {facilityTypes.length !== DEFAULT_FACILITY_TYPES.length && (
                                <button
                                    type="button"
                                    onClick={handleResetFacilities}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="Varsayılan 21 tesis türüne sıfırla"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 9-A Mülkiyet ve Kapasite */}
                    <div>
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">A) Tesis Türü, Adet ve Kapasite Tablosu</h5>
                        
                        {/* Tablo Görünümü */}
                        {(showTable || isAuto) && (
                            <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto max-h-[380px]`}>
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                                        <tr className="text-slate-700 dark:text-slate-300">
                                            <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[220px]">TESİS TÜRÜ</th>
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-32">ADET</th>
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-36">KAPASİTE</th>
                                            <th className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 w-12">İŞLEM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facilityTypes.map((tt, idx) => {
                                            const mulkList = tables?.tesisler?.mulkiyetList || [];
                                            const item = mulkList.find((x: any) => x.type === tt) || {};

                                            const updateFacility = (field: string, val: string) => {
                                                const cur = [...(tables?.tesisler?.mulkiyetList || [])];
                                                const fIdx = cur.findIndex((x: any) => x.type === tt);
                                                if (fIdx >= 0) {
                                                    cur[fIdx] = { ...cur[fIdx], [field]: val };
                                                } else {
                                                    cur.push({ type: tt, [field]: val });
                                                }
                                                updateTableField(["tesisler", "mulkiyetList"], cur);
                                            };

                                            return (
                                                <tr key={tt} className={idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/40 dark:bg-slate-800/20"}>
                                                    <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{tt}</td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={item.adet || ""}
                                                            onChange={(e) => updateFacility("adet", e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={item.kapasite || ""}
                                                            onChange={(e) => updateFacility("kapasite", e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveFacility(tt)}
                                                            className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            title={`"${tt}" türünü kaldır`}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                            <td colSpan={2} className="p-1.5 border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">+</span>
                                                    <input
                                                        type="text"
                                                        value={newFacilityInput}
                                                        onChange={(e) => setNewFacilityInput(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter") handleAddFacilityName(); }}
                                                        placeholder="Yeni tesis türü yazınız (Örn: CİRİT SAHASI)..."
                                                        className="w-full px-2 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 placeholder:font-normal outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddFacilityName()}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    <Plus size={13} /> Tesis Ekle
                                                </button>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddFacilityName()}
                                                    className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                                                    title="Yeni Tesis Ekle"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Kart Görünümü (Mobil) */}
                        {(showCards || isAuto) && (
                            <div className={`${isAuto ? "block md:hidden" : ""} space-y-2.5`}>
                                {facilityTypes.map((tt) => {
                                    const mulkList = tables?.tesisler?.mulkiyetList || [];
                                    const item = mulkList.find((x: any) => x.type === tt) || {};

                                    const updateFacility = (field: string, val: string) => {
                                        const cur = [...(tables?.tesisler?.mulkiyetList || [])];
                                        const fIdx = cur.findIndex((x: any) => x.type === tt);
                                        if (fIdx >= 0) {
                                            cur[fIdx] = { ...cur[fIdx], [field]: val };
                                        } else {
                                            cur.push({ type: tt, [field]: val });
                                        }
                                        updateTableField(["tesisler", "mulkiyetList"], cur);
                                    };

                                    return (
                                        <div key={tt} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                                <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{tt}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFacility(tt)}
                                                    className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                    title={`"${tt}" türünü kaldır`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Adet</label>
                                                    <input
                                                        type="text"
                                                        value={item.adet || ""}
                                                        onChange={(e) => updateFacility("adet", e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="-"
                                                        className="w-full text-center py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Kapasite</label>
                                                    <input
                                                        type="text"
                                                        value={item.kapasite || ""}
                                                        onChange={(e) => updateFacility("kapasite", e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="-"
                                                        className="w-full text-center py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div className="p-3 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">+ Yeni Tesis Ekle</span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newFacilityInput}
                                            onChange={(e) => setNewFacilityInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleAddFacilityName(); }}
                                            placeholder="Tesis türü..."
                                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 font-medium outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddFacilityName()}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                                        >
                                            Ekle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 9-B Tesislerin Yıllara Göre Dağılımı */}
                    <div>
                        <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">B) Tesislerin Yıllara Göre Dağılımı</h5>
                        
                        {/* Tablo Görünümü */}
                        {(showTable || isAuto) && (
                            <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                            <th className="p-2 font-bold border border-slate-200 dark:border-slate-700 min-w-[200px]">TESİS TÜRÜ</th>
                                            {years.map(y => (
                                                <th key={y} className="p-2 font-bold text-center border border-slate-200 dark:border-slate-700 min-w-[70px]">{y}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
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
                                        ].map(r => (
                                            <tr key={r.key}>
                                                <td className="p-1.5 border border-slate-200 dark:border-slate-700 font-medium">{r.label}</td>
                                                {years.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.tesisler?.yillaraGore?.[r.key]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["tesisler", "yillaraGore", r.key, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-center py-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="-"
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Kart Görünümü (Mobil) */}
                        {(showCards || isAuto) && (
                            <div className={`${isAuto ? "block md:hidden" : ""} space-y-2.5`}>
                                {[
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
                                ].map(r => (
                                    <div key={r.key} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100 block mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">{r.label}</span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {years.map(y => (
                                                <div key={y} className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg text-center">
                                                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{y}</span>
                                                    <input
                                                        type="text"
                                                        value={tables?.tesisler?.yillaraGore?.[r.key]?.[y] || ""}
                                                        onChange={(e) => updateTableField(["tesisler", "yillaraGore", r.key, y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="-"
                                                        className="w-full text-center py-0.5 text-xs font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 10 & 11 NAKİT DURUMU, ÖZEL İDARE VE SPONSORLUK */}
            {isSectionVisible("kaynak_nakit") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* 10- Nakit & Özel İdare */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">10</span>
                                NAKİT & İL ÖZEL İDARESİ KAYNAKLARI
                            </h4>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Nakit Durumu (Kasa / Banka)</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-400 block">Tarih İtibariyle</label>
                                    <input
                                        type="text"
                                        value={tables?.nakitDurumu?.nakitTarihi || ""}
                                        onChange={(e) => updateTableField(["nakitDurumu", "nakitTarihi"], e.target.value)}
                                        onBlur={() => onSave()}
                                        placeholder="../../2023"
                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-medium h-8"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 block">Nakit Tutarı (TL)</label>
                                    <input
                                        type="text"
                                        value={tables?.nakitDurumu?.nakitTutari || ""}
                                        onChange={(e) => updateTableField(["nakitDurumu", "nakitTutari"], e.target.value)}
                                        onBlur={() => onSave()}
                                        placeholder="0,00 TL"
                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-bold h-8"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">İl Özel İdaresinden Yapılan Yatırımlar</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = window.prompt("Yeni yatırım kalemi giriniz:");
                                        if (input) handleAddCustomRow("customOzelIdareRows", input);
                                    }}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800"
                                >
                                    <Plus size={11} /> Yatırım Ekle
                                </button>
                            </div>

                            {/* Tablo Görünümü */}
                            {(showTable || isAuto) && (
                                <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                                <th className="p-1.5 font-bold border border-slate-200 dark:border-slate-700 min-w-[140px]">YATIRIM KALEMİ</th>
                                                {years.map(y => (
                                                    <th key={y} className="p-1.5 font-bold text-center border border-slate-200 dark:border-slate-700">{y}</th>
                                                ))}
                                                <th className="p-1.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İŞLEM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 font-medium">İl Özel İdaresi Yatırımları</td>
                                                {years.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.nakitDurumu?.ozelIdareYatirim?.[y] || ""}
                                                            onChange={(e) => updateTableField(["nakitDurumu", "ozelIdareYatirim", y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="0,00"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="border border-slate-200 dark:border-slate-700"></td>
                                            </tr>
                                            {(tables?.customOzelIdareRows || []).map((cRow: string) => (
                                                <tr key={cRow}>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                    {years.map(y => (
                                                        <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <input
                                                                type="text"
                                                                value={tables?.nakitDurumu?.[cRow]?.[y] || ""}
                                                                onChange={(e) => updateTableField(["nakitDurumu", cRow, y], e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                placeholder="0,00"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomRow("customOzelIdareRows", cRow)}
                                                            className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                                                            title="Kaldır"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                                <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                    <input
                                                        type="text"
                                                        value={newOzelIdareInput}
                                                        onChange={(e) => setNewOzelIdareInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleAddCustomRow("customOzelIdareRows", newOzelIdareInput);
                                                                setNewOzelIdareInput("");
                                                            }
                                                        }}
                                                        placeholder="Yeni yatırım kalemi..."
                                                        className="w-full px-1.5 py-0.5 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900"
                                                    />
                                                </td>
                                                <td colSpan={years.length} className="p-1 border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleAddCustomRow("customOzelIdareRows", newOzelIdareInput);
                                                            setNewOzelIdareInput("");
                                                        }}
                                                        className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white"
                                                    >
                                                        + Ekle
                                                    </button>
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleAddCustomRow("customOzelIdareRows", newOzelIdareInput);
                                                            setNewOzelIdareInput("");
                                                        }}
                                                        className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center mx-auto"
                                                    >
                                                        +
                                                    </button>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Kart Görünümü (Mobil) */}
                            {(showCards || isAuto) && (
                                <div className={`${isAuto ? "block md:hidden" : ""} space-y-3`}>
                                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                        <span className="font-bold text-xs text-slate-850 dark:text-slate-100 block mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                            İl Özel İdaresi Yatırımları
                                        </span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {years.map(y => (
                                                <div key={y} className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg text-center">
                                                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{y}</span>
                                                    <input
                                                        type="text"
                                                        value={tables?.nakitDurumu?.ozelIdareYatirim?.[y] || ""}
                                                        onChange={(e) => updateTableField(["nakitDurumu", "ozelIdareYatirim", y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="0,00"
                                                        className="w-full text-right py-0.5 px-1 text-xs font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(tables?.customOzelIdareRows || []).map((cRow: string) => (
                                        <div key={cRow} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                                <span className="font-bold text-xs text-slate-850 dark:text-slate-100">{cRow}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customOzelIdareRows", cRow)}
                                                    className="p-1 rounded text-rose-500 hover:bg-rose-50"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {years.map(y => (
                                                    <div key={y} className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg text-center">
                                                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{y}</span>
                                                        <input
                                                            type="text"
                                                            value={tables?.nakitDurumu?.[cRow]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["nakitDurumu", cRow, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="0,00"
                                                            className="w-full text-right py-0.5 px-1 text-xs font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="p-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 flex gap-2">
                                        <input
                                            type="text"
                                            value={newOzelIdareInput}
                                            onChange={(e) => setNewOzelIdareInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleAddCustomRow("customOzelIdareRows", newOzelIdareInput);
                                                    setNewOzelIdareInput("");
                                                }
                                            }}
                                            placeholder="Yeni yatırım kalemi..."
                                            className="flex-1 px-2 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customOzelIdareRows", newOzelIdareInput);
                                                setNewOzelIdareInput("");
                                            }}
                                            className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
                                        >
                                            Ekle
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 11- Sponsorluk */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                            <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">11</span>
                                SPONSORLUK KAYNAKLARI
                            </h4>
                            <button
                                type="button"
                                onClick={() => {
                                    const input = window.prompt("Yeni sponsorluk kalemi giriniz:");
                                    if (input) handleAddCustomRow("customSponsorRows", input);
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800"
                            >
                                <Plus size={11} /> Sponsorluk Ekle
                            </button>
                        </div>

                        <div>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">Sponsorlardan Elde Edilen Kaynaklar (Yıllık)</span>
                            
                            {/* Tablo Görünümü */}
                            {(showTable || isAuto) && (
                                <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto`}>
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                                                <th className="p-1.5 font-bold border border-slate-200 dark:border-slate-700 min-w-[140px]">KAYNAK / SPONSOR</th>
                                                {years.map(y => (
                                                    <th key={y} className="p-1.5 font-bold text-center border border-slate-200 dark:border-slate-700">{y}</th>
                                                ))}
                                                <th className="p-1.5 font-bold text-center border border-slate-200 dark:border-slate-700 w-10">İŞLEM</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 font-medium">Sponsorluk Gelirleri</td>
                                                {years.map(y => (
                                                    <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <input
                                                            type="text"
                                                            value={tables?.sponsorluk?.yillikKaynak?.[y] || ""}
                                                            onChange={(e) => updateTableField(["sponsorluk", "yillikKaynak", y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                            placeholder="0,00"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="border border-slate-200 dark:border-slate-700"></td>
                                            </tr>
                                            {(tables?.customSponsorRows || []).map((cRow: string) => (
                                                <tr key={cRow}>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 font-medium">{cRow}</td>
                                                    {years.map(y => (
                                                        <td key={y} className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                            <input
                                                                type="text"
                                                                value={tables?.sponsorluk?.[cRow]?.[y] || ""}
                                                                onChange={(e) => updateTableField(["sponsorluk", cRow, y], e.target.value)}
                                                                onBlur={() => onSave()}
                                                                className="w-full text-right py-1 px-1 rounded bg-transparent font-medium text-xs"
                                                                placeholder="0,00"
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="p-0.5 border border-slate-200 dark:border-slate-700 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomRow("customSponsorRows", cRow)}
                                                            className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                                                            title="Kaldır"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                                <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                    <input
                                                        type="text"
                                                        value={newSponsorInput}
                                                        onChange={(e) => setNewSponsorInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleAddCustomRow("customSponsorRows", newSponsorInput);
                                                                setNewSponsorInput("");
                                                            }
                                                        }}
                                                        placeholder="Yeni sponsor kalemi..."
                                                        className="w-full px-1.5 py-0.5 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900"
                                                    />
                                                </td>
                                                <td colSpan={years.length} className="p-1 border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleAddCustomRow("customSponsorRows", newSponsorInput);
                                                            setNewSponsorInput("");
                                                        }}
                                                        className="px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white"
                                                    >
                                                        + Ekle
                                                    </button>
                                                </td>
                                                <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleAddCustomRow("customSponsorRows", newSponsorInput);
                                                            setNewSponsorInput("");
                                                        }}
                                                        className="w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center mx-auto"
                                                    >
                                                        +
                                                    </button>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Kart Görünümü (Mobil) */}
                            {(showCards || isAuto) && (
                                <div className={`${isAuto ? "block md:hidden" : ""} space-y-3`}>
                                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                        <span className="font-bold text-xs text-slate-850 dark:text-slate-100 block mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                            Sponsorluk Gelirleri
                                        </span>
                                        <div className="grid grid-cols-3 gap-2">
                                            {years.map(y => (
                                                <div key={y} className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg text-center">
                                                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{y}</span>
                                                    <input
                                                        type="text"
                                                        value={tables?.sponsorluk?.yillikKaynak?.[y] || ""}
                                                        onChange={(e) => updateTableField(["sponsorluk", "yillikKaynak", y], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="0,00"
                                                        className="w-full text-right py-0.5 px-1 text-xs font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(tables?.customSponsorRows || []).map((cRow: string) => (
                                        <div key={cRow} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-sm">
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                                                <span className="font-bold text-xs text-slate-850 dark:text-slate-100">{cRow}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomRow("customSponsorRows", cRow)}
                                                    className="p-1 rounded text-rose-500 hover:bg-rose-50"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {years.map(y => (
                                                    <div key={y} className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg text-center">
                                                        <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{y}</span>
                                                        <input
                                                            type="text"
                                                            value={tables?.sponsorluk?.[cRow]?.[y] || ""}
                                                            onChange={(e) => updateTableField(["sponsorluk", cRow, y], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="0,00"
                                                            className="w-full text-right py-0.5 px-1 text-xs font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="p-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 flex gap-2">
                                        <input
                                            type="text"
                                            value={newSponsorInput}
                                            onChange={(e) => setNewSponsorInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleAddCustomRow("customSponsorRows", newSponsorInput);
                                                    setNewSponsorInput("");
                                                }
                                            }}
                                            placeholder="Yeni sponsor kalemi..."
                                            className="flex-1 px-2 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleAddCustomRow("customSponsorRows", newSponsorInput);
                                                setNewSponsorInput("");
                                            }}
                                            className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs"
                                        >
                                            Ekle
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Sponsorluk Açıklamaları (Kimden, ne sağlandı):</label>
                            <textarea
                                value={tables?.sponsorluk?.aciklama || ""}
                                onChange={(e) => updateTableField(["sponsorluk", "aciklama"], e.target.value)}
                                onBlur={() => onSave()}
                                rows={3}
                                className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent resize-none"
                                placeholder="Sponsorluk detayları..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 12-16 AÇIKLAMA VE FİZİKSEL DOSYA BELGELERİ */}
            {isSectionVisible("aciklamalar") && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <h4 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-black flex items-center justify-center">12-16</span>
                            FİZİKSEL DOSYA, TEMSİLCİLİK VE KURUL AÇIKLAMA MADDELERİ
                        </h4>
                    </div>

                    {[
                        { 
                            key: "m12_kurulRaporu", 
                            num: "12", 
                            title: "İl Antrenör Koordinasyon ve Değerlendirme Kurulu", 
                            desc: "İl Antrenör Koordinasyon ve Değerlendirme Kurulu oluşturulup oluşturulmadığı, oluşturuldu ise Kurulun raporları. (Dosyada Fiziksel)" 
                        },
                        { 
                            key: "m13_fahriBelgeleri", 
                            num: "13", 
                            title: "Fahri Antrenör Belgeleri", 
                            desc: "Varsa fahri olarak görevlendirilen antrenörlerin belgeleri. (Antrenörlük belgesi, mezuniyet belgesi vb.) (Dosyada Fiziksel)" 
                        },
                        { 
                            key: "m14_ucretOnayi", 
                            num: "14", 
                            title: "İl Spor Merkezi Ücret Tespiti Onayı", 
                            desc: "İl Spor Merkezi Kayıtları ile branş itibariyle ücret tespitine ilişkin onay." 
                        },
                        { 
                            key: "m15_sporMerkeziListesi", 
                            num: "15", 
                            title: "Spor Merkezi Çalışmalarına Katılanlar Listesi", 
                            desc: `${startYear}-${endYear} yıllarında kız-erkek branşlarında Spor Merkezi çalışmalarına katılanların listesi.` 
                        }
                    ].map(item => (
                        <div key={item.key} className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">{item.num}</span>
                                <div>
                                    <h6 className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.title}</h6>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</p>
                                </div>
                            </div>
                            <textarea
                                value={tables?.aciklamalar?.[item.key] || ""}
                                onChange={(e) => updateTableField(["aciklamalar", item.key], e.target.value)}
                                onBlur={() => onSave()}
                                rows={2}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none font-medium"
                                placeholder="Bu hususa ilişkin açıklama, dosya durumu veya müfettiş notu..."
                            />
                        </div>
                    ))}

                    {/* 16- SPOR DALI TEMSİLCİLERİ VE FAALİYET PROGRAMLARI TABLOSU */}
                    <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/30 to-white dark:from-blue-950/20 dark:to-slate-900 flex flex-col gap-3.5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800 pb-3">
                            <div className="flex items-start gap-2.5">
                                <span className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">16</span>
                                <div>
                                    <h6 className="text-xs font-bold text-slate-850 dark:text-white flex items-center gap-2">
                                        Spor Dalı Temsilcileri ve Faaliyet Programları Durumu
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                            {endYear} / Mevcut Yıl
                                        </span>
                                    </h6>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Antrenör durumundaki 35 spor branşı itibarıyla mevcutta il temsilcisi bulunup bulunmadığı, atamaların yönetmeliğe uygunluğu ve yıllık faaliyet programlarının federasyonlarca tasdik durumu.
                                    </p>
                                </div>
                            </div>

                            {/* İstatistik Rozetleri */}
                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    Toplam: <b className="text-slate-900 dark:text-white">{branches.length}</b> Branş
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Temsilci Var: <b>{temsilciStats.varCount}</b>
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 font-medium text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                                    <XCircle size={12} /> Temsilci Yok: <b>{temsilciStats.yokCount}</b>
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                    Tasdikli Prog.: <b>{temsilciStats.tasdikliCount}</b>
                                </span>
                            </div>
                        </div>

                        {/* Arama ve Filtreleme Araç Çubuğu */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setTemsilciFilter("all")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        temsilciFilter === "all"
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                    }`}
                                >
                                    Tüm Branşlar ({branches.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTemsilciFilter("var")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        temsilciFilter === "var"
                                            ? "bg-emerald-600 text-white shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                    }`}
                                >
                                    Temsilcisi Olanlar ({temsilciStats.varCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTemsilciFilter("yok")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        temsilciFilter === "yok"
                                            ? "bg-rose-600 text-white shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                    }`}
                                >
                                    Temsilcisi Olmayanlar ({temsilciStats.yokCount})
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddBranch}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors"
                                    title="Yeni spor branşı ekler"
                                >
                                    <Plus size={12} /> Branş Ekle
                                </button>
                                <div className="relative w-56">
                                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={temsilciSearch}
                                        onChange={(e) => setTemsilciSearch(e.target.value)}
                                        placeholder="Branş ara..."
                                        className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* İnteraktif Tablo (Masaüstü) */}
                        {(showTable || isAuto) && (
                            <div className={`${isAuto ? "hidden md:block" : ""} overflow-x-auto max-h-[550px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-inner`}>
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm z-10 font-bold">
                                        <tr>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-10">NO</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 min-w-[150px]">SPOR BRANŞI</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 text-center min-w-[130px]">MEVCUTTA TEMSİLCİ?</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 min-w-[160px]">TEMSİLCİ ADI SOYADI</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 min-w-[180px]">ATAMA ONAY TARİH / SAYISI</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 text-center min-w-[160px]">FAALİYET PROGRAMI TASDİKİ</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 min-w-[180px]">AÇIKLAMA / NOT</th>
                                            <th className="p-2 border border-slate-200 dark:border-slate-700 text-center w-10">İŞLEM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTemsilciBranches.map((branch) => {
                                            const bData = tables?.sporDaliTemsilcileri?.[branch] || {};
                                            const globalIndex = branches.indexOf(branch) + 1;
                                            const hasRep = bData.varMi === "var" || bData.varMi === "evet";
                                            const noRep = bData.varMi === "yok" || bData.varMi === "hayir";

                                            return (
                                                <tr 
                                                    key={branch} 
                                                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                                                        hasRep ? "bg-emerald-50/20 dark:bg-emerald-950/10" : ""
                                                    }`}
                                                >
                                                    <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-slate-400">
                                                        {globalIndex}
                                                    </td>
                                                    <td className="p-2 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100">
                                                        {branch}
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <select
                                                            value={bData.varMi || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "varMi"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className={`w-full py-1 px-1.5 text-xs rounded font-bold outline-none cursor-pointer border ${
                                                                hasRep
                                                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                                                                    : noRep
                                                                    ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300"
                                                                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                            }`}
                                                        >
                                                            <option value="">Seçiniz...</option>
                                                            <option value="var">✓ VAR</option>
                                                            <option value="yok">✗ YOK</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={bData.adSoyad || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "adSoyad"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="Temsilci Adı Soyadı..."
                                                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={bData.atamaOnay || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "atamaOnay"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="Tarih / Sayı (Yönetmelik Uygun)..."
                                                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <select
                                                            value={bData.faaliyetTasdik || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "faaliyetTasdik"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className={`w-full py-1 px-1.5 text-xs rounded font-medium outline-none cursor-pointer border ${
                                                                bData.faaliyetTasdik === "tasdikli"
                                                                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 font-bold"
                                                                    : bData.faaliyetTasdik === "tasdiksiz"
                                                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300"
                                                                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                            }`}
                                                        >
                                                            <option value="">Seçiniz...</option>
                                                            <option value="tasdikli">✓ Tasdikli</option>
                                                            <option value="tasdiksiz">✗ Tasdiksiz</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700">
                                                        <input
                                                            type="text"
                                                            value={bData.aciklama || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "aciklama"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="Açıklama / not..."
                                                            className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-100"
                                                        />
                                                    </td>
                                                    <td className="p-1 border border-slate-200 dark:border-slate-700 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveBranch(branch)}
                                                            className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                            title={`"${branch}" branşını kaldır`}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredTemsilciBranches.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                                                    Aramanızla eşleşen spor branşı bulunamadı.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-t-2 border-blue-400 dark:border-blue-600">
                                            <td className="p-2 border border-slate-200 dark:border-slate-700 text-center font-bold text-blue-600 dark:text-blue-400 text-sm">
                                                +
                                            </td>
                                            <td colSpan={2} className="p-1.5 border border-slate-200 dark:border-slate-700">
                                                <input
                                                    type="text"
                                                    value={newBranchInput}
                                                    onChange={(e) => setNewBranchInput(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") handleAddBranchName(); }}
                                                    placeholder="Yeni spor branşı adı yazınız (Örn: BİLARDO)..."
                                                    className="w-full px-2.5 py-1 text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 placeholder:font-normal outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td colSpan={4} className="p-1.5 border border-slate-200 dark:border-slate-700 text-left">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddBranchName()}
                                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                                                >
                                                    <Plus size={14} /> Tabloya Yeni Branş Ekle
                                                </button>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 dark:border-slate-700 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddBranchName()}
                                                    className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center mx-auto shadow-sm cursor-pointer"
                                                    title="Yeni Branş Ekle"
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Kart Görünümü (Mobil) */}
                        {(showCards || isAuto) && (
                            <div className={`${isAuto ? "block md:hidden" : ""} space-y-3`}>
                                {filteredTemsilciBranches.map((branch) => {
                                    const bData = tables?.sporDaliTemsilcileri?.[branch] || {};
                                    const globalIndex = branches.indexOf(branch) + 1;
                                    const hasRep = bData.varMi === "var" || bData.varMi === "evet";
                                    const noRep = bData.varMi === "yok" || bData.varMi === "hayir";

                                    return (
                                        <div 
                                            key={branch} 
                                            className={`p-3.5 rounded-xl border shadow-sm transition-all ${
                                                hasRep 
                                                    ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60" 
                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[10px] flex items-center justify-center">
                                                        {globalIndex}
                                                    </span>
                                                    <span className="font-bold text-xs text-slate-850 dark:text-white">
                                                        {branch}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <select
                                                        value={bData.varMi || ""}
                                                        onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "varMi"], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        className={`py-0.5 px-2 text-xs rounded-lg font-bold outline-none cursor-pointer border ${
                                                            hasRep
                                                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                                                                : noRep
                                                                ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300"
                                                                : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                        }`}
                                                    >
                                                        <option value="">Durum...</option>
                                                        <option value="var">✓ VAR</option>
                                                        <option value="yok">✗ YOK</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBranch(branch)}
                                                        className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                                                        title="Branşı kaldır"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Temsilci Adı Soyadı</label>
                                                    <input
                                                        type="text"
                                                        value={bData.adSoyad || ""}
                                                        onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "adSoyad"], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="Adı Soyadı..."
                                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Atama Onay Tarih / Sayı</label>
                                                        <input
                                                            type="text"
                                                            value={bData.atamaOnay || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "atamaOnay"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            placeholder="Tarih / Sayı..."
                                                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Faaliyet Programı Tasdiki</label>
                                                        <select
                                                            value={bData.faaliyetTasdik || ""}
                                                            onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "faaliyetTasdik"], e.target.value)}
                                                            onBlur={() => onSave()}
                                                            className={`w-full py-1 px-2 text-xs rounded-lg font-medium outline-none cursor-pointer border ${
                                                                bData.faaliyetTasdik === "tasdikli"
                                                                    ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 font-bold"
                                                                    : bData.faaliyetTasdik === "tasdiksiz"
                                                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300"
                                                                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                            }`}
                                                        >
                                                            <option value="">Seçiniz...</option>
                                                            <option value="tasdikli">✓ Tasdikli</option>
                                                            <option value="tasdiksiz">✗ Tasdiksiz</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Açıklama / Not</label>
                                                    <input
                                                        type="text"
                                                        value={bData.aciklama || ""}
                                                        onChange={(e) => updateTableField(["sporDaliTemsilcileri", branch, "aciklama"], e.target.value)}
                                                        onBlur={() => onSave()}
                                                        placeholder="Açıklama..."
                                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredTemsilciBranches.length === 0 && (
                                    <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                        Aramanızla eşleşen spor branşı bulunamadı.
                                    </div>
                                )}

                                <div className="p-3 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">+ Yeni Branş Ekle</span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newBranchInput}
                                            onChange={(e) => setNewBranchInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleAddBranchName(); }}
                                            placeholder="Yeni spor branşı adı..."
                                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 font-medium outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddBranchName()}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                                        >
                                            Ekle
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Genel Açıklama */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                                Madde 16 Genel Değerlendirme & Müfettiş Notu:
                            </label>
                            <textarea
                                value={tables?.aciklamalar?.m16_sporDaliTemsilcileri || ""}
                                onChange={(e) => updateTableField(["aciklamalar", "m16_sporDaliTemsilcileri"], e.target.value)}
                                onBlur={() => onSave()}
                                rows={2}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none font-medium"
                                placeholder="Spor dalı temsilcilikleri geneline ilişkin tespitler, mevzuat uygunluk durumu veya toplu müfettiş notu..."
                            />
                        </div>
                    </div>

                    {/* 17+ DİNAMİK EKLENEN ÖZEL MADDELER */}
                    {customMaddeler.map((cm) => (
                        <div key={cm.id} className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10 flex flex-col gap-2.5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5 flex-1">
                                    <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                        {cm.num}
                                    </span>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={cm.title}
                                            onChange={(e) => handleUpdateCustomMadde(cm.id, "title", e.target.value)}
                                            onBlur={() => onSave()}
                                            className="font-bold text-xs text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full mb-1"
                                            placeholder="Madde Başlığı..."
                                        />
                                        <input
                                            type="text"
                                            value={cm.desc}
                                            onChange={(e) => handleUpdateCustomMadde(cm.id, "desc", e.target.value)}
                                            onBlur={() => onSave()}
                                            className="text-[11px] text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full"
                                            placeholder="Madde açıklaması veya talep konusu..."
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCustomMadde(cm.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                    title="Bu maddeyi kaldır"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <textarea
                                value={cm.answer || ""}
                                onChange={(e) => handleUpdateCustomMadde(cm.id, "answer", e.target.value)}
                                onBlur={() => onSave()}
                                rows={2}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none font-medium"
                                placeholder="Bu ek hususa ilişkin açıklama, dosya durumu veya müfettiş notu..."
                            />
                        </div>
                    ))}

                    {/* YENİ MADDE EKLE BUTONU */}
                    <button
                        type="button"
                        onClick={handleAddCustomMadde}
                        className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 text-xs font-bold transition-all bg-slate-50/50 dark:bg-slate-800/20 hover:bg-indigo-50/30"
                    >
                        <Plus size={15} /> Yeni İnceleme / Bilgi Talebi Maddesi Ekle (Madde {17 + customMaddeler.length})
                    </button>
                </div>
            )}
        </div>
    );
};
