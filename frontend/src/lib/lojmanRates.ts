export interface LojmanYearRates {
    kerpic: number;
    kalorifersiz: number;
    kaloriferli: number;
    kapici: number;
    elektrik: number;
    su: number;
    elektrik_su: number;
    kuyu_su: number;
    yakit: number;
    ortak_alan: number;
}

export const LOJMAN_RATES: Record<string, LojmanYearRates> = {
    "2026": {
        kerpic: 10.23,
        kalorifersiz: 15.99,
        kaloriferli: 20.97,
        kapici: 2.46,
        elektrik: 4.66,
        su: 4.04,
        elektrik_su: 8.68,
        kuyu_su: 2.17,
        yakit: 8.38,
        ortak_alan: 0.98
    },
    "2025": {
        kerpic: 8.15,
        kalorifersiz: 12.74,
        kaloriferli: 16.71,
        kapici: 1.96,
        elektrik: 3.71,
        su: 3.22,
        elektrik_su: 6.92,
        kuyu_su: 1.73,
        yakit: 6.68,
        ortak_alan: 0.78
    },
    "2024": {
        kerpic: 5.66,
        kalorifersiz: 8.85,
        kaloriferli: 11.61,
        kapici: 1.36,
        elektrik: 2.58,
        su: 2.24,
        elektrik_su: 4.81,
        kuyu_su: 1.2,
        yakit: 4.64,
        ortak_alan: 0.54
    },
    "2023": {
        kerpic: 4.53,
        kalorifersiz: 7.08,
        kaloriferli: 9.29,
        kapici: 1.09,
        elektrik: 2.06,
        su: 1.79,
        elektrik_su: 3.85,
        kuyu_su: 0.96,
        yakit: 3.71,
        ortak_alan: 0.43
    },
    "2022": {
        kerpic: 3.62,
        kalorifersiz: 5.66,
        kaloriferli: 7.43,
        kapici: 0.87,
        elektrik: 1.65,
        su: 1.43,
        elektrik_su: 3.08,
        kuyu_su: 0.77,
        yakit: 2.97,
        ortak_alan: 0.34
    },
    "2021": {
        kerpic: 3.07,
        kalorifersiz: 4.8,
        kaloriferli: 6.3,
        kapici: 0.74,
        elektrik: 1.4,
        su: 1.21,
        elektrik_su: 2.61,
        kuyu_su: 0.65,
        yakit: 2.52,
        ortak_alan: 0.29
    },
    "2020": {
        kerpic: 2.69,
        kalorifersiz: 4.21,
        kaloriferli: 5.53,
        kapici: 0.65,
        elektrik: 1.23,
        su: 1.06,
        elektrik_su: 2.29,
        kuyu_su: 0.57,
        yakit: 2.21,
        ortak_alan: 0.25
    },
    "2019": {
        kerpic: 2.36,
        kalorifersiz: 3.69,
        kaloriferli: 4.85,
        kapici: 0.57,
        elektrik: 1.08,
        su: 0.93,
        elektrik_su: 2.01,
        kuyu_su: 0.5,
        yakit: 1.94,
        ortak_alan: 0.22
    },
    "2018": {
        kerpic: 2.36,
        kalorifersiz: 3.69,
        kaloriferli: 4.85,
        kapici: 0.57,
        elektrik: 1.08,
        su: 0.93,
        elektrik_su: 2.01,
        kuyu_su: 0.5,
        yakit: 1.94,
        ortak_alan: 0.22
    },
    "2017": {
        kerpic: 1.82,
        kalorifersiz: 2.84,
        kaloriferli: 3.73,
        kapici: 0.44,
        elektrik: 0.83,
        su: 0.72,
        elektrik_su: 1.54,
        kuyu_su: 0.39,
        yakit: 1.49,
        ortak_alan: 0.17
    },
    "2016": {
        kerpic: 1.65,
        kalorifersiz: 2.58,
        kaloriferli: 3.39,
        kapici: 0.4,
        elektrik: 0.75,
        su: 0.65,
        elektrik_su: 1.4,
        kuyu_su: 0.35,
        yakit: 1.35,
        ortak_alan: 0.15
    },
    "2015": {
        kerpic: 1.49,
        kalorifersiz: 2.32,
        kaloriferli: 3.05,
        kapici: 0.28,
        elektrik: 0.62,
        su: 0.62,
        elektrik_su: 1.24,
        kuyu_su: 0.31,
        yakit: 1.24,
        ortak_alan: 0.13
    },
    "2014": {
        kerpic: 1.35,
        kalorifersiz: 2.11,
        kaloriferli: 2.77,
        kapici: 0.25,
        elektrik: 0.56,
        su: 0.56,
        elektrik_su: 1.13,
        kuyu_su: 0.28,
        yakit: 1.13,
        ortak_alan: 0.12
    },
    "2013": {
        kerpic: 1.3,
        kalorifersiz: 2.03,
        kaloriferli: 2.67,
        kapici: 0.24,
        elektrik: 0.54,
        su: 0.54,
        elektrik_su: 1.09,
        kuyu_su: 0.27,
        yakit: 1.09,
        ortak_alan: 0.11
    },
    "2012": {
        kerpic: 1.21,
        kalorifersiz: 1.88,
        kaloriferli: 2.48,
        kapici: 0.22,
        elektrik: 0.5,
        su: 0.5,
        elektrik_su: 1.01,
        kuyu_su: 0.25,
        yakit: 1.01,
        ortak_alan: 0.1
    },
    "2011": {
        kerpic: 1.1,
        kalorifersiz: 1.71,
        kaloriferli: 2.25,
        kapici: 0.2,
        elektrik: 0.45,
        su: 0.45,
        elektrik_su: 0.92,
        kuyu_su: 0.23,
        yakit: 0.92,
        ortak_alan: 0.09
    },
    "2010": {
        kerpic: 1.02,
        kalorifersiz: 1.58,
        kaloriferli: 2.08,
        kapici: 0.19,
        elektrik: 0.42,
        su: 0.42,
        elektrik_su: 0.85,
        kuyu_su: 0.21,
        yakit: 0.85,
        ortak_alan: 0.08
    }
};

export interface CityDiscountGroup {
    name: string;
    group: "ek1" | "ek2" | "ek3";
    discountRate: number;
}

export const CITY_DISCOUNT_GROUPS: CityDiscountGroup[] = [
    // EK 1 (%50)
    { name: "Ağrı", group: "ek1", discountRate: 0.50 },
    { name: "Aksaray", group: "ek1", discountRate: 0.50 },
    { name: "Ardahan", group: "ek1", discountRate: 0.50 },
    { name: "Artvin", group: "ek1", discountRate: 0.50 },
    { name: "Batman", group: "ek1", discountRate: 0.50 },
    { name: "Bayburt", group: "ek1", discountRate: 0.50 },
    { name: "Bingöl", group: "ek1", discountRate: 0.50 },
    { name: "Bitlis", group: "ek1", discountRate: 0.50 },
    { name: "Çanakkale (Bozcaada ve Gökçeada)", group: "ek1", discountRate: 0.50 },
    { name: "Çankırı", group: "ek1", discountRate: 0.50 },
    { name: "Erzincan", group: "ek1", discountRate: 0.50 },
    { name: "Giresun", group: "ek1", discountRate: 0.50 },
    { name: "Gümüşhane", group: "ek1", discountRate: 0.50 },
    { name: "Hakkari", group: "ek1", discountRate: 0.50 },
    { name: "Iğdır", group: "ek1", discountRate: 0.50 },
    { name: "Kars", group: "ek1", discountRate: 0.50 },
    { name: "Kırşehir", group: "ek1", discountRate: 0.50 },
    { name: "Muş", group: "ek1", discountRate: 0.50 },
    { name: "Siirt", group: "ek1", discountRate: 0.50 },
    { name: "Sinop", group: "ek1", discountRate: 0.50 },
    { name: "Şırnak", group: "ek1", discountRate: 0.50 },
    { name: "Tunceli", group: "ek1", discountRate: 0.50 },

    // EK 2 (%45)
    { name: "Adıyaman", group: "ek2", discountRate: 0.45 },
    { name: "Amasya", group: "ek2", discountRate: 0.45 },
    { name: "Bartın", group: "ek2", discountRate: 0.45 },
    { name: "Çorum", group: "ek2", discountRate: 0.45 },
    { name: "Diyarbakır", group: "ek2", discountRate: 0.45 },
    { name: "Elazığ", group: "ek2", discountRate: 0.45 },
    { name: "Erzurum", group: "ek2", discountRate: 0.45 },
    { name: "Kahramanmaraş", group: "ek2", discountRate: 0.45 },
    { name: "Karabük", group: "ek2", discountRate: 0.45 },
    { name: "Karaman", group: "ek2", discountRate: 0.45 },
    { name: "Kastamonu", group: "ek2", discountRate: 0.45 },
    { name: "Kırıkkale", group: "ek2", discountRate: 0.45 },
    { name: "Malatya", group: "ek2", discountRate: 0.45 },
    { name: "Mardin", group: "ek2", discountRate: 0.45 },
    { name: "Nevşehir", group: "ek2", discountRate: 0.45 },
    { name: "Niğde", group: "ek2", discountRate: 0.45 },
    { name: "Ordu", group: "ek2", discountRate: 0.45 },
    { name: "Rize", group: "ek2", discountRate: 0.45 },
    { name: "Samsun", group: "ek2", discountRate: 0.45 },
    { name: "Sivas", group: "ek2", discountRate: 0.45 },
    { name: "Şanlıurfa", group: "ek2", discountRate: 0.45 },
    { name: "Tokat", group: "ek2", discountRate: 0.45 },
    { name: "Trabzon", group: "ek2", discountRate: 0.45 },
    { name: "Van", group: "ek2", discountRate: 0.45 },
    { name: "Yozgat", group: "ek2", discountRate: 0.45 },
    { name: "Zonguldak", group: "ek2", discountRate: 0.45 },

    // EK 3 (%30)
    { name: "Adana", group: "ek3", discountRate: 0.30 },
    { name: "Afyonkarahisar", group: "ek3", discountRate: 0.30 },
    { name: "Ankara", group: "ek3", discountRate: 0.30 },
    { name: "Antalya", group: "ek3", discountRate: 0.30 },
    { name: "Aydın", group: "ek3", discountRate: 0.30 },
    { name: "Balıkesir", group: "ek3", discountRate: 0.30 },
    { name: "Bilecik", group: "ek3", discountRate: 0.30 },
    { name: "Bolu", group: "ek3", discountRate: 0.30 },
    { name: "Burdur", group: "ek3", discountRate: 0.30 },
    { name: "Bursa", group: "ek3", discountRate: 0.30 },
    { name: "Çanakkale (Merkez ve Diğer İlçeler)", group: "ek3", discountRate: 0.30 },
    { name: "Denizli", group: "ek3", discountRate: 0.30 },
    { name: "Düzce", group: "ek3", discountRate: 0.30 },
    { name: "Edirne", group: "ek3", discountRate: 0.30 },
    { name: "Eskişehir", group: "ek3", discountRate: 0.30 },
    { name: "Gaziantep", group: "ek3", discountRate: 0.30 },
    { name: "Hatay", group: "ek3", discountRate: 0.30 },
    { name: "Isparta", group: "ek3", discountRate: 0.30 },
    { name: "Mersin", group: "ek3", discountRate: 0.30 },
    { name: "İstanbul", group: "ek3", discountRate: 0.30 },
    { name: "İzmir", group: "ek3", discountRate: 0.30 },
    { name: "Kayseri", group: "ek3", discountRate: 0.30 },
    { name: "Kırklareli", group: "ek3", discountRate: 0.30 },
    { name: "Kilis", group: "ek3", discountRate: 0.30 },
    { name: "Kocaeli", group: "ek3", discountRate: 0.30 },
    { name: "Konya", group: "ek3", discountRate: 0.30 },
    { name: "Kütahya", group: "ek3", discountRate: 0.30 },
    { name: "Manisa", group: "ek3", discountRate: 0.30 },
    { name: "Muğla", group: "ek3", discountRate: 0.30 },
    { name: "Sakarya", group: "ek3", discountRate: 0.30 },
    { name: "Tekirdağ", group: "ek3", discountRate: 0.30 },
    { name: "Uşak", group: "ek3", discountRate: 0.30 },
    { name: "Yalova", group: "ek3", discountRate: 0.30 },
    { name: "Osmaniye", group: "ek3", discountRate: 0.30 }
];
