export const SHEET_CONFIG = {
    DOC_ID: '1gCAb0yNmls8NHsTVtmpmOZQN3SpWF_V66zwnchJvGcc',
    GIDS: {
        append: '984181303',        // Main Append Data
        sent: '1463750995',         // Sent Leads (Appendsent)
        target: '1565547820',       // Targets
        append_time: '273518328'    // Time Analysis
    }
};

export const DEFAULT_USERS = [
    { id: 1, username: 'admin', pass: 'admin123', name: 'System Admin', role: 'admin' },
    { id: 2, username: 'weerachit.jay', pass: 'Suza01Suz@!#', name: 'Weerachit Jay', role: 'admin' },
    { id: 3, username: 'demo', pass: 'demo', name: 'Demo User', role: 'viewer' }
];

export const SNIPPET_APPEND = `Day,Product,Ad Name,Impressions,Cost,Leads,Meta_leads
2025-11-01,SAVING-HAPPY,Ad_Video_001,1000,500,5,5
2025-11-01,SAVING-MONEYSAVING14/6,Ad_Img_002,1500,750,2,2
2025-11-02,SAVING-HAPPY,Ad_Video_001,1200,600,6,6`;

export const SNIPPET_APPENDSENT = `Day,Product,Leads_Sent
2025-11-01,SAVING-HAPPY,4
2025-11-01,SAVING-MONEYSAVING14/6,2
2025-11-02,SAVING-HAPPY,5`;

export const SNIPPET_TARGET = `OWNER,TYPE,Product_Target,Target_Lead_Sent,Target_CPL
OwnerA,Saving,SAVING-HAPPY,100,100
OwnerA,Saving,SAVING-MONEYSAVING14/6,50,150`;

export const SNIPPET_APPEND_TIME = `Day,Time,Campaign_name,Ad_set_name,Ad_name,Cost,Leads
2025-11-01,08:30:00,CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_(เพจออมเงิน),INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,50,1
2025-11-01,10:00:00,CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_(เพจออมเงิน),INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,100,2
2025-11-01,19:00:00,CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_(เพจออมเงิน),INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,50,1
2025-11-01,23:59:00,CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_(เพจออมเงิน),INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,50,1
2025-11-02,01:00:00,CONVERSIONS_THAILIFE+SAVING-HAPPY_GENERIC_(เพจออมเงิน),INTEREST_SAVING_TH_ALL_20-45,(เพจออมเงิน)_THAILIFE_SAVING-HAPPY-IMG_JAN-2025,50,1`;
