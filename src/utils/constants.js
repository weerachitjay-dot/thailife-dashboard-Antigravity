export const SHEET_CONFIG = {
    DOC_ID: '1gCAb0yNmls8NHsTVtmpmOZQN3SpWF_V66zwnchJvGcc',
    GIDS: {
        append: '984181303',        // Main Append Data
        sent: '1463750995',         // Sent Leads (Appendsent)
        target: '1565547820',       // Targets
        append_time: '273518328'    // Time Analysis
    }
};

// Use Environment Variables for Security (Defined in .env)
export const DEFAULT_USERS = [
    { id: 2, username: 'weerachit.jay', pass: import.meta.env.VITE_ADMIN_PASS || 'admin_fallback_change_me', name: 'Weerachit Jay', role: 'admin' },
    { id: 3, username: 'demo', pass: 'demo', name: 'Demo User', role: 'viewer' },
    { id: 4, username: '660452', pass: import.meta.env.VITE_USER_660452_PASS || 'user_fallback_change_me', name: 'User 660452', role: 'viewer' },
    { id: 999, username: 'tester', pass: '123456', name: 'Tester', role: 'admin' }
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

// 4. Time Analysis (Real Schema based on GID 273518328)
export const SNIPPET_APPEND_TIME = `Day,Time_of_Day,Campaign_Name,Ad_Set_Name,Ad_Name,Leads
2025-11-20,20:00:00 - 20:59:59,THAILIFE+LIFE_Campaign,INTEREST_SHOPPING,Ad_Test_1,5
2025-11-21,08:00:00 - 08:59:59,THAILIFE+LIFE_Campaign,INTEREST_TRAVEL,Ad_Test_2,3`;
