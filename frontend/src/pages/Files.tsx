import { 
    Folder, File as FileIcon, Plus, Search, ChevronRight, ChevronDown, 
    Download, Trash2, Shield, FolderOpen,
    FileText, Image as ImageIcon, Video, Music, 
    Upload, X, Grid, List as ListIcon, RefreshCw, Share2, ExternalLink, HelpCircle
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useState, useEffect, useMemo, useRef, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { fetchFileTree, uploadFile, createFolder, deleteItem, openFolder, openFile, shareFileToUser, generateKapakDocx, generateDiziDocx, generateDegerlendirmeDocx, type FileItem } from "../lib/api/files";
import { aiSearch } from "../lib/api/ai";
import { cn } from "../lib/utils";
import { isElectron } from "../lib/firebase";
import { API_URL, LOCAL_API_URL, IS_ELECTRON } from "../lib/config";
import { useAuth } from "../lib/hooks/useAuth";
import { fetchAllProfiles, type Profile } from "../lib/api/profiles";
import { sendDirectMessage } from "../lib/api/collaboration";


export default function Files() {
    const confirm = useConfirm();
    const [searchParams] = useSearchParams();
    const scope = searchParams.get("scope");

    // Template modalları
    const [isDiziModalOpen, setIsDiziModalOpen] = useState(false);
    const [isKapakModalOpen, setIsKapakModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    // Dizi Pusulası verileri
    const [diziItems, setDiziItems] = useState<Array<{
        siraNo: string;
        tarih: string;
        sayi: string;
        adet: string;
        aciklama: string;
    }>>([
        { siraNo: "1", tarih: "", sayi: "", adet: "", aciklama: "" }
    ]);
    const [diziEvaluators, setDiziEvaluators] = useState<Array<{ name: string; title: string }>>([
        { name: "", title: "" }
    ]);
    const [generatingDizi, setGeneratingDizi] = useState(false);

    // Kapak verileri
    const [kapakData, setKapakData] = useState({
        arsivNo: "",
        raporSayisi: "",
        raporTuru: "Genel Teftiş Raporu",
        tarih: "",
        yer: "ANKARA",
        onayTarihi: "",
        onaySayisi: "",
        gorevEmriTarihi: "",
        gorevEmriSayisi: "",
        sayfaAdedi: "",
        ekAdedi: "",
        ekSayfaAdedi: "",
        ilgiliBirim: "",
        konu: ""
    });
    const [kapakEvaluators, setKapakEvaluators] = useState<Array<{ name: string; title: string }>>([
        { name: "", title: "" }
    ]);
    const [generatingKapak, setGeneratingKapak] = useState(false);

    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
    const [currentPath, setCurrentPath] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user, profile } = useAuth();
    
    // Sharing state
    const [sharingFile, setSharingFile] = useState<FileItem | null>(null);
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [sharingLoading, setSharingLoading] = useState(false);
    
    // New Folder Modal
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [spreadsheetPreview, setSpreadsheetPreview] = useState<{ loading: boolean; error: string | null; rows: string[][] }>({
        loading: false,
        error: null,
        rows: []
    });
    const [textPreview, setTextPreview] = useState<{ loading: boolean; error: string | null; content: string }>({
        loading: false,
        error: null,
        content: ""
    });

    // Masaüstünde yerel dosyalara (Belgelerim/MufYARD), Web'de Bulut'a (Railway) odaklan
    const CURRENT_API_URL = IS_ELECTRON ? LOCAL_API_URL : API_URL;
    const BACKEND_BASE_URL = CURRENT_API_URL.replace(/\/api\/?$/, "");

    const resolveFileUrl = (url?: string) => {
        if (!url) return "";

        const raw = String(url).trim();
        if (!raw) return "";

        // Bosluk/Turkce karakter gibi path sorunlarini onlemek icin URL'i encode et.
        if (/^https?:\/\//i.test(raw)) {
            return encodeURI(raw);
        }

        const normalized = `${BACKEND_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
        return encodeURI(normalized);
    };

    const isSpreadsheetFile = (item: FileItem | null) => {
        if (!item) return false;
        const ext = (item.name.split('.').pop() || '').toLowerCase();
        return ['xls', 'xlsx', 'csv'].includes(ext);
    };

    useEffect(() => {
        let cancelled = false;

        const loadContentPreview = async () => {
            if (!previewFile || !previewFile.url) {
                setSpreadsheetPreview({ loading: false, error: null, rows: [] });
                setTextPreview({ loading: false, error: null, content: "" });
                return;
            }

            const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
            const isExcel = ['xls', 'xlsx', 'csv'].includes(ext);
            const isText = ['txt', 'md', 'json', 'xml', 'js', 'ts', 'py', 'css', 'html', 'log', 'sql'].includes(ext);

            if (isExcel) {
                setSpreadsheetPreview({ loading: true, error: null, rows: [] });
                try {
                    const url = resolveFileUrl(previewFile.url);
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Dosya okunamadı (HTTP ${res.status})`);

                    let rows: string[][] = [];
                    if (ext === 'csv') {
                        const text = await res.text();
                        const wb = XLSX.read(text, { type: 'string' });
                        const firstSheet = wb.SheetNames[0];
                        const matrix = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, raw: false }) as any[];
                        rows = matrix.map((r: any) => (Array.isArray(r) ? r : [String(r ?? '')]).map((c: any) => String(c ?? '')));
                    } else {
                        const buffer = await res.arrayBuffer();
                        const wb = XLSX.read(buffer, { type: 'array' });
                        const firstSheet = wb.SheetNames[0];
                        const matrix = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, raw: false }) as any[];
                        rows = matrix.map((r: any) => (Array.isArray(r) ? r : [String(r ?? '')]).map((c: any) => String(c ?? '')));
                    }

                    if (!cancelled) setSpreadsheetPreview({ loading: false, error: null, rows: rows.slice(0, 200) });
                } catch (e: any) {
                    if (!cancelled) setSpreadsheetPreview({ loading: false, error: e?.message || 'Excel önizleme yüklenemedi.', rows: [] });
                }
            } else if (isText) {
                setSpreadsheetPreview({ loading: false, error: null, rows: [] });
                setTextPreview({ loading: true, error: null, content: "" });
                try {
                    const url = resolveFileUrl(previewFile.url);
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`Dosya okunamadı (HTTP ${res.status})`);
                    const text = await res.text();
                    if (!cancelled) setTextPreview({ loading: false, error: null, content: text });
                } catch (e: any) {
                    if (!cancelled) setTextPreview({ loading: false, error: e?.message || 'Metin önizleme yüklenemedi.', content: "" });
                }
            } else {
                setSpreadsheetPreview({ loading: false, error: null, rows: [] });
                setTextPreview({ loading: false, error: null, content: "" });
            }
        };

        loadContentPreview();
        return () => { cancelled = true; };
    }, [previewFile]);

    const saveWithElectronDialog = async (url: string, fileName: string) => {
        const api = (window as any)?.electronAPI;
        if (!api?.downloadFile) return false;

        const result = await api.downloadFile(url, fileName || "dosya");

        if (result?.ok) {
            toast.success("Dosya kaydedildi.");
            return true;
        }

        if (!result?.canceled) {
            toast.error(result?.error || "Dosya kaydedilemedi.");
        }
        return false;
    };

    // AI arama fonksiyonu
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            return;
        }
        let cancelled = false;
        aiSearch(searchQuery)
            .then(() => { if (!cancelled) { /* results unused */ } })
            .catch(() => { if (!cancelled) { /* results unused */ } });
        return () => { cancelled = true; };
    }, [searchQuery]);



    // Sürükle-bırak dosya yükleme
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadFile(file, currentPath);
            await loadData();
            toast.success("Dosya yüklendi");
        } catch (error) {
            toast.error("Yükleme başarısız");
        } finally {
            setIsUploading(false);
        }
    };


    useEffect(() => {
        loadData();
    }, [scope]);

    useEffect(() => {
        const handleIframeMessage = async (event: MessageEvent) => {
            if (event.data && event.data.type === "GENERATE_WORD_DEGERLENDIRME") {
                const formData = event.data.data;
                const loadingToast = toast.loading("Değerlendirme Formu Word belgesi oluşturuluyor...");
                try {
                    const data = {
                        ...formData,
                        scope: "other"
                    };
                    const result = await generateDegerlendirmeDocx(data);
                    if (result.status === "success") {
                        const fileUrl = "/Diğer İşlem ve Belgeler/" + result.filename;
                        const resolvedUrl = resolveFileUrl(fileUrl);
                        const link = document.createElement("a");
                        link.href = resolvedUrl;
                        link.download = result.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        toast.success("Değerlendirme Formu Word belgesi başarıyla oluşturuldu ve indirildi.", { id: loadingToast });
                    } else {
                        toast.error("Dosya oluşturulamadı.", { id: loadingToast });
                    }
                } catch (error: any) {
                    console.error(error);
                    toast.error("Hata: " + error.message, { id: loadingToast });
                }
            }
        };
        window.addEventListener("message", handleIframeMessage);
        return () => window.removeEventListener("message", handleIframeMessage);
    }, []);

    useEffect(() => {
        let active = true;
        const loadProfiles = async () => {
            try {
                const data = await fetchAllProfiles();
                if (!active) return;
                const meKeys = [
                    user?.uid,
                    user?.email?.trim().toLowerCase(),
                    profile?.uid,
                    profile?.email?.trim().toLowerCase()
                ].filter(Boolean).map(v => String(v).toLowerCase());

                const filtered = data.filter(p => {
                    const pKeys = [p.uid, p.email?.trim().toLowerCase()]
                        .filter(Boolean)
                        .map(v => String(v).toLowerCase());
                    const isMeById = pKeys.some(k => meKeys.includes(k));
                    return !isMeById;
                });
                if (active) {
                    setAllProfiles(filtered);
                }
            } catch (error) {
                console.error("Profiller yüklenemedi:", error);
            }
        };
        loadProfiles();
        return () => {
            active = false;
        };
    }, [user?.uid, user?.email, profile?.uid, profile?.email]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchFileTree(undefined, scope || undefined);
            setItems(data);
        } catch (error) {
            console.error(error);
            toast.error("Yükleme başarısız");
        } finally {
            setLoading(false);
        }
    };

    const toggleFolder = (id: string) => {
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedFolders(next);
    };

    const currentFiles = useMemo(() => {
        return items.filter(item => {
            const matchesPath = (currentPath === '' && !item.parentId) || item.parentId === currentPath;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesPath && (searchQuery ? matchesSearch : true);
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
    }, [items, currentPath, searchQuery]);

    const visibleFiles = useMemo(() => currentFiles.slice(0, 80), [currentFiles]);

    const breadcrumbs = useMemo(() => {
        if (!currentPath) return [];
        return currentPath.split('/');
    }, [currentPath]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadFile(file, currentPath);
            await loadData();
            toast.success("Dosya yüklendi");
        } catch (error) {
            toast.error("Yükleme başarısız");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Öğeyi Sil",
            message: "Bu öğeyi silmek istediğinize emin misiniz?",
            confirmText: "Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        try {
            await deleteItem(id);
            await loadData();
            if (previewFile?.id === id) setPreviewFile(null);
            toast.success("Silindi");
        } catch (error) {
            toast.error("Silme başarısız");
        }
    };

    const handleCreateFolder = () => {
        setNewFolderName("");
        setIsFolderModalOpen(true);
    };

    const handleFolderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        
        setCreatingFolder(true);
        try {
            await createFolder(newFolderName.trim(), currentPath);
            await loadData();
            setIsFolderModalOpen(false);
            setNewFolderName("");
            toast.success("Klasör oluşturuldu");
        } catch (error) {
            toast.error("Klasör oluşturulamadı");
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleOpenFolder = async (id: string) => {
        try {
            await openFolder(id);
        } catch (error) {
            toast.error("Klasör açılamadı");
        }
    };

    const handleOpenFile = async (id: string) => {
        try {
            await openFile(id);
        } catch (error) {
            toast.error("Dosya açılamadı");
        }
    };

    const handleDownload = async (item: FileItem) => {
        if (item.type === "folder") {
            toast.error("Klasör indirilemez. Lütfen dosya seçin.");
            return;
        }
        if (!item.url) {
            toast.error("Bu dosya için indirme bağlantısı bulunamadı.");
            return;
        }

        const resolvedUrl = resolveFileUrl(item.url);

        if (isElectron) {
            const saved = await saveWithElectronDialog(resolvedUrl, item.name || "dosya");
            if (saved) return;
        }

        const link = document.createElement("a");
        link.href = resolvedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download = item.name || "dosya";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleShareToInspector = async (recipient: Profile) => {
        if (!sharingFile || !user) return;

        if (!sharingFile.url) {
            toast.error("Paylaşılacak dosya bağlantısı bulunamadı.");
            return;
        }
        
        setSharingLoading(true);
        const loadingToast = toast.loading(`${sharingFile.name} gönderiliyor...`);
        
        try {
            const senderName = profile?.full_name || user.displayName || user.email?.split('@')[0] || "Müfettiş";

            // Dosyanın alıcıya ait gerçek bir kopyasını backend üzerinde oluştur.
            const sharedCopy = await shareFileToUser(sharingFile.id, recipient.uid);

            const success = await sendDirectMessage(
                recipient.uid,
                `📁 Dosya paylaşıldı: ${sharingFile.name}`,
                {
                    type: 'file',
                    name: sharedCopy?.name || sharingFile.name,
                    url: sharedCopy?.url || sharingFile.url,
                    size: 0 // Size already formatted in name or can be parsed
                },
                user.uid,
                senderName
            );

            if (success) {
                toast.success(`${recipient.full_name} kişisine gönderildi`, { id: loadingToast });
                setSharingFile(null);
            } else {
                toast.error("Gönderilemedi", { id: loadingToast });
            }
        } catch (error) {
            toast.error("Bir hata oluştu", { id: loadingToast });
        } finally {
            setSharingLoading(false);
        }
    };

    const getFileIcon = (item: FileItem) => {
        if (item.type === 'folder') return <Folder size={20} className="text-primary fill-primary/10" />;
        if (item.type === 'image') return <ImageIcon size={20} className="text-rose-500" />;
        if (item.type === 'pdf') return <FileText size={20} className="text-red-500" />;
        if (item.type === 'video') return <Video size={20} className="text-purple-500" />;
        if (item.type === 'audio') return <Music size={20} className="text-amber-500" />;
        if (item.type === 'word') return <FileText size={20} className="text-blue-600" />;
        if (item.type === 'excel') return <FileText size={20} className="text-emerald-600" />;
        if (item.type === 'powerpoint') return <FileText size={20} className="text-orange-600" />;
        if (item.type === 'text') return <FileText size={20} className="text-slate-500" />;
        return <FileIcon size={20} className="text-slate-400" />;
    };

    // --- TEMPLATE DASHBOARD HANDLERS & MODALS ---
    const handleAddDiziItem = () => {
        setDiziItems([...diziItems, { siraNo: String(diziItems.length + 1), tarih: "", sayi: "", adet: "", aciklama: "" }]);
    };

    const handleRemoveDiziItem = (index: number) => {
        const updated = diziItems.filter((_, i) => i !== index).map((item, idx) => ({ ...item, siraNo: String(idx + 1) }));
        setDiziItems(updated);
    };

    const handleDiziItemChange = (index: number, field: string, value: string) => {
        const updated = [...diziItems];
        updated[index] = { ...updated[index], [field]: value };
        setDiziItems(updated);
    };

    const handleAddDiziEvaluator = () => {
        if (diziEvaluators.length >= 10) {
            toast.error("En fazla 10 müfettiş eklenebilir");
            return;
        }
        setDiziEvaluators([...diziEvaluators, { name: "", title: "" }]);
    };

    const handleRemoveDiziEvaluator = (index: number) => {
        if (diziEvaluators.length <= 1) return;
        setDiziEvaluators(diziEvaluators.filter((_, i) => i !== index));
    };

    const handleDiziEvaluatorChange = (index: number, field: string, value: string) => {
        const updated = [...diziEvaluators];
        updated[index] = { ...updated[index], [field]: value };
        setDiziEvaluators(updated);
    };

    const handleGenerateDizi = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneratingDizi(true);
        const loadingToast = toast.loading("Dizi Pusulası oluşturuluyor...");
        try {
            const formattedItems = diziItems.map(item => ({
                siraNo: item.siraNo,
                tarih: item.tarih,
                sayi: item.sayi,
                adet: item.adet,
                aciklama: item.aciklama
            }));
            const formattedEvaluators = diziEvaluators.filter(ev => ev.name.trim());
            let sortedEvaluators = [...formattedEvaluators];
            if (sortedEvaluators.length === 2) {
                sortedEvaluators = [formattedEvaluators[1], formattedEvaluators[0]];
            }
            const data = {
                items: formattedItems,
                evaluators: sortedEvaluators,
                scope: "other"
            };
            const result = await generateDiziDocx(data);
            if (result.status === "success") {
                const fileUrl = "/Diğer İşlem ve Belgeler/" + result.filename;
                const resolvedUrl = resolveFileUrl(fileUrl);
                const link = document.createElement("a");
                link.href = resolvedUrl;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Dizi Pusulası başarıyla oluşturuldu ve indirildi.", { id: loadingToast });
                setIsDiziModalOpen(false);
            } else {
                toast.error("Dosya oluşturulamadı.", { id: loadingToast });
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Hata: " + error.message, { id: loadingToast });
        } finally {
            setGeneratingDizi(false);
        }
    };

    const handleAddKapakEvaluator = () => {
        if (kapakEvaluators.length >= 10) {
            toast.error("En fazla 10 müfettiş eklenebilir");
            return;
        }
        setKapakEvaluators([...kapakEvaluators, { name: "", title: "" }]);
    };

    const handleRemoveKapakEvaluator = (index: number) => {
        if (kapakEvaluators.length <= 1) return;
        setKapakEvaluators(kapakEvaluators.filter((_, i) => i !== index));
    };

    const handleKapakEvaluatorChange = (index: number, field: string, value: string) => {
        const updated = [...kapakEvaluators];
        updated[index] = { ...updated[index], [field]: value };
        setKapakEvaluators(updated);
    };

    const handleKapakChange = (field: string, value: string) => {
        setKapakData({ ...kapakData, [field]: value });
    };

    const handleGenerateKapak = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeneratingKapak(true);
        const loadingToast = toast.loading("Rapor Kapağı oluşturuluyor...");
        try {
            const formattedEvaluators = kapakEvaluators.filter(ev => ev.name.trim());
            let sortedEvaluators = [...formattedEvaluators];
            if (sortedEvaluators.length === 2) {
                sortedEvaluators = [formattedEvaluators[1], formattedEvaluators[0]];
            }
            const data = {
                ...kapakData,
                evaluators: sortedEvaluators,
                scope: "other",
                openAfterGenerate: false
            };
            const result = await generateKapakDocx(data);
            if (result.status === "success") {
                const fileUrl = "/Diğer İşlem ve Belgeler/" + result.filename;
                const resolvedUrl = resolveFileUrl(fileUrl);
                const link = document.createElement("a");
                link.href = resolvedUrl;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Rapor kapağı başarıyla oluşturuldu ve indirildi.", { id: loadingToast });
                setIsKapakModalOpen(false);
            } else {
                toast.error("Dosya oluşturulamadı.", { id: loadingToast });
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Hata: " + error.message, { id: loadingToast });
        } finally {
            setGeneratingKapak(false);
        }
    };

    const renderFormModal = () => {
        if (!isFormModalOpen) return null;
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300">
                <div className="bg-card w-full h-full rounded-[32px] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col">
                    <div className="p-4 md:p-6 bg-indigo-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield size={20} />
                            <h3 className="text-lg font-black tracking-tight">Müfettiş Yardımcısı Değerlendirme Formu</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => window.open("/mufettis_yardimcisi_degerlendirme_formu.html", "_blank")}
                                className="rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold"
                            >
                                <ExternalLink size={14} className="mr-2" /> Yeni Sekmede Aç
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => setIsFormModalOpen(false)} 
                                className="rounded-xl text-white hover:bg-white/10 h-10 w-10"
                            >
                                <X size={20} />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-955 relative">
                        <iframe 
                            src="/mufettis_yardimcisi_degerlendirme_formu.html" 
                            className="w-full h-full border-none shadow-inner"
                        />
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    const renderDiziModal = () => {
        if (!isDiziModalOpen) return null;
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-4xl p-8 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                <ListIcon size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Dizi Pusulası Hazırlama</h3>
                                <p className="text-xs text-slate-500 font-medium">Resmi dizi pusulası (.docx) oluşturmak için bilgileri girin.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsDiziModalOpen(false)} 
                            className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    <form onSubmit={handleGenerateDizi} className="space-y-8">
                        {/* Tablo Bölümü */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-405 dark:text-slate-400">Ek ve Belgeler Listesi</h4>
                                <Button 
                                    type="button" 
                                    onClick={handleAddDiziItem}
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] tracking-widest px-4 py-2"
                                >
                                    <Plus size={14} className="mr-2" /> Satır Ekle
                                </Button>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                                <table className="min-w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 w-16 text-center">Sıra No</th>
                                            <th className="px-4 py-3 w-36">Tarih</th>
                                            <th className="px-4 py-3 w-40">Belge Sayısı/No</th>
                                            <th className="px-4 py-3 w-28 text-center">Sayfa Adedi</th>
                                            <th className="px-4 py-3">Açıklama</th>
                                            <th className="px-4 py-3 w-14 text-center">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/10">
                                        {diziItems.map((item, index) => (
                                            <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-4 py-2 font-bold text-center text-slate-500">
                                                    {item.siraNo}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.tarih}
                                                        onChange={(e) => handleDiziItemChange(index, "tarih", e.target.value)}
                                                        placeholder="GG.AA.YYYY"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.sayi}
                                                        onChange={(e) => handleDiziItemChange(index, "sayi", e.target.value)}
                                                        placeholder="Sayı girin"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" 
                                                        value={item.adet}
                                                        onChange={(e) => handleDiziItemChange(index, "adet", e.target.value)}
                                                        placeholder="Adet"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.aciklama}
                                                        onChange={(e) => handleDiziItemChange(index, "aciklama", e.target.value)}
                                                        placeholder="Belge konusu / açıklaması"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveDiziItem(index)}
                                                        disabled={diziItems.length <= 1}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-30 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Müfettiş İmzaları */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">İmzalayacak Müfettişler</h4>
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={handleAddDiziEvaluator}
                                    disabled={diziEvaluators.length >= 10}
                                    className="rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-black text-[10px] tracking-widest px-4 py-2"
                                >
                                    <Plus size={14} className="mr-2" /> Müfettiş Ekle
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {diziEvaluators.map((ev, index) => (
                                    <div key={index} className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/60 relative">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase text-slate-400">
                                                {(() => {
                                                    const total = diziEvaluators.length;
                                                    if (total === 2) {
                                                        return index === 0 ? "1. İmza Bloğu (Kıdemli)" : "2. İmza Bloğu (Kıdemsiz)";
                                                    }
                                                    if (total === 3) {
                                                        if (index === 0) return "1. İmza Bloğu (En Kıdemli)";
                                                        if (index === 1) return "2. İmza Bloğu (Kıdemli)";
                                                        return "3. İmza Bloğu (En Kıdemsiz)";
                                                    }
                                                    return `${index + 1}. İmza Bloğu`;
                                                })()}
                                            </span>
                                            {diziEvaluators.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveDiziEvaluator(index)}
                                                    className="text-xs text-rose-500 hover:underline font-bold"
                                                >
                                                    Kaldır
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Adı Soyadı</label>
                                                <input 
                                                    type="text" 
                                                    value={ev.name}
                                                    onChange={(e) => handleDiziEvaluatorChange(index, "name", e.target.value)}
                                                    placeholder="Örn: Sefa YAPRAKLI"
                                                    required
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Unvanı</label>
                                                <select 
                                                    value={ev.title}
                                                    onChange={(e) => handleDiziEvaluatorChange(index, "title", e.target.value)}
                                                    required
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500 outline-none text-xs font-bold"
                                                >
                                                    <option value="">Seçiniz...</option>
                                                    <option value="Müfettiş">Müfettiş</option>
                                                    <option value="Başmüfettiş">Başmüfettiş</option>
                                                    <option value="Müfettiş Yardımcısı">Müfettiş Yardımcısı</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 justify-end">
                            <Button 
                                type="button"
                                variant="ghost" 
                                onClick={() => setIsDiziModalOpen(false)}
                                disabled={generatingDizi}
                                className="h-14 px-8 rounded-2xl font-bold text-slate-500"
                            >
                                İptal
                            </Button>
                            <Button 
                                type="submit"
                                disabled={generatingDizi}
                                className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-600/10 hover:-translate-y-0.5 transition-all"
                            >
                                {generatingDizi ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Download className="mr-2" size={18} />}
                                Word Belgesi Oluştur ve İndir
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>,
            document.body
        );
    };

    const renderKapakModal = () => {
        if (!isKapakModalOpen) return null;
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-4xl p-8 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Teftiş Rapor Kapağı Hazırlama</h3>
                                <p className="text-xs text-slate-500 font-medium">Resmi rapor kapak belgesini (.docx) oluşturmak için bilgileri girin.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsKapakModalOpen(false)} 
                            className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    <form onSubmit={handleGenerateKapak} className="space-y-6">
                        {/* 1. Genel Bilgiler */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Rapor Sayısı</label>
                                <input 
                                    type="text" 
                                    value={kapakData.raporSayisi}
                                    onChange={(e) => handleKapakChange("raporSayisi", e.target.value)}
                                    placeholder="Örn: 35/01"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Rapor Türü</label>
                                <input 
                                    type="text" 
                                    value={kapakData.raporTuru}
                                    onChange={(e) => handleKapakChange("raporTuru", e.target.value)}
                                    placeholder="Örn: Genel Teftiş Raporu"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Tarih</label>
                                <input 
                                    type="text" 
                                    value={kapakData.tarih}
                                    onChange={(e) => handleKapakChange("tarih", e.target.value)}
                                    placeholder="Örn: 12.08.2026"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* 2. Onay & Görev Emri Bilgileri */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Bakanlık Onay Tarihi</label>
                                <input 
                                    type="text" 
                                    value={kapakData.onayTarihi}
                                    onChange={(e) => handleKapakChange("onayTarihi", e.target.value)}
                                    placeholder="Örn: 15.02.2026"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Bakanlık Onay Sayısı</label>
                                <input 
                                    type="text" 
                                    value={kapakData.onaySayisi}
                                    onChange={(e) => handleKapakChange("onaySayisi", e.target.value)}
                                    placeholder="Örn: 201"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Görev Emri Tarihi</label>
                                <input 
                                    type="text" 
                                    value={kapakData.gorevEmriTarihi}
                                    onChange={(e) => handleKapakChange("gorevEmriTarihi", e.target.value)}
                                    placeholder="Örn: 18.02.2026"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Görev Emri Sayısı</label>
                                <input 
                                    type="text" 
                                    value={kapakData.gorevEmriSayisi}
                                    onChange={(e) => handleKapakChange("gorevEmriSayisi", e.target.value)}
                                    placeholder="Örn: 1045"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* 3. Sayfa & Birim & Konu */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Rapor Sayfa Adedi</label>
                                <input 
                                    type="text" 
                                    value={kapakData.sayfaAdedi}
                                    onChange={(e) => handleKapakChange("sayfaAdedi", e.target.value)}
                                    placeholder="Örn: 120"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Ek Adedi</label>
                                <input 
                                    type="text" 
                                    value={kapakData.ekAdedi}
                                    onChange={(e) => handleKapakChange("ekAdedi", e.target.value)}
                                    placeholder="Örn: 14"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Ek Toplam Sayfa Adedi</label>
                                <input 
                                    type="text" 
                                    value={kapakData.ekSayfaAdedi}
                                    onChange={(e) => handleKapakChange("ekSayfaAdedi", e.target.value)}
                                    placeholder="Örn: 245"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold text-center"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Yer</label>
                                <input 
                                    type="text" 
                                    value={kapakData.yer}
                                    onChange={(e) => handleKapakChange("yer", e.target.value)}
                                    placeholder="Örn: ANKARA"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* 4. İlgili Birim ve Konu */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">İlgili Birim</label>
                                <input 
                                    type="text" 
                                    value={kapakData.ilgiliBirim}
                                    onChange={(e) => handleKapakChange("ilgiliBirim", e.target.value)}
                                    placeholder="Örn: Destek Hizmetleri Dairesi Başkanlığı"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Konu</label>
                                <input 
                                    type="text" 
                                    value={kapakData.konu}
                                    onChange={(e) => handleKapakChange("konu", e.target.value)}
                                    placeholder="Örn: Teftiş faaliyetleri ve idari incelemeler"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                />
                            </div>
                        </div>

                        {/* 5. Müfettiş İmzaları */}
                        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">İmzalayacak Müfettişler</h4>
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    onClick={handleAddKapakEvaluator}
                                    disabled={kapakEvaluators.length >= 10}
                                    className="rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 font-black text-[10px] tracking-widest px-4 py-2"
                                >
                                    <Plus size={14} className="mr-2" /> Müfettiş Ekle
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {kapakEvaluators.map((ev, index) => (
                                    <div key={index} className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/60 relative">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase text-slate-400">
                                                {(() => {
                                                    const total = kapakEvaluators.length;
                                                    if (total === 2) {
                                                        return index === 0 ? "1. İmza Bloğu (Kıdemli)" : "2. İmza Bloğu (Kıdemsiz)";
                                                    }
                                                    if (total === 3) {
                                                        if (index === 0) return "1. İmza Bloğu (En Kıdemli)";
                                                        if (index === 1) return "2. İmza Bloğu (Kıdemli)";
                                                        return "3. İmza Bloğu (En Kıdemsiz)";
                                                    }
                                                    return `${index + 1}. İmza Bloğu`;
                                                })()}
                                            </span>
                                            {kapakEvaluators.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveKapakEvaluator(index)}
                                                    className="text-xs text-rose-500 hover:underline font-bold"
                                                >
                                                    Kaldır
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Adı Soyadı</label>
                                                <input 
                                                    type="text" 
                                                    value={ev.name}
                                                    onChange={(e) => handleKapakEvaluatorChange(index, "name", e.target.value)}
                                                    placeholder="Örn: Sefa YAPRAKLI"
                                                    required
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Unvanı</label>
                                                <select 
                                                    value={ev.title}
                                                    onChange={(e) => handleKapakEvaluatorChange(index, "title", e.target.value)}
                                                    required
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none text-xs font-bold"
                                                >
                                                    <option value="">Seçiniz...</option>
                                                    <option value="Müfettiş">Müfettiş</option>
                                                    <option value="Başmüfettiş">Başmüfettiş</option>
                                                    <option value="Müfettiş Yardımcısı">Müfettiş Yardımcısı</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 justify-end">
                            <Button 
                                type="button"
                                variant="ghost" 
                                onClick={() => setIsKapakModalOpen(false)}
                                disabled={generatingKapak}
                                className="h-14 px-8 rounded-2xl font-bold text-slate-500"
                            >
                                İptal
                            </Button>
                            <Button 
                                type="submit"
                                disabled={generatingKapak}
                                className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-600/10 hover:-translate-y-0.5 transition-all"
                            >
                                {generatingKapak ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Download className="mr-2" size={18} />}
                                Word Belgesi Oluştur ve İndir
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>,
            document.body
        );
    };

    const renderDashboard = () => {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                            <Shield size={10} className="text-primary/60" />
                            <span>MufYard Platformu</span>
                            <ChevronRight size={10} />
                            <span className="text-primary opacity-80 uppercase tracking-widest">Diğer İşlem ve Belgeler</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            Diğer İşlem ve Belgeler
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-1">Resmi teftiş ve diğer işlemleriniz için şablonları kullanın.</p>
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Card 1: Müfettiş Yardımcısı Değerlendirme Formu */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Müfettiş Yardımcısı Değerlendirme Formu</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Müfettiş yardımcılarının teftiş ve soruşturma aşamalarındaki takım çalışması, motivasyon, mesleki gelişim gibi kriterler yönünden değerlendirildiği resmi formu interaktif düzenleyin ve yazdırın.
                        </p>
                        <Button 
                            onClick={() => setIsFormModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest py-3 animate-pulse hover:animate-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 2: Dizi Pusulası Taslağı */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <ListIcon size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Dizi Pusulası Taslağı</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Teftiş raporu eklerinin listelendiği resmi Dizi Pusulası belgesini (.docx) hazırlayın. Eklerin sayısı, tarihleri ve açıklamalarını tablo halinde düzenleyerek çıktı alın.
                        </p>
                        <Button 
                            onClick={() => setIsDiziModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest py-3 animate-pulse hover:animate-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 3: Teftiş Rapor Kapağı Taslağı */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Teftiş Rapor Kapağı Taslağı</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Bakanlık onayları, görev emirleri, sayfa adedi, ilgili birim, konu ve müfettiş imza bloklarını içeren resmi rapor kapak belgesini (.docx) hızlıca oluşturup indirin.
                        </p>
                        <Button 
                            onClick={() => setIsKapakModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest py-3 animate-pulse hover:animate-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>
                </div>

                {/* Render Modals */}
                {renderDiziModal()}
                {renderKapakModal()}
                {renderFormModal()}
            </div>
        );
    };

    if (scope === "other") {
        return renderDashboard();
    }

    return (
        <div 
            className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platformu</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Dosya Yönetimi</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        Dosya Yönetimi
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Denetim klasörlerinizi ve belgelerinizi organize edin.</p>
                </div>
                <div className="flex gap-2 p-1.5 bg-card/40 dark:bg-slate-900/40 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-sm shadow-sm">
                    <Button 
                        variant="ghost" 
                        onClick={loadData}
                        className="h-10 w-10 rounded-2xl p-0 hover:rotate-180 transition-transform duration-500"
                        title="Yenile"
                    >
                        <RefreshCw size={16} className="text-slate-600 dark:text-slate-400" />
                    </Button>
                    <Button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-10 px-6 shadow-lg shadow-primary/20 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        {isUploading ? <RefreshCw className="mr-2 animate-spin" size={16} /> : <Upload className="mr-2" size={16} />}
                        Dosya Yükle
                    </Button>
                    <Button
                        onClick={handleCreateFolder}
                        variant="outline"
                        className="h-10 px-4 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                    >
                        <Plus size={16} className="mr-2" />
                        Klasör
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 order-2 lg:order-1">
                    <Card className="p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm h-fit lg:h-[700px] overflow-y-auto custom-scrollbar border-none">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500">Klasör Ağacı</h3>
                        </div>
                        <div className="space-y-1">
                            <Tree 
                                items={items} 
                                expandedFolders={expandedFolders} 
                                onToggle={toggleFolder} 
                                onSelect={setCurrentPath} 
                                selectedId={currentPath} 
                                onAddFolder={handleCreateFolder}
                                onShare={setSharingFile}
                                onDelete={handleDelete}
                            />
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-9 order-1 lg:order-2 space-y-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full bg-card/60 border border-white/80 rounded-2xl px-5 py-3 flex items-center shadow-inner-sm focus-within:ring-2 ring-primary/10 transition-all backdrop-blur-sm">
                            <Search size={18} className="text-slate-400 mr-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Dosya adı, tür veya içerik ile ara..."
                                className="bg-transparent border-none outline-none text-sm w-full font-medium text-muted-foreground placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2 p-1.5 bg-card/40 dark:bg-slate-900/40 rounded-2xl border border-white/60 dark:border-slate-800 backdrop-blur-sm">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setViewMode('list')}
                                className={cn("rounded-xl h-9 w-9 p-0", viewMode === 'list' ? "shadow-md bg-muted text-primary" : "text-slate-500")}
                            >
                                <ListIcon size={18} />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setViewMode('grid')}
                                className={cn("rounded-xl h-9 w-9 p-0", viewMode === 'grid' ? "shadow-md bg-muted text-primary" : "text-slate-500")}
                            >
                                <Grid size={18} />
                            </Button>
                        </div>
                    </div>

                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                {currentPath && (
                                    <button
                                        onClick={() => {
                                            const parts = currentPath.split('/');
                                            parts.pop();
                                            setCurrentPath(parts.join('/'));
                                        }}
                                        className="flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary/70 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition-all shrink-0"
                                    >
                                        <ChevronRight size={12} className="rotate-180" /> Geri
                                    </button>
                                )}
                                <button 
                                    onClick={() => setCurrentPath('')}
                                    className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", !currentPath ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                                >
                                    ROOT
                                </button>
                                {breadcrumbs.map((crumb, i) => (
                                    <div key={i} className="flex items-center gap-2 shrink-0">
                                        <ChevronRight size={12} className="text-slate-300" />
                                        <button 
                                            onClick={() => setCurrentPath(breadcrumbs.slice(0, i + 1).join('/'))}
                                            className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", i === breadcrumbs.length - 1 ? "text-primary" : "text-slate-400 hover:text-slate-600")}
                                        >
                                            {crumb}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    {/* File List/Grid */}
                    <Card className={cn(
                        "p-0 border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-md overflow-hidden rounded-3xl min-h-[550px] border-none transition-all duration-300",
                        isDragActive && "ring-4 ring-primary/40 bg-primary/10 border-primary/30"
                    )}>
                        {isDragActive && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/10 backdrop-blur-sm rounded-3xl border-4 border-dashed border-primary/40 pointer-events-none">
                                <Upload size={48} className="text-primary mb-4 animate-bounce" />
                                <p className="text-primary font-bold text-lg">Dosyayı buraya bırakın</p>
                            </div>
                        )}
                        {loading ? (
                            <div className="h-[550px] flex flex-col items-center justify-center gap-4">
                                <motion.div 
                                    animate={{ rotate: 360 }} 
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="p-4 rounded-3xl bg-primary/5 text-primary"
                                >
                                    <RefreshCw size={32} />
                                </motion.div>
                                <p className="text-slate-400 text-sm font-medium animate-pulse">Dosyalar okunuyor...</p>
                            </div>
                        ) : currentFiles.length > 0 ? (
                            <div className={cn("p-4", viewMode === 'list' ? "divide-y divide-white/40 dark:divide-slate-800/40" : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4")}>
                                <AnimatePresence mode="popLayout">
                                    {visibleFiles.map((item) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            key={item.id}
                                            onClick={() => item.type === 'folder' ? setCurrentPath(item.id) : setPreviewFile(item)}
                                            className={cn(
                                                "group cursor-pointer transition-all active:scale-95 duration-300",
                                                viewMode === 'list' 
                                                    ? "flex items-center justify-between p-4 rounded-2xl hover:bg-card/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-white dark:hover:border-slate-700 hover:shadow-sm"
                                                    : "flex flex-col items-center justify-center p-6 rounded-3xl bg-card/30 dark:bg-slate-900/30 border border-white/60 dark:border-slate-800 hover:bg-card/80 dark:hover:bg-slate-800 hover:shadow-lg hover:border-primary/20 aspect-square text-center relative"
                                            )}
                                        >
                                            <div className={cn("flex items-center", viewMode === 'list' ? "gap-4" : "flex-col gap-3")}>
                                                <div className={cn(
                                                    "p-3 rounded-2xl bg-card shadow-sm group-hover:scale-110 transition-transform duration-500",
                                                    item.type === 'folder' ? "bg-primary/5 dark:bg-primary/20" : ""
                                                )}>
                                                    {getFileIcon(item)}
                                                </div>
                                                <div className={cn("min-w-0", viewMode === 'list' ? "flex-1" : "px-2")}>
                                                    <p className={cn("font-bold text-foreground dark:text-slate-200 transition-colors group-hover:text-primary", viewMode === 'list' ? "text-sm truncate" : "text-xs line-clamp-2 uppercase tracking-wide")}>{item.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium truncate">{item.size || 'Klasör'} {item.date && `• ${item.date}`}</p>
                                                </div>
                                              <div className={cn("flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0 z-20", viewMode === 'list' ? "ml-2" : "absolute top-4 right-4")}>
                                                {item.type === 'folder' && (
                                                    <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        onClick={(e) => { e.stopPropagation(); handleCreateFolder(); }}
                                                        className="h-8 w-8 rounded-xl text-primary hover:bg-primary hover:text-white hidden md:flex"
                                                        title="İçine Klasör Ekle"
                                                    >
                                                        <Plus size={14} />
                                                    </Button>
                                                )}

                                                {isElectron && item.type === 'folder' && (
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => { e.stopPropagation(); handleOpenFolder(item.id); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-primary hidden md:flex"
                                                    title="Klasörü Aç"
                                                >
                                                    <FolderOpen size={14} />
                                                </Button>
                                                )}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-primary"
                                                    title="İndir"
                                                >
                                                    <Download size={14} />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); setSharingFile(item); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-emerald-500 hidden sm:flex"
                                                    title="Paylaş"
                                                >
                                                    <Share2 size={14} />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-500"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                        </motion.div>
                                    ))}

                                    {/* Yeni Klasör Ekle Kartı (En Sonunda) */}
                                    {!searchQuery && (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            onClick={handleCreateFolder}
                                            className={cn(
                                                "group cursor-pointer transition-all active:scale-95 duration-300 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 rounded-3xl flex flex-col items-center justify-center gap-3",
                                                viewMode === 'list' ? "hidden" : "aspect-square p-6"
                                            )}
                                        >
                                            <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-500">
                                                <Plus size={24} strokeWidth={3} />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Klasör Ekle</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {currentFiles.length > visibleFiles.length && (
                                    <div className="px-4 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        İlk 80 öğe gösteriliyor
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-[550px] flex flex-col items-center justify-center text-center p-12">
                                <div className="p-6 rounded-full bg-muted dark:bg-slate-800 mb-6 group-hover:scale-110 transition-transform">
                                    <Folder size={64} className="text-slate-200 dark:text-muted-foreground" strokeWidth={1} />
                                </div>
                                <h3 className="text-xl font-bold text-foreground dark:text-slate-200">Burası Çok Sessiz...</h3>
                                <p className="text-slate-400 text-sm mt-2 max-w-xs">Bu klasörde henüz bir dosya bulunmuyor. Yeni bir dosya yükleyerek başlayın.</p>
                                <Button onClick={() => fileInputRef.current?.click()} className="mt-8 rounded-2xl">Dosya Yükle</Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Preview Modal */}
            {createPortal(
            <AnimatePresence>
                {previewFile && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-12 backdrop-blur-md"
                        style={{ backgroundColor: 'rgba(15,23,42,0.8)' }}
                        onClick={() => setPreviewFile(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-card rounded-[40px] shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-muted/50 dark:bg-slate-950/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-card rounded-2xl shadow-sm">{getFileIcon(previewFile)}</div>
                                    <div>
                                        <h3 className="font-black text-foreground dark:text-slate-100">{previewFile.name}</h3>
                                        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">{previewFile.size} • {previewFile.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isElectron && (
                                    <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => handleOpenFolder(previewFile.id)}
                                        className="rounded-2xl h-12 w-12 bg-card border-slate-100 dark:border-slate-800"
                                        title="Klasörü Aç"
                                    >
                                        <FolderOpen size={18} />
                                    </Button>
                                    )}
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() => handleDownload(previewFile)}
                                        className="rounded-2xl h-12 w-12 bg-card border-slate-100 dark:border-slate-800"
                                        title="İndir"
                                    >
                                        <Download size={18} />
                                    </Button>
                                    {isElectron && (
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={() => handleOpenFile(previewFile.id)}
                                            className="rounded-xl h-12 w-12 bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white"
                                            title="Uygulamada Aç"
                                        >
                                            <ExternalLink size={18} />
                                        </Button>
                                    )}
                                    <Button size="icon" variant="outline" onClick={() => setPreviewFile(null)} className="rounded-2xl h-12 w-12 bg-card border-slate-100 dark:border-slate-800"><X size={18} /></Button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative group">
                                {previewFile.type === 'image' ? (
                                    <img src={resolveFileUrl(previewFile.url)} alt={previewFile.name} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                                ) : previewFile.type === 'pdf' ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex justify-end bg-white/70 dark:bg-slate-900/40">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => window.open(resolveFileUrl(previewFile.url), "_blank")}
                                                className="rounded-xl"
                                            >
                                                PDF'yi Ayrı Pencerede Aç
                                            </Button>
                                        </div>
                                        <object
                                            data={resolveFileUrl(previewFile.url)}
                                            type="application/pdf"
                                            className="w-full flex-1"
                                        >
                                            <iframe src={resolveFileUrl(previewFile.url)} className="w-full h-full border-none shadow-2xl" />
                                        </object>
                                    </div>
                                ) : previewFile.type === 'video' ? (
                                    <video 
                                        src={resolveFileUrl(previewFile.url)} 
                                        controls 
                                        autoPlay
                                        className="max-w-full max-h-full shadow-2xl"
                                    />
                                ) : previewFile.type === 'audio' ? (
                                    <div className="flex flex-col items-center gap-8">
                                        <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                                            <Music size={64} />
                                        </div>
                                        <audio 
                                            src={resolveFileUrl(previewFile.url)} 
                                            controls 
                                            autoPlay
                                            className="w-[400px]"
                                        />
                                    </div>
                                ) : previewFile.type === 'text' ? (
                                    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900/50">
                                        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between bg-white/70 dark:bg-slate-900/40">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dosya İçeriği</p>
                                            <Button size="sm" variant="outline" onClick={() => handleDownload(previewFile)} className="rounded-xl">İndir</Button>
                                        </div>
                                        <div className="flex-1 overflow-auto p-6 font-mono text-sm">
                                            {textPreview.loading ? (
                                                <div className="h-full flex items-center justify-center gap-2 text-slate-500">
                                                    <RefreshCw size={18} className="animate-spin" />
                                                    <span className="text-sm font-semibold">Yükleniyor...</span>
                                                </div>
                                            ) : textPreview.error ? (
                                                <div className="h-full flex flex-col items-center justify-center gap-3">
                                                    <p className="text-rose-500">{textPreview.error}</p>
                                                    <Button size="sm" onClick={() => handleDownload(previewFile)}>İndirip Aç</Button>
                                                </div>
                                            ) : (
                                                <pre className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                                                    {textPreview.content}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                ) : isSpreadsheetFile(previewFile) || previewFile.type === 'excel' ? (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between bg-white/70 dark:bg-slate-900/40">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Excel Önizleme (ilk 200 satır)</p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDownload(previewFile)}
                                                className="rounded-xl"
                                            >
                                                Tamamını İndir
                                            </Button>
                                        </div>
                                        <div className="flex-1 overflow-auto p-3">
                                            {spreadsheetPreview.loading ? (
                                                <div className="h-full flex items-center justify-center gap-2 text-slate-500">
                                                    <RefreshCw size={18} className="animate-spin" />
                                                    <span className="text-sm font-semibold">Excel içeriği yükleniyor...</span>
                                                </div>
                                            ) : spreadsheetPreview.error ? (
                                                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                                                    <p className="text-sm font-semibold text-rose-500">{spreadsheetPreview.error}</p>
                                                    <Button size="sm" variant="outline" onClick={() => handleDownload(previewFile)}>
                                                        İndirip Aç
                                                    </Button>
                                                </div>
                                            ) : spreadsheetPreview.rows.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-sm font-semibold text-slate-500">
                                                    Görüntülenecek veri bulunamadı.
                                                </div>
                                            ) : (
                                                <table className="min-w-full text-[11px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {spreadsheetPreview.rows.map((row, rowIndex) => (
                                                            <tr key={rowIndex} className={cn(rowIndex === 0 ? "bg-slate-50 dark:bg-slate-800/50 font-black text-slate-900 dark:text-white" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors")}>
                                                                {row.map((cell, cellIndex) => (
                                                                    <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 border-x border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                                        {cell}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-12">
                                        <div className="relative inline-block mb-8">
                                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                            <FileIcon size={140} className="text-slate-200 dark:text-slate-800 relative z-10" strokeWidth={0.5} />
                                            <div className="absolute bottom-2 right-2 bg-amber-500 text-white p-3 rounded-2xl shadow-xl z-20">
                                                <HelpCircle size={24} />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Önizleme Desteklenmiyor</h3>
                                        <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">
                                            Bu dosya türü ({previewFile.name.split('.').pop()?.toUpperCase()}) tarayıcıda doğrudan görüntülenemiyor.
                                        </p>
                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                            {isElectron && (
                                                <Button
                                                    onClick={() => handleOpenFile(previewFile.id)}
                                                    className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-white font-black uppercase text-xs tracking-widest hover:-translate-y-1 transition-all active:scale-95"
                                                >
                                                    <ExternalLink className="mr-3" size={20} />
                                                    Uygulamada Aç
                                                </Button>
                                            )}
                                            <Button
                                                onClick={() => handleDownload(previewFile)}
                                                variant={isElectron ? "outline" : "primary"}
                                                className={cn(
                                                    "h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95",
                                                    !isElectron && "shadow-xl shadow-primary/20 bg-primary text-white hover:-translate-y-1",
                                                    isElectron && "border-2"
                                                )}
                                            >
                                                <Download className="mr-3" size={20} />
                                                Dosyayı İndir
                                            </Button>
                                            {isElectron && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleOpenFolder(previewFile.id)}
                                                    className="h-14 px-8 rounded-2xl font-black uppercase text-xs tracking-widest border-2"
                                                >
                                                    <FolderOpen className="mr-3" size={20} />
                                                    Klasörde Göster
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}

            {/* Share Modal */}
            {createPortal(
            <AnimatePresence>
                {sharingFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                        style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
                        onClick={() => !sharingLoading && setSharingFile(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-card w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 bg-primary text-white">
                                <h3 className="text-xl font-black tracking-tight">Dosyayı Paylaş</h3>
                                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">"{sharingFile.name}"</p>
                            </div>
                            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2 py-2">Müfettiş Seçin</p>
                                {allProfiles.length > 0 ? (
                                    allProfiles.map(p => (
                                        <button
                                            key={p.uid}
                                            disabled={sharingLoading}
                                            onClick={() => handleShareToInspector(p)}
                                            className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/5 dark:bg-primary/20 flex items-center justify-center text-primary font-black uppercase text-sm group-hover:scale-110 transition-transform">
                                                {p.full_name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{p.full_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{p.title || "Müfettiş"}</p>
                                            </div>
                                            <Share2 size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                                        </button>
                                    ))
                                ) : (
                                    <p className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Kayıtlı müfettiş bulunamadı.</p>
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => setSharingFile(null)}
                                    disabled={sharingLoading}
                                    className="rounded-xl font-bold"
                                >
                                    İptal
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            , document.body)}

            {/* Yeni Klasör Modalı */}
            {isFolderModalOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
                    <Card className="w-full max-w-md p-8 rounded-3xl shadow-2xl border-white/60 bg-card/90 backdrop-blur-xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                <Plus size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black font-outfit text-slate-900">Yeni Klasör Oluştur</h3>
                                <p className="text-xs text-slate-500 font-medium">Lütfen klasör adını giriniz.</p>
                            </div>
                        </div>
                        <form onSubmit={handleFolderSubmit} className="space-y-6">
                            <input
                                autoFocus
                                required
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Klasör Adı (Örn: 2024 Denetimleri)"
                                className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                            />
                            <div className="flex gap-3 pt-2">
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    onClick={() => setIsFolderModalOpen(false)}
                                    className="flex-1 h-14 rounded-2xl font-bold text-slate-500"
                                >
                                    İptal
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={creatingFolder || !newFolderName.trim()}
                                    className="flex-1 h-14 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all"
                                >
                                    {creatingFolder ? <RefreshCw className="animate-spin" size={18} /> : "Oluştur"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            , document.body)}
        </div>
    );
}

function Tree({ items, expandedFolders, onToggle, onSelect, selectedId, onAddFolder, onShare, onDelete, parentId = null }: any) {
    const children = items.filter((item: any) => {
        // If parentId is null, we look for items without parentId or root items
        if (parentId === null) return !item.parentId;
        return item.parentId === parentId && item.type === 'folder';
    });
    
    if (children.length === 0) return null;

    return (
        <div className={cn("space-y-1", parentId !== null ? "ml-4 border-l border-slate-100/50 pl-2 mt-1" : "")}>
            {children.map((child: any) => {
                if (child.type !== 'folder') return null;
                return (
                    <div key={child.id}>
                        <div
                            className={cn(
                                "flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-300 group hover:translate-x-1",
                                selectedId === child.id ? "bg-primary/5 dark:bg-primary/20 text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-muted dark:hover:bg-slate-800"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(child.id);
                                onToggle(child.id);
                            }}
                        >
                            <span className="shrink-0 transition-transform duration-300">
                                {expandedFolders.has(child.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5" />}
                            </span>
                            <Folder size={18} className={cn("shrink-0 transition-all", expandedFolders.has(child.id) ? "text-primary fill-primary/10" : "text-slate-400 group-hover:text-primary")} />
                            <span className={cn("text-[13px] truncate font-semibold flex-1", selectedId === child.id ? "font-bold" : "")}>{child.name}</span>
                            
                            <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onAddFolder(); }}
                                    className="p-1 hover:bg-primary/10 rounded-lg text-slate-400 hover:text-primary transition-colors"
                                    title="Buraya Klasör Ekle"
                                >
                                    <Plus size={12} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onShare(child); }}
                                    className="p-1 hover:bg-emerald-500/10 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                                    title="Paylaş"
                                >
                                    <Share2 size={12} />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(child.id); }}
                                    className="p-1 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                        {expandedFolders.has(child.id) && (
                            <Tree 
                                items={items} 
                                expandedFolders={expandedFolders} 
                                onToggle={onToggle} 
                                onSelect={onSelect} 
                                selectedId={selectedId} 
                                parentId={child.id}
                                onAddFolder={onAddFolder}
                                onShare={onShare}
                                onDelete={onDelete}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
