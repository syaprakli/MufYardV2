import { Search, Plus, Loader2, Tag, Pin, FileText, Trash2, Shield, ChevronRight, ChevronDown, Upload, Folder, Filter, Archive, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useState, useEffect, useMemo } from "react";
import { fetchLegislations, createLegislation, deleteLegislation, uploadLegislationFile, openLegislationFolder, promoteToPublic, type Legislation } from "../lib/api/legislation";
import { RefreshCcw, UserCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../lib/hooks/useAuth";
import { Lock, Globe } from "lucide-react";


const CATEGORIES = ["Tümü", "GSB", "KYK", "Federasyon", "Özel Yurt", "Spor Kulüpleri", "Genel"];
const DOC_TYPES = ["Kanun", "KHK", "Yönetmelik", "Genelge", "Özelge", "Yazı"];

export default function Legislation() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const [selectedCategory, setSelectedCategory] = useState("Tümü");
    const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(["GSB", "KYK"]);
    const [legislations, setLegislations] = useState<Legislation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [visibilityTab, setVisibilityTab] = useState<"all" | "personal">("all");


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


    useEffect(() => {
        loadLegislations();
    }, [selectedCategory, user?.uid]);

    const loadLegislations = async () => {
        try {
            setLoading(true);
            const data = await fetchLegislations(user?.uid || undefined, selectedCategory === "Tümü" ? "All" : selectedCategory);
            setLegislations(data);
        } catch (error) {
            console.error("Mevzuat yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };


    const handleCreateLeg = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsUploading(true);
            let finalLocalPath = newLeg.local_path;
            const categoryToUse = isCreatingCategory ? newCategory : newLeg.category;
            const docTypeToUse = isCreatingDocType ? newDocType : newLeg.doc_type;

            if (uploadingFile) {
                const uploaded = await uploadLegislationFile(uploadingFile, categoryToUse, docTypeToUse, user?.uid || undefined, newLeg.is_public);
                finalLocalPath = uploaded.file_url;
            }


            const tags = newLeg.tagsString.split(',').map(t => t.trim()).filter(t => t !== "");
            await createLegislation({
                title: newLeg.title,
                category: categoryToUse,
                doc_type: docTypeToUse,
                summary: newLeg.summary,
                content: newLeg.content,
                tags: tags,
                official_gazette_info: newLeg.official_gazette_info,
                document_url: newLeg.document_url,
                local_path: finalLocalPath,
                is_pinned: newLeg.is_pinned,
                owner_id: user?.uid || undefined,
                is_public: newLeg.is_public
            });

            setIsModalOpen(false);
            resetForm();
            toast.success("Mevzuat başarıyla eklendi.");
            loadLegislations();
        } catch (error: any) {
            toast.error(error.message || "Mevzuat eklenemedi.");
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

    const handleOpenFolder = async (cat?: string) => {
        try {
            // Priority: provided cat > selectedSubType (if in selectedCategory) > selectedCategory
            const categoryToOpen = cat || (selectedCategory !== "Tümü" ? selectedCategory : undefined);
            const docTypeToOpen = selectedSubType || undefined;
            
            await openLegislationFolder(categoryToOpen, docTypeToOpen);
        } catch (error: any) {
            toast.error("Klasör açılamadı: " + error.message);
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

    const handleSync = () => {
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: 'Yerel klasör senkronize ediliyor...',
                success: 'Mevzuat başarıyla eşitlendi. (C:/MufYard/Mevzuat)',
                error: 'Senkronizasyon hatası.',
            }
        ).then(() => {
            handleOpenFolder();
        });
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
        <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden animate-in fade-in duration-500">
            {/* Standardized Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 px-1">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        <Shield size={10} className="text-primary/60" />
                        <span>MufYard Platform</span>
                        <ChevronRight size={10} />
                        <span className="text-primary opacity-80 uppercase tracking-widest">Mevzuat Arşivi</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                            Dijital Mevzuat Kütüphanesi
                        </h1>
                        <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-border dark:border-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Archive size={10} /> v2.5 HIERARCHICAL MODE
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl h-10 shadow-sm border border-border dark:border-slate-700">

                        <button 
                            onClick={() => setVisibilityTab("all")}
                            className={cn(
                                "px-6 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                visibilityTab === "all" ? "bg-card dark:bg-slate-700 text-primary dark:text-primary-light shadow-sm" : "text-slate-500 dark:text-slate-400"
                            )}
                        >
                            <Globe size={12} /> Genel Mevzuat
                        </button>

                        <button 
                            onClick={() => setVisibilityTab("personal")}
                            className={cn(
                                "px-6 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                                visibilityTab === "personal" ? "bg-card dark:bg-slate-700 text-primary dark:text-primary-light shadow-sm" : "text-slate-500 dark:text-slate-400"
                            )}
                        >
                            <Lock size={12} /> Kişisel Dosyalarım

                        </button>
                    </div>

                    <Button 
                        onClick={handleSync} 
                        variant="outline" 
                        className="h-9 px-3 rounded-lg border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/20 bg-emerald-50/20 dark:bg-emerald-950/10"
                    >
                        <RefreshCcw size={14} className="mr-1.5" /> Senkronize Et
                    </Button>
                    <Button onClick={() => handleOpenFolder()} variant="outline" className="h-9 px-3 rounded-lg border-border dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-muted dark:hover:bg-slate-800">
                        <Folder size={14} className="mr-1.5" /> Klasörü Aç
                    </Button>
                    <Button onClick={() => setIsModalOpen(true)} className="h-9 px-4 rounded-lg shadow-md shadow-primary/10 bg-primary text-white text-xs font-bold">
                        <Plus size={16} className="mr-1.5" /> Yeni Mevzuat Ekle
                    </Button>


                </div>


            </div>

            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Sidebar - Folder Browser Tree */}
                <div className="w-72 flex flex-col gap-4">
                    <div className="bg-card border border-border dark:border-slate-800 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden border-border/60 dark:border-slate-800/60">
                        <div className="p-4 border-b border-border dark:border-slate-800 bg-muted/50 dark:bg-slate-950/20 flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Folder size={14} className="text-primary dark:text-primary-light" /> Birim / Belge Ağacı
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
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
                                                title="Klasörü Windows'ta Aç"
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
                    <div className="flex gap-3">
                        <div className="flex-1 bg-card border border-border dark:border-slate-800 rounded-xl px-4 py-2 flex items-center shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-muted/20 border-border/60 dark:border-slate-800/60">
                            <Search size={16} className="text-muted-foreground dark:text-slate-500 mr-2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Arşivde ara... (Başlık, Özet, Etiket)"
                                className="bg-transparent border-none outline-none text-sm w-full font-outfit text-muted-foreground dark:text-slate-200 placeholder:text-slate-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-card border border-border/60 dark:border-slate-800 rounded-xl px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                            <Filter size={12} className="text-primary dark:text-primary-light" /> 
                            Yol: <span className="text-secondary dark:text-indigo-400 ml-1">{selectedCategory}</span> 
                            {selectedSubType && <span className="flex items-center gap-1"><ChevronRight size={10} /> {selectedSubType}</span>}
                        </div>
                    </div>

                    {/* High-Density Archive List */}
                    <div className="flex-1 bg-card border border-border/60 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-muted/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
                                            onDelete={() => handleDelete(leg.id)}
                                            onPromote={() => handlePromote(leg.id, leg.title)}
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
                onClose={() => setIsModalOpen(false)}
                title="Arşive Yeni Belge Ekle"
                size="large"
            >
                <div className="mb-6 p-4 bg-primary/5 rounded-2xl border border-primary/10 border-dashed relative overflow-hidden group">
                    <div className="flex items-center justify-between gap-4 relative z-10">
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-primary mb-1 text-outfit">Hızlı Belge Aktarımı</h4>
                            <p className="text-[11px] text-slate-500 font-medium">Belgeniz seçtiğiniz klasöre otomatik olarak indekslenir.</p>
                        </div>
                        <label className={cn(
                            "cursor-pointer px-4 py-2 rounded-xl bg-card border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm flex items-center gap-2",
                            isUploading && "opacity-50 pointer-events-none"
                        )}>
                            <Upload size={14} />
                            {uploadingFile ? 'Yüklenecek' : 'Dosya Seç'}
                            <input type="file" className="hidden" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" onChange={handleFileSelect} />
                        </label>
                    </div>
                    {uploadingFile && (
                        <div className="mt-2 text-[10px] font-black text-primary flex items-center gap-1 animate-in fade-in duration-300">
                            <FileText size={12} /> {uploadingFile.name}
                        </div>
                    )}
                    
                    <div className="absolute top-2 right-2 text-[7px] font-black uppercase tracking-widest bg-primary/10 text-primary/60 px-2 py-0.5 rounded-full">
                        OS INTERFACE ACTIVE
                    </div>
                </div>

                <form onSubmit={handleCreateLeg} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-2 gap-4">
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
                                    <Globe size={14} /> Tüm Ekip / Genel
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setNewLeg({...newLeg, is_public: false})}
                                    className={cn(
                                        "flex-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                                        !newLeg.is_public ? "bg-card text-primary shadow-sm" : "text-slate-500"
                                    )}
                                >
                                    <Lock size={14} /> Sadece Ben / Kişisel
                                </button>
                             </div>
                        </div>
                        <div className="flex items-center gap-2 pt-8">
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
                        <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl text-slate-500 font-bold" onClick={() => setIsModalOpen(false)} disabled={isUploading}>Vazgeç</Button>
                        <Button type="submit" disabled={isUploading} className="flex-1 h-12 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 font-bold">
                            {isUploading ? <Loader2 className="animate-spin mr-2" /> : null}
                            Arşive İşle
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

function LegislationRow({ leg, isOwner, onDelete, onPromote }: { leg: Legislation, isOwner: boolean, onDelete: () => void, onPromote: () => void }) {

    return (
        <div className="grid grid-cols-12 gap-4 px-6 py-2.5 hover:bg-muted/50 dark:hover:bg-slate-800/50 transition-all group items-center border-b border-slate-50 dark:border-slate-800/50 last:border-0 relative">
            <div className="col-span-1">
                <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    leg.is_pinned ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm" : "bg-muted text-slate-400 dark:text-slate-500"
                )}>
                    {leg.is_pinned ? <Pin size={12} /> : <FileText size={12} />}
                </div>
            </div>
            <div className="col-span-11 md:col-span-5 pr-4">
                <div className="flex flex-col min-w-0">
                    <h4 className="text-[13px] font-bold text-muted-foreground dark:text-slate-200 group-hover:text-primary transition-colors truncate tracking-tight font-outfit uppercase">
                        {leg.title}
                    </h4>
                    {leg.summary && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate italic mt-0.5 max-w-[90%]">
                            {leg.summary}
                        </p>
                    )}
                </div>
            </div>
            <div className="hidden md:block md:col-span-2">
                <span className="px-2 py-0.5 rounded bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/10">
                    {leg.doc_type || 'Belge'}
                </span>
                {leg.last_updated_by_name && (
                    <div className="flex items-center gap-1 mt-1 text-[8px] font-bold text-slate-400">
                        <UserCheck size={10} /> {leg.last_updated_by_name}
                    </div>
                )}
            </div>

            <div className="hidden md:block md:col-span-2">
                 <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase">
                    {leg.is_public ? <Globe size={11} className="text-slate-300 dark:text-muted-foreground" /> : <Lock size={11} className="text-indigo-400 dark:text-indigo-500" />}
                    <span className={cn("truncate", !leg.is_public && "text-indigo-500 dark:text-indigo-400")}>{leg.is_public ? "Genel" : "Kişisel"}</span>
                    <span className="mx-1 text-slate-200 dark:text-foreground">|</span>
                    <span className="truncate">{leg.category}</span>
                </div>
            </div>

            <div className="col-span-12 md:col-span-2 flex justify-end gap-1 px-1">
                {(leg.local_path || leg.document_url) && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-7 h-7 rounded-lg text-primary dark:text-primary-light hover:bg-primary/10 border border-primary/5 dark:border-primary/20 shadow-sm bg-card"
                        title="Dosyayı Görüntele"
                        onClick={() => {
                            // local_path starting with /Mevzuat/ → personal file on local backend
                            // local_path starting with https:// → public file on Firebase Storage
                            // document_url → external link
                            const url = leg.local_path
                                ? (leg.local_path.startsWith('http') ? leg.local_path : `http://localhost:8000${leg.local_path}`)
                                : leg.document_url;
                            if (url) window.open(url, '_blank');
                        }}
                    >
                        <ExternalLink size={12} />
                    </Button>
                )}


                
                {!leg.is_public && isOwner && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-7 h-7 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 shadow-sm bg-card"
                        title="Genel Arşive Taşı (Paylaş)"
                        onClick={onPromote}
                    >
                        <Globe size={12} />
                    </Button>
                )}

                <Button variant="ghost" size="icon" onClick={onDelete} className="w-7 h-7 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-red-100 dark:border-red-900/30 bg-card ml-2">
                    <Trash2 size={12} />
                </Button>
            </div>

        </div>
    );
}
