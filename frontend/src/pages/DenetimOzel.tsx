import { useState, useEffect, useCallback, useMemo } from "react";
import { sanitizeHtml } from "../lib/sanitize";
import { useNavigate } from "react-router-dom";
import {
    BookOpen, ClipboardCheck, Bot, Plus, Edit2, Trash2, Search,
    Tag, ChevronRight, X, Check, Loader2, Database, Sparkles, FileText,
    ArrowRight, Info, AlertCircle, Save, ExternalLink, Play, ArrowLeft
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { API_URL } from "../lib/config";
import { toast } from "react-hot-toast";
import { fetchWithTimeout, getAuthHeaders } from "../lib/api/utils";
import { useConfirm } from "../lib/context/ConfirmContext";
import { useAuth } from "../lib/hooks/useAuth";
import { useGlobalData } from "../lib/context/GlobalDataContext";
import { createAudit, updateAudit, deleteAudit, fetchAuditById } from "../lib/api/audit";
import { updateTask } from "../lib/api/tasks";

interface KnowledgeItem {
    id: string;
    category: string;
    topic: string;
    description: string;
    standard_remark: string;
    tags: string[];
    created_at: string;
    updated_at?: string;
}

import { AUDIT_TEMPLATES } from "../lib/auditTemplates";

const PRESET_CATEGORIES = [
    "Yurt İşlemleri", "Spor Tesisi", "Federasyon", "Denetim Genel",
    "İdari İşlemler", "Mali İşlemler", "Teknik Kontrol", "Diğer"
];

const emptyForm = {
    category: "",
    topic: "",
    description: "",
    standard_remark: "",
    tags: [] as string[],
};



function stripHtml(html: string): string {
    if (!html) return "";
    let text = html
        .replace(/<\/p>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]*>/g, "");
    
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');
    
    return text.trim().replace(/\n{3,}/g, "\n\n");
}

export default function DenetimOzel() {
    const confirm = useConfirm();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { data: cachedData, refreshAudits, refreshTasks } = useGlobalData();

    // 1. Sidebar / Category Navigation
    const activeTab = "ozel" as string;
    const setActiveTab = (tab: string) => {
        if (tab !== "ozel") {
            navigate(`/denetim/${tab}`);
        }
    };

    // 2. Active Task / Selection States
    const queryParams = new URLSearchParams(window.location.search);
    const initialTaskId = queryParams.get("task_id");
    const [selectedTaskId, setSelectedTaskIdState] = useState<string | null>(initialTaskId);

    const setSelectedTaskId = useCallback((id: string | null) => {
        setSelectedTaskIdState(id);
        if (id) {
            navigate(`/denetim/${activeTab}?task_id=${id}`, { replace: true });
        } else {
            navigate(`/denetim/${activeTab}`, { replace: true });
        }
    }, [navigate, activeTab]);

    // 3. AI Knowledge base states (CRUD)
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [knowledgeSearch, setKnowledgeSearch] = useState("");
    const [knowledgeCategoryFilter, setKnowledgeCategoryFilter] = useState<string | null>(null);
    const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
    const [editingKnowledgeItem, setEditingKnowledgeItem] = useState<KnowledgeItem | null>(null);
    const [knowledgeSaving, setKnowledgeSaving] = useState(false);
    const [knowledgeTagInput, setKnowledgeTagInput] = useState("");
    const [knowledgeForm, setKnowledgeForm] = useState({ ...emptyForm });

    // 4. Integrated Report Editor States
    const [reportEditing, setReportEditing] = useState(false);
    const [reportContent, setReportContent] = useState("");
    const [reportSaving, setReportSaving] = useState(false);
    const [showReportSelectModal, setShowReportSelectModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [isSendingToEditor, setIsSendingToEditor] = useState(false);

    // 5. Tenkit Bank search inside Report view
    const [tenkitSearch, setTenkitSearch] = useState("");
    const [tenkitResults, setTenkitResults] = useState<KnowledgeItem[]>([]);

    // 6. Detailed Tab States
    const [activeDetailTab, setActiveDetailTab] = useState<"info" | "notes" | "photos" | "checklist" | "editor">("info");
    const [localAuditData, setLocalAuditData] = useState<any>({
        info: {},
        generalNotes: "",
        photos: [],
        photo_descriptions: {},
        form: {}
    });
    const [activeQuestionForTenkit, setActiveQuestionForTenkit] = useState<string | null>(null);
    const [isSavingAuditData, setIsSavingAuditData] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [checklistAreaFilter, setChecklistAreaFilter] = useState<string>("");
    const [checklistSearch, setChecklistSearch] = useState<string>( "");
    const [checklistStatusFilter, setChecklistStatusFilter] = useState<string>("");

    // 7. Audit Prep Modal States
    const [prepAuditName, setPrepAuditName] = useState("");
    const [isCreatingReport, setIsCreatingReport] = useState(false);

    // 8. Task Picker Modal (for starting audit from page-level button)
    const [showTaskPicker, setShowTaskPicker] = useState(false);
    const [pickerTaskForAudit, setPickerTaskForAudit] = useState<any>(null);



    const categoryMap: Record<string, string> = {
        il: "İl Denetimi",
        federasyon: "Federasyon Denetimi",
        kyk: "Kyk Yurt Denetimi",
        ozel: "Özel Yurt Denetimi",
        spor: "Spor Kulüpleri Denetimi"
    };

    // Reverse lookup: rapor_turu -> tab id
    const reverseCategoryMap: Record<string, string> = Object.fromEntries(
        Object.entries(categoryMap).map(([k, v]) => [v, k])
    );

    const currentRaporTuru = categoryMap[activeTab];

    const userKeys = useMemo(() => {
        const uid = (user?.uid || "").trim();
        const email = (user?.email || "").toLowerCase().trim();
        return [uid, email].filter(Boolean);
    }, [user?.uid, user?.email]);

    const accessibleTasks = useMemo(() => {
        if (!cachedData?.tasks) return [];
        return cachedData.tasks.filter((t: any) => {
            const ownerId = (t.owner_id || "").toLowerCase().trim();
            const accepted = (t.accepted_collaborators || []).map((v: string) => String(v || "").toLowerCase().trim());
            const assigned = (t.assigned_to || []).map((v: string) => String(v || "").toLowerCase().trim());
            const shared = (t.shared_with || []).map((v: string) => String(v || "").toLowerCase().trim());

            return userKeys.some(k => {
                const key = String(k).toLowerCase().trim();
                return ownerId === key || accepted.includes(key) || assigned.includes(key) || shared.includes(key);
            });
        });
    }, [cachedData?.tasks, userKeys]);

    const pickerTasks = useMemo(() => {
        if (!accessibleTasks.length || !currentRaporTuru) return [];
        return accessibleTasks.filter((task: any) => task.rapor_turu === currentRaporTuru);
    }, [accessibleTasks, currentRaporTuru]);

    // Get tasks from global context
    const filteredTasks = useMemo(() => {
        if (!accessibleTasks.length || !currentRaporTuru) return [];
        return accessibleTasks.filter((t: any) => t.rapor_turu === currentRaporTuru);
    }, [accessibleTasks, currentRaporTuru]);

    // Selected Task Details
    const selectedTask = useMemo(() => {
        if (!selectedTaskId || !cachedData?.tasks) return null;
        return cachedData.tasks.find(t => t.id === selectedTaskId) || null;
    }, [selectedTaskId, cachedData?.tasks]);

    // Resolve the correct tab ID for the selected task (may differ from activeTab)
    const taskTabId = useMemo(() => {
        if (!selectedTask) return activeTab;
        return reverseCategoryMap[selectedTask.rapor_turu] || activeTab;
    }, [selectedTask, activeTab, reverseCategoryMap]);

    // Questions answered by the user for preview modal
    const previewQuestions = useMemo(() => {
        const questions = AUDIT_TEMPLATES[taskTabId] || AUDIT_TEMPLATES[activeTab] || [];
        const form = localAuditData.form || {};
        return questions.filter((q: any) => form[q.id] === "yes" || form[q.id] === "no");
    }, [taskTabId, activeTab, localAuditData.form]);

    const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

    // Audit (Report) for selected task
    const selectedReport = useMemo(() => {
        if (!selectedTaskId || !cachedData?.audits) return null;
        if (selectedAuditId) {
            const match = cachedData.audits.find((a: any) => a.id === selectedAuditId && a.task_id === selectedTaskId);
            if (match) return match;
        }
        return cachedData.audits.find(a => a.task_id === selectedTaskId) || null;
    }, [selectedTaskId, selectedAuditId, cachedData?.audits]);

    // Keep selectedAuditId in sync when selectedTaskId or audits list changes
    useEffect(() => {
        if (!selectedTaskId) {
            setSelectedAuditId(null);
            return;
        }
        const taskAudits = (cachedData?.audits || []).filter((a: any) => a.task_id === selectedTaskId);
        if (taskAudits.length > 0) {
            const exists = taskAudits.some((a: any) => a.id === selectedAuditId);
            if (!exists) {
                setSelectedAuditId(taskAudits[0].id);
            }
        } else {
            setSelectedAuditId(null);
        }
    }, [selectedTaskId, cachedData?.audits, selectedAuditId]);

    // Child Kyk Yurt Denetimleri (if selected is İl Denetimi)
    const childKykTasks = useMemo(() => {
        if (!selectedTaskId || activeTab !== "il" || !cachedData?.tasks) return [];
        return cachedData.tasks.filter(t => t.rapor_turu === "Kyk Yurt Denetimi" && t.parent_task_id === selectedTaskId);
    }, [selectedTaskId, activeTab, cachedData?.tasks]);

    // Parent İl Denetimi (if selected is Kyk Yurt Denetimi)
    const parentIlTask = useMemo(() => {
        if (!selectedTask || activeTab !== "kyk" || !selectedTask.parent_task_id || !cachedData?.tasks) return null;
        return cachedData.tasks.find(t => t.id === selectedTask.parent_task_id) || null;
    }, [selectedTask, activeTab, cachedData?.tasks]);

    // Reset report states when report changes
    useEffect(() => {
        if (selectedReport) {
            fetchAuditById(selectedReport.id)
                .then(fullAudit => {
                    if (fullAudit) {
                        setReportContent(fullAudit.report_content || "");
                    }
                })
                .catch(err => {
                    console.error("Error fetching full audit details:", err);
                    setReportContent(selectedReport.report_content || "");
                });

            const ad = selectedReport.audit_data || {};
            setLocalAuditData({
                info: ad.info || {},
                generalNotes: ad.generalNotes || "",
                photos: ad.photos || [],
                photo_descriptions: ad.photo_descriptions || {},
                form: ad.form || {}
            });
        } else {
            setReportContent("");
            setLocalAuditData({
                info: {},
                generalNotes: "",
                photos: [],
                photo_descriptions: {},
                form: {}
            });
        }
        setReportEditing(false);
    }, [selectedReport?.id]);

    const handleSaveAuditData = async (updatedData = localAuditData) => {
        if (!selectedReport) return;
        setIsSavingAuditData(true);
        try {
            await updateAudit(selectedReport.id, {
                audit_data: updatedData
            });
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch {
            toast.error("Denetim verileri kaydedilemedi.");
        } finally {
            setIsSavingAuditData(false);
        }
    };

    const handleDeleteReport = async () => {
        if (!selectedReport) return;
        
        const confirmed = await confirm({
            title: "Denetim Formunu Sıfırla / Sil",
            message: "Bu göreve ait doldurulmuş tüm kontrol listesini, notları, fotoğrafları ve oluşturulmuş rapor taslağını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
            confirmText: "Evet, Tamamen Sil",
            cancelText: "İptal",
            variant: "danger"
        });
        
        if (!confirmed) return;
        
        setIsSavingAuditData(true);
        try {
            await deleteAudit(selectedReport.id);
            if (selectedTask) {
                await updateTask(selectedTask.id, {
                    rapor_durumu: "Beklemede"
                });
            }
            toast.success("Denetim formu ve tüm verileri başarıyla silindi.");
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
                await refreshTasks(user.uid);
            }
            // Go back to the dashboard/info tab
            setActiveDetailTab("info");
        } catch (error) {
            console.error("Error deleting audit:", error);
            toast.error("Denetim formu silinirken bir hata oluştu.");
        } finally {
            setIsSavingAuditData(false);
        }
    };

    const handleInfoChange = (key: string, value: string) => {
        setLocalAuditData((prev: any) => {
            const next = {
                ...prev,
                info: {
                    ...(prev.info || {}),
                    [key]: value
                }
            };
            return next;
        });
    };

    const handlePhotoDescriptionChange = (url: string, description: string) => {
        setLocalAuditData((prev: any) => {
            const next = {
                ...prev,
                photo_descriptions: {
                    ...(prev.photo_descriptions || {}),
                    [url]: description
                }
            };
            return next;
        });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !selectedReport) return;
        const file = e.target.files[0];
        
        setUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            
            let url = `${API_URL}/files/upload`;
            const params = new URLSearchParams();
            params.append("path", `denetim_fotograflari/${selectedReport.id}`);
            if (user?.uid) params.append("uid", user.uid);
            url += `?${params.toString()}`;
            
            const authHeaders = await getAuthHeaders();
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    ...authHeaders
                },
                body: formData
            });
            
            if (!res.ok) {
                throw new Error("Fotoğraf yüklenemedi");
            }
            
            const data = await res.json();
            const newPhotoUrl = data.url;
            
            const updatedPhotos = [...(localAuditData.photos || []), newPhotoUrl];
            const updatedData = {
                ...localAuditData,
                photos: updatedPhotos
            };
            setLocalAuditData(updatedData);
            await handleSaveAuditData(updatedData);
            toast.success("Fotoğraf yüklendi.");
        } catch (error) {
            console.error("Photo upload error:", error);
            toast.error("Fotoğraf yüklenirken bir hata oluştu.");
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleDeletePhoto = async (index: number) => {
        const confirmed = await confirm({
            title: "Fotoğrafı Kaldır",
            message: "Bu fotoğrafı denetim dosyasından kaldırmak istediğinize emin misiniz?",
            confirmText: "Kaldır",
            variant: "danger"
        });
        if (!confirmed) return;
        
        const deletedPhotoUrl = (localAuditData.photos || [])[index];
        const updatedPhotos = (localAuditData.photos || []).filter((_: any, idx: number) => idx !== index);
        const updatedDescriptions = { ...(localAuditData.photo_descriptions || {}) };
        if (deletedPhotoUrl) {
            delete updatedDescriptions[deletedPhotoUrl];
        }
        
        const updatedData = {
            ...localAuditData,
            photos: updatedPhotos,
            photo_descriptions: updatedDescriptions
        };
        setLocalAuditData(updatedData);
        await handleSaveAuditData(updatedData);
        toast.success("Fotoğraf kaldırıldı.");
    };

    const handleChecklistAnswer = (questionId: string, answer: "yes" | "no") => {
        setLocalAuditData((prev: any) => {
            const next = {
                ...prev,
                form: {
                    ...(prev.form || {}),
                    [questionId]: answer
                }
            };
            if (answer === "yes" && activeQuestionForTenkit === questionId) {
                setActiveQuestionForTenkit(null);
            }
            handleSaveAuditData(next);
            return next;
        });
    };

    const handleChecklistNoteChange = (questionId: string, note: string) => {
        setLocalAuditData((prev: any) => {
            const next = {
                ...prev,
                form: {
                    ...(prev.form || {}),
                    [`inspector_note_${questionId}`]: note
                }
            };
            return next;
        });
    };

    const handleAppendTenkitToNote = async (item: KnowledgeItem) => {
        if (!activeQuestionForTenkit) {
            toast.error("Önce bir sorunun 'Tenkit Bankasından Ekle' butonuna tıklamalısınız.");
            return;
        }
        
        const questionId = activeQuestionForTenkit;
        const currentNote = localAuditData.form?.[`inspector_note_${questionId}`] || "";
        const cleanRemark = stripHtml(item.standard_remark);
        const appendedNote = currentNote 
            ? `${currentNote}\n\n[Bulgu: ${item.topic}] - ${cleanRemark}`
            : `[Bulgu: ${item.topic}] - ${cleanRemark}`;
            
        setLocalAuditData((prev: any) => {
            const next = {
                ...prev,
                form: {
                    ...(prev.form || {}),
                    [`inspector_note_${questionId}`]: appendedNote
                }
            };
            handleSaveAuditData(next);
            return next;
        });
        
        // Also append to the main report HTML content
        if (selectedReport) {
            const formattedRemark = `<p><strong>Bulgu: ${item.topic}</strong><br/>${item.standard_remark}</p>`;
            const updatedContent = (reportContent || "") + formattedRemark;
            setReportContent(updatedContent);
            try {
                await updateAudit(selectedReport.id, {
                    report_content: updatedContent
                });
                if (user?.uid) {
                    await refreshAudits(user.uid, user.email || undefined);
                }
            } catch (error) {
                console.error("Report sync error:", error);
            }
        }
        
        toast.success(`"${item.topic}" müfettiş notuna ve rapora eklendi.`);
        setActiveQuestionForTenkit(null);
    };

    const renderInfoTab = () => {
        const info = localAuditData.info || {};
        const fields: Record<string, { label: string, key: string, type: string, placeholder?: string }[]> = {
            il: [
                { label: "İl Müdürü Adı Soyadı", key: "directorName", type: "text", placeholder: "Örn: Ahmet Yılmaz" },
                { label: "Personel Sayısı", key: "staffCount", type: "number", placeholder: "Örn: 45" },
                { label: "Tesis Sayısı", key: "facilityCount", type: "number", placeholder: "Örn: 12" },
                { label: "Toplam Öğrenci Kapasitesi", key: "capacity", type: "number", placeholder: "Örn: 1500" },
                { label: "Yıllık Bütçe (TL)", key: "budget", type: "text", placeholder: "Örn: 5.000.000" }
            ],
            federasyon: [
                { label: "Federasyon Başkanı", key: "presidentName", type: "text", placeholder: "Örn: Mehmet Demir" },
                { label: "Personel Sayısı", key: "staffCount", type: "number", placeholder: "Örn: 20" },
                { label: "Bağlı Kulüp Sayısı", key: "clubCount", type: "number", placeholder: "Örn: 150" },
                { label: "Lisanslı Sporcu Sayısı", key: "athleteCount", type: "number", placeholder: "Örn: 12000" },
                { label: "Yıllık Bütçe (TL)", key: "budget", type: "text", placeholder: "Örn: 25.000.000" }
            ],
            kyk: [
                { label: "Yurt Müdürü Adı Soyadı", key: "directorName", type: "text", placeholder: "Örn: Mustafa Kaya" },
                { label: "Yurt Kapasitesi", key: "capacity", type: "number", placeholder: "Örn: 800" },
                { label: "Barınan Öğrenci Sayısı", key: "studentCount", type: "number", placeholder: "Örn: 760" },
                { label: "Personel Sayısı", key: "staffCount", type: "number", placeholder: "Örn: 30" },
                { label: "Toplam Oda Sayısı", key: "roomCount", type: "number", placeholder: "Örn: 200" }
            ],
            ozel: [
                { label: "Yurt Müdürü / Kurucu", key: "directorName", type: "text", placeholder: "Örn: Ali Şahin" },
                { label: "Öğrenci Kapasitesi", key: "capacity", type: "number", placeholder: "Örn: 120" },
                { label: "Barınan Öğrenci Sayısı", key: "studentCount", type: "number", placeholder: "Örn: 95" },
                { label: "Çalışan Personel Sayısı", key: "staffCount", type: "number", placeholder: "Örn: 10" },
                { label: "Ruhsat / İzin Tarihi", key: "permitDate", type: "text", placeholder: "Örn: 12.04.2021" }
            ],
            spor: [
                { label: "Kulüp Başkanı", key: "presidentName", type: "text", placeholder: "Örn: Selim Yıldız" },
                { label: "Kuruluş Yılı", key: "foundationYear", type: "number", placeholder: "Örn: 1998" },
                { label: "Aktif Branş Sayısı", key: "branchCount", type: "number", placeholder: "Örn: 5" },
                { label: "Lisanslı Sporcu Sayısı", key: "athleteCount", type: "number", placeholder: "Örn: 350" },
                { label: "Antrenör/Personel Sayısı", key: "staffCount", type: "number", placeholder: "Örn: 8" }
            ]
        };

        const activeFields = fields[taskTabId] || [];

        return (
            <div className="space-y-5 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                        {categoryMap[taskTabId] || categoryMap[activeTab]} Genel Bilgileri
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Denetime esas teşkil edecek temel kurumsal veriler</p>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800/60" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeFields.map(f => (
                        <div key={f.key} className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                {f.label}
                            </label>
                            <input
                                type={f.type}
                                value={info[f.key] || ""}
                                onChange={e => handleInfoChange(f.key, e.target.value)}
                                onBlur={() => handleSaveAuditData(localAuditData)}
                                placeholder={f.placeholder}
                                className="h-10 px-3.5 rounded-xl border border-slate-250 dark:border-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-all"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={() => handleSaveAuditData(localAuditData)} disabled={isSavingAuditData} className="rounded-xl h-10 px-6 shadow-md shadow-primary/20">
                        {isSavingAuditData ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                        Kaydet
                    </Button>
                </div>
            </div>
        );
    };

    const renderNotesTab = () => {
        return (
            <div className="space-y-5 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex-1 flex flex-col min-h-[350px]">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                        Genel Müfettiş Notları
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Denetim esnasında alınan genel kararlar, tespitler ve notlar</p>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-800/60" />
                <textarea
                    value={localAuditData.generalNotes || ""}
                    onChange={e => {
                        const val = e.target.value;
                        setLocalAuditData((prev: any) => ({ ...prev, generalNotes: val }));
                    }}
                    onBlur={() => handleSaveAuditData(localAuditData)}
                    placeholder="Müfettiş notlarını buraya serbest biçimde yazabilirsiniz..."
                    className="flex-1 w-full p-4 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white resize-none leading-relaxed min-h-[200px]"
                />
                <div className="flex justify-end">
                    <Button onClick={() => handleSaveAuditData(localAuditData)} disabled={isSavingAuditData} className="rounded-xl h-10 px-6 shadow-md shadow-primary/20">
                        {isSavingAuditData ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                        Kaydet
                    </Button>
                </div>
            </div>
        );
    };

    const renderPhotosTab = () => {
        const photos = localAuditData.photos || [];
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-200">
                            Fotoğraf Galerisi
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Denetime ait görsel ve belgeler</p>
                    </div>
                    <div>
                        <label className={`flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 shadow-md shadow-blue-500/20 ${uploadingPhoto ? "opacity-50 pointer-events-none" : ""}`}>
                            {uploadingPhoto ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Yükleniyor...</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={14} />
                                    <span>Fotoğraf Ekle</span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoUpload}
                                disabled={uploadingPhoto}
                            />
                        </label>
                    </div>
                </div>

                <div className="h-px bg-slate-105 dark:bg-slate-800/50" />

                {photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl gap-3">
                        <AlertCircle size={20} className="text-slate-400" />
                        <p className="text-xs font-bold text-slate-400 uppercase">Görsel Bulunmamaktadır</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photos.map((url: string, index: number) => (
                            <div
                                key={index}
                                className="group flex flex-col bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow transition-all"
                            >
                                <div className="relative aspect-video sm:aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                    <img
                                        src={`${API_URL.replace("/api", "")}${url}`}
                                        alt={`Denetim Görseli ${index + 1}`}
                                        className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                                        onClick={() => {
                                            const overlay = document.createElement('div');
                                            overlay.id = `photo-modal-${index}`;
                                            overlay.className = 'fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200';
                                            overlay.addEventListener('click', () => overlay.remove());
                                            const img = document.createElement('img');
                                            img.src = `${API_URL.replace("/api", "")}${url}`;
                                            img.className = 'max-w-full max-h-full rounded-lg object-contain shadow-2xl';
                                            overlay.appendChild(img);
                                            document.body.appendChild(overlay);
                                        }}
                                    />
                                    <button
                                        onClick={() => handleDeletePhoto(index)}
                                        className="absolute top-2 right-2 w-7 h-7 bg-black/75 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shadow"
                                        title="Görseli Kaldır"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="p-2 bg-white dark:bg-slate-900">
                                    <input
                                        type="text"
                                        value={localAuditData.photo_descriptions?.[url] || ""}
                                        onChange={e => handlePhotoDescriptionChange(url, e.target.value)}
                                        onBlur={() => handleSaveAuditData(localAuditData)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                        placeholder="Görsel açıklaması ekleyin..."
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderChecklistTab = () => {
        const questions = AUDIT_TEMPLATES[taskTabId] || [];
        const areas = [...new Set(questions.map(q => q.area))];
        const form = localAuditData.form || {};

        const filteredQuestions = questions.filter(q => {
            const matchesSearch = !checklistSearch || q.text.toLowerCase().includes(checklistSearch.toLowerCase());
            const matchesArea = !checklistAreaFilter || q.area === checklistAreaFilter;
            
            const answer = form[q.id];
            let matchesStatus = true;
            if (checklistStatusFilter === "answered") {
                matchesStatus = !!answer;
            } else if (checklistStatusFilter === "unanswered") {
                matchesStatus = !answer;
            } else if (checklistStatusFilter === "yes") {
                matchesStatus = answer === "yes";
            } else if (checklistStatusFilter === "no") {
                matchesStatus = answer === "no";
            }
            
            return matchesSearch && matchesArea && matchesStatus;
        });

        return (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 overflow-hidden h-full">
                <div className={`flex flex-col gap-4 overflow-hidden h-full ${activeQuestionForTenkit ? "xl:col-span-7" : "xl:col-span-12"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-955 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={checklistSearch}
                                onChange={e => setChecklistSearch(e.target.value)}
                                placeholder="Kontrol listesinde arama yapın..."
                                className="w-full pl-9 pr-3.5 h-9.5 rounded-xl border border-slate-250 dark:border-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={checklistStatusFilter}
                                onChange={e => setChecklistStatusFilter(e.target.value)}
                                className="h-9.5 px-3 rounded-xl border border-slate-250 dark:border-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Tüm Sorular</option>
                                <option value="answered">Cevaplananlar</option>
                                <option value="unanswered">Cevaplanmayanlar</option>
                                <option value="yes">Evet (Uygun)</option>
                                <option value="no">Hayır (Aykırı)</option>
                            </select>
                            <select
                                value={checklistAreaFilter}
                                onChange={e => setChecklistAreaFilter(e.target.value)}
                                className="h-9.5 px-3 rounded-xl border border-slate-250 dark:border-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Tüm Alanlar</option>
                                {areas.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <Button onClick={() => handleSaveAuditData(localAuditData)} disabled={isSavingAuditData} size="sm" className="rounded-xl h-9.5 px-4">
                                {isSavingAuditData ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="mr-1" />}
                                Kaydet
                            </Button>
                            <Button onClick={handleSendToEditorClick} disabled={isSavingAuditData || isSendingToEditor} size="sm" className="rounded-xl h-9.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-md shadow-emerald-500/20">
                                {isSendingToEditor ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                Editöre Gönder
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {filteredQuestions.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-slate-50/20 dark:bg-slate-955/5">
                                <AlertCircle size={20} className="mx-auto text-slate-400 mb-2" />
                                <p className="text-xs font-bold text-slate-400 uppercase">Aramaya Uygun Madde Bulunamadı</p>
                            </div>
                        ) : (
                            filteredQuestions.map(q => {
                                const answer = form[q.id];
                                const note = form[`inspector_note_${q.id}`] || "";
                                
                                return (
                                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-955/20 hover:border-slate-300 dark:hover:border-slate-700/50 transition-colors flex flex-col gap-3.5 shadow-sm">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <span className="inline-block text-[9px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-955/30 px-2 py-0.5 rounded-lg border border-blue-100/30 dark:border-blue-900/10">
                                                    {q.area}
                                                </span>
                                                <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">{q.text}</h5>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    onClick={() => handleChecklistAnswer(q.id, "yes")}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                        answer === "yes"
                                                            ? "bg-green-600 border-green-600 text-white shadow-sm"
                                                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                                    }`}
                                                >
                                                    Evet, Uygun
                                                </button>
                                                <button
                                                    onClick={() => handleChecklistAnswer(q.id, "no")}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                        answer === "no"
                                                            ? "bg-red-600 border-red-600 text-white shadow-sm"
                                                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                                    }`}
                                                >
                                                    Hayır, Aykırı
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-100 dark:border-slate-900">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                    Müfettiş Tespit ve Notları
                                                </label>
                                                {answer === "no" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500 hover:text-white rounded-lg flex items-center gap-1 shadow-sm transition-all"
                                                        onClick={() => {
                                                            setActiveQuestionForTenkit(q.id);
                                                            setTimeout(() => {
                                                                const searchInput = document.getElementById("ai-tenkit-search-input");
                                                                if (searchInput) searchInput.focus();
                                                            }, 100);
                                                        }}
                                                    >
                                                        <Bot size={11} />
                                                        <span>Tenkit Bankasından Ekle</span>
                                                    </Button>
                                                )}
                                            </div>
                                            <textarea
                                                value={note}
                                                onChange={e => handleChecklistNoteChange(q.id, e.target.value)}
                                                onBlur={() => handleSaveAuditData(localAuditData)}
                                                placeholder="Bu soruyla ilgili eksiklik, mevzuat ihlali veya tespit notlarını yazın..."
                                                rows={2}
                                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500/10 resize-none leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                {activeQuestionForTenkit && (
                    <div className="xl:col-span-5 flex flex-col max-h-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 relative">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Bot size={12} className="text-blue-500 animate-pulse" />
                                <span>AI Tenkit Bankası</span>
                            </h4>
                            <button onClick={() => setActiveQuestionForTenkit(null)} className="w-6 h-6 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500">
                                <X size={12} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {renderTenkitBank("checklist")}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderTenkitBank = (mode: "editor" | "checklist") => {
        return (
            <div className="flex flex-col gap-3 bg-slate-50/40 dark:bg-slate-955/10 border border-slate-100 dark:border-slate-800/40 p-4 rounded-xl max-h-[450px] xl:max-h-full overflow-y-auto h-full">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Sparkles size={12} className="text-blue-500" />
                        <span>AI Tenkit Bankası</span>
                    </h4>
                    <span className="text-[9px] font-bold text-slate-400">{tenkitResults.length} Tenkit</span>
                </div>

                <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        id="ai-tenkit-search-input"
                        value={tenkitSearch}
                        onChange={e => setTenkitSearch(e.target.value)}
                        placeholder="Tenkit maddelerinde arama..."
                        className="w-full pl-8 pr-3 h-8.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-950/20 text-slate-800 dark:text-white"
                    />
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800/50" />

                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                    {tenkitResults.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-4 font-bold">Sonuç bulunamadı.</p>
                    ) : (
                        tenkitResults.map(item => (
                            <div
                                key={item.id}
                                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3 rounded-lg flex flex-col gap-2 hover:border-blue-500/50 transition-colors"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <span className="inline-block text-[8px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-955/30 px-1.5 py-0.5 rounded mb-1">
                                            {item.category}
                                        </span>
                                        <h5 className="text-[11px] font-black text-slate-850 dark:text-slate-200 leading-tight truncate">{item.topic}</h5>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg text-[9px] h-7 bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all flex-shrink-0"
                                        onClick={() => mode === "editor" ? handleAppendTenkit(item) : handleAppendTenkitToNote(item)}
                                    >
                                        {mode === "editor" ? "Rapora Ekle" : "Nota Ekle"}
                                    </Button>
                                </div>
                                <div className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 bg-slate-50 dark:bg-slate-955/5 p-2 rounded font-medium border border-slate-100 dark:border-slate-800/20" dangerouslySetInnerHTML={{ __html: item.standard_remark }} />
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    // Load AI Knowledge Base Items
    const loadKnowledgeItems = useCallback(async () => {
        setKnowledgeLoading(true);
        const storageKey = `mufyard_knowledge_cache`;
        try {
            const url = knowledgeCategoryFilter
                ? `${API_URL}/ai-knowledge/?category=${encodeURIComponent(knowledgeCategoryFilter)}`
                : `${API_URL}/ai-knowledge/`;
            const headers = await getAuthHeaders();
            const res = await fetchWithTimeout(url, { headers });
            const data = await res.json();
            setKnowledgeItems(data);
            setTenkitResults(data);
            
            // Cache data in localStorage (only if category filter is empty to cache everything)
            if (!knowledgeCategoryFilter) {
                localStorage.setItem(storageKey, JSON.stringify(data));
            }
        } catch (err) {
            console.warn("Network error fetching knowledge items, loading from cache:", err);
            
            // Attempt persistent cache fallback
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setKnowledgeItems(parsed);
                    setTenkitResults(parsed);
                    return; // Exit silently
                } catch (e) {
                    console.error("Cache parse error:", e);
                }
            }
            
            if (activeTab === "bilgi_bankasi") {
                toast.error("Bilgi bankası yüklenemedi.");
            }
        } finally {
            setKnowledgeLoading(false);
        }
    }, [knowledgeCategoryFilter, activeTab]);

    useEffect(() => {
        loadKnowledgeItems();
    }, [loadKnowledgeItems]);

    // Search Tenkit Bank internally for current report
    useEffect(() => {
        if (!tenkitSearch.trim()) {
            setTenkitResults(knowledgeItems);
            return;
        }
        const filtered = knowledgeItems.filter(item =>
            item.topic.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.description.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.standard_remark.toLowerCase().includes(tenkitSearch.toLowerCase()) ||
            item.category.toLowerCase().includes(tenkitSearch.toLowerCase())
        );
        setTenkitResults(filtered);
    }, [tenkitSearch, knowledgeItems]);

    // Knowledge CRUD functions
    const resetKnowledgeForm = () => {
        setKnowledgeForm({ ...emptyForm });
        setEditingKnowledgeItem(null);
        setKnowledgeTagInput("");
    };

    const openAddKnowledge = () => { resetKnowledgeForm(); setShowKnowledgeModal(true); };

    const openEditKnowledge = (item: KnowledgeItem) => {
        setEditingKnowledgeItem(item);
        setKnowledgeForm({
            category: item.category,
            topic: item.topic,
            description: item.description,
            standard_remark: item.standard_remark,
            tags: item.tags || [],
        });
        setShowKnowledgeModal(true);
    };

    const handleSaveKnowledge = async () => {
        if (!knowledgeForm.category || !knowledgeForm.topic || !knowledgeForm.standard_remark) {
            toast.error("Kategori, konu ve tenkit metni zorunludur.");
            return;
        }
        setKnowledgeSaving(true);
        try {
            if (editingKnowledgeItem) {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/${editingKnowledgeItem.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(knowledgeForm),
                });
                toast.success("Güncellendi.");
            } else {
                const headers = await getAuthHeaders({ "Content-Type": "application/json" });
                await fetchWithTimeout(`${API_URL}/ai-knowledge/`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(knowledgeForm),
                });
                toast.success("Tenkit maddesi eklendi.");
            }
            setShowKnowledgeModal(false);
            resetKnowledgeForm();
            loadKnowledgeItems();
        } catch {
            toast.error("Kaydedilemedi.");
        } finally {
            setKnowledgeSaving(false);
        }
    };

    const handleDeleteKnowledge = async (item: KnowledgeItem) => {
        const confirmed = await confirm({
            title: "Maddeyi Sil",
            message: `"${item.topic}" tenkit maddesini silmek istediğinize emin misiniz?`,
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        try {
            const headers = await getAuthHeaders();
            await fetchWithTimeout(`${API_URL}/ai-knowledge/${item.id}`, { method: "DELETE", headers });
            toast.success("Silindi.");
            loadKnowledgeItems();
        } catch {
            toast.error("Silinemedi.");
        }
    };

    const addKnowledgeTag = () => {
        const tag = knowledgeTagInput.trim();
        if (tag && !knowledgeForm.tags.includes(tag)) {
            setKnowledgeForm(f => ({ ...f, tags: [...f.tags, tag] }));
        }
        setKnowledgeTagInput("");
    };

    const removeKnowledgeTag = (tag: string) => {
        setKnowledgeForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
    };

    // Create Report / Start Audit
    // Accepts an optional taskOverride to support starting audits from the task picker flow
    const handleCreateReport = async (customTitle: string, taskOverride?: any) => {
        const targetTask = taskOverride || selectedTask;
        if (!targetTask) return;

        const canStartThisTask = pickerTasks.some((t: any) => t.id === targetTask.id);
        if (!canStartThisTask) {
            toast.error("Bu görev bu sekmede görünmüyor veya erişim yetkiniz yok.");
            return;
        }

        const existingDraft = (cachedData?.audits || []).find((a: any) => a.task_id === targetTask.id && a.report_created === false);
        if (existingDraft) {
            const proceed = await confirm({
                title: "Mevcut Taslak Bulundu",
                message: "Bu görev için zaten doldurulmakta olan bir taslak form bulunuyor. Yeni bir form mu eklemek istersiniz yoksa mevcut formdan devam mı etmek istersiniz?",
                confirmText: "Yeni Form Ekle",
                cancelText: "Mevcut Formu Aç",
                variant: "info"
            });
            if (!proceed) {
                setShowTaskPicker(false);
                setPickerTaskForAudit(null);
                
                // Auto-switch activeTab to match the task's category
                const targetTabId = reverseCategoryMap[targetTask.rapor_turu];
                if (targetTabId && targetTabId !== activeTab) {
                    setActiveTab(targetTabId);
                }

                // Auto-select the task in the panel
                setSelectedTaskId(targetTask.id);
                setSelectedAuditId(existingDraft.id);
                return;
            }
        }

        setIsCreatingReport(true);
        try {
            const newAuditPayload = {
                task_id: targetTask.id,
                title: customTitle,
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: profile?.full_name || user?.displayName || user?.email?.split('@')[0] || "Müfettiş",
                status: "Devam Ediyor",
                report_content: `<h1>${customTitle}</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`,
                owner_id: user?.uid,
                assigned_to: [user?.uid].filter(Boolean) as string[],
                report_seq: 1,
                report_created: false
            };
            const createdAudit = await createAudit(newAuditPayload);

            // Update Task status to "Devam Ediyor"
            try {
                await updateTask(targetTask.id, { rapor_durumu: "Devam Ediyor" });
            } catch (err) {
                console.error("Task status update error:", err);
            }

            toast.success("Denetim dosyası başarıyla oluşturuldu.");
            setShowTaskPicker(false);
            setPickerTaskForAudit(null);

            // Auto-switch activeTab to match the task's category
            const targetTabId = reverseCategoryMap[targetTask.rapor_turu];
            if (targetTabId && targetTabId !== activeTab) {
                setActiveTab(targetTabId);
            }

            // Auto-select the task in the panel
            setSelectedTaskId(targetTask.id);
            setSelectedAuditId(createdAudit.id);
            
            if (user?.uid) {
                await Promise.all([
                    refreshAudits(user.uid, user.email || undefined),
                    refreshTasks(user.uid)
                ]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Denetim başlatılamadı.");
        } finally {
            setIsCreatingReport(false);
        }
    };

    const transferFindingsToReport = async (report: any) => {
        const questions = AUDIT_TEMPLATES[activeTab] || [];
        const form = localAuditData.form || {};
        const findings: { text: string; area: string; note: string }[] = [];

        questions.forEach((q: any) => {
            const answer = form[q.id];
            const note = form[`inspector_note_${q.id}`];
            if (answer === "no") {
                findings.push({ text: q.text, area: q.area, note: note || "" });
            }
        });

        const currentRaporTuru = categoryMap[activeTab];
        let findingsHtml = `<h3><strong>BULUNAN TENKİTLER VE EKSİKLİKLER (${currentRaporTuru || "Denetim Formu"})</strong></h3>`;
        if (findings.length > 0) {
            findingsHtml += `<ul>`;
            findings.forEach(f => {
                findingsHtml += `<li><strong>Madde:</strong> ${f.text}<br/><strong>Müfettiş Notu:</strong> ${f.note || "<em>Belirtilmedi</em>"}</li>`;
            });
            findingsHtml += `</ul>`;
        } else {
            findingsHtml += `<p>Yapılan denetim neticesinde herhangi bir tenkit veya eksikliğe rastlanılmamıştır.</p>`;
        }

        let writeMode: "append" | "replace" = "replace";
        if (report.report_content && report.report_content.replace(/<[^>]*>/g, "").trim().length > 0) {
            const overwrite = await confirm({
                title: "Bulgu Aktarımı",
                message: "Seçtiğiniz raporda mevcut içerik bulunuyor. Üzerine yazmak (mevcut içeriği silmek) istiyor musunuz?",
                confirmText: "Üzerine Yaz",
                cancelText: "Sonuna Ekle",
                variant: "warning"
            });
            if (overwrite) {
                writeMode = "replace";
            } else {
                writeMode = "append";
            }
        }

        let finalContent = findingsHtml;
        if (writeMode === "append") {
            finalContent = (report.report_content || "") + "<br/>" + findingsHtml;
        }

        try {
            await updateAudit(report.id, {
                report_content: finalContent
            });
            toast.success("Bulgular başarıyla rapora aktarıldı.");
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
            navigate(`/audit/${report.id}/report`);
        } catch (error) {
            console.error(error);
            toast.error("Bulgular rapora aktarılamadı.");
        }
    };

    const handleCreateNewReportAndTransfer = async () => {
        if (!selectedTask) return;
        const newReportNo = window.prompt("Lütfen oluşturmak istediğiniz rapor numarasını girin (Örn: S.Y.2026/1):");
        if (!newReportNo) return;
        setIsSendingToEditor(true);
        try {
            const newAuditPayload = {
                task_id: selectedTask.id,
                title: newReportNo,
                location: "",
                date: new Date().toLocaleDateString("tr-TR"),
                inspector: profile?.full_name || user?.displayName || user?.email?.split('@')[0] || "Müfettiş",
                status: "Devam Ediyor",
                report_content: `<h1>${newReportNo}</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`,
                owner_id: user?.uid,
                assigned_to: [user?.uid].filter(Boolean) as string[],
                report_seq: 1,
                report_created: true
            };
            const createdAudit = await createAudit(newAuditPayload);
            try {
                await updateTask(selectedTask.id, { rapor_durumu: "Devam Ediyor" });
            } catch (err) {
                console.error("Task status update error:", err);
            }
            setShowReportSelectModal(false);
            await transferFindingsToReport(createdAudit);
        } catch (err) {
            console.error(err);
            toast.error("Rapor oluşturulamadı.");
        } finally {
            setIsSendingToEditor(false);
        }
    };

    const handleSendToEditorClick = () => {
        if (!selectedTask) {
            toast.error("Lütfen önce bir görev seçin.");
            return;
        }
        setShowPreviewModal(true);
    };

    const proceedSendToEditor = async () => {
        if (!selectedTask) {
            toast.error("Lütfen önce bir görev seçin.");
            return;
        }

        await handleSaveAuditData(localAuditData);

        const reports = (cachedData?.audits || []).filter((a: any) => a.task_id === selectedTask.id && a.report_created !== false);
        const draftAudit = (cachedData?.audits || []).find((a: any) => a.task_id === selectedTask.id && a.report_created === false);

        if (reports.length === 0) {
            const newReportNo = window.prompt("Bu göreve ait henüz bir rapor bulunmamaktadır. Lütfen oluşturmak istediğiniz rapor numarasını girin (Örn: S.Y.2026/1):");
            if (!newReportNo) return;
            setIsSendingToEditor(true);
            try {
                if (draftAudit) {
                    await updateAudit(draftAudit.id, {
                        title: newReportNo,
                        report_created: true,
                        report_content: `<h1>${newReportNo}</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`,
                    });
                    await transferFindingsToReport({
                        ...draftAudit,
                        title: newReportNo,
                        report_created: true,
                        report_content: `<h1>${newReportNo}</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`
                    });
                } else {
                    const newAuditPayload = {
                        task_id: selectedTask.id,
                        title: newReportNo,
                        location: "",
                        date: new Date().toLocaleDateString("tr-TR"),
                        inspector: profile?.full_name || user?.displayName || user?.email?.split('@')[0] || "Müfettiş",
                        status: "Devam Ediyor",
                        report_content: `<h1>${newReportNo}</h1><p>Denetim bulguları ve tespitleri buraya kaydedilecektir.</p>`,
                        owner_id: user?.uid,
                        assigned_to: [user?.uid].filter(Boolean) as string[],
                        report_seq: 1,
                        report_created: true
                    };
                    const createdAudit = await createAudit(newAuditPayload);
                    try {
                        await updateTask(selectedTask.id, { rapor_durumu: "Devam Ediyor" });
                    } catch (err) {
                        console.error("Task status update error:", err);
                    }
                    await transferFindingsToReport(createdAudit);
                }
            } catch (err) {
                console.error(err);
                toast.error("Rapor oluşturulamadı.");
            } finally {
                setIsSendingToEditor(false);
            }
        } else {
            setShowReportSelectModal(true);
        }
    };

    // Save report edits
    const handleSaveReport = async () => {
        if (!selectedReport) return;
        setReportSaving(true);
        try {
            await updateAudit(selectedReport.id, {
                report_content: reportContent
            });
            toast.success("Rapor başarıyla kaydedildi.");
            setReportEditing(false);
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch {
            toast.error("Rapor kaydedilemedi.");
        } finally {
            setReportSaving(false);
        }
    };

    // Append AI Tenkit Item to current report
    const handleAppendTenkit = async (item: KnowledgeItem) => {
        if (!selectedReport) return;
        
        // Append inside a clean paragraph
        const formattedRemark = `<p><strong>Bulgu: ${item.topic}</strong><br/>${item.standard_remark}</p>`;
        const updatedContent = reportContent + formattedRemark;
        
        setReportContent(updatedContent);
        
        try {
            await updateAudit(selectedReport.id, {
                report_content: updatedContent
            });
            toast.success(`"${item.topic}" rapora eklendi ve kaydedildi.`);
            if (user?.uid) {
                await refreshAudits(user.uid, user.email || undefined);
            }
        } catch (error) {
            console.error(error);
            toast.error("Metin eklendi ancak otomatik kaydedilemedi. Lütfen manuel kaydedin.");
        }
    };

    // Filter Knowledge CRUD items
    const filteredKnowledge = knowledgeItems.filter(item => {
        const matchSearch = !knowledgeSearch ||
            item.topic.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.description.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.standard_remark.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
            item.category.toLowerCase().includes(knowledgeSearch.toLowerCase());
        const matchCat = !knowledgeCategoryFilter || item.category === knowledgeCategoryFilter;
        return matchSearch && matchCat;
    });

    const knowledgeCategories = [...new Set(knowledgeItems.map(i => i.category))].sort();

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-110px)] overflow-hidden animate-in fade-in duration-300">
            {/* Header / Back Navigation */}
            <div className="flex items-center gap-4 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-4 flex-shrink-0 justify-between shadow-sm">
                <div className="flex items-center gap-3.5">
                    <button
                        onClick={() => navigate("/denetim")}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-900 flex items-center justify-center transition-all duration-200"
                        title="Denetim Kontrol Paneline Dön"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                            <span>Denetimler</span>
                            <ChevronRight size={8} />
                            <span className="text-blue-500 font-bold">Özel Yurt Denetimi</span>
                        </div>
                        <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5">Özel Yurt Denetimi</h1>
                    </div>
                </div>
            </div>

            {/* Main content split */}
            {activeTab === "bilgi_bankasi" ? (
                // AI Knowledge Base Management Panel
                <div className="flex-1 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                                <Bot size={10} className="text-blue-500" />
                                <span>Kütüphane</span>
                                <ChevronRight size={10} />
                                <span className="text-blue-500">AI Bilgi Bankası</span>
                            </div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Standart Tenkit Maddeleri</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">
                                Denetim ve inceleme raporlarında hazır şablon olarak kullanılabilecek resmi tenkit metinleri.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-4 py-2.5 rounded-xl text-[10px] font-black border border-blue-100 dark:border-blue-900/20 shadow-sm h-11">
                                <Database size={14} />
                                <span>{knowledgeItems.length} Madde</span>
                            </div>
                            <Button onClick={openAddKnowledge} size="sm" className="rounded-xl h-11 px-5 shadow-md shadow-primary/20">
                                <Plus size={16} className="mr-2" /> YENİ MADDE
                            </Button>
                        </div>
                    </div>

                    {/* Stats & filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={knowledgeSearch}
                                onChange={e => setKnowledgeSearch(e.target.value)}
                                placeholder="Madde, konu veya metin ara..."
                                className="w-full pl-10 pr-4 h-11 rounded-xl border border-slate-200 dark:border-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setKnowledgeCategoryFilter(null)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    !knowledgeCategoryFilter
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                Tümü ({knowledgeItems.length})
                            </button>
                            {knowledgeCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setKnowledgeCategoryFilter(cat === knowledgeCategoryFilter ? null : cat)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                        knowledgeCategoryFilter === cat
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-white dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                                    }`}
                                >
                                    {cat} ({knowledgeItems.filter(i => i.category === cat).length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Knowledge items grid */}
                    {knowledgeLoading ? (
                        <div className="flex-1 flex items-center justify-center py-20">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                        </div>
                    ) : filteredKnowledge.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                                <BookOpen size={28} className="text-slate-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-slate-600 dark:text-slate-350 font-bold">
                                    {knowledgeSearch ? "Arama sonucu bulunamadı." : "Henüz tenkit maddesi eklenmemiş."}
                                </p>
                                <p className="text-slate-400 text-sm mt-1">
                                    {knowledgeSearch ? "Farklı bir arama terimi deneyin." : "Sistemdeki ilk tenkit metninizi ekleyin."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pr-1">
                            {filteredKnowledge.map(item => (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800/40 p-6 flex flex-col justify-between hover:shadow-md transition-all group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div>
                                                <span className="inline-block bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mb-1">
                                                    {item.category}
                                                </span>
                                                <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">{item.topic}</h3>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <button
                                                    onClick={() => openEditKnowledge(item)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 flex items-center justify-center transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteKnowledge(item)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 flex items-center justify-center transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {item.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 leading-relaxed">{item.description}</p>
                                        )}

                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Resmi Tenkit Metni</p>
                                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: item.standard_remark }} />
                                        </div>
                                    </div>

                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-4">
                                            {item.tags.map(tag => (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider"
                                                >
                                                    <Tag size={8} /> {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                // Standard Audit Category - Lists tasks and reports
                <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                    {/* 2. Tasks list pane */}
                    <div className="w-full lg:w-80 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">
                        <div className="px-1 flex items-start justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{currentRaporTuru}</h3>
                                <p className="text-[10px] text-slate-400 font-bold">Aktif denetim görevleri listesi</p>
                            </div>
                            <button
                                onClick={() => setShowTaskPicker(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0 flex-shrink-0 group"
                            >
                                <Play size={11} className="group-hover:scale-110 transition-transform" />
                                <span>Denetimi Başlat</span>
                            </button>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800/50" />

                        {filteredTasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-2">
                                <ClipboardCheck size={24} className="text-slate-300 dark:text-slate-700" />
                                <p className="text-xs font-bold text-slate-400 uppercase">Görev Bulunmamaktadır</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredTasks.map(task => {
                                    const isSelected = selectedTaskId === task.id;
                                    const taskAudits = (cachedData?.audits || []).filter((a: any) => a.task_id === task.id);
                                    return (
                                        <div key={task.id} className="flex flex-col gap-1.5">
                                            <button
                                                onClick={() => setSelectedTaskId(task.id)}
                                                className={`p-3.5 rounded-xl border text-left transition-all duration-200 w-full ${
                                                    isSelected
                                                        ? "bg-blue-600/10 border-blue-500 shadow-sm shadow-blue-500/5"
                                                        : "bg-slate-50 dark:bg-slate-950/10 border-slate-100 dark:border-slate-900 hover:border-slate-200 dark:hover:border-slate-800"
                                                }`}
                                            >
                                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                                        task.rapor_durumu === "Tamamlandı"
                                                            ? "bg-green-500/10 text-green-500"
                                                            : task.rapor_durumu === "Devam Ediyor"
                                                            ? "bg-amber-500/10 text-amber-500"
                                                            : "bg-slate-500/10 text-slate-400"
                                                    }`}>
                                                        {task.rapor_durumu}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 font-mono">{task.rapor_kodu}</span>
                                                </div>
                                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">{task.rapor_adi}</h4>
                                                <div className="flex items-center gap-2 mt-2 text-[9px] text-slate-400 font-semibold">
                                                    <span>Başlama: {task.baslama_tarihi}</span>
                                                    <span>•</span>
                                                    <span>{task.sure_gun} Gün</span>
                                                </div>
                                            </button>
                                            
                                            {/* Sub-menu of child audits/forms */}
                                            {isSelected && taskAudits.length > 0 && (
                                                <div className="pl-3 pr-1 py-1 flex flex-col gap-1 border-l-2 border-blue-500/30 ml-4 mb-2">
                                                    {taskAudits.map((a: any, idx: number) => {
                                                        const isAuditSelected = selectedAuditId === a.id;
                                                        return (
                                                            <button
                                                                key={a.id}
                                                                onClick={() => setSelectedAuditId(a.id)}
                                                                className={`text-[11px] text-left p-2 rounded-lg font-bold transition-all duration-150 flex items-center justify-between ${
                                                                    isAuditSelected
                                                                        ? "bg-blue-600 text-white shadow-sm"
                                                                        : "bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                                                                }`}
                                                            >
                                                                <span className="truncate max-w-[150px]">{idx + 1}- {a.title}</span>
                                                                <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                                                                    isAuditSelected
                                                                        ? "bg-white/20 text-white"
                                                                        : a.report_created === false
                                                                        ? "bg-amber-500/10 text-amber-500"
                                                                        : "bg-green-500/10 text-green-500"
                                                                }`}>
                                                                    {a.report_created === false ? "Taslak" : "Editör"}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. Detail Pane */}
                    <div className="flex-1 bg-white dark:bg-slate-900/30 backdrop-blur-md border border-slate-100 dark:border-slate-900/50 rounded-2xl p-6 flex flex-col overflow-y-auto">
                        {!selectedTask ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-950/20 flex items-center justify-center">
                                    <Info className="text-slate-400" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">Denetim Detayları</h4>
                                    <p className="text-xs text-slate-400 mt-0.5 max-w-[280px]">
                                        İçerik, bağlı yurt/il ilişkileri ve tenkit ekleme panelini görmek için soldan bir görev seçin.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-1">
                                {/* Header */}
                                <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">
                                            <span>{selectedTask.rapor_turu}</span>
                                            <ChevronRight size={8} />
                                            <span className="font-mono text-blue-500">{selectedTask.rapor_kodu}</span>
                                        </div>
                                        <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white leading-snug">{selectedTask.rapor_adi}</h2>
                                        {(cachedData?.audits || []).filter((a: any) => a.task_id === selectedTask.id).length > 1 && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aktif Form:</label>
                                                <select
                                                    value={selectedAuditId || ""}
                                                    onChange={(e) => setSelectedAuditId(e.target.value)}
                                                    className="text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 outline-none text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                                                >
                                                    {(cachedData?.audits || [])
                                                        .filter((a: any) => a.task_id === selectedTask.id)
                                                        .map((a: any) => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.title} {a.report_created === false ? "(Taslak)" : "(Editörde)"}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg ${
                                            selectedTask.rapor_durumu === "Tamamlandı"
                                                ? "bg-green-500/10 text-green-500"
                                                : selectedTask.rapor_durumu === "Devam Ediyor"
                                                ? "bg-amber-500/10 text-amber-500"
                                                : "bg-slate-500/10 text-slate-400"
                                        }`}>
                                            Durum: {selectedTask.rapor_durumu}
                                        </span>
                                        {selectedReport && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2.5 rounded-lg border-red-500/20 bg-red-500/5 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 text-[10px] font-black flex items-center gap-1 transition-all"
                                                onClick={handleDeleteReport}
                                                disabled={isSavingAuditData}
                                            >
                                                <Trash2 size={12} />
                                                <span>DENETİMİ SİL / SIFIRLA</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Relationships (KYK Yurt <-> İl) */}
                                {activeTab === "il" && (
                                    <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl p-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Bu İle Bağlı KYK Yurt Denetimleri</h4>
                                        {childKykTasks.length === 0 ? (
                                            <p className="text-xs text-slate-400 font-medium">Bu il genel denetimine henüz bağlı bir KYK yurt denetimi atanmamış.</p>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                {childKykTasks.map(child => (
                                                    <button
                                                        key={child.id}
                                                        onClick={() => {
                                                            setActiveTab("kyk");
                                                            setSelectedTaskId(child.id);
                                                        }}
                                                        className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg hover:border-blue-500 transition-colors text-left"
                                                    >
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{child.rapor_adi}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-mono text-slate-400">{child.rapor_kodu}</span>
                                                            <ArrowRight size={12} className="text-blue-500" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === "kyk" && (
                                    <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl p-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Bağlı Olduğu İl Genel Denetimi</h4>
                                        {!selectedTask.parent_task_id ? (
                                            <p className="text-xs text-slate-400 font-medium">
                                                Bu yurt denetimi herhangi bir İl Genel Denetimi ile ilişkilendirilmemiş. Görevler sayfasından ilişki ekleyebilirsiniz.
                                            </p>
                                        ) : parentIlTask ? (
                                            <button
                                                onClick={() => {
                                                    setActiveTab("il");
                                                    setSelectedTaskId(parentIlTask.id);
                                                }}
                                                className="flex items-center justify-between w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg hover:border-blue-500 transition-colors text-left"
                                            >
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{parentIlTask.rapor_adi}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono text-slate-400">{parentIlTask.rapor_kodu}</span>
                                                    <ArrowRight size={12} className="text-blue-500" />
                                                </div>
                                            </button>
                                        ) : (
                                            <p className="text-xs text-slate-400 font-medium">Bağlı görev bulunamadı.</p>
                                        )}
                                    </div>
                                )}

                                {/* Report Tabs and Content */}
                                {selectedReport && (
                                    <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 bg-slate-100 dark:bg-slate-955 border border-slate-250 dark:border-slate-900 rounded-xl p-1 flex-shrink-0 mb-4">
                                        {[
                                            { id: "info", label: "Genel\nBilgiler" },
                                            { id: "notes", label: "Notlar" },
                                            { id: "photos", label: "Fotoğraflar" },
                                            { id: "checklist", label: "Kontrol\nListesi" },
                                            { id: "editor", label: "Rapor\nEditörü" }
                                        ].map(tab => {
                                            const isActive = activeDetailTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => {
                                                        handleSaveAuditData(localAuditData);
                                                        setActiveDetailTab(tab.id as any);
                                                    }}
                                                    className={`flex-1 text-center py-2 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-pre-line leading-tight min-h-[38px] flex items-center justify-center ${
                                                        isActive
                                                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-850"
                                                            : "text-slate-400 dark:text-slate-500 hover:bg-slate-250 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200"
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!selectedReport ? (
                                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center gap-3">
                                        <AlertCircle size={24} className="text-slate-350 dark:text-slate-650" />
                                        <div>
                                            <h4 className="font-bold text-xs text-slate-850 dark:text-slate-250">Henüz Rapor Oluşturulmamış</h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Bu görev için denetim başlatmak için soldaki <span className="font-bold text-blue-500">Denetimi Başlat</span> butonunu kullanın.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col overflow-y-auto">
                                        {activeDetailTab === "info" && renderInfoTab()}
                                        {activeDetailTab === "notes" && renderNotesTab()}
                                        {activeDetailTab === "photos" && renderPhotosTab()}
                                        {activeDetailTab === "checklist" && renderChecklistTab()}
                                        {activeDetailTab === "editor" && (
                                            selectedReport.report_created === false ? (
                                                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center gap-3 min-h-[300px]">
                                                    <FileText size={32} className="text-slate-350 dark:text-slate-650" />
                                                    <div>
                                                        <h4 className="font-bold text-sm text-slate-850 dark:text-slate-250">Henüz Rapor Oluşturulmamış</h4>
                                                        <p className="text-xs text-slate-400 mt-1">Bu denetime ait resmi rapor belgesi henüz oluşturulmamıştır.</p>
                                                        <p className="text-xs text-slate-400">Bulguları rapora aktararak rapor belgesini başlatabilirsiniz.</p>
                                                    </div>
                                                    <Button
                                                        onClick={handleSendToEditorClick}
                                                        className="mt-2 rounded-xl h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                                                    >
                                                        Rapor Oluştur ve Bulguları Aktar
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col gap-4">
                                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/30 pb-2">
                                                        <h3 className="text-xs font-black uppercase tracking-[0.15em] text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                            <FileText size={14} className="text-blue-500" />
                                                            <span>Denetim Raporu İçeriği</span>
                                                        </h3>
                                                        <div className="flex items-center gap-1.5">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-lg text-[10px] h-8"
                                                                onClick={() => navigate(`/audit/${selectedReport.id}/report`)}
                                                            >
                                                                <ExternalLink size={12} className="mr-1" /> Editörde Aç
                                                            </Button>
                                                            {reportEditing ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="rounded-lg text-[10px] h-8 text-slate-400"
                                                                        onClick={() => {
                                                                            setReportContent(selectedReport.report_content || "");
                                                                            setReportEditing(false);
                                                                        }}
                                                                    >
                                                                        İptal
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        className="rounded-lg text-[10px] h-8"
                                                                        onClick={handleSaveReport}
                                                                        disabled={reportSaving}
                                                                    >
                                                                        {reportSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="mr-1" />}
                                                                        Kaydet
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-lg text-[10px] h-8"
                                                                    onClick={() => setReportEditing(true)}
                                                                >
                                                                    Manuel Düzenle
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[300px]">
                                                        {/* Left: Editor Area */}
                                                        <div className="xl:col-span-7 flex flex-col gap-2">
                                                            {reportEditing ? (
                                                                <textarea
                                                                    value={reportContent}
                                                                    onChange={e => setReportContent(e.target.value)}
                                                                    className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 leading-relaxed resize-none h-[350px] lg:h-full"
                                                                    placeholder="Rapor içeriğini HTML formatında yazın..."
                                                                />
                                                            ) : (
                                                                <div 
                                                                    className="flex-1 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/5 text-xs text-slate-800 dark:text-slate-255 leading-relaxed overflow-y-auto select-text prose prose-sm dark:prose-invert max-w-none h-[350px] lg:h-full"
                                                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(reportContent || "<p class='text-slate-400 italic'>Rapor içeriği boş.</p>") }}
                                                                />
                                                            )}
                                                            <p className="text-[10px] text-slate-400 font-bold">
                                                                * Rapor içeriği HTML formatındadır. TinyMCE zengin metin düzenleyiciyle düzenlemek için sağ üstteki "Editörde Aç" butonunu kullanın.
                                                            </p>
                                                        </div>

                                                        {/* Right: AI Tenkit Bankası Panel */}
                                                        <div className="xl:col-span-5 max-h-[500px]">
                                                            {renderTenkitBank("editor")}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* AI Knowledge Add/Edit Modal */}
            {showKnowledgeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                                    {editingKnowledgeItem ? "Maddeyi Düzenle" : "Yeni Tenkit Maddesi"}
                                </h2>
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                    AI asistanının ve denetim raporlarının kullanacağı şablon metin
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowKnowledgeModal(false); resetKnowledgeForm(); }}
                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-500"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                        Kategori *
                                    </label>
                                    <select
                                        value={knowledgeForm.category}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                        Konu / Başlık *
                                    </label>
                                    <input
                                        value={knowledgeForm.topic}
                                        onChange={e => setKnowledgeForm(f => ({ ...f, topic: e.target.value }))}
                                        placeholder="Örn: Asansör Yeşil Etiket Eksikliği"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Açıklama / Kriter Özeti
                                </label>
                                <input
                                    value={knowledgeForm.description}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Kısaca eksikliğin veya hatanın tanımı..."
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Resmi Tenkit Metni *
                                </label>
                                <textarea
                                    value={knowledgeForm.standard_remark}
                                    onChange={e => setKnowledgeForm(f => ({ ...f, standard_remark: e.target.value }))}
                                    placeholder="Raporlarda doğrudan kullanılacak resmi tenkit paragrafı..."
                                    rows={5}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white resize-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block mb-1.5">
                                    Anahtar Kelimeler / Etiketler
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        value={knowledgeTagInput}
                                        onChange={e => setKnowledgeTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') { e.preventDefault(); addKnowledgeTag(); }
                                        }}
                                        placeholder="Etiket yazıp Ekle'ye veya Enter'a basın..."
                                        className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={addKnowledgeTag}
                                        className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all text-slate-700 dark:text-slate-300"
                                    >
                                        Ekle
                                    </button>
                                </div>
                                {knowledgeForm.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {knowledgeForm.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => removeKnowledgeTag(tag)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800/50">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setShowKnowledgeModal(false); resetKnowledgeForm(); }}
                                className="rounded-xl h-10 px-5"
                            >
                                İptal
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveKnowledge}
                                disabled={knowledgeSaving}
                                className="rounded-xl h-10 px-6 shadow-md shadow-primary/20"
                            >
                                {knowledgeSaving
                                    ? <Loader2 size={14} className="animate-spin mr-2" />
                                    : <Check size={14} className="mr-2" />
                                }
                                {editingKnowledgeItem ? "Güncelle" : "Kaydet"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Picker Modal - Start Audit from page level */}
            {showTaskPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/20 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                                    <Play size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                                        Denetim Başlat
                                    </h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                        Görev Seçin
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowTaskPicker(false); setPickerTaskForAudit(null); }}
                                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors text-slate-500"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Task List or Prep Form */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {!pickerTaskForAudit ? (
                                <div className="space-y-3">
                                    {/* Show only tasks from the currently selected category */}
                                    {(() => {
                                        const allTasks = pickerTasks;

                                        if (allTasks.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                                                        <AlertCircle size={24} className="text-slate-400" />
                                                    </div>
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Görev Bulunamadı</h4>
                                                        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                                                            Seçili denetim türünde (Özel Yurt Denetimi) henüz bir görev oluşturulmamıştır. Denetime başlamak için önce "Görevler" sayfasından bu türde bir görev oluşturmalısınız.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => {
                                                            setShowTaskPicker(false);
                                                            navigate("/tasks");
                                                        }}
                                                        className="mt-2 text-xs font-bold rounded-xl px-5 h-9"
                                                    >
                                                        Görevler Sayfasına Git
                                                    </Button>
                                                </div>
                                            );
                                        }

                                        return allTasks.map(task => {
                                            return (
                                            <button
                                                key={task.id}
                                                onClick={() => {
                                                    setPickerTaskForAudit(task);
                                                    setPrepAuditName(`${task.rapor_adi} Denetim Formu`);
                                                }}
                                                className="w-full p-4 rounded-xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-all duration-200 text-left group flex items-center justify-between gap-3"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500">
                                                            {task.rapor_turu}
                                                        </span>
                                                        <span className="text-[9px] font-mono font-bold text-slate-400">{task.rapor_kodu}</span>
                                                    </div>
                                                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1 leading-tight">{task.rapor_adi}</h4>
                                                    <span className="text-[9px] text-slate-400 font-semibold mt-1 inline-block">Başlama: {task.baslama_tarihi} • {task.sure_gun} Gün</span>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                                            </button>
                                            );
                                        });
                                    })()}
                                </div>
                            ) : (
                                // Prep form for selected task
                                <div className="space-y-5">
                                    {/* Selected Task Summary */}
                                    <div className="bg-slate-50 dark:bg-slate-955/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">
                                                Seçilen Görev
                                            </span>
                                            <button
                                                onClick={() => setPickerTaskForAudit(null)}
                                                className="text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-1"
                                            >
                                                <ArrowRight size={10} className="rotate-180" />
                                                Geri Dön
                                            </button>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                                    {pickerTaskForAudit.rapor_adi}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
                                                    Tür: {pickerTaskForAudit.rapor_turu}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200/55 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                {pickerTaskForAudit.rapor_kodu}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Audit Title Input */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                            Dosya Adı / Başlık *
                                        </label>
                                        <input
                                            type="text"
                                            value={prepAuditName}
                                            onChange={e => setPrepAuditName(e.target.value)}
                                            placeholder="Örn: İl Müdürlüğü Denetimi 2026"
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-slate-950/20 text-slate-900 dark:text-white transition-all"
                                            disabled={isCreatingReport}
                                        />
                                    </div>

                                    {/* Warning Note */}
                                    <div className="flex items-start gap-2 bg-amber-500/5 text-amber-600 dark:text-amber-400 p-3.5 rounded-xl border border-amber-500/10">
                                        <Info size={14} className="flex-shrink-0 mt-0.5" />
                                        <p className="text-[10px] font-bold leading-relaxed">
                                            Denetimi başlattığınızda görevin durumu sistemde otomatik olarak <span className="underline">"Devam Ediyor"</span> olarak güncellenecektir.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer - only show when a task is picked */}
                        {pickerTaskForAudit && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/10 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setShowTaskPicker(false); setPickerTaskForAudit(null); }}
                                    className="rounded-xl h-10 px-5 text-xs"
                                    disabled={isCreatingReport}
                                >
                                    İptal
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleCreateReport(prepAuditName.trim(), pickerTaskForAudit)}
                                    disabled={isCreatingReport || !prepAuditName.trim()}
                                    className="rounded-xl h-10 px-6 shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                >
                                    {isCreatingReport ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin mr-2" />
                                            <span>Başlatılıyor...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} className="mr-2" />
                                            <span>Denetimi Başlat</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {showReportSelectModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/20">
                            <h2 className="text-base font-black text-slate-900 dark:text-white">Rapor Seçin</h2>
                            <button
                                onClick={() => setShowReportSelectModal(false)}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-3">
                            <p className="text-xs text-slate-500 mb-2">Bulguları hangi rapora aktarmak istersiniz?</p>
                            {(cachedData?.audits || [])
                                .filter((a: any) => a.task_id === selectedTask?.id && a.report_created !== false)
                                .map((report: any) => (
                                    <button
                                        key={report.id}
                                        onClick={() => {
                                            setShowReportSelectModal(false);
                                            transferFindingsToReport(report);
                                        }}
                                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/30 dark:bg-slate-955/10 text-left transition-all"
                                    >
                                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{report.title}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">Son Güncelleme: {report.date}</div>
                                    </button>
                                ))}
                            <button
                                onClick={handleCreateNewReportAndTransfer}
                                className="w-full p-4 rounded-xl border border-dashed border-blue-500/50 hover:bg-blue-500/5 hover:border-blue-500 text-blue-500 font-bold text-xs text-center transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} />
                                Yeni Rapor Oluştur ve Aktar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-955/20">
                            <div>
                                <h2 className="text-base font-black text-slate-900 dark:text-white">Kontrol Listesi Önizleme</h2>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Editör'e göndermeden önce işaretlediğiniz tüm maddeler ve müfettiş notları aşağıda özetlenmiştir.</p>
                            </div>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
                            {previewQuestions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                    <AlertCircle size={24} />
                                    <p className="text-xs font-bold uppercase">İşaretlenmiş Madde Bulunmamaktadır</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Lütfen kontrol listesinden en az bir maddeyi "Evet" veya "Hayır" olarak işaretleyin.</p>
                                </div>
                            ) : (
                                <div className="space-y-3.5">
                                    {previewQuestions.map(q => {
                                        const form = localAuditData.form || {};
                                        const answer = form[q.id];
                                        const note = form[`inspector_note_${q.id}`];
                                        return (
                                            <div key={q.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-955/5 space-y-2">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <span className="inline-block text-[8px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-955/30 px-2 py-0.5 rounded border border-blue-100/30 dark:border-blue-900/10">{q.area}</span>
                                                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{q.text}</h5>
                                                    </div>
                                                    {answer === "yes" ? (
                                                        <span className="flex-shrink-0 text-[9px] font-black uppercase px-2.5 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400">Evet, Uygun</span>
                                                    ) : (
                                                        <span className="flex-shrink-0 text-[9px] font-black uppercase px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">Hayır, Aykırı</span>
                                                    )}
                                                </div>
                                                {note && (
                                                    <div className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg font-medium">
                                                        <span className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Müfettiş Notu</span>
                                                        {note}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-955/20">
                            <Button
                                variant="outline"
                                onClick={() => setShowPreviewModal(false)}
                                className="rounded-xl h-10 px-5 text-slate-650 dark:text-slate-350 font-bold text-xs"
                            >
                                Vazgeç
                            </Button>
                            <Button
                                onClick={proceedSendToEditor}
                                disabled={isSendingToEditor || previewQuestions.length === 0}
                                className="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                            >
                                {isSendingToEditor ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Onayla ve Editöre Gönder
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
