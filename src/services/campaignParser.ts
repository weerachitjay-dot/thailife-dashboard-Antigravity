
/**
 * Campaign Parser Service
 * Extracts structured metadata from Facebook Campaign Names following the strict convention:
 * Format: OBJECTIVE / PARTNER+PRODUCT / AUDIENCE / DATE / PAGE / SUFFIX
 * 
 * Example:
 * CONVERSIONS_THAILIFE+LIFE-SENIOR-MORRADOK_INTEREST-SHOPPING_2025-11-01_(PageName)_SUFFIX
 */

export interface ParsedCampaign {
    objective: string;
    partner: string;
    productCode: string;
    productRaw: string;
    audience: string;
    audienceCategory: string;
    startDate: string | null;
    page: string;
    suffix: string;
}

export const normalizeProduct = (productRaw: string): string => {
    if (!productRaw) return 'Unknown';
    const p = productRaw.trim();
    // Logic ported from legacy formatters.js
    if (/แฮปปี้|HAPPY/gi.test(p)) return "SAVING-HAPPY";
    if (/14\/6|มันนี่|เซฟวิ่ง|money.?saving|ออม/gi.test(p)) return "SAVING-MONEYSAVING14/6";
    if (/เติมเงิน|top.?up/gi.test(p)) return "HEALTH-TOPUP-SICK";
    if (/เหมาสบายใจ|สบายใจ|sabai/gi.test(p)) return "HEALTH-SABAI-JAI";
    if (/สูงวัยมีทรัพย์|buphakari/gi.test(p)) return "LIFE-EXTRASENIOR-BUPHAKARI";
    if (/โบนแคร์|bone.?care/gi.test(p)) return "LIFE-SENIOR-BONECARE";
    if (/ไร้กังวล|สูงวัยไร้กังวล|มรดก|moradok|morradok/gi.test(p)) return "LIFE-SENIOR-MORRADOK";
    return p.toUpperCase();
};

export const parseCampaignName = (campaignName: string): ParsedCampaign => {
    if (!campaignName) {
        return {
            objective: 'Unknown',
            partner: 'Unknown',
            productCode: 'Unknown',
            productRaw: 'Unknown',
            audience: 'Unknown',
            audienceCategory: 'Unknown',
            startDate: null,
            page: 'Unknown',
            suffix: ''
        };
    }

    const parts = campaignName.split('_');

    // 1. Identify Partner+Product Segment (Anchor)
    const thailifeIndex = parts.findIndex(p => p.includes('THAILIFE+'));

    let partner = 'Unknown';
    let productRaw = 'Unknown';
    let objective = 'Unknown';
    let audience = 'Unknown';
    let startDate: string | null = null;
    let page = 'Unknown';
    let suffix = '';

    if (thailifeIndex !== -1) {
        // Objective is typically everything before Partner
        if (thailifeIndex > 0) {
            objective = parts.slice(0, thailifeIndex).join('_');
        }

        // Extract Partner & Product
        const fullProductPart = parts[thailifeIndex]; // e.g., THAILIFE+LIFE-SENIOR-MORRADOK
        const partnerMatch = fullProductPart.match(/(.*?)\+/);
        if (partnerMatch) {
            partner = partnerMatch[1];
        }

        // Logic to isolate Product Code
        const cleanPart = fullProductPart.replace(/.*?THAILIFE\+/, '');
        // If cleanPart has hyphen, product is likely the part after first hyphen?
        // Based on legacy logic: "LIFE-SENIOR-MORRADOK" -> "SENIOR-MORRADOK"
        // But check if cleanPart is just "LIFE" (Partner Category)
        if (!cleanPart.includes('-')) {
            // Look ahead
            if (parts[thailifeIndex + 1] && !parts[thailifeIndex + 1].match(/\d{4}-\d{2}-\d{2}/)) {
                // If next part is NOT a date, assume it is product
                productRaw = parts[thailifeIndex + 1];
            } else {
                productRaw = cleanPart;
            }
        } else {
            const firstHyphen = cleanPart.indexOf('-');
            productRaw = cleanPart.substring(firstHyphen + 1);
        }

        // Audience is typically AFTER Product
        // If we "consumed" parts[thailifeIndex+1] for product, start searching from index+2
        let searchIndex = thailifeIndex + 1;
        if (parts[thailifeIndex + 1] === productRaw) {
            searchIndex++;
        }

        // Find Date to anchor the end of Audience
        const dateIndex = parts.findIndex(p => p.match(/\d{4}-\d{2}-\d{2}/));

        if (dateIndex !== -1) {
            startDate = parts[dateIndex];
            if (dateIndex > searchIndex) {
                audience = parts.slice(searchIndex, dateIndex).join('_');
            }

            // Page is typically after date, wrapped in (...)
            // Find part with parens
            const pagePart = parts.find((p, i) => i > dateIndex && p.startsWith('(') && p.endsWith(')'));
            if (pagePart) {
                page = pagePart.slice(1, -1);
            }

            // Suffix is anything else at the end
            if (parts.length > dateIndex + 1) {
                // Filter out page to find suffix
                suffix = parts.slice(dateIndex + 1).filter(p => !p.startsWith('(')).join('_');
            }

        } else {
            // No date found, fallback
            if (parts.length > searchIndex) {
                audience = parts.slice(searchIndex).join('_');
            }
        }

    }

    // Audience Category Logic
    let audienceCategory = 'Other';
    const audUpper = audience.toUpperCase();
    if (audUpper.includes('INTEREST')) audienceCategory = 'Interest';
    else if (audUpper.includes('BROAD')) audienceCategory = 'Broad';
    else if (audUpper.includes('LOOKALIKE') || audUpper.includes('LAL')) audienceCategory = 'Lookalike';
    else if (audUpper.includes('RETARGET')) audienceCategory = 'Retargeting';

    return {
        objective,
        partner,
        productCode: normalizeProduct(productRaw),
        productRaw,
        audience,
        audienceCategory,
        startDate,
        page,
        suffix
    };
};
