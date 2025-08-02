
import { MetaApiConfig, PerformanceRecord } from '../types';

// This is a SIMULATED Meta API connector.
// In a real-world scenario, this function would make a secure call
// to a backend server, which would then query the actual Meta Graph API.

const generateRandomData = (base: number, variance: number) => {
    return base + (Math.random() - 0.5) * variance * base;
};

export const syncFromMetaAPI = (
    config: MetaApiConfig,
    accountName: string
): Promise<Partial<PerformanceRecord>[]> => {
    console.log(`[Meta API Simulator] Fetching data for account: ${accountName} with App ID: ${config.appId}`);

    return new Promise((resolve) => {
        setTimeout(() => {
            const today = new Date();
            const records: Partial<PerformanceRecord>[] = [];
            const adNames = [
                '11-07-2025_Summer Sale_Image_TOF_Offer_Choker Iris__Product__V1_Brand_In-house_Studio_Details_(CP)',
                'summer sale 20%off (gorgeous hair) 🎬img 🎯oferta 👤diseno 🖼️una imagen o video 💬ninguno 🧪04/07/2025 - copia',
                '🆔Los 5 accesorios de esta primavera | 🎬Video | 🎯Problema | 👤Actriz | 🖼️Una imagen o video | 💬Ninguno | 🧪 - Copia',
            ];

            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dayString = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

                adNames.forEach((adName, index) => {
                    const isVideo = adName.toLowerCase().includes('video');
                    const spend = generateRandomData(50, 0.4);
                    const impressions = generateRandomData(10000, 0.3);
                    const linkClicks = generateRandomData(impressions * 0.02, 0.5);
                    const purchases = generateRandomData(spend / 3, 0.6);
                    const purchaseValue = purchases * generateRandomData(80, 0.2);
                    
                    records.push({
                        'accountName': accountName,
                        'adName': adName,
                        'day': dayString,
                        'spend': spend,
                        'impressions': impressions,
                        'linkClicks': linkClicks,
                        'purchases': purchases,
                        'purchaseValue': purchaseValue,
                        'frequency': generateRandomData(1.5, 0.2),
                        'cpm': (spend / impressions) * 1000,
                        'ctrLink': (linkClicks / impressions) * 100,
                        'adDelivery': 'active',
                        'age': '25-34',
                        'gender': index % 2 === 0 ? 'female' : 'male',
                        'campaignName': 'Simulated API Campaign',
                        'adSetName': 'Simulated Ad Set',
                        'videoFileName': isVideo ? `${adName.substring(0,20).replace(/\|/g, '_')}.mp4` : undefined,
                        'thruPlays': isVideo ? generateRandomData(impressions * 0.1, 0.3) : 0,
                        'videoAveragePlayTime': isVideo ? generateRandomData(12, 0.5) : 0
                    });
                });
            }

            console.log(`[Meta API Simulator] Generated ${records.length} records.`);
            resolve(records);
        }, 1500); // Simulate network delay
    });
};
