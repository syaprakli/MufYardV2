import { Search, Plus, Loader2, Tag, Pin, FileText, Trash2, Shield, ChevronRight, ChevronDown, Upload, Folder, FolderOpen, Filter, Archive, ExternalLink, X, Check, Edit } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect, useMemo } from "react";
import { fetchLegislations, createLegislation, updateLegislation, deleteLegislation, uploadLegislationFile, openLegislationFolder, openLegislationFileLocation, syncLegislationFolder, promoteToPublic, approveLegislation, rejectLegislation, fetchExternalLegislation, type Legislation } from "../lib/api/legislation";
import { RefreshCcw, UserCheck, Zap } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { Lock, Globe } from "lucide-react";
import { isElectron } from "../lib/firebase";
import { BASE_URL } from "../lib/config";


const CATEGORIES = ["Tümü", "GSB", "KYK", "Federasyon", "Özel Yurt", "Spor Kulüpleri", "Genel"];
const DOC_TYPES = ["Kanun", "KHK", "Yönetmelik", "Genelge", "Özelge", "Yazı"];

export default function Legislation() {
    const { user, profile } = useAuth();
    const isAdminOrMod = profile?.role === 'admin' || profile?.role === 'moderator';
    const confirm = useConfirm();
    const [selectedCategory, setSelectedCategory] = useState("Tümü");
    const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(["GSB", "KYK"]);
    const [legislations, setLegislations] = useState<Legislation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLeg, setEditingLeg] = useState<Legislation | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [visibilityTab, setVisibilityTab] = useState<"all" | "personal">("all");


    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [newLeg, setNewLeg] = useState({
        title: "",
        category: "Genel",
        doc_type: "Kanun",
        summary: "",
        content: "",
        tagsString: "",
        official_gazette_info: "",
        document_url: "",
        local_path: "",
        is_pinned: false,
        is_public: true
    });

    
    const [newDocType, setNewDocType] = useState("");
    const [isCreatingDocType, setIsCreatingDocType] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isFetchingExternal, setIsFetchingExternal] = useState(false);


    useEffect(() => {
        loadLegislations();
    }, [selectedCategory, user?.uid]);

    const loadLegislations = async () => {
        try {
            setLoading(true);
            const data = await fetchLegislations(user?.uid || undefined, selectedCategory === "Tümü" ? "All" : selectedCategory, isAdminOrMod);
            setLegislations(data);
        } catch (error) {
            console.error("Mevzuat yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };


    const handleFetchExternal = async () => {
        if (!newLeg.document_url || !newLeg.document_url.includes("mevzuat.gov.tr")) {
            toast.error("Lütfen geçerli bir mevzuat.gov.tr bağlantısı girin.");
            return;
        }

        try {
            setIsFetchingExternal(true);
            const data = await fetchExternalLegislation(newLeg.document_url);
            
            setNewLeg(prev => ({
                ...prev,
                title: data.title || prev.title,
                official_gazette_info: data.official_gazette_info || prev.official_gazette_info,
                summary: data.summary || prev.summary,
                content: data.content || prev.content,
                doc_type: data.doc_type || prev.doc_type
            }));
            
            toast.success("Bilgiler mevzuat.gov.tr'den başarıyla çekildi.");
        } catch (error: any) {
            toast.error("Veri çekilemedi: " + error.message);
        } finally {
            setIsFetchingExternal(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingLeg(null);
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (leg: Legislation) => {
        setEditingLeg(leg);
        setNewLeg({
            title: leg.title || "",
            category: leg.category || "Genel",
            doc_type: leg.doc_type || "Kanun",
            summary: leg.summary || "",
            content: leg.content || "",
            tagsString: (leg.tags || []).join(", "),
            official_gazette_info: leg.official_gazette_info || "",
            document_url: leg.document_url || "",
            local_path: leg.local_path || "",
            is_pinned: leg.is_pinned || false,
            is_public: leg.is_public ?? true
        });
        setUploadingFile(null);
        setNewCategory("");
        setIsCreatingCategory(false);
        setNewDocType("");
        setIsCreatingDocType(false);
        setIsModalOpen(true);
    };

    const handleSaveLeg = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsUploading(true);
            let finalLocalPath = newLeg.local_path;
            let finalDocUrl = newLeg.document_url;
            const categoryToUse = isCreatingCategory && newCategory.trim() ? newCategory.trim() : newLeg.category;
            const docTypeToUse = isCreatingDocType && newDocType.trim() ? newDocType.trim() : newLeg.doc_type;

            if (uploadingFile) {
                const uploaded = await uploadLegislationFile(uploadingFile, categoryToUse, docTypeToUse, user?.uid || undefined, newLeg.is_public);
                finalLocalPath = uploaded.local_path || uploaded.file_url;
                if (uploaded.file_url) {
                    finalDocUrl = uploaded.file_url;
                }
            }

            const tags = newLeg.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");

            if (editingLeg) {
                await updateLegislation(editingLeg.id, {
                    title: newLeg.title,
                    category: categoryToUse,
                    doc_type: docTypeToUse,
                    summary: newLeg.summary,
                    content: newLeg.content,
                    tags: tags,
                    official_gazette_info: newLeg.official_gazette_info,
                    document_url: finalDocUrl,
                    local_path: finalLocalPath,
                    is_pinned: newLeg.is_pinned,
                    is_public: newLeg.is_public,
                    last_updated_by_name: user?.displayName || user?.email || "Müfettiş"
                });
                toast.success("Mevzuat ve dosya başarıyla güncellendi.");
            } else {
                await createLegislation({
                    title: newLeg.title,
                    category: categoryToUse,
                    doc_type: docTypeToUse,
                    summary: newLeg.summary,
                    content: newLeg.content,
                    tags: tags,
                    official_gazette_info: newLeg.official_gazette_info,
                    document_url: finalDocUrl,
                    local_path: finalLocalPath,
                    is_pinned: newLeg.is_pinned,
                    owner_id: user?.uid || undefined,
                    is_public: newLeg.is_public
                }, isAdminOrMod);
                toast.success("Mevzuat başarıyla eklendi.");
            }

            setIsModalOpen(false);
            setEditingLeg(null);
            resetForm();
            loadLegislations();
        } catch (error: any) {
            toast.error(error.message || (editingLeg ? "Mevzuat güncellenemedi." : "Mevzuat eklenemedi."));
        } finally {
            setIsUploading(false);
        }
    };

    const resetForm = () => {
        setNewLeg({ 
            title: "", 
            category: "Genel", 
            doc_type: "Kanun", 
            summary: "", 
            content: "", 
            tagsString: "", 
            official_gazette_info: "", 
            document_url: "",
            local_path: "",
            is_pinned: false,
            is_public: true 
        });

        setUploadingFile(null);
        setNewCategory("");
        setIsCreatingCategory(false);
        setNewDocType("");
        setIsCreatingDocType(false);
    };

    const [isSyncing, setIsSyncing] = useState(false);

    const handleOpenFolder = async (cat?: string, docType?: string) => {
        try {
            const categoryToOpen = cat || (selectedCategory !== "Tümü" ? selectedCategory : undefined);
            const docTypeToOpen = docType || (selectedSubType || undefined);
            await openLegislationFolder(categoryToOpen, docTypeToOpen);
            toast.success("Mevzuat klasörü Windows Gezgininde açıldı.");
        } catch (error: any) {
            toast.error("Klasör açılamadı: " + error.message);
        }
    };

    const handleOpenFileLocation = async (leg: Legislation) => {
        try {
            const targetPath = leg.local_path || leg.document_url;
            const res = await openLegislationFileLocation(targetPath, leg.category, leg.doc_type);
            if (res.type === 'file') {
                toast.success("Dosya klasöründe seçildi ve açıldı.");
            } else {
                toast.success(res.message || "İlgili mevzuat klasörü açıldı.");
            }
        } catch (error: any) {
            toast.error("Dosya konumu açılamadı: " + error.message);
        }
    };

    const handleSync = async () => {
        try {
            setIsSyncing(true);
            const res = await syncLegislationFolder();
            if (res.imported_count > 0) {
                toast.success(`${res.imported_count} yeni mevzuat dosyası kütüphaneye aktarıldı!`);
            } else {
                toast.success("Mevzuat klasörü taranmıştır, yeni dosya bulunamadı.");
            }
            loadLegislations();
        } catch (error: any) {
            toast.error("Klasör senkronizasyon hatası: " + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: "Mevzuatı Sil",
            message: "Bu mevzuatı kütüphaneden kalıcı olarak silmek istediğinize emin misiniz?",
            confirmText: "Kalıcı Olarak Sil",
            cancelText: "Vazgeç",
            variant: "danger"
        });
        
        if (!confirmed) return;

        try {
            await deleteLegislation(id);
            toast.success("Mevzuat başarıyla silindi.");
            loadLegislations();
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        }
    };

    const handlePromote = async (id: string, title: string) => {
        const confirmed = await confirm({
            title: "Kurumsal Arşiv'e Taşı",
            message: `'${title}' belgesini tüm müfettişler ile paylaşmak (Kurumsal Arşiv'e taşımak) istediğinize emin misiniz?`,
            confirmText: "Paylaş ve Taşı",
            cancelText: "Vazgeç",
            variant: "info"
        });
        
        if (!confirmed) return;

        try {
            await promoteToPublic(id, user?.displayName || user?.email || "Müfettiş");
            toast.success("Belge genel arşive taşındı.");
            loadLegislations();
        } catch (error) {
            toast.error("İşlem başarısız oldu.");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {

        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(file);
        setNewLeg(prev => ({
            ...prev,
            title: prev.title || file.name.split('.')[0].replace(/_/g, ' ')
        }));
    };


    const toggleExpand = (cat: string) => {
        setExpandedCategories(prev => 
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const availableSubTypesForCategory = useMemo(() => {
        if (selectedCategory === "Tümü") return [];
        const typesInCat = Array.from(new Set(
            legislations
                .filter(l => l.category === selectedCategory)
                .map(l => l.doc_type)
                .filter(Boolean)
        )) as string[];
        
        // Custom priority sort based on user list
        return typesInCat.sort((a, b) => {
            const indexA = DOC_TYPES.indexOf(a);
            const indexB = DOC_TYPES.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [legislations, selectedCategory]);

    const filteredLegislations = useMemo(() => {
        let filtered = legislations;
        if (selectedCategory && selectedCategory !== "Tümü") {
            filtered = filtered.filter(l => l.category === selectedCategory);
        }
        if (selectedSubType) {
            filtered = filtered.filter(l => l.doc_type === selectedSubType);
        }
        if (searchQuery) {
            const lowQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(l => 
                l.title.toLowerCase().includes(lowQuery) ||
                l.summary?.toLowerCase().includes(lowQuery) ||
                l.tags?.some(t => t.toLowerCase().includes(lowQuery))
            );
        }
        
        // Filter based on Tab Toggle
        if (visibilityTab === "personal") {
            filtered = filtered.filter(l => l.is_public === false && l.owner_id === user?.uid);
        } else {
            // "all" tab shows both public and personal for a unified view
            // filtered already contains both from the API result
        }

        // Final Sort: Pinned First -> Priority Type -> Title
        return [...filtered].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            
            const indexA = DOC_TYPES.indexOf(a.doc_type || "");
            const indexB = DOC_TYPES.indexOf(b.doc_type || "");
            
            if (indexA !== indexB) {
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            }
            
            return a.title.localeCompare(b.title);
        });
    }, [legislations, selectedCategory, selectedSubType, searchQuery, visibilityTab, user?.uid]);


    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 md:mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span className="hidden xs:inline">MufYard Platform</span>
                        <ChevronRight size={10} className="hidden xs:inline" />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Mevzuat Arşivi</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm active:scale-95 transition-all"
                        >
                            <Folder size={18} />
                        </button>
                        <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-foreground tracking-tight leading-tight">
                            Dijital Mevzuat Kütüphanesi
                        </h1>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center w-full lg:w-auto">
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl h-11 md:h-10 shadow-sm border border-border dark:border-slate-700">
                        <button 
                            onClick={() => setVisibilityTab("all")}
                            className={cn(
                                "flex-1 md:flex-none px-4 md:px-6 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2",
                                visibilityTab === "all" ? "bg-card dark:bg-slate-700 text-primary dark:text-primary-light shadow-sm" : "text-slate-500 dark:text-slate-400"
                            )}
                        >
                            <Globe size={12} /> <span>Genel</span>
                        </button>
                        <button 
                            onClick={() => setVisibilityTab("personal")}
                            className={cn(
                                "flex-1 md:flex-none px-4 md:px-6 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2",
                                visibilityTab === "personal" ? "bg-card dark:bg-slate-700 text-primary dark:text-primary-light shadow-sm" : "text-slate-500 dark:text-slate-400"
                            )}
                        >
                            <Lock size={12} /> <span>Kişisel</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button 
                            onClick={() => handleOpenFolder()} 
                            variant="outline" 
                            className="h-11 md:h-9 px-3 rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Bilgisayarınızdaki Mevzuat klasörünü açar. Dosyalarınızı doğrudan bu klasöre kopyalayabilirsiniz."
                        >
                            <Folder size={14} className="mr-1.5 text-amber-500" /> Klasörü Aç
                        </Button>
                        <Button 
                            onClick={handleSync} 
                            variant="outline" 
                            disabled={isSyncing}
                            className="h-11 md:h-9 px-3 rounded-lg border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-emerald-50/40 dark:bg-emerald-950/30 hover:bg-emerald-100/60 shadow-sm"
                            title="Mevzuat klasörüne attığınız yeni dosyaları tarar ve kütüphaneye otomatik olarak ekler."
                        >
                            {isSyncing ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <RefreshCcw size={13} className="mr-1.5" />}
                            Klasörü Tara
                        </Button>
                        <Button 
                            onClick={handleOpenCreate} 
                            className="h-11 md:h-9 px-5 rounded-lg shadow-lg shadow-primary/20 bg-primary text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest"
                        >
                            <Plus size={16} className="mr-1.5" /> EKLE
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 gap-4 min-h-0 relative">
                {/* Left Sidebar Overlay for mobile */}
                <div className={cn(
                    "fixed inset-0 z-[45] bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
                    isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )} onClick={() => setIsSidebarOpen(false)} />

                {/* Left Sidebar - Folder Browser Tree */}
                <div className={cn(
                    "fixed md:relative inset-y-0 left-0 z-[46] w-72 md:w-72 bg-card md:bg-transparent transform transition-transform duration-300 md:transform-none flex flex-col gap-4",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}>
                    <div className="bg-card border border-border dark:border-slate-800 rounded-r-2xl md:rounded-2xl flex flex-col h-full shadow-2xl md:shadow-sm overflow-hidden border-border/60 dark:border-slate-800/60">
                        <div className="p-5 md:p-4 border-b border-border dark:border-slate-800 bg-muted/50 dark:bg-slate-950/20 flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Folder size={14} className="text-primary dark:text-primary-light" /> Birim / Belge Ağacı
                            </h3>
                            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-rose-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-2 space-y-0.5 custom-scrollbar">
                            {/* Yerel Mevzuat Klasörü Kartı */}
                            <div className="p-3 mb-2 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 mb-1">
                                    <Folder size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span>Yerel Mevzuat Klasörü</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mb-2.5">
                                    Webden tek tek yüklemek yerine dosyalarınızı bu klasöre atıp <strong>"Klasörü Tara"</strong> ile aktarabilirsiniz.
                                </p>
                                <div className="flex gap-1.5">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenFolder()}
                                        className="flex-1 h-7 text-[10px] font-bold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50"
                                    >
                                        <ExternalLink size={11} className="mr-1" /> Klasörü Aç
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSync}
                                        disabled={isSyncing}
                                        className="flex-1 h-7 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                    >
                                        {isSyncing ? <Loader2 size={11} className="animate-spin mr-1" /> : <RefreshCcw size={11} className="mr-1" />}
                                        Tara
                                    </Button>
                                </div>
                            </div>

                            {CATEGORIES.map(cat => (
                                <div key={cat} className="flex flex-col">
                                    <div className={cn(
                                        "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all group relative",
                                        selectedCategory === cat 
                                            ? "bg-primary/5 dark:bg-primary/20 text-primary dark:text-primary-light font-bold" 
                                            : "text-slate-600 dark:text-slate-400 hover:bg-muted dark:hover:bg-slate-800 font-medium"
                                    )}>
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={() => {
                                            setSelectedCategory(cat);
                                            setSelectedSubType(null);
                                            if (cat !== "Tümü") toggleExpand(cat);
                                        }}>
                                            {cat !== "Tümü" ? (
                                                expandedCategories.includes(cat) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                                            ) : <div className="w-3.5" />}
                                            <Folder size={16} className={cn(
                                                "shrink-0",
                                                selectedCategory === cat ? "text-primary dark:text-primary-light" : "text-slate-400 dark:text-slate-600 group-hover:text-primary"
                                            )} />
                                            <span className="truncate">{cat}</span>
                                        </div>
                                        
                                        {cat !== "Tümü" && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenFolder(cat);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 text-primary transition-all mr-1"
                                                title="Bu Klasörü Windows Gezgininde Aç"
                                            >
                                                <ExternalLink size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Sub-tree for Document Types */}
                                    {cat !== "Tümü" && expandedCategories.includes(cat) && (
                                        <div className="ml-6 mt-0.5 border-l border-slate-100 flex flex-col space-y-0.5">
                                            {availableSubTypesForCategory.map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => {
                                                        setSelectedCategory(cat);
                                                        setSelectedSubType(type);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-1 text-[11px] rounded-md transition-all flex items-center gap-2",
                                                        (selectedCategory === cat && selectedSubType === type)
                                                            ? "bg-primary text-white font-bold shadow-sm shadow-primary/20" 
                                                            : "text-slate-500 dark:text-slate-400 hover:bg-muted dark:hover:bg-slate-800 hover:text-primary font-medium"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-1 h-1 rounded-full",
                                                        (selectedCategory === cat && selectedSubType === type) ? "bg-card" : "bg-slate-300 dark:bg-slate-700"
                                                    )} />
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area - File Browser View */}
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* Compact Search/Filter Bar */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-card border border-border dark:border-slate-800 rounded-xl px-4 py-3 sm:py-2 flex items-center shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-muted/20 border-border/60 dark:border-slate-800/60">
                            <Search size={16} className="text-muted-foreground dark:text-slate-500 mr-2 shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Arşivde ara..."
                                className="bg-transparent border-none outline-none text-[13px] sm:text-sm w-full font-outfit text-muted-foreground dark:text-slate-200 placeholder:text-slate-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-card border border-border/60 dark:border-slate-800 rounded-xl px-4 h-11 sm:h-auto text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap overflow-x-auto no-scrollbar shadow-sm">
                            <Filter size={12} className="text-primary dark:text-primary-light shrink-0" /> 
                            <span className="shrink-0">Yol:</span> 
                            <span className="text-secondary dark:text-indigo-400 shrink-0">{selectedCategory}</span> 
                            {selectedSubType && <span className="flex items-center gap-1 shrink-0"><ChevronRight size={10} /> {selectedSubType}</span>}
                        </div>
                    </div>

                    {/* High-Density Archive List */}
                    <div className="flex-1 bg-card border border-border/60 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2.5 bg-muted/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            <div className="col-span-1">Tür</div>
                            <div className="col-span-5">Mevzuat Adı / Arşiv Notu</div>
                            <div className="col-span-2">Belge Türü</div>
                            <div className="col-span-2">Kurum / Birim</div>
                            <div className="col-span-2 text-right">Erişim</div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                                    <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase">Arşiv Katmanları Taranıyor...</p>
                                </div>
                            ) : filteredLegislations.length > 0 ? (
                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {filteredLegislations.map(leg => (
                                        <LegislationRow
                                            key={leg.id}
                                            leg={leg}
                                            isOwner={leg.owner_id === user?.uid}
                                            canDelete={isAdminOrMod || leg.owner_id === user?.uid}
                                            canEdit={isAdminOrMod || leg.owner_id === user?.uid}
                                            isAdmin={isAdminOrMod}
                                            onDelete={() => handleDelete(leg.id)}
                                            onEdit={() => handleOpenEdit(leg)}
                                            onPromote={() => handlePromote(leg.id, leg.title)}
                                            onOpenFileLocation={() => handleOpenFileLocation(leg)}
                                            onApprove={async () => {
                                                try {
                                                    await approveLegislation(leg.id, user?.displayName || user?.email || "Admin");
                                                    toast.success("Mevzuat onaylandı.");
                                                    loadLegislations();
                                                } catch (e) { toast.error("Hata!"); }
                                            }}
                                            onReject={async () => {
                                                const confirmed = await confirm({
                                                    title: "Mevzuatı Reddet",
                                                    message: "Bu mevzuat kaydını reddetmek ve silmek istediğinize emin misiniz?",
                                                    confirmText: "Reddet ve Sil",
                                                    variant: "danger"
                                                });
                                                if (confirmed) {
                                                    try {
                                                        await rejectLegislation(leg.id);
                                                        toast.success("Mevzuat reddedildi.");
                                                        loadLegislations();
                                                    } catch (e) { toast.error("Hata!"); }
                                                }
                                            }}
                                        />

                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
                                    <Archive size={40} className="mb-4 text-slate-300" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arama kriterine uygun kayıt bulunamadı</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingLeg(null);
                }}
                title={editingLeg ? "Mevzuatı Düzenle & Dosya Güncelle" : "Arşive Yeni Belge Ekle"}
                size="large"
            >
                <div className="mb-6 space-y-3">
                    {/* Hedef Klasör Bilgisi Kartı */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <FolderOpen size={16} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Kaydedileceği Yerel Klasör (Bilgisayarınızda)
                                </div>
                                <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                                    Belgelerim\MufYARD\Mevzuat\{isCreatingCategory && newCategory.trim() ? newCategory.trim() : newLeg.category}\{isCreatingDocType && newDocType.trim() ? newDocType.trim() : newLeg.doc_type}
                                </div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-[11px] font-bold text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 shrink-0 self-end sm:self-center"
                            onClick={() => handleOpenFolder(
                                isCreatingCategory && newCategory.trim() ? newCategory.trim() : newLeg.category,
                                isCreatingDocType && newDocType.trim() ? newDocType.trim() : newLeg.doc_type
                            )}
                            title="Bu hedef klasörü Windows Gezgininde aç"
                        >
                            <FolderOpen size={12} className="mr-1.5" />
                            Klasörü Aç
                        </Button>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 border-dashed relative overflow-hidden group">
                        <div className="flex flex-col gap-4 relative z-10">
                            {/* Mevcut dosya bilgisi (Düzenleme modu için) */}
                            {editingLeg && newLeg.local_path && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <div className="min-w-0">
                                            <span className="font-bold text-emerald-800 dark:text-emerald-300">Mevcut Dosya: </span>
                                            <span className="text-slate-600 dark:text-slate-300 truncate inline-block max-w-[160px] sm:max-w-[240px] align-bottom">
                                                {newLeg.local_path.split('/').pop()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                            onClick={() => {
                                                const url = newLeg.local_path.startsWith('http') ? newLeg.local_path : `${BASE_URL}${newLeg.local_path}`;
                                                window.open(url, '_blank');
                                            }}
                                            title="Dosyayı tarayıcıda aç"
                                        >
                                            <ExternalLink size={12} className="mr-1" /> Web
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                            onClick={() => handleOpenFileLocation({
                                                local_path: newLeg.local_path,
                                                category: isCreatingCategory && newCategory.trim() ? newCategory.trim() : newLeg.category,
                                                doc_type: isCreatingDocType && newDocType.trim() ? newDocType.trim() : newLeg.doc_type,
                                            } as any)}
                                            title="Dosyayı Windows Gezgininde seç ve göster"
                                        >
                                            <FolderOpen size={12} className="mr-1" /> Klasörde
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => setNewLeg(prev => ({ ...prev, local_path: "" }))}
                                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1"
                                            title="Dosyayı Kaldır"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                        {/* Dosya eklenmemiş uyarısı */}
                        {editingLeg && !newLeg.local_path && !uploadingFile && (
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                <FileText size={16} className="text-amber-600 shrink-0" />
                                <span><strong>Dosya Eksik:</strong> Bu mevzuata henüz dosya eklenmemiş. Aşağıdaki butondan dosya seçip yükleyebilirsiniz.</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-primary mb-1 text-outfit">
                                    {editingLeg ? (newLeg.local_path ? "Dosyayı Değiştir / Yenisini Seç" : "Mevzuata Dosya Ekle") : "Hızlı Belge Aktarımı"}
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    {editingLeg ? "Mevzuat belgesini (PDF, Word, resim veya metin) seçerek güncelleyebilirsiniz." : "Yerel bir dosya yükleyin veya mevzuat.gov.tr bağlantısı kullanın."}
                                </p>
                            </div>
                            <label className={cn(
                                "cursor-pointer px-4 py-2 rounded-xl bg-card border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm flex items-center gap-2 shrink-0",
                                isUploading && "opacity-50 pointer-events-none"
                            )}>
                                <Upload size={14} />
                                {uploadingFile ? 'Seçildi' : (editingLeg && newLeg.local_path ? 'Dosyayı Değiştir' : 'Dosya Seç')}
                                <input type="file" className="hidden" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" onChange={handleFileSelect} />
                            </label>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-primary/20 bg-white/50 focus:bg-white outline-none text-[11px] font-medium"
                                    placeholder="mevzuat.gov.tr bağlantısını buraya yapıştırın..."
                                    value={newLeg.document_url}
                                    onChange={(e) => setNewLeg({...newLeg, document_url: e.target.value})}
                                />
                            </div>
                            <Button 
                                type="button"
                                onClick={handleFetchExternal}
                                disabled={isFetchingExternal || !newLeg.document_url}
                                className="h-9 px-4 rounded-xl bg-primary text-white text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-primary/20"
                            >
                                {isFetchingExternal ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                OTOMATİK DOLDUR
                            </Button>
                        </div>
                    </div>
                    {uploadingFile && (
                        <div className="mt-3 p-2 rounded-xl bg-primary/10 text-xs font-bold text-primary flex items-center justify-between animate-in fade-in duration-300">
                            <span className="flex items-center gap-1.5 truncate">
                                <FileText size={14} className="shrink-0" /> Seçilen Yeni Dosya: {uploadingFile.name}
                            </span>
                            <button
                                type="button"
                                onClick={() => setUploadingFile(null)}
                                className="text-rose-600 hover:text-rose-700 text-[11px] font-bold underline ml-2 shrink-0"
                            >
                                Vazgeç
                            </button>
                        </div>
                    )}
                    
                    {isElectron && (
                    <div className="absolute top-2 right-2 text-[7px] font-black uppercase tracking-widest bg-primary/10 text-primary/60 px-2 py-0.5 rounded-full">
                        OS INTERFACE ACTIVE
                    </div>
                    )}
                </div>
            </div>

                <form onSubmit={handleSaveLeg} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mevzuat / Belge Adı</label>
                            <input 
                                required
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="Örn: 2024 Yılı Genelgesi"
                                value={newLeg.title}
                                onChange={(e) => setNewLeg({...newLeg, title: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Birim / Klasör</label>
                            <div className="flex gap-2">
                                {!isCreatingCategory ? (
                                    <select 
                                        className="flex-1 px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm appearance-none bg-card"
                                        value={newLeg.category}
                                        onChange={(e) => {
                                            if (e.target.value === "NEW") {
                                                setIsCreatingCategory(true);
                                            } else {
                                                setNewLeg({...newLeg, category: e.target.value});
                                            }
                                        }}
                                    >
                                        {CATEGORIES.filter(c => c !== "Tümü").map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        <option value="NEW">+ Yeni Klasör Oluştur...</option>
                                    </select>
                                ) : (
                                    <div className="flex-1 flex gap-1">
                                        <input 
                                            autoFocus
                                            className="flex-1 px-4 py-3 rounded-xl border border-primary/30 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                            placeholder="Klasör Adı..."
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                        />
                                        <Button type="button" variant="ghost" className="px-2" onClick={() => setIsCreatingCategory(false)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belge Türü (Etiket)</label>
                            <div className="flex gap-2">
                                {!isCreatingDocType ? (
                                    <select 
                                        className="flex-1 px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm appearance-none bg-card"
                                        value={isCreatingDocType ? "" : newLeg.doc_type}
                                        onChange={(e) => {
                                            if (e.target.value === "NEW_DOC") {
                                                setIsCreatingDocType(true);
                                            } else {
                                                setNewLeg({...newLeg, doc_type: e.target.value});
                                            }
                                        }}
                                    >
                                        {DOC_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                        <option value="NEW_DOC">+ Yeni Tür Oluştur...</option>
                                    </select>
                                ) : (
                                    <div className="flex-1 flex gap-1">
                                        <input 
                                            autoFocus
                                            className="flex-1 px-4 py-3 rounded-xl border border-primary/30 focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                            placeholder="Tür İsmi..."
                                            value={newDocType}
                                            onChange={(e) => setNewDocType(e.target.value)}
                                        />
                                        <Button type="button" variant="ghost" className="px-2" onClick={() => setIsCreatingDocType(false)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resmi Gazete / Arşiv Kodu</label>
                            <input 
                                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                placeholder="Örn: 2024/04-12"
                                value={newLeg.official_gazette_info}
                                onChange={(e) => setNewLeg({...newLeg, official_gazette_info: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arama Notu / Özet</label>
                        <input 
                            className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                            placeholder="Dosya içeriği hakkında anahtar kelimeler..."
                            value={newLeg.summary}
                            onChange={(e) => setNewLeg({...newLeg, summary: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-outfit">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akıllı Filtre Etiketleri</label>
                            <div className="relative">
                                <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input 
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/10 outline-none font-outfit text-sm"
                                    placeholder="Personel, İzin..."
                                    value={newLeg.tagsString}
                                    onChange={(e) => setNewLeg({...newLeg, tagsString: e.target.value})}
                                />
                            </div>
                        </div>
                        {/* Erişim Toggle - Genel seçimi sadece admin/moderatör için */}
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Erişim / Gizlilik</label>
                             <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner h-11">
                                <button 
                                    type="button"
                                    onClick={() => setNewLeg({...newLeg, is_public: true})}
                                    className={cn(
                                        "flex-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                        newLeg.is_public ? "bg-card text-primary shadow-sm" : "text-slate-500"
                                    )}
                                >
                                    <Globe size={14} /> <span className="text-[10px]">Genel</span>
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setNewLeg({...newLeg, is_public: false})}
                                    className={cn(
                                        "flex-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                        !newLeg.is_public ? "bg-card text-primary shadow-sm" : "text-slate-500"
                                    )}
                                >
                                    <Lock size={14} /> <span className="text-[10px]">Kişisel</span>
                                </button>
                             </div>
                             {!isAdminOrMod && newLeg.is_public && (
                                 <p className="text-[9px] font-bold text-amber-600 mt-1 uppercase italic tracking-tighter">
                                     * Genel mevzuat eklemeleri onaydan sonra yayınlanır.
                                 </p>
                             )}
                        </div>
                        <div className="flex items-center gap-2 py-2 md:py-8">
                            <input 
                                type="checkbox"
                                id="pinCheck"
                                checked={newLeg.is_pinned}
                                onChange={(e) => setNewLeg({...newLeg, is_pinned: e.target.checked})}
                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer transition-all"
                            />
                            <label htmlFor="pinCheck" className="text-xs font-black text-slate-500 cursor-pointer uppercase tracking-tight">Üste İğnele</label>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl text-slate-500 font-bold" onClick={() => {
                            setIsModalOpen(false);
                            setEditingLeg(null);
                        }} disabled={isUploading}>Vazgeç</Button>
                        <Button type="submit" disabled={isUploading} className="flex-1 h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 font-bold">
                            {isUploading ? <Loader2 className="animate-spin mr-2" /> : null}
                            {editingLeg ? "Değişiklikleri Kaydet" : "Arşive İşle"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

function LegislationRow({ 
    leg, 
    isOwner, 
    canDelete, 
    canEdit,
    isAdmin, 
    onDelete, 
    onEdit,
    onPromote,
    onApprove,
    onReject,
    onOpenFileLocation 
}: { 
    leg: Legislation, 
    isOwner: boolean, 
    canDelete?: boolean, 
    canEdit?: boolean,
    isAdmin?: boolean,
    onDelete: () => void, 
    onEdit: () => void,
    onPromote: () => void,
    onApprove: () => void,
    onReject: () => void,
    onOpenFileLocation: () => void
}) {

    return (
        <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 px-4 md:px-6 py-4 md:py-2.5 hover:bg-muted/50 dark:hover:bg-slate-800/50 transition-all group items-center border-b border-slate-100 dark:border-slate-800/50 last:border-0 relative">
            <div className="md:col-span-1 flex items-center justify-between md:justify-start w-full md:w-auto">
                <div className={cn(
                    "w-8 h-8 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all",
                    leg.is_pinned ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm" : "bg-muted text-slate-400 dark:text-slate-500"
                )}>
                    {leg.is_pinned ? <Pin size={12} /> : <FileText size={12} />}
                </div>
                {/* Mobile tags */}
                <div className="md:hidden flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary/5 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/10">
                        {leg.doc_type || 'Belge'}
                    </span>
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shadow-sm",
                        leg.is_public ? "bg-slate-50 text-slate-400" : "bg-indigo-50 text-indigo-500 border-indigo-100"
                    )}>
                        {leg.is_public ? "Genel" : "Kişisel"}
                    </span>
                    {leg.is_public && leg.is_approved === false && (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest shadow-sm">
                            Onay Bekliyor
                        </span>
                    )}
                </div>
            </div>
            <div className="md:col-span-5 pr-0 md:pr-4 w-full">
                <div className="flex flex-col min-w-0">
                    <h4 className="text-[13px] md:text-[13px] font-bold text-muted-foreground dark:text-slate-200 group-hover:text-primary transition-colors truncate tracking-tight font-outfit uppercase min-w-0">
                        {leg.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                        {leg.summary && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate italic min-w-0">
                                {leg.summary}
                            </p>
                        )}
                        {leg.local_path && (
                            <span 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenFileLocation();
                                }}
                                className="cursor-pointer inline-flex items-center gap-1 text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/40 shrink-0 transition-colors" 
                                title={`Klasörde Göster: ${leg.local_path}`}
                            >
                                <FolderOpen size={10} /> {leg.category}{leg.doc_type ? ` / ${leg.doc_type}` : ''}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="hidden md:block md:col-span-2">
                <span className="px-2 py-0.5 rounded bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/10">
                    {leg.doc_type || 'Belge'}
                </span>
                {leg.last_updated_by_name && (
                    <div className="flex items-center gap-1 mt-1 text-[8px] font-bold text-slate-400 truncate">
                        <UserCheck size={10} className="shrink-0" /> {leg.last_updated_by_name}
                    </div>
                )}
            </div>

            <div className="hidden md:block md:col-span-2">
                 <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase">
                    {leg.is_public ? <Globe size={11} className="text-slate-300 dark:text-muted-foreground" /> : <Lock size={11} className="text-indigo-400 dark:text-indigo-500" />}
                    <span className={cn("truncate", !leg.is_public && "text-indigo-500 dark:text-indigo-400")}>{leg.is_public ? "Genel" : "Kişisel"}</span>
                    {leg.is_public && leg.is_approved === false && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Onay Bekliyor" />
                    )}
                    <span className="mx-1 text-slate-200 dark:text-foreground">|</span>
                    <span className="truncate">{leg.category}</span>
                </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-1 px-0 md:px-1 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-50">
                {(leg.local_path || leg.document_url) ? (
                    <>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-primary dark:text-primary-light hover:bg-primary/10 border border-primary/5 dark:border-primary/20 shadow-sm bg-card"
                            title="Web'de Görüntüle"
                            onClick={() => {
                                const url = leg.local_path
                                    ? (leg.local_path.startsWith('http') ? leg.local_path : `${BASE_URL}${leg.local_path}`)
                                    : leg.document_url;
                                if (url) window.open(url, '_blank');
                            }}
                        >
                            <ExternalLink size={14} className="md:w-3 md:h-3" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/40 shadow-sm bg-card"
                            title="Klasörde Göster (Windows Gezgini)"
                            onClick={onOpenFileLocation}
                        >
                            <FolderOpen size={14} className="md:w-3 md:h-3" />
                        </Button>
                    </>
                ) : (
                    canEdit && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 md:h-7 px-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-center gap-1 shadow-sm"
                            title="Bu mevzuata henüz dosya eklenmemiş. Dosya eklemek için tıklayın."
                            onClick={onEdit}
                        >
                            <Upload size={12} />
                            <span className="inline">Dosya Ekle</span>
                        </Button>
                    )
                )}

                {canEdit && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 shadow-sm bg-card"
                        title="Mevzuatı Düzenle / Dosya Güncelle"
                        onClick={onEdit}
                    >
                        <Edit size={14} className="md:w-3 md:h-3" />
                    </Button>
                )}
                
                {!leg.is_public && isOwner && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 shadow-sm bg-card"
                        title="Genel Arşive Taşı (Paylaş)"
                        onClick={onPromote}
                    >
                        <Globe size={14} className="md:w-3 md:h-3" />
                    </Button>
                )}

                {isAdmin && leg.is_public && leg.is_approved === false && (
                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-sm bg-card"
                            title="Onayla"
                            onClick={onApprove}
                        >
                            <Check size={14} />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-10 h-10 md:w-7 md:h-7 rounded-lg text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-sm bg-card"
                            title="Reddet ve Sil"
                            onClick={onReject}
                        >
                            <X size={14} />
                        </Button>
                    </div>
                )}

                {canDelete && (
                <Button variant="ghost" size="icon" onClick={onDelete} className="w-10 h-10 md:w-7 md:h-7 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-all border border-red-100 dark:border-red-900/30 bg-card ml-auto md:ml-2">
                    <Trash2 size={14} className="md:w-3 md:h-3" />
                </Button>
                )}
            </div>

        </div>
    );
}
