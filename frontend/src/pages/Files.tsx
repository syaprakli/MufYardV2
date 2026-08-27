import { 
    Folder, File as FileIcon, Plus, Search, ChevronRight, ChevronDown, 
    Download, Trash2, Shield, FolderOpen,
    FileText, Image as ImageIcon, Video, Music, 
    Upload, X, Grid, List as ListIcon, RefreshCw, Share2, ExternalLink, HelpCircle,
    Briefcase, FileSpreadsheet, Users, Check, Calendar, AlertTriangle, ArrowLeft, Calculator, Settings
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { toast } from "react-hot-toast";
import { useConfirm } from "../lib/context/ConfirmContext";
import React, { useState, useEffect, useMemo, useRef, type DragEvent } from "react";
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
import { LOJMAN_RATES, CITY_DISCOUNT_GROUPS } from "../lib/lojmanRates";
import { YOLLUK_H_RATES, YOLLUK_COEFFICIENTS } from "../lib/yollukRates";


export default function Files() {
    const confirm = useConfirm();
    const [searchParams] = useSearchParams();
    const scope = searchParams.get("scope");

    const formatYollukCurrency = (val: number): string => {
        const fixedVal = val.toFixed(2);
        if (fixedVal.endsWith(".00")) {
            const intPart = Math.round(val);
            return intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        } else {
            const [intPart, decPart] = fixedVal.split(".");
            const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return `${formattedInt},${decPart}`;
        }
    };

    // Turkish number format: 1.000 / 5,65 — no trailing ,00
    const fmtTR = (val: number, decimals = 2): string => {
        const fixedVal = val.toFixed(decimals);
        const allZeros = /^0+$/.test(fixedVal.split(".")[1] ?? "");
        if (allZeros) {
            const intPart = Math.round(val === 0 ? 0 : Math.abs(val) < 1 ? val : val);
            return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }
        const [intPart, decPart] = fixedVal.split(".");
        const trimmed = decPart.replace(/0+$/, "");
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return trimmed ? `${formattedInt},${trimmed}` : formattedInt;
    };

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

    // Lojman Kira Hesaplama states
    const [isLojmanModalOpen, setIsLojmanModalOpen] = useState(false);
    const [lojmanYear, setLojmanYear] = useState("2026");
    const [lojmanType, setLojmanType] = useState<"kerpic" | "kalorifersiz" | "kaloriferli">("kaloriferli");
    const [lojmanM2, setLojmanM2] = useState<number>(120);
    const [lojmanCity, setLojmanCity] = useState("Ankara");
    const [lojmanDiscountGroup, setLojmanDiscountGroup] = useState<"ek1" | "ek2" | "ek3" | "ek3_10k" | "uzak" | "indirimsiz">("ek3");
    const [hasKapici, setHasKapici] = useState(false);
    const [hasElektrik, setHasElektrik] = useState(false);
    const [hasSu, setHasSu] = useState(false);
    const [hasElektrikSu, setHasElektrikSu] = useState(false);
    const [hasKuyuSu, setHasKuyuSu] = useState(false);
    const [hasYakit, setHasYakit] = useState(false);
    const [hasOrtakAlan, setHasOrtakAlan] = useState(false);

    const [isCityListOpen, setIsCityListOpen] = useState(false);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const [citySearchQuery, setCitySearchQuery] = useState("");

    // Sürekli Görev Yolluğu Hesaplama verileri
    const [isYollukModalOpen, setIsYollukModalOpen] = useState(false);
    const [yollukActiveTab, setYollukActiveTab] = useState<"memur" | "emekli">("memur");
    
    // Memur Yolluğu
    const [yollukYear, setYollukYear] = useState("2026");
    const [yollukGrade, setYollukGrade] = useState("der_5_15");
    const [yollukCustomGundelik, setYollukCustomGundelik] = useState<number>(850);
    const [yollukDistance, setYollukDistance] = useState<number>(100);
    const [yollukMemurYolUcreti, setYollukMemurYolUcreti] = useState<number>(150);
    
    // Emekli Yolluğu
    const [yollukEmekliYear, setYollukEmekliYear] = useState("2026");
    const [yollukEmekliPeriod, setYollukEmekliPeriod] = useState<"jan_jun" | "jul_dec">("jan_jun");
    const [yollukEmekliClass, setYollukEmekliClass] = useState<"kadrolu" | "isci" | "custom">("kadrolu");
    const [yollukEmekliCustomIndicator, setYollukEmekliCustomIndicator] = useState<number>(13558);
    const [yollukEmekliUseCustomCoefficient, setYollukEmekliUseCustomCoefficient] = useState(false);
    const [yollukEmekliCustomCoefficient, setYollukEmekliCustomCoefficient] = useState<number>(1.387871);

    interface YollukFamilyMember {
        id: string;
        relation: string;
        yolUcreti: number;
    }
    const [yollukFamily, setYollukFamily] = useState<YollukFamilyMember[]>([]);

    // Görevlendirme Ücreti states
    const [isGorevModalOpen, setIsGorevModalOpen] = useState(false);
    const [gorevYear, setGorevYear] = useState("2026");
    const [gorevPeriod, setGorevPeriod] = useState<"jan_jun" | "jul_dec">("jan_jun");
    const [gorevTable, setGorevTable] = useState<string>("tablo1");
    const [gorevRoleIndex, setGorevRoleIndex] = useState<number>(0);
    const [gorevDuration, setGorevDuration] = useState<number>(1);
    const [gorevGelirVergisiRate, setGorevGelirVergisiRate] = useState<number>(15);
    const [gorevDamgaVergisiRate, setGorevDamgaVergisiRate] = useState<number>(0.759); // binde 7.59
    const [gorevIsArtirimli, setGorevIsArtirimli] = useState(false);

    // İhale Kontrol 1 states
    const [isIhaleModalOpen, setIsIhaleModalOpen] = useState(false);
    const [ihaleStep, setIhaleStep] = useState<number>(1);
    const [ihaleType, setIhaleType] = useState<"yapim" | "mal" | "hizmet" | "">("");
    const [ihaleMaliyet, setIhaleMaliyet] = useState<number>(0);
    const [ihaleIsBuyuksehir, setIhaleIsBuyuksehir] = useState<boolean>(false);
    const [ihaleIdareTipi, setIhaleIdareTipi] = useState<"genel" | "diger">("genel");
    const [ihaleHistory, setIhaleHistory] = useState<number[]>([]);
    const [ihaleRecommendedMethod, setIhaleRecommendedMethod] = useState<string>("");
    const [ihaleTarihi, setIhaleTarihi] = useState<string>(new Date().toISOString().split("T")[0]);
    const [ihaleBedeli, setIhaleBedeli] = useState<number>(0);
    const [sozlesmeTarihi, setSozlesmeTarihi] = useState<string>(new Date().toISOString().split("T")[0]);

    // Hakediş ve Kesinti states
    const [isHakedisModalOpen, setIsHakedisModalOpen] = useState(false);

    // İhale Kontrol 2 states
    const [isIhale2ModalOpen, setIsIhale2ModalOpen] = useState(false);
    // const [ihale2ActiveTab, setIhale2ActiveTab] = useState<number>(1);
    const [ihale2ProjeBedeli, setIhale2ProjeBedeli] = useState<number>(0);
    const [ihale2IlkYilOdenebi, setIhale2IlkYilOdenebi] = useState<number>(0);
    const [ihale2IsBina, setIhale2IsBina] = useState<boolean>(false);
    const [ihale2Maliyet, setIhale2Maliyet] = useState<number>(0);
    const [ihale2IsMetropol, setIhale2IsMetropol] = useState<boolean>(false);
    const [ihale2IdareTipi, setIhale2IdareTipi] = useState<"genel" | "diger">("genel");
    const [ihale2KomisyonUye, setIhale2KomisyonUye] = useState<number>(5);
    const [ihale2Tarihi, setIhale2Tarihi] = useState<string>(new Date().toISOString().split("T")[0]);
    const [ihale2ZeyilnameTarihi, setIhale2ZeyilnameTarihi] = useState<string>("");
    const [ihale2HakedisTur, setIhale2HakedisTur] = useState<"yapim" | "danismanlik" | "diger">("yapim");
    const [ihale2HakedisSari, setIhale2HakedisSari] = useState<boolean>(false);
    const [ihale2HakedisAvansOran, setIhale2HakedisAvansOran] = useState<number>(0);
    const [ihale2HakedisGuncelKum, setIhale2HakedisGuncelKum] = useState<number>(0);
    const [ihale2HakedisOncekiKum, setIhale2HakedisOncekiKum] = useState<number>(0);
    const [ihale2HakedisFiyatFarki, setIhale2HakedisFiyatFarki] = useState<number>(0);
    const [ihale2HakedisCezalar, setIhale2HakedisCezalar] = useState<number>(0);
    const [ihale2SgkBelgesi, setIhale2SgkBelgesi] = useState<boolean>(false);
    const [ihale2Step, setIhale2Step] = useState<number>(1);
    const [ihale2History, setIhale2History] = useState<number[]>([]);
    const [ihale2CancelledReason, setIhale2CancelledReason] = useState<string>("");
    const [ihale2ImarDurumu, setIhale2ImarDurumu] = useState<boolean>(false);
    const [ihale2ProjeHazir, setIhale2ProjeHazir] = useState<boolean>(false);
    const [ihale2ArsaTeslimi, setIhale2ArsaTeslimi] = useState<boolean>(false);
    const [ihale2ZeyilnameYapildi, setIhale2ZeyilnameYapildi] = useState<boolean>(false);
    const [ihale2AsiriDusukSorgulandi, setIhale2AsiriDusukSorgulandi] = useState<boolean>(false);
    const [ihale2KararTarihi, setIhale2KararTarihi] = useState<string>(new Date().toISOString().split("T")[0]);

    // Sub-dashboards states
    const [isHesaplamaSubActive, setIsHesaplamaSubActive] = useState(false);
    const [isIhaleSubActive, setIsIhaleSubActive] = useState(false);
    const [isRaporSubActive, setIsRaporSubActive] = useState(false);
    const [isPratikModalOpen, setIsPratikModalOpen] = useState(false);

    // Travel days Tayin yolluk
    const [yollukTravelDays, setYollukTravelDays] = useState<number>(1);

    const GOREV_TABLES: Record<string, { title: string; unit: string; roles: { name: string; indicator: number }[] }> = {
        tablo1: {
            title: "1 Sayılı Tablo (Günlük Ödemeler)",
            unit: "Gün",
            roles: [
                { name: "Gençlik ve Spor Yöneticisi", indicator: 300 },
                { name: "Gençlik ve Spor Yöneticisi Yardımcısı", indicator: 220 },
                { name: "Doktor", indicator: 1000 },
                { name: "Doktor (Dışarıdan Görevlendirilen Uzman - %50 Fazlası)", indicator: 1500 },
                { name: "Gençlik Eğitim Şefi, Psikolog, Antrenör, Öğretmen, Lider vb.", indicator: 400 },
                { name: "Aşçı", indicator: 400 },
                { name: "Deniz Motoru Kaptanı, Şoför, Garson, Hizmetli, Teknisyen vb.", indicator: 200 }
            ]
        },
        tablo2: {
            title: "2 Sayılı Tablo (Saatlik Ödemeler)",
            unit: "Saat",
            roles: [
                { name: "Eğitici, Öğretici, Çalıştırıcı, Lider, Monitör, Antrenör vb.", indicator: 200 },
                { name: "Kamp Eğitim Öğretim Elemanı, Öğretmen, Eğitim Yöneticisi, Tercüman vb.", indicator: 300 },
                { name: "Tesis Müdürü, Tesis Şefi, Teknik Elemanlar vb.", indicator: 200 },
                { name: "Destek Hizmeti (Ambar Memuru, Şoför, Elektrikçi vb.)", indicator: 150 }
            ]
        },
        tablo3: {
            title: "3 Sayılı Tablo (Seanslık Ödemeler)",
            unit: "Seans",
            roles: [
                { name: "Bakanlık, MEB, Gözlemci, Temsilci, Genel Sekreter vb.", indicator: 350 },
                { name: "Doktor", indicator: 600 },
                { name: "Müsabaka Müdürü, Mutemet, Tesis Amiri, Saha Komiseri, İl Temsilcisi vb.", indicator: 250 },
                { name: "Gişe Memuru, Şoför, Kontrol Memuru, Spiker, Teşrifatçı vb.", indicator: 200 },
                { name: "Sayı Yazıcısı, Top Toplayıcıcı", indicator: 150 }
            ]
        },
        tablo4: {
            title: "4 Sayılı Tablo (İl Hakem Ödemeleri)",
            unit: "Müsabaka/Seans",
            roles: [
                { name: "Takım - Uluslararası Hakem (Baş-Orta)", indicator: 400 },
                { name: "Takım - Uluslararası Hakem (Yan-Yardımcı/Masa)", indicator: 300 },
                { name: "Takım - Ulusal Hakem (Baş-Orta)", indicator: 350 },
                { name: "Takım - Ulusal Hakem (Yan-Yardımcı/Masa)", indicator: 275 },
                { name: "Takım - İl Hakemi (Baş-Orta)", indicator: 300 },
                { name: "Takım - İl Hakemi (Yan-Yardımcı/Masa)", indicator: 250 },
                { name: "Takım - Aday Hakem (Baş-Orta)", indicator: 250 },
                { name: "Takım - Aday Hakem (Yan-Yardımcı/Masa)", indicator: 225 },
                { name: "Okul Sporları Futbol-Futsal Hakemi (Baş-Orta)", indicator: 350 },
                { name: "Okul Sporları Futbol-Futsal Hakemi (Yardımcı/Masa)", indicator: 250 },
                { name: "Ferdi - Uluslararası Hakem (Baş-Müsabaka)", indicator: 400 },
                { name: "Ferdi - Ulusal Hakem (Baş-Müsabaka)", indicator: 350 },
                { name: "Ferdi - İl Hakemi (Baş-Müsabaka)", indicator: 300 },
                { name: "Ferdi - Aday Hakem (Baş-Müsabaka)", indicator: 250 }
            ]
        },
        tablo5: {
            title: "5 Sayılı Tablo (Federasyon Hakem Ödemeleri)",
            unit: "Müsabaka/Seans",
            roles: [
                { name: "Takım - Uluslararası Hakem (Baş-Orta)", indicator: 600 },
                { name: "Takım - Uluslararası Hakem (Yan-Yardımcı/Masa)", indicator: 400 },
                { name: "Takım - Ulusal Hakem (Baş-Orta)", indicator: 500 },
                { name: "Takım - Ulusal Hakem (Yan-Yardımcı/Masa)", indicator: 375 },
                { name: "Takım - İl Hakemi (Baş-Orta)", indicator: 450 },
                { name: "Takım - İl Hakemi (Yan-Yardımcı/Masa)", indicator: 350 },
                { name: "Takım - Aday Hakem (Baş-Orta)", indicator: 400 },
                { name: "Takım - Aday Hakem (Yan-Yardımcı/Masa)", indicator: 325 },
                { name: "Ferdi - Uluslararası Hakem (Baş-Müsabaka)", indicator: 600 },
                { name: "Ferdi - Ulusal Hakem (Baş-Müsabaka)", indicator: 550 },
                { name: "Ferdi - İl Hakemi (Baş-Müsabaka)", indicator: 500 },
                { name: "Ferdi - Aday Hakem (Baş-Müsabaka)", indicator: 450 }
            ]
        },
        tablo6: {
            title: "6 Sayılı Tablo (Jüri ve Seçici Kurul)",
            unit: "Seans",
            roles: [
                { name: "Jüri ve Seçici Kurul Üyesi", indicator: 600 }
            ]
        }
    };


    const resetIhale = () => {
        setIhaleStep(1);
        setIhaleType("");
        setIhaleMaliyet(0);
        setIhaleIsBuyuksehir(false);
        setIhaleIdareTipi("genel");
        setIhaleHistory([]);
        setIhaleRecommendedMethod("");
        setIhaleTarihi(new Date().toISOString().split("T")[0]);
        setIhaleBedeli(0);
        setSozlesmeTarihi(new Date().toISOString().split("T")[0]);
    };

    const resetIhale2 = () => {
        setIhale2Step(1);
        setIhale2History([]);
        setIhale2CancelledReason("");
        setIhale2ImarDurumu(false);
        setIhale2ProjeHazir(false);
        setIhale2ArsaTeslimi(false);
        setIhale2ZeyilnameYapildi(false);
        setIhale2AsiriDusukSorgulandi(false);
        setIhale2KararTarihi(new Date().toISOString().split("T")[0]);
        setIhale2ProjeBedeli(0);
        setIhale2IlkYilOdenebi(0);
        setIhale2Maliyet(0);
        setIhale2ZeyilnameTarihi("");
        setIhale2HakedisGuncelKum(0);
        setIhale2HakedisOncekiKum(0);
        setIhale2HakedisFiyatFarki(0);
        setIhale2HakedisCezalar(0);
    };

const calculateYollukValues = () => {
        interface YollukYearRatesLocal {
            ek_8000_plus: number;
            ek_6400_8000: number;
            ek_3600_6400: number;
            der_1_4: number;
            der_5_15: number;
        }
        const memurRates = YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"];
        const yevmiye = yollukGrade === "custom" 
            ? yollukCustomGundelik 
            : (memurRates[yollukGrade as keyof YollukYearRatesLocal] || 850);
            
        const memurSabit = yevmiye * 20;
        const memurDegisken = yevmiye * yollukDistance * 0.05;
        const memurYevmiyeTutar = yevmiye * yollukTravelDays;
        const memurTotal = memurSabit + memurDegisken + yollukMemurYolUcreti + memurYevmiyeTutar;

        const familyDetails = yollukFamily.map((f, index) => {
            const isEligibleForRelocation = index < 4;
            const relocationAllowance = isEligibleForRelocation ? yevmiye * 10 : 0;
            const dailyAllowance = yevmiye * yollukTravelDays;
            const total = f.yolUcreti + dailyAllowance + relocationAllowance;
            return {
                ...f,
                relocationAllowance,
                dailyAllowance,
                total
            };
        });

        const familyTotal = familyDetails.reduce((sum, item) => sum + item.total, 0);
        const familyRelocationTotal = familyDetails.reduce((sum, item) => sum + item.relocationAllowance, 0);
        const familyYolUcretiTotal = familyDetails.reduce((sum, item) => sum + item.yolUcreti, 0);
        const familyDailyTotal = familyDetails.reduce((sum, item) => sum + item.dailyAllowance, 0);

        const activeGrandTotal = memurTotal + familyTotal;

        let emekliCoefficient = 1.387871;
        if (yollukEmekliUseCustomCoefficient) {
            emekliCoefficient = yollukEmekliCustomCoefficient;
        } else {
            const yrCoeffs = YOLLUK_COEFFICIENTS[yollukEmekliYear] || YOLLUK_COEFFICIENTS["2026"];
            emekliCoefficient = yrCoeffs[yollukEmekliPeriod] || 1.387871;
        }

        let emekliIndicator = 13558;
        if (yollukEmekliClass === "isci") {
            emekliIndicator = 12105;
        } else if (yollukEmekliClass === "custom") {
            emekliIndicator = yollukEmekliCustomIndicator;
        }

        const emekliGross = emekliIndicator * emekliCoefficient;
        const emekliDamgaTax = emekliGross * 0.00759;
        const emekliNet = emekliGross - emekliDamgaTax;

        return {
            yevmiye,
            memurSabit,
            memurDegisken,
            memurYevmiyeTutar,
            memurTotal,
            familyDetails,
            familyTotal,
            familyRelocationTotal,
            familyYolUcretiTotal,
            familyDailyTotal,
            activeGrandTotal,
            emekliCoefficient,
            emekliIndicator,
            emekliGross,
            emekliDamgaTax,
            emekliNet
        };
    };
    
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

    const calculateGorevValues = () => {
        const katsayi = YOLLUK_COEFFICIENTS[gorevYear]?.[gorevPeriod] || 1.387871;
        const selectedTableData = GOREV_TABLES[gorevTable] || GOREV_TABLES.tablo1;
        const selectedRole = selectedTableData.roles[gorevRoleIndex] || selectedTableData.roles[0];
        let indicator = selectedRole.indicator;
        
        // %50 artırımlı gösterge uygulaması (İl hudutları içi, memuriyet mahalli dışı)
        if (gorevIsArtirimli) {
            indicator = indicator * 1.5;
        }

        const gross = indicator * katsayi * gorevDuration;
        const gelirVergisi = gross * (gorevGelirVergisiRate / 100);
        const damgaVergisi = gross * (gorevDamgaVergisiRate / 100);
        const kesintiToplam = gelirVergisi + damgaVergisi;
        const net = gross - kesintiToplam;

        return {
            katsayi,
            indicator,
            gross,
            gelirVergisi,
            damgaVergisi,
            kesintiToplam,
            net,
            unit: selectedTableData.unit,
            roleName: selectedRole.name,
            tableTitle: selectedTableData.title
        };
    };

    const isSpreadsheetFile = (item: FileItem | null) => {
        if (!item) return false;
        const ext = (item.name.split('.').pop() || '').toLowerCase();
        return ['xls', 'xlsx', 'csv'].includes(ext);
    };

    const calculateLojmanValues = () => {
        const rates = LOJMAN_RATES[lojmanYear] || LOJMAN_RATES["2026"];
        const baseRate = rates[lojmanType] || 0;
        
        let discountPct = 0;
        if (lojmanDiscountGroup === "ek1") discountPct = 0.50;
        else if (lojmanDiscountGroup === "ek2") discountPct = 0.45;
        else if (lojmanDiscountGroup === "ek3") discountPct = 0.30;
        else if (lojmanDiscountGroup === "ek3_10k") discountPct = 0.40;
        else if (lojmanDiscountGroup === "uzak") discountPct = 0.70;
        else if (lojmanDiscountGroup === "indirimsiz") discountPct = 0;
        
        const discountAmountRate = baseRate * discountPct;
        const netBaseRate = baseRate - discountAmountRate;
        
        const kapiciRate = hasKapici ? (rates.kapici || 0) : 0;
        
        let elektrikRate = 0;
        let suRate = 0;
        if (hasElektrikSu) {
            // mutually exclusive
        } else {
            if (hasElektrik) elektrikRate = rates.elektrik || 0;
            if (hasSu) suRate = rates.su || 0;
        }
        const elektrikSuRate = hasElektrikSu ? (rates.elektrik_su || 0) : 0;
        
        const kuyuSuRate = hasKuyuSu ? (rates.kuyu_su || 0) : 0;
        const yakitRate = hasYakit ? (rates.yakit || 0) : 0;
        const ortakAlanRate = hasOrtakAlan ? (rates.ortak_alan || 0) : 0;
        
        const additionsRate = kapiciRate + elektrikRate + suRate + elektrikSuRate + kuyuSuRate + yakitRate + ortakAlanRate;
        const finalRate = netBaseRate + additionsRate;
        const monthlyRent = finalRate * lojmanM2;
        const dailyRent = monthlyRent / 30;
        
        return {
            rates,
            baseRate,
            discountPct,
            discountAmountRate,
            netBaseRate,
            kapiciRate,
            elektrikRate,
            suRate,
            elektrikSuRate,
            kuyuSuRate,
            yakitRate,
            ortakAlanRate,
            additionsRate,
            finalRate,
            monthlyRent,
            dailyRent
        };
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
            await uploadFile(file, currentPath, undefined, scope || undefined);
            await loadData();
            toast.success("Dosya yüklendi");
        } catch (error) {
            toast.error("Yükleme başarısız");
        } finally {
            setIsUploading(false);
        }
    };


    useEffect(() => {
        /* noop */
        loadData();
    }, [scope]);

    useEffect(() => {
        const found = CITY_DISCOUNT_GROUPS.find(c => c.name === lojmanCity);
        if (found) {
            setLojmanDiscountGroup(found.group);
        }
    }, [lojmanCity]);

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
            await uploadFile(file, currentPath, undefined, scope || undefined);
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
            await deleteItem(id, scope || undefined);
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
            await createFolder(newFolderName.trim(), currentPath, undefined, undefined, scope || undefined);
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
            await openFolder(id, scope || undefined);
        } catch (error) {
            toast.error("Klasör açılamadı");
        }
    };

    const handleOpenFile = async (id: string) => {
        try {
            await openFile(id, scope || undefined);
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

    const renderGorevModal = () => {
        if (!isGorevModalOpen) return null;

        const {
            katsayi,
            indicator,
            gross,
            gelirVergisi,
            damgaVergisi,
            kesintiToplam,
            net,
            unit,
            roleName
        } = calculateGorevValues();

        const sortedCoeffsYears = Object.keys(YOLLUK_COEFFICIENTS).sort((a, b) => b.localeCompare(a));

        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-5xl p-6 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 font-outfit">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <Briefcase size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 font-bold">Görevlendirme Ücreti Hesaplama</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Gençlik ve Spor Hizmetleri unvan göstergelerine göre görev ücreti tutarlarını hesaplayın.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsGorevModalOpen(false)} 
                            className="rounded-xl h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={16} />
                        </Button>
                    </div>

                    {/* Main Split Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden flex-1">
                        {/* LEFT: Inputs */}
                        <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[40vh] lg:max-h-none pb-4">
                            
                            {/* Year and Period */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Hesap Yılı</label>
                                    <select 
                                        value={gorevYear} 
                                        onChange={(e) => {
                                            setGorevYear(e.target.value);
                                            setGorevRoleIndex(0);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        {sortedCoeffsYears.map(yr => (
                                            <option key={yr} value={yr}>{yr} Yılı</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Katsayı Dönemi</label>
                                    <select 
                                        value={gorevPeriod} 
                                        onChange={(e) => setGorevPeriod(e.target.value as "jan_jun" | "jul_dec")}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        <option value="jan_jun">1 Ocak - 30 Haziran</option>
                                        <option value="jul_dec">1 Temmuz - 31 Aralık</option>
                                    </select>
                                </div>
                            </div>

                            {/* Table Selection */}
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Görevlendirme Genelge Tablosu</label>
                                <select 
                                    value={gorevTable} 
                                    onChange={(e) => {
                                        setGorevTable(e.target.value);
                                        setGorevRoleIndex(0);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                >
                                    {Object.entries(GOREV_TABLES).map(([key, val]) => (
                                        <option key={key} value={key}>{val.title}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Role Selection */}
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Görev / Unvan Seçimi</label>
                                <select 
                                    value={gorevRoleIndex} 
                                    onChange={(e) => setGorevRoleIndex(parseInt(e.target.value) || 0)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                >
                                    {(GOREV_TABLES[gorevTable] || GOREV_TABLES.tablo1).roles.map((r, idx) => (
                                        <option key={idx} value={idx}>{r.name} ({r.indicator} Gösterge)</option>
                                    ))}
                                </select>
                            </div>

                            {/* Duration / Count */}
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Görev Süresi ({unit})</label>
                                <input 
                                    type="number" 
                                    value={gorevDuration || ""} 
                                    min={1}
                                    onChange={(e) => setGorevDuration(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                />
                            </div>

                            {/* Tax Rates */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Gelir Vergisi</label>
                                    <select 
                                        value={gorevGelirVergisiRate} 
                                        onChange={(e) => setGorevGelirVergisiRate(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        <option value={15}>%15 (Standart)</option>
                                        <option value={20}>%20</option>
                                        <option value={27}>%27</option>
                                        <option value={35}>%35</option>
                                        <option value={40}>%40</option>
                                        <option value={0}>%0 (Kesintisiz)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Damga Vergisi</label>
                                    <select 
                                        value={gorevDamgaVergisiRate} 
                                        onChange={(e) => setGorevDamgaVergisiRate(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        <option value={0.759}>%0,759 (Binde 7.59)</option>
                                        <option value={0}>%0 (Kesintisiz)</option>
                                    </select>
                                </div>
                            </div>

                            {/* %50 Artırım Checkbox */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={gorevIsArtirimli}
                                        onChange={(e) => setGorevIsArtirimli(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-white border border-slate-350 dark:border-slate-700"
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350 select-none">
                                        İl Hudutları İçi / Memuriyet Mahalli Dışı (%50 Artırımlı)
                                    </span>
                                </label>
                            </div>

                            {/* Katsayı Bilgilendirme */}
                            <div className="mt-3 bg-indigo-50/30 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-950/30 text-[10px] space-y-1 text-slate-500 dark:text-slate-400 font-bold">
                                <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">ℹ️ Aktif Dönem Katsayısı:</span>
                                <div className="space-y-0.5">
                                    <div>• Maaş Katsayısı: <span className="text-slate-700 dark:text-slate-200">{katsayi.toFixed(6)}</span></div>
                                    <div>• Hesaplamaya Esas Gösterge: <span className="text-slate-700 dark:text-slate-200">{indicator}</span></div>
                                </div>
                            </div>

                        </div>

                        {/* RIGHT: Calculation Sheet */}
                        <div className="lg:col-span-7 flex flex-col h-full justify-between overflow-hidden">
                            <div 
                                id="gorev-print-area"
                                className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-y-auto custom-scrollbar flex-1 max-h-[50vh] lg:max-h-none"
                            >
                                <div className="space-y-4">
                                    {/* Cetvel Header */}
                                    <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                        <h2 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                                            T.C. GENÇLİK VE SPOR BAKANLIĞI
                                        </h2>
                                        <p className="text-[9px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase">
                                            Görevlendirme Ücreti Hesap Bildirimi
                                        </p>
                                    </div>

                                    {/* Summary Grid */}
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-800/80 mb-3">
                                        <div className="space-y-1">
                                            <div className="text-slate-500">Yıl / Dönem: <span className="text-slate-800 dark:text-slate-200">{gorevYear} - {gorevPeriod === "jan_jun" ? "Ocak-Haziran" : "Temmuz-Aralık"}</span></div>
                                            <div className="text-slate-500">Katsayı: <span className="text-slate-800 dark:text-slate-200">{katsayi.toFixed(6)}</span></div>
                                            <div className="text-slate-500">Süre: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{gorevDuration} {unit}</span></div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-slate-500 truncate">Görev / Unvan: <span className="text-slate-800 dark:text-slate-200 font-extrabold" title={roleName}>{roleName}</span></div>
                                            <div className="text-slate-500">Esas Gösterge: <span className="text-slate-800 dark:text-slate-200">{indicator}</span></div>
                                            <div className="text-slate-500">Net Ödenecek: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatYollukCurrency(net)} TL</span></div>
                                        </div>
                                    </div>

                                    {/* Details Table */}
                                    <div className="space-y-1.5">
                                        <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hesaplama Kalemleri</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-[11px] text-left">
                                                <thead>
                                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 uppercase font-black">
                                                        <th className="py-1">Hesap Kalemi</th>
                                                        <th className="py-1 text-right">Formül / Oran</th>
                                                        <th className="py-1 text-right">Tutar (TL)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                                                    <tr>
                                                        <td className="py-1">Brüt Görevlendirme Ücreti</td>
                                                        <td className="py-1 text-right font-mono font-medium text-slate-400">
                                                            {indicator} x {katsayi.toFixed(6)} x {gorevDuration}
                                                        </td>
                                                        <td className="py-1 text-right font-mono">{formatYollukCurrency(gross)} TL</td>
                                                    </tr>
                                                    {gelirVergisi > 0 && (
                                                        <tr className="text-rose-600 dark:text-rose-400">
                                                            <td className="py-1">Gelir Vergisi Kesintisi</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">%{gorevGelirVergisiRate}</td>
                                                            <td className="py-1 text-right font-mono">-{formatYollukCurrency(gelirVergisi)} TL</td>
                                                        </tr>
                                                    )}
                                                    {damgaVergisi > 0 && (
                                                        <tr className="text-rose-600 dark:text-rose-400">
                                                            <td className="py-1">Damga Vergisi Kesintisi</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">
                                                                %{gorevDamgaVergisiRate} (binde {(gorevDamgaVergisiRate * 10).toFixed(3).replace(".", ",")})
                                                            </td>
                                                            <td className="py-1 text-right font-mono">-{formatYollukCurrency(damgaVergisi)} TL</td>
                                                        </tr>
                                                    )}
                                                    {kesintiToplam > 0 && (
                                                        <tr className="text-rose-600 dark:text-rose-400">
                                                            <td className="py-1">Toplam Kesinti Tutarı</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">-</td>
                                                            <td className="py-1 text-right font-mono">-{formatYollukCurrency(kesintiToplam)} TL</td>
                                                        </tr>
                                                    )}
                                                    <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold">
                                                        <td className="py-1">Net Ödenecek Görev Ücreti</td>
                                                        <td className="py-1 text-right">-</td>
                                                        <td className="py-1 text-right font-mono font-extrabold">{formatYollukCurrency(net)} TL</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 leading-normal border-t border-slate-100 dark:border-slate-900 pt-2 whitespace-normal max-w-full">
                                        ℹ️ Görevlendirilen personele, Tablolarda yer alan göstergelerin memur aylık katsayısı ile çarpımı üzerinden ödeme yapılır. Gelir Vergisi ve Damga Vergisi kesintileri yasal oranlara göre düşülür.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 bg-card z-10">
                                <Button 
                                    type="button"
                                    onClick={() => setIsGorevModalOpen(false)}
                                    className="h-10 px-5 rounded-xl font-bold text-slate-500 text-xs"
                                >
                                    Kapat
                                </Button>
                                <div className="flex gap-2">
                                    <Button 
                                        type="button"
                                        onClick={handlePrintGorev}
                                        className="h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black uppercase text-[10px] tracking-widest border border-slate-200/50 dark:border-slate-700"
                                    >
                                        Yazdır
                                    </Button>
                                    <Button 
                                        type="button"
                                        onClick={handleExportGorevExcel}
                                        className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/10"
                                    >
                                        Excel İndir
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>,
            document.body
        );
    };

    const renderIhale2Modal = () => {
        if (!isIhale2ModalOpen) return null;

        // 2026 - 2027 Parasal Limitleri
        // const ESIK_DEGER_MAL_HIZMET_GENEL = 18734124;
        // const ESIK_DEGER_MAL_HIZMET_DIGER = 31223628;
        const ESIK_DEGER_YAPIM = 686924429;
        const PAZARLIK_LIMIT_21F = 3406508;
        const DOGRUDAN_TEMIN_METROPOL = 1021827;
        const DOGRUDAN_TEMIN_DIGER = 340391;
        const ILAN_LIMIT_13B_1 = 2043844;
        const ILAN_LIMIT_13B_2 = 4087898;
        const SINIR_DEGER_ACIKLAMA_ZORUNLULUK_LIMITI = 228974810;

        // Harç hesaplama fonksiyonu
        const calculateHarc = (maliyet: number): number => {
            if (maliyet <= 10785492) return 64652;
            if (maliyet <= 43142132) return 129385;
            if (maliyet <= 323566103) return 194085;
            return 258810;
        };

        // Date helper (backwards offset)
        const getOffsetDateString = (dateStr: string, days: number): string => {
            if (!dateStr) return "-";
            try {
                const date = new Date(dateStr);
                date.setDate(date.getDate() - days);
                return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
            } catch {
                return "-";
            }
        };

        // BD-2.2 İlan Süreleri
        let ilanRule2 = "";
        let ilanEnGecTarih = "";
        if (ihale2Maliyet >= ESIK_DEGER_YAPIM) {
            ilanRule2 = "Eşik Değer Üstü: İhale tarihinden en az 40 gün önce Kamu İhale Bülteninde ilan yayımlanmalıdır.";
            ilanEnGecTarih = getOffsetDateString(ihale2Tarihi, 40);
        } else if (ihale2Maliyet < ILAN_LIMIT_13B_1) {
            ilanRule2 = "Limit Altı (Grup 1): İhale tarihinden en az 7 gün önce yerel gazete ve internet haber sitesinde ilan yayımlanmalıdır.";
            ilanEnGecTarih = getOffsetDateString(ihale2Tarihi, 7);
        } else if (ihale2Maliyet >= ILAN_LIMIT_13B_1 && ihale2Maliyet < ILAN_LIMIT_13B_2) {
            ilanRule2 = "Limit Altı (Grup 2): İhale tarihinden en az 14 gün önce Kamu İhale Bülteninde ve yerel gazetede ilan yayımlanmalıdır.";
            ilanEnGecTarih = getOffsetDateString(ihale2Tarihi, 14);
        } else {
            ilanRule2 = "Limit Altı (Grup 3): İhale tarihinden en az 21 gün önce Kamu İhale Bülteninde ve yerel gazetede ilan yayımlanmalıdır.";
            ilanEnGecTarih = getOffsetDateString(ihale2Tarihi, 21);
        }

        // Hakediş Kesinti Hesaplamaları
        const hkDonemBrut = Math.max(0, ihale2HakedisGuncelKum - ihale2HakedisOncekiKum);
        const hkKdv = hkDonemBrut * 0.20;
        const hkKdvDahil = hkDonemBrut + hkKdv;
        const hkStopaj = ihale2HakedisSari ? hkDonemBrut * 0.05 : 0;
        const hkDamga = hkDonemBrut * 0.00948;
        const hkEkTeminat = ihale2HakedisFiyatFarki > 0 ? ihale2HakedisFiyatFarki * 0.06 : 0;
        const hkDanismanlik = (ihale2HakedisTur === "danismanlik") ? hkDonemBrut * 0.06 : 0;
        const hkAvansMahsup = hkDonemBrut * (ihale2HakedisAvansOran / 100);
        const hkToplamKesinti = hkStopaj + hkDamga + hkEkTeminat + hkDanismanlik + hkAvansMahsup + ihale2HakedisCezalar;
        const hkNetOdenecek = hkKdvDahil - hkToplamKesinti;

        let limit22dVal = ihale2IsMetropol ? DOGRUDAN_TEMIN_METROPOL : DOGRUDAN_TEMIN_DIGER;
        let suggestedUsul2 = "";
        if (ihale2Maliyet <= limit22dVal) {
            suggestedUsul2 = "Doğrudan Temin (Madde 22/d) Uygulanabilir";
        } else if (ihale2Maliyet <= PAZARLIK_LIMIT_21F) {
            suggestedUsul2 = "Pazarlık Usulü (Madde 21/f) Uygulanabilir";
        } else {
            suggestedUsul2 = "Açık İhale Usulü (Madde 19) Veya Belli İstekliler Arasında İhale (Madde 20) Zorunludur";
        }

        const handleNextStep2 = () => {
            if (ihale2Step === 1) {
                const isValid = ihale2ProjeBedeli > 0 && ihale2IlkYilOdenebi >= ihale2ProjeBedeli * 0.10;
                if (!isValid) {
                    setIhale2CancelledReason("Yıllara sari yapım işlerinde ilk yıl ödeneği toplam proje bedelinin en az %10'u olmalıdır. (4734 Sayılı Kanun Madde 62/a)");
                    return;
                }
            } else if (ihale2Step === 2) {
                if (ihale2IsBina) {
                    const isValid = ihale2ImarDurumu && ihale2ProjeHazir && ihale2ArsaTeslimi;
                    if (!isValid) {
                        setIhale2CancelledReason("Bina inşaatlarında arsa temin edilmeden, mülkiyet/kamulaştırma işlemleri tamamlanmadan ve uygulama projesi hazırlanmadan ihale süreci başlatılamaz. (4734 Sayılı Kanun Madde 62/c)");
                        return;
                    }
                }
            } else if (ihale2Step === 4) {
                const isValid = ihale2KomisyonUye >= 5 && ihale2KomisyonUye % 2 === 1;
                if (!isValid) {
                    setIhale2CancelledReason("İhale komisyonu en az 5 ve tek sayıda kişiden oluşmalıdır. (4734 Sayılı Kanun Madde 6)");
                    return;
                }
            } else if (ihale2Step === 5) {
                if (ihale2ZeyilnameYapildi) {
                    let zeyilnameDiff = -1;
                    if (ihale2Tarihi && ihale2ZeyilnameTarihi) {
                        const d1 = new Date(ihale2Tarihi);
                        const d2 = new Date(ihale2ZeyilnameTarihi);
                        zeyilnameDiff = Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                    }
                    if (zeyilnameDiff < 10) {
                        setIhale2CancelledReason("Zeyilname düzenlenmesi halinde, ihale tarihine en az 10 gün kala teklif sahiplerine bildirilmelidir. Aksi halde ihale ertelenmeli veya iptal edilmelidir. (4734 Sayılı Kanun Madde 29)");
                        return;
                    }
                }
            } else if (ihale2Step === 6) {
                if (ihale2Maliyet >= 228974810) {
                    if (!ihale2AsiriDusukSorgulandi) {
                        setIhale2CancelledReason("Yaklaşık maliyeti 228.974.810 TL üzerindeki yapım işlerinde sınır değerin altında kalan isteklilerden aşırı düşük teklif açıklaması istenmesi yasal zorunluluktur. (4734 Sayılı Kanun Madde 38)");
                        return;
                    }
                }
            } else if (ihale2Step === 7) {
                let standStillDiff = -1;
                if (sozlesmeTarihi && ihale2KararTarihi) {
                    const d1 = new Date(sozlesmeTarihi);
                    const d2 = new Date(ihale2KararTarihi);
                    standStillDiff = Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                }
                const minWaitDays = ihale2Maliyet <= 3406508 ? 5 : 10;
                if (standStillDiff < minWaitDays) {
                    setIhale2CancelledReason(`İhale kararının bildirilmesinden itibaren şikayet ve itirazen şikayet bekleme süreleri (${minWaitDays} gün) geçmeden sözleşme imzalanamaz. Erken imzalanan sözleşmeler mevzuata aykırıdır. (4734 Sayılı Kanun Madde 55 & 56)`);
                    return;
                }
            }

            setIhale2History(prev => [...prev, ihale2Step]);
            setIhale2Step(prev => prev + 1);
        };

        const handlePrevStep2 = () => {
            if (ihale2History.length > 0) {
                const prev = ihale2History[ihale2History.length - 1];
                setIhale2History(ihale2History.slice(0, -1));
                setIhale2Step(prev);
            }
        };

        let stepTitle = "";
        let stepSubtitle = "";
        let stepContent = null;

        if (ihale2CancelledReason !== "") {
            return createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <Card className="w-full max-w-2xl p-8 rounded-[32px] bg-card border-red-500/30 dark:border-red-900/30 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300 font-outfit">
                        <div className="p-4 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full mb-6">
                            <AlertTriangle size={48} />
                        </div>
                        <h3 className="text-xl font-black text-red-600 dark:text-red-400 mb-2">Süreç İptal Edildi</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold max-w-md mb-6 leading-relaxed">
                            Mevzuata aykırılık tespit edildiği için ihale süreci durdurulmuştur.
                        </p>
                        <div className="w-full bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/20 p-4 rounded-2xl text-xs font-black text-red-700 dark:text-red-300 mb-8 max-w-lg">
                            {ihale2CancelledReason}
                        </div>
                        <Button 
                            onClick={resetIhale2}
                            className="rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs px-6 py-3 shadow-lg shadow-red-600/20 transition-all border-none"
                        >
                            Süreci Sıfırla
                        </Button>
                    </Card>
                </div>,
                document.body
            );
        }

        switch (ihale2Step) {
            case 1:
                stepTitle = "Ödenek ve Bütçe Planlaması";
                stepSubtitle = "Projenin toplam bedeli ile ilk yıl bütçe ödeneği oranını doğrulayın.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Toplam Proje Bedeli (TL)</label>
                            <input 
                                type="number" 
                                value={ihale2ProjeBedeli || ""}
                                min={0}
                                onChange={(e) => setIhale2ProjeBedeli(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                placeholder="Toplam proje maliyetini girin"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">İlk Yıl Ödeneği (TL)</label>
                            <input 
                                type="number" 
                                value={ihale2IlkYilOdenebi || ""}
                                min={0}
                                onChange={(e) => setIhale2IlkYilOdenebi(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                placeholder="İlk yıl için tahsis edilen ödenek tutarı"
                            />
                        </div>
                        {ihale2ProjeBedeli > 0 && (
                            <div className={cn("p-4 rounded-2xl border text-xs font-bold flex flex-col gap-1", 
                                ihale2IlkYilOdenebi >= ihale2ProjeBedeli * 0.10 
                                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                    : "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/20 text-red-700 dark:text-red-300"
                            )}>
                                <div>Gerekli Minimum İlk Yıl Ödeneği (%10): {formatYollukCurrency(ihale2ProjeBedeli * 0.10)} TL</div>
                                <div>Mevcut İlk Yıl Ödeneği Oranı: %{((ihale2IlkYilOdenebi / ihale2ProjeBedeli) * 100).toFixed(2)}</div>
                            </div>
                        )}
                    </div>
                );
                break;
            case 2:
                stepTitle = "Yapım İşi Ön Şartları";
                stepSubtitle = "Yapım projesine başlanabilmesi için yasal zorunlulukları kontrol edin.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Bina Yapım / İnşaat İşi mi?</div>
                                <div className="text-[9px] text-slate-400">Bina inşaat projelerinde imar, proje ve mülkiyet şartları aranır.</div>
                            </div>
                            <input 
                                type="checkbox"
                                checked={ihale2IsBina}
                                onChange={(e) => setIhale2IsBina(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>

                        {ihale2IsBina && (
                            <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bina Yapım İşleri Yasal Şartları</h5>
                                
                                <div className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">İmar Durumu Alındı mı?</div>
                                        <div className="text-[9px] text-slate-400">İşin yapılacağı arsa için imar uygunluk onayı.</div>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={ihale2ImarDurumu}
                                        onChange={(e) => setIhale2ImarDurumu(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Uygulama Projesi Hazır mı?</div>
                                        <div className="text-[9px] text-slate-400">Ön proje veya avan proje ile bina yapım ihalesi yapılamaz.</div>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={ihale2ProjeHazir}
                                        onChange={(e) => setIhale2ProjeHazir(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Mülkiyet / Kamulaştırma ve Yer Teslimi Hazır mı?</div>
                                        <div className="text-[9px] text-slate-400">Arsa tesliminde engel bulunmaması şarttır.</div>
                                    </div>
                                    <input 
                                        type="checkbox"
                                        checked={ihale2ArsaTeslimi}
                                        onChange={(e) => setIhale2ArsaTeslimi(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
                break;
            case 3:
                stepTitle = "Yaklaşık Maliyet ve İhale Usulü";
                stepSubtitle = "Yaklaşık maliyetinizi belirleyin ve en uygun ihale usulü önerisini alın.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Yaklaşık Maliyet (TL)</label>
                            <input 
                                type="number" 
                                value={ihale2Maliyet || ""}
                                min={0}
                                onChange={(e) => setIhale2Maliyet(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                placeholder="Yaklaşık maliyet girin"
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Büyükşehir / Metropol İlçe Sınırları</div>
                                <div className="text-[9px] text-slate-400">Doğrudan temin limitleri büyükşehirlerde daha yüksektir.</div>
                            </div>
                            <input 
                                type="checkbox"
                                checked={ihale2IsMetropol}
                                onChange={(e) => setIhale2IsMetropol(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">İdare Nitelik Tipi</label>
                            <select
                                value={ihale2IdareTipi}
                                onChange={(e) => setIhale2IdareTipi(e.target.value as "genel" | "diger")}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                            >
                                <option value="genel">Genel Bütçeli İdareler</option>
                                <option value="diger">Diğer Kamu Kurumları (KİT, Belediye vb.)</option>
                            </select>
                        </div>
                        {ihale2Maliyet > 0 && (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                <div>Önerilen İhale Yöntemi:</div>
                                <div className="text-sm font-extrabold mt-1 text-indigo-900 dark:text-white">{suggestedUsul2}</div>
                            </div>
                        )}
                    </div>
                );
                break;
            case 4:
                stepTitle = "İhale Komisyonu Kurulumu";
                stepSubtitle = "Komisyon üye sayısının yasal şartlara uygunluğunu doğrulayın.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Komisyon Üye Sayısı</label>
                            <input 
                                type="number" 
                                value={ihale2KomisyonUye || ""}
                                min={0}
                                onChange={(e) => setIhale2KomisyonUye(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                placeholder="Komisyon üye sayısını girin"
                            />
                        </div>
                        <div className={cn("p-4 rounded-2xl border text-xs font-bold flex flex-col gap-1", 
                            ihale2KomisyonUye >= 5 && ihale2KomisyonUye % 2 === 1
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/20 text-red-700 dark:text-red-300"
                        )}>
                            <div>Minimum Komisyon Üye Sayısı: En az 5 Üye</div>
                            <div>Komisyon Üye Sayısı Çift/Tek: {ihale2KomisyonUye % 2 === 1 ? "TEK SAYI (UYGUN)" : "ÇİFT SAYI (UYGUN DEĞİL)"}</div>
                        </div>
                    </div>
                );
                break;
            case 5:
                stepTitle = "İlan Süresi ve Zeyilname Kontrolü";
                stepSubtitle = "İlan süreleri ile zeyilname bildirim tarihlerinin mevzuata uygunluğunu kontrol edin.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Planlanan İhale Tarihi</label>
                            <input 
                                type="date" 
                                value={ihale2Tarihi}
                                onChange={(e) => setIhale2Tarihi(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                            />
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            <div>Yasal İlan Kuralı:</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">{ilanRule2}</div>
                            <div className="mt-1">İlanın Yayımlanması Gereken En Geç Tarih: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{ilanEnGecTarih}</span></div>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Zeyilname Düzenlendi mi?</div>
                                <div className="text-[9px] text-slate-400">İhale dokümanında bir değişiklik yapıldı mı?</div>
                            </div>
                            <input 
                                type="checkbox"
                                checked={ihale2ZeyilnameYapildi}
                                onChange={(e) => setIhale2ZeyilnameYapildi(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>

                        {ihale2ZeyilnameYapildi && (
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Zeyilname Bildirim Tarihi</label>
                                <input 
                                    type="date" 
                                    value={ihale2ZeyilnameTarihi}
                                    onChange={(e) => setIhale2ZeyilnameTarihi(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                />
                                {ihale2Tarihi && ihale2ZeyilnameTarihi && (
                                    <div className="text-[10px] text-slate-400 font-bold mt-2">
                                        İhale Tarihine Kalan Gün: {
                                            Math.ceil((new Date(ihale2Tarihi).getTime() - new Date(ihale2ZeyilnameTarihi).getTime()) / (1000 * 60 * 60 * 24))
                                        } Gün (En az 10 gün olmalıdır)
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
                break;
            case 6:
                stepTitle = "Teklifler ve Aşırı Düşük Teklif Kontrolü";
                stepSubtitle = "Sınır değer altındaki tekliflerin yasal sorgulama durumunu denetleyin.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            <div>Maliyet Eşik Değer Durumu:</div>
                            <div className="font-extrabold text-slate-850 dark:text-white mt-1">
                                {formatYollukCurrency(ihale2Maliyet)} TL
                            </div>
                            <div className="mt-1">
                                Aşırı Düşük Teklif Sınır Değer Limit (Yapım Eşik Değerinin 1/3'ü): <span className="font-bold text-red-500">{formatYollukCurrency(SINIR_DEGER_ACIKLAMA_ZORUNLULUK_LIMITI)} TL</span>
                            </div>
                            {ihale2Maliyet >= SINIR_DEGER_ACIKLAMA_ZORUNLULUK_LIMITI ? (
                                <div className="text-red-500 font-black mt-2">
                                    ⚠️ Bu ihalede sınır değerin altında kalan isteklilerden Aşırı Düşük Teklif Açıklaması istenmesi zorunludur!
                                </div>
                            ) : (
                                <div className="text-emerald-500 font-black mt-2">
                                    ✓ Bu ihale limiti sınır değer sorgulama zorunluluğunun altındadır (Sorgulama opsiyoneldir).
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                            <div>
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Aşırı Düşük Teklif Sorgulaması Yapıldı mı?</div>
                                <div className="text-[9px] text-slate-400">Sınır değerin altındaki teklif sahiplerinden yasal açıklama istendi mi?</div>
                            </div>
                            <input 
                                type="checkbox"
                                checked={ihale2AsiriDusukSorgulandi}
                                onChange={(e) => setIhale2AsiriDusukSorgulandi(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                );
                break;
            case 7:
                stepTitle = "İhale Kararı ve Şikâyet Bekleme Süresi (Stand-Still)";
                stepSubtitle = "Sözleşme imzalanabilmesi için yasal şikayet bekleme sürelerini doğrulayın.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">İhale Karar Tarihi</label>
                            <input 
                                type="date" 
                                value={ihale2KararTarihi}
                                onChange={(e) => setIhale2KararTarihi(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Sözleşme İmzalama Tarihi</label>
                            <input 
                                type="date" 
                                value={sozlesmeTarihi}
                                onChange={(e) => setSozlesmeTarihi(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                            />
                        </div>
                        {ihale2KararTarihi && sozlesmeTarihi && (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 space-y-2">
                                <div>İki Tarih Arasındaki Bekleme Süresi: {
                                    Math.ceil((new Date(sozlesmeTarihi).getTime() - new Date(ihale2KararTarihi).getTime()) / (1000 * 60 * 60 * 24))
                                } Gün</div>
                                <div className="mt-1">
                                    Mevzuata Göre Gerekli Minimum Bekleme Süresi: <span className="text-indigo-600 dark:text-indigo-400">{ihale2Maliyet <= 3406508 ? 5 : 10} Gün</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-400">
                                    KİK İtirazen Şikâyet Başvuru Harcı: <span className="text-emerald-500">{formatYollukCurrency(calculateHarc(ihale2Maliyet))} TL</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
                break;
            case 8:
                stepTitle = "Yürütme Aşaması, Hakediş ve Kesintiler";
                stepSubtitle = "Hakediş hesaplamalarını yapın ve yasal kesintileri inceleyin.";
                stepContent = (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-y-auto">
                        <div className="space-y-4 pr-1">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Hakediş Türü</label>
                                <select
                                    value={ihale2HakedisTur}
                                    onChange={(e) => setIhale2HakedisTur(e.target.value as "yapim" | "danismanlik" | "diger")}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                >
                                    <option value="yapim">Yapım İşi Hakedişi</option>
                                    <option value="danismanlik">Danışmanlık Hizmet Alımı Hakedişi</option>
                                    <option value="diger">Diğer Hizmet/Mal Hakedişi</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                <div>
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Yıllara Sari Sözleşme mi?</div>
                                    <div className="text-[9px] text-slate-400">Yıllara sari işlerde %5 stopaj kesintisi uygulanır.</div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={ihale2HakedisSari}
                                    onChange={(e) => setIhale2HakedisSari(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Güncel Küm. Brüt (TL)</label>
                                    <input 
                                        type="number" 
                                        value={ihale2HakedisGuncelKum || ""}
                                        min={0}
                                        onChange={(e) => setIhale2HakedisGuncelKum(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        placeholder="Kümülatif toplam brüt tutar"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Önceki Küm. Brüt (TL)</label>
                                    <input 
                                        type="number" 
                                        value={ihale2HakedisOncekiKum || ""}
                                        min={0}
                                        onChange={(e) => setIhale2HakedisOncekiKum(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        placeholder="Önceki hakediş brüt tutarı"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Fiyat Farkı Tutarı (TL)</label>
                                    <input 
                                        type="number" 
                                        value={ihale2HakedisFiyatFarki || ""}
                                        min={0}
                                        onChange={(e) => setIhale2HakedisFiyatFarki(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        placeholder="Varsa ödenen fiyat farkı"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Kesilen Cezalar (TL)</label>
                                    <input 
                                        type="number" 
                                        value={ihale2HakedisCezalar || ""}
                                        min={0}
                                        onChange={(e) => setIhale2HakedisCezalar(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        placeholder="Ceza kesinti tutarı"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Avans Mahsup Oranı (%)</label>
                                    <input 
                                        type="number" 
                                        value={ihale2HakedisAvansOran || ""}
                                        min={0}
                                        max={100}
                                        onChange={(e) => setIhale2HakedisAvansOran(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        placeholder="Avans kesintisi yüzdesi"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl h-[34px]">
                                        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">SGK İlişiksizlik Belgesi</div>
                                        <input 
                                            type="checkbox"
                                            checked={ihale2SgkBelgesi}
                                            onChange={(e) => setIhale2SgkBelgesi(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Hakediş Ödeme Detayları</h4>
                            
                            <div className="space-y-2 text-xs font-bold text-slate-700 dark:text-slate-350">
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855">
                                    <span>Dönem Brüt Tutarı (Güncel - Önceki):</span>
                                    <span className="font-mono text-slate-900 dark:text-white">{formatYollukCurrency(hkDonemBrut)} TL</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855">
                                    <span>KDV Tutarı (%20):</span>
                                    <span className="font-mono text-emerald-500">+{formatYollukCurrency(hkKdv)} TL</span>
                                </div>
                                {hkStopaj > 0 && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                        <span>Stopaj Kesintisi (%5):</span>
                                        <span className="font-mono">-{formatYollukCurrency(hkStopaj)} TL</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                    <span>Damga Vergisi Kesintisi (%0.948):</span>
                                    <span className="font-mono">-{formatYollukCurrency(hkDamga)} TL</span>
                                </div>
                                {hkEkTeminat > 0 && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                        <span>Ek Kesin Teminat Kesintisi (%6 Fiyat Farkı):</span>
                                        <span className="font-mono">-{formatYollukCurrency(hkEkTeminat)} TL</span>
                                    </div>
                                )}
                                {hkDanismanlik > 0 && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                        <span>Danışmanlık Kesintisi (%6):</span>
                                        <span className="font-mono">-{formatYollukCurrency(hkDanismanlik)} TL</span>
                                    </div>
                                )}
                                {hkAvansMahsup > 0 && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                        <span>Avans Mahsubu:</span>
                                        <span className="font-mono">-{formatYollukCurrency(hkAvansMahsup)} TL</span>
                                    </div>
                                )}
                                {ihale2HakedisCezalar > 0 && (
                                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-855 text-red-500">
                                        <span>Gecikme / İdari Cezalar:</span>
                                        <span className="font-mono">-{formatYollukCurrency(ihale2HakedisCezalar)} TL</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-2 border-t-2 border-slate-300 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
                                    <span>Net Ödenecek Tutar:</span>
                                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatYollukCurrency(hkNetOdenecek)} TL</span>
                                </div>
                            </div>

                            {!ihale2SgkBelgesi && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/35 rounded-2xl text-[10px] font-black text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-2">
                                    <AlertTriangle size={18} className="shrink-0 text-amber-500 mt-0.5" />
                                    <div>
                                        <strong>⚠️ UYARI:</strong> SGK İlişiksizlik belgesi sunulmadığı için hakediş ödemesi yapılabilir ancak kesin teminat iadesi bloke edilmelidir! (4735 Sayılı Kanun Madde 13)
                                    </div>
                                </div>
                            )}
                            {ihale2SgkBelgesi && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl text-[10px] font-black text-emerald-700 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
                                    <Check size={18} className="shrink-0 text-emerald-500 mt-0.5" />
                                    <div>
                                        <strong>✓ SGK ONAYI:</strong> İlişiksizlik belgesi ibraz edildi, kesin teminat iadesi yapılabilir.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
                break;
            default:
                break;
        }

        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-5xl p-6 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 font-outfit">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <Shield size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">İhale ve Sözleşme Süreç Kontrolü 2</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Uçtan Uca Kamu İhale Kontrol Listesi ve Hesaplama Motoru (2026-2027 Limitleri)</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsIhale2ModalOpen(false)} 
                            className="rounded-xl h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center bg-transparent border-transparent"
                        >
                            <X size={16} />
                        </Button>
                    </div>

                    {/* Step Title & Subtitle */}
                    <div className="mb-4 shrink-0 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                                Adım {ihale2Step} / 8
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">2026-2027 Mevzuat Karar Ağacı</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase mt-1">{stepTitle}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">{stepSubtitle}</p>
                    </div>

                    {/* Step Content Area */}
                    <div className="flex-1 overflow-y-auto pr-1 min-h-0 mb-4 bg-white dark:bg-transparent">
                        {stepContent}
                    </div>

                    {/* Navigation Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0">
                        <Button
                            onClick={resetIhale2}
                            variant="ghost"
                            className="rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
                        >
                            Sıfırla
                        </Button>
                        <div className="flex gap-2">
                            {ihale2Step > 1 && (
                                <Button
                                    onClick={handlePrevStep2}
                                    variant="outline"
                                    className="rounded-xl font-bold text-xs border-slate-200 dark:border-slate-700"
                                >
                                    Geri
                                </Button>
                            )}
                            <Button
                                onClick={ihale2Step === 8 ? () => setIsIhale2ModalOpen(false) : handleNextStep2}
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 border-none"
                            >
                                {ihale2Step === 8 ? "Kapat" : "Devam Et"}
                            </Button>
                        </div>
                    </div>

                </Card>
            </div>,
            document.body
        );
    };    const renderHakedisModal = () => {
        if (!isHakedisModalOpen) return null;
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300">
                <div className="bg-card w-full h-full rounded-[32px] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 flex flex-col font-outfit">
                    <div className="p-4 md:p-6 bg-indigo-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield size={20} />
                            <h3 className="text-lg font-black tracking-tight">Hakediş ve Kesinti Hesaplama Cetveli</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => window.open("/hakedis_hesaplama.html", "_blank")}
                                className="rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold"
                            >
                                <ExternalLink size={14} className="mr-2" /> Yeni Sekmede Aç
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => setIsHakedisModalOpen(false)} 
                                className="rounded-xl text-white hover:bg-white/10 h-10 w-10 flex items-center justify-center"
                            >
                                <X size={20} />
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-955 relative">
                        <iframe 
                            src="/hakedis_hesaplama.html" 
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

                                        <div className="mt-2 bg-indigo-50/30 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-950/30 text-[10px] space-y-1 text-slate-500 dark:text-slate-400">
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">ℹ️ {yollukYear} Yılı Resmi H-Cetveli Gündelikleri:</span>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-bold">
                                                <div>• Der. 5-15: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"]).der_5_15} TL</span></div>
                                                <div>• Der. 1-4: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"]).der_1_4} TL</span></div>
                                                <div>• Ek Gös. 3600-6400: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"]).ek_3600_6400} TL</span></div>
                                                <div>• Ek Gös. 6400-8000: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"]).ek_6400_8000} TL</span></div>
                                                <div className="col-span-2">• Ek Gös. 8000+: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_H_RATES[yollukYear] || YOLLUK_H_RATES["2026"]).ek_8000_plus} TL</span></div>
                                            </div>
                                        </div>
                                        <p className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 leading-normal border-t border-slate-100 dark:border-slate-900 pt-2 whitespace-normal max-w-full">
                                            * Kamu görevlileri hakem kurulunun 29/05/2012 tarihli ve 2012/1 nolu kararı ile 1/7/2012 tarihinden geçerli olmak üzere, 375 sayılı Kanun Hükmünde Kararnamenin 1. maddesinin (D) fıkrasında yer alan 12105 gösterge rakamı 13558 olarak uygulanır hükmüne yer verilmiştir.
                                        </p>
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

    const handlePrintLojman = () => {
        const printContent = document.getElementById("lojman-print-area")?.innerHTML;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(`
                <html>
                <head>
                    <title>Lojman Kira Hesaplama Raporu</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        h2 { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #0f172a; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; text-transform: uppercase; }
                        .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9; }
                        .info-item { font-size: 13px; font-weight: 600; color: #475569; }
                        .info-item span { font-weight: 800; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                        th { background-color: #f1f5f9; color: #475569; font-weight: 800; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
                        td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }
                        .total-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 16px; padding: 20px; text-align: right; margin-top: 20px; }
                        .total-label { font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
                        .total-val { font-size: 28px; font-weight: 900; color: #1e3a8a; margin-top: 5px; }
                        .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
                </html>
            `);
            win.document.close();
        }
    };

    const handleExportLojmanExcel = () => {
        const {
            baseRate,
            discountPct,
            kapiciRate,
            elektrikRate,
            suRate,
            elektrikSuRate,
            kuyuSuRate,
            yakitRate,
            ortakAlanRate
        } = calculateLojmanValues();

        const wb = XLSX.utils.book_new();
        const data = [
            ["LOJMAN KİRA HESAPLAMA RAPORU"],
            ["Tarih", new Date().toLocaleDateString("tr-TR")],
            [],
            ["Hesaplama Parametreleri", "Değer"],
            ["Hesaplama Yılı", lojmanYear],
            ["Lojman Türü", lojmanType === "kerpic" ? "Kerpiç, ahşap, bağdadi ve benzeri" : lojmanType === "kalorifersiz" ? "Kalorifersiz" : "Kaloriferli"],
            ["Lojman Metrekaresi", { t: "n", v: lojmanM2, z: "#,##0" }],
            ["Bulunduğu İl", lojmanCity],
            ["İndirim Grubu", lojmanDiscountGroup.toUpperCase()],
            ["İndirim Oranı", { t: "n", v: discountPct, z: "0%" }],
            [],
            ["Hesaplama Detayları", "Birim Değer (TL/m²)", "Aylık Tutar (TL)"],
            ["İndirimsiz Birim Kira", { t: "n", v: baseRate, z: "#,##0.00" }, { t: "n", f: "B$9*B14", z: "#,##0.00" }],
            ["İndirim Tutarı", { t: "n", f: "B14*B12", z: "#,##0.00" }, { t: "n", f: "B$9*B15", z: "#,##0.00" }],
            ["İndirimli Birim Kira", { t: "n", f: "B14-B15", z: "#,##0.00" }, { t: "n", f: "B$9*B16", z: "#,##0.00" }],
            [],
            ["İlave Gider Kalemleri", "Birim Değer (TL/m²)", "Aylık Tutar (TL)"],
            ["Kapıcı / Kaloriferci", { t: "n", v: kapiciRate, z: "#,##0.00" }, { t: "n", f: "B$9*B19", z: "#,##0.00" }],
            ["Elektrik (Sayaçsız)", { t: "n", v: elektrikRate, z: "#,##0.00" }, { t: "n", f: "B$9*B20", z: "#,##0.00" }],
            ["Su (Sayaçsız)", { t: "n", v: suRate, z: "#,##0.00" }, { t: "n", f: "B$9*B21", z: "#,##0.00" }],
            ["Elektrik + Su (Sayaçsız)", { t: "n", v: elektrikSuRate, z: "#,##0.00" }, { t: "n", f: "B$9*B22", z: "#,##0.00" }],
            ["Kuyu / Artezyen Suyu", { t: "n", v: kuyuSuRate, z: "#,##0.00" }, { t: "n", f: "B$9*B23", z: "#,##0.00" }],
            ["Kurumca Tedarik Edilen Yakıt", { t: "n", v: yakitRate, z: "#,##0.00" }, { t: "n", f: "B$9*B24", z: "#,##0.00" }],
            ["Ortak Alan Giderleri", { t: "n", v: ortakAlanRate, z: "#,##0.00" }, { t: "n", f: "B$9*B25", z: "#,##0.00" }],
            ["İlave Giderler Toplamı", { t: "n", f: "SUM(B19:B25)", z: "#,##0.00" }, { t: "n", f: "SUM(C19:C25)", z: "#,##0.00" }],
            [],
            ["TOPLAM SONUÇLAR", "Birim Değer (TL/m²)", "Aylık Tutar (TL)"],
            ["Nihai Birim Kira Bedeli", { t: "n", f: "B16+B26", z: "#,##0.00" }, { t: "n", f: "C16+C26", z: "#,##0.00" }],
            ["Aylık Toplam Lojman Kirası", "", { t: "n", f: "C29", z: "#,##0.00" }],
            ["Günlük Lojman Kirası (30 Gün Üzerinden)", "", { t: "n", f: "C30/30", z: "#,##0.00" }]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data as any[][]);
        XLSX.utils.book_append_sheet(wb, ws, "Lojman Kira Raporu");
        XLSX.writeFile(wb, `Lojman_Kira_Hesaplama_${lojmanYear}_${lojmanCity}.xlsx`);
        toast.success("Excel belgesi indirildi.");
    };

    const handlePrintGorev = () => {
        const printContent = document.getElementById("gorev-print-area")?.innerHTML;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(`
                <html>
                <head>
                    <title>Görevlendirme Ücreti Hesap Raporu</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        h2 { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #0f172a; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; text-transform: uppercase; }
                        .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9; }
                        .info-item { font-size: 13px; font-weight: 600; color: #475569; }
                        .info-item span { font-weight: 800; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                        th { background-color: #f1f5f9; color: #475569; font-weight: 800; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
                        td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }
                        .total-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 16px; padding: 20px; text-align: right; margin-top: 20px; }
                        .total-label { font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
                        .total-val { font-size: 28px; font-weight: 900; color: #1e3a8a; margin-top: 5px; }
                        .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
                </html>
            `);
            win.document.close();
        }
    };

    const handleExportGorevExcel = () => {
        const {
            katsayi,
            indicator,
            unit,
            roleName,
            tableTitle
        } = calculateGorevValues();

        const wb = XLSX.utils.book_new();
        const data = [
            ["GÖREVLENDİRME ÜCRET HESAPLAMA RAPORU"],
            ["Tarih", new Date().toLocaleDateString("tr-TR")],
            [],
            ["Hesaplama Parametreleri", "Değer"],
            ["Hesaplama Yılı / Dönemi", `${gorevYear} - ${gorevPeriod === "jan_jun" ? "Ocak-Haziran" : "Temmuz-Aralık"}`],
            ["İlgili Genelge Tablosu", tableTitle],
            ["Görev / Unvan", roleName],
            ["Kadro Göstergesi", { t: "n", v: indicator, z: "#,##0" }],
            ["Memur Maaş Katsayısı", { t: "n", v: katsayi, z: "0.000000" }],
            ["Görev Süresi (" + unit + ")", { t: "n", v: gorevDuration, z: "#,##0" }],
            [],
            ["Hesaplama Kalemleri", "Oran / Değer", "Tutar (TL)"],
            ["Brüt Görevlendirme Ücreti", "Gösterge x Katsayı x Süre", { t: "n", f: "B8*B9*B10", z: "#,##0.00" }],
            ["Gelir Vergisi Kesintisi", { t: "n", v: gorevGelirVergisiRate / 100, z: "0%" }, { t: "n", f: "C13*B14", z: "#,##0.00" }],
            ["Damga Vergisi Kesintisi", { t: "n", v: gorevDamgaVergisiRate / 100, z: "0.000%" }, { t: "n", f: "C13*B15", z: "#,##0.00" }],
            ["Toplam Kesinti", "", { t: "n", f: "C14+C15", z: "#,##0.00" }],
            ["Net Ödenecek Tutar", "", { t: "n", f: "C13-C16", z: "#,##0.00" }]
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Görev Ücreti Hesaplama");
        XLSX.writeFile(wb, `Gorevlendirme_Ucreti_Hesabi_${gorevYear}.xlsx`);
        toast.success("Excel belgesi indirildi.");
    };

    const handlePrintYolluk = () => {
        const printContent = document.getElementById("yolluk-print-area")?.innerHTML;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(`
                <html>
                <head>
                    <title>Sürekli Görev Yolluğu Raporu</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        h2 { font-size: 20px; font-weight: 800; margin-bottom: 20px; color: #0f172a; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; text-transform: uppercase; }
                        .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9; }
                        .info-item { font-size: 13px; font-weight: 600; color: #475569; }
                        .info-item span { font-weight: 800; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; }
                        th { background-color: #f1f5f9; color: #475569; font-weight: 800; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
                        td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: 700; }
                        .total-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 16px; padding: 20px; text-align: right; margin-top: 20px; }
                        .total-label { font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
                        .total-val { font-size: 28px; font-weight: 900; color: #1e3a8a; margin-top: 5px; }
                        .footer { margin-top: 60px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
                </html>
            `);
            win.document.close();
        }
    };

    const handleExportYollukExcel = () => {
        const {
            yevmiye,
            memurSabit,
            memurDegisken,
            memurYevmiyeTutar,
            memurTotal,
            familyDetails,
            familyTotal,
            familyRelocationTotal,
            familyYolUcretiTotal,
            familyDailyTotal,
            activeGrandTotal,
            emekliCoefficient,
            emekliIndicator,
            emekliGross,
            emekliDamgaTax,
            emekliNet
        } = calculateYollukValues();

        const wb = XLSX.utils.book_new();
        
        if (yollukActiveTab === "memur") {
            const data = [
                ["SÜREKLİ GÖREV YOLLUĞU HESAPLAMA RAPORU (MEMUR)"],
                ["Tarih", new Date().toLocaleDateString("tr-TR")],
                [],
                ["Hesaplama Parametreleri", "Değer"],
                ["Hesaplama Yılı", yollukYear + " Yılı"],
                ["Kadro Derecesi / Unvanı", yollukGrade === "custom" ? "Özel Gündelik" : yollukGrade === "ek_8000_plus" ? "Ek Gösterge 8000+" : yollukGrade === "ek_6400_8000" ? "Ek Gösterge 6400-8000" : yollukGrade === "ek_3600_6400" ? "Ek Gösterge 3600-6400" : yollukGrade === "der_1_4" ? "Kadro Derecesi 1-4" : "Kadro Derecesi 5-15"],
                ["Harcırah Gündeliği (Yevmiye)", formatYollukCurrency(yevmiye) + " TL"],
                ["Mesafe (Km)", yollukDistance + " km"],
                ["Memur Yol Ücreti", formatYollukCurrency(yollukMemurYolUcreti) + " TL"],
                ["Aile Fertleri Sayısı", familyDetails.length + " Kişi"],
                [],
                ["Memur Hesaplama Detayları", "Detay", "Tutar (TL)"],
                ["Sabit Unsur (Yevmiye x 20)", `${formatYollukCurrency(yevmiye)} x 20`, formatYollukCurrency(memurSabit)],
                ["Değişken Unsur (Yevmiye x Km x %5)", `${formatYollukCurrency(yevmiye)} x ${yollukDistance} x %5`, formatYollukCurrency(memurDegisken)],
                ["Seyahat Harcırahı (Yevmiye x 1)", `${formatYollukCurrency(yevmiye)} x 1`, formatYollukCurrency(memurYevmiyeTutar)],
                ["Memur Yol Ücreti (Bilet)", "", formatYollukCurrency(yollukMemurYolUcreti)],
                ["Memur Toplam Yolluğu", "", formatYollukCurrency(memurTotal)],
                []
            ];

            if (familyDetails.length > 0) {
                data.push(["Aile Fertleri Yolluk Detayları", "Bilet Ücreti (TL)", "Harcırah (TL)", "Yer Değiştirme Masrafı (TL)", "Toplam (TL)"]);
                familyDetails.forEach((f, idx) => {
                    data.push([
                        `${idx + 1}. Aile Ferdi (${f.relation})`,
                        formatYollukCurrency(f.yolUcreti),
                        formatYollukCurrency(f.dailyAllowance),
                        formatYollukCurrency(f.relocationAllowance),
                        formatYollukCurrency(f.total)
                    ]);
                });
                data.push([]);
                data.push(["Aile Fertleri Toplamları", "", "", "", ""]);
                data.push(["Toplam Bilet Ücretleri", "", "", "", formatYollukCurrency(familyYolUcretiTotal)]);
                data.push(["Toplam Seyahat Gündelikleri", "", "", "", formatYollukCurrency(familyDailyTotal)]);
                data.push(["Toplam Yer Değiştirme Masrafları (Max 40 Yevmiye)", "", "", "", formatYollukCurrency(familyRelocationTotal)]);
                data.push(["Aile Fertleri Toplam Yolluğu", "", "", "", formatYollukCurrency(familyTotal)]);
                data.push([]);
            }

            data.push(["GENEL TOPLAM SONUÇLAR", "", ""]);
            data.push(["Memur Yolluğu Toplamı", "", formatYollukCurrency(memurTotal) + " TL"]);
            data.push(["Aile Fertleri Yolluğu Toplamı", "", formatYollukCurrency(familyTotal) + " TL"]);
            data.push(["Net Ödenecek Toplam Yolluk (Vergisiz)", "", formatYollukCurrency(activeGrandTotal) + " TL"]);

            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "Memur Tayin Yolluğu");
            XLSX.writeFile(wb, `Memur_Sürekli_Görev_Yolluğu_${yollukYear}.xlsx`);
        } else {
            const data = [
                ["EMEKLİLİK SÜREKLİ GÖREV YOLLUĞU (TAZMİNATI) RAPORU"],
                ["Tarih", new Date().toLocaleDateString("tr-TR")],
                [],
                ["Hesaplama Parametreleri", "Değer"],
                ["Hesaplama Yılı", yollukEmekliYear + " Yılı"],
                ["Katsayı Dönemi", yollukEmekliPeriod === "jan_jun" ? "Ocak - Haziran" : "Temmuz - Aralık"],
                ["Personel Sınıfı", yollukEmekliClass === "kadrolu" ? "Kadrolu / Sözleşmeli Memur" : yollukEmekliClass === "isci" ? "Kamu İşçisi" : "Özel Sınıf"],
                ["Gösterge Rakamı", emekliIndicator],
                ["Memur Maaş Katsayısı", yollukEmekliUseCustomCoefficient ? yollukEmekliCustomCoefficient : emekliCoefficient],
                [],
                ["Hesaplama Kalemleri", "Tutar (TL)"],
                ["Brüt Emeklilik Yolluk Tutarı (Gösterge x Katsayı)", formatYollukCurrency(emekliGross) + " TL"],
                ["Damga Vergisi Kesintisi (%0,759 / binde 7,59)", `-${formatYollukCurrency(emekliDamgaTax)} TL`],
                ["Ödenecek Net Tutar", formatYollukCurrency(emekliNet) + " TL"]
            ];

            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "Emeklilik Yolluğu");
            XLSX.writeFile(wb, `Emeklilik_Yolluğu_Tazminatı_${yollukEmekliYear}.xlsx`);
        }
        
        toast.success("Excel belgesi indirildi.");
    };



    const renderLojmanModal = () => {
        if (!isLojmanModalOpen) return null;
        
        const {
            baseRate,
            discountPct,
            discountAmountRate,
            netBaseRate,
            kapiciRate,
            elektrikRate,
            suRate,
            elektrikSuRate,
            kuyuSuRate,
            yakitRate,
            ortakAlanRate,
            monthlyRent,
            dailyRent
        } = calculateLojmanValues();

        const sortedCities = [...CITY_DISCOUNT_GROUPS].sort((a, b) => a.name.localeCompare(b.name, "tr"));
        const filteredCities = sortedCities.filter(c => c.name.toLowerCase().includes(citySearchQuery.toLowerCase()));

        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-5xl p-5 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Lojman Kira Bedeli Hesaplama</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Milli Emlak Genel Tebliğlerine göre lojman aylık net kirasını hesaplayın.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsLojmanModalOpen(false)} 
                            className="rounded-xl h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={16} />
                        </Button>
                    </div>

                    {/* Main Content Split Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden flex-1">
                        {/* Parameters Form - Left */}
                        <div className="lg:col-span-5 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2.5">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Temel Parametreler</h4>
                                
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Hesaplama Yılı</label>
                                    <select 
                                        value={lojmanYear} 
                                        onChange={(e) => setLojmanYear(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        {Object.keys(LOJMAN_RATES).sort((a,b)=>b.localeCompare(a)).map(yr => (
                                            <option key={yr} value={yr}>{yr} Yılı</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Lojman Türü</label>
                                    <select 
                                        value={lojmanType} 
                                        onChange={(e) => setLojmanType(e.target.value as any)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                    >
                                        <option value="kerpic">Kerpiç, ahşap, bağdadi ve benzeri</option>
                                        <option value="kalorifersiz">Kalorifersiz konutlar</option>
                                        <option value="kaloriferli">Kaloriferli konutlar</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Alan (m²)</label>
                                        <input 
                                            type="number" 
                                            value={lojmanM2 || ""} 
                                            min={1}
                                            max={999}
                                            onChange={(e) => setLojmanM2(Math.max(1, parseInt(e.target.value) || 0))}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wide text-slate-400 block mb-1">Şehir Seçin</label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCityDropdownOpen(!isCityDropdownOpen);
                                                    setCitySearchQuery("");
                                                }}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold text-left flex justify-between items-center text-slate-800 dark:text-slate-200"
                                            >
                                                <span>{lojmanCity || "Şehir Seçin"}</span>
                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>

                                            {isCityDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[1000]" onClick={() => setIsCityDropdownOpen(false)} />
                                                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[1001] max-h-52 flex flex-col overflow-hidden">
                                                        <div className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={citySearchQuery}
                                                                autoFocus
                                                                onChange={(e) => setCitySearchQuery(e.target.value)}
                                                                placeholder="Şehir ara..."
                                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 outline-none text-xs font-bold focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1" style={{scrollbarWidth: 'thin'}}>
                                                            {filteredCities.length > 0 ? (
                                                                filteredCities.map(c => (
                                                                    <button
                                                                        key={c.name}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setLojmanCity(c.name);
                                                                            setIsCityDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-1.5 text-xs font-bold transition-all flex justify-between items-center ${c.name === lojmanCity ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                                                                    >
                                                                        <span>{c.name}</span>
                                                                        {c.name === lojmanCity && (
                                                                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-3 py-2 text-xs font-semibold text-slate-400 text-center">Eşleşme yok</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">İndirim Grubu</label>
                                        <div className="relative group">
                                            <svg className="w-3 h-3 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="absolute bottom-full left-0 mb-1.5 w-72 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-medium leading-relaxed rounded-lg px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                                                Kamu görevlileri hakem kurulunun 29/05/2012 tarihli ve 2012/1 nolu kararı ile 1/7/2012 tarihinden geçerli olmak üzere, 375 sayılı KHK'nın 1. maddesinin (D) fıkrasında yer alan 12105 gösterge rakamı 13558 olarak uygulanır.
                                                <div className="absolute top-full left-3 border-4 border-transparent border-t-slate-800 dark:border-t-slate-700" />
                                            </div>
                                        </div>
                                    </div>
                                    <select 
                                        value={lojmanDiscountGroup} 
                                        onChange={(e) => setLojmanDiscountGroup(e.target.value as any)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
                                    >
                                        <option value="indirimsiz">İndirimsiz (%0)</option>
                                        <option value="ek1">EK 1 — %50 İndirim</option>
                                        <option value="ek2">EK 2 — %45 İndirim</option>
                                        <option value="ek3">EK 3 — %30 İndirim</option>
                                        <option value="ek3_10k">EK 3 Nüfus &lt;10K — %40 İndirim</option>
                                        <option value="uzak">Uzak/Kısıtlı İskan — %70 İndirim</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50/50 dark:bg-slate-900/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">İlave Gider ve Eklentiler</h4>
                                
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasKapici} 
                                            onChange={(e) => setHasKapici(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Kapıcı/Kaloriferci</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasElektrik} 
                                            disabled={hasElektrikSu}
                                            onChange={(e) => { setHasElektrik(e.target.checked); if (e.target.checked) setHasElektrikSu(false); }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Elektrik Sayaçsız</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasSu} 
                                            disabled={hasElektrikSu}
                                            onChange={(e) => { setHasSu(e.target.checked); if (e.target.checked) setHasElektrikSu(false); }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900 disabled:opacity-50"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Su Sayaçsız</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasElektrikSu} 
                                            onChange={(e) => { setHasElektrikSu(e.target.checked); if (e.target.checked) { setHasElektrik(false); setHasSu(false); } }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Elektrik+Su Sayaçsız</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasKuyuSu} 
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                                            onChange={(e) => setHasKuyuSu(e.target.checked)}
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Kuyu/Artezyen Suyu</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={hasYakit} 
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                                            onChange={(e) => setHasYakit(e.target.checked)}
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Yakıt Kurumca Tedarik</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-1 hover:bg-slate-100/30 dark:hover:bg-slate-800/30 rounded-lg cursor-pointer transition-all col-span-2">
                                        <input 
                                            type="checkbox" 
                                            checked={hasOrtakAlan} 
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 shrink-0 bg-white border border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                                            onChange={(e) => setHasOrtakAlan(e.target.checked)}
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">Ortak Alan Giderleri Kurumca Karşılanıyor</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Calculation Invoice Sheet - Right */}
                        <div className="lg:col-span-7 flex flex-col overflow-hidden">
                            <div 
                                id="lojman-print-area"
                                className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner flex-1 overflow-y-auto custom-scrollbar"
                            >
                                {/* Invoice Header */}
                                <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                    <h2 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                                        T.C. GENÇLİK VE SPOR BAKANLIĞI
                                    </h2>
                                    <p className="text-[9px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase">
                                        Lojman Kira Bedeli Hesaplama Raporu
                                    </p>
                                </div>

                                {/* Summary Grid */}
                                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-bold text-slate-500">Hesap Yılı: <span className="text-slate-800 dark:text-slate-200">{lojmanYear} Yılı</span></div>
                                        <div className="text-[10px] font-bold text-slate-500">Lojman Alanı: <span className="text-slate-800 dark:text-slate-200">{lojmanM2} m²</span></div>
                                        <div className="text-[10px] font-bold text-slate-500">Bulunduğu İl: <span className="text-slate-800 dark:text-slate-200">{lojmanCity}</span></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-bold text-slate-500">Lojman Türü: <span className="text-slate-800 dark:text-slate-200 capitalize">{lojmanType === "kerpic" ? "Kerpiç" : lojmanType}</span></div>
                                        <div className="text-[10px] font-bold text-slate-500">İndirim Oranı: <span className="text-slate-800 dark:text-slate-200">{(discountPct * 100)}%</span></div>
                                        <div className="text-[10px] font-bold text-slate-500">Hesaplama Tarihi: <span className="text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString("tr-TR")}</span></div>
                                    </div>
                                </div>

                                {/* Calculation Details Table */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-bold">Ücretlendirme Ayrıntıları</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs text-left">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-black">
                                                    <th className="py-2">Ücret Kalemi</th>
                                                    <th className="py-2 text-right">Birim (TL/m²)</th>
                                                    <th className="py-2 text-right">Tutar (TL)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                                                <tr>
                                                    <td className="py-2">İndirimsiz Metrekare Birim Kirası</td>
                                                    <td className="py-2 text-right font-mono">{fmtTR(baseRate, 4)} TL</td>
                                                    <td className="py-2 text-right font-mono">{fmtTR(baseRate * lojmanM2)} TL</td>
                                                </tr>
                                                {discountPct > 0 && (
                                                    <tr className="text-rose-500">
                                                        <td className="py-2 font-black">Lojman İndirimi (-{(discountPct * 100)}%)</td>
                                                        <td className="py-2 text-right font-mono">-{fmtTR(discountAmountRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">-{fmtTR(discountAmountRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold">
                                                    <td className="py-2">İndirimli Metrekare Birim Kirası</td>
                                                    <td className="py-2 text-right font-mono">{fmtTR(netBaseRate, 4)} TL</td>
                                                    <td className="py-2 text-right font-mono">{fmtTR(netBaseRate * lojmanM2)} TL</td>
                                                </tr>

                                                {/* Additions list */}
                                                {kapiciRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Kapıcı / Kaloriferci Gideri</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(kapiciRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(kapiciRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {elektrikRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Elektrik Sayacı Ayrılmamış</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(elektrikRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(elektrikRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {suRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Su Sayacı Ayrılmamış</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(suRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(suRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {elektrikSuRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Elektrik + Su Sayacı Ayrılmamış</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(elektrikSuRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(elektrikSuRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {kuyuSuRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Şebeke Dışı Kuyu / Artezyen Suyu</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(kuyuSuRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(kuyuSuRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {yakitRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Kurumca Tedarik Edilen Yakıt</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(yakitRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(yakitRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                                {ortakAlanRate > 0 && (
                                                    <tr>
                                                        <td className="py-2">İlave: Ortak Alan Giderleri</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(ortakAlanRate, 4)} TL</td>
                                                        <td className="py-2 text-right font-mono">+{fmtTR(ortakAlanRate * lojmanM2)} TL</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Total Calculation Summary Box */}
                                <div className="mt-8 border-t-2 border-dashed border-slate-200 dark:border-slate-800 pt-6">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider font-bold">Aylık Toplam Net Kira</span>
                                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                {fmtTR(monthlyRent)} TL
                                            </span>
                                        </div>
                                        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-6 text-indigo-600 dark:text-indigo-400">
                                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider font-bold">Günlük Kira (30 Gün)</span>
                                            <span className="text-lg font-black font-mono">
                                                {fmtTR(dailyRent)} TL
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 justify-end">
                                <Button 
                                    type="button"
                                    onClick={handlePrintLojman}
                                    className="h-12 px-6 rounded-2xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350"
                                >
                                    Yazdır
                                </Button>
                                <Button 
                                    type="button"
                                    onClick={handleExportLojmanExcel}
                                    className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/10"
                                >
                                    <FileSpreadsheet size={16} className="mr-2" /> Excel Olarak İndir
                                </Button>
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    onClick={() => setIsLojmanModalOpen(false)}
                                    className="h-12 px-6 rounded-2xl font-bold text-slate-500"
                                >
                                    Kapat
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>,
            document.body
        );
    };

    const renderCityListModal = () => {
        if (!isCityListOpen) return null;
        
        const ek1Cities = CITY_DISCOUNT_GROUPS.filter(c => c.group === "ek1").sort((a, b) => a.name.localeCompare(b.name, "tr"));
        const ek2Cities = CITY_DISCOUNT_GROUPS.filter(c => c.group === "ek2").sort((a, b) => a.name.localeCompare(b.name, "tr"));
        const ek3Cities = CITY_DISCOUNT_GROUPS.filter(c => c.group === "ek3").sort((a, b) => a.name.localeCompare(b.name, "tr"));
        
        return createPortal(
            <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-4xl p-8 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 font-bold">Lojman İndirim Grupları ve İller Listesi</h3>
                                <p className="text-xs text-slate-500 font-medium">Milli Emlak Genel Tebliğlerine göre EK 1, EK 2 ve EK 3 gruplarındaki iller.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsCityListOpen(false)} 
                            className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    {/* Columns content scrollable */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* EK 1 Column */}
                            <div className="bg-emerald-500/5 dark:bg-emerald-950/10 p-5 rounded-2xl border border-emerald-500/10 h-fit">
                                <div className="border-b border-emerald-500/20 pb-3 mb-3">
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block uppercase font-bold">EK 1 İlleri (%50 İndirim)</span>
                                    <span className="text-[10px] text-slate-400 font-bold dark:text-slate-400">Kalkınmada 1. derece öncelikli yöreler</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-slate-700 dark:text-slate-350">
                                    {ek1Cities.map(c => (
                                        <button 
                                            key={c.name}
                                            type="button"
                                            onClick={() => { setLojmanCity(c.name); setIsCityListOpen(false); }}
                                            className="text-left py-1 hover:text-indigo-600 hover:underline transition-all"
                                        >
                                            • {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* EK 2 Column */}
                            <div className="bg-amber-500/5 dark:bg-amber-950/10 p-5 rounded-2xl border border-amber-500/10 h-fit">
                                <div className="border-b border-amber-500/20 pb-3 mb-3">
                                    <span className="text-sm font-black text-amber-600 dark:text-amber-400 block uppercase font-bold">EK 2 İlleri (%45 İndirim)</span>
                                    <span className="text-[10px] text-slate-400 font-bold dark:text-slate-400">Kalkınmada 2. derece öncelikli yöreler</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-slate-700 dark:text-slate-355">
                                    {ek2Cities.map(c => (
                                        <button 
                                            key={c.name}
                                            type="button"
                                            onClick={() => { setLojmanCity(c.name); setIsCityListOpen(false); }}
                                            className="text-left py-1 hover:text-indigo-600 hover:underline transition-all"
                                        >
                                            • {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* EK 3 Column */}
                            <div className="bg-indigo-500/5 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-500/10 h-fit">
                                <div className="border-b border-indigo-500/20 pb-3 mb-3">
                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 block uppercase font-bold">EK 3 İlleri (%30 İndirim)</span>
                                    <span className="text-[10px] text-slate-400 font-bold dark:text-slate-400">Gelişmiş iller ve diğer merkezler</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-slate-700 dark:text-slate-350">
                                    {ek3Cities.map(c => (
                                        <button 
                                            key={c.name}
                                            type="button"
                                            onClick={() => { setLojmanCity(c.name); setIsCityListOpen(false); }}
                                            className="text-left py-1 hover:text-indigo-600 hover:underline transition-all"
                                        >
                                            • {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center text-xs text-slate-500 font-bold">
                        <span>İstediğiniz şehre tıklayarak doğrudan seçim yapabilirsiniz.</span>
                        <Button 
                            type="button"
                            variant="outline"
                            onClick={() => setIsCityListOpen(false)}
                            className="rounded-xl px-5 h-10 font-bold"
                        >
                            Kapat
                        </Button>
                    </div>
                </Card>
            </div>,
            document.body
        );
    };

    const renderYollukModal = () => {
        if (!isYollukModalOpen) return null;

        const {
            yevmiye,
            memurSabit,
            memurDegisken,
            memurYevmiyeTutar,
            memurTotal,
            familyDetails,
            familyTotal,
            familyRelocationTotal,
            familyYolUcretiTotal,
            familyDailyTotal,
            activeGrandTotal,
            emekliCoefficient,
            emekliIndicator,
            emekliGross,
            emekliDamgaTax,
            emekliNet
        } = calculateYollukValues();

        const sortedRatesYears = Object.keys(YOLLUK_H_RATES).sort((a, b) => b.localeCompare(a));
        const sortedCoeffsYears = Object.keys(YOLLUK_COEFFICIENTS).sort((a, b) => b.localeCompare(a));

        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-5xl p-6 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 font-outfit">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <Users size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 font-bold">Sürekli Görev Yolluğu Hesaplama</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Memur tayin ve emeklilik sürekli görev yolluğu tutarlarını hesaplayın.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsYollukModalOpen(false)} 
                            className="rounded-xl h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={16} />
                        </Button>
                    </div>

                    {/* Tab Selection */}
                    <div className="flex bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl mb-4 gap-1">
                        <button
                            type="button"
                            onClick={() => setYollukActiveTab("memur")}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                yollukActiveTab === "memur"
                                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            Sürekli Görev Yolluğu (Tayin)
                        </button>
                        <button
                            type="button"
                            onClick={() => setYollukActiveTab("emekli")}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                yollukActiveTab === "emekli"
                                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            Sürekli Görev Yolluğu (Emekli)
                        </button>
                    </div>

                    {/* Main Split Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden flex-1">
                        
                        {/* LEFT: Parameters Form */}
                        <div className="lg:col-span-5 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                            {yollukActiveTab === "memur" ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Genel Bilgiler</h4>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Hesaplama Yılı</label>
                                                <select 
                                                    value={yollukYear} 
                                                    onChange={(e) => setYollukYear(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                >
                                                    {sortedRatesYears.map(yr => (
                                                        <option key={yr} value={yr}>{yr} Yılı</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Kadro Derecesi / Durumu</label>
                                                <select 
                                                    value={yollukGrade} 
                                                    onChange={(e) => setYollukGrade(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                >
                                                    <option value="der_5_15">Aylık Derecesi 5 - 15 Olanlar</option>
                                                    <option value="der_1_4">Aylık Derecesi 1 - 4 Olanlar</option>
                                                    <option value="ek_3600_6400">Ek Göstergesi 3600 - 6400 Olanlar</option>
                                                    <option value="ek_6400_8000">Ek Göstergesi 6400 - 8000 Olanlar</option>
                                                    <option value="ek_8000_plus">Ek Göstergesi 8000 ve Üzeri Olanlar</option>
                                                    <option value="custom">Özel Gündelik (El İle Gir)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {yollukGrade === "custom" && (
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Harcırah Gündeliği (TL)</label>
                                                <input 
                                                    type="number" 
                                                    value={yollukCustomGundelik || ""} 
                                                    min={0}
                                                    onChange={(e) => setYollukCustomGundelik(Math.max(0, parseFloat(e.target.value) || 0))}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Mesafe (Km)</label>
                                                <input 
                                                    type="number" 
                                                    value={yollukDistance || ""} 
                                                    min={0}
                                                    onChange={(e) => setYollukDistance(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Memur Bilet (TL)</label>
                                                <input 
                                                    type="number" 
                                                    value={yollukMemurYolUcreti || ""} 
                                                    min={0}
                                                    onChange={(e) => setYollukMemurYolUcreti(Math.max(0, parseFloat(e.target.value) || 0))}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Seyahat Süresi (Gün)</label>
                                                <input 
                                                    type="number" 
                                                    value={yollukTravelDays || 1} 
                                                    min={1}
                                                    onChange={(e) => setYollukTravelDays(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Family list */}
                                    <div className="bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bakmakla Yükümlü Aile Fertleri</h4>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setYollukFamily([
                                                        ...yollukFamily,
                                                        { id: Math.random().toString(), relation: "Çocuk", yolUcreti: 100 }
                                                    ]);
                                                }}
                                                className="text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 dark:text-indigo-400 px-2 py-1 rounded-lg font-black uppercase tracking-wide transition-all"
                                            >
                                                + Aile Ferdi Ekle
                                            </button>
                                        </div>

                                        {yollukFamily.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                                <div className="flex gap-2 text-[9px] font-black uppercase tracking-wider text-slate-400 px-2 select-none">
                                                    <span className="w-4"></span>
                                                    <span className="flex-1">Aile Ferdi (Yakınlık)</span>
                                                    <span className="w-20 text-center">Bilet Tutarı</span>
                                                    <span className="w-6"></span>
                                                </div>
                                                {yollukFamily.map((f, idx) => (
                                                    <div key={f.id} className="flex gap-2 items-center bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200/50 dark:border-slate-850">
                                                        <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                                                        <select
                                                            value={f.relation}
                                                            onChange={(e) => {
                                                                const updated = [...yollukFamily];
                                                                updated[idx].relation = e.target.value;
                                                                setYollukFamily(updated);
                                                            }}
                                                            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                                        >
                                                            <option value="Eş">Çalışmayan Eş</option>
                                                            <option value="Çocuk">Çocuk</option>
                                                            <option value="Anne">Anne</option>
                                                            <option value="Baba">Baba</option>
                                                            <option value="Kardeş">Kardeş</option>
                                                        </select>
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="number"
                                                                placeholder="Bilet"
                                                                value={f.yolUcreti || ""}
                                                                min={0}
                                                                onChange={(e) => {
                                                                    const updated = [...yollukFamily];
                                                                    updated[idx].yolUcreti = Math.max(0, parseFloat(e.target.value) || 0);
                                                                    setYollukFamily(updated);
                                                                }}
                                                                className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-right outline-none"
                                                            />
                                                            <span className="text-[10px] text-slate-400 font-bold">TL</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setYollukFamily(yollukFamily.filter(item => item.id !== f.id));
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/10">
                                                Bakmakla yükümlü aile ferdi eklenmedi.
                                            </div>
                                        )}
                                        {yollukFamily.length > 4 && (
                                            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 leading-normal">
                                                ⚠️ Kanun gereği aile fertlerinin yer değiştirme masrafı toplamı memurun gündeliğinin 40 katını aşamaz. 4 kişiden fazla eklenen fertler için yer değiştirme masrafı 0 TL hesaplanacak, ancak yol ücreti ve seyahat gündeliği verilecektir.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Emeklilik Parametreleri</h4>
                                    
                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Hesaplama Yılı</label>
                                        <select 
                                            value={yollukEmekliYear} 
                                            onChange={(e) => setYollukEmekliYear(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        >
                                            {sortedCoeffsYears.map(yr => (
                                                <option key={yr} value={yr}>{yr} Yılı</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Katsayı Dönemi</label>
                                        <select 
                                            value={yollukEmekliPeriod} 
                                            onChange={(e) => setYollukEmekliPeriod(e.target.value as "jan_jun" | "jul_dec")}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        >
                                            <option value="jan_jun">1 Ocak - 30 Haziran Dönemi</option>
                                            <option value="jul_dec">1 Temmuz - 31 Aralık Dönemi</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Personel Sınıfı / Göstergesi</label>
                                        <select 
                                            value={yollukEmekliClass} 
                                            onChange={(e) => setYollukEmekliClass(e.target.value as "kadrolu" | "isci" | "custom")}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                        >
                                            <option value="kadrolu">Kadrolu / Sözleşmeli Memurlar (13.558)*</option>
                                            <option value="isci">Kamu İşçileri (12.105)</option>
                                            <option value="custom">Özel Gösterge Gir (Manuel)</option>
                                        </select>
                                    </div>

                                    {yollukEmekliClass === "custom" && (
                                        <div>
                                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Gösterge Rakamı</label>
                                            <input 
                                                type="number" 
                                                value={yollukEmekliCustomIndicator || ""} 
                                                min={0}
                                                onChange={(e) => setYollukEmekliCustomIndicator(Math.max(0, parseInt(e.target.value) || 0))}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                            />
                                        </div>
                                    )}

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={yollukEmekliUseCustomCoefficient}
                                                onChange={(e) => {
                                                    setYollukEmekliUseCustomCoefficient(e.target.checked);
                                                    if (e.target.checked) {
                                                        const defaultVal = YOLLUK_COEFFICIENTS[yollukEmekliYear]?.[yollukEmekliPeriod] || 1.387871;
                                                        setYollukEmekliCustomCoefficient(defaultVal);
                                                    }
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-white border border-slate-350 dark:border-slate-700"
                                            />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-350 select-none">Özel Maaş Katsayısı Gir</span>
                                        </label>
                                    </div>

                                    {yollukEmekliUseCustomCoefficient && (
                                        <div>
                                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Memur Maaş Katsayısı</label>
                                            <input 
                                                type="number" 
                                                value={yollukEmekliCustomCoefficient || ""} 
                                                step={0.000001}
                                                min={0}
                                                onChange={(e) => setYollukEmekliCustomCoefficient(Math.max(0, parseFloat(e.target.value) || 0))}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 bg-indigo-50/30 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-950/30 text-[10px] space-y-1 text-slate-500 dark:text-slate-400">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-0.5">ℹ️ {yollukEmekliYear} Yılı {yollukEmekliPeriod === "jan_jun" ? "Ocak-Haziran" : "Temmuz-Aralık"} Katsayı Bilgileri:</span>
                                        <div className="font-bold space-y-0.5">
                                            <div>• Maaş Katsayısı: <span className="text-slate-700 dark:text-slate-200">{(YOLLUK_COEFFICIENTS[yollukEmekliYear]?.[yollukEmekliPeriod] || 1.387871).toFixed(6)}</span></div>
                                            <div>• Kadrolu Memur (13.558 x Kat.): <span className="text-slate-700 dark:text-slate-200">{formatYollukCurrency(13558 * (YOLLUK_COEFFICIENTS[yollukEmekliYear]?.[yollukEmekliPeriod] || 1.387871))} TL</span></div>
                                            <div>• Kamu İşçisi (12.105 x Kat.): <span className="text-slate-700 dark:text-slate-200">{formatYollukCurrency(12105 * (YOLLUK_COEFFICIENTS[yollukEmekliYear]?.[yollukEmekliPeriod] || 1.387871))} TL</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Calculation Sheet */}
                        <div className="lg:col-span-7 flex flex-col h-full justify-between overflow-hidden">
                            <div 
                                id="yolluk-print-area"
                                className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-y-auto custom-scrollbar flex-1 max-h-[50vh] lg:max-h-none"
                            >
                                {yollukActiveTab === "memur" ? (
                                    <div className="space-y-4">
                                        {/* Cetvel Header */}
                                        <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                            <h2 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                                                T.C. GENÇLİK VE SPOR BAKANLIĞI
                                            </h2>
                                            <p className="text-[9px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase">
                                                Sürekli Görev Yolluğu Bildirim Cetveli
                                            </p>
                                        </div>

                                        {/* Summary Grid */}
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-800/80 mb-3">
                                            <div className="space-y-1">
                                                <div className="text-slate-500">Hesap Yılı: <span className="text-slate-800 dark:text-slate-200">{yollukYear} Yılı</span></div>
                                                <div className="text-slate-500">Mesafe (Km): <span className="text-slate-800 dark:text-slate-200">{yollukDistance} km</span></div>
                                                <div className="text-slate-500">Gündelik (Yevmiye): <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatYollukCurrency(yevmiye)} TL</span></div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-slate-500">Bilet Ücreti (Memur): <span className="text-slate-800 dark:text-slate-200">{formatYollukCurrency(yollukMemurYolUcreti)} TL</span></div>
                                                <div className="text-slate-500">Aile Fertleri Sayısı: <span className="text-slate-800 dark:text-slate-200">{yollukFamily.length} Kişi</span></div>
                                                <div className="text-slate-500">Ödenecek Toplam: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatYollukCurrency(activeGrandTotal)} TL</span></div>
                                            </div>
                                        </div>

                                        {/* Details Table */}
                                        <div className="space-y-1.5">
                                            <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ücretlendirme Ayrıntıları</h4>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-[11px] text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 uppercase font-black">
                                                            <th className="py-1">Harcırah Kalemi</th>
                                                            <th className="py-1 text-right">Açıklama / Formül</th>
                                                            <th className="py-1 text-right">Tutar (TL)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                                                        {/* Memur's own calculation */}
                                                        <tr>
                                                            <td className="py-1">Memur Sabit Unsur (Yevmiye x 20)</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">{formatYollukCurrency(yevmiye)} x 20</td>
                                                            <td className="py-1 text-right font-mono">{formatYollukCurrency(memurSabit)} TL</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-1">Memur Değişken Unsur (Km x %5 Yevmiye)</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">{yollukDistance} km x {formatYollukCurrency(yevmiye * 0.05)}</td>
                                                            <td className="py-1 text-right font-mono">{formatYollukCurrency(memurDegisken)} TL</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-1">Memur Yol Harcırahı (Seyahat Günü)</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">{yollukTravelDays} Gün x {formatYollukCurrency(yevmiye)}</td>
                                                            <td className="py-1 text-right font-mono">{formatYollukCurrency(memurYevmiyeTutar)} TL</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-1">Memur Bilet Ücreti</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">-</td>
                                                            <td className="py-1 text-right font-mono">{formatYollukCurrency(yollukMemurYolUcreti)} TL</td>
                                                        </tr>
                                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-900 dark:text-slate-200">
                                                            <td className="py-1 font-extrabold">Memur Yolluğu Toplamı</td>
                                                            <td className="py-1 text-right">-</td>
                                                            <td className="py-1 text-right font-mono font-extrabold">{formatYollukCurrency(memurTotal)} TL</td>
                                                        </tr>

                                                        {/* Dependents list */}
                                                        {familyDetails.length > 0 && (
                                                            <React.Fragment>
                                                                <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/10">
                                                                    <td colSpan={3} className="py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">Bakmakla Yükümlü Aile Fertleri Yollukları</td>
                                                                </tr>
                                                                {familyDetails.map((f, idx) => (
                                                                    <tr key={f.id} className="text-slate-600 dark:text-slate-400">
                                                                        <td className="py-1 pl-2">• {idx + 1}. Aile Ferdi ({f.relation})</td>
                                                                        <td className="py-1 text-right font-mono text-[10px]">
                                                                            Bilet: {formatYollukCurrency(f.yolUcreti)} | 
                                                                            Hrc: {formatYollukCurrency(f.dailyAllowance)} | 
                                                                            Yer Değ: {formatYollukCurrency(f.relocationAllowance)}
                                                                        </td>
                                                                        <td className="py-1 text-right font-mono">{formatYollukCurrency(f.total)} TL</td>
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-900 dark:text-slate-200">
                                                                    <td className="py-1 font-extrabold">Aile Fertleri Toplamı</td>
                                                                    <td className="py-1 text-right text-[10px] text-slate-400">
                                                                        Bl: {formatYollukCurrency(familyYolUcretiTotal)} | 
                                                                        Hr: {formatYollukCurrency(familyDailyTotal)} | 
                                                                        Y.D: {formatYollukCurrency(familyRelocationTotal)}
                                                                    </td>
                                                                    <td className="py-1 text-right font-mono font-extrabold">{formatYollukCurrency(familyTotal)} TL</td>
                                                                </tr>
                                                            </React.Fragment>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <p className="text-[9px] font-semibold text-slate-400 leading-normal border-t border-slate-100 dark:border-slate-900 pt-2">
                                            ℹ️ Not: 2004/2 sayılı Damga Vergisi Kanunu Genel Sirküleri gereği, geçici ve sürekli görev yolluğu ödemelerinden Damga Vergisi ve Gelir Vergisi kesintisi yapılmaz. Tutarın tamamı memura ödenir.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Cetvel Header */}
                                        <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                                            <h2 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                                                T.C. GENÇLİK VE SPOR BAKANLIĞI
                                            </h2>
                                            <p className="text-[9px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase">
                                                Emeklilik Yolluğu (Tazminatı) Hesap Cetveli
                                            </p>
                                        </div>

                                        {/* Summary Grid */}
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-[11px] font-bold border border-slate-100 dark:border-slate-800/80 mb-3">
                                            <div className="space-y-1">
                                                <div className="text-slate-500">Hesap Yılı: <span className="text-slate-800 dark:text-slate-200">{yollukEmekliYear} Yılı</span></div>
                                                <div className="text-slate-500">Dönem: <span className="text-slate-800 dark:text-slate-200">{yollukEmekliPeriod === "jan_jun" ? "Ocak - Haziran" : "Temmuz - Aralık"}</span></div>
                                                <div className="text-slate-500">Maaş Katsayısı: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{emekliCoefficient.toFixed(6)}</span></div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-slate-500">Personel Sınıfı: <span className="text-slate-800 dark:text-slate-200 capitalize">{yollukEmekliClass === "custom" ? "Özel" : yollukEmekliClass}</span></div>
                                                <div className="text-slate-500">Gösterge Rakamı: <span className="text-slate-800 dark:text-slate-200">{emekliIndicator}</span></div>
                                                <div className="text-slate-500">Brüt Tutar: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatYollukCurrency(emekliGross)} TL</span></div>
                                            </div>
                                        </div>

                                        {/* Details Table */}
                                        <div className="space-y-1.5">
                                            <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hesaplama Kalemleri</h4>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-[11px] text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 uppercase font-black">
                                                            <th className="py-1">Hesap Kalemi</th>
                                                            <th className="py-1 text-right">Formül / Oran</th>
                                                            <th className="py-1 text-right">Tutar (TL)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-700 dark:text-slate-300 font-bold">
                                                        <tr>
                                                            <td className="py-1">Brüt Yolluk Tazminatı</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">{emekliIndicator} x {emekliCoefficient.toFixed(6)}</td>
                                                            <td className="py-1 text-right font-mono">{formatYollukCurrency(emekliGross)} TL</td>
                                                        </tr>
                                                        <tr className="text-rose-600 dark:text-rose-400">
                                                            <td className="py-1">Damga Vergisi Kesintisi</td>
                                                            <td className="py-1 text-right font-mono font-medium text-slate-400">%0,759 (binde 7,59)</td>
                                                            <td className="py-1 text-right font-mono">-{formatYollukCurrency(emekliDamgaTax)} TL</td>
                                                        </tr>
                                                        <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-indigo-600 dark:text-indigo-400 font-extrabold">
                                                            <td className="py-1">Net Ödenecek Emeklilik Yolluğu</td>
                                                            <td className="py-1 text-right">-</td>
                                                            <td className="py-1 text-right font-mono font-extrabold">{formatYollukCurrency(emekliNet)} TL</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Total Calculation Summary Box */}
                                <div className="mt-4 border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
                                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                        {yollukActiveTab === "memur" ? (
                                            <React.Fragment>
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-bold">Net Ödenecek Toplam Yolluk</span>
                                                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                        {formatYollukCurrency(activeGrandTotal)} TL
                                                    </span>
                                                </div>
                                                <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4 text-indigo-600 dark:text-indigo-400">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-bold">Memur Sabit + Değişken</span>
                                                    <span className="text-base font-black font-mono">
                                                        {formatYollukCurrency(memurSabit + memurDegisken)} TL
                                                    </span>
                                                </div>
                                            </React.Fragment>
                                        ) : (
                                            <React.Fragment>
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-bold">Net Ödenecek Yolluk (Kesintili)</span>
                                                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                                        {formatYollukCurrency(emekliNet)} TL
                                                    </span>
                                                </div>
                                                <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4 text-indigo-600 dark:text-indigo-400">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-bold">Brüt Yolluk Tutarı</span>
                                                    <span className="text-base font-black font-mono">
                                                        {formatYollukCurrency(emekliGross)} TL
                                                    </span>
                                                </div>
                                            </React.Fragment>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 justify-end">
                                <Button 
                                    type="button"
                                    onClick={handlePrintYolluk}
                                    className="h-10 px-5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 text-xs"
                                >
                                    Yazdır
                                </Button>
                                <Button 
                                    type="button"
                                    onClick={handleExportYollukExcel}
                                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/10"
                                >
                                    Excel İndir
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>,
            document.body
        );
    };

    const renderIhaleModal = () => {
        if (!isIhaleModalOpen) return null;

        const LIMIT_22D_BUYUKSEHIR = 800366;
        const LIMIT_22D_DIGER = 266618;
        const LIMIT_21F = 2668214;
        const THRESHOLD_YAPIM = 538046863;
        const THRESHOLD_MAL_GENEL = 14673866;
        const THRESHOLD_MAL_DIGER = 24456512;
        const THRESHOLD_HIZMET_GENEL = 14673866;
        const THRESHOLD_HIZMET_DIGER = 24456512;

        let current22dLimit = ihaleIsBuyuksehir ? LIMIT_22D_BUYUKSEHIR : LIMIT_22D_DIGER;
        let currentThreshold = THRESHOLD_YAPIM;
        if (ihaleType === "mal") {
            currentThreshold = ihaleIdareTipi === "genel" ? THRESHOLD_MAL_GENEL : THRESHOLD_MAL_DIGER;
        } else if (ihaleType === "hizmet") {
            currentThreshold = ihaleIdareTipi === "genel" ? THRESHOLD_HIZMET_GENEL : THRESHOLD_HIZMET_DIGER;
        }

        const calculateDateOffset = (dateStr: string, daysOffset: number): string => {
            if (!dateStr) return "-";
            try {
                const date = new Date(dateStr);
                date.setDate(date.getDate() - daysOffset);
                return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
            } catch {
                return "-";
            }
        };

        const calculateForwardDateOffset = (dateStr: string, daysOffset: number): string => {
            if (!dateStr) return "-";
            try {
                const date = new Date(dateStr);
                date.setDate(date.getDate() + daysOffset);
                return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
            } catch {
                return "-";
            }
        };

        const handleIhaleBack = () => {
            if (ihaleHistory.length === 0) return;
            const newHistory = [...ihaleHistory];
            const prevStep = newHistory.pop();
            setIhaleHistory(newHistory);
            if (prevStep !== undefined) {
                setIhaleStep(prevStep);
            }
        };

        const goToStep = (nextStep: number) => {
            setIhaleHistory([...ihaleHistory, ihaleStep]);
            setIhaleStep(nextStep);
        };

        const handleSelectType = (type: "yapim" | "mal" | "hizmet") => {
            setIhaleType(type);
            goToStep(2);
        };

        const handleProcessStep2 = () => {
            if (ihaleMaliyet <= current22dLimit) {
                setIhaleRecommendedMethod("Doğrudan Temin (Madde 22/d)");
                goToStep(21);
            } else if (ihaleMaliyet <= LIMIT_21F) {
                setIhaleRecommendedMethod("Pazarlık Usulü (Madde 21/f)");
                goToStep(22);
            } else {
                goToStep(3);
            }
        };

        let stepContent = null;
        let stepTitle = "";
        let stepSubtitle = "";

        switch (ihaleStep) {
            case 1:
                stepTitle = "İhale ve Alım Konusu İşin Türü";
                stepSubtitle = "Süreç başlangıcında ihale/alım türünü belirleyin.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold">Yapılacak alımın veya ihalenin ana kategorisi nedir?</p>
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => handleSelectType("yapim")}
                                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all text-left group"
                            >
                                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Yapım İşi</div>
                                    <div className="text-[10px] text-slate-400 font-medium">Bina yapımı, onarım, tesisat, altyapı işleri vb.</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleSelectType("mal")}
                                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all text-left group"
                            >
                                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Mal Alımı</div>
                                    <div className="text-[10px] text-slate-400 font-medium">Satın alınacak mamul mal, araç, malzeme, sarf malzemeleri vb.</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleSelectType("hizmet")}
                                className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition-all text-left group"
                            >
                                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Hizmet Alımı</div>
                                    <div className="text-[10px] text-slate-400 font-medium">Danışmanlık, temizlik, güvenlik, yazılım hizmetleri vb.</div>
                                </div>
                            </button>
                        </div>
                    </div>
                );
                break;
            case 2:
                stepTitle = "Yaklaşık Maliyet ve Kurum Detayları";
                stepSubtitle = "Alım limitlerini ve eşik değerleri belirlemek için değerleri girin.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Planlanan İhale Tarihi</label>
                            <input 
                                type="date"
                                value={ihaleTarihi}
                                onChange={(e) => setIhaleTarihi(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Yaklaşık Maliyet (TL)</label>
                            <input 
                                type="number"
                                value={ihaleMaliyet || ""}
                                min={0}
                                onChange={(e) => setIhaleMaliyet(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                placeholder="Yaklaşık maliyet tutarını girin"
                            />
                        </div>
                        {ihaleType !== "yapim" && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Büyükşehir Belediyesi Sınırları</div>
                                    <div className="text-[9px] text-slate-400">Doğrudan temin limitleri Büyükşehir sınırlarında daha yüksektir.</div>
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={ihaleIsBuyuksehir}
                                    onChange={(e) => setIhaleIsBuyuksehir(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                        {ihaleType !== "yapim" && (
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">İdare Nitelik Tipi</label>
                                <select
                                    value={ihaleIdareTipi}
                                    onChange={(e) => setIhaleIdareTipi(e.target.value as "genel" | "diger")}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold"
                                >
                                    <option value="genel">Genel veya Özel Bütçeli İdare (Eşik: 14.673.866 TL)</option>
                                    <option value="diger">Diğer İdareler / Belediyeler (Eşik: 24.456.512 TL)</option>
                                </select>
                            </div>
                        )}
                        <Button
                            onClick={handleProcessStep2}
                            disabled={ihaleMaliyet <= 0}
                            className="w-full mt-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                        >
                            Limit Kontrolü Yap ve Devam Et
                        </Button>
                    </div>
                );
                break;
            case 21:
                stepTitle = "Doğrudan Temin (Madde 22/d) Önerilir";
                stepSubtitle = "Girilen yaklaşık maliyet limit altındadır.";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-semibold leading-relaxed flex gap-3">
                            <Check size={20} className="shrink-0" />
                            <div>
                                Yaklaşık Maliyet (<strong>{ihaleMaliyet.toLocaleString("tr-TR")} TL</strong>), 2025 yılı Doğrudan Temin limitinin (<strong>{current22dLimit.toLocaleString("tr-TR")} TL</strong>) altında kalmaktadır.
                            </div>
                        </div>
                        <div className="text-[11px] leading-relaxed">
                            Bu kapsamda <strong>Doğrudan Temin (Madde 22/d)</strong> usulü ile alım yapılması uygundur. İlan yayımlanması, geçici/kesin teminat alınması ve ihale komisyonu kurulması zorunlu değildir.
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                            <Button
                                onClick={() => goToStep(211)}
                                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Doğrudan Temin İle Alımı Tamamla
                            </Button>
                            <Button
                                onClick={() => goToStep(3)}
                                variant="ghost"
                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs py-3"
                            >
                                Farklı Bir İhale Usulü Seç (Devam Et)
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 211:
                stepTitle = "Alım Süreci Başarıyla Tamamlandı";
                stepSubtitle = "Doğrudan Temin Süreç Raporu";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <Check size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Doğrudan Temin Tamamlanmıştır</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Tebrikler! Belirlenen yaklaşık maliyet limitleri dahilinde doğrudan alım süreci mevzuata uygun şekilde yürütülmüştür. Herhangi bir ilan, teminat mektubu veya komisyon onayına gerek bulunmamaktadır.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Yeni Sorgulama Başlat
                        </Button>
                    </div>
                );
                break;
            case 22:
                stepTitle = "Pazarlık Usulü (Madde 21/f) Önerilir";
                stepSubtitle = "Yaklaşık maliyet pazarlık limiti altındadır.";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-355">
                        <div className="p-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-semibold leading-relaxed flex gap-3">
                            <Check size={20} className="shrink-0" />
                            <div>
                                Yaklaşık Maliyet (<strong>{ihaleMaliyet.toLocaleString("tr-TR")} TL</strong>), 2025 yılı Pazarlık Usulü limitinin (<strong>{LIMIT_21F.toLocaleString("tr-TR")} TL</strong>) altında kalmaktadır.
                            </div>
                        </div>
                        <div className="text-[11px] leading-relaxed">
                            Bu kapsamda <strong>Pazarlık Usulü (Madde 21/f)</strong> ile ihale yapılması uygundur. İlan yayımlanması zorunlu değildir. En az 3 istekli davet edilerek teklif alınır.
                        </div>
                        <div className="flex flex-col gap-2 mt-2">
                            <Button
                                onClick={() => {
                                    setIhaleRecommendedMethod("Pazarlık Usulü (Madde 21/f)");
                                    goToStep(4);
                                }}
                                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Bu Yöntemle Devam Et (Onay Adımları)
                            </Button>
                            <Button
                                onClick={() => goToStep(3)}
                                variant="ghost"
                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs py-3"
                            >
                                Farklı Bir İhale Usulü Seç (Devam Et)
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 3:
                stepTitle = "Afet, Salgın Hastalık veya Beklenmeyen Durumlar";
                stepSubtitle = "21/b istisnai pazarlık koşullarının kontrolü.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale konusu iş; doğal afetler, salgın hastalıklar, can veya mal kaybı tehlikesi gibi ani ve beklenmeyen olayların ortaya çıkması nedeniyle ivedi olarak yapılması gereken bir iş <strong>(Madde 21/b)</strong> kapsamında mı?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => {
                                    setIhaleRecommendedMethod("Pazarlık Usulü (Madde 21/b)");
                                    goToStep(4);
                                }}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Madde 21/b)
                            </Button>
                            <Button
                                onClick={() => {
                                    if (ihaleType === "yapim" && ihaleMaliyet > currentThreshold / 2) {
                                        goToStep(31);
                                    } else {
                                        setIhaleRecommendedMethod("Açık İhale Usulü (Madde 19)");
                                        goToStep(4);
                                    }
                                }}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 31:
                stepTitle = "Belli İstekliler Arasında İhale Kontrolü";
                stepSubtitle = "Yapım işlerinde uzmanlık ve eşik değer kontrolü.";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="text-xs leading-relaxed">
                            Yaklaşık maliyet (<strong>{ihaleMaliyet.toLocaleString("tr-TR")} TL</strong>), yapım işleri eşik değerinin yarısı olan <strong>{(currentThreshold / 2).toLocaleString("tr-TR")} TL</strong> sınırının üzerindedir.
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale konusu yapım işi; yüksek uzmanlık ve/veya özel teknoloji gerektiren bir niteliğe sahip mi? <strong>(Madde 20)</strong>
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => {
                                    setIhaleRecommendedMethod("Belli İstekliler Arasında İhale (Madde 20)");
                                    goToStep(4);
                                }}
                                className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Belli İstekliler)
                            </Button>
                            <Button
                                onClick={() => {
                                    setIhaleRecommendedMethod("Açık İhale Usulü (Madde 19)");
                                    goToStep(4);
                                }}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır (Açık İhale)
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 4:
                stepTitle = "Bütçe Ödeneği Kontrolü";
                stepSubtitle = "4734 Sayılı Kanun Madde 5 kuralları.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl text-[10px] font-semibold leading-relaxed">
                            YÖNTEM ÖNERİSİ: <strong>{ihaleRecommendedMethod}</strong>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale konusu iş için bütçede yeterli bütçe ödeneği mevcut mu? (Madde 5 gereğince ödeneği bulunmayan işler için ihaleye çıkılamaz)
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(5)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(41)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 41:
                stepTitle = "İhale Süreci İptal Edildi";
                stepSubtitle = "Yasal Bütçe Engeli";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <X size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Yetersiz Bütçe Ödeneği</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            SÜREÇ SONLANDI: 4734 sayılı Kanunun 5. maddesi uyarınca, ödeneği bulunmayan hiçbir iş için ihaleye çıkılması veya alım yapılması mümkün değildir. Lütfen bütçe tahsisini tamamladıktan sonra yeniden başlayın.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Başa Dön
                        </Button>
                    </div>
                );
                break;
            case 5:
                stepTitle = "İhale Onayı ve Komisyon Kurulması";
                stepSubtitle = "Onay belgesi ve görevlendirme kontrolü.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale Onay Belgesi düzenlenerek İhale Yetkilisinden onay alındı mı ve İhale Komisyonu (tek sayıdan oluşacak şekilde en az 5 kişi) resmen görevlendirildi mi?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(6)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(51)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 51:
                stepTitle = "Süreç Durduruldu";
                stepSubtitle = "Eksik İhale Yetkilisi Onayı";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center text-slate-700 dark:text-slate-350">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <HelpCircle size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">İhale Onayı Bulunmamaktadır</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            İhale Yetkilisinden resmi onay alınmadan ve ihale komisyonu kurulup EKAP kaydı yapılmadan süreçte ilan veya sonraki aşamalara geçilmesi mümkün değildir. Onay belgesini imzaladıktan sonra Evet seçeneğiyle ilerleyin.
                        </p>
                        <Button
                            onClick={handleIhaleBack}
                            className="w-full mt-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                        >
                            Önceki Adıma Dön
                        </Button>
                    </div>
                );
                break;
            case 6:
                stepTitle = "İlan Süreleri ve Yasal Kurallar";
                stepSubtitle = "Madde 13 ilan ve davet kuralları.";
                
                let ruleText = "";
                let isIlanRequired = true;
                let latestIlanDate = "";
                let discountIlanDate = "";
                
                if (ihaleRecommendedMethod.includes("21/f") || ihaleRecommendedMethod.includes("21/b") || ihaleRecommendedMethod.includes("22/d")) {
                    ruleText = "Bu yöntemde ilan yayımlanması zorunlu değildir. İlan yapılmaksızın en az 3 istekli davet edilerek veya EKAP üzerinden davetiye gönderilerek doğrudan teklif toplanabilir.";
                    isIlanRequired = false;
                } else if (ihaleMaliyet >= currentThreshold) {
                    ruleText = `Yaklaşık maliyet eşik değerin (${currentThreshold.toLocaleString("tr-TR")} TL) üzerinde olduğundan, ilanın ihale tarihinden en az 40 gün önce Kamu İhale Bülteninde yayımlanması yasal bir zorunluluktur.`;
                    latestIlanDate = calculateDateOffset(ihaleTarihi, 40);
                    discountIlanDate = calculateDateOffset(ihaleTarihi, 35);
                } else {
                    if (ihaleMaliyet < 1600881) {
                        ruleText = `Yaklaşık maliyet 1.600.881 TL'nin altında olduğu için, ilanın ihale tarihinden en az 7 gün önce yerel gazetede veya ihale bülteninde yayımlanması gerekir.`;
                        latestIlanDate = calculateDateOffset(ihaleTarihi, 7);
                    } else if (ihaleMaliyet >= 1600881 && ihaleMaliyet < 3201926) {
                        ruleText = `Yaklaşık maliyet 1.600.881 TL - 3.201.926 TL aralığında olduğu için, ilanın ihale tarihinden en az 14 gün önce Kamu İhale Bülteninde yayımlanması gerekir.`;
                        latestIlanDate = calculateDateOffset(ihaleTarihi, 14);
                    } else {
                        ruleText = `Yaklaşık maliyet 3.201.926 TL - Eşik Değer aralığında olduğu için, ilanın ihale tarihinden en az 21 gün önce Kamu İhale Bülteninde yayımlanması gerekir.`;
                        latestIlanDate = calculateDateOffset(ihaleTarihi, 21);
                    }
                }

                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-355">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mevzuat Kuralı:</div>
                                <div className="text-[11px] leading-relaxed font-semibold text-slate-750 dark:text-slate-250 mt-0.5">{ruleText}</div>
                            </div>
                            {isIlanRequired && ihaleTarihi && (
                                <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 flex flex-col gap-1.5 text-[10px] font-bold">
                                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                        <Calendar size={12} />
                                        <span>Planlanan İhale Tarihi: {new Date(ihaleTarihi).toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', year: 'numeric'})}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-rose-500">
                                        <AlertTriangle size={12} />
                                        <span>En Geç İlan Yayımlama Tarihi: {latestIlanDate}</span>
                                    </div>
                                    {discountIlanDate && (
                                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium ml-4">
                                            (İlan ve ihale dokümanının EKAP üzerinden doğrudan erişime açılması halinde süre 5 gün kısaltılarak en geç <strong>{discountIlanDate}</strong> olarak uygulanabilir.)
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            {isIlanRequired 
                                ? "Yukarıda belirtilen yasal ilan sürelerine ve ilan kurallarına tam olarak uyulup ilan yayımlandı mı?"
                                : "Belirlenen yönteme göre en az 3 istekliye usulüne uygun davet/doküman gönderildi mi?"}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(7)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(61)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 61:
                stepTitle = "İhale Süreci İptal Edildi";
                stepSubtitle = "Yasal Süre İhlali";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <X size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">İlan Süre İhlali</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            SÜREÇ İPTAL EDİLMİŞTİR: 4734 sayılı Kanunun 13. maddesindeki ilan sürelerine uyulmaması esastan iptal sebebidir. İlan yayımlandıktan sonra yasal gün sayısının dolması beklenmeli, aksi takdirde ihale iptal edilerek süreç yeniden başlatılmalıdır.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Başa Dön
                        </Button>
                    </div>
                );
                break;
            case 7:
                stepTitle = "Geçici Teminat Kontrolleri";
                stepSubtitle = "Madde 33 geçici teminat şartları.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-semibold leading-relaxed">
                            BİLGİ: İsteklilerden teklif ettikleri bedelin <strong>en az %3'ü</strong> oranında, teklif geçerlilik süresinden <strong>en az 30 gün uzun</strong> süreli geçici teminat (banka mektubu, nakit vb.) alınması zorunludur.
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            Teklif veren tüm isteklilerden usulüne uygun ve eksiksiz Geçici Teminat alınmış mıdır?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(8)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(71)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır / Eksik Var
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 71:
                stepTitle = "Eksik / Usulsüz Teminat İşlemi";
                stepSubtitle = "Mevzuat Uygulama Kararı";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl text-[10px] leading-relaxed font-semibold">
                            KURAL: Teklif mektubu ile geçici teminatı usulüne uygun olmayan istekliler 36. ve 37. maddeler uyarınca ilk oturumda doğrudan değerlendirme dışı bırakılarak elenir.
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            Geçici teminatı eksik olan isteklileri eleyerek, teminatı uygun olan diğer isteklilerle ihale değerlendirmesine devam edilsin mi?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(8)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet, Eleyerek Devam Et
                            </Button>
                            <Button
                                onClick={() => goToStep(72)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır, İhaleyi İptal Et
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 72:
                stepTitle = "İhale İptal Edildi";
                stepSubtitle = "Geçersiz/Eksik Teminat Sebebi";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <X size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Yetersiz Teklif/Teminat</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            SÜREÇ İPTAL EDİLDİ: Tüm teklif sahiplerinin teminatı eksik veya usulsüz olduğundan ya da geçerli teklif sahibi kalmadığından ihale komisyon kararıyla iptal edilmiştir.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Başa Dön
                        </Button>
                    </div>
                );
                break;
            case 8:
                stepTitle = "Aşırı Düşük Teklif Kontrolü (Madde 38)";
                stepSubtitle = "Sınır değer altındaki tekliflerin analizi.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale komisyonunca hesaplanan sınır değerin (aşırı düşük teklif sorgu sınırının) altında teklif sunan istekli bulunuyor mu?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(82)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(9)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 82:
                stepTitle = "Aşırı Düşük Teklif Savunma Sorgusu";
                stepSubtitle = "Yazılı açıklama ve komisyon kararı.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            Sınır değerin altındaki istekliden yazılı açıklama (maliyet bileşenleri savunması) talep edildi mi ve sunulan savunma komisyonca uygun bulundu mu?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(9)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Savunma Uygun)
                            </Button>
                            <Button
                                onClick={() => goToStep(9)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır (Eleyerek Devam Et)
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 9:
                stepTitle = "İhale Yetkilisinin Kararı Onaylaması";
                stepSubtitle = "Kararın kesinleşme aşaması.";
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale komisyonunun aldığı ihale kararı, İhale Yetkilisi (idare amiri) tarafından 5 iş günü içinde onaylandı mı? (Madde 40)
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(10)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Onaylandı)
                            </Button>
                            <Button
                                onClick={() => goToStep(91)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır (Reddedildi)
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 91:
                stepTitle = "İhale İptal Edildi";
                stepSubtitle = "İhale Yetkilisi Kararı";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <X size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">İhale Yetkilisi Reddi</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            SÜREÇ İPTAL EDİLDİ: 4734 sayılı Kanunun 40. maddesi uyarınca ihale yetkilisi komisyon kararını onaylamazsa ihale iptal edilir. İhale yetkilisinin onay vermeme gerekçesini inceleyip ihaleyi yeniden ilan etmeniz gerekir.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Başa Dön
                        </Button>
                    </div>
                );
                break;
            case 10:
                stepTitle = "Kesinleşen Kararın Tebliği ve Bekleme Süresi";
                stepSubtitle = "Madde 41 şikayet başvuru bekleme süresi.";
                
                let wDays = ihaleRecommendedMethod.includes("Pazarlık") ? 5 : 10;
                
                stepContent = (
                    <div className="flex flex-col gap-4">
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-semibold leading-relaxed">
                            BİLGİ: İhale kararı tüm isteklilere tebliğ edilmeli ve tebligattan itibaren <strong>{wDays} günlük</strong> yasal itiraz/şikayet bekleme süresi doldurulmalıdır.
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            Yasal şikayet süreleri beklendi mi ve idareye yapılmış herhangi bir itiraz/şikayet başvurusu bulunmuyor mu?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(11)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Süre Doldu & İtiraz Yok)
                            </Button>
                            <Button
                                onClick={() => goToStep(101)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Şikayet Başvurusu Var
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 101:
                stepTitle = "İhale Süreci Askıya Alındı";
                stepSubtitle = "Resmi Şikayet Başvurusu Mevcut";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center text-slate-700 dark:text-slate-350">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <HelpCircle size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Sözleşme İmzalama Engeli</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            İdareye veya Kamu İhale Kurumuna yapılan şikayet başvuruları sonuçlanana, itirazlar karara bağlanana kadar sözleşme imzalanamaz. Süreç askıya alınmıştır. İtiraz reddedildikten sonra devam edebilirsiniz.
                        </p>
                        <div className="flex flex-col gap-2 mt-4 w-full">
                            <Button
                                onClick={() => goToStep(11)}
                                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Şikayet Sonuçlandı ve Reddedildi (Devam Et)
                            </Button>
                            <Button
                                onClick={handleIhaleBack}
                                variant="ghost"
                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs py-3"
                            >
                                Geri Dön
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 11:
                stepTitle = "Sözleşmeye Davet ve Kesin Teminat";
                stepSubtitle = "Sözleşme imza aşaması.";
                
                const finalBedel = ihaleBedeli || ihaleMaliyet;
                const calculatedGecici = finalBedel * 0.03;
                const calculatedKesin = finalBedel * 0.06;
                const calculatedSinirAlti = ihaleMaliyet * 0.09;
                const calculatedKararDV = finalBedel * 0.00569;
                const calculatedSozlesmeDV = finalBedel * 0.00948;
                const calculatedToplamDV = calculatedKararDV + calculatedSozlesmeDV;

                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-semibold leading-relaxed">
                            BİLGİ: İhale üzerinde kalan istekli, yasal tebliğ tarihinden itibaren 10 gün (yabancı istekliler için +12 gün eklenerek 22 gün) içinde sözleşmeyi imzalamak zorundadır.
                        </div>

                        {/* İhale Bedeli Girişi */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">İhale / Sözleşme Bedeli (TL)</label>
                                    <input 
                                        type="number"
                                        value={ihaleBedeli || ""}
                                        min={0}
                                        onChange={(e) => setIhaleBedeli(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold font-mono text-emerald-600"
                                        placeholder={`${ihaleMaliyet.toLocaleString("tr-TR")} TL`}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-wide text-slate-400 block mb-1">Sözleşme İmzalama Tarihi</label>
                                    <input 
                                        type="date"
                                        value={sozlesmeTarihi}
                                        onChange={(e) => setSozlesmeTarihi(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-bold font-mono text-slate-700 dark:text-slate-200"
                                    />
                                </div>
                            </div>

                            {/* Hesaplama Sonuçları */}
                            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vergi ve Teminat Hesaplama Sonuçları:</div>
                                <div className="grid grid-cols-2 gap-3 text-[10px] leading-relaxed">
                                    <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-400 block font-medium">Geçici Teminat (En Az %3)</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{calculatedGecici.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-400 block font-medium font-bold text-indigo-505">Kesin Teminat (%6)</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{calculatedKesin.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                    </div>
                                    {ihaleType === "yapim" && (
                                        <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2">
                                            <span className="text-slate-400 block font-medium">Sınır Altı Kesin Teminatı (%9 Yaklaşık Maliyet)</span>
                                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">{calculatedSinirAlti.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                        </div>
                                    )}
                                    <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-400 block font-medium">Karar Damga Vergisi (‰5.69)</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{calculatedKararDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-400 block font-medium">Sözleşme Damga Vergisi (‰9.48)</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{calculatedSozlesmeDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                    </div>
                                    <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 col-span-2 flex justify-between items-center">
                                        <span className="text-emerald-600 dark:text-emerald-450 font-bold">Toplam Damga Vergisi Yükü</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">{calculatedToplamDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İstekli kesin teminatını sunarak yasal süre içerisinde sözleşmeyi imzalamış mıdır?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(112)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet
                            </Button>
                            <Button
                                onClick={() => goToStep(113)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır / İmza Atmadı
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 112:
                stepTitle = "Sözleşme Başarıyla İmzalandı";
                stepSubtitle = "İhale Süreci Sonuçlandı";
                
                const summaryBedel = ihaleBedeli || ihaleMaliyet;
                const summaryGecici = summaryBedel * 0.03;
                const summaryKesin = summaryBedel * 0.06;
                const summarySinirAlti = ihaleMaliyet * 0.09;
                const summaryKararDV = summaryBedel * 0.00569;
                const summarySozlesmeDV = summaryBedel * 0.00948;
                const summaryToplamDV = summaryKararDV + summarySozlesmeDV;

                stepContent = (
                    <div className="flex flex-col gap-4 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <Check size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Sözleşme Yürürlükte</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Tebrikler! Kesin teminat teslim alınmış ve sözleşme imzalanmıştır. İsteklinin geçici teminatı iade edilebilir, yer teslimi ve işe başlama süreçleri başlatılabilir.
                        </p>
                        
                        {/* Summary Details Box */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-left text-[10px] space-y-2 mt-2 font-medium">
                            <div className="font-bold text-slate-750 dark:text-slate-250 border-b border-slate-200 dark:border-slate-800 pb-1.5 uppercase tracking-wider text-[9px]">Süreç Özet Raporu:</div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">İhale Usulü:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-350">{ihaleRecommendedMethod}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">İhale Tarihi:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-350">{new Date(ihaleTarihi).toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', year: 'numeric'})}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Yaklaşık Maliyet:</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{ihaleMaliyet.toLocaleString("tr-TR")} TL</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                                <span className="text-slate-400">İhale / Sözleşme Bedeli:</span>
                                <span className="font-mono font-bold text-emerald-600">{summaryBedel.toLocaleString("tr-TR")} TL</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Geçici Teminat (En Az %3):</span>
                                <span className="font-mono font-bold">{summaryGecici.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Kesin Teminat (%6):</span>
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{summaryKesin.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                            </div>
                            {ihaleType === "yapim" && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Sınır Altı Teminatı (%9 Yaklaşık M.):</span>
                                    <span className="font-mono font-bold text-amber-600">{summarySinirAlti.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-400">İhale Karar Damga Vergisi (‰5.69):</span>
                                <span className="font-mono font-bold">{summaryKararDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Sözleşme Damga Vergisi (‰9.48):</span>
                                <span className="font-mono font-bold">{summarySozlesmeDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                            </div>
                            <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-1.5 text-slate-850 dark:text-slate-150">
                                <span>Toplam Ödenen Damga Vergisi:</span>
                                <span className="font-mono text-emerald-600">{summaryToplamDV.toLocaleString("tr-TR", {minimumFractionDigits: 2, maximumFractionDigits: 2})} TL</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-4 w-full">
                            {ihaleType === "yapim" ? (
                                <Button
                                    onClick={() => goToStep(12)}
                                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                                >
                                    Yer Teslimi Kontrolüne Geç
                                </Button>
                            ) : (
                                <Button
                                    onClick={resetIhale}
                                    className="w-full rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                                >
                                    Yeni Sorgulama Başlat
                                </Button>
                            )}
                        </div>
                    </div>
                );
                break;
            case 113:
                stepTitle = "1. İsteklinin Teminatının Gelir Kaydedilmesi";
                stepSubtitle = "Yedek istekliye çağrı kararı.";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-[10px] font-semibold leading-relaxed">
                            YASAL İŞLEM: Sözleşmeyi imzalamayan isteklinin geçici teminatı protesto çekilmeksizin gelir (irat) kaydedilir.
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            İhale komisyon kararında yer alan ekonomik açıdan en avantajlı ikinci (yedek) istekli davet edilsin mi?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => {
                                    setIhaleRecommendedMethod(prev => prev + " (Yedek)");
                                    goToStep(11);
                                }}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet, Yedeği Davet Et
                            </Button>
                            <Button
                                onClick={() => goToStep(114)}
                                className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Hayır, İhaleyi İptal Et
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 114:
                stepTitle = "İhale İptal Edildi";
                stepSubtitle = "Sözleşme İmzasızlığı";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <X size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">İhale Sonlandırılamadı</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            İsteklilerin sözleşmeyi imzalamaması nedeniyle ihale iptal edilmiştir. Sunulan teklif teminatları gelir kaydedilmiştir. İhale dosyasının güncellenerek yeniden ihale edilmesi gerekmektedir.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Başa Dön
                        </Button>
                    </div>
                );
                break;
            case 12:
                stepTitle = "Yer Teslimi ve İşe Başlama Kontrolü (Yapım İşleri)";
                stepSubtitle = "Yapım İşleri Genel Şartnamesi yer teslim süreçleri.";
                
                const latestYer5 = calculateForwardDateOffset(sozlesmeTarihi, 5);
                const latestYer15 = calculateForwardDateOffset(sozlesmeTarihi, 15);

                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="p-3.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] space-y-2 leading-relaxed">
                            <div>📌 <strong>Yer Teslimi:</strong> Yapım işlerinde sözleşmenin imzalanmasından sonra, sözleşmesinde aksine bir hüküm yoksa <strong>en geç 5 veya 15 gün içinde</strong> yükleniciye yer teslimi yapılmalıdır.</div>
                            <div>🚀 Yer teslim tutanağının imzalandığı gün <strong>işe başlama tarihi</strong> olarak kabul edilir ve sözleşme süresi başlar.</div>
                        </div>

                        {/* Yer Teslim Tarihleri Bilgisi */}
                        {sozlesmeTarihi && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] space-y-1.5 font-bold">
                                <div className="flex justify-between text-slate-500">
                                    <span>Sözleşme İmza Tarihi:</span>
                                    <span>{new Date(sozlesmeTarihi).toLocaleDateString('tr-TR', {day: 'numeric', month: 'long', year: 'numeric'})}</span>
                                </div>
                                <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                                    <span>En Geç Yer Teslimi (5 Günlük Süre):</span>
                                    <span>{latestYer5}</span>
                                </div>
                                <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                                    <span>En Geç Yer Teslimi (15 Günlük Süre):</span>
                                    <span>{latestYer15}</span>
                                </div>
                            </div>
                        )}

                        <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                            Yükleniciye yasal süreler dahilinde fiili yer teslimi yapıldı mı ve yer teslim tutanağı imzalandı mı?
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                onClick={() => goToStep(121)}
                                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Evet (Yer Teslimi Yapıldı)
                            </Button>
                            <Button
                                onClick={() => goToStep(122)}
                                className="rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black uppercase text-[10px] py-3"
                            >
                                Hayır / Gecikti
                            </Button>
                        </div>
                    </div>
                );
                break;
            case 121:
                stepTitle = "İhale ve İşe Başlama Süreci Tamamlandı";
                stepSubtitle = "Mevzuata Uygun İşe Başlama";
                stepContent = (
                    <div className="flex flex-col gap-4 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <Check size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Süreç Başarıyla Sonuçlandı</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Tebrikler! Sözleşme imzalanmasını müteakip yasal sürede yer teslimi yapılmış, işe başlama tarihi tescil edilmiş ve sözleşme süresi resmen başlamıştır.
                        </p>
                        <Button
                            onClick={resetIhale}
                            className="w-full mt-4 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] py-3"
                        >
                            Yeni Sorgulama Başlat
                        </Button>
                    </div>
                );
                break;
            case 122:
                stepTitle = "Yer Teslim Gecikmesi & Süre Uzatımı Uyarısı";
                stepSubtitle = "Mevzuat Uyarısı ve Yasal Haklar";
                stepContent = (
                    <div className="flex flex-col gap-4 text-slate-700 dark:text-slate-350">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto my-2">
                            <AlertTriangle size={32} />
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 text-center">İdareden Kaynaklı Gecikme Sorumluluğu</div>
                        <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                            UYARI: İdarenin kusuru (kamulaştırma eksikliği, imar sorunları veya arsa ihtilafları) nedeniyle yer tesliminin gecikmesi durumunda, yükleniciye gecikilen gün kadar <strong>süre uzatımı verilmesi yasal bir zorunluluktur</strong>. Gecikme süresi yüklenicinin taahhüdünü yerine getirmesini engelliyorsa yüklenici sözleşmeyi feshedip teminatın iadesini talep edebilir.
                        </p>
                        <div className="flex flex-col gap-2 mt-4 w-full">
                            <Button
                                onClick={() => goToStep(121)}
                                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] py-3"
                            >
                                Süre Uzatımı Vererek Devam Et
                            </Button>
                            <Button
                                onClick={handleIhaleBack}
                                variant="ghost"
                                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs py-3"
                            >
                                Geri Dön
                            </Button>
                        </div>
                    </div>
                );
                break;
            default:
                break;
        }

        return createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-4 font-outfit">
                <Card className="w-full max-w-lg rounded-3xl border border-white/60 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl relative flex flex-col overflow-hidden max-h-[90vh]">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <Shield size={18} />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">İhale Kontrol Karar Ağacı</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">4734 & 4735 Sayılı Kanun</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsIhaleModalOpen(false)}
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-355 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Stepper progress indicator */}
                    <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-[9px] font-black tracking-wider text-slate-400 uppercase">
                        <div>Adım {ihaleStep > 20 ? "Sonuç" : ihaleStep}</div>
                        {ihaleType && (
                            <div className="flex items-center gap-1.5 text-indigo-500">
                                <span>{ihaleType === "yapim" ? "Yapım" : ihaleType === "mal" ? "Mal" : "Hizmet"}</span>
                                {ihaleMaliyet > 0 && (
                                    <>
                                        <ChevronRight size={8} />
                                        <span>{ihaleMaliyet.toLocaleString("tr-TR")} TL</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step Title & Subtitle */}
                    <div className="px-6 pt-5 pb-2">
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">{stepTitle}</h3>
                        <p className="text-slate-400 text-[10px] font-semibold leading-relaxed mt-0.5">{stepSubtitle}</p>
                    </div>

                    {/* Content Body */}
                    <div className="px-6 py-4 flex-1 overflow-y-auto min-h-[220px]">
                        {stepContent}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                        {ihaleHistory.length > 0 ? (
                            <Button
                                onClick={handleIhaleBack}
                                variant="ghost"
                                className="rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold py-1.5 flex items-center gap-1.5 bg-transparent"
                            >
                                <ArrowLeft size={14} />
                                Geri Git
                            </Button>
                        ) : (
                            <div />
                        )}
                        <Button
                            onClick={resetIhale}
                            variant="ghost"
                            className="rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold py-1.5 bg-transparent"
                        >
                            Sıfırla / Baştan Al
                        </Button>
                    </div>
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

const renderPratikModal = () => {
        if (!isPratikModalOpen) return null;
        return createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                <Card className="w-full max-w-6xl p-8 rounded-[32px] bg-card border-white/60 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                                <HelpCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">Pratik Bilgiler</h3>
                                <p className="text-xs text-slate-500 font-medium">Teftiş ve idari işlemlerinizde ihtiyaç duyabileceğiniz güncel limitler ve yasal oranlar.</p>
                            </div>
                        </div>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setIsPratikModalOpen(false)} 
                            className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={20} />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-outfit">
                        
                        {/* 1. Damga Vergisi Oranları */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-amber-500" />
                                    Damga Vergisi Oranları
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Sözleşmeler, kararlar, beyannameler ve diğer kağıtlar için geçerli resmi damga vergisi oranlarına ulaşın.
                                </p>
                            </div>
                            <a
                                href="https://www.verginet.net/dtt/1/Damga-Vergisi-Oranlari.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full text-center inline-block bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all"
                            >
                                Detayları Göster <ExternalLink size={10} className="inline-block ml-1" />
                            </a>
                        </div>

                        {/* 2. KDV Tevkifat Oranları */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-amber-500" />
                                    KDV Tevkifat Oranları
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Mal ve hizmet alımlarında uygulanması gereken katma değer vergisi tevkifat oranlarının güncel listesi.
                                </p>
                            </div>
                            <a
                                href="https://www.verginet.net/dtt/1/KDV-Tevkifat-Oranlari.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full text-center inline-block bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all"
                            >
                                Detayları Göster <ExternalLink size={10} className="inline-block ml-1" />
                            </a>
                        </div>

                        {/* 3. Gecikme Zammı Oranları */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                                    <FileText size={16} className="text-amber-500" />
                                    Gecikme Zammı Oranları
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Vadelerinde ödenmeyen kamu alacakları için dönemler halinde uygulanan gecikme zammı oranları.
                                </p>
                            </div>
                            <a
                                href="https://www.verginet.net/dtt/1/Gecikme_Zammi.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full text-center inline-block bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all"
                            >
                                Detayları Göster <ExternalLink size={10} className="inline-block ml-1" />
                            </a>
                        </div>

                        {/* 4. Doğrudan Temin Limitleri */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 gap-3 md:col-span-2 lg:col-span-1">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <FileSpreadsheet size={16} className="text-amber-500" />
                                Doğrudan Temin Limitleri
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-black uppercase">
                                            <th className="py-1">Yıl</th>
                                            <th className="py-1 text-right">Büyükşehir (TL)</th>
                                            <th className="py-1 text-right">Diğer İdare (TL)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-medium text-slate-700 dark:text-slate-300">
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40">
                                            <td className="py-1">2020</td>
                                            <td className="py-1 text-right font-mono">97.008,00</td>
                                            <td className="py-1 text-right font-mono">32.316,00</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40">
                                            <td className="py-1">2021</td>
                                            <td className="py-1 text-right font-mono">121.405,00</td>
                                            <td className="py-1 text-right font-mono">40.443,00</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40">
                                            <td className="py-1">2022</td>
                                            <td className="py-1 text-right font-mono">218.395,00</td>
                                            <td className="py-1 text-right font-mono">72.752,00</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40">
                                            <td className="py-1">2023</td>
                                            <td className="py-1 text-right font-mono">431.810,00</td>
                                            <td className="py-1 text-right font-mono">143.845,00</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40">
                                            <td className="py-1">2024</td>
                                            <td className="py-1 text-right font-mono">622.756,00</td>
                                            <td className="py-1 text-right font-mono">207.453,00</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 dark:border-slate-800/40 bg-amber-500/5 font-bold">
                                            <td className="py-1 text-amber-500">2025 *</td>
                                            <td className="py-1 text-right font-mono">800.366,00</td>
                                            <td className="py-1 text-right font-mono">266.618,00</td>
                                        </tr>
                                        <tr className="bg-amber-500/5 font-bold">
                                            <td className="py-1 text-amber-500">2026 **</td>
                                            <td className="py-1 text-right font-mono">1.021.827,00</td>
                                            <td className="py-1 text-right font-mono">340.391,00</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                                * 01.02.2025 - 31.01.2026 dönemini kapsar.<br />
                                ** 01.02.2026 - 31.01.2027 dönemini kapsar.
                            </p>
                        </div>

                        {/* 5. Memur Aylık Maaş Katsayıları */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 gap-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Settings size={16} className="text-amber-500" />
                                Memur Aylık Maaş Katsayıları
                            </h4>
                            <div className="overflow-y-auto max-h-[170px] pr-1">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-black uppercase sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                            <th className="py-1">Dönem</th>
                                            <th className="py-1 text-right">Katsayı</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-medium text-slate-700 dark:text-slate-300">
                                        {[
                                            { p: '2020 Ocak - Haz', v: '0,146061' },
                                            { p: '2020 Tem - Ara', v: '0,154461' },
                                            { p: '2021 Ocak - Haz', v: '0,165786' },
                                            { p: '2021 Tem - Ara', v: '0,179797' },
                                            { p: '2022 Ocak - Haz', v: '0,235445' },
                                            { p: '2022 Tem - Ara', v: '0,333603' },
                                            { p: '2023 Ocak - Haz', v: '0,433684' },
                                            { p: '2023 Tem - Ara', v: '0,509796' },
                                            { p: '2024 Ocak - Haz', v: '0,760871' },
                                            { p: '2024 Tem - Ara', v: '0,907796' },
                                            { p: '2025 Ocak - Haz', v: '1,012556' },
                                            { p: '2025 Tem - Ara', v: '1,170211' },
                                            { p: '2026 Ocak - Haz', v: '1,387871' },
                                            { p: '2026 Tem - Ara', v: '1,575512' }
                                        ].map((row, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/40">
                                                <td className="py-1">{row.p}</td>
                                                <td className="py-1 text-right font-mono">{row.v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                Hazine ve Maliye Bakanlığı genelgelerine göre belirlenmiştir.
                            </p>
                        </div>

                        {/* 6. Yıllara Göre Memur Aile & Çocuk Yardımı */}
                        <div className="flex flex-col p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 gap-3">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Users size={16} className="text-amber-500" />
                                Aile & Çocuk Yardımı Tutarları
                            </h4>
                            <div className="overflow-y-auto max-h-[170px] pr-1">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-black uppercase sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
                                            <th className="py-1">Dönem</th>
                                            <th className="py-1 text-right">Eş Yard.</th>
                                            <th className="py-1 text-right">Çocuk (0-6)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-medium text-slate-700 dark:text-slate-300">
                                        {[
                                            { p: '2020 Ocak - Haz', e: '351,00 TL', c: '77-130 TL' },
                                            { p: '2020 Tem - Ara', e: '375,00 TL', c: '77-130 TL' },
                                            { p: '2021 Ocak', e: '403,00 TL', c: '77-130 TL' },
                                            { p: '2021 Temmuz', e: '436,00 TL', c: '77-130 TL' },
                                            { p: '2022 İlk Yarı', e: '521,00 TL', c: '77-130 TL' },
                                            { p: '2022 Temmuz', e: '730,00 TL', c: '77-130 TL' },
                                            { p: '2023 Ocak - Haz', e: '1.157,00 TL', c: '216,84 TL' },
                                            { p: '2023 Tem - Ara', e: '2.208,00 TL', c: '254,90 TL' },
                                            { p: '2024 Ocak', e: '3.111,00 TL', c: '400,05 TL' },
                                            { p: '2024 Temmuz', e: '3.897,00 TL', c: '485,00 TL' },
                                            { p: '2025 Ocak', e: '4.550,00 TL', c: '506,28 TL' },
                                            { p: '2025 Temmuz', e: '5.270,00 TL', c: '585,11 TL' },
                                            { p: '2026 Ocak - Haz', e: '3.154,63 TL', c: '693,92 TL', active: true },
                                            { p: '2026 Tem - Ara', e: '3.581,45 TL', c: '787,82 TL', active: true }
                                        ].map((row, idx) => (
                                            <tr key={idx} className={cn("border-b border-slate-100 dark:border-slate-800/40", row.active && "bg-amber-500/5 font-bold")}>
                                                <td className={cn("py-1", row.active && "text-amber-500")}>{row.p}</td>
                                                <td className="py-1 text-right font-mono">{row.e}</td>
                                                <td className="py-1 text-right font-mono">{row.c}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                6 yaş üstü çocuk yardımı 0-6 yaşın yarısıdır. (0-6 yaş 500 gös., 6 yaş üstü 250 gös.)
                            </p>
                        </div>

                    </div>
                </Card>
            </div>,
            document.body
        );
    };

    const renderRaporSubDashboard = () => {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
                    <div className="w-full">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                            <Shield size={10} className="text-primary/60" />
                            <span>MufYard Platformu</span>
                            <ChevronRight size={10} />
                            <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setIsRaporSubActive(false)}>Diğer İşlem ve Belgeler</span>
                            <ChevronRight size={10} />
                            <span className="text-primary opacity-80 uppercase tracking-widest">Rapor İşlemleri</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => setIsRaporSubActive(false)}
                                variant="ghost"
                                className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-all flex items-center justify-center bg-transparent"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    Rapor İşlemleri
                                </h1>
                                <p className="text-slate-500 text-sm font-medium mt-1">Dizi Pusulası, teftiş kapak ve müfettiş yardımcısı değerlendirme belgelerine erişin.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-grid with three items */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Sub-card 1: Müfettiş Yardımcısı Değerlendirme Formu */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Değerlendirme Formu</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Müfettiş yardımcılarının teftiş ve soruşturma aşamalarındaki resmi değerlendirme formunu düzenleyin ve yazdırın.
                        </p>
                        <Button 
                            onClick={() => setIsFormModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Sub-card 2: Dizi Pusulası Taslağı */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <ListIcon size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Dizi Pusulası Taslağı</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Teftiş raporu eklerinin listelendiği resmi Dizi Pusulası belgesini (.docx) hazırlayın ve çıktı alın.
                        </p>
                        <Button 
                            onClick={() => setIsDiziModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Sub-card 3: Teftiş Rapor Kapağı Taslağı */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Teftiş Rapor Kapağı Taslağı</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Bakanlık onayları, görev emirleri ve müfettiş imza bloklarını içeren resmi rapor kapak belgesini oluşturup indirin.
                        </p>
                        <Button 
                            onClick={() => setIsKapakModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>
                </div>
            </div>
        );
    };    const renderIhaleSubDashboard = () => {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
                    <div className="w-full">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                            <Shield size={10} className="text-primary/60" />
                            <span>MufYard Platformu</span>
                            <ChevronRight size={10} />
                            <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setIsIhaleSubActive(false)}>Diğer İşlem ve Belgeler</span>
                            <ChevronRight size={10} />
                            <span className="text-primary opacity-80 uppercase tracking-widest">İhale İşlemleri</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => setIsIhaleSubActive(false)}
                                variant="ghost"
                                className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-all flex items-center justify-center bg-transparent"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    İhale İşlemleri
                                </h1>
                                <p className="text-slate-500 text-sm font-medium mt-1">İhale kontrol sihirbazı, KİK limit kontrolleri, hakediş hesaplama ve birim poz fiyatlarına erişin.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-grid with four items */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Card 1: İhale Kontrol (2025 Limitleri) */}
                    <Card className="flex flex-col p-5 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-500 w-fit mb-5 group-hover:scale-110 transition-transform duration-500">
                            <Shield size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1.5">İhale Kontrol (2025 Limitleri)</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed flex-1">
                            4734 ve 4735 Sayılı Kanun kapsamındaki 2025 limitlerine göre mal, hizmet ve yapım işleri alım süreçlerini adım adım takip edin.
                        </p>
                        <Button 
                            onClick={() => {
                                resetIhale();
                                setIsIhaleModalOpen(true);
                            }}
                            className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-wider py-2.5 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 2: İhale Kontrol 2 (2026-2027 Limitleri) */}
                    <Card className="flex flex-col p-5 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-500 w-fit mb-5 group-hover:scale-110 transition-transform duration-500">
                            <Shield size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1.5">İhale Kontrol 2 (2026-2027 Limitleri)</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed flex-1">
                            2026-2027 Kamu İhale parasal limitlerine göre bütçe, komisyon, aşırı düşük ve stand-still kurallarını adım adım denetleyin.
                        </p>
                        <Button 
                            onClick={() => {
                                resetIhale2();
                                setIsIhale2ModalOpen(true);
                            }}
                            className="mt-5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-wider py-2.5 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 3: Hakediş ve Kesinti Hesaplama */}
                    <Card className="flex flex-col p-5 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-3.5 rounded-xl bg-orange-500/10 text-orange-500 w-fit mb-5 group-hover:scale-110 transition-transform duration-500">
                            <FileSpreadsheet size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1.5">Hakediş ve Kesinti</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed flex-1">
                            İmalat kalemleri tablosu üzerinden stopaj, damga, SGK borç kesintili hakediş raporu ve Excel tablosu hazırlayın.
                        </p>
                        <Button 
                            onClick={() => setIsHakedisModalOpen(true)}
                            className="mt-5 w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] tracking-wider py-2.5 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 4: İnşaat Birim Poz Fiyatları */}
                    <Card className="flex flex-col p-5 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-sky-500/10 to-blue-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-3.5 rounded-xl bg-sky-500/10 text-sky-500 w-fit mb-5 group-hover:scale-110 transition-transform duration-500">
                            <ExternalLink size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1.5">İnşaat Birim Poz Fiyatları</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed flex-1">
                            Çevre, Şehircilik ve İklim Değişikliği Bakanlığı Yüksek Fen Kurulu inşaat birim poz fiyatları resmi sayfasına erişin.
                        </p>
                        <Button 
                            onClick={() => window.open("https://yfk.csb.gov.tr/birim-fiyatlar-100468", "_blank")}
                            className="mt-5 w-full rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black uppercase text-[9px] tracking-wider py-2.5 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>
                </div>
            </div>
        );
    };

    const renderHesaplamaSubDashboard = () => {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 dark:bg-slate-900/40 p-6 rounded-3xl border border-white/60 dark:border-slate-800 backdrop-blur-xl shadow-sm">
                    <div className="w-full">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                            <Shield size={10} className="text-primary/60" />
                            <span>MufYard Platformu</span>
                            <ChevronRight size={10} />
                            <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setIsHesaplamaSubActive(false)}>Diğer İşlem ve Belgeler</span>
                            <ChevronRight size={10} />
                            <span className="text-primary opacity-80 uppercase tracking-widest">Hesaplama Araçları</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => setIsHesaplamaSubActive(false)}
                                variant="ghost"
                                className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-all flex items-center justify-center bg-transparent"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    Hesaplama Araçları
                                </h1>
                                <p className="text-slate-500 text-sm font-medium mt-1">Lojman, Yolluk ve Görevlendirme Ücreti hesaplama araçlarına erişin.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-grid with three items */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Sub-card 1: Lojman Kira Hesaplama */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <FileSpreadsheet size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Lojman Kira Hesaplama</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Kamu konutlarının (lojmanların) aylık kira bedelini, yakıt, kapıcı, elektrik ve su gibi ek bedeller dahil ederek resmi genelge kurallarına göre hesaplayın.
                        </p>
                        <Button 
                            onClick={() => setIsLojmanModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest py-3 animate-pulse hover:animate-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Sub-card 2: Sürekli Görev Yolluğu Hesaplama */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Users size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Sürekli Görev Yolluğu Hesaplama</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Nakil veya emeklilik nedeniyle ödenecek sürekli görev yolluğu (tayin bedeli) ve yolluk tazminatı tutarını aile fertleri dahil resmi kurallara göre hesaplayın.
                        </p>
                        <Button 
                            onClick={() => setIsYollukModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest py-3 animate-pulse hover:animate-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Sub-card 3: Görevlendirme Ücreti Hesaplama */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Briefcase size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Görevlendirme Ücreti Hesaplama</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Bakanlık görevlendirmeleri, hakemlikler, jüri ve sınav komisyonu üyeliklerinde resmi gösterge tabloları üzerinden Gelir/Damga vergisi kesintili net görev ücreti hesaplayın.
                        </p>
                        <Button 
                            onClick={() => setIsGorevModalOpen(true)}
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
                {renderPratikModal()}
                {renderLojmanModal()}
                {renderCityListModal()}
                {renderYollukModal()}
                {renderGorevModal()}
            </div>
        );
    };

    const renderDashboard = () => {
        return (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 font-outfit">
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
                        <p className="text-slate-500 text-sm font-medium mt-1">Resmi rapor hazırlama şablonları, ihale kontrol sistemleri ve yolluk/lojman hesaplama araçlarını kullanın.</p>
                    </div>
                </div>

                {/* Main Grid - 4 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Card 1: Rapor İşlemleri */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Rapor İşlemleri</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Dizi Pusulası, teftiş kapak belgesi ve müfettiş yardımcısı değerlendirme form şablonlarına erişin.
                        </p>
                        <Button 
                            onClick={() => {
                                setIsRaporSubActive(true);
                                setIsIhaleSubActive(false);
                                setIsHesaplamaSubActive(false);
                            }}
                            className="mt-6 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 2: İhale İşlemleri */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Settings size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">İhale İşlemleri</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            İhale kontrol sihirbazı, KİK limit kontrolleri, hakediş kesinti hesap cetveli ve inşaat birim poz fiyatlarına erişin.
                        </p>
                        <Button 
                            onClick={() => {
                                setIsIhaleSubActive(true);
                                setIsRaporSubActive(false);
                                setIsHesaplamaSubActive(false);
                            }}
                            className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 3: Hesaplama Araçları */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <Calculator size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Hesaplama Araçları</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Lojman kira bedeli hesaplama, sürekli görev yolluğu tayin bedeli hesabı ve görevlendirme ek ders/sınav ücreti hesaplama araçları.
                        </p>
                        <Button 
                            onClick={() => {
                                setIsHesaplamaSubActive(true);
                                setIsIhaleSubActive(false);
                                setIsRaporSubActive(false);
                            }}
                            className="mt-6 w-full rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>

                    {/* Card 4: Pratik Bilgiler */}
                    <Card className="flex flex-col p-6 rounded-3xl border-white/60 dark:border-slate-800 bg-card/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                        <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 w-fit mb-6 group-hover:scale-110 transition-transform duration-500">
                            <HelpCircle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Pratik Bilgiler</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed flex-1">
                            Müfettişler ve denetim personeli için sıkça sorulan sorular, memur katsayıları, harcırah tutarları ve doğrudan temin limit özetleri.
                        </p>
                        <Button 
                            onClick={() => setIsPratikModalOpen(true)}
                            className="mt-6 w-full rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] tracking-widest py-3 border-none"
                        >
                            Uygulamayı Aç
                        </Button>
                    </Card>
                </div>
            </div>
        );
    };    if (scope === "other") {
        return (
            <>
                {isRaporSubActive && renderRaporSubDashboard()}
                {isIhaleSubActive && renderIhaleSubDashboard()}
                {isHesaplamaSubActive && renderHesaplamaSubDashboard()}
                {!isRaporSubActive && !isIhaleSubActive && !isHesaplamaSubActive && renderDashboard()}

                {/* Render Modals */}
                {renderFormModal()}
                {renderPratikModal()}
                {renderLojmanModal()}
                {renderCityListModal()}
                {renderYollukModal()}
                {renderGorevModal()}
                {renderIhaleModal()}
                {renderIhale2Modal()}
                {renderHakedisModal()}
                {renderDiziModal()}
                {renderKapakModal()}
            </>
        );
    }

    const isOtherScopeExplorer = false;

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
                        {isOtherScopeExplorer ? (
                            <>
                                <span className="hover:text-primary cursor-pointer transition-colors font-bold" onClick={() => {}}>Diğer İşlem ve Belgeler</span>
                                <ChevronRight size={10} />
                                <span className="text-primary opacity-80 uppercase tracking-widest">Özel Belgeler ve Dosyalar</span>
                            </>
                        ) : (
                            <span className="text-primary opacity-80 uppercase tracking-widest">Dosya Yönetimi</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {isOtherScopeExplorer && (
                            <Button
                                onClick={() => {}}
                                variant="ghost"
                                className="p-2 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-355 transition-all flex items-center justify-center bg-transparent border-none"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                        )}
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                {isOtherScopeExplorer ? "Özel Belgeler ve Dosyalar" : "Dosya Yönetimi"}
                            </h1>
                            <p className="text-slate-500 text-sm font-medium mt-1">
                                {isOtherScopeExplorer 
                                    ? "Diğer İşlem ve Belgeler klasöründeki özel belgelerinizi ve Excel tablolarınızı listeleyin." 
                                    : "Denetim klasörlerinizi ve belgelerinizi organize edin."}
                            </p>
                        </div>
                    </div>
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
