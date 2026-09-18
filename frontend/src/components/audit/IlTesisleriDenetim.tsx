import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
    Building2, Plus, Search, Trash2, Edit3, Image as ImageIcon,
    AlertTriangle, X, ChevronDown, ChevronUp,
    Download, FileText, Check, Loader2, MapPin,
    Clock, ZoomIn, LayoutGrid, List, RefreshCw, Upload, FolderPlus,
    Sparkles, Info, Settings, RotateCcw
} from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { API_URL, LOCAL_API_URL, IS_ELECTRON } from "../../lib/config";
import { getAuthHeaders } from "../../lib/api/utils";
import { getSafeImageUrl, handleImageError } from "../../lib/utils";
import { savePhotoToLocalDevice, exportPhotosToComputer } from "../../utils/photoExportHelper";

export { getSafeImageUrl, handleImageError };

export interface DenetimFacility {
    id: string;
    ad: string;
    tur: string;
    ilce?: string;
    adres?: string;
    mulkiyet?: string;
    durum: "faal" | "kismen_faal" | "bakimda" | "atil";
    denetimTarihi?: string;
    bilgiNotu: string;
    oncelik?: "normal" | "orta" | "kritik";
    photos: string[];
    photoDescriptions?: Record<string, string>;
    createdAt: string;
}

const PRESET_FACILITY_TYPES = [
    "Kapalı Spor Salonu",
    "Stadyum / Çim Saha",
    "Sentetik Saha",
    "Yarı Olimpik Yüzme Havuzu",
    "Olimpik Yüzme Havuzu",
    "Gençlik Merkezi",
    "Gençlik Kampı",
    "Tenis Kortu",
    "Atletizm Pisti",
    "Güreş Salonu",
    "Boks / Uzakdoğu Sporları Salonu",
    "Jimnastik Salonu",
    "Çok Amaçlı Spor Salonu",
    "Kaykay Pisti / Skate Park",
    "Diğer Tesis"
];

const PRESET_STATUS_OPTIONS = [
    { value: "faal", label: "Faal / Kullanımda", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    { value: "kismen_faal", label: "Kısmen Faal", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    { value: "bakimda", label: "Bakım / Onarımda", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    { value: "atil", label: "Atıl / Gayrifaal", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" }
];

const PRESET_PRIORITY_OPTIONS = [
    { value: "normal", label: "Normal Öncelik", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
    { value: "orta", label: "Orta Düzey Sorun", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    { value: "kritik", label: "Acil / Kritik Müdahale", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" }
];

const DEFAULT_QUICK_NOTES = [
    "Bakım ve onarım ihtiyacı bulunmaktadır.",
    "Çatı kaplamasında su sızıntısı ve izolasyon sorunu mevcut.",
    "Soyunma odaları ve ıslak hacim armatürleri arızalı.",
    "Spor zemininde aşınma / deformasyon gözlemlendi.",
    "Aydınlatma armatürlerinde arıza ve yetersizlik var.",
    "Yangın güvenliği ve acil çıkış yönlendirmeleri faal.",
    "Tesis genel olarak temiz, düzenli ve faal durumda."
];

const QUICK_NOTES_STORAGE_KEY = "mufyard_denetim_quick_notes";

interface IlTesisleriDenetimProps {
    localAuditData: any;
    setLocalAuditData: React.Dispatch<React.SetStateAction<any>>;
    onSaveAuditData: (updatedData?: any) => Promise<void>;
    selectedReport: any;
    selectedTask: any;
    user: any;
    onTransferToReport?: (facilitiesHtml: string) => void;
}

export const IlTesisleriDenetim: React.FC<IlTesisleriDenetimProps> = ({
    localAuditData,
    setLocalAuditData,
    onSaveAuditData,
    selectedReport,
    selectedTask,
    user,
    onTransferToReport
}) => {
    const confirm = useConfirm();
    const facilities: DenetimFacility[] = useMemo(() => {
        return Array.isArray(localAuditData?.tesisler) ? localAuditData.tesisler : [];
    }, [localAuditData?.tesisler]);

    const targetReportId = selectedReport?.id || selectedTask?.id || "temp_denetim";
    const MIRROR_KEY = `mufyard_facilities_mirror_${targetReportId}`;

    const [localDraftBackup, setLocalDraftBackup] = useState<DenetimFacility[] | null>(null);

    // Save mirror helper (immediately persists facilities to device disk)
    const saveToLocalMirror = (items: DenetimFacility[]) => {
        try {
            if (Array.isArray(items)) {
                localStorage.setItem(MIRROR_KEY, JSON.stringify(items));
            }
        } catch (e) {
            console.warn("Local facilities mirror save error:", e);
        }
    };

    // Check for local draft on mount or report change
    useEffect(() => {
        try {
            const mirrorRaw = localStorage.getItem(MIRROR_KEY);
            if (mirrorRaw) {
                const mirrorList: DenetimFacility[] = JSON.parse(mirrorRaw);
                if (Array.isArray(mirrorList) && mirrorList.length > facilities.length) {
                    setLocalDraftBackup(mirrorList);
                } else if (Array.isArray(mirrorList) && facilities.length >= mirrorList.length && facilities.length > 0) {
                    saveToLocalMirror(facilities);
                }
            } else if (facilities.length > 0) {
                saveToLocalMirror(facilities);
            }
        } catch (e) {
            console.warn("Local facilities mirror read error:", e);
        }
    }, [MIRROR_KEY, facilities.length]);

    // Restore draft
    const handleRestoreLocalDraft = async () => {
        if (!localDraftBackup || localDraftBackup.length === 0) return;
        const updatedData = {
            ...localAuditData,
            tesisler: localDraftBackup
        };
        setLocalAuditData(updatedData);
        saveToLocalMirror(localDraftBackup);
        setLocalDraftBackup(null);
        try {
            await onSaveAuditData(updatedData);
            toast.success("Yerel taslak geri yüklendi ve sunucuya gönderildi.");
        } catch {
            toast.success("Yerel taslak geri yüklendi (Cihazınızda korundu).");
        }
    };

    // Emergency Excel export
    const handleEmergencyExportExcel = () => {
        try {
            if (!facilities || facilities.length === 0) {
                toast.error("Dışa aktarılacak tesis bulunamadı.");
                return;
            }
            const exportData = facilities.map((f, idx) => ({
                "Sıra": idx + 1,
                "Tesis Adı": f.ad || "",
                "Tesis Türü": f.tur || "",
                "İlçe": f.ilce || "",
                "Adres": f.adres || "",
                "Mülkiyet": f.mulkiyet || "",
                "Durum": f.durum === "faal" ? "Faal / Kullanımda" :
                         f.durum === "kismen_faal" ? "Kısmen Faal" :
                         f.durum === "bakimda" ? "Bakım / Onarımda" : "Atıl / Gayrifaal",
                "Öncelik": f.oncelik === "kritik" ? "Acil / Kritik" :
                           f.oncelik === "orta" ? "Orta Düzey Sorun" : "Normal Öncelik",
                "Denetim Tarihi": f.denetimTarihi || "",
                "Eksiklik ve Sorunlar (Bilgi Notu)": f.bilgiNotu || "",
                "Fotoğraf Sayısı": f.photos?.length || 0,
                "Kayıt Zamanı": f.createdAt || ""
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);
            ws['!cols'] = [
                { wch: 6 },
                { wch: 30 },
                { wch: 25 },
                { wch: 15 },
                { wch: 25 },
                { wch: 20 },
                { wch: 20 },
                { wch: 18 },
                { wch: 15 },
                { wch: 50 },
                { wch: 15 },
                { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Tesis Denetimleri");
            const rawTitle = selectedReport?.title || selectedTask?.rapor_adi || "Tesis_Denetim";
            const reportTitle = rawTitle.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]/g, "_");
            const dateStr = new Date().toISOString().split("T")[0];
            XLSX.writeFile(wb, `${reportTitle}_Tesis_Listesi_${dateStr}.xlsx`);
            toast.success("Tüm tesisler Excel dosyası olarak cihazınıza indirildi!", { icon: "📥" });
        } catch (err) {
            console.error("Excel export error:", err);
            toast.error("Excel dışa aktarılırken hata oluştu.");
        }
    };

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);

    const toggleSelectFacility = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedFacilityIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Add / Edit Modal (Genel Bilgiler)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSavingFacilityModal, setIsSavingFacilityModal] = useState(false);
    const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<DenetimFacility>>({
        ad: "",
        tur: PRESET_FACILITY_TYPES[0],
        ilce: "",
        adres: "",
        mulkiyet: "GSB (Gençlik ve Spor Bakanlığı)",
        durum: "faal",
        oncelik: "normal",
        bilgiNotu: "",
        denetimTarihi: new Date().toISOString().split("T")[0],
        photos: []
    });

    // Dedicated Note Modal State
    const [noteModalFacilityId, setNoteModalFacilityId] = useState<string | null>(null);
    const [noteModalText, setNoteModalText] = useState("");
    const [noteModalPriority, setNoteModalPriority] = useState<"normal" | "orta" | "kritik">("normal");
    const [isSavingNoteModal, setIsSavingNoteModal] = useState(false);

    // Custom Quick Notes Management State (Hızlı Tespit Şablonları Ekleme/Çıkarma/Düzenleme)
    const [customQuickNotes, setCustomQuickNotes] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(QUICK_NOTES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return DEFAULT_QUICK_NOTES;
    });
    const [isManagingQuickNotes, setIsManagingQuickNotes] = useState(false);
    const [newQuickNoteInput, setNewQuickNoteInput] = useState("");
    const [editingQuickNoteIndex, setEditingQuickNoteIndex] = useState<number | null>(null);
    const [editingQuickNoteText, setEditingQuickNoteText] = useState("");

    const saveQuickNotes = (newNotes: string[]) => {
        setCustomQuickNotes(newNotes);
        try {
            localStorage.setItem(QUICK_NOTES_STORAGE_KEY, JSON.stringify(newNotes));
        } catch (e) {
            console.warn("Failed to save quick notes:", e);
        }
    };

    const handleAddQuickNote = () => {
        const trimmed = newQuickNoteInput.trim();
        if (!trimmed) {
            toast.error("Lütfen eklenecek şablon metnini yazınız.");
            return;
        }
        if (customQuickNotes.some(q => q.toLowerCase() === trimmed.toLowerCase())) {
            toast.error("Bu şablon zaten listede mevcut.");
            return;
        }
        const updated = [...customQuickNotes, trimmed];
        saveQuickNotes(updated);
        setNewQuickNoteInput("");
        toast.success("Yeni hızlı tespit şablonu eklendi.");
    };

    const handleDeleteQuickNote = (index: number) => {
        const updated = customQuickNotes.filter((_, i) => i !== index);
        saveQuickNotes(updated);
        toast.success("Hızlı tespit şablonu listeden kaldırıldı.");
    };

    const handleStartEditQuickNote = (index: number, text: string) => {
        setEditingQuickNoteIndex(index);
        setEditingQuickNoteText(text);
    };

    const handleSaveEditQuickNote = (index: number) => {
        const trimmed = editingQuickNoteText.trim();
        if (!trimmed) {
            handleDeleteQuickNote(index);
            setEditingQuickNoteIndex(null);
            return;
        }
        const updated = [...customQuickNotes];
        updated[index] = trimmed;
        saveQuickNotes(updated);
        setEditingQuickNoteIndex(null);
        setEditingQuickNoteText("");
        toast.success("Hızlı tespit şablonu güncellendi.");
    };

    const handleResetQuickNotes = () => {
        saveQuickNotes(DEFAULT_QUICK_NOTES);
        setEditingQuickNoteIndex(null);
        toast.success("Hızlı tespit şablonları varsayılana döndürüldü.");
    };

    // Dedicated Photo Modal State
    const [photoModalFacilityId, setPhotoModalFacilityId] = useState<string | null>(null);

    // Upload state per facility: facilityId -> boolean
    const [uploadingForFacility, setUploadingForFacility] = useState<Record<string, boolean>>({});

    // Failed / missing images tracking (404 recovery): url -> boolean
    const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

    // Modal gallery picker state
    const [isGalleryPickerOpen, setIsGalleryPickerOpen] = useState(false);

    // Lightbox modal for photos
    const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

    // Expand / Collapse facility cards
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

    const toggleCardExpanded = (id: string) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: prev[id] === undefined ? false : !prev[id]
        }));
    };

    // Filtered facilities
    const filteredFacilities = useMemo(() => {
        return facilities.filter(f => {
            const matchesSearch = !searchTerm ||
                f.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (f.ilce && f.ilce.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (f.bilgiNotu && f.bilgiNotu.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === "all" || f.durum === statusFilter;
            const matchesPriority = priorityFilter === "all" || (f.oncelik || "normal") === priorityFilter;
            const matchesType = typeFilter === "all" || f.tur === typeFilter;
            return matchesSearch && matchesStatus && matchesPriority && matchesType;
        });
    }, [facilities, searchTerm, statusFilter, priorityFilter, typeFilter]);

    const toggleSelectAll = () => {
        if (selectedFacilityIds.length === filteredFacilities.length && filteredFacilities.length > 0) {
            setSelectedFacilityIds([]);
        } else {
            setSelectedFacilityIds(filteredFacilities.map(f => f.id));
        }
    };

    // Statistics
    const stats = useMemo(() => {
        const total = facilities.length;
        const active = facilities.filter(f => f.durum === "faal").length;
        const inMaintenance = facilities.filter(f => f.durum === "bakimda" || f.durum === "kismen_faal").length;
        const idle = facilities.filter(f => f.durum === "atil").length;
        const totalPhotos = facilities.reduce((sum, f) => sum + (f.photos?.length || 0), 0);
        const withDeficiencies = facilities.filter(f => !!f.bilgiNotu?.trim()).length;
        const criticalCount = facilities.filter(f => f.oncelik === "kritik").length;
        return { total, active, inMaintenance, idle, totalPhotos, withDeficiencies, criticalCount };
    }, [facilities]);

    // Open Modal for Create (Genel Bilgiler)
    const handleOpenCreateModal = () => {
        setIsSavingFacilityModal(false);
        setEditingFacilityId(null);
        setFormData({
            ad: "",
            tur: PRESET_FACILITY_TYPES[0],
            ilce: "",
            adres: "",
            mulkiyet: "GSB (Gençlik ve Spor Bakanlığı)",
            durum: "faal",
            oncelik: "normal",
            bilgiNotu: "",
            denetimTarihi: new Date().toISOString().split("T")[0],
            photos: []
        });
        setIsModalOpen(true);
    };

    // Open Modal for Edit (Genel Bilgiler)
    const handleOpenEditModal = (facility: DenetimFacility) => {
        setIsSavingFacilityModal(false);
        setEditingFacilityId(facility.id);
        setFormData({
            ad: facility.ad,
            tur: facility.tur,
            ilce: facility.ilce || "",
            adres: facility.adres || "",
            mulkiyet: facility.mulkiyet || "GSB (Gençlik ve Spor Bakanlığı)",
            durum: facility.durum,
            oncelik: facility.oncelik || "normal",
            bilgiNotu: facility.bilgiNotu || "",
            denetimTarihi: facility.denetimTarihi || new Date().toISOString().split("T")[0],
            photos: facility.photos || []
        });
        setIsModalOpen(true);
    };

    // Open Dedicated Note Modal
    const handleOpenNoteModal = (facility: DenetimFacility) => {
        setNoteModalFacilityId(facility.id);
        setNoteModalText(facility.bilgiNotu || "");
        setNoteModalPriority(facility.oncelik || "normal");
    };

    // Save from Dedicated Note Modal
    const handleSaveNoteModal = async () => {
        if (!noteModalFacilityId) return;
        setIsSavingNoteModal(true);
        try {
            const updatedFacilities = facilities.map(f => {
                if (f.id === noteModalFacilityId) {
                    return {
                        ...f,
                        bilgiNotu: noteModalText.trim(),
                        oncelik: noteModalPriority
                    };
                }
                return f;
            });
            const updatedData = {
                ...localAuditData,
                tesisler: updatedFacilities
            };
            setLocalAuditData(updatedData);
            saveToLocalMirror(updatedFacilities);
            try {
                await onSaveAuditData(updatedData);
            } catch {}
            toast.success("Notlar ve öncelik derecesi kaydedildi.");
            setNoteModalFacilityId(null);
        } catch {
            toast.error("Not kaydedilirken bir hata oluştu.");
        } finally {
            setIsSavingNoteModal(false);
        }
    };

    // Toggle Photo from General Audit Gallery for Active Facility
    const handleToggleGalleryPhotoForFacility = async (photoUrl: string) => {
        if (!photoModalFacilityId) return;
        const fac = facilities.find(f => f.id === photoModalFacilityId);
        if (!fac) return;
        const current = fac.photos || [];
        let updatedPhotos: string[];
        if (current.includes(photoUrl)) {
            updatedPhotos = current.filter(u => u !== photoUrl);
            toast.success("Fotoğraf tesisten çıkarıldı.");
        } else {
            updatedPhotos = [...current, photoUrl];
            toast.success("Fotoğraf tesise eklendi.");
        }
        const updatedFacilities = facilities.map(f => f.id === photoModalFacilityId ? { ...f, photos: updatedPhotos } : f);
        const updatedData = { ...localAuditData, tesisler: updatedFacilities };
        setLocalAuditData(updatedData);
        saveToLocalMirror(updatedFacilities);
        try { await onSaveAuditData(updatedData); } catch {}
    };

    // Save Facility from General Info Modal
    const handleSaveFacilityModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingFacilityModal) return;

        if (!formData.ad?.trim()) {
            toast.error("Lütfen tesis adını giriniz.");
            return;
        }

        setIsSavingFacilityModal(true);
        setIsModalOpen(false);

        let updatedFacilities: DenetimFacility[] = [];
        if (editingFacilityId) {
            updatedFacilities = facilities.map(f => {
                if (f.id === editingFacilityId) {
                    return {
                        ...f,
                        ad: formData.ad!.trim(),
                        tur: formData.tur || "Diğer Tesis",
                        ilce: formData.ilce?.trim() || "",
                        adres: formData.adres?.trim() || "",
                        mulkiyet: formData.mulkiyet || "GSB (Gençlik ve Spor Bakanlığı)",
                        durum: formData.durum || "faal",
                        oncelik: formData.oncelik || f.oncelik || "normal",
                        denetimTarihi: formData.denetimTarihi || f.denetimTarihi || ""
                    };
                }
                return f;
            });
            toast.success("Tesis genel bilgileri güncellendi.");
        } else {
            const newFacility: DenetimFacility = {
                id: `fac_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                ad: formData.ad!.trim(),
                tur: formData.tur || "Diğer Tesis",
                ilce: formData.ilce?.trim() || "",
                adres: formData.adres?.trim() || "",
                mulkiyet: formData.mulkiyet || "GSB (Gençlik ve Spor Bakanlığı)",
                durum: formData.durum || "faal",
                oncelik: formData.oncelik || "normal",
                bilgiNotu: "",
                denetimTarihi: formData.denetimTarihi || new Date().toISOString().split("T")[0],
                photos: [],
                photoDescriptions: {},
                createdAt: new Date().toISOString()
            };
            updatedFacilities = [newFacility, ...facilities];
            toast.success("Yeni tesis kaydı eklendi! Şimdi 'Notlar' ve 'Fotoğraflar' butonlarıyla detayları ekleyebilirsiniz.", { duration: 5500 });
        }

        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        saveToLocalMirror(updatedFacilities);

        try {
            await onSaveAuditData(updatedData);
        } catch (error) {
            console.error("Tesis kaydedilirken hata oluştu:", error);
            toast.error("Sunucuya kaydedilemedi (Kota veya bağlantı sorunu). Ancak tesis bu cihazda güvende tutuluyor!", { duration: 6000 });
        } finally {
            setIsSavingFacilityModal(false);
        }
    };

    // Delete Facility
    const handleDeleteFacility = async (facilityId: string, facilityName: string) => {
        const confirmed = await confirm({
            title: "Tesisi Sil",
            message: `"${facilityName}" adlı tesisi ve bu tesise ait yüklenmiş tüm fotoğrafları silmek istediğinize emin misiniz?`,
            confirmText: "Tesisi Sil",
            variant: "danger"
        });
        if (!confirmed) return;

        const updatedFacilities = facilities.filter(f => f.id !== facilityId);
        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        saveToLocalMirror(updatedFacilities);
        try {
            await onSaveAuditData(updatedData);
        } catch {}
        toast.success("Tesis kaydı silindi.");
    };

    // Upload Photos for Facility
    const handleUploadFacilityPhoto = async (facilityId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        // Reset input immediately so same files can be selected again
        e.target.value = "";

        setUploadingForFacility(prev => ({ ...prev, [facilityId]: true }));
        try {
            // Fotoğrafları hem buluta hem de kullanıcının yerel cihazına/galerisine kaydet
            savePhotoToLocalDevice(files, `Tesis_${facilityId}`);

            const uploadedUrls: string[] = [];
            const targetReportId = selectedReport?.id || selectedTask?.id || "temp_denetim";
            const targetApi = IS_ELECTRON ? LOCAL_API_URL : API_URL;

            for (const file of files) {
                try {
                    const formData = new FormData();
                    formData.append("file", file);

                    let uploadUrl = `${targetApi}/files/upload`;
                    const params = new URLSearchParams();
                    params.append("path", `denetim_tesisleri/${targetReportId}/${facilityId}`);
                    if (user?.uid) params.append("uid", user.uid);
                    uploadUrl += `?${params.toString()}`;

                    const authHeaders = await getAuthHeaders();
                    const res = await fetch(uploadUrl, {
                        method: "POST",
                        headers: {
                            ...authHeaders
                        },
                        body: formData
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data?.url) {
                            uploadedUrls.push(data.url);
                        }
                    } else {
                        // Fallback: Convert to Base64 thumbnail data URL so photo is never lost!
                        const base64Url = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        uploadedUrls.push(base64Url);
                    }
                } catch (singleUploadErr) {
                    console.warn("Single photo upload failed, using client data fallback:", singleUploadErr);
                    try {
                        const base64Url = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        uploadedUrls.push(base64Url);
                    } catch {
                        // ignore
                    }
                }
            }

            if (uploadedUrls.length === 0) {
                throw new Error("Hiçbir fotoğraf yüklenemedi.");
            }

            const updatedFacilities = facilities.map(f => {
                if (f.id === facilityId) {
                    return {
                        ...f,
                        photos: [...(f.photos || []), ...uploadedUrls]
                    };
                }
                return f;
            });

            const updatedData = {
                ...localAuditData,
                tesisler: updatedFacilities
            };
            setLocalAuditData(updatedData);
            saveToLocalMirror(updatedFacilities);
            try {
                await onSaveAuditData(updatedData);
            } catch {}
            toast.success(`${uploadedUrls.length} adet fotoğraf başarıyla eklendi.`);
        } catch (error) {
            console.error("Facility photo upload error:", error);
            toast.error("Fotoğraf yüklenirken bir hata oluştu.");
        } finally {
            setUploadingForFacility(prev => ({ ...prev, [facilityId]: false }));
        }
    };

    // Replace / Recover a broken photo
    const handleReplaceFacilityPhoto = async (facilityId: string, photoIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        e.target.value = "";

        setUploadingForFacility(prev => ({ ...prev, [facilityId]: true }));
        try {
            savePhotoToLocalDevice(file, `Tesis_${facilityId}_Yenileme`);

            const targetReportId = selectedReport?.id || selectedTask?.id || "temp_denetim";
            const targetApi = IS_ELECTRON ? LOCAL_API_URL : API_URL;

            const fd = new FormData();
            fd.append("file", file);

            let uploadUrl = `${targetApi}/files/upload`;
            const params = new URLSearchParams();
            params.append("path", `denetim_tesisleri/${targetReportId}/${facilityId}`);
            if (user?.uid) params.append("uid", user.uid);
            uploadUrl += `?${params.toString()}`;

            const authHeaders = await getAuthHeaders();
            const res = await fetch(uploadUrl, {
                method: "POST",
                headers: { ...authHeaders },
                body: fd
            });

            let newUrl = "";
            if (res.ok) {
                const data = await res.json();
                if (data?.url) newUrl = data.url;
            }

            if (!newUrl) {
                newUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }

            let replacedOldUrl = "";
            const updatedFacilities = facilities.map(f => {
                if (f.id === facilityId) {
                    const updatedPhotos = [...(f.photos || [])];
                    const oldUrl = updatedPhotos[photoIndex];
                    replacedOldUrl = oldUrl;
                    updatedPhotos[photoIndex] = newUrl;
                    const updatedDescs = { ...(f.photoDescriptions || {}) };
                    if (oldUrl && updatedDescs[oldUrl]) {
                        updatedDescs[newUrl] = updatedDescs[oldUrl];
                        delete updatedDescs[oldUrl];
                    }
                    return {
                        ...f,
                        photos: updatedPhotos,
                        photoDescriptions: updatedDescs
                    };
                }
                return f;
            });

            const updatedData = {
                ...localAuditData,
                tesisler: updatedFacilities
            };
            setLocalAuditData(updatedData);
            saveToLocalMirror(updatedFacilities);
            try {
                await onSaveAuditData(updatedData);
            } catch {}

            setFailedImages(prev => {
                const next = { ...prev };
                delete next[newUrl];
                if (replacedOldUrl) delete next[replacedOldUrl];
                return next;
            });

            toast.success("Fotoğraf başarıyla yenilendi ve kalıcı olarak kaydedildi.");
        } catch (error) {
            console.error("Photo replace error:", error);
            toast.error("Fotoğraf yenilenirken hata oluştu.");
        } finally {
            setUploadingForFacility(prev => ({ ...prev, [facilityId]: false }));
        }
    };


    // Delete Photo from Facility
    const handleDeleteFacilityPhoto = async (facilityId: string, photoIndex: number) => {
        const confirmed = await confirm({
            title: "Fotoğrafı Kaldır",
            message: "Bu fotoğrafı tesis kaydından kaldırmak istediğinize emin misiniz?",
            confirmText: "Kaldır",
            variant: "danger"
        });
        if (!confirmed) return;

        const updatedFacilities = facilities.map(f => {
            if (f.id === facilityId) {
                const updatedPhotos = (f.photos || []).filter((_, idx) => idx !== photoIndex);
                return { ...f, photos: updatedPhotos };
            }
            return f;
        });

        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        saveToLocalMirror(updatedFacilities);
        try {
            await onSaveAuditData(updatedData);
        } catch {}
        toast.success("Fotoğraf kaldırıldı.");
    };

    // Update Photo Caption
    const handleUpdatePhotoCaption = async (facilityId: string, photoUrl: string, caption: string) => {
        const updatedFacilities = facilities.map(f => {
            if (f.id === facilityId) {
                return {
                    ...f,
                    photoDescriptions: {
                        ...(f.photoDescriptions || {}),
                        [photoUrl]: caption
                    }
                };
            }
            return f;
        });
        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        saveToLocalMirror(updatedFacilities);
        try {
            await onSaveAuditData(updatedData);
        } catch {}
    };

    // Export / Transfer Findings to Report (Tek, Seçimli veya Tüm Tesisler)
    const handleTransferToReport = (targetFacilities?: DenetimFacility[]) => {
        let toTransfer: DenetimFacility[] = [];
        if (targetFacilities && targetFacilities.length > 0) {
            toTransfer = targetFacilities;
        } else if (selectedFacilityIds.length > 0) {
            toTransfer = facilities.filter(f => selectedFacilityIds.includes(f.id));
        } else {
            toTransfer = filteredFacilities.length > 0 ? filteredFacilities : facilities;
        }

        if (toTransfer.length === 0) {
            toast.error("Aktarılacak herhangi bir tesis kaydı bulunmamaktadır.");
            return;
        }

        const isSingle = toTransfer.length === 1;
        const facTitle = isSingle ? `"${toTransfer[0].ad}"` : `(${toTransfer.length} Tesis)`;

        let html = `<div class="denetim-tesis-aktarim-blogu" style="margin: 20px 0; font-family: sans-serif;">`;
        html += `<h3 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin-bottom: 12px; font-size: 16px;">
                    <strong>🏢 GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ TESİS İNCELEME TESPİTLERİ ${facTitle}</strong>
                 </h3>`;
        html += `<p style="color: #475569; font-size: 13px; margin-bottom: 14px;">Denetim kapsamında incelenen spor tesisi fiziki durumları ve tespit edilen aksaklık/onarım bilgi notları aşağıda özetlenmiştir:</p>`;

        html += `<table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 12px; margin-bottom: 16px;">`;
        html += `<thead style="background-color: #f1f5f9; color: #1e293b;">
                    <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 35px;">#</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Tesis Adı ve Türü</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">İlçe / Mevki</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 95px;">Faaliyet Durumu</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 85px;">Öncelik</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Tespit Edilen Eksiklik ve Sorunlar</th>
                    </tr>
                 </thead><tbody>`;

        toTransfer.forEach((fac, idx) => {
            const statusLabel = PRESET_STATUS_OPTIONS.find(s => s.value === fac.durum)?.label || fac.durum;
            const priorityLabel = PRESET_PRIORITY_OPTIONS.find(p => p.value === fac.oncelik)?.label || (fac.oncelik || "Normal");
            const priorityColor = fac.oncelik === "kritik" ? "#e11d48" : fac.oncelik === "orta" ? "#d97706" : "#334155";
            html += `<tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">
                    <strong>${fac.ad}</strong><br/>
                    <span style="color: #64748b; font-size: 11px;">${fac.tur} (${fac.mulkiyet || "GSB"})</span>
                    ${fac.adres ? `<br/><span style="color: #94a3b8; font-size: 10px;">📍 ${fac.adres}</span>` : ""}
                </td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${fac.ilce || "Merkez"}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 600;">${statusLabel}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${priorityColor};">${priorityLabel}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; line-height: 1.5;">${fac.bilgiNotu ? fac.bilgiNotu.replace(/\n/g, "<br/>") : "<em style='color: #94a3b8;'>Herhangi bir eksiklik veya arıza belirtilmemiştir.</em>"}</td>
            </tr>`;
        });

        html += `</tbody></table>`;

        // Tesislere ait fotoğraflar varsa rapora ekle
        const withPhotos = toTransfer.filter(f => f.photos && f.photos.length > 0);
        if (withPhotos.length > 0) {
            html += `<h4 style="color: #1e293b; font-size: 13px; margin: 16px 0 8px 0;">📸 <strong>Tesis Saha / Kusur Görselleri</strong></h4>`;
            withPhotos.forEach(fac => {
                html += `<div style="margin-bottom: 12px; padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">`;
                html += `<div style="font-weight: bold; font-size: 12px; margin-bottom: 6px; color: #1e3a8a;">${fac.ad} (${fac.ilce || "Merkez"})</div>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px;">`;
                (fac.photos || []).forEach((photoUrl, pIdx) => {
                    const desc = fac.photoDescriptions?.[photoUrl] || `Fotoğraf ${pIdx + 1}`;
                    html += `<div style="display: inline-block; margin: 4px; text-align: center;">
                        <img src="${getSafeImageUrl(photoUrl)}" alt="${desc}" style="width: 140px; height: 105px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; display: block;" />
                        <span style="font-size: 10px; color: #64748b; max-width: 140px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;">${desc}</span>
                    </div>`;
                });
                html += `</div></div>`;
            });
        }
        html += `</div>`;

        if (onTransferToReport) {
            onTransferToReport(html);
            toast.success(
                isSingle
                    ? `"${toTransfer[0].ad}" bilgileri rapora aktarıldı!`
                    : `${toTransfer.length} adet tesis rapora aktarıldı!`,
                { icon: "📋", duration: 4000 }
            );
        } else {
            navigator.clipboard.writeText(html);
            toast.success("Tesis tespitleri panoya HTML formatında kopyalandı.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Local Draft Recovery Banner */}
            {localDraftBackup && localDraftBackup.length > facilities.length && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                    <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                                    Cihazınızda Kaydedilmemiş Yerel Tesis Taslağı Bulundu!
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                                    {localDraftBackup.length} Tesis
                                </span>
                            </div>
                            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 mt-1 font-medium">
                                Bu cihazda sunucudaki {facilities.length} tesisten daha fazla ({localDraftBackup.length} adet) kayıt mevcut. Sunucudaki kota veya fatura kısıtlaması nedeniyle verilerinizin silinmesini önlemek için yerel taslağınız cihaz hafızasında güvenle saklanmaktadır.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocalDraftBackup(null)}
                            className="h-9 px-3.5 text-xs font-bold rounded-xl border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                        >
                            Yoksay
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleRestoreLocalDraft}
                            className="h-9 px-4 text-xs font-black rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition-all hover:scale-105"
                        >
                            <Check size={15} />
                            <span>Taslağı Geri Yükle ({localDraftBackup.length} Tesis)</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Top Header & Overview Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-sm">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                    İl Spor Tesisleri Denetim & Tespit Paneli
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                    {stats.total} Tesis
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                İl Müdürlüğü mülkiyetindeki ve tahsisli spor tesislerini ekleyin; saha fotoğrafları ile arıza, eksiklik ve onarım bilgi notlarını kaydedin.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {facilities.length > 0 && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleEmergencyExportExcel}
                                    title="Tesisleri anında Excel (.xlsx) tablosu olarak cihazınıza indirin"
                                    className="h-9 px-3 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition-all"
                                >
                                    <Download size={14} className="text-emerald-500" />
                                    <span>Excel İndir</span>
                                </Button>

                                {facilities.some(f => (f.photos || []).length > 0) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const allPhotos = facilities.flatMap(f => f.photos || []).filter(Boolean);
                                            exportPhotosToComputer(allPhotos, `${selectedReport?.title || "Il_Tesisleri"}_Tum_Fotograflar`);
                                        }}
                                        title="Tüm tesis fotoğraflarını bilgisayara aktar"
                                        className="h-9 px-3 rounded-xl text-xs font-bold border-blue-200 dark:border-blue-800/60 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-all"
                                    >
                                        <Download size={14} className="text-blue-500" />
                                        <span>Fotoğrafları Aktar ({facilities.reduce((acc, f) => acc + (f.photos?.length || 0), 0)})</span>
                                    </Button>
                                )}

                                {selectedFacilityIds.length > 0 ? (
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            onClick={() => handleTransferToReport()}
                                            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/25 animate-in fade-in"
                                            title="Seçili tesisleri rapora aktar"
                                        >
                                            <FileText size={14} />
                                            <span>Seçilenleri Rapora Aktar ({selectedFacilityIds.length})</span>
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFacilityIds([])}
                                            className="h-9 px-2 text-[11px] font-bold text-slate-500 hover:text-rose-600 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                                            title="Seçimi Temizle"
                                        >
                                            Temizle
                                        </button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleTransferToReport()}
                                        className="h-9 px-3.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors"
                                        title="Filtrelenmiş veya tüm tesisleri rapora aktar"
                                    >
                                        <FileText size={14} className="text-indigo-500" />
                                        <span>Tümünü Rapora Aktar</span>
                                    </Button>
                                )}
                            </>
                        )}
                        <Button
                            onClick={handleOpenCreateModal}
                            className="h-9.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                        >
                            <Plus size={15} />
                            <span>Yeni Tesis Ekle</span>
                        </Button>
                    </div>
                </div>

                {/* Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex flex-col p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Toplam Tesis</span>
                        <span className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">{stats.total}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Faal Tesis</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Bakımda / Kısmen</span>
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">{stats.inMaintenance}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Atıl / Gayrifaal</span>
                        <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{stats.idle}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Saha Fotoğrafları</span>
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.totalPhotos}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Eksiklik Kayıtlı</span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{stats.withDeficiencies}</span>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
                {filteredFacilities.length > 0 && (
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0 select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <input
                            type="checkbox"
                            checked={selectedFacilityIds.length === filteredFacilities.length && filteredFacilities.length > 0}
                            onChange={toggleSelectAll}
                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs">Tümünü Seç</span>
                        {selectedFacilityIds.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px]">
                                {selectedFacilityIds.length}
                            </span>
                        )}
                    </label>
                )}

                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Tesis adı, ilçe veya eksiklik notu ara..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="h-8.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="all">Tüm Tesis Türleri</option>
                        {PRESET_FACILITY_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="h-8.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="all">Tüm Durumlar</option>
                        {PRESET_STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value)}
                        className="h-8.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="all">Tüm Öncelikler</option>
                        {PRESET_PRIORITY_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>

                    {(searchTerm || statusFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all") && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                setStatusFilter("all");
                                setPriorityFilter("all");
                                setTypeFilter("all");
                            }}
                            className="h-8.5 px-2.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg font-bold flex items-center gap-1 transition-all"
                        >
                            <X size={13} />
                            <span>Filtreyi Temizle</span>
                        </button>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === "grid"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
                            }`}
                            title="Kart Görünümü"
                        >
                            <LayoutGrid size={14} />
                            <span className="hidden sm:inline">Kartlar</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                viewMode === "list"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400"
                            }`}
                            title="Liste Görünümü"
                        >
                            <List size={14} />
                            <span className="hidden sm:inline">Liste</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Facilities Display */}
            {filteredFacilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center bg-white/40 dark:bg-slate-900/40">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3.5">
                        <Building2 size={26} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kayıtlı Tesis Bulunamadı</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        {searchTerm || statusFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all"
                            ? "Arama kriterlerinize uyan tesis kaydı bulunamadı. Filtreleri temizlemeyi deneyin."
                            : "Bu denetim görevi için henüz incelenen bir tesis eklenmemiş. Yukarıdaki 'Yeni Tesis Ekle' butonuyla hemen ekleyin."}
                    </p>
                    <Button
                        onClick={handleOpenCreateModal}
                        className="mt-4 rounded-xl h-9.5 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                    >
                        <Plus size={14} />
                        <span>İlk Tesisi Ekle</span>
                    </Button>
                </div>
            ) : viewMode === "grid" ? (
                /* ========================================================================= */
                /* 1. GRID OF CARDS (Modern Visual Facility Cards)                           */
                /* ========================================================================= */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredFacilities.map((facility, index) => {
                        const statusObj = PRESET_STATUS_OPTIONS.find(s => s.value === facility.durum) || PRESET_STATUS_OPTIONS[0];
                        const photoList = facility.photos || [];

                        return (
                            <div
                                key={facility.id}
                                className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-400/70 dark:hover:border-blue-500/50 transition-all duration-300 relative"
                            >
                                {/* Uniform Card Header */}
                                <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800/70">
                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap overflow-hidden">
                                            <input
                                                type="checkbox"
                                                checked={selectedFacilityIds.includes(facility.id)}
                                                onChange={(e) => toggleSelectFacility(facility.id, e as any)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                                title="Rapora aktarmak için seç"
                                            />
                                            <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black shrink-0">
                                                #{index + 1}
                                            </span>
                                            <span 
                                                className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 truncate max-w-[140px]"
                                                title={facility.tur}
                                            >
                                                {facility.tur}
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border shrink-0 whitespace-nowrap ${statusObj.color}`}>
                                                {statusObj.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                onClick={() => handleOpenEditModal(facility)}
                                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                title="Düzenle"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFacility(facility.id, facility.ad)}
                                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Facility Name & Location */}
                                    <div className="mt-3">
                                        <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-1">
                                            {facility.ad}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-medium">
                                            {facility.ilce && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={12} className="text-slate-400 shrink-0" />
                                                    <span>{facility.ilce} {facility.adres ? `(${facility.adres})` : ""}</span>
                                                </span>
                                            )}
                                            {facility.mulkiyet && (
                                                <span className="text-[11px]">
                                                    Mülkiyet: <strong className="text-slate-600 dark:text-slate-300">{facility.mulkiyet}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                {/* Card Body: GENEL BİLGİLER VE AYRI MODÜL ERİŞİMLERİ */}
                                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                    <div className="space-y-3.5">
                                        {/* 1. GENEL BİLGİLER TABLOSU */}
                                        <div className="bg-slate-50/90 dark:bg-slate-950/70 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Building2 size={13} className="text-blue-500" />
                                                    Tesis Genel Bilgileri
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight border ${statusObj.color}`}>
                                                    {statusObj.label}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Tesis Türü</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block text-[11px]" title={facility.tur}>
                                                        {facility.tur}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">İlçe / Mevki</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block text-[11px]">
                                                        {facility.ilce || "Merkez / Belirtilmedi"}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Mülkiyet / Tahsis</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block text-[11px]" title={facility.mulkiyet}>
                                                        {facility.mulkiyet || "GSB"}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Öncelik Seviyesi</span>
                                                    <span className={`font-black text-[11px] flex items-center gap-1 ${
                                                        facility.oncelik === "kritik"
                                                            ? "text-rose-600 dark:text-rose-400"
                                                            : facility.oncelik === "orta"
                                                            ? "text-amber-600 dark:text-amber-400"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    }`}>
                                                        {facility.oncelik === "kritik" && <AlertTriangle size={11} />}
                                                        {facility.oncelik === "kritik" ? "Kritik Acil" : facility.oncelik === "orta" ? "Orta Öncelik" : "Normal"}
                                                    </span>
                                                </div>
                                            </div>

                                            {facility.adres && (
                                                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px]">
                                                    <span className="text-slate-400 text-[10px] block font-medium">Açık Adres / Konum:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium line-clamp-1">
                                                        {facility.adres}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2. EKSİKLİK & SORUN NOTU ÖZETİ (Ayrı butonla açılır) */}
                                        {facility.bilgiNotu?.trim() ? (
                                            <div
                                                onClick={() => handleOpenNoteModal(facility)}
                                                className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 hover:border-amber-500/50 cursor-pointer transition-all group/notebox"
                                            >
                                                <div className="flex items-center justify-between text-[11px] font-black text-amber-700 dark:text-amber-400 mb-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <AlertTriangle size={13} className={facility.oncelik === "kritik" ? "text-rose-500" : "text-amber-500"} />
                                                        <span>Kayıtlı Eksiklik / Tespit Notu</span>
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 group-hover/notebox:text-blue-500">Düzenle &rarr;</span>
                                                </div>
                                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 italic leading-relaxed">
                                                    "{facility.bilgiNotu}"
                                                </p>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => handleOpenNoteModal(facility)}
                                                className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/50 flex items-center justify-between text-slate-400 hover:text-amber-600 cursor-pointer transition-colors bg-slate-50/40 dark:bg-slate-950/30"
                                            >
                                                <span className="text-xs font-medium flex items-center gap-1.5">
                                                    <FileText size={13} />
                                                    <span>Henüz tespit notu eklenmedi</span>
                                                </span>
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">+ Not Ekle</span>
                                            </div>
                                        )}

                                        {/* 3. FOTOĞRAF ÖZETİ (Ayrı butonla açılır) */}
                                        {photoList.length > 0 ? (
                                            <div
                                                onClick={() => setPhotoModalFacilityId(facility.id)}
                                                className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 hover:border-blue-400 cursor-pointer transition-all flex items-center justify-between group/photobox"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-2 overflow-hidden">
                                                        {photoList.slice(0, 4).map((url, pIdx) => (
                                                            <img
                                                                key={pIdx}
                                                                src={getSafeImageUrl(url)}
                                                                alt=""
                                                                className="inline-block w-7 h-7 rounded-lg object-cover ring-2 ring-white dark:ring-slate-900 shadow-2xs"
                                                                onError={handleImageError}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 ml-1">
                                                        {photoList.length} Adet Fotoğraf Yüklü
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 group-hover/photobox:text-blue-500">
                                                    Yönet &rarr;
                                                </span>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => setPhotoModalFacilityId(facility.id)}
                                                className="p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600/50 flex items-center justify-between text-slate-400 hover:text-blue-600 cursor-pointer transition-colors bg-slate-50/40 dark:bg-slate-950/30"
                                            >
                                                <span className="text-xs font-medium flex items-center gap-1.5">
                                                    <ImageIcon size={13} />
                                                    <span>Fotoğraf bulunmuyor</span>
                                                </span>
                                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">+ Fotoğraf Ekle</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dedicated 2 Ana İşlem Butonu: Notlar ve Fotoğraflar */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenNoteModal(facility)}
                                                className={`h-9 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:scale-[1.01] active:scale-[0.99] ${
                                                    facility.bilgiNotu?.trim()
                                                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-500/25"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                                                }`}
                                            >
                                                <FileText size={14} className={facility.bilgiNotu?.trim() ? "text-amber-600" : "text-slate-400"} />
                                                <span>{facility.bilgiNotu?.trim() ? "Not Düzenle" : "Not Ekle"}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setPhotoModalFacilityId(facility.id)}
                                                className={`h-9 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:scale-[1.01] active:scale-[0.99] ${
                                                    photoList.length > 0
                                                        ? "bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700 hover:bg-blue-500/25"
                                                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                                                }`}
                                            >
                                                <ImageIcon size={14} className={photoList.length > 0 ? "text-blue-600" : "text-slate-400"} />
                                                <span>Fotoğraflar ({photoList.length})</span>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pt-1">
                                            <span className="flex items-center gap-1 text-[11px]">
                                                <Clock size={12} /> {facility.denetimTarihi || "Tarih Belirtilmedi"}
                                            </span>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTransferToReport([facility])}
                                                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60"
                                                    title="Bu tesisi ve tespitlerini rapora aktar"
                                                >
                                                    <FileText size={11} />
                                                    <span>Rapora Aktar</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(facility)}
                                                    className="text-[11px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                                                >
                                                    <Edit3 size={12} />
                                                    <span>Düzenle</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ========================================================================= */
                /* 2. LIST VIEW (Detailed Row View with Collapsible Accordion)               */
                /* ========================================================================= */
                <div className="space-y-4">
                    {filteredFacilities.map((facility, index) => {
                        const statusObj = PRESET_STATUS_OPTIONS.find(s => s.value === facility.durum) || PRESET_STATUS_OPTIONS[0];
                        const isExpanded = expandedCards[facility.id] !== false;
                        const photoList = facility.photos || [];

                        return (
                            <div
                                key={facility.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-blue-400/50 transition-all"
                            >
                                {/* Row Header */}
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                                    <div className="flex items-start gap-3.5">
                                        <div className="flex items-center gap-2 self-center shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedFacilityIds.includes(facility.id)}
                                                onChange={(e) => toggleSelectFacility(facility.id, e as any)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                                title="Rapora aktarmak için seç"
                                            />
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-500/20">
                                                {index + 1}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                    {facility.ad}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                    {facility.tur}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight border ${statusObj.color}`}>
                                                    {statusObj.label}
                                                </span>
                                                {facility.oncelik === "kritik" && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                                                        <AlertTriangle size={11} />
                                                        <span>Kritik Sorun</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5 font-medium">
                                                {facility.ilce && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={12} className="text-slate-400" />
                                                        <span>{facility.ilce} {facility.adres ? `(${facility.adres})` : ""}</span>
                                                    </span>
                                                )}
                                                {facility.mulkiyet && (
                                                    <span className="text-[11px] text-slate-400">
                                                        Mülkiyet: <strong className="text-slate-600 dark:text-slate-300">{facility.mulkiyet}</strong>
                                                    </span>
                                                )}
                                                {facility.denetimTarihi && (
                                                    <span className="flex items-center gap-1 text-[11px]">
                                                        <Clock size={11} />
                                                        <span>{facility.denetimTarihi}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center">
                                        <button
                                            type="button"
                                            onClick={() => handleTransferToReport([facility])}
                                            className="h-8 px-2.5 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 flex items-center gap-1.5 transition-all shadow-2xs"
                                            title="Bu tesisi ve tespitlerini rapora aktar"
                                        >
                                            <FileText size={13} className="text-indigo-600 dark:text-indigo-400" />
                                            <span>Rapora Aktar</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenNoteModal(facility)}
                                            className={`h-8 px-2.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                                                facility.bilgiNotu?.trim()
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 hover:bg-amber-500/20"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                                            }`}
                                            title="Tesis Tespit ve Eksiklik Notlarını Düzenle"
                                        >
                                            <FileText size={13} className={facility.bilgiNotu?.trim() ? "text-amber-500" : "text-slate-400"} />
                                            <span>{facility.bilgiNotu?.trim() ? "Not Düzenle" : "Not Ekle"}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setPhotoModalFacilityId(facility.id)}
                                            className={`h-8 px-2.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all ${
                                                photoList.length > 0
                                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/60 hover:bg-blue-500/20"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                                            }`}
                                            title="Tesis Fotoğraflarını Yönet"
                                        >
                                            <ImageIcon size={13} className={photoList.length > 0 ? "text-blue-500" : "text-slate-400"} />
                                            <span>Fotoğraflar ({photoList.length})</span>
                                        </button>

                                        <button
                                            onClick={() => handleOpenEditModal(facility)}
                                            className="h-8 px-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/20 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-all"
                                            title="Genel Bilgileri Düzenle"
                                        >
                                            <Edit3 size={13} />
                                            <span className="hidden sm:inline">Genel Bilgi</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFacility(facility.id, facility.ad)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                            title="Tesisi Sil"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => toggleCardExpanded(facility.id)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                            title={isExpanded ? "Daralt" : "Genişlet"}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Row Body (Collapsible) */}
                                {isExpanded && (
                                    <div className="p-5 space-y-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                        {/* 1. GENEL BİLGİLER TABLOSU */}
                                        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
                                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                                    <Building2 size={14} className="text-blue-500" />
                                                    Tesis Genel Bilgileri
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight border ${statusObj.color}`}>
                                                        {statusObj.label}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(facility)}
                                                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 ml-2"
                                                    >
                                                        <Edit3 size={12} />
                                                        Genel Bilgileri Düzenle
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Tesis Türü</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]" title={facility.tur}>
                                                        {facility.tur}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">İlçe / Mevki</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                                                        {facility.ilce || "Merkez / Belirtilmedi"}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Mülkiyet / Tahsis</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]" title={facility.mulkiyet}>
                                                        {facility.mulkiyet || "GSB"}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-slate-400 block text-[10px] font-medium">Öncelik Seviyesi</span>
                                                    <span className={`font-black text-[11px] flex items-center gap-1 ${
                                                        facility.oncelik === "kritik"
                                                            ? "text-rose-600 dark:text-rose-400"
                                                            : facility.oncelik === "orta"
                                                            ? "text-amber-600 dark:text-amber-400"
                                                            : "text-slate-700 dark:text-slate-300"
                                                    }`}>
                                                        {facility.oncelik === "kritik" && <AlertTriangle size={11} />}
                                                        {facility.oncelik === "kritik" ? "Kritik Acil" : facility.oncelik === "orta" ? "Orta Öncelik" : "Normal"}
                                                    </span>
                                                </div>
                                            </div>

                                            {facility.adres && (
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                                                    <span className="text-slate-400 text-[10px] block font-medium">Açık Adres / Konum:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                                                        {facility.adres}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2 & 3. NOTLAR VE FOTOĞRAFLAR ALANI */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                            {/* Not Özeti */}
                                            <div
                                                onClick={() => handleOpenNoteModal(facility)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                                    facility.bilgiNotu?.trim()
                                                        ? "bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60"
                                                        : "bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 hover:border-amber-400"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between text-xs font-black">
                                                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[11px]">
                                                        <FileText size={13} />
                                                        Eksiklik & Tespit Notu
                                                    </span>
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                        {facility.bilgiNotu?.trim() ? "Not Düzenle →" : "+ Not Ekle"}
                                                    </span>
                                                </div>
                                                {facility.bilgiNotu?.trim() ? (
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-3 italic leading-relaxed">
                                                        "{facility.bilgiNotu}"
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">
                                                        Henüz tespit veya eksiklik notu girilmedi. Not eklemek için tıklayın.
                                                    </p>
                                                )}
                                                <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>Öncelik: <strong className="text-slate-600 dark:text-slate-300">{facility.oncelik || "Normal"}</strong></span>
                                                    <span className="text-amber-600 dark:text-amber-400 font-bold">Ayrı Pencerede Düzenle</span>
                                                </div>
                                            </div>

                                            {/* Fotoğraf Özeti */}
                                            <div
                                                onClick={() => setPhotoModalFacilityId(facility.id)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                                    photoList.length > 0
                                                        ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/50 hover:border-blue-400"
                                                        : "bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between text-xs font-black">
                                                    <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 uppercase tracking-wider text-[11px]">
                                                        <ImageIcon size={13} />
                                                        Fotoğraflar ({photoList.length})
                                                    </span>
                                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                        {photoList.length > 0 ? "Yönet →" : "+ Fotoğraf Ekle"}
                                                    </span>
                                                </div>
                                                {photoList.length > 0 ? (
                                                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                                                        {photoList.slice(0, 6).map((url, pIdx) => (
                                                            <div key={pIdx} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                                                <img
                                                                    src={getSafeImageUrl(url)}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                    onError={handleImageError}
                                                                />
                                                            </div>
                                                        ))}
                                                        {photoList.length > 6 && (
                                                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                                +{photoList.length - 6}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">
                                                        Bu tesise ait henüz fotoğraf eklenmedi. Fotoğraf eklemek için tıklayın.
                                                    </p>
                                                )}
                                                <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>{photoList.length} adet görsel kayıtlı</span>
                                                    <span className="text-blue-600 dark:text-blue-400 font-bold">Galeriyi Aç</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Facility Modal (SADECE GENEL BİLGİLER) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                    <Building2 size={18} />
                                </div>
                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                                    {editingFacilityId ? "Tesis Genel Bilgilerini Düzenle" : "Yeni Tesis Ekle (Genel Bilgiler)"}
                                </h4>
                            </div>
                            <button
                                onClick={() => !isSavingFacilityModal && setIsModalOpen(false)}
                                disabled={isSavingFacilityModal}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg disabled:opacity-50"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveFacilityModal} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Tesis Adı <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.ad || ""}
                                    onChange={e => setFormData(prev => ({ ...prev, ad: e.target.value }))}
                                    placeholder="Örn: Atatürk Kapalı Spor Salonu"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Tesis Türü
                                    </label>
                                    <select
                                        value={formData.tur || PRESET_FACILITY_TYPES[0]}
                                        onChange={e => setFormData(prev => ({ ...prev, tur: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                                    >
                                        {PRESET_FACILITY_TYPES.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Faaliyet Durumu
                                    </label>
                                    <select
                                        value={formData.durum || "faal"}
                                        onChange={e => setFormData(prev => ({ ...prev, durum: e.target.value as any }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                                    >
                                        {PRESET_STATUS_OPTIONS.map(s => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        İlçe / Mevki
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.ilce || ""}
                                        onChange={e => setFormData(prev => ({ ...prev, ilce: e.target.value }))}
                                        placeholder="Örn: Battalgazi / Merkez"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Mülkiyet / Tahsis
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.mulkiyet || "GSB (Gençlik ve Spor Bakanlığı)"}
                                        onChange={e => setFormData(prev => ({ ...prev, mulkiyet: e.target.value }))}
                                        placeholder="Örn: GSB, Belediye Tahsisli, Kiralık"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Denetim Tarihi
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.denetimTarihi || new Date().toISOString().split("T")[0]}
                                        onChange={e => setFormData(prev => ({ ...prev, denetimTarihi: e.target.value }))}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Öncelik Seviyesi
                                    </label>
                                    <select
                                        value={formData.oncelik || "normal"}
                                        onChange={e => setFormData(prev => ({ ...prev, oncelik: e.target.value as any }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                                    >
                                        {PRESET_PRIORITY_OPTIONS.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Informational Callout: Step 1 / Step 2 Guidance */}
                            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-start gap-2.5">
                                <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                    <strong className="font-bold text-slate-900 dark:text-white block mb-0.5">Notlar ve Fotoğraflar Ayrı Butonlarla Eklenir</strong>
                                    Önce genel bilgileri kaydedin. Kaydettikten sonra tesis kartı üzerindeki <strong className="text-blue-600 dark:text-blue-400 font-bold">"Not Düzenle"</strong> ve <strong className="text-blue-600 dark:text-blue-400 font-bold">"Fotoğraflar"</strong> butonlarına basarak tespit ve fotoğraflarınızı ayrıca ekleyebilirsiniz.
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isSavingFacilityModal}
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-9.5 px-4 rounded-xl text-xs font-bold"
                                >
                                    İptal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSavingFacilityModal}
                                    className="h-9.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {isSavingFacilityModal ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Kaydediliyor...
                                        </span>
                                    ) : (
                                        editingFacilityId ? "Bilgileri Güncelle" : "Tesisi Kaydet ve Ekle"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Dedicated Note & Findings Modal */}
            {noteModalFacilityId && (() => {
                const fac = facilities.find(f => f.id === noteModalFacilityId);
                if (!fac) return null;

                const addQuickNote = (text: string) => {
                    setNoteModalText(prev => {
                        const trimmed = prev.trim();
                        if (!trimmed) return text;
                        if (trimmed.includes(text)) return trimmed;
                        return `${trimmed}\n• ${text}`;
                    });
                };

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
                            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                                            Tespit & Eksiklik Notları
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {fac.ad} {fac.ilce ? `(${fac.ilce})` : ""}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !isSavingNoteModal && setNoteModalFacilityId(null)}
                                    disabled={isSavingNoteModal}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg disabled:opacity-50"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto flex-1">
                                {/* Öncelik Seçimi */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Öncelik Derecesi
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {PRESET_PRIORITY_OPTIONS.map(p => {
                                            const isSelected = noteModalPriority === p.value;
                                            return (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setNoteModalPriority(p.value as any)}
                                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                                        isSelected
                                                            ? p.value === "kritik"
                                                                ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                                                                : p.value === "orta"
                                                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                                                : "bg-blue-600 text-white border-blue-600 shadow-xs"
                                                            : "bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {p.value === "kritik" && <AlertTriangle size={12} />}
                                                    <span>{p.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Hızlı Tespit Şablonları (Kompakt Tek Satır Seçici & Yatay Kaydırma) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                            <Sparkles size={12} className="text-amber-500" />
                                            Hızlı Tespit Şablonu
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsManagingQuickNotes(!isManagingQuickNotes)}
                                            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors flex items-center gap-1 ${
                                                isManagingQuickNotes
                                                    ? "bg-amber-500 text-white border-amber-600"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-600"
                                            }`}
                                        >
                                            <Settings size={10} />
                                            <span>{isManagingQuickNotes ? "Paneli Kapat" : "Şablonları Düzenle"}</span>
                                        </button>
                                    </div>

                                    {/* Açılır Menü (Select) Hızlı Seçim */}
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            defaultValue=""
                                            onChange={e => {
                                                if (e.target.value) {
                                                    addQuickNote(e.target.value);
                                                    e.target.value = "";
                                                }
                                            }}
                                            className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-amber-500 cursor-pointer truncate"
                                        >
                                            <option value="" disabled>
                                                ⚡ Hazır Tespit Seçin (Tıklayınca Nota Ekler)...
                                            </option>
                                            {customQuickNotes.map((qn, qIdx) => (
                                                <option key={qIdx} value={qn}>
                                                    {qn}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Yatay Tek Satır Hızlı Tıkla-Ekle Butonları (Kutuyu büyütmez) */}
                                    {!isManagingQuickNotes && customQuickNotes.length > 0 && (
                                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                            {customQuickNotes.map((qn, qIdx) => (
                                                <button
                                                    key={qIdx}
                                                    type="button"
                                                    onClick={() => addQuickNote(qn)}
                                                    className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/80 dark:border-slate-700/80 transition-colors whitespace-nowrap flex items-center gap-1"
                                                    title={qn}
                                                >
                                                    <span className="text-amber-500 font-bold">+</span>
                                                    <span>{qn.length > 25 ? qn.substring(0, 25) + '...' : qn}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Şablon Yönetim Paneli (Açıkken) */}
                                    {isManagingQuickNotes && (
                                        <div className="p-2.5 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
                                            {/* Yeni Şablon Ekleme Girişi */}
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    value={newQuickNoteInput}
                                                    onChange={e => setNewQuickNoteInput(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleAddQuickNote();
                                                        }
                                                    }}
                                                    placeholder="Yeni hazır tespit şablonu yazın..."
                                                    className="flex-1 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-amber-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddQuickNote}
                                                    className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                                                >
                                                    <Plus size={12} />
                                                    Ekle
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleResetQuickNotes}
                                                    className="h-7 px-2 text-[10px] font-bold text-slate-500 hover:text-rose-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md transition-colors flex items-center gap-1"
                                                    title="Varsayılana Sıfırla"
                                                >
                                                    <RotateCcw size={10} />
                                                    Sıfırla
                                                </button>
                                            </div>

                                            {/* Kayıtlı Şablonlar Listesi (Düzenleme / Çıkarma) */}
                                            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                                {customQuickNotes.map((qn, qIdx) => (
                                                    <div
                                                        key={qIdx}
                                                        className="flex items-center justify-between gap-2 p-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded text-[11px]"
                                                    >
                                                        {editingQuickNoteIndex === qIdx ? (
                                                            <div className="flex items-center gap-1 flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={editingQuickNoteText}
                                                                    onChange={e => setEditingQuickNoteText(e.target.value)}
                                                                    onKeyDown={e => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault();
                                                                            handleSaveEditQuickNote(qIdx);
                                                                        } else if (e.key === "Escape") {
                                                                            setEditingQuickNoteIndex(null);
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                    className="flex-1 h-6 px-1.5 text-xs rounded border border-blue-500 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 outline-none"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEditQuickNote(qIdx)}
                                                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    title="Kaydet"
                                                                >
                                                                    <Check size={11} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingQuickNoteIndex(null)}
                                                                    className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                                    title="İptal"
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span className="flex-1 font-medium text-slate-700 dark:text-slate-300 truncate select-none">
                                                                    • {qn}
                                                                </span>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditQuickNote(qIdx, qn)}
                                                                        className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                                                        title="Düzenle"
                                                                    >
                                                                        <Edit3 size={11} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteQuickNote(qIdx)}
                                                                        className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                                                        title="Sil"
                                                                    >
                                                                        <Trash2 size={11} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Not Alanı */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                        Ayrıntılı Tespit ve Durum Notu
                                    </label>
                                    <textarea
                                        value={noteModalText}
                                        onChange={e => setNoteModalText(e.target.value)}
                                        rows={4}
                                        placeholder="Tesisle ilgili gözlemlenen fiziki aksaklık, bakım-onarım ihtiyacı veya olumlu durumları yazınız..."
                                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500 leading-relaxed resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isSavingNoteModal}
                                    onClick={() => setNoteModalFacilityId(null)}
                                    className="h-9 px-4 rounded-xl text-xs font-bold"
                                >
                                    Vazgeç
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveNoteModal}
                                    disabled={isSavingNoteModal}
                                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                                >
                                    {isSavingNoteModal ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Kaydediliyor...
                                        </span>
                                    ) : (
                                        "Notu Kaydet"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Dedicated Photo Management Modal */}
            {photoModalFacilityId && (() => {
                const fac = facilities.find(f => f.id === photoModalFacilityId);
                if (!fac) return null;
                const photoList = fac.photos || [];
                const isUploading = !!uploadingForFacility[fac.id];

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                                        <ImageIcon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                                            Tesis Fotoğrafları ({photoList.length})
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                            {fac.ad} {fac.ilce ? `(${fac.ilce})` : ""}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPhotoModalFacilityId(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Top Action Bar in Photo Modal */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2">
                                    <label className={`h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                        {isUploading ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Upload size={14} />
                                        )}
                                        <span>{isUploading ? "Yükleniyor..." : "Yeni Fotoğraf Yükle"}</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            disabled={isUploading}
                                            onChange={e => handleUploadFacilityPhoto(fac.id, e)}
                                        />
                                    </label>

                                    {Array.isArray(localAuditData?.photos) && localAuditData.photos.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsGalleryPickerOpen(true)}
                                            className="h-9 px-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            <FolderPlus size={14} className="text-blue-500" />
                                            <span>Galeriden Ekle ({localAuditData.photos.length})</span>
                                        </button>
                                    )}

                                    {photoList.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => exportPhotosToComputer(photoList, `${fac.ad || "Tesis"}_Fotograflari`)}
                                            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 transition-colors"
                                            title="Bu tesise ait tüm fotoğrafları bilgisayara aktar"
                                        >
                                            <Download size={14} />
                                            <span>Bilgisayara Aktar</span>
                                        </button>
                                    )}
                                </div>

                                <span className="text-[11px] text-slate-400 font-medium">
                                    {photoList.length} fotoğraf kayıtlı
                                </span>
                            </div>

                            {/* Photo Grid */}
                            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                                {photoList.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-500 flex items-center justify-center mb-3">
                                            <ImageIcon size={32} />
                                        </div>
                                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                                            Henüz Fotoğraf Eklenmemiş
                                        </h5>
                                        <p className="text-xs text-slate-400 max-w-sm mb-4">
                                            Tesisin fiziki durumunu belgelemek için cihazınızdan fotoğraf yükleyebilir veya genel denetim galerisinden seçebilirsiniz.
                                        </p>
                                        <label className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                            <Upload size={14} />
                                            <span>Fotoğraf Yükle</span>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="hidden"
                                                onChange={e => handleUploadFacilityPhoto(fac.id, e)}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                                        {photoList.map((url, pIdx) => {
                                            const safeUrl = getSafeImageUrl(url);
                                            const isFailed = !!failedImages[url];
                                            const currentDesc = fac.photoDescriptions?.[url] || "";

                                            return (
                                                <div
                                                    key={`${url}_${pIdx}`}
                                                    className="bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col group/item shadow-xs"
                                                >
                                                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                                                        {isFailed ? (
                                                            <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-amber-500/10 text-center gap-1">
                                                                <span className="text-[10px] font-bold text-amber-500">Açılamadı</span>
                                                                <label className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded cursor-pointer">
                                                                    Seç
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={e => handleReplaceFacilityPhoto(fac.id, pIdx, e)}
                                                                    />
                                                                </label>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <img
                                                                    src={safeUrl}
                                                                    alt={`Fotoğraf ${pIdx + 1}`}
                                                                    className="w-full h-full object-cover cursor-pointer group-hover/item:scale-105 transition-transform duration-300"
                                                                    onClick={() => setLightboxPhoto({ url: safeUrl, title: `${fac.ad} (#${pIdx + 1})` })}
                                                                    onError={() => setFailedImages(prev => ({ ...prev, [url]: true }))}
                                                                />
                                                                <div
                                                                    onClick={() => setLightboxPhoto({ url: safeUrl, title: `${fac.ad} (#${pIdx + 1})` })}
                                                                    className="absolute inset-0 bg-black/0 group-hover/item:bg-black/20 cursor-pointer flex items-center justify-center transition-colors"
                                                                >
                                                                    <ZoomIn size={16} className="text-white opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                                                </div>
                                                            </>
                                                        )}

                                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-black/70 text-white pointer-events-none">
                                                            #{pIdx + 1}
                                                        </span>

                                                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-10 bg-black/60 backdrop-blur-xs p-0.5 rounded-lg">
                                                            <button
                                                                type="button"
                                                                onClick={() => exportPhotosToComputer([url], `${fac.ad || "Tesis"}_Foto_${pIdx + 1}`)}
                                                                className="p-1 text-white hover:text-emerald-300 rounded transition-colors"
                                                                title="Bilgisayara İndir / Aktar"
                                                            >
                                                                <Download size={11} />
                                                            </button>
                                                            <label
                                                                className="p-1 text-white hover:text-blue-300 rounded cursor-pointer transition-colors"
                                                                title="Değiştir"
                                                            >
                                                                <RefreshCw size={11} />
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={e => handleReplaceFacilityPhoto(fac.id, pIdx, e)}
                                                                />
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteFacilityPhoto(fac.id, pIdx)}
                                                                className="p-1 text-white hover:text-rose-400 rounded transition-colors"
                                                                title="Sil"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="p-2 flex-1 flex flex-col justify-between">
                                                        <input
                                                            type="text"
                                                            defaultValue={currentDesc}
                                                            onBlur={e => handleUpdatePhotoCaption(fac.id, url, e.target.value)}
                                                            placeholder="Açıklama / Başlık ekle..."
                                                            className="w-full text-[11px] p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
                                <Button
                                    type="button"
                                    onClick={() => setPhotoModalFacilityId(null)}
                                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                                >
                                    Kapat
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal: Gallery Picker from localAuditData.photos */}
            {isGalleryPickerOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsGalleryPickerOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Denetim Galerisinden Fotoğraf Seç</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tesise eklemek istediğiniz fotoğrafların üzerine tıklayın.</p>
                            </div>
                            <button
                                onClick={() => setIsGalleryPickerOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 max-h-[60vh]">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {(localAuditData?.photos || []).map((photoUrl: string, idx: number) => {
                                    const targetFac = photoModalFacilityId ? facilities.find(f => f.id === photoModalFacilityId) : null;
                                    const isSelected = targetFac ? (targetFac.photos || []).includes(photoUrl) : (formData.photos || []).includes(photoUrl);

                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (photoModalFacilityId) {
                                                    handleToggleGalleryPhotoForFacility(photoUrl);
                                                } else {
                                                    setFormData(prev => {
                                                        const current = prev.photos || [];
                                                        if (current.includes(photoUrl)) {
                                                            return { ...prev, photos: current.filter(u => u !== photoUrl) };
                                                        } else {
                                                            return { ...prev, photos: [...current, photoUrl] };
                                                        }
                                                    });
                                                }
                                            }}
                                            className={`relative group aspect-video rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                                isSelected
                                                    ? "border-blue-600 ring-2 ring-blue-500/30"
                                                    : "border-slate-200 dark:border-slate-800 hover:border-slate-400"
                                            }`}
                                        >
                                            <img
                                                src={getSafeImageUrl(photoUrl)}
                                                alt={`Galeri Foto ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={handleImageError}
                                            />
                                            {isSelected && (
                                                <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white rounded-full p-1 shadow">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {photoModalFacilityId
                                    ? `${(facilities.find(f => f.id === photoModalFacilityId)?.photos || []).length} fotoğraf bağlı`
                                    : `${(formData.photos || []).length} fotoğraf seçildi`
                                }
                            </span>
                            <Button
                                onClick={() => setIsGalleryPickerOpen(false)}
                                className="h-8.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                            >
                                Tamam
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal for Photo Inspection */}
            {lightboxPhoto && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setLightboxPhoto(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-800"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border-b border-slate-800 text-white">
                            <span className="text-xs font-bold truncate max-w-[80%]">{lightboxPhoto.title}</span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={lightboxPhoto.url}
                                    download="denetim_fotograf.jpg"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                                    title="Fotoğrafı İndir"
                                >
                                    <Download size={16} />
                                </a>
                                <button
                                    onClick={() => setLightboxPhoto(null)}
                                    className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-black min-w-[340px] min-h-[300px]">
                            <img
                                src={lightboxPhoto.url}
                                alt="Denetim Fotoğrafı"
                                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-all"
                                onError={handleImageError}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
