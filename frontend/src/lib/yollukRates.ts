export interface YollukYearRates {
    ek_8000_plus: number;
    ek_6400_8000: number;
    ek_3600_6400: number;
    der_1_4: number;
    der_5_15: number;
}

export const YOLLUK_H_RATES: Record<string, YollukYearRates> = {
    "2026": {
        ek_8000_plus: 890,
        ek_6400_8000: 880,
        ek_3600_6400: 870,
        der_1_4: 860,
        der_5_15: 850
    },
    "2025": {
        ek_8000_plus: 680,
        ek_6400_8000: 650,
        ek_3600_6400: 635,
        der_1_4: 610,
        der_5_15: 600
    },
    "2024": {
        ek_8000_plus: 465,
        ek_6400_8000: 435,
        ek_3600_6400: 420,
        der_1_4: 405,
        der_5_15: 400
    },
    "2023": {
        ek_8000_plus: 236,
        ek_6400_8000: 220,
        ek_3600_6400: 212,
        der_1_4: 203,
        der_5_15: 200
    },
    "2022": {
        ek_8000_plus: 104,
        ek_6400_8000: 97,
        ek_3600_6400: 93,
        der_1_4: 89,
        der_5_15: 87
    },
    "2021": {
        ek_8000_plus: 69.50,
        ek_6400_8000: 64.50,
        ek_3600_6400: 60.50,
        der_1_4: 57.50,
        der_5_15: 55.50
    },
    "2020": {
        ek_8000_plus: 61.50,
        ek_6400_8000: 57.50,
        ek_3600_6400: 54.00,
        der_1_4: 51.50,
        der_5_15: 50.00
    }
};

export interface YollukCoefficients {
    jan_jun: number;
    jul_dec: number;
}

export const YOLLUK_COEFFICIENTS: Record<string, YollukCoefficients> = {
    "2026": {
        jan_jun: 1.387871,
        jul_dec: 1.575512
    },
    "2025": {
        jan_jun: 1.012556,
        jul_dec: 1.170211
    },
    "2024": {
        jan_jun: 0.760871,
        jul_dec: 0.907796
    },
    "2023": {
        jan_jun: 0.433684,
        jul_dec: 0.509796
    },
    "2022": {
        jan_jun: 0.235445,
        jul_dec: 0.333603
    },
    "2021": {
        jan_jun: 0.165786,
        jul_dec: 0.179797
    },
    "2020": {
        jan_jun: 0.146061,
        jul_dec: 0.154461
    }
};
