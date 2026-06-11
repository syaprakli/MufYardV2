import { useState, useEffect } from "react";
import { 
    Loader2, 
    Sparkles, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    FileText, 
    CheckCircle2, 
    AlertTriangle, 
    Upload, 
    Info 
} from "lucide-react";
import { Button } from "../ui/Button";
import { 
    type ReportExample, 
    fetchReportExamples, 
    uploadReportExample, 
    generateWizardReport 
} from "../../lib/api/ai";
import { toast } from "react-hot-toast";

type Finding = {
    id: string;
    text: string;
    note: string;
    area: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    auditId: string;
    findings: Finding[];
    onApply: (html: string, applyMode: "append" | "replace" | "selection") => void;
};

const STEPS = [
    { number: 1, label: "Rapor Tipi" },
    { number: 2, label: "Öğretilmiş Şablon" },
    { number: 3, label: "Denetim Bulguları" },
    { number: 4, label: "Talimat ve Üretim" }
];

const REPORT_TYPES = [
    { value: "genel", label: "Genel Denetim Raporu" },
    { value: "inceleme", label: "İnceleme Raporu" },
    { value: "sorusturma", label: "Soruşturma Raporu" },
    { value: "federasyon", label: "Federasyon Genel Teftiş Raporu" },
    { value: "il", label: "İl Teftiş Raporu" }
];

export default function ReportWizardModal({ isOpen, onClose, auditId, findings, onApply }: Props) {
    const [step, setStep] = useState(1);
    const [loadingExamples, setLoadingExamples] = useState(false);
    const [generating, setGenerating] = useState(false);
    
    // Step 1: Report Type
    const [reportType, setReportType] = useState("genel");
    
    // Step 2: Selected Example
    const [examples, setExamples] = useState<ReportExample[]>([]);
    const [selectedExampleId, setSelectedExampleId] = useState<string>("");
    
    // Step 2 Quick Upload Widget
    const [quickUploadOpen, setQuickUploadOpen] = useState(false);
    const [quickTitle, setQuickTitle] = useState("");
    const [quickFile, setQuickFile] = useState<File | null>(null);
    const [quickUploading, setQuickUploading] = useState(false);

    // Step 3: Selected Findings
    const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
    const [extraNotes, setExtraNotes] = useState("");

    // Step 4: Instructions & Generated Result
    const [instructions, setInstructions] = useState("");
    const [generatedHtml, setGeneratedHtml] = useState("");
    const [applyMode, setApplyMode] = useState<"append" | "replace" | "selection">("append");

    // Load examples for Step 2 when reportType changes
    const loadExamples = async () => {
        setLoadingExamples(true);
        try {
            const data = await fetchReportExamples(reportType);
            setExamples(data);
            if (data.length > 0) {
                setSelectedExampleId(data[0].id);
            } else {
                setSelectedExampleId("");
            }
        } catch (error) {
            toast.error("İlgili rapor tipindeki şablon örnekleri yüklenemedi.");
        } finally {
            setLoadingExamples(false);
        }
    };

    useEffect(() => {
        if (isOpen && step === 2) {
            void loadExamples();
        }
    }, [isOpen, step, reportType]);

    // Initialize findings checkbox selection
    useEffect(() => {
        if (isOpen) {
            setSelectedFindingIds(findings.map(f => f.id));
        }
    }, [isOpen, findings]);

    const handleQuickUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickTitle.trim() || !quickFile) {
            toast.error("Lütfen şablon başlığı girin ve bir dosya seçin.");
            return;
        }

        setQuickUploading(true);
        try {
            const result = await uploadReportExample(quickTitle, reportType, quickFile);
            toast.success(`"${result.title}" başarıyla yüklendi ve analiz edildi!`);
            setQuickTitle("");
            setQuickFile(null);
            setQuickUploadOpen(false);
            // Reload examples
            const data = await fetchReportExamples(reportType);
            setExamples(data);
            setSelectedExampleId(result.id);
        } catch (error: any) {
            toast.error(error.message || "Hızlı yükleme başarısız oldu.");
        } finally {
            setQuickUploading(false);
        }
    };

    const handleNext = () => {
        if (step < 4) {
            setStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            // Get selected findings details
            const chosenFindingsTexts = findings
                .filter(f => selectedFindingIds.includes(f.id))
                .map(f => `Bulgu Alanı: ${f.area} | Bulgu: ${f.text} | Müfettiş Notu: ${f.note || "Mevcut değil"}`);

            if (extraNotes.trim()) {
                chosenFindingsTexts.push(`Ek Müfettiş Notu/Gözlemi: ${extraNotes}`);
            }

            const payload = {
                auditId,
                exampleId: selectedExampleId || undefined,
                reportType,
                selectedFindings: chosenFindingsTexts,
                instructions
            };

            const result = await generateWizardReport(payload);
            setGeneratedHtml(result.html);
            toast.success("Rapor taslağı başarıyla oluşturuldu.");
        } catch (error: any) {
            toast.error(error.message || "Rapor üretilirken hata oluştu.");
        } finally {
            setGenerating(false);
        }
    };

    const handleApplyResult = () => {
        if (!generatedHtml) return;
        onApply(generatedHtml, applyMode);
        onClose();
    };

    const toggleFinding = (id: string) => {
        setSelectedFindingIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    if (!isOpen) return null;

    return (
        <div 
            onClick={onClose}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-3xl w-full max-w-[850px] h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-slate-850/50">
                    <div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 text-lg">
                            <Sparkles size={20} className="text-violet-600 animate-pulse" /> AI Rapor Oluşturma Sihirbazı
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                            Yapay zeka ile adım adım, kendi stilinizde ve doğrulanmış bulgularla resmi rapor taslağı yazın.
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-8 h-8 p-0 hover:bg-slate-200/50 dark:hover:bg-slate-800">
                        <X size={16} />
                    </Button>
                </div>

                {/* Progress Indicators Bar */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-center gap-4 bg-white dark:bg-slate-900/40 flex-shrink-0">
                    {STEPS.map((s) => (
                        <div key={s.number} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                                step === s.number 
                                    ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 scale-105" 
                                    : step > s.number 
                                    ? "bg-emerald-500 text-white" 
                                    : "bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600"
                            }`}>
                                {step > s.number ? "✓" : s.number}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                                step === s.number ? "text-violet-600 dark:text-violet-400" : "text-slate-400"
                            }`}>
                                {s.label}
                            </span>
                            {s.number < 4 && <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800" />}
                        </div>
                    ))}
                </div>

                {/* Step Contents */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
                    {/* STEP 1: REPORT TYPE */}
                    {step === 1 && (
                        <div className="max-w-md mx-auto space-y-4">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-350 text-center mb-6">
                                Adım 1: Oluşturulacak Rapor Türünü Seçin
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {REPORT_TYPES.map((type) => (
                                    <label
                                        key={type.value}
                                        onClick={() => setReportType(type.value)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer hover:border-violet-400 dark:hover:border-violet-800 transition-all bg-white dark:bg-slate-900 ${
                                            reportType === type.value 
                                                ? "border-violet-600 ring-2 ring-violet-500/10 dark:border-violet-500" 
                                                : "border-slate-200 dark:border-slate-800"
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            reportType === type.value 
                                                ? "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" 
                                                : "bg-slate-50 dark:bg-slate-950 text-slate-400"
                                        }`}>
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{type.label}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Yapay zeka bu formata uygun bir rapor yapısı kuracaktır.</p>
                                        </div>
                                        <input
                                            type="radio"
                                            name="reportType"
                                            value={type.value}
                                            checked={reportType === type.value}
                                            onChange={() => {}}
                                            className="accent-violet-600"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 2: TEMPLATE SELECTION (FEW-SHOT LEARNING POOL) */}
                    {step === 2 && (
                        <div className="max-w-xl mx-auto space-y-4">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-350 text-center mb-4">
                                Adım 2: Yapay Zekaya Yol Gösterecek Öğretilmiş Örnek Seçin
                            </h4>

                            {loadingExamples ? (
                                <div className="py-12 flex justify-center">
                                    <Loader2 className="animate-spin text-violet-600" size={28} />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl flex gap-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                                        <Info size={18} className="text-violet-600 dark:text-violet-400 flex-shrink-0" />
                                        <span>
                                            Yapay zeka, seçtiğiniz bu örnek belgedeki <strong>bölümleri, yazım dilini ve tonlamayı</strong> analiz edip kurallar çıkaracak, ardından yeni raporunuzu bu kurallara uydurarak taslaklayacaktır (Double Prompting).
                                        </span>
                                    </div>

                                    {examples.length === 0 ? (
                                        <div className="border border-dashed border-slate-250 dark:border-slate-800 rounded-3xl p-8 text-center bg-white dark:bg-slate-900">
                                            <AlertTriangle className="mx-auto text-amber-500 mb-2" size={24} />
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Bu kategoride henüz öğretilmiş rapor örneğiniz yok.</p>
                                            <p className="text-[10px] text-slate-400 mt-1 max-w-[360px] mx-auto">Standart şablonla devam edebilir veya aşağıdaki butondan yapay zekaya hemen bir Word/PDF belgesi yükleyerek hızlıca öğretebilirsiniz.</p>
                                            
                                            {!quickUploadOpen && (
                                                <Button 
                                                    type="button" 
                                                    onClick={() => setQuickUploadOpen(true)}
                                                    className="mt-4 bg-violet-600 text-white text-[10px] font-black tracking-wider uppercase h-8 px-4 rounded-xl"
                                                >
                                                    Hızlı Rapor Yükle / Öğret
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                                                Öğretilmiş Şablon Örneği
                                            </label>
                                            <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                                {examples.map((ex) => (
                                                    <label
                                                        key={ex.id}
                                                        onClick={() => setSelectedExampleId(ex.id)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-violet-300 bg-white dark:bg-slate-900 ${
                                                            selectedExampleId === ex.id 
                                                                ? "border-violet-600 ring-2 ring-violet-500/5 dark:border-violet-500" 
                                                                : "border-slate-200 dark:border-slate-800"
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="selectedExample"
                                                            value={ex.id}
                                                            checked={selectedExampleId === ex.id}
                                                            onChange={() => {}}
                                                            className="accent-violet-600"
                                                        />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{ex.title}</p>
                                                            <p className="text-[9px] text-slate-400 mt-0.5">Yükleme: {new Date(ex.created_at).toLocaleDateString("tr-TR")}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>

                                            <div className="flex justify-between items-center pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedExampleId("")}
                                                    className={`text-[10px] font-black uppercase tracking-wider py-1 hover:underline ${
                                                        !selectedExampleId ? "text-violet-600" : "text-slate-400"
                                                    }`}
                                                >
                                                    {!selectedExampleId ? "● Standart AI Şablonu Seçili" : "○ Standart AI Şablonu Kullan (Örneksiz)"}
                                                </button>

                                                {!quickUploadOpen && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setQuickUploadOpen(true)}
                                                        className="text-[10px] font-black text-violet-600 hover:underline uppercase"
                                                    >
                                                        + Başka Örnek Rapor Yükle
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Upload Panel */}
                                    {quickUploadOpen && (
                                        <form onSubmit={handleQuickUpload} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3 animate-in slide-in-from-bottom duration-250">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black uppercase text-slate-700 dark:text-slate-350">Hızlı Rapor Öğret</h5>
                                                <button type="button" onClick={() => setQuickUploadOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
                                            </div>
                                            <input
                                                value={quickTitle}
                                                onChange={(e) => setQuickTitle(e.target.value)}
                                                placeholder="Rapor örneği başlığı..."
                                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 text-xs font-semibold outline-none focus:ring-1 focus:ring-violet-500"
                                                required
                                            />
                                            <div className="relative border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50/50">
                                                <input
                                                    type="file"
                                                    accept=".docx,.pdf,.txt"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            const f = e.target.files[0];
                                                            setQuickFile(f);
                                                            if (!quickTitle) setQuickTitle(f.name.replace(/\.[^/.]+$/, ""));
                                                        }
                                                    }}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                                <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                                                    {quickFile ? quickFile.name : "Dosya seçmek için tıklayın"}
                                                </span>
                                            </div>
                                            <Button
                                                type="submit"
                                                disabled={quickUploading}
                                                className="w-full bg-violet-600 text-white font-black text-[10px] h-8 rounded-lg"
                                            >
                                                {quickUploading ? <Loader2 size={12} className="animate-spin" /> : "Öğret ve Listeye Ekle"}
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: FINDINGS SELECTION */}
                    {step === 3 && (
                        <div className="max-w-xl mx-auto space-y-4">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-350 text-center mb-4">
                                Adım 3: Rapora Dahil Edilecek Bulguları Seçin
                            </h4>

                            {findings.length === 0 ? (
                                <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center bg-white dark:bg-slate-900 text-slate-400">
                                    <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={24} />
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Bulunmuş Tenkit veya Eksiklik Yok</p>
                                    <p className="text-[10px] text-slate-400 mt-1 max-w-[320px] mx-auto">Denetim formlarındaki tüm sorular başarıyla "Evet" olarak geçilmiş. Aşağıdaki kutuyu kullanarak bulgularınızı elinizle girebilirsiniz.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            Denetim Bulguları ({selectedFindingIds.length} / {findings.length})
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedFindingIds.length === findings.length) setSelectedFindingIds([]);
                                                else setSelectedFindingIds(findings.map(f => f.id));
                                            }}
                                            className="text-[9px] text-violet-600 dark:text-violet-400 font-black uppercase hover:underline"
                                        >
                                            {selectedFindingIds.length === findings.length ? "Tüm Seçimleri Kaldır" : "Hepsini Seç"}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2.5 max-h-[200px] overflow-y-auto pr-1">
                                        {findings.map((f) => (
                                            <div 
                                                key={f.id}
                                                onClick={() => toggleFinding(f.id)}
                                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-900 ${
                                                    selectedFindingIds.includes(f.id) 
                                                        ? "border-violet-300 dark:border-violet-800 ring-2 ring-violet-500/5" 
                                                        : "border-slate-200 dark:border-slate-850"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFindingIds.includes(f.id)}
                                                    onChange={() => {}}
                                                    className="mt-0.5 accent-violet-600"
                                                />
                                                <div className="flex-1">
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 mr-2">
                                                        {f.area}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-150 mt-1 leading-normal">{f.text}</p>
                                                    {f.note && (
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic font-semibold">Not: {f.note}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Ek Notlar, Gözlemler veya Bulgular
                                </label>
                                <textarea
                                    value={extraNotes}
                                    onChange={(e) => setExtraNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Checklist dışında denetimde tespit ettiğiniz diğer hususları ve yasal aykırılıkları buraya ekleyin..."
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 4: INSTRUCTIONS & GENERATION & RESULTS */}
                    {step === 4 && (
                        <div className="space-y-4">
                            {!generatedHtml ? (
                                <div className="max-w-md mx-auto space-y-4">
                                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-350 text-center mb-2">
                                        Adım 4: Yapay Zeka Talimatını Belirleyin ve Üretin
                                    </h4>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            Yapay Zeka Özel Talimatı
                                        </label>
                                        <textarea
                                            value={instructions}
                                            onChange={(e) => setInstructions(e.target.value)}
                                            rows={4}
                                            placeholder="Örn: Resmi ve hukuki dili koru, başlıkları kalın yap, her bulgu için mutlaka mevzuat kural bankasından referans maddeleri araştırıp ekle..."
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 dark:text-slate-200 resize-none"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleGenerate}
                                        disabled={generating}
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black text-xs h-11 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Yapay Zeka Raporu Taslaklıyor... (Bu işlem ~30-60 sn sürebilir)
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} />
                                                Taslak Raporu AI ile Oluştur
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl flex-shrink-0">
                                        <div>
                                            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-emerald-500" /> AI Rapor Taslağı Hazırlandı!
                                            </h5>
                                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Lütfen aşağıdan önizleyin ve rapora uygulama modunu seçip editöre aktarın.</p>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setGeneratedHtml("")}
                                            className="text-[9px] font-black uppercase tracking-wider h-7"
                                        >
                                            Yeniden Düzenle
                                        </Button>
                                    </div>

                                    {/* Application Toggles */}
                                    <div className="flex flex-wrap gap-2 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setApplyMode("append")}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                applyMode === "append" 
                                                    ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                                    : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                            }`}
                                        >
                                            Raporun Sonuna Ekle
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setApplyMode("replace")}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                applyMode === "replace" 
                                                    ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                                    : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                            }`}
                                        >
                                            Mevcut İçeriği Tamamen Değiştir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setApplyMode("selection")}
                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                applyMode === "selection" 
                                                    ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-400" 
                                                    : "border-slate-200 dark:border-slate-800 text-slate-500 bg-white dark:bg-slate-900"
                                            }`}
                                        >
                                            Seçili Paragrafta Kullan
                                        </button>
                                    </div>

                                    {/* Preview Block */}
                                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-850 bg-white dark:bg-slate-900 p-5 prose max-w-none prose-slate dark:prose-invert text-xs leading-relaxed max-h-[300px] overflow-y-auto">
                                        <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handlePrev}
                        disabled={step === 1 || generating}
                        className="h-10 px-4 text-xs font-black rounded-xl text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <ChevronLeft size={14} /> Geri
                    </Button>

                    {step === 4 && generatedHtml ? (
                        <Button
                            type="button"
                            onClick={handleApplyResult}
                            className="h-10 px-6 text-xs font-black bg-violet-600 text-white hover:bg-violet-700 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                        >
                            Metin Önerisini Editöre Aktar
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={
                                step === 4 || 
                                (step === 2 && loadingExamples)
                            }
                            className="h-10 px-4 text-xs font-black bg-violet-600 text-white hover:bg-violet-700 rounded-xl transition-all shadow-md flex items-center gap-1"
                        >
                            İleri <ChevronRight size={14} />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
