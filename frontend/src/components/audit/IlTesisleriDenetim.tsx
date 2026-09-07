import React, { useState, useMemo } from "react";
import {
    Building2, Plus, Search, Trash2, Edit3, Image as ImageIcon,
    AlertTriangle, X, ChevronDown, ChevronUp,
    Download, FileText, Check, Loader2, MapPin,
    Clock, ZoomIn, LayoutGrid, List
} from "lucide-react";
import { Button } from "../ui/Button";
import { toast } from "react-hot-toast";
import { useConfirm } from "../../lib/context/ConfirmContext";
import { BASE_URL, API_URL, LOCAL_API_URL, IS_ELECTRON } from "../../lib/config";
import { getAuthHeaders } from "../../lib/api/utils";

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

export const getSafeImageUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("data:") || url.startsWith("blob:")) {
        return url;
    }

    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : "127.0.0.1";
    const localHost = host === "localhost" || host === "127.0.0.1" ? host : "127.0.0.1";

    // Yerel denetim ve rapor dosyaları her zaman yerel makinedeki backend üzerinden sunulur
    const isLocalPath = url.includes("/Raporlar/") || 
                        url.includes("/uploads/") || 
                        url.includes("denetim_tesisleri") ||
                        url.startsWith("/Diğer İşlem") ||
                        url.startsWith("/Mevzuat");

    if (isLocalPath) {
        const pathPart = url.replace(/^https?:\/\/[^/]+/, "");
        const cleanPath = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
        if (IS_ELECTRON || host === "localhost" || host === "127.0.0.1") {
            return `http://${localHost}:8000${cleanPath}`;
        }
        return `${BASE_URL}${cleanPath}`;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }

    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    const base = IS_ELECTRON ? `http://${localHost}:8000` : BASE_URL;
    return `${base}${cleanUrl}`;
};

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

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Add / Edit Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
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
        denetimTarihi: new Date().toISOString().split("T")[0]
    });

    // Upload state per facility: facilityId -> boolean
    const [uploadingForFacility, setUploadingForFacility] = useState<Record<string, boolean>>({});

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

    // Open Modal for Create
    const handleOpenCreateModal = () => {
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
            denetimTarihi: new Date().toISOString().split("T")[0]
        });
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = (facility: DenetimFacility) => {
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
            denetimTarihi: facility.denetimTarihi || new Date().toISOString().split("T")[0]
        });
        setIsModalOpen(true);
    };

    // Save Facility from Modal
    const handleSaveFacilityModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.ad?.trim()) {
            toast.error("Lütfen tesis adını giriniz.");
            return;
        }

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
                        oncelik: formData.oncelik || "normal",
                        bilgiNotu: formData.bilgiNotu || "",
                        denetimTarihi: formData.denetimTarihi || ""
                    };
                }
                return f;
            });
            toast.success("Tesis bilgileri güncellendi.");
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
                bilgiNotu: formData.bilgiNotu || "",
                denetimTarihi: formData.denetimTarihi || new Date().toISOString().split("T")[0],
                photos: [],
                photoDescriptions: {},
                createdAt: new Date().toISOString()
            };
            updatedFacilities = [newFacility, ...facilities];
            toast.success("Yeni tesis denetim kaydı eklendi.");
        }

        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        await onSaveAuditData(updatedData);
        setIsModalOpen(false);
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
        await onSaveAuditData(updatedData);
        toast.success("Tesis kaydı silindi.");
    };

    // Update Facility Note inline
    const handleUpdateFacilityNote = async (facilityId: string, note: string) => {
        const updatedFacilities = facilities.map(f => {
            if (f.id === facilityId) {
                return { ...f, bilgiNotu: note };
            }
            return f;
        });
        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        await onSaveAuditData(updatedData);
    };

    // Update Facility Priority inline
    const handleUpdateFacilityPriority = async (facilityId: string, priority: "normal" | "orta" | "kritik") => {
        const updatedFacilities = facilities.map(f => {
            if (f.id === facilityId) {
                return { ...f, oncelik: priority };
            }
            return f;
        });
        const updatedData = {
            ...localAuditData,
            tesisler: updatedFacilities
        };
        setLocalAuditData(updatedData);
        await onSaveAuditData(updatedData);
        toast.success("Öncelik güncellendi.");
    };

    // Upload Photos for Facility
    const handleUploadFacilityPhoto = async (facilityId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        // Reset input immediately so same files can be selected again
        e.target.value = "";

        setUploadingForFacility(prev => ({ ...prev, [facilityId]: true }));
        try {
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
            await onSaveAuditData(updatedData);
            toast.success(`${uploadedUrls.length} adet fotoğraf başarıyla eklendi.`);
        } catch (error) {
            console.error("Facility photo upload error:", error);
            toast.error("Fotoğraf yüklenirken bir hata oluştu.");
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
        await onSaveAuditData(updatedData);
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
        await onSaveAuditData(updatedData);
    };

    // Export / Transfer Findings to Report
    const handleTransferFindingsToReport = () => {
        if (facilities.length === 0) {
            toast.error("Aktarılacak herhangi bir tesis kaydı bulunmamaktadır.");
            return;
        }

        let html = `<h3><strong>GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ TESİS İNCELEMELERİ VE SAHA TESPİTLERİ</strong></h3>`;
        html += `<p>Denetim kapsamında incelenen il ve ilçe tesisleri, fiziki durumları ve tespit edilen aksaklıklar aşağıda özetlenmiştir:</p>`;
        html += `<table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 13px; margin: 16px 0;">`;
        html += `<thead style="background-color: #f1f5f9; color: #1e293b;">
                    <tr>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Sıra</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Tesis Adı ve Türü</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">İlçe / Konum</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Faaliyet Durumu</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Öncelik</th>
                        <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Tespit Edilen Eksiklik ve Sorunlar</th>
                    </tr>
                 </thead><tbody>`;

        facilities.forEach((fac, idx) => {
            const statusLabel = PRESET_STATUS_OPTIONS.find(s => s.value === fac.durum)?.label || fac.durum;
            const priorityLabel = PRESET_PRIORITY_OPTIONS.find(p => p.value === fac.oncelik)?.label || (fac.oncelik || "Normal");
            html += `<tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>${fac.ad}</strong><br/><span style="color: #64748b; font-size: 11px;">${fac.tur}</span></td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${fac.ilce || "-"}${fac.adres ? ` / ${fac.adres}` : ""}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${statusLabel}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${priorityLabel}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${fac.bilgiNotu ? fac.bilgiNotu.replace(/\n/g, "<br/>") : "<em>Herhangi bir eksiklik veya arıza belirtilmemiştir.</em>"}</td>
            </tr>`;
        });

        html += `</tbody></table>`;

        if (onTransferToReport) {
            onTransferToReport(html);
        } else {
            navigator.clipboard.writeText(html);
            toast.success("Tesis tespitleri panoya HTML formatında kopyalandı.");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
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

                    <div className="flex flex-wrap items-center gap-2.5">
                        {facilities.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleTransferFindingsToReport}
                                className="h-9.5 px-4 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 hover:border-blue-500 flex items-center gap-1.5"
                            >
                                <FileText size={14} className="text-blue-500" />
                                <span>Rapora Aktar</span>
                            </Button>
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
                        const isUploading = !!uploadingForFacility[facility.id];

                        return (
                            <div
                                key={facility.id}
                                className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-400/70 dark:hover:border-blue-500/50 transition-all duration-300 relative"
                            >
                                {/* Uniform Card Header */}
                                <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800/70">
                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap overflow-hidden">
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
                                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                    <div className="space-y-4">
                                        {/* Eksiklik & Sorun Bilgi Notu Box */}
                                        <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <AlertTriangle size={13} className={facility.oncelik === "kritik" ? "text-rose-500" : "text-amber-500"} />
                                                    <span>Eksiklik & Sorun Notu</span>
                                                </span>
                                                <select
                                                    value={facility.oncelik || "normal"}
                                                    onChange={e => handleUpdateFacilityPriority(facility.id, e.target.value as any)}
                                                    className="h-6 px-2 text-[10px] font-bold rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                                                >
                                                    {PRESET_PRIORITY_OPTIONS.map(p => (
                                                        <option key={p.value} value={p.value}>{p.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <textarea
                                                defaultValue={facility.bilgiNotu || ""}
                                                onBlur={e => handleUpdateFacilityNote(facility.id, e.target.value)}
                                                rows={3}
                                                placeholder="Tesisle ilgili fiziki kusur, bakım ihtiyacı veya eksiklik notlarını yazın..."
                                                className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 transition-all resize-none leading-relaxed"
                                            />
                                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span>* Alandan çıkıldığında otomatik kaydedilir.</span>
                                                {facility.bilgiNotu && (
                                                    <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                                                        <Check size={11} /> Kaydedildi
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Fotoğraf Galerisi */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <ImageIcon size={13} className="text-blue-500" />
                                                    <span>Fotoğraf Galerisi ({photoList.length})</span>
                                                </span>
                                                <label className={`text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                                    {isUploading ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <Plus size={12} />
                                                    )}
                                                    <span>Fotoğraf Ekle</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={e => handleUploadFacilityPhoto(facility.id, e)}
                                                        disabled={isUploading}
                                                    />
                                                </label>
                                            </div>

                                            {photoList.length > 0 ? (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {photoList.map((url, pIdx) => {
                                                        const safeUrl = getSafeImageUrl(url);
                                                        return (
                                                            <div
                                                                key={`${url}_${pIdx}`}
                                                                className="relative aspect-video rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 cursor-pointer group/photo shadow-xs hover:shadow-md bg-slate-100 dark:bg-slate-900 transition-all"
                                                                onClick={() => setLightboxPhoto({ url: safeUrl, title: `${facility.ad} (${pIdx + 1}/${photoList.length})` })}
                                                            >
                                                                <img
                                                                    src={safeUrl}
                                                                    alt={`${facility.ad} fotoğraf ${pIdx + 1}`}
                                                                    className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                                                                    onError={(e) => {
                                                                        const target = e.currentTarget;
                                                                        if (!target.dataset.triedLocal && !target.src.includes("127.0.0.1:8000")) {
                                                                            target.dataset.triedLocal = "true";
                                                                            try {
                                                                                const urlObj = new URL(target.src);
                                                                                target.src = `http://127.0.0.1:8000${urlObj.pathname}`;
                                                                            } catch {}
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/30 transition-colors flex items-center justify-center">
                                                                    <ZoomIn size={16} className="text-white opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                                                                </div>
                                                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-black/70 text-white backdrop-blur-xs">
                                                                    #{pIdx + 1}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteFacilityPhoto(facility.id, pIdx);
                                                                    }}
                                                                    className="absolute top-1 right-1 w-5 h-5 bg-black/75 hover:bg-rose-600 text-white rounded-md flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity shadow-xs"
                                                                    title="Fotoğrafı Kaldır"
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Gallery Add Tile */}
                                                    <label className={`relative aspect-video rounded-xl border border-dashed border-blue-300 dark:border-blue-700/60 hover:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex flex-col items-center justify-center cursor-pointer transition-all text-blue-600 dark:text-blue-400 group/add ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                                        {isUploading ? (
                                                            <Loader2 size={16} className="animate-spin text-blue-500" />
                                                        ) : (
                                                            <>
                                                                <Plus size={16} className="group-hover/add:scale-110 transition-transform" />
                                                                <span className="text-[10px] font-bold mt-0.5">Ekle</span>
                                                            </>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            className="hidden"
                                                            onChange={e => handleUploadFacilityPhoto(facility.id, e)}
                                                            disabled={isUploading}
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                /* Empty Gallery Upload Box */
                                                <label className={`w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-400 hover:text-blue-600 transition-all bg-slate-50/50 dark:bg-slate-950/30 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                                    {isUploading ? (
                                                        <Loader2 size={20} className="animate-spin text-blue-500" />
                                                    ) : (
                                                        <ImageIcon size={22} className="text-slate-400" />
                                                    )}
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                                                        {isUploading ? "Fotoğraflar yükleniyor..." : "Tesis Fotoğraflarını Yükle"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        Çoklu fotoğraf seçebilirsiniz (PNG, JPG)
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={e => handleUploadFacilityPhoto(facility.id, e)}
                                                        disabled={isUploading}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Bottom Footer */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-semibold">
                                        <span className="flex items-center gap-1 text-[11px]">
                                            <Clock size={12} /> {facility.denetimTarihi || "Tarih Belirtilmedi"}
                                        </span>

                                        <button
                                            onClick={() => handleOpenEditModal(facility)}
                                            className="text-[11px] font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                                        >
                                            Düzenle
                                        </button>
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
                        const isUploading = !!uploadingForFacility[facility.id];

                        return (
                            <div
                                key={facility.id}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-blue-400/50 transition-all"
                            >
                                {/* Row Header */}
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                                    <div className="flex items-start gap-3.5">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-black text-sm border border-blue-500/20">
                                            {index + 1}
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
                                    <div className="flex items-center gap-1.5 self-end md:self-center">
                                        <button
                                            onClick={() => handleOpenEditModal(facility)}
                                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-all"
                                            title="Tesis Bilgilerini Düzenle"
                                        >
                                            <Edit3 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFacility(facility.id, facility.ad)}
                                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                                            title="Tesisi Sil"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => toggleCardExpanded(facility.id)}
                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                            title={isExpanded ? "Daralt" : "Genişlet"}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Row Body (Collapsible) */}
                                {isExpanded && (
                                    <div className="p-5 space-y-6">
                                        {/* Bilgi Notu & Eksiklikler Area */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                    <AlertTriangle size={13} className="text-amber-500" />
                                                    <span>Tesis Eksiklik, Arıza ve Sorun Bilgi Notu</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-slate-400 font-bold">Öncelik:</span>
                                                    <select
                                                        value={facility.oncelik || "normal"}
                                                        onChange={e => handleUpdateFacilityPriority(facility.id, e.target.value as any)}
                                                        className="h-7 px-2 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                                                    >
                                                        {PRESET_PRIORITY_OPTIONS.map(p => (
                                                            <option key={p.value} value={p.value}>{p.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <textarea
                                                defaultValue={facility.bilgiNotu || ""}
                                                onBlur={e => handleUpdateFacilityNote(facility.id, e.target.value)}
                                                rows={3}
                                                placeholder="Örn: Parke zemin su sızıntısından dolayı kabarmış ve sporcu sağlığı için risk oluşturmaktadır. Soyunma odalarında 2 adet duş bataryası arızalıdır..."
                                                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                                            />
                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                <span>* Yazılan tespitler alandan çıkıldığında otomatik kaydedilir ve rapora aktarılabilir.</span>
                                                {facility.bilgiNotu && (
                                                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                                                        <Check size={12} /> Kaydedildi
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Facility Photos Section */}
                                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon size={14} className="text-blue-500" />
                                                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                        Tesise Ait Fotoğraflar ({photoList.length})
                                                    </h5>
                                                </div>

                                                <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm shadow-blue-500/20 ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                                                    {isUploading ? (
                                                        <>
                                                            <Loader2 size={13} className="animate-spin" />
                                                            <span>Yükleniyor...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus size={13} />
                                                            <span>Fotoğraf Ekle</span>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={e => handleUploadFacilityPhoto(facility.id, e)}
                                                        disabled={isUploading}
                                                    />
                                                </label>
                                            </div>

                                            {photoList.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl gap-2 bg-slate-50/50 dark:bg-slate-950/40">
                                                    <ImageIcon size={22} className="text-slate-350 dark:text-slate-650" />
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bu tesise ait henüz fotoğraf eklenmemiş</p>
                                                    <p className="text-[10px] text-slate-400">Yukarıdaki 'Fotoğraf Ekle' butonu ile saha veya kusur görsellerini yükleyebilirsiniz.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                                                    {photoList.map((url, pIdx) => {
                                                        const safeUrl = getSafeImageUrl(url);
                                                        const caption = facility.photoDescriptions?.[url] || "";

                                                        return (
                                                            <div
                                                                key={`${url}_${pIdx}`}
                                                                className="group flex flex-col bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all"
                                                            >
                                                                <div className="relative aspect-video sm:aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                                                                    <img
                                                                        src={safeUrl}
                                                                        alt={`${facility.ad} - Görsel ${pIdx + 1}`}
                                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                                        onClick={() => setLightboxPhoto({ url: safeUrl, title: `${facility.ad} (${pIdx + 1}/${photoList.length})` })}
                                                                        onError={(e) => {
                                                                            const target = e.currentTarget;
                                                                            if (!target.dataset.triedLocal && !target.src.includes("127.0.0.1:8000")) {
                                                                                target.dataset.triedLocal = "true";
                                                                                try {
                                                                                    const urlObj = new URL(target.src);
                                                                                    target.src = `http://127.0.0.1:8000${urlObj.pathname}`;
                                                                                } catch {}
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-xs p-1 rounded-lg">
                                                                        <button
                                                                            onClick={() => setLightboxPhoto({ url: safeUrl, title: `${facility.ad} (${pIdx + 1}/${photoList.length})` })}
                                                                            className="p-1 text-white hover:text-blue-300 rounded transition-colors"
                                                                            title="Büyük Görüntüle"
                                                                        >
                                                                            <ZoomIn size={13} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteFacilityPhoto(facility.id, pIdx)}
                                                                            className="p-1 text-white hover:text-rose-400 rounded transition-colors"
                                                                            title="Fotoğrafı Sil"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">
                                                                        #{pIdx + 1}
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                                                                    <input
                                                                        type="text"
                                                                        defaultValue={caption}
                                                                        onBlur={e => handleUpdatePhotoCaption(facility.id, url, e.target.value)}
                                                                        placeholder="Fotoğraf notu ekle (örn: Zemin çatlağı)..."
                                                                        className="w-full px-2 py-1 text-[11px] rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:border-blue-500 bg-transparent text-slate-700 dark:text-slate-300 outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Facility Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                    <Building2 size={18} />
                                </div>
                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                                    {editingFacilityId ? "Tesis Bilgilerini Düzenle" : "Yeni Tesis Denetim Kaydı Ekle"}
                                </h4>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
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

                            <div>
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                    Eksiklik, Sorun veya Arıza Notu (İlk Tespit)
                                </label>
                                <textarea
                                    value={formData.bilgiNotu || ""}
                                    onChange={e => setFormData(prev => ({ ...prev, bilgiNotu: e.target.value }))}
                                    rows={3}
                                    placeholder="Tesisle ilgili gözlemlenen eksiklik ve durum notları..."
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                    className="h-9.5 px-4 rounded-xl text-xs font-bold"
                                >
                                    İptal
                                </Button>
                                <Button
                                    type="submit"
                                    className="h-9.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                                >
                                    {editingFacilityId ? "Güncelle" : "Tesisi Kaydet"}
                                </Button>
                            </div>
                        </form>
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
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (!target.dataset.triedLocal && !target.src.includes("127.0.0.1:8000")) {
                                        target.dataset.triedLocal = "true";
                                        try {
                                            const urlObj = new URL(target.src);
                                            target.src = `http://127.0.0.1:8000${urlObj.pathname}`;
                                        } catch {
                                            const clean = lightboxPhoto.url.replace(/^https?:\/\/[^/]+/, "");
                                            target.src = `http://127.0.0.1:8000${clean.startsWith('/') ? clean : '/' + clean}`;
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
