export interface SikayetBedeliTier {
    aralik: string;
    bedel: string;
}

export interface YearEsikDegerItem {
    year: string;
    donem: string;
    tebligNo: string;
    resmiGazete: string;
    pdfFileName: string;
    pdfUrl: string;
    isCurrent?: boolean;
    // Madde 8 Eşik Değerler
    esikDegerler: {
        malHizmetGenel: string;   // 8/a
        malHizmetDiger: string;   // 8/b
        yapim: string;            // 8/c
    };
    // Parasal Limitler
    parasalLimitler: {
        istisna3g: string;                // 3/g
        pazarlik21f: string;              // 21/f
        dogrudanTeminBuyuksehir: string;   // 22/d
        dogrudanTeminDiger: string;        // 22/d
        kurumPayiLimit53j1: string;       // 53/j-1
        muhendisMimarDeneyim62h: string;  // 62/h
        ilanUcreti?: string;
        ilanSureleri13b: string[];
        sikayetBedelleri53j2?: SikayetBedeliTier[];
    };
}

export const ESIK_DEGERLER_DATA: Record<string, YearEsikDegerItem> = {
    '2026': {
        year: '2026',
        donem: '01.02.2026 - 31.01.2027',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2026/1)',
        resmiGazete: '22.01.2026 / Sayı: 33145',
        pdfFileName: '2026_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2026_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        isCurrent: true,
        esikDegerler: {
            malHizmetGenel: '18.734.124 TL',
            malHizmetDiger: '31.223.628 TL',
            yapim: '686.924.429 TL'
        },
        parasalLimitler: {
            istisna3g: '156.712.536 TL',
            pazarlik21f: '3.406.508 TL',
            dogrudanTeminBuyuksehir: '1.021.827 TL',
            dogrudanTeminDiger: '340.391 TL',
            kurumPayiLimit53j1: '6.813.294 TL',
            muhendisMimarDeneyim62h: '3.781.281 TL',
            ilanUcreti: '9.000 TL (7.500 + %20 KDV)',
            ilanSureleri13b: ['2.043.844 TL', '4.087.898 TL', '34.067.732 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 10.785.492 TL', bedel: '64.652 TL' },
                { aralik: '10.785.492 - 43.142.132 TL', bedel: '129.385 TL' },
                { aralik: '43.142.132 - 323.566.103 TL', bedel: '194.085 TL' },
                { aralik: '323.566.103 TL ve üzeri', bedel: '258.810 TL' }
            ]
        }
    },
    '2025': {
        year: '2025',
        donem: '01.02.2025 - 31.01.2026',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2025/1)',
        resmiGazete: '24.01.2025 / Sayı: 32792',
        pdfFileName: '2025_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2025_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '14.673.866 TL',
            malHizmetDiger: '24.456.512 TL',
            yapim: '538.046.863 TL'
        },
        parasalLimitler: {
            istisna3g: '122.748.129 TL',
            pazarlik21f: '2.668.214 TL',
            dogrudanTeminBuyuksehir: '800.366 TL',
            dogrudanTeminDiger: '266.618 TL',
            kurumPayiLimit53j1: '5.336.645 TL',
            muhendisMimarDeneyim62h: '2.961.762 TL',
            ilanUcreti: '7.200 TL (6.000 + %20 KDV)',
            ilanSureleri13b: ['1.600.881 TL', '3.201.926 TL', '26.684.211 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 8.447.946 TL', bedel: '50.640 TL' },
                { aralik: '8.447.946 - 33.791.911 TL', bedel: '101.344 TL' },
                { aralik: '33.791.911 - 253.439.417 TL', bedel: '152.021 TL' },
                { aralik: '253.439.417 TL ve üzeri', bedel: '202.718 TL' }
            ]
        }
    },
    '2024': {
        year: '2024',
        donem: '01.02.2024 - 31.01.2025',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2024/1)',
        resmiGazete: '24.01.2024 / Sayı: 32439',
        pdfFileName: '2024_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2024_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '11.417.574 TL',
            malHizmetDiger: '19.029.344 TL',
            yapim: '418.648.353 TL'
        },
        parasalLimitler: {
            istisna3g: '95.508.971 TL',
            pazarlik21f: '2.076.108 TL',
            dogrudanTeminBuyuksehir: '622.756 TL',
            dogrudanTeminDiger: '207.453 TL',
            kurumPayiLimit53j1: '4.152.385 TL',
            muhendisMimarDeneyim62h: '2.304.515 TL',
            ilanUcreti: '5.400 TL (4.500 + %20 KDV)',
            ilanSureleri13b: ['1.245.628 TL', '2.491.384 TL', '20.762.692 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 6.573.254 TL', bedel: '39.403 TL' },
                { aralik: '6.573.254 - 26.293.115 TL', bedel: '78.855 TL' },
                { aralik: '26.293.115 - 197.198.426 TL', bedel: '118.286 TL' },
                { aralik: '197.198.426 TL ve üzeri', bedel: '157.733 TL' }
            ]
        }
    },
    '2023': {
        year: '2023',
        donem: '01.02.2023 - 31.01.2024',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2023/1)',
        resmiGazete: '25.01.2023 / Sayı: 32084',
        pdfFileName: '2023_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2023_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '7.916.776 TL',
            malHizmetDiger: '13.194.664 TL',
            yapim: '290.284.533 TL'
        },
        parasalLimitler: {
            istisna3g: '66.224.498 TL',
            pazarlik21f: '1.439.543 TL',
            dogrudanTeminBuyuksehir: '431.810 TL',
            dogrudanTeminDiger: '143.845 TL',
            kurumPayiLimit53j1: '2.879.202 TL',
            muhendisMimarDeneyim62h: '1.597.917 TL',
            ilanSureleri13b: ['863.700 TL', '1.727.489 TL', '14.396.542 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 4.557.797 TL', bedel: '27.322 TL' },
                { aralik: '4.557.797 - 18.231.255 TL', bedel: '54.677 TL' },
                { aralik: '18.231.255 - 136.734.452 TL', bedel: '82.018 TL' },
                { aralik: '136.734.452 TL ve üzeri', bedel: '109.370 TL' }
            ]
        }
    },
    '2022': {
        year: '2022',
        donem: '01.02.2022 - 31.01.2023',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2022/1)',
        resmiGazete: '20.01.2022 / Sayı: 31725',
        pdfFileName: '2022_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2022_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '4.004.034 TL',
            malHizmetDiger: '6.673.409 TL',
            yapim: '146.815.969 TL'
        },
        parasalLimitler: {
            istisna3g: '33.494.082 TL',
            pazarlik21f: '728.072 TL',
            dogrudanTeminBuyuksehir: '218.395 TL',
            dogrudanTeminDiger: '72.752 TL',
            kurumPayiLimit53j1: '1.456.202 TL',
            muhendisMimarDeneyim62h: '808.172 TL',
            ilanSureleri13b: ['436.830 TL', '873.705 TL', '7.281.278 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 2.305.178 TL', bedel: '13.819 TL' },
                { aralik: '2.305.178 - 9.220.744 TL', bedel: '27.654 TL' },
                { aralik: '9.220.744 - 69.155.600 TL', bedel: '41.482 TL' },
                { aralik: '69.155.600 TL ve üzeri', bedel: '55.316 TL' }
            ]
        }
    },
    '2021': {
        year: '2021',
        donem: '01.02.2021 - 31.01.2022',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2021/1)',
        resmiGazete: '26.01.2021 / Sayı: 31376',
        pdfFileName: '2021_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2021_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '2.225.824 TL',
            malHizmetDiger: '3.709.717 TL',
            yapim: '81.614.303 TL'
        },
        parasalLimitler: {
            istisna3g: '18.619.202 TL',
            pazarlik21f: '404.732 TL',
            dogrudanTeminBuyuksehir: '121.405 TL',
            dogrudanTeminDiger: '40.443 TL',
            kurumPayiLimit53j1: '809.496 TL',
            muhendisMimarDeneyim62h: '449.259 TL',
            ilanSureleri13b: ['242.832 TL', '485.689 TL', '4.047.628 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 1.281.438 TL', bedel: '7.682 TL' },
                { aralik: '1.281.438 - 5.125.768 TL', bedel: '15.373 TL' },
                { aralik: '5.125.768 - 38.443.271 TL', bedel: '23.060 TL' },
                { aralik: '38.443.271 TL ve üzeri', bedel: '30.750 TL' }
            ]
        }
    },
    '2020': {
        year: '2020',
        donem: '01.02.2020 - 31.01.2021',
        tebligNo: 'Kamu İhale Tebliği (Tebliğ No: 2020/1)',
        resmiGazete: '29.01.2020 / Sayı: 31023',
        pdfFileName: '2020_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        pdfUrl: '/eşik değerler/2020_Esik_Degerler_Parasal_Limitler_Karsilastirma.pdf',
        esikDegerler: {
            malHizmetGenel: '1.778.525 TL',
            malHizmetDiger: '2.964.217 TL',
            yapim: '65.213.187 TL'
        },
        parasalLimitler: {
            istisna3g: '14.877.509 TL',
            pazarlik21f: '323.398 TL',
            dogrudanTeminBuyuksehir: '97.008 TL',
            dogrudanTeminDiger: '32.316 TL',
            kurumPayiLimit53j1: '646.821 TL',
            muhendisMimarDeneyim62h: '358.977 TL',
            ilanSureleri13b: ['194.033 TL', '388.086 TL', '3.234.222 TL'],
            sikayetBedelleri53j2: [
                { aralik: '0 - 1.023.922 TL', bedel: '6.139 TL' },
                { aralik: '1.023.922 - 4.095.700 TL', bedel: '12.284 TL' },
                { aralik: '4.095.700 - 30.717.756 TL', bedel: '18.426 TL' },
                { aralik: '30.717.756 TL ve üzeri', bedel: '24.571 TL' }
            ]
        }
    }
};

export const ALL_YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'] as const;

export const openEsikDegerPdf = (item: YearEsikDegerItem) => {
    const safeUrl = encodeURI(item.pdfUrl);
    window.open(safeUrl, '_blank');
};

export const downloadEsikDegerPdf = (item: YearEsikDegerItem) => {
    const link = document.createElement('a');
    link.href = encodeURI(item.pdfUrl);
    link.download = item.pdfFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
