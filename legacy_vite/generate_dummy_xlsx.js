import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'public', 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data mirroring the CSV content
const APPEND_DATA = [
    ["Campaign_name", "Day", "Ad_set_name", "Ad_name", "Reach", "Impressions", "Clicks", "Website_leads", "Cost", "Meta_leads", "Leads", "Messaging_conversations_started"],
    ["CONVERSIONS_THAILIFE+LIFE-SENIOR-MORRADOK_RUNNING_2025-08-13_(เพจสร้างมรดก)", "2025-11-01", "INTEREST_SPORT-RUNNING_TH_ALL_30-65", "(เพจสร้างมรดก)_THAILIFE_SENIOR-MORRADOK-IMG_DEC-2024", 8945, 11563, 174, 2, 984.8, 0, 2, 3],
    ["CONVERSIONS_THAILIFE+HEALTH-SABAI-JAI_BIRTHDAY_2025-03-26_(เพจสุขภาพ)", "2025-11-01", "INTEREST_HEALTH_TH_ALL_25-64", "(เพจสุขภาพ)_THAILIFE_HEALTH-SABAI-JAI-IMG_DEC-2024", 5000, 6000, 100, 5, 500.0, 3, 5, 10],
    ["CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_2025-01-01_(เพจออมเงิน)", "2025-11-02", "INTEREST_SAVING_TH_ALL_20-45", "(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025", 4000, 4500, 80, 1, 400.0, 1, 1, 2]
];

const SENT_DATA = [
    ["Day", "Product1", "Leads_Sent"],
    ["2025-11-01", "ประกันชีวิต สูงวัยไร้กังวล", 5],
    ["2025-11-01", "ประกันสุขภาพ เฮลท์เหมาสบายใจ", 3],
    ["2025-11-02", "แฮปปี้ไลฟ์", 2],
    ["2025-11-03", "ประกันชีวิต สูงวัยไร้กังวล", 10],
    ["2025-11-04", "ประกันชีวิต สูงวัยไร้กังวล", 0],
    ["2025-11-05", "ประกันชีวิต สูงวัยไร้กังวล", 0]
];

const TARGET_DATA = [
    ["Product_Target", "Target_Lead_Sent", "Target_SellPrice", "Target_CPL", "Target_CPL2", "OWNER", "TYPE"],
    ["LIFE-SENIOR-MORRADOK", 1280, 561, 280.5, 400, "JAY", "Senior"],
    ["LIFE-EXTRASENIOR-BUPHAKARI", 1000, 561, 280.5, 400, "JAY", "Senior"],
    ["SAVING-HAPPY", 400, 561, 280.5, 400, "PANG", "Saving"],
    ["HEALTH-SABAI-JAI", 170, 267, 133.5, 200, "LEK", "Health"],
    ["HEALTH-TOPUP-SICK", 200, 267, 133.5, 200, "LEK", "Health"],
    ["LIFE-SENIOR-BONECARE", 600, 561, 280.5, 400, "PANG", "Senior"],
    ["SAVING-MONEYSAVING14/6", 250, 561, 280.5, 400, "PANG", "Saving"]
];

function createXlsx(data, filename) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, path.join(DATA_DIR, filename));
    console.log(`Created ${filename}`);
}

createXlsx(APPEND_DATA, 'append.xlsx');
createXlsx(SENT_DATA, 'sent.xlsx');
createXlsx(TARGET_DATA, 'target.xlsx');
