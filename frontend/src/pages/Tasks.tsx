import * as React from "react";
import { Suspense, lazy, useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Search, FileText, Loader2, Trash2, Edit3, ClipboardList, X, UserPlus, ChevronRight, Calendar, Shield, FileDigit, Upload, Download, History, ArrowUpDown, FolderOpen, WifiOff, MoreVertical
} from "lucide-react";
import { toast } from "react-hot-toast";

import { useAuth } from "../lib/hooks/useAuth";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useTheme } from "../lib/context/ThemeContext";
import { isElectron } from "../lib/firebase";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";
import { createTask, updateTask, deleteTask, acceptTask, rejectTask, importTasksFromExcel, type Task, type TaskStep } from "../lib/api/tasks";
import { fetchAudits, createAudit, deleteAudit, invalidateAuditCache } from "../lib/api/audit";
import { searchReports, type SearchResult } from "../lib/api/search";

import { openTaskFolder } from "../lib/api/files";

const ShareModalLazy = lazy(() => import("../components/ShareModal"));
const TaskAnalysisModalLazy = lazy(() => import("../components/tasks/TaskAnalysisModal"));

// Shared styles and sub-components
function ActionBtn({ children, title, color, onClick }: { children: React.ReactNode; title: string; color: string; onClick: () => void }) {
    return (
        <button
            title={title}
            onClick={onClick}
            style={{
                width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${color}20`,
                background: `${color}10`, color: color, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", transition: "all 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.color = color; }}
        >
            {children}
        </button>
    );
}

function toPlainTextSnippet(input: string): string {
    return String(input || "")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const RAPOR_TURLERI = [
    "İnceleme", "Soruşturma", "Ön İnceleme", "Araştırma",
    "İl Denetimi", "Federasyon Denetimi", "Kyk Yurt Denetimi", "Özel Yurt Denetimi", "Spor Kulüpleri Denetimi"
];
export const RAPOR_SABLONLARI: Record<string, string> = {
    "Boş Rapor": "",
    "Genel Teftiş": `<h1 style="text-align: center;">GENEL TEFTİŞ RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>....... tarihli ve ....... sayılı Makam Onayı üzerine ....... İl Müdürlüğü ve bağlı birimlerinde yürütülen Genel Teftiş çalışmaları sonucunda bu rapor düzenlenmiştir.</p><p><br></p><p><strong>2. YAPILAN İNCELEME VE TESPİTLER</strong></p><p>Kurumun mevzuata uygunluk, mali ve idari işlemleri incelenmiş olup, tespit edilen hususlar aşağıda maddeler halinde açıklanmıştır:</p><ul><li>İlk tespit...</li></ul><p><br></p><p><strong>3. SONUÇ VE ÖNERİLER</strong></p><p>Yapılan genel teftiş neticesinde ....... kanaatine varılmıştır.</p>`,
    "İnceleme-Soruşturma": `<h1 style="text-align: center;">İNCELEME VE SORUŞTURMA RAPORU</h1><p><br></p><p><strong>1. İNCELEME/SORUŞTURMA EMRİ</strong></p><p>....... tarihli ve ....... sayılı görevlendirme emri.</p><p><br></p><p><strong>2. İDDİA KONUSU</strong></p><p>Şikayet/İhbar dilekçesinde belirtilen iddialar: .......</p><p><br></p><p><strong>3. İFADE VE BEYANLAR</strong></p><p>Müşteki, şüpheli ve bilgi sahiplerinin beyanları...</p><p><br></p><p><strong>4. TAHLİL VE DEĞERLENDİRME</strong></p><p>Elde edilen bilgi, belge ve ifadeler ışığında iddiaların değerlendirilmesi.</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>İddiaların sübuta erip ermediği ve getirilen disiplin/mali teklifler.</p>`,
    "Ön İnceleme": `<h1 style="text-align: center;">ÖN İNCELEME RAPORU</h1><p><br></p><p><strong>1. ÖN İNCELEME EMRİ</strong></p><p>.......</p><p><br></p><p><strong>2. HAKKINDA ÖN İNCELEME YAPILANLAR</strong></p><p>Adı Soyadı, Unvanı, Görev Yeri</p><p><br></p><p><strong>3. ÖN İNCELEME KONUSU</strong></p><p>.......</p><p><br></p><p><strong>4. İNCELEME VE DEĞERLENDİRME</strong></p><p>.......</p><p><br></p><p><strong>5. SONUÇ VE TEKLİF</strong></p><p>4483 sayılı Kanun kapsamında Soruşturma İzni Verilmesi / Verilmemesi teklifi.</p>`,
    "Spor Kulüpleri": `<h1 style="text-align: center;">SPOR KULÜBÜ DENETİM RAPORU</h1><p><br></p><p><strong>1. GİRİŞ</strong></p><p>7405 sayılı Spor Kulüpleri ve Spor Federasyonları Kanunu kapsamında ....... Spor Kulübü'nün idari ve mali denetimi hakkındadır.</p><p><br></p><p><strong>2. İDARİ YAPI VE İŞLEYİŞ</strong></p><p>Tüzük uygunluğu, üye kayıt defteri, yönetim kurulu karar defterinin incelenmesi.</p><p><br></p><p><strong>3. MALİ İNCELEME</strong></p><p>Gelir-gider tabloları, bağış makbuzları ve bilanço değerleri.</p><p><br></p><p><strong>4. SONUÇ</strong></p><p>İyileştirilmesi gereken alanlar ve mevzuata aykırı eylemlere ilişkin bildirimler.</p>`,
    "Spor Kulüpleri Evrak Talep Yazısı": `<h1 style="text-align: center;">SPOR KULÜBÜ EVRAK TALEP YAZISI</h1><p><br></p><p><strong>İlgi :</strong><br>a) ....... tarihli ve ....... sayılı Makam Oluru.<br>b) ....... tarihli ve ....... sayılı Görevlendirme Yazısı.</p><p><br></p><p>İlgi (a)'da yer alan Bakanlık Makamı Oluru ve ilgi (b)'de kayıtlı Rehberlik ve Denetim Başkanlığının Görev Emri uyarınca, ....... yılı Spor Kulüpleri ve Spor Anonim Şirketleri Genel Denetimi kapsamında aşağıda belirtilen tüm bilgi ve belgelerin madde bazında tasniflenmiş onaylı suretlerinin denetime hazır hale getirilerek 7 (yedi) gün içinde Müfettişliğe teslim edilmesini rica ederim.</p><p><br></p><p><strong>TALEP EDİLEN BİLGİ VE BELGELER:</strong></p><ol><li>Kuruluş ve tescil işlemlerine ilişkin evrak,</li><li>Çek Karnesi,</li><li>Sulh ve İbra Sözleşmeleri,</li><li>Varsa ayni yardım teslim belgesi (dağıtım tutanakları, ayni bağış alındı belgesi),</li><li>Başta tasdikli Yönetim Kurulu Karar defteri olmak üzere tüm yasal defterler ve varsa tutulan yardımcı defterler,</li><li>Bankalar nezdindeki tüm TL ve YP vadeli, vadesiz mevduat, yatırım hesapları, kredi kartı pos cihazı kullanımının bağlı olduğu hesaplar, kullanılan kredi hesapları (denetim dönemi içerisinde işlem görmüş ancak kapatılmış banka hesapları dahil), Kasa hesabı varsa denetime başlanıldığı gün itibariyle buna ilişkin mevcut durum tutanakları,</li><li>Tüzük, Esas Sözleşme ve Genel Kurul toplantı tutanakları (olağan ve olağanüstü kurul toplantıları),</li><li>İç Denetim Raporları (Denetim dönemi itibari ile),</li><li>Varsa Bağımsız Denetim Raporları,</li><li>Finansal Tablolar (Denetim dönemi itibariyle konsolidasyona tabi olan kulüp ve şirketlerde konsolide finansal tablolar ile konsolidasyon tarihinde konsolide olanlara ait olan tablolar birlikte),</li><li>Yasal defterlere ve yardımcı defterlere intikal etmiş işlemlere ait tüm evrak,</li><li>Bağlı ortaklık, iştirak ve iktisadi işletmeler varsa bu şirketlerin kuruluş ve varsa değişiklik ticaret sicil gazeteleri,</li><li>Bağlı bulunulan İl Müdürlüklerine verilen beyannameler,</li><li>Yönetim Kurulu üyelerinin ve personelin dosyaları,</li><li>Hasılat ve gelir kalemleri (UEFA, sporcu satışı, lisanslı ürün, bilet, yayın, loca, sponsor vb. gerçekleşen ile kayıtların uygunluğu, finansal tablolara uygunluk, taraflar vb.),</li><li>Futbolcu, Teknik Direktör ve Temsilci Sözleşmeleri (Tek taraflı-karşılıklı fesihler, tahkim kararları, geciken maaşlar, tazminatlar, vekalet ücretleri ve faiz ödemeleri, bonservis bedeli, amortisman giderleri vb.),</li><li>Bilet satış işlemlerine ilişkin sözleşme ve gelirlerin takibi, bedelsiz verilen biletler,</li><li>Sponsorluklara ilişkin kayıt ve belgeler,</li><li>Tahsisli, kiralık ve mülk olan menkul (araçlar vb.) ve gayrimenkullerin listesi,</li><li>Spor okullarına ilişkin iş ve işlemler,</li><li>Vadesinde Ödenmeyen Vergi ve SGK Borçlarına dair kayıtlar,</li><li>Lisansiyerlerden Tahsil Edilen Royalty Bedellerine ilişkin kayıtlar,</li><li>Verilen avanslar, alacakların takip ve tahsili, dava karşılıklarına ilişkin kayıtlar,</li><li>İnşaatlar, yapım işlerine ilişkin kayıtlar (Haklar, sözleşmeler, tedarikçilere ödemeler, yüklenici kontrolü vb.),</li><li>Kulüp içi talimatların mevcudiyeti, güncel mevzuata uygunluğuna dair bilgiler,</li><li>UEFA ve TFF tarafından Kulübe kesilen cezalar vb. kayıtları,</li><li>Muhatap kalınan icra takipleri, faiz ödemeleri, aleyhteki davalar vb. hakkındaki kayıtlar,</li><li>Satın alma ve gider işlemleri ile ticari ilişkilerde tespit edilen aksaklıklar ve istisnai durumlara ilişkin kayıtlar (yetki durumu, kalıntı değerler, fiziki mevcudiyet, envanter kaydı vb.),</li><li>Nakit ve nakit benzerleri, ticari alacaklar ve borçlar, tahsil kabiliyeti, beklenen zarar, işlemlerin tutar ve niteliği vb. hakkındaki kayıtlar,</li><li>Stoklara ilişkin kayıtlar (devir hızı, kayıt sistemi, uygulanan programlama işlerliği vb., fatura/irsaliye),</li><li>Sabit kıymetlere ilişkin kayıtlar (yeterli açıklama, sınıflandırma, mülkiyet, yapılan tahminler, kredi vb.).</li></ol><p><br></p><p style="text-align: right;">.......<br>Müfettiş</p>`
};
const RAPOR_DURUMLARI = ["Başlanmadı", "Devam Ediyor", "İncelemede", "Tamamlandı"];

function extractTaskSeq(raporKodu: string | undefined, prefix: string, year: number): number | null {
    if (!raporKodu) return null;
    const expectedPrefix = `${prefix}/${year}-`;
    if (!raporKodu.startsWith(expectedPrefix)) return null;
    const raw = raporKodu.slice(expectedPrefix.length).trim();
    if (!/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return value > 0 ? value : null;
}

function getNextMissingTaskSeq(codes: Array<string | undefined>, prefix: string, year: number): number {
    const used = new Set<number>();
    for (const code of codes) {
        const seq = extractTaskSeq(code, prefix, year);
        if (seq) used.add(seq);
    }
    let next = 1;
    while (used.has(next)) next += 1;
    return next;
}

function getNextReportSequence(audits: Array<{ report_seq?: number }>): number {
    const used = new Set(
        audits
            .map((a) => Number(a.report_seq || 0))
            .filter((n) => Number.isInteger(n) && n > 0)
    );
    let seq = 1;
    while (used.has(seq)) seq += 1;
    return seq;
}

const getTaskDisplayCode = (task: any, allTasks: any[]): string => {
    if (task.rapor_kodu && !task.rapor_kodu.startsWith("TASLAK-")) {
        return task.rapor_kodu;
    }
    
    if (task.parent_task_id) {
        const parent = allTasks.find(t => String(t.id).trim() === String(task.parent_task_id).trim());
        if (parent) {
            return getTaskDisplayCode(parent, allTasks);
        }
    }
    
    const topLevelTasks = allTasks.filter(t => {
        if (t.parent_task_id) return false;
        const isOld = t.baslama_tarihi ? (Date.now() - new Date(t.baslama_tarihi).getTime() > 730 * 24 * 60 * 60 * 1000) : false;
        const isArchived = (t.rapor_durumu === "Tamamlandı") && isOld;
        return !isArchived;
    });

    topLevelTasks.sort((a, b) => {
        const isDraftA = !a.rapor_kodu || a.rapor_kodu.startsWith("TASLAK-");
        const isDraftB = !b.rapor_kodu || b.rapor_kodu.startsWith("TASLAK-");
        
        if (isDraftA !== isDraftB) {
            return isDraftA ? 1 : -1;
        }

        const parseRaporKodu = (kodu?: string) => {
            if (!kodu) return { year: 0, seq: 0 };
            const parts = kodu.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length === 0) return { year: 0, seq: 0 };
            
            const targetCode = parts[0];
            const match = targetCode.match(/(\d{4})-(\d+)/);
            if (match) {
                return { year: parseInt(match[1]) || 0, seq: parseInt(match[2]) || 0 };
            }
            const yearMatch = targetCode.match(/(\d{4})/);
            if (yearMatch) {
                return { year: parseInt(yearMatch[1]) || 0, seq: 0 };
            }
            return { year: 0, seq: 0 };
        };

        const parsedA = parseRaporKodu(a.rapor_kodu);
        const parsedB = parseRaporKodu(b.rapor_kodu);

        if (parsedA.year !== parsedB.year) {
            return parsedA.year - parsedB.year;
        }
        if (parsedA.seq !== parsedB.seq) {
            return parsedA.seq - parsedB.seq;
        }

        const aCode = String(a.rapor_kodu || "");
        const bCode = String(b.rapor_kodu || "");
        return aCode.localeCompare(bCode, "tr", { numeric: true, sensitivity: "base" });
    });

    const index = topLevelTasks.findIndex(t => String(t.id).trim() === String(task.id).trim());
    return index !== -1 ? String(index + 1) : "-";
};

const getNextReportTitle = (task: any, allTasks: any[], existingReportsCount: number): string => {
    const displayCode = getTaskDisplayCode(task, allTasks);
    const taskName = task.rapor_adi || "Raporu";
    const suffix = taskName.endsWith("Raporu") ? "" : " Raporu";
    const baseTitle = `${displayCode} - ${taskName}${suffix}`;
    if (existingReportsCount === 0) {
        return baseTitle;
    } else {
        return `${baseTitle} ${existingReportsCount + 1}`;
    }
};

import { useGlobalData } from "../lib/context/GlobalDataContext";

export default function Tasks() {
    const navigate = useNavigate();
    const confirm = useConfirm();

    // Global Search State
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [globalSearchQuery, setGlobalSearchQuery] = useState("");
    const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
    const [globalSearchError, setGlobalSearchError] = useState<string | null>(null);

    const handleOpenGlobalSearch = () => {
        setIsSearchModalOpen(true);
        setGlobalSearchQuery("");
        setGlobalSearchResults([]);
        setGlobalSearchError(null);
    };
    const handleCloseGlobalSearch = () => {
        setIsSearchModalOpen(false);
    };
    const handleGlobalSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!globalSearchQuery.trim()) return;
        setGlobalSearchLoading(true);
        setGlobalSearchError(null);
        try {
            const results = await searchReports(globalSearchQuery.trim());
            setGlobalSearchResults(results);
        } catch (err: any) {
            setGlobalSearchError(err.message || "Arama başarısız oldu.");
        } finally {
            setGlobalSearchLoading(false);
        }
    };
    const handleGoToSearchResult = (result: SearchResult) => {
        if (result.type === "audit" && result.id) {
            navigate(`/audit/${result.id}/report`);
            setIsSearchModalOpen(false);
        } else if (result.type === "task" && result.id) {
            navigate(`/tasks?highlight=${result.id}`);
            setIsSearchModalOpen(false);
        }
    };
    const [searchParams, setSearchParams] = useSearchParams();
    const { theme } = useTheme();
    const isDark = (theme as string) === "dark";

    const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.65rem", fontWeight: 900, color: "var(--secondary)", letterSpacing: "0.15em", marginBottom: "0.4rem", textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" };
    const inputStyle: React.CSSProperties = { width: "100%", padding: "0.8rem 1rem", border: "1px solid var(--border)", borderRadius: "1rem", fontSize: "0.875rem", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box", background: "var(--background)", color: "var(--foreground)", transition: "all 0.2s" };
    const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" };
    const modalBoxStyle: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "1.5rem", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: "550px", padding: "2rem" };

    const { user, profile } = useAuth();
    const { data: cachedData, refreshAll, refreshTasks, isOffline } = useGlobalData();
    
    const [loading, setLoading] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [isBulkShareModalOpen, setIsBulkShareModalOpen] = useState(false);
    
    const currentUser = user;
    const effectiveUid = currentUser?.uid;
    const effectiveEmail = currentUser?.email?.toLowerCase();
    
    const userKeys = useMemo(() => 
        [effectiveUid, effectiveEmail].filter(Boolean) as string[],
        [effectiveUid, effectiveEmail]
    );

    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [showSablonModal, setShowSablonModal] = useState<string | null>(null); // task id
    const [showReportSelector, setShowReportSelector] = useState<Task | null>(null);
    const [taskAudits, setTaskAudits] = useState<any[]>([]);
    const [shareTask, setShareTask] = useState<Task | null>(null);
    const [newStepText, setNewStepText] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("kisisel");
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const legacyReportInputRef = useRef<HTMLInputElement>(null);
    const [isLegacyMode, setIsLegacyMode] = useState(false);
    const [analysisTask, setAnalysisTask] = useState<Task | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: "rapor_kodu" | "rapor_adi" | "rapor_turu" | "sure" | "rapor_durumu"; direction: "asc" | "desc" }>({
        key: "rapor_kodu",
        direction: "asc"
    });

    const [isNewAuditModalOpen, setIsNewAuditModalOpen] = useState<Task | null>(null);
    const [newAudit, setNewAudit] = useState({
        title: "",
        location: "",
        date: new Date().toLocaleDateString("tr-TR"),
        inspector: profile?.full_name || currentUser?.displayName || currentUser?.email?.split('@')[0] || "Müfettiş",
        status: "Devam Ediyor",
        template: "Boş Rapor",
        report_seq: 1
    });
    const [showInspectorDropdown, setShowInspectorDropdown] = useState(false);
    const [inspectorSearch, setInspectorSearch] = useState("");
    const inspectorDropdownRef = useRef<HTMLDivElement>(null);
    const [registeredProfiles, setRegisteredProfiles] = useState<any[]>([]);
    const [activeDropdownTaskId, setActiveDropdownTaskId] = useState<string | null>(null);

    useEffect(() => {
        if (!activeDropdownTaskId) return;
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest(".action-dropdown-container")) {
                setActiveDropdownTaskId(null);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [activeDropdownTaskId]);

    useEffect(() => {
        let active = true;
        const loadProfiles = async () => {
            try {
                const { fetchAllProfiles } = await import("../lib/api/profiles");
                const profiles = await fetchAllProfiles();
                if (!active) return;
                
                // Filter out current user from registered profiles
                const myUid = currentUser?.uid || profile?.uid;
                const myEmail = currentUser?.email?.toLowerCase().trim() || profile?.email?.toLowerCase().trim();
                const filtered = profiles.filter(p => {
                    const pUid = p.uid;
                    const pEmail = p.email?.toLowerCase().trim();
                    const isMe = (pUid && pUid === myUid) || 
                                 (pEmail && pEmail === myEmail);
                    return !isMe;
                });

                if (active) {
                    setRegisteredProfiles(filtered);
                }
            } catch (err) {
                console.error("Profiller yüklenemedi:", err);
            }
        };
        loadProfiles();
        return () => {
            active = false;
        };
    }, [currentUser?.uid, currentUser?.email, profile]);

    // Memoized derived data from global cache
    const { tasks, invitations } = useMemo(() => {
        if (!cachedData.tasks) return { tasks: [], invitations: [] };
        
        const accepted = cachedData.tasks.filter(t => 
            userKeys.includes(t.owner_id || '') || 
            (t.accepted_collaborators || []).some((value: string) => userKeys.includes(value))
        );
        
        const pending = cachedData.tasks.filter(t => 
            (t.pending_collaborators || []).some((value: string) => userKeys.includes(value)) &&
            !userKeys.includes(t.owner_id || '')
        );

        return { tasks: accepted, invitations: pending };
    }, [cachedData.tasks, userKeys]);

    const inspectors = useMemo(() => {
        if (!cachedData.contactsCorporate) return [];
        
        // Sadece kayıtlı profili olan kişileri filtrele
        const registeredEmails = new Set(registeredProfiles.map(p => p.email?.toLowerCase().trim()));
        const registeredUids = new Set(registeredProfiles.map(p => p.uid));

        const myUid = currentUser?.uid;
        const myEmail = currentUser?.email?.toLowerCase().trim();

        return cachedData.contactsCorporate
            .filter((p: any) => {
                const email = p.email?.toLowerCase().trim();
                const uid = p.uid || p.id;
                
                // Exclude me
                if (uid === myUid || (email && email === myEmail)) return false;

                return registeredEmails.has(email) || registeredUids.has(uid);
            })
            .map((p: any) => ({
                id: p.uid || p.id,
                name: p.full_name || p.display_name || p.email || p.name,
                email: p.email,
                title: p.title || "Müfettiş",
                created_at: new Date().toISOString()
            }));
    }, [cachedData.contactsCorporate, registeredProfiles, currentUser?.uid, currentUser?.email]);

    const getSenderName = (inv: any) => {
        if (!inv.owner_id) return "Bir Müfettiş";
        if (inv.owner_name && inv.owner_name !== inv.owner_id) {
            return inv.owner_name;
        }
        
        // Search in registeredProfiles
        const prof = registeredProfiles.find(p => p.uid === inv.owner_id || p.email === inv.owner_id);
        if (prof?.full_name) return prof.full_name;

        // Search in inspectors
        const ins = inspectors.find(i => i.id === inv.owner_id || i.email === inv.owner_id);
        if (ins?.name) return ins.name;

        // Fallback to owner_id
        return inv.owner_id;
    };

    const raporOnek = localStorage.getItem('raporKoduOnek') || 'S.Y.64';
    const currentYear = new Date().getFullYear();
    const autoKodu = useMemo(() => {
        const allCodes = [...tasks, ...invitations]
            .filter(t => !t.parent_task_id)
            .map((t) => t.rapor_kodu);
        const nextSeq = getNextMissingTaskSeq(allCodes, raporOnek, currentYear);
        return `${raporOnek}/${currentYear}-${nextSeq}`;
    }, [tasks, invitations, raporOnek, currentYear]);
    
    const [form, setForm] = useState({
        rapor_kodu: "",
        rapor_adi: "",
        rapor_turu: "İnceleme",
        baslama_tarihi: new Date().toISOString().split("T")[0],
        bitis_tarihi: new Date().toISOString().split("T")[0],
        sure_gun: 30,
        assigned_to: [] as string[],
        parent_task_id: ""
    });

    useEffect(() => {
        if (form.parent_task_id) {
            const parent = tasks.find(t => t.id === form.parent_task_id);
            if (parent) {
                setForm(prev => ({
                    ...prev,
                    rapor_kodu: parent.rapor_kodu || ""
                }));
            }
        } else {
            setForm(prev => ({
                ...prev,
                rapor_kodu: ""
            }));
        }
    }, [form.parent_task_id, tasks]);

    useEffect(() => { 
        if (effectiveUid) {
            refreshAll(effectiveUid, currentUser?.email || undefined, currentUser?.displayName || undefined, true);
        }
    }, [effectiveUid, refreshAll, currentUser]);

    useEffect(() => {
        if (searchParams.get("status") && activeTab === "ortak") {
            setActiveTab("kisisel");
            setIsLegacyMode(false);
        }
    }, [searchParams, activeTab]);

    useEffect(() => {
        setSelectedTaskIds([]);
    }, [activeTab]);

    useEffect(() => {
        setSelectedTaskIds(prev => prev.filter(id => tasks.some(t => t.id === id)));
    }, [tasks]);


    // Web sürümü uyarısı - Kullanıcı isteğiyle kaldırıldı
    useEffect(() => {
        // Uyarı kaldırıldı
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (inspectorDropdownRef.current && !inspectorDropdownRef.current.contains(e.target as Node)) {
                setShowInspectorDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isElectron) {
            toast.error("Görev oluşturma sadece masaüstü uygulamasında aktiftir. Lütfen masaüstü programından açınız.");
            return;
        }

        if (!form.rapor_adi.trim()) return;
        try {
            setSaving(true);
            // Legacy modda bitiş tarihinden gün farkını hesapla
            const legacyCompletedDays = isLegacyMode && form.baslama_tarihi && form.bitis_tarihi
                ? Math.max(0, Math.ceil((new Date(form.bitis_tarihi).getTime() - new Date(form.baslama_tarihi).getTime()) / (1000 * 3600 * 24)))
                : form.sure_gun;

            let finalRaporKodu = form.rapor_kodu ? form.rapor_kodu.trim() : "";
            if (finalRaporKodu) {
                finalRaporKodu = finalRaporKodu.split(',')
                    .map(part => {
                        let p = part.trim();
                        p = p.replace(/_(\d{4}-)/g, "/$1");
                        if (p.includes("_") && !p.includes("/")) {
                            const lastUnder = p.lastIndexOf("_");
                            if (lastUnder !== -1) {
                                p = p.substring(0, lastUnder) + "/" + p.substring(lastUnder + 1);
                            }
                        }
                        return p;
                    })
                    .join(", ");
            }

            const payload = {
                ...form,
                owner_id: effectiveUid,
                assigned_to: [effectiveUid, ...(form.assigned_to || [])].filter((id): id is string => !!id),
                rapor_kodu: isLegacyMode 
                    ? (finalRaporKodu || autoKodu) 
                    : (form.parent_task_id 
                        ? (tasks.find(t => t.id === form.parent_task_id)?.rapor_kodu || "") 
                        : ""),
                rapor_durumu: isLegacyMode ? "Tamamlandı" : "Başlanmadı",
                is_public: false,
                steps: [],
                completed_at: isLegacyMode ? (form.bitis_tarihi ? new Date(form.bitis_tarihi).toISOString() : new Date().toISOString()) : undefined,
                completed_in_days: isLegacyMode ? legacyCompletedDays : undefined,
                sure_gun: isLegacyMode ? legacyCompletedDays : form.sure_gun,
                status_history: [{
                    status: isLegacyMode ? "Tamamlandı" : "Başlanmadı",
                    changed_at: isLegacyMode ? (form.bitis_tarihi ? new Date(form.bitis_tarihi).toISOString() : new Date().toISOString()) : new Date().toISOString(),
                    to: isLegacyMode ? "Tamamlandı" : "Başlanmadı"
                }]
            };
            await createTask(payload);
            toast.success(isLegacyMode ? "Eski kayıt arşive eklendi." : "Yeni görev oluşturuldu.");
            setForm({
                rapor_kodu: "",
                rapor_adi: "",
                rapor_turu: "İnceleme",
                baslama_tarihi: new Date().toISOString().split("T")[0],
                bitis_tarihi: new Date().toISOString().split("T")[0],
                sure_gun: 30,
                assigned_to: [],
                parent_task_id: ""
            });
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch { toast.error("Görev oluşturulamadı."); }
        finally { setSaving(false); }
    };

    const toggleInspector = (id: string) => {
        setForm(prev => ({
            ...prev,
            assigned_to: prev.assigned_to.includes(id) 
                ? prev.assigned_to.filter(i => i !== id)
                : [...prev.assigned_to, id]
        }));
    };

    const handleAcceptInvitation = async (taskId: string) => {
        if (!isElectron) {
            toast.error("Görev kabul işlemi yalnızca masaüstü uygulamasında yapılabilir.");
            return;
        }

        try {
            setSaving(true);
            await acceptTask(taskId, effectiveUid || "", effectiveEmail);
            toast.success("Görev kabul edildi ve listenize eklendi.");
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch (error) {
            toast.error("Görev kabul edilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleRejectInvitation = async (taskId: string) => {
        if (!isElectron) {
            toast.error("Görev reddetme işlemi yalnızca masaüstü uygulamasında yapılabilir.");
            return;
        }

        const proceed = await confirm({
            title: "Görevi Reddet",
            message: "Bu görev paylaşım davetini reddetmek istediğinize emin misiniz?",
            confirmText: "Evet, Reddet",
            cancelText: "Vazgeç",
            variant: "danger"
        });
        if (!proceed) return;

        try {
            setSaving(true);
            await rejectTask(taskId, effectiveUid || "", effectiveEmail);
            toast.success("Görev daveti reddedildi.");
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch (error) {
            toast.error("Görev daveti reddedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev => (
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        ));
    };

    const clearTaskSelection = () => setSelectedTaskIds([]);

    const toggleSelectAllVisibleTasks = () => {
        const visibleIds = sortedFiltered.map(task => task.id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedTaskIds.includes(id));

        if (allVisibleSelected) {
            setSelectedTaskIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedTaskIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const bulkUpdateSelectedTasks = async (newStatus: string) => {
        if (selectedTaskIds.length === 0) return;

        try {
            setBulkActionLoading(true);
            const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));
            const results = await Promise.allSettled(
                selectedTasks.map(task => updateTask(task.id, buildStatusUpdatePayload(task, newStatus)))
            );

            const failedTaskIds = selectedTasks
                .filter((_, index) => results[index].status === "rejected")
                .map(task => task.id);
            const successCount = results.length - failedTaskIds.length;

            if (effectiveUid) refreshTasks(effectiveUid);
            setSelectedTaskIds(failedTaskIds);

            if (failedTaskIds.length === 0) {
                toast.success(`${successCount} görev güncellendi.`);
            } else {
                toast.error(`${successCount} başarılı, ${failedTaskIds.length} başarısız.`);
            }
        } catch {
            toast.error("Toplu durum güncellenemedi.");
        } finally {
            setBulkActionLoading(false);
        }
    };

    const bulkDeleteSelectedTasks = async () => {
        if (selectedTaskIds.length === 0) return;

        const confirmed = await confirm({
            title: "Toplu Silme",
            message: `${selectedTaskIds.length} görevi ve ilişkili raporlarını kalıcı olarak silmek istediğinize emin misiniz?`,
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            setBulkActionLoading(true);
            const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));

            const allAudits = await fetchAudits(effectiveUid, effectiveEmail, true);

            const results = await Promise.allSettled(
                selectedTasks.map(async (task) => {
                    const associatedAudits = allAudits.filter(a => 
                        String(a.task_id).trim() === String(task.id).trim()
                    );
                    if (associatedAudits.length > 0) {
                        const auditDeleteResults = await Promise.allSettled(associatedAudits.map(a => deleteAudit(a.id)));
                        const hasAuditDeleteFailure = auditDeleteResults.some(result => result.status === "rejected");
                        if (hasAuditDeleteFailure) {
                            throw new Error("Bazı ilişkili raporlar silinemedi");
                        }
                    }

                    await deleteTask(task.id);
                })
            );

            const failedTaskIds = selectedTasks
                .filter((_, index) => results[index].status === "rejected")
                .map(task => task.id);
            const successCount = results.length - failedTaskIds.length;

            if (successCount > 0) {
                invalidateAuditCache();
                if (effectiveUid) refreshTasks(effectiveUid);
            }

            setSelectedTaskIds(failedTaskIds);

            if (failedTaskIds.length === 0) {
                toast.success(`${successCount} görev silindi.`);
            } else {
                toast.error(`${successCount} başarılı, ${failedTaskIds.length} başarısız.`);
            }
        } catch {
            toast.error("Toplu silme işlemi başarısız.");
        } finally {
            setBulkActionLoading(false);
        }
    };

    const bulkSharedWithSeed = useMemo(() => {
        const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));
        return Array.from(new Set(
            selectedTasks.flatMap(task => [
                ...(task.pending_collaborators || []),
                ...(task.accepted_collaborators || []),
                ...(task.shared_with || [])
            ])
        ));
    }, [tasks, selectedTaskIds]);

    const handleBulkShareUpdate = async (newSharedWith: string[]) => {
        if (selectedTaskIds.length === 0) return;

        try {
            setBulkActionLoading(true);
            const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));
            const results = await Promise.allSettled(
                selectedTasks.map(task =>
                    updateTask(task.id, {
                        pending_collaborators: Array.from(new Set([...(task.pending_collaborators || []), ...newSharedWith]))
                    })
                )
            );

            const successCount = results.filter(result => result.status === "fulfilled").length;
            const failedCount = results.length - successCount;
            const failedTaskIds = selectedTasks
                .filter((_, index) => results[index].status === "rejected")
                .map(task => task.id);

            if (effectiveUid) refreshTasks(effectiveUid);
            setSelectedTaskIds(failedTaskIds);

            if (failedCount === 0) {
                toast.success(`${successCount} görev için paylaşım daveti gönderildi.`);
            } else {
                toast.error(`${successCount} başarılı, ${failedCount} başarısız.`);
            }
        } catch {
            toast.error("Toplu paylaşım güncellenemedi.");
        } finally {
            setBulkActionLoading(false);
        }
    };

    const rolePriority: Record<"view" | "comment" | "edit", number> = {
        view: 1,
        comment: 2,
        edit: 3
    };

    const bulkSharedRolesSeed = useMemo(() => {
        const merged: Record<string, "view" | "comment" | "edit"> = {};
        const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));

        selectedTasks.forEach(task => {
            const roles = (task.shared_roles || {}) as Record<string, "view" | "comment" | "edit">;
            Object.entries(roles).forEach(([key, role]) => {
                const current = merged[key];
                if (!current || rolePriority[role] > rolePriority[current]) {
                    merged[key] = role;
                }
            });
        });

        return merged;
    }, [tasks, selectedTaskIds]);

    const handleBulkShareUpdateWithRoles = async (
        newSharedWith: string[],
        newSharedRoles: Record<string, "view" | "comment" | "edit">
    ) => {
        if (selectedTaskIds.length === 0) return;

        try {
            setBulkActionLoading(true);
            const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id));
            const results = await Promise.allSettled(
                selectedTasks.map(task => {
                    const mergedRoles = {
                        ...((task.shared_roles || {}) as Record<string, "view" | "comment" | "edit">),
                        ...newSharedRoles
                    };
                    return updateTask(task.id, {
                        pending_collaborators: Array.from(new Set([...(task.pending_collaborators || []), ...newSharedWith])),
                        shared_roles: mergedRoles
                    });
                })
            );

            const successCount = results.filter(result => result.status === "fulfilled").length;
            const failedTaskIds = selectedTasks
                .filter((_, index) => results[index].status === "rejected")
                .map(task => task.id);

            if (effectiveUid) refreshTasks(effectiveUid);
            setSelectedTaskIds(failedTaskIds);

            if (failedTaskIds.length === 0) {
                toast.success(`${successCount} görev için rol bazlı paylaşım güncellendi.`);
            } else {
                toast.error(`${successCount} başarılı, ${failedTaskIds.length} başarısız.`);
            }
        } catch {
            toast.error("Toplu paylaşım yetkileri güncellenemedi.");
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleOpenTaskFolder = async (task: Task) => {
        if (!isElectron) {
            toast.error("Klasör açma işlemi sadece masaüstü uygulamasında aktiftir.");
            return;
        }
        try {
            await openTaskFolder(task.id);
            toast.success("Klasör açılıyor...");
        } catch (error) {
            toast.error("Klasör açılamadı.");
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            setSaving(true);
            // 1. Find and delete all associated audits first (Cascading Delete)
            const allAudits = await fetchAudits(effectiveUid, effectiveEmail, true);
            const associatedAudits = allAudits.filter(a => 
                String(a.task_id).trim() === String(deleteConfirmId).trim()
            );
            
            if (associatedAudits.length > 0) {
                await Promise.all(associatedAudits.map(a => deleteAudit(a.id)));
                invalidateAuditCache();
            }

            // 2. Delete the task itself
            await deleteTask(deleteConfirmId);
            toast.success("Görev ve ilişkili tüm raporlar başarıyla silindi.");
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch (error) { 
            console.error("Silme hatası:", error);
            toast.error("Silme işlemi başarısız.");
        } finally {
            setSaving(false);
            setDeleteConfirmId(null);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !effectiveUid) return;

        setImportLoading(true);
        const loadingToast = toast.loading("Excel dosyası işleniyor...");
        try {
            const result = await importTasksFromExcel(effectiveUid, file);
            toast.success(`${result.imported} görev başarıyla içe aktarıldı.`, { id: loadingToast });
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch (error: any) {
            toast.error(error.message || "İçe aktarma hatası.", { id: loadingToast });
        } finally {
            setImportLoading(false);
            if (e.target) e.target.value = "";
        }
    };

    const handleUploadLegacyReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !showReportSelector || !effectiveUid) return;

        const loadingToast = toast.loading(`${file.name} yükleniyor...`);
        try {
            // 1. Dosyayı yükle
            const { uploadFile } = await import("../lib/api/files");
            const uploadResult = await uploadFile(file, `raporlar/${showReportSelector.rapor_kodu}`, effectiveUid);
            
            // 2. Audit kaydı oluştur
            const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;
            const auditPayload: any = {
                task_id: showReportSelector.id,
                title: file.name,
                location: "Geçmiş Kayıt",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: profile?.full_name || currentUser?.displayName || "Müfettiş",
                status: "Tamamlandı",
                report_content: `<p>Bu rapor bir dosya ekidir: <a href="${uploadResult.url}">${file.name}</a></p>`,
                attachment_url: uploadResult.url,
                file_name: file.name,
                owner_id: effectiveUid,
                assigned_to: Array.from(new Set([...(showReportSelector.assigned_to || []), effectiveUid])),
                report_seq: nextSeq,
                report_created: true
            };

            await createAudit(auditPayload);
            toast.success("Eski rapor dosyası başarıyla eklendi.", { id: loadingToast });
            
            // Raporları tazele
            handleOpenReportSelector(showReportSelector);
        } catch (error) {
            console.error("Yükleme hatası:", error);
            toast.error("Rapor dosyası eklenemedi.", { id: loadingToast });
        } finally {
            if (e.target) e.target.value = "";
        }
    };

    const handleAddStep = async (task: Task) => {
        const text = newStepText[task.id]?.trim();
        if (!text) return;
        const updatedSteps: TaskStep[] = [...(task.steps || []), { text, done: false }];
        try {
            await updateTask(task.id, { steps: updatedSteps });
            if (effectiveUid) refreshTasks(effectiveUid);
            setNewStepText(prev => ({ ...prev, [task.id]: "" }));
        } catch { /* silent */ }
    };

    const handleToggleStep = async (task: Task, index: number) => {
        const updatedSteps = (task.steps || []).map((s, i) => i === index ? { ...s, done: !s.done } : s);
        try {
            await updateTask(task.id, { steps: updatedSteps });
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch { /* silent */ }
    };

    const handleDeleteStep = async (task: Task, index: number) => {
        const updatedSteps = (task.steps || []).filter((_, i) => i !== index);
        try {
            await updateTask(task.id, { steps: updatedSteps });
            if (effectiveUid) refreshTasks(effectiveUid);
        } catch { /* silent */ }
    };

    const handleOpenReportSelector = async (task: Task) => {
        try {
            setLoading(true);
            // Hem UID hem Email ile sorgulayarak yetki kapsamını genişletiyoruz
            const allAudits = await fetchAudits(effectiveUid || "", currentUser?.email || undefined, true);
            const associated = allAudits.filter(a => String(a.task_id).trim() === String(task.id).trim());
            setTaskAudits(associated);

            const nextSeq = getNextReportSequence(allAudits);

            if (associated.length > 0) {
                setShowReportSelector(task);
            } else {
                setNewAudit({
                    ...newAudit,
                    title: getNextReportTitle(task, tasks, 0),
                    location: "",
                    report_seq: nextSeq
                });
                setIsNewAuditModalOpen(task);
            }
        } catch (error) {
            toast.error("Raporlar yüklenemedi.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAuditFromTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isNewAuditModalOpen) return;
        
        try {
            setSaving(true);
            
            // Görevden ekip üyelerini ve gizlilik durumunu miras al
            const taskAssigned = isNewAuditModalOpen.assigned_to || [];
            const taskShared = isNewAuditModalOpen.shared_with || [];
            const isPublic = (isNewAuditModalOpen as any).is_public === true;
            
            // Unik liste (owner_id dahil)
            const combinedAssigned = Array.from(new Set([...taskAssigned, effectiveUid]));

            const auditPayload: any = {
                task_id: isNewAuditModalOpen.id,
                title: newAudit.title,
                location: newAudit.location,
                date: newAudit.date,
                inspector: newAudit.inspector,
                status: "Devam Ediyor",
                report_content: RAPOR_SABLONLARI[newAudit.template] || "",
                owner_id: effectiveUid,
                assigned_to: combinedAssigned,
                shared_with: taskShared,
                is_public: isPublic,
                report_seq: newAudit.report_seq || 1,
                report_created: true
            };
            
            const created = await createAudit(auditPayload);
            
            // Görev durumunu otomatik olarak "Devam Ediyor" yap (arkaplanda)
            if (isNewAuditModalOpen.rapor_durumu === "Başlanmadı") {
                updateTask(isNewAuditModalOpen.id, { rapor_durumu: "Devam Ediyor" }).catch(err => {
                    console.error("Failed to update task status:", err);
                });
            }

            setIsNewAuditModalOpen(null);
            setShowReportSelector(null);
            toast.success(`Denetim (/#${newAudit.report_seq}) başlatıldı.`);
            
            // Rapor seq ne olursa olsun doğrudan düzenleyiciye git (kullanıcı beklentisi)
            navigate(`/audit/${created.id}/report`);
        } catch (error) {
            toast.error("Denetim oluşturulamadı.");
        } finally {
            setSaving(false);
        }
    };

    const handleSablonSec = async (taskId: string, sablonName: string) => {
        try {
            setShowSablonModal(null);
            setShowReportSelector(null);
            setLoading(true);
            
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            // 1. Get existing audits to determine next sequence number
            const existingAudits = await fetchAudits(effectiveUid || "", currentUser?.email || undefined, true);
            const taskAudits = existingAudits.filter(a => String(a.task_id).trim() === String(taskId).trim());
            const nextSeq = getNextReportSequence(existingAudits);

            const auditPayload: any = {
                task_id: taskId,
                title: getNextReportTitle(task, tasks, taskAudits.length),
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                status: "Rapor Yazılıyor",
                inspector: currentUser?.email?.split('@')[0] || "Müfettiş",
                owner_id: effectiveUid,
                report_content: RAPOR_SABLONLARI[sablonName] || "",
                assigned_to: Array.from(new Set([...(task.assigned_to || []), effectiveUid])),
                shared_with: task.shared_with || [],
                is_public: (task as any).is_public === true,
                report_seq: nextSeq,
                report_created: true
            };

            const newAudit = await createAudit(auditPayload);
            
            // Görev durumunu güncelle (arkaplanda)
            if (task.rapor_durumu === "Başlanmadı") {
                updateTask(task.id, buildStatusUpdatePayload(task, "Devam Ediyor")).catch(err => {
                    console.error("Failed to update task status:", err);
                });
            }

            toast.success(`Rapor #${nextSeq} oluşturuldu.`);
            navigate(`/audit/${newAudit.id}/report`);
        } catch (error) {
            console.error("Entegrasyon hatası:", error);
            toast.error("Rapor oluşturma işlemi başarısız.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingTask) return;
        try {
            let cleanRaporKodu = editingTask.rapor_kodu ? editingTask.rapor_kodu.trim() : "";
            if (cleanRaporKodu) {
                cleanRaporKodu = cleanRaporKodu.split(',')
                    .map(part => {
                        let p = part.trim();
                        p = p.replace(/_(\d{4}-)/g, "/$1");
                        if (p.includes("_") && !p.includes("/")) {
                            const lastUnder = p.lastIndexOf("_");
                            if (lastUnder !== -1) {
                                p = p.substring(0, lastUnder) + "/" + p.substring(lastUnder + 1);
                            }
                        }
                        return p;
                    })
                    .join(", ");
            }
            await updateTask(editingTask.id, {
                rapor_kodu: cleanRaporKodu,
                rapor_adi: editingTask.rapor_adi,
                rapor_turu: editingTask.rapor_turu,
                baslama_tarihi: editingTask.baslama_tarihi,
                sure_gun: editingTask.sure_gun,
                parent_task_id: editingTask.parent_task_id || ""
            });
            if (effectiveUid) refreshTasks(effectiveUid);
            toast.success("Görev güncellendi.");
            setEditingTask(null);
        } catch { toast.error("Kaydedilemedi."); }
    };

    const handleShareUpdate = async (
        newSharedWith: string[],
        newSharedRoles?: Record<string, "view" | "comment" | "edit">
    ) => {
        if (!shareTask) return;
        try {
            await updateTask(shareTask.id, {
                pending_collaborators: newSharedWith,
                ...(newSharedRoles ? { shared_roles: newSharedRoles } : {})
            });
            if (effectiveUid) refreshTasks(effectiveUid);
            toast.success("Görev paylaşım davetleri gönderildi.");
        } catch { toast.error("Paylaşım güncellenemedi."); }
    };

    const getCompletedDays = (task: Task) => {
        if (typeof task.completed_in_days === "number" && Number.isFinite(task.completed_in_days)) {
            return task.completed_in_days;
        }
        if (!task.baslama_tarihi) return null;
        const start = new Date(task.baslama_tarihi);
        const endSource = task.completed_at || task.created_at;
        const end = endSource ? new Date(endSource) : new Date();
        return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
    };

    const getSureInfo = (task: Task) => {
        if (!task.baslama_tarihi || !task.sure_gun) return null;
        const start = new Date(task.baslama_tarihi);
        if (task.rapor_durumu === "Tamamlandı") {
            const completedInDays = getCompletedDays(task);
            return { diff: 0, end: start, total: task.sure_gun, completedInDays, isCompleted: true };
        }
        const end = new Date(start);
        end.setDate(end.getDate() + task.sure_gun);
        const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24));
        return { diff, end, total: task.sure_gun, completedInDays: null, isCompleted: false };
    };

    const buildStatusUpdatePayload = (task: Task, newStatus: string) => {
        const prevStatus = task.rapor_durumu || "Başlanmadı";
        const nowIso = new Date().toISOString();
        const currentHistory = Array.isArray(task.status_history) ? [...task.status_history] : [];

        if (prevStatus !== newStatus) {
            currentHistory.push({
                status: newStatus,
                changed_at: nowIso,
                from: prevStatus,
                to: newStatus
            });
        }

        const payload: any = {
            rapor_durumu: newStatus,
            status_history: currentHistory
        };

        if (newStatus === "Tamamlandı" && !task.completed_at) {
            const completedDays = getCompletedDays(task) ?? 0;
            payload.completed_at = nowIso;
            payload.completed_in_days = completedDays;
        }

        return payload;
    };

    const updateTaskStatus = async (task: Task, newStatus: string) => {
        const currentCode = task.rapor_kodu || "";
        const isDraft = !currentCode || currentCode.startsWith("TASLAK-");
        if ((newStatus === "İncelemede" || newStatus === "Tamamlandı") && isDraft) {
            const confirmed = await confirm({
                title: "Rapor Kodu Oluşturulacak",
                message: "Bu görevi ilk kez 'İncelemede' veya 'Tamamlandı' aşamasına aldığınızda resmi Rapor Kodu (Görev No) üretilecektir. Daha sonra bu işlemi geri alsanız dahi atanan Rapor Kodu korunacaktır. Devam etmek istiyor musunuz?",
                confirmText: "Devam Et",
                cancelText: "İptal",
                variant: "warning"
            });
            if (!confirmed) {
                if (effectiveUid) refreshTasks(effectiveUid);
                return;
            }
        }
        const payload = buildStatusUpdatePayload(task, newStatus);
        await updateTask(task.id, payload);
    };

    const getTaskTimeline = (task: Task) => {
        const history = Array.isArray(task.status_history) ? [...task.status_history] : [];
        if (history.length === 0) {
            const createdFallback = task.created_at || new Date().toISOString();
            history.push({ status: task.rapor_durumu || "Başlanmadı", changed_at: createdFallback, to: task.rapor_durumu || "Başlanmadı" });
        }
        history.sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
        return history;
    };

    const buildTaskAnalysisText = (task: Task) => {
        const timeline = getTaskTimeline(task);
        const rows = timeline.map((item: any, idx: number) => {
            const dateText = new Date(item.changed_at).toLocaleString("tr-TR");
            const fromText = item.from ? `${item.from} -> ` : "";
            return `${idx + 1}. ${dateText}: ${fromText}${item.to || item.status}`;
        });

        const completedDays = getCompletedDays(task);
        const summary = task.rapor_durumu === "Tamamlandı"
            ? `Tamamlanma süresi: ${completedDays ?? 0} gün`
            : `Kalan süre: ${getSureInfo(task)?.diff ?? "-"} gün`;

        return [
            `Rapor: ${task.rapor_kodu}`,
            `Görev: ${task.rapor_adi}`,
            `Durum: ${task.rapor_durumu}`,
            summary,
            "",
            "Durum Geçmişi:",
            ...rows
        ].join("\n");
    };

    const statusFilter = searchParams.get("status");

    const filtered = tasks.filter(t => {
        // Alt görevleri ana listede gösterme
        if (t.parent_task_id) return false;

        const children = tasks.filter(c => c.parent_task_id === t.id);
        const matchesSearch = t.rapor_adi?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               t.rapor_kodu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               children.some(c => c.rapor_adi?.toLowerCase().includes(searchQuery.toLowerCase()) || c.rapor_kodu?.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatusFilter = statusFilter === "active"
            ? t.rapor_durumu !== "Tamamlandı"
            : statusFilter === "completed"
                ? t.rapor_durumu === "Tamamlandı"
                : true;
        
        // 2 yıl (730 gün) kuralı
        const isOld = t.baslama_tarihi ? (Date.now() - new Date(t.baslama_tarihi).getTime() > 730 * 24 * 60 * 60 * 1000) : false;
        
        // Arşiv Şartı: 1. Görev Tamamlanmış Olacak VE 2. Üzerinden 2 yıl geçmiş olacak.
        const isArchived = (t.rapor_durumu === "Tamamlandı") && isOld;
        
        // Sekme mantığı: 'ortak' sekmesi artık 'Arşiv' sekmesi oldu.
        const matchesTab = activeTab === 'ortak' ? isArchived : !isArchived;
        
        return matchesSearch && matchesTab && matchesStatusFilter;
    });

    const sortedFiltered = useMemo(() => {
        const items = [...filtered];
        const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1;

        items.sort((a, b) => {
            switch (sortConfig.key) {
                case "rapor_kodu": {
                    const isDraftA = !a.rapor_kodu || a.rapor_kodu.startsWith("TASLAK-");
                    const isDraftB = !b.rapor_kodu || b.rapor_kodu.startsWith("TASLAK-");
                    
                    if (isDraftA !== isDraftB) {
                        return (isDraftA ? 1 : -1) * directionMultiplier;
                    }

                    const parseRaporKodu = (kodu?: string) => {
                        if (!kodu) return { year: 0, seq: 0 };
                        const parts = kodu.split(',').map(p => p.trim()).filter(Boolean);
                        if (parts.length === 0) return { year: 0, seq: 0 };
                        
                        const targetCode = parts[0];
                        const match = targetCode.match(/(\d{4})-(\d+)/);
                        if (match) {
                            return { year: parseInt(match[1]) || 0, seq: parseInt(match[2]) || 0 };
                        }
                        const yearMatch = targetCode.match(/(\d{4})/);
                        if (yearMatch) {
                            return { year: parseInt(yearMatch[1]) || 0, seq: 0 };
                        }
                        return { year: 0, seq: 0 };
                    };

                    const parsedA = parseRaporKodu(a.rapor_kodu);
                    const parsedB = parseRaporKodu(b.rapor_kodu);

                    if (parsedA.year !== parsedB.year) {
                        return (parsedA.year - parsedB.year) * directionMultiplier;
                    }
                    if (parsedA.seq !== parsedB.seq) {
                        return (parsedA.seq - parsedB.seq) * directionMultiplier;
                    }

                    const aCode = String(a.rapor_kodu || "");
                    const bCode = String(b.rapor_kodu || "");
                    return aCode.localeCompare(bCode, "tr", { numeric: true, sensitivity: "base" }) * directionMultiplier;
                }
                case "rapor_adi": {
                    const aName = String(a.rapor_adi || "");
                    const bName = String(b.rapor_adi || "");
                    return aName.localeCompare(bName, "tr", { sensitivity: "base" }) * directionMultiplier;
                }
                case "rapor_turu": {
                    const aType = String(a.rapor_turu || "");
                    const bType = String(b.rapor_turu || "");
                    return aType.localeCompare(bType, "tr", { sensitivity: "base" }) * directionMultiplier;
                }
                case "sure": {
                    const aDiff = getSureInfo(a)?.diff ?? Number.POSITIVE_INFINITY;
                    const bDiff = getSureInfo(b)?.diff ?? Number.POSITIVE_INFINITY;
                    return (aDiff - bDiff) * directionMultiplier;
                }
                case "rapor_durumu": {
                    const aIndex = RAPOR_DURUMLARI.indexOf(a.rapor_durumu || "");
                    const bIndex = RAPOR_DURUMLARI.indexOf(b.rapor_durumu || "");
                    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
                    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
                    return (safeA - safeB) * directionMultiplier;
                }
                default:
                    return 0;
            }
        });

        return items;
    }, [filtered, sortConfig]);

    const toggleSort = (key: "rapor_kodu" | "rapor_adi" | "rapor_turu" | "sure" | "rapor_durumu") => {
        setSortConfig(prev => (
            prev.key === key
                ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
                : { key, direction: "asc" }
        ));
    };

    const getDurumColor = (durum: string) => {
        switch (durum) {
            case "Tamamlandı": return "#10b981"; // Yeşil
            case "Başlanmadı": return "#94a3b8"; // Gri
            case "İncelemede": return "#f59e0b"; // Turuncu/Sarı
            case "Devam Ediyor": return "#3b82f6"; // Mavi
            default: return "#94a3b8";
        }
    };

    const getKalanColor = (diff: number, total: number = 30) => {
        if (diff >= total / 2) return "#10b981"; // Yeşil (Yarısından fazla var)
        if (diff >= 0) return "#3b82f6";        // Mavi (Yarıdan az var)
        if (diff >= -30) return "#fbbf24";     // Sarı (0-1 ay gecikme)
        if (diff >= -90) return "#f97316";     // Turuncu (1-3 ay gecikme)
        return "#ef4444";                      // Kırmızı (3+ ay gecikme)
    };

    const getAuditPlainText = (value?: string) =>
        String(value || "")
            .replace(/<br\s*\/?\s*>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const getAuditQualityState = (audit: any) => {
        const contentText = getAuditPlainText(audit?.report_content);
        const wordCount = contentText.split(" ").filter(Boolean).length;

        const criticalFailures = [
            !String(audit?.title || "").trim(),
            !String(audit?.date || "").trim(),
            !String(audit?.location || "").trim(),
            !String(audit?.task_id || "").trim(),
            wordCount < 120
        ].filter(Boolean).length;

        return {
            ready: criticalFailures === 0,
            criticalFailures,
            wordCount
        };
    };

    const taskAuditQualitySummary = useMemo(() => {
        const total = taskAudits.length;
        if (total === 0) return { total: 0, ready: 0, withCriticalIssues: 0 };

        const ready = taskAudits.filter((audit) => getAuditQualityState(audit).ready).length;
        return {
            total,
            ready,
            withCriticalIssues: total - ready
        };
    }, [taskAudits]);

    const handleExportTasksCsv = () => {
        const selectedSet = new Set(selectedTaskIds);
        const baseTasks = selectedSet.size > 0
            ? sortedFiltered.filter(task => selectedSet.has(task.id))
            : sortedFiltered;

        if (baseTasks.length === 0) {
            toast.error("Dışa aktarılacak görev bulunamadı.");
            return;
        }

        const escapeCsv = (value: unknown) => {
            const text = String(value ?? "").replace(/"/g, '""');
            return `"${text}"`;
        };

        const header = [
            "Sıra",
            "Görev Adı",
            "Görev Türü",
            "Görev Tarihi",
            "Süre (Gün)",
            "Durum",
            "Ekip Kişi Sayısı",
            "Bekleyen Davet",
            "Kabul Eden"
        ];

        const lines = baseTasks.map((task, idx) => [
            idx + 1,
            task.rapor_adi,
            task.rapor_turu,
            task.baslama_tarihi,
            task.sure_gun,
            task.rapor_durumu,
            (task.assigned_to || []).length,
            (task.pending_collaborators || []).length,
            (task.accepted_collaborators || []).length
        ].map(escapeCsv).join(","));

        const csvContent = [header.map(escapeCsv).join(","), ...lines].join("\n");
        const blob = new Blob([`\ufeff${csvContent}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `gorevler_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        toast.success(`${baseTasks.length} görev CSV olarak dışa aktarıldı.`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-full overflow-x-hidden">
            {/* Global Search Button */}
            <div className="flex justify-end mb-2">
                <button
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    onClick={handleOpenGlobalSearch}
                    title="Tüm raporlarda ve görevlerde arama yap"
                >
                    <Search size={18} />
                    <span className="font-semibold text-xs">Global Arama</span>
                </button>
            </div>

            {/* Global Search Modal */}
            {isSearchModalOpen && (
                <div style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 8px 32px #0002", padding: 32, minWidth: 340, maxWidth: 480, width: "100%", position: "relative" }}>
                        <button onClick={handleCloseGlobalSearch} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer" }} title="Kapat"><X size={22} /></button>
                        <form onSubmit={handleGlobalSearch} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={globalSearchQuery}
                                onChange={e => setGlobalSearchQuery(e.target.value)}
                                placeholder="Rapor, görev, içerik ara..."
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                autoFocus
                            />
                            <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition" disabled={globalSearchLoading}>
                                {globalSearchLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                            </button>
                        </form>
                        {globalSearchError && <div className="text-red-500 text-xs mb-2">{globalSearchError}</div>}
                        <div className="max-h-72 overflow-y-auto">
                            {globalSearchResults.length === 0 && !globalSearchLoading && (
                                <div className="text-gray-500 text-sm text-center py-8">Arama sonucu yok</div>
                            )}
                            {globalSearchResults.map((result, idx) => (
                                <div
                                    key={result.id + idx}
                                    className="p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-800"
                                    onClick={() => handleGoToSearchResult(result)}
                                >
                                    <div className="font-bold text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
                                        {result.type === "audit" ? <FileText size={16} /> : <ClipboardList size={16} />}
                                        {result.title}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{toPlainTextSnippet(result.snippet)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Standardized Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 font-outfit">
                <div>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 md:mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span className="hidden xs:inline">MufYard Platform</span>
                        <ChevronRight size={10} className="hidden xs:inline" />
                        <span className="text-primary opacity-80 uppercase tracking-widest">GÖREVLER</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                            Görev Yönetimi
                        </h1>
                        {isOffline && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 text-rose-500 rounded-lg border border-rose-500/20 animate-pulse shadow-sm">
                                <WifiOff size={12} className="shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Çevrimdışı Mod</span>
                            </div>
                        )}
                    </div>
                    <p className="text-slate-500 text-[13px] font-medium mt-1 flex items-center gap-2">
                        <Calendar size={14} className="text-primary/40 shrink-0" />
                        <span className="truncate">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</span>
                    </p>
                </div>

                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl w-full lg:w-auto h-11 shrink-0">
                    <button 
                        onClick={() => { setActiveTab("kisisel"); setIsLegacyMode(false); }}
                        className={`flex-1 lg:flex-none px-4 md:px-6 rounded-lg font-black text-[10px] uppercase transition-all tracking-widest whitespace-nowrap ${activeTab === 'kisisel' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Aktif Görevler
                    </button>
                    <button 
                        onClick={() => { setActiveTab("ortak"); setIsLegacyMode(true); }}
                        className={`flex-1 lg:flex-none px-4 md:px-6 rounded-lg font-black text-[10px] uppercase transition-all tracking-widest whitespace-nowrap ${activeTab === 'ortak' ? 'bg-card text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Arşiv Görevler
                    </button>
                </div>
            </div>

            {!isElectron && (
                <div className="mb-8 animate-in slide-in-from-top-4 duration-700">
                    <Card className="p-6 border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30">
                        <div className="flex items-center gap-5 text-amber-800 dark:text-amber-400">
                            <div className="p-3.5 bg-amber-500/20 rounded-2xl shadow-inner">
                                <Shield size={28} className="animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-sm uppercase tracking-widest mb-1">Web Sürümü Kısıtlıdır</h3>
                                <p className="text-xs font-bold leading-relaxed opacity-80">
                                    Görev oluşturma, Excel'den aktarma ve ekip yönetimi gibi kritik işlemler sadece <strong>MufYard Masaüstü Uygulaması</strong> üzerinden gerçekleştirilebilir.
                                </p>
                            </div>
                            <Button 
                                onClick={() => window.open('https://github.com/syaprakli/MufYardV2/releases', '_blank')}
                                className="bg-amber-500 hover:bg-amber-600 text-white border-none rounded-xl font-black text-[10px] px-6 h-10 shadow-lg shadow-amber-500/20"
                            >
                                UYGULAMAYI İNDİR
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {isElectron && (
                <Card className={cn(
                    "p-4 md:p-8 bg-card border shadow-sm mb-6 transition-all",
                    activeTab === 'ortak' ? "border-amber-200 ring-4 ring-amber-500/5" : "border-border"
                )}>
                    <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl transition-colors", activeTab === 'ortak' ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary")}>
                                {activeTab === 'ortak' ? <History size={20} /> : <FileText size={20} />}
                            </div>
                            <h2 className="text-lg font-black font-outfit">
                                {activeTab === 'ortak' ? "Arşive Eski Görev Kaydı Ekle" : "Yeni Görev Oluştur"}
                            </h2>
                        </div>
                    </div>
                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                            <div className={cn("md:col-span-12 space-y-1.5", isLegacyMode ? "lg:col-span-6" : "lg:col-span-9")}>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Görev Adı / Konusu</label>
                                <input
                                    required
                                    placeholder="Örn: X Belediyesi İncelemesi"
                                    value={form.rapor_adi}
                                    onChange={e => setForm({ ...form, rapor_adi: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            {isLegacyMode && (
                                <div className="md:col-span-12 lg:col-span-3 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Görev / Rapor No</label>
                                    <input
                                        required
                                        placeholder="Örn: S.Y.64/2023-1"
                                        value={form.rapor_kodu}
                                        onChange={e => setForm({ ...form, rapor_kodu: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                    />
                                </div>
                            )}
                            <div className="md:col-span-12 lg:col-span-3 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Görev Türü</label>
                                <select
                                    value={form.rapor_turu}
                                    onChange={e => setForm({ ...form, rapor_turu: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none cursor-pointer appearance-none"
                                >
                                    {RAPOR_TURLERI.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>

                        {(form.rapor_turu === "Kyk Yurt Denetimi" || form.rapor_turu === "Özel Yurt Denetimi" || form.rapor_turu === "Spor Kulüpleri Denetimi") && (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mb-4">
                                <div className="md:col-span-12 space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Bağlı Üst Görev (Denetim)</label>
                                    <select
                                        value={form.parent_task_id || ""}
                                        onChange={e => setForm({ ...form, parent_task_id: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none cursor-pointer"
                                    >
                                        <option value="">Seçiniz (Bağlı üst görev yoksa boş bırakın)...</option>
                                        {tasks.filter(t => !t.parent_task_id).map(t => (
                                            <option key={t.id} value={t.id}>{t.rapor_adi} - {t.rapor_turu}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                            <div className="md:col-span-6 lg:col-span-3 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{isLegacyMode ? "Görev Başlangıç Tarihi" : "Görev Tarihi"}</label>
                                <input
                                    type="date"
                                    value={form.baslama_tarihi}
                                    onChange={e => setForm({ ...form, baslama_tarihi: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="md:col-span-6 lg:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{isLegacyMode ? "Görev Bitiş Tarihi" : "Süre (Gün)"}</label>
                                {isLegacyMode ? (
                                    <input
                                        type="date"
                                        value={form.bitis_tarihi}
                                        onChange={e => setForm({ ...form, bitis_tarihi: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                    />
                                ) : (
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.sure_gun}
                                        onChange={e => setForm({ ...form, sure_gun: parseInt(e.target.value) || 30 })}
                                        className="w-full px-4 py-3 rounded-xl border border-border bg-card focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold outline-none"
                                    />
                                )}
                            </div>
                            <div className="md:col-span-12 lg:col-span-7 space-y-1.5 relative" ref={inspectorDropdownRef}>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Görevde Yer Alan Kişiler</label>
                                <div
                                    onClick={() => setShowInspectorDropdown(p => !p)}
                                    className={cn(
                                        "w-full min-h-[48px] px-4 py-2 rounded-xl border bg-card flex flex-wrap items-center gap-1.5 cursor-pointer transition-all focus-within:ring-4 focus-within:ring-primary/10",
                                        showInspectorDropdown ? "border-primary ring-4 ring-primary/10" : "border-border"
                                    )}
                                >
                                    {form.assigned_to.length === 0 ? (
                                        <span className="text-slate-400 text-sm font-medium">Kişi seç veya ara...</span>
                                    ) : (
                                        form.assigned_to.map(id => {
                                            const ins = inspectors.find(i => (i.id || i.email) === id || i.email === id);
                                            return ins ? (
                                                <span key={id} className="inline-flex items-center gap-1 bg-slate-900 text-white rounded-lg px-2 py-1 text-[11px] font-bold">
                                                    {ins.name.split(' ')[0]}
                                                    <span
                                                        onClick={e => { e.stopPropagation(); toggleInspector(id); }}
                                                        className="hover:text-red-400 transition-colors ml-1 p-0.5"
                                                    >×</span>
                                                </span>
                                            ) : null;
                                        })
                                    )}
                                    <span className="ml-auto text-slate-400">
                                        <ChevronRight size={16} className={cn("transition-transform", showInspectorDropdown ? "rotate-90" : "")} />
                                    </span>
                                </div>

                                {showInspectorDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-3 border-b border-border bg-muted/30">
                                            <input
                                                autoFocus
                                                placeholder="İsim ara..."
                                                value={inspectorSearch}
                                                onChange={e => setInspectorSearch(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-full px-4 py-2 rounded-xl border border-border bg-card text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                            {inspectors
                                                .filter(ins => ins.name.toLowerCase().includes(inspectorSearch.toLowerCase()) || ins.email.toLowerCase().includes(inspectorSearch.toLowerCase()))
                                                .map(inspector => {
                                                    const inspectorKey = inspector.id || inspector.email;
                                                    const isSelected = form.assigned_to.includes(inspectorKey);
                                                    return (
                                                        <div
                                                            key={inspector.id}
                                                            onClick={() => toggleInspector(inspectorKey)}
                                                            className={cn(
                                                                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                                                                isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-5 h-5 rounded-md flex items-center justify-center border transition-all",
                                                                isSelected ? "bg-primary border-primary" : "bg-card border-border"
                                                            )}>
                                                                {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-bold truncate">{inspector.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold truncate uppercase tracking-tighter">{inspector.email}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                        <div className="p-3 bg-muted/30 border-t border-border flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{form.assigned_to.length} kişi seçildi</span>
                                            <button type="button" onClick={() => setShowInspectorDropdown(false)} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Tamam</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={saving}
                            className={cn(
                                "w-full h-12 rounded-xl text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg",
                                isLegacyMode ? "bg-amber-500 shadow-amber-200/50" : "bg-primary shadow-primary/20"
                            )}
                        >
                            {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : (isLegacyMode ? <History size={18} className="mr-2" /> : <FileText size={18} className="mr-2" />)}
                            {saving ? "İşleniyor..." : (isLegacyMode ? "Eski Görevi Kaydet" : "Yeni Görev Oluştur")}
                        </Button>
                    </form>
                </Card>
            )}

            {/* Bekleyen Görev Davetleri */}
            {invitations.length > 0 && activeTab === 'kisisel' && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 mb-8 font-inter">
                    <div className="flex items-center gap-2 px-1 text-amber-600">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <h3 className="text-xs font-black tracking-widest font-outfit">Bekleyen Görev Davetleri ({invitations.length})</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 flex flex-col justify-between group hover:bg-amber-50 transition-all shadow-sm">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-lg tracking-widest">Yeni Atama</span>
                                        <span className="text-[10px] font-bold text-amber-500">{inv.rapor_turu}</span>
                                    </div>
                                    <h4 className="font-bold text-foreground dark:text-slate-100 text-sm mb-1">{inv.rapor_adi}</h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-4 italic flex items-center gap-1">
                                        <UserPlus size={10} /> Gönderen: {getSenderName(inv)}
                                    </p>
                                </div>
                                {isElectron ? (
                                    <div className="flex gap-2 w-full mt-2">
                                        <button 
                                            onClick={() => handleAcceptInvitation(inv.id)} 
                                            className="flex-1 rounded-xl h-10 font-black text-[9px] bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200/30 uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            Kabul Et
                                        </button>
                                        <button 
                                            onClick={() => handleRejectInvitation(inv.id)} 
                                            className="flex-1 rounded-xl h-10 font-black text-[9px] bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-200/30 uppercase tracking-widest transition-all active:scale-95"
                                        >
                                            Reddet
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        disabled
                                        className="w-full rounded-xl h-10 font-bold text-[9px] bg-slate-200 text-slate-400 uppercase tracking-widest shadow-none cursor-not-allowed"
                                    >
                                        Kabul/Reddet İçin Masaüstü Uygulamasını Açın
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Görev Listesi */}
            <Card className="overflow-hidden border border-border shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 md:p-6 border-b border-border bg-muted/20">
                    <h3 className="text-xl font-black font-outfit text-slate-900 dark:text-slate-100 tracking-tight">
                        {activeTab === 'ortak' ? "Arşiv Görev Listesi" : "Aktif Görev Listesi"}
                    </h3>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                        <input
                            type="file"
                            ref={importInputRef}
                            onChange={handleImportExcel}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        {isElectron && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={importLoading}
                                onClick={() => importInputRef.current?.click()}
                                className="w-full sm:w-auto h-11 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                                {importLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : <FileDigit size={14} className="mr-2" />}
                                Excel'den İçe Aktar
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExportTasksCsv}
                            className="w-full sm:w-auto h-11 px-4 rounded-xl border border-border text-slate-500 hover:text-primary hover:border-primary transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <Download size={14} className="mr-2" />
                            {selectedTaskIds.length > 0 ? `Seçiliyi CSV (${selectedTaskIds.length})` : "CSV Dışa Aktar"}
                        </Button>
                        <div className="relative w-full lg:w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                placeholder="Görev adı veya konusu ile ara..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                            />
                        </div>
                        {statusFilter && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams);
                                    params.delete("status");
                                    setSearchParams(params);
                                }}
                                className="w-full sm:w-auto h-11 px-4 rounded-xl border border-primary/30 text-primary font-black text-[10px] uppercase tracking-widest"
                            >
                                Durum Filtresini Kaldır
                            </Button>
                        )}
                    </div>
                </div>

                {selectedTaskIds.length > 0 && (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 md:px-6 md:py-4 border-b border-border bg-primary/5">
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 rounded-full bg-primary text-white text-[10px] font-black uppercase tracking-widest">
                                {selectedTaskIds.length} seçili
                            </div>
                            <button type="button" onClick={clearTaskSelection} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700">
                                Seçimi Temizle
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsBulkShareModalOpen(true)} disabled={bulkActionLoading || !isElectron} className="rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Toplu Paylaş
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => bulkUpdateSelectedTasks("Başlanmadı")} disabled={bulkActionLoading} className="rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Başlanmadı
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => bulkUpdateSelectedTasks("Devam Ediyor")} disabled={bulkActionLoading} className="rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Devam Ediyor
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => bulkUpdateSelectedTasks("Tamamlandı")} disabled={bulkActionLoading} className="rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Tamamlandı
                            </Button>
                            <Button variant="outline" size="sm" onClick={bulkDeleteSelectedTasks} disabled={bulkActionLoading} className="rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-600 border-rose-200 hover:bg-rose-50">
                                Toplu Sil
                            </Button>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    {/* Mobile Task List (Cards) */}
                    <div className="lg:hidden divide-y divide-border">
                        {loading ? (
                            <div className="p-12 flex flex-col items-center justify-center space-y-4">
                                <Loader2 size={32} className="animate-spin text-primary" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Görevler Yükleniyor...</p>
                            </div>
                        ) : sortedFiltered.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 font-bold text-sm">Kayıt bulunamadı.</div>
                        ) : (
                            sortedFiltered.map(task => {
                                const sureInfo = getSureInfo(task);
                                const statusColor = getDurumColor(task.rapor_durumu);
                                const timeColor = sureInfo ? (sureInfo.isCompleted ? '#10b981' : getKalanColor(sureInfo.diff, sureInfo.total)) : '#94a3b8';
                                const isSelected = selectedTaskIds.includes(task.id);
                                
                                return (
                                    <div key={task.id} className={cn("p-4 space-y-4 transition-all", isSelected && "bg-primary/5 ring-1 ring-primary/20") }>
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-primary tracking-widest">
                                                        {task.rapor_kodu && !task.rapor_kodu.startsWith("TASLAK-") ? task.rapor_kodu : (activeTab === 'ortak' ? (task.rapor_kodu || "-") : (sortedFiltered.indexOf(task) + 1))}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">{task.rapor_turu}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{task.rapor_adi}</h4>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleTaskSelection(task.id)}
                                                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                                    aria-label={`${task.rapor_kodu} görevini seç`}
                                                />
                                                <button 
                                                    onClick={() => setExpandedRow(expandedRow === task.id ? null : task.id)}
                                                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400"
                                                >
                                                    <ChevronRight size={16} className={cn("transition-transform", expandedRow === task.id ? "rotate-90" : "")} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Süre</span>
                                                    <span className="text-xs font-black" style={{ color: timeColor }}>
                                                        {sureInfo
                                                            ? (sureInfo.isCompleted ? `${sureInfo.completedInDays ?? 0} Günde Tamamlandı` : `${sureInfo.diff} Gün`)
                                                            : '—'}
                                                    </span>
                                                </div>
                                                <div className="w-px h-6 bg-slate-200" />
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Durum</span>
                                                    <select
                                                        disabled={!isElectron}
                                                        value={task.rapor_durumu}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            try {
                                                                await updateTaskStatus(task, newStatus);
                                                                if (effectiveUid) refreshTasks(effectiveUid);
                                                                toast.success("Durum güncellendi.");
                                                            } catch { toast.error("Hata oluştu."); }
                                                        }}
                                                        className={cn("text-[10px] font-black tracking-tight bg-transparent border-none p-0 outline-none cursor-pointer", !isElectron && "opacity-50 cursor-not-allowed")}
                                                        style={{ color: statusColor }}
                                                    >
                                                        {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                <ActionBtn title="İş Adımları" color="#3b82f6" onClick={() => setExpandedRow(expandedRow === task.id ? null : task.id)}>
                                                    <ClipboardList size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Klasörü Aç" color="#64748b" onClick={() => handleOpenTaskFolder(task)}>
                                                    <FolderOpen size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Raporları Gör" color="#10b981" onClick={() => handleOpenReportSelector(task)}>
                                                    <FileText size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Düzenle" color="#f59e0b" onClick={() => isElectron ? setEditingTask(task) : toast.error("Düzenleme sadece masaüstü uygulamasında aktiftir.")}>
                                                    <Edit3 size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => isElectron ? setShareTask(task) : toast.error("Paylaşım sadece masaüstü uygulamasında aktiftir.")}>
                                                    <UserPlus size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Analiz Et" color="#0ea5e9" onClick={() => isElectron ? setAnalysisTask(task) : toast.error("Analiz sadece masaüstü uygulamasında aktiftir.")}>
                                                    <FileDigit size={14} />
                                                </ActionBtn>
                                                <ActionBtn title="Sil" color="#ef4444" onClick={() => isElectron ? handleDelete(task.id) : toast.error("Silme işlemi sadece masaüstü uygulamasında aktiftir.")}>
                                                    <Trash2 size={14} />
                                                </ActionBtn>
                                            </div>
                                        </div>

                                        {expandedRow === task.id && (
                                            <div className="mt-4 pt-4 border-t border-border space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                {(() => {
                                                    const childTasks = tasks.filter(t => t.parent_task_id === task.id);
                                                    return childTasks.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bağlı Alt Görevler ({childTasks.length})</h5>
                                                            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-muted/20">
                                                                {childTasks.map(child => {
                                                                    return (
                                                                        <div key={child.id} className="p-3 bg-card space-y-3">
                                                                            <div className="flex justify-between items-start">
                                                                                <div>
                                                                                    <h6 className="text-xs font-bold text-slate-900 dark:text-slate-100">{child.rapor_adi}</h6>
                                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{child.rapor_turu}</p>
                                                                                </div>
                                                                                <span className="text-[9px] font-black text-slate-500">{child.rapor_turu}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <select
                                                                                    disabled={!isElectron}
                                                                                    value={child.rapor_durumu}
                                                                                    onChange={async (e) => {
                                                                                        const newStatus = e.target.value;
                                                                                        try {
                                                                                            await updateTaskStatus(child, newStatus);
                                                                                            if (effectiveUid) refreshTasks(effectiveUid);
                                                                                            toast.success("Durum güncellendi.");
                                                                                        } catch { toast.error("Hata oluştu."); }
                                                                                    }}
                                                                                    className={cn("bg-transparent text-[10px] font-black tracking-widest outline-none cursor-pointer p-1 rounded-lg hover:bg-slate-100", !isElectron && "opacity-50 cursor-not-allowed")}
                                                                                    style={{ color: getDurumColor(child.rapor_durumu) }}
                                                                                >
                                                                                    {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                                                </select>
                                                                                <div className="flex gap-1">
                                                                                    <ActionBtn title="Dosya Aç" color="#64748b" onClick={() => handleOpenTaskFolder(child)}>
                                                                                        <FolderOpen size={12} />
                                                                                    </ActionBtn>
                                                                                    <ActionBtn title="Raporları Gör" color="#10b981" onClick={() => handleOpenReportSelector(child)}>
                                                                                        <FileText size={12} />
                                                                                    </ActionBtn>
                                                                                    <ActionBtn title="Görevi Düzenle" color="#f59e0b" onClick={() => isElectron ? setEditingTask(child) : toast.error("Düzenleme sadece masaüstü uygulamasında aktiftir.")}>
                                                                                        <Edit3 size={12} />
                                                                                    </ActionBtn>
                                                                                    <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => isElectron ? setShareTask(child) : toast.error("Paylaşım sadece masaüstü uygulamasında aktiftir.")}>
                                                                                        <UserPlus size={12} />
                                                                                    </ActionBtn>
                                                                                    <ActionBtn title="Sil" color="#ef4444" onClick={() => isElectron ? handleDelete(child.id) : toast.error("Silme işlemi sadece masaüstü uygulamasında aktiftir.")}>
                                                                                        <Trash2 size={12} />
                                                                                    </ActionBtn>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="space-y-3">
                                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İş Adımları</h5>
                                                    <div className="space-y-2">
                                                        {(task.steps || []).map((step: any, idx: number) => (
                                                            <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded-lg">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(task, idx)} className="w-4 h-4 rounded border-border" />
                                                                    <span className={cn("text-xs font-medium truncate", step.done ? "line-through text-slate-400" : "text-slate-700")}>{step.text}</span>
                                                                </div>
                                                                <button onClick={() => handleDeleteStep(task, idx)} className="text-rose-400 p-1"><X size={14} /></button>
                                                            </div>
                                                        ))}
                                                        {isElectron && (
                                                            <div className="flex gap-2">
                                                                <input
                                                                    placeholder="Yeni adım ekle..."
                                                                    value={newStepText[task.id] || ""}
                                                                    onChange={e => setNewStepText({ ...newStepText, [task.id]: e.target.value })}
                                                                    onKeyDown={e => e.key === 'Enter' && handleAddStep(task)}
                                                                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-xs font-medium outline-none"
                                                                />
                                                                <Button onClick={() => handleAddStep(task)} size="sm" className="h-9 px-3 text-[10px] font-black uppercase">EKLE</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Task Table */}
                    <table className="hidden lg:table w-full border-collapse">
                        <thead>
                            <tr className="bg-muted/30">
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left w-12 border-b border-border font-outfit">
                                    <input
                                        type="checkbox"
                                        checked={sortedFiltered.length > 0 && sortedFiltered.every(task => selectedTaskIds.includes(task.id))}
                                        onChange={toggleSelectAllVisibleTasks}
                                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                    <button type="button" onClick={() => toggleSort("rapor_kodu")} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                                        Sıra <ArrowUpDown size={12} />
                                    </button>
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                    <button type="button" onClick={() => toggleSort("rapor_adi")} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                                        Görev Adı <ArrowUpDown size={12} />
                                    </button>
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                    <button type="button" onClick={() => toggleSort("rapor_turu")} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                                        Görev Türü <ArrowUpDown size={12} />
                                    </button>
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                    <button type="button" onClick={() => toggleSort("sure")} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                                        Süre <ArrowUpDown size={12} />
                                    </button>
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">
                                    <button type="button" onClick={() => toggleSort("rapor_durumu")} className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                                        Durum <ArrowUpDown size={12} />
                                    </button>
                                </th>
                                <th className="px-1 md:px-2 xl:px-4 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-border font-outfit">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <Loader2 size={32} className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            ) : sortedFiltered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">Kayıt bulunamadı.</td>
                                </tr>
                            ) : (
                                sortedFiltered.map(task => {
                                    const isExpanded = expandedRow === task.id;
                                    const sureInfo = getSureInfo(task);
                                    const isSelected = selectedTaskIds.includes(task.id);
                                    return (
                                        <React.Fragment key={task.id}>
                                            <tr className={cn("hover:bg-muted/50 transition-colors", isExpanded ? "bg-muted/50" : "bg-transparent")}>
                                                <td className="px-1 md:px-2 xl:px-4 py-3 align-middle">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleTaskSelection(task.id)}
                                                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3">
                                                    <span className="font-black text-primary text-[11px] tracking-widest font-outfit">
                                                        {task.rapor_kodu && !task.rapor_kodu.startsWith("TASLAK-") ? task.rapor_kodu : (activeTab === 'ortak' ? (task.rapor_kodu || "-") : (sortedFiltered.indexOf(task) + 1))}
                                                    </span>
                                                </td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3 max-w-[100px] md:max-w-[150px] lg:max-w-[200px] xl:max-w-[320px] landscape:max-w-[120px] md:landscape:max-w-[180px] lg:landscape:max-w-[240px] xl:landscape:max-w-[320px]">
                                                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm break-words whitespace-normal line-clamp-2" title={task.rapor_adi}>
                                                        {task.rapor_adi}
                                                    </div>
                                                </td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3"><span className="font-bold text-slate-400 text-[11px]">{task.rapor_turu}</span></td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3">
                                                    {sureInfo ? (
                                                        <span 
                                                            className="text-[11px] font-black px-2 py-1 rounded-lg"
                                                            style={{ backgroundColor: (sureInfo.isCompleted ? '#10b981' : getKalanColor(sureInfo.diff, sureInfo.total)) + "15", color: sureInfo.isCompleted ? '#10b981' : getKalanColor(sureInfo.diff, sureInfo.total) }}
                                                        >
                                                            {sureInfo.isCompleted ? `${sureInfo.completedInDays ?? 0} Günde Tamamlandı` : `${sureInfo.diff} Gün`}
                                                        </span>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3">
                                                    <select
                                                        disabled={!isElectron}
                                                        value={task.rapor_durumu}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value;
                                                            try {
                                                                await updateTaskStatus(task, newStatus);
                                                                if (effectiveUid) refreshTasks(effectiveUid);
                                                                toast.success("Durum güncellendi.");
                                                            } catch { toast.error("Hata oluştu."); }
                                                        }}
                                                        className={cn("bg-transparent text-[11px] font-black tracking-widest outline-none cursor-pointer p-1 rounded-lg hover:bg-slate-100 whitespace-nowrap", !isElectron && "opacity-50 cursor-not-allowed")}
                                                        style={{ color: getDurumColor(task.rapor_durumu) }}
                                                    >
                                                        {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-1 md:px-2 xl:px-4 py-3">
                                                    {/* Desktop Action Buttons (Visible only on xl and above, or landscape below xl as a grid) */}
                                                    <div className="hidden xl:flex xl:flex-row gap-1 w-fit landscape:grid landscape:grid-cols-4 landscape:gap-1 landscape:w-fit xl:landscape:flex xl:landscape:flex-row">
                                                        <ActionBtn title="İş Adımları" color="#3b82f6" onClick={() => setExpandedRow(expandedRow === task.id ? null : task.id)}>
                                                            <ClipboardList size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Dosya Aç" color="#64748b" onClick={() => handleOpenTaskFolder(task)}>
                                                            <FolderOpen size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Raporları Gör" color="#10b981" onClick={() => handleOpenReportSelector(task)}>
                                                            <FileText size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Görevi Düzenle" color="#f59e0b" onClick={() => isElectron ? setEditingTask(task) : toast.error("Düzenleme sadece masaüstü uygulamasında aktiftir.")}>
                                                            <Edit3 size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => isElectron ? setShareTask(task) : toast.error("Paylaşım sadece masaüstü uygulamasında aktiftir.")}>
                                                            <UserPlus size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Analiz Et" color="#0ea5e9" onClick={() => isElectron ? setAnalysisTask(task) : toast.error("Analiz sadece masaüstü uygulamasında aktiftir.")}>
                                                            <FileDigit size={16} />
                                                        </ActionBtn>
                                                        <ActionBtn title="Sil" color="#ef4444" onClick={() => isElectron ? handleDelete(task.id) : toast.error("Silme işlemi sadece masaüstü uygulamasında aktiftir.")}>
                                                            <Trash2 size={16} />
                                                        </ActionBtn>
                                                    </div>

                                                    {/* Tablet/Mobile Action Dropdown (Visible below xl, except in landscape) */}
                                                    <div className="xl:hidden relative action-dropdown-container inline-block text-left landscape:hidden">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdownTaskId(activeDropdownTaskId === task.id ? null : task.id);
                                                            }}
                                                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 border border-border"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {activeDropdownTaskId === task.id && (
                                                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-card border border-border rounded-[18px] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                                <button
                                                                    onClick={() => {
                                                                        setExpandedRow(expandedRow === task.id ? null : task.id);
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <ClipboardList size={14} className="text-blue-500" /> İş Adımları
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        handleOpenTaskFolder(task);
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <FolderOpen size={14} className="text-slate-500" /> Dosya Aç
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        handleOpenReportSelector(task);
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <FileText size={14} className="text-emerald-500" /> Raporları Gör
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (isElectron) {
                                                                            setEditingTask(task);
                                                                        } else {
                                                                            toast.error("Düzenleme sadece masaüstü uygulamasında aktiftir.");
                                                                        }
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <Edit3 size={14} className="text-amber-500" /> Görevi Düzenle
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (isElectron) {
                                                                            setShareTask(task);
                                                                        } else {
                                                                            toast.error("Paylaşım sadece masaüstü uygulamasında aktiftir.");
                                                                        }
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <UserPlus size={14} className="text-violet-500" /> Paylaş
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (isElectron) {
                                                                            setAnalysisTask(task);
                                                                        } else {
                                                                            toast.error("Analiz sadece masaüstü uygulamasında aktiftir.");
                                                                        }
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 transition-all"
                                                                >
                                                                    <FileDigit size={14} className="text-sky-500" /> Analiz Et
                                                                </button>
                                                                <div className="h-px bg-border my-1" />
                                                                <button
                                                                    onClick={() => {
                                                                        if (isElectron) {
                                                                            handleDelete(task.id);
                                                                        } else {
                                                                            toast.error("Silme işlemi sadece masaüstü uygulamasında aktiftir.");
                                                                        }
                                                                        setActiveDropdownTaskId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                                                                >
                                                                    <Trash2 size={14} /> Sil
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-muted/30">
                                                    <td colSpan={7} className="px-12 py-6">
                                                        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
                                                            {(() => {
                                                                const childTasks = tasks.filter(t => t.parent_task_id === task.id);
                                                                return childTasks.length > 0 && (
                                                                    <div className="space-y-3">
                                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Denetim Kapsamındaki Alt Görevler ({childTasks.length})</h5>
                                                                        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-muted/20">
                                                                            {childTasks.map(child => {
                                                                                const childSureInfo = getSureInfo(child);
                                                                                return (
                                                                                    <div key={child.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card hover:bg-muted/10 transition-colors">
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="text-[10px] font-black text-primary tracking-widest font-outfit">{child.rapor_turu}</span>
                                                                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                                                            <div>
                                                                                                <h6 className="text-sm font-bold text-slate-900 dark:text-slate-100">{child.rapor_adi}</h6>
                                                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{child.rapor_turu}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-4 flex-wrap">
                                                                                            {childSureInfo && (
                                                                                                <span 
                                                                                                    className="text-[10px] font-black px-2 py-0.5 rounded-md"
                                                                                                    style={{ backgroundColor: (childSureInfo.isCompleted ? '#10b981' : getKalanColor(childSureInfo.diff, childSureInfo.total)) + "15", color: childSureInfo.isCompleted ? '#10b981' : getKalanColor(childSureInfo.diff, childSureInfo.total) }}
                                                                                                >
                                                                                                    {childSureInfo.isCompleted ? `Tamamlandı` : `${childSureInfo.diff} Gün`}
                                                                                                </span>
                                                                                            )}
                                                                                            <select
                                                                                                disabled={!isElectron}
                                                                                                value={child.rapor_durumu}
                                                                                                onChange={async (e) => {
                                                                                                    const newStatus = e.target.value;
                                                                                                    try {
                                                                                                        await updateTaskStatus(child, newStatus);
                                                                                                        if (effectiveUid) refreshTasks(effectiveUid);
                                                                                                        toast.success("Durum güncellendi.");
                                                                                                    } catch { toast.error("Hata oluştu."); }
                                                                                                }}
                                                                                                className={cn("bg-transparent text-[10px] font-black tracking-widest outline-none cursor-pointer p-1 rounded-lg hover:bg-slate-100", !isElectron && "opacity-50 cursor-not-allowed")}
                                                                                                style={{ color: getDurumColor(child.rapor_durumu) }}
                                                                                            >
                                                                                                {RAPOR_DURUMLARI.map(d => <option key={d} value={d} className="text-slate-900">{d}</option>)}
                                                                                            </select>
                                                                                            <div className="flex gap-1">
                                                                                                <ActionBtn title="Dosya Aç" color="#64748b" onClick={() => handleOpenTaskFolder(child)}>
                                                                                                    <FolderOpen size={14} />
                                                                                                </ActionBtn>
                                                                                                <ActionBtn title="Raporları Gör" color="#10b981" onClick={() => handleOpenReportSelector(child)}>
                                                                                                    <FileText size={14} />
                                                                                                </ActionBtn>
                                                                                                <ActionBtn title="Görevi Düzenle" color="#f59e0b" onClick={() => isElectron ? setEditingTask(child) : toast.error("Düzenleme sadece masaüstü uygulamasında aktiftir.")}>
                                                                                                    <Edit3 size={14} />
                                                                                                </ActionBtn>
                                                                                                <ActionBtn title="Paylaş" color="#8b5cf6" onClick={() => isElectron ? setShareTask(child) : toast.error("Paylaşım sadece masaüstü uygulamasında aktiftir.")}>
                                                                                                    <UserPlus size={14} />
                                                                                                </ActionBtn>
                                                                                                <ActionBtn title="Sil" color="#ef4444" onClick={() => isElectron ? handleDelete(child.id) : toast.error("Silme işlemi sadece masaüstü uygulamasında aktiftir.")}>
                                                                                                    <Trash2 size={14} />
                                                                                                </ActionBtn>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="space-y-3">
                                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">İş Adımları / Checklist</h5>
                                                                <div className="space-y-2">
                                                                    {(task.steps || []).map((step: TaskStep, idx: number) => (
                                                                        <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
                                                                            <div className="flex items-center gap-3">
                                                                                <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(task, idx)} className="w-5 h-5 rounded border-border" />
                                                                                <span className={cn("text-sm font-medium", step.done ? "line-through text-slate-400" : "text-slate-700")}>{step.text}</span>
                                                                            </div>
                                                                            <button onClick={() => handleDeleteStep(task, idx)} className="text-rose-400 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"><X size={16} /></button>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex gap-3 mt-4">
                                                                        <input
                                                                            placeholder="Yeni adım ekle..."
                                                                            value={newStepText[task.id] || ""}
                                                                            onChange={e => setNewStepText({ ...newStepText, [task.id]: e.target.value })}
                                                                            onKeyDown={e => e.key === 'Enter' && handleAddStep(task)}
                                                                            className="flex-1 h-11 px-4 rounded-xl border border-border bg-card text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                                                        />
                                                                        <Button onClick={() => handleAddStep(task)} className="h-11 px-6 text-[10px] font-black uppercase tracking-widest">EKLE</Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Report Selector Modal */}
            {showReportSelector && createPortal(
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowReportSelector(null); }}>
                    <div style={{...modalBoxStyle, maxWidth: "600px"}} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground dark:text-slate-100">BAĞLI RAPORLAR</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{showReportSelector.rapor_adi}</p>
                            </div>
                            <button onClick={() => setShowReportSelector(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {taskAuditQualitySummary.total > 0 && (
                            <div className="mb-4 p-3 rounded-xl border border-border bg-muted/30 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">Hazır: {taskAuditQualitySummary.ready}</span>
                                <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700">Kritik Eksik: {taskAuditQualitySummary.withCriticalIssues}</span>
                                <span className="text-slate-500">Toplam Rapor: {taskAuditQualitySummary.total}</span>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                            {taskAudits.sort((a,b) => (a.report_seq || 0) - (b.report_seq || 0)).map(audit => {
                                const quality = getAuditQualityState(audit);
                                return (
                                <div 
                                    key={audit.id}
                                    onClick={() => {
                                        if (audit.attachment_url) {
                                            window.open(audit.attachment_url, '_blank');
                                        } else {
                                            navigate(`/audit/${audit.id}/report`);
                                        }
                                    }}
                                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-muted/50 dark:bg-slate-900/50 hover:bg-muted dark:hover:bg-slate-800 hover:border-border dark:hover:border-slate-700 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center transition-all",
                                                audit.attachment_url ? "bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white" : "bg-muted text-primary/40 group-hover:bg-primary group-hover:text-white"
                                            )}>
                                                {audit.attachment_url ? <Download size={20} /> : <FileText size={20} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">
                                                        Rapor {audit.report_seq || 1}
                                                    </p>
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 text-[8px] font-black rounded uppercase tracking-widest",
                                                        quality.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {quality.ready ? "TESLIME HAZIR" : `${quality.criticalFailures} KRITIK EKSIK`}
                                                    </span>
                                                    {audit.attachment_url && (
                                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase tracking-widest">DOSYA EKİ</span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-muted-foreground dark:text-slate-300 leading-none mt-0.5">{audit.title}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">{quality.wordCount} kelime</p>
                                            </div>
                                        </div>
                                        {audit.attachment_url ? <Download size={18} className="text-slate-300 group-hover:text-amber-500 transition-colors" /> : <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors" />}
                                    </div>
                                </div>
                            )})}
                        </div>

                        {isElectron && (
                            <div className="grid grid-cols-2 gap-3">
                                <input 
                                    type="file"
                                    ref={legacyReportInputRef}
                                    onChange={handleUploadLegacyReport}
                                    accept=".doc,.docx,.pdf,.pdfx"
                                    className="hidden"
                                />
                                <button 
                                    onClick={() => legacyReportInputRef.current?.click()}
                                    className="flex items-center justify-center gap-2 h-12 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest border border-amber-500/20"
                                >
                                    <Upload size={16} />
                                    Eski Rapor Dosyası Yükle
                                </button>
                                <button 
                                    onClick={() => {
                                        const nextSeq = Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1;
                                    setNewAudit({
                                        ...newAudit,
                                        title: getNextReportTitle(showReportSelector, tasks, taskAudits.length),
                                        location: taskAudits[0]?.location || "",
                                        report_seq: nextSeq,
                                        template: "Boş Rapor"
                                    });
                                    setIsNewAuditModalOpen(showReportSelector);
                                    setShowReportSelector(null);
                                }}
                                className="w-100 p-4 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                            >
                                <FileText size={18} />
                                YENİ RAPOR EKLE (/{Math.max(0, ...taskAudits.map(a => a.report_seq || 0)) + 1})
                            </button>
                        </div>
                    )}
                        {!isElectron && (
                            <p className="text-xs font-bold text-amber-600 text-center">
                                Web sürümünde rapor oluşturma kapalıdır. Sadece mevcut raporlar görüntülenebilir.
                            </p>
                        )}
                    </div>
                </div>
            , document.body)}

            {analysisTask && (
                <Suspense fallback={null}>
                    <TaskAnalysisModalLazy
                        task={analysisTask}
                        analysisText={buildTaskAnalysisText(analysisTask)}
                        onClose={() => setAnalysisTask(null)}
                        overlayStyle={overlayStyle}
                        modalBoxStyle={modalBoxStyle}
                    />
                </Suspense>
            )}

            {/* Sablon Modal */}
            {showSablonModal && createPortal(
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowSablonModal(null); }}>
                    <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: "1rem" }}>Rapor Şablonu Seçin</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {Object.keys(RAPOR_SABLONLARI).map(s => (
                                <button key={s} onClick={() => handleSablonSec(showSablonModal, s)} style={{ padding: "1rem", borderRadius: "0.75rem", border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", cursor: "pointer", textAlign: "left", fontWeight: 600 }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Editing Modal */}
            {editingTask && createPortal(
                <div style={overlayStyle}>
                    <div style={{...modalBoxStyle, maxWidth: "600px"}} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6 border-b border-slate-50 dark:border-slate-800 pb-4">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground dark:text-slate-100">GÖREVİ DÜZENLE</h3>
                                <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mt-1">{editingTask.rapor_adi}</p>
                            </div>
                            <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1">
                                <div>
                                    <label style={labelStyle}>Görev Türü</label>
                                    <select
                                        value={editingTask.rapor_turu}
                                        onChange={e => setEditingTask({ ...editingTask, rapor_turu: e.target.value })}
                                        style={inputStyle}
                                    >
                                        {RAPOR_TURLERI.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {editingTask.rapor_turu === "Kyk Yurt Denetimi" && (
                                <div>
                                    <label style={labelStyle}>Bağlı İl Denetimi</label>
                                    <select
                                        value={editingTask.parent_task_id || ""}
                                        onChange={e => setEditingTask({ ...editingTask, parent_task_id: e.target.value })}
                                        style={inputStyle}
                                    >
                                        <option value="">Seçiniz (Bağlı İl Denetimi yoksa boş bırakın)...</option>
                                        {tasks.filter(t => t.rapor_turu === "İl Denetimi" && t.id !== editingTask.id).map(t => (
                                            <option key={t.id} value={t.id}>{t.rapor_adi} ({t.rapor_turu})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className={cn("grid gap-4", (editingTask.rapor_durumu === "Tamamlandı" || editingTask.rapor_durumu === "İncelemede") ? "grid-cols-2" : "grid-cols-1")}>
                                <div>
                                    <label style={labelStyle}>Görev Adı</label>
                                    <input 
                                        value={editingTask.rapor_adi} 
                                        onChange={e => setEditingTask({...editingTask, rapor_adi: e.target.value})} 
                                        style={inputStyle} 
                                        placeholder="Görev adını girin..."
                                    />
                                </div>
                                {(editingTask.rapor_durumu === "Tamamlandı" || editingTask.rapor_durumu === "İncelemede") && (
                                    <div>
                                        <label style={labelStyle}>Görev / Rapor No</label>
                                        <input 
                                            value={editingTask.rapor_kodu || ""} 
                                            onChange={e => setEditingTask({...editingTask, rapor_kodu: e.target.value})} 
                                            style={inputStyle} 
                                            placeholder="Örn: S.Y.64/2023-1"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label style={labelStyle}>Görev Tarihi</label>
                                    <input 
                                        type="date"
                                        value={editingTask.baslama_tarihi} 
                                        onChange={e => setEditingTask({...editingTask, baslama_tarihi: e.target.value})} 
                                        style={inputStyle} 
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Süre (Gün)</label>
                                    <input 
                                        type="number"
                                        min={1}
                                        value={editingTask.sure_gun} 
                                        onChange={e => setEditingTask({...editingTask, sure_gun: parseInt(e.target.value) || 0})} 
                                        style={inputStyle} 
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                                <button onClick={() => setEditingTask(null)} className="flex-1 h-12 rounded-xl border border-slate-100 dark:border-slate-800 font-bold text-slate-500 hover:bg-muted dark:hover:bg-slate-800 transition-all text-xs uppercase tracking-widest">
                                    İPTAL
                                </button>
                                <button 
                                    onClick={handleEditSave} 
                                    className="flex-1 h-12 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                                >
                                    DEĞİŞİKLİKLERİ KAYDET
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Share Modal */}
            {shareTask && createPortal(
                <Suspense fallback={null}>
                    <ShareModalLazy
                        isOpen={!!shareTask}
                        onClose={() => setShareTask(null)}
                        sharedWith={shareTask?.pending_collaborators || []}
                        sharedRoles={shareTask?.shared_roles || {}}
                        enableRoles={true}
                        onShare={handleShareUpdate}
                        onShareWithRoles={handleShareUpdate}
                        title={`"${shareTask?.rapor_adi}" Paylaşımı`}
                    />
                </Suspense>
            , document.body)}

            {isBulkShareModalOpen && createPortal(
                <Suspense fallback={null}>
                    <ShareModalLazy
                        isOpen={isBulkShareModalOpen}
                        onClose={() => setIsBulkShareModalOpen(false)}
                        sharedWith={bulkSharedWithSeed}
                        sharedRoles={bulkSharedRolesSeed}
                        enableRoles={true}
                        onShare={handleBulkShareUpdate}
                        onShareWithRoles={handleBulkShareUpdateWithRoles}
                        title={`${selectedTaskIds.length} Seçili Görev Paylaşımı`}
                    />
                </Suspense>
            , document.body)}

            {deleteConfirmId && createPortal(
                <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
                    <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: isDark ? '#451a1a' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                <Trash2 size={32} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', fontFamily: 'Outfit, sans-serif' }}>Görevi Sil?</h3>
                                <p style={{ fontSize: '0.875rem', color: isDark ? '#94a3b8' : '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>Bu görevi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                                <button 
                                    disabled={saving}
                                    onClick={() => setDeleteConfirmId(null)}
                                    style={{ flex: 1, padding: '0.85rem', borderRadius: '0.75rem', border: isDark ? "1px solid #334155" : '1px solid #e2e8f0', backgroundColor: 'transparent', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#64748b', opacity: saving ? 0.5 : 1 }}
                                >
                                    İptal
                                </button>
                                <button 
                                    disabled={saving}
                                    onClick={confirmDelete}
                                    style={{ flex: 1, padding: '0.85rem', borderRadius: '0.75rem', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : "Sil"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Yeni Denetim Başlat Modalı (İlk Rapor İçin) */}
            {isNewAuditModalOpen && createPortal(
                <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div>
                                <h3 className="text-xl font-black font-outfit text-foreground tracking-tight">Yeni Rapor Başlat</h3>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Denetim detaylarını onaylayın veya güncelleyin.</p>
                            </div>
                            <button onClick={() => setIsNewAuditModalOpen(null)} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAuditFromTask} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">İşle İlişkili Görev</label>
                                <div className="w-full p-4 bg-muted/50 border border-border rounded-2xl text-sm font-bold text-muted-foreground flex items-center gap-3 cursor-not-allowed">
                                    <ClipboardList size={18} className="text-primary/40" />
                                    {isNewAuditModalOpen.rapor_adi} ({isNewAuditModalOpen.rapor_turu})
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Rapor Başlığı</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={newAudit.title}
                                        onChange={(e) => setNewAudit({...newAudit, title: e.target.value})}
                                        placeholder="Rapor başlığını giriniz..."
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Denetim Yeri</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={newAudit.location}
                                        onChange={(e) => setNewAudit({...newAudit, location: e.target.value})}
                                        placeholder="Şehir / Birim..."
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Denetim Tarihi</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        value={newAudit.date}
                                        onChange={(e) => setNewAudit({...newAudit, date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Taslak Şablon</label>
                                    <select 
                                        className="w-full p-4 bg-muted border border-border rounded-2xl text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                        value={newAudit.template}
                                        onChange={(e) => setNewAudit({...newAudit, template: e.target.value})}
                                    >
                                        {Object.keys(RAPOR_SABLONLARI).map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <Button 
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsNewAuditModalOpen(null)}
                                    className="flex-1 h-12 rounded-xl font-bold"
                                >
                                    İptal
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : 'Başlat'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            , document.body)}

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
