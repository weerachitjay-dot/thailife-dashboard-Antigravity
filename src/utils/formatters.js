import { Zap, Clock, XCircle, CheckCircle, AlertTriangle, RefreshCw, Lightbulb, TrendingUp } from 'lucide-react';

export const TYPE_ORDER = {
    'Senior': 1,
    'Saving': 2,
    'Health': 3
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- Smart Helpers ---
export const extractCreativeName = (adName) => {
    if (!adName) return "Unknown";
    // Pattern: ..._THAILIFE_TARGET...
    // User Example: (เพจ...)_THAILIFE_SENIOR-MORRADOK-GRANDFA-SMILE-02_DEC-2024
    // We want: SENIOR-MORRADOK-GRANDFA-SMILE-02

    const parts = adName.split('_');
    const thailifeIndex = parts.findIndex(p => p.includes('THAILIFE'));

    if (thailifeIndex !== -1 && parts[thailifeIndex + 1]) {
        // Return the part immediately after THAILIFE
        return parts[thailifeIndex + 1];
    }

    // Fallback: Look for the longest segment that contains hyphens (likely the creative ID)
    const dashedPart = parts.find(p => p.split('-').length > 2);
    if (dashedPart) return dashedPart;

    return adName;
};

export const getSmartRecommendation = (stats, targetCpl) => {
    const { cost, leads, cpl, daysActive } = stats;

    // 1. Learning Phase Check
    if (daysActive < 4) {
        return {
            type: 'learning',
            action: 'WAIT',
            reason: `Learning Phase (${daysActive}/4 days)`,
            color: 'bg-yellow-100 text-yellow-700',
            icon: Clock
        };
    }

    if (!targetCpl) return { type: 'neutral', action: '-', reason: 'No Target', color: 'bg-slate-100' };

    // 2. Performance Check
    const cplRatio = cpl / targetCpl;

    if (cost > 0 && leads === 0 && daysActive > 4) {
        return { type: 'danger', action: 'STOP', reason: 'Zero Leads', color: 'bg-rose-100 text-rose-700', icon: XCircle };
    }

    if (cplRatio < 0.8) {
        return { type: 'success', action: 'SCALE', reason: 'Cheap CPL (High Potential)', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
    }
    if (cplRatio <= 1.1) {
        return { type: 'success', action: 'MAINTAIN', reason: 'On Target', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
    }
    if (cplRatio <= 1.5) {
        return { type: 'warning', action: 'MONITOR', reason: 'Slightly Expensive', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
    }

    return { type: 'danger', action: 'STOP/FIX', reason: 'CPL Too High', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};

export const getAudienceRecommendation = (stats, targetCpl) => {
    const { cpl, ctr, frequency, cost, leads } = stats;

    if (cost === 0) return { type: 'neutral', action: 'WAIT', reason: 'No Spend', color: 'bg-slate-100 text-slate-500' };

    // 1. Saturation Check (High Frequency)
    if (frequency > 4.0) {
        if (cpl > targetCpl) return { type: 'danger', action: 'ROTATE', reason: 'Saturated (Freq > 4)', color: 'bg-rose-100 text-rose-700', icon: RefreshCw };
        return { type: 'warning', action: 'MONITOR', reason: 'High Frequency', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
    }

    if (!targetCpl) return { type: 'neutral', action: '-', reason: 'No Target', color: 'bg-slate-100' };

    const cplRatio = cpl / targetCpl;

    // 2. Relevance Check (CTR)
    if (ctr < 0.5) { // Very low CTR
        if (cplRatio > 1.2) return { type: 'danger', action: 'STOP', reason: 'Low Interest (CTR < 0.5%)', color: 'bg-rose-100 text-rose-700', icon: XCircle };
        return { type: 'warning', action: 'IMPROVE HOOK', reason: 'Low CTR', color: 'bg-amber-100 text-amber-700', icon: Lightbulb };
    }

    // 3. Performance Check
    if (cplRatio < 0.8) {
        return { type: 'success', action: 'SCALE', reason: 'Winner (Cheap CPL)', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
    }
    if (cplRatio <= 1.1) {
        return { type: 'success', action: 'MAINTAIN', reason: 'On Target', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
    }

    return { type: 'danger', action: 'FIX', reason: 'Expensive', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};

export const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const row = {};
        headers.forEach((header, index) => {
            let val = values[index] ? values[index].trim() : '';
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
            if (['Reach', 'Impressions', 'Clicks', 'Website_leads', 'Cost', 'Meta_leads', 'Leads', 'Messaging_conversations_started', 'Leads_Sent', 'Target_Lead_Sent', 'Target_CPL'].includes(header)) {
                row[header] = parseFloat(val.replace(/,/g, '')) || 0;
            } else {
                row[header] = val;
            }
        });
        return row;
    });
};

export const normalizeProduct = (productRaw) => {
    if (!productRaw) return 'Unknown';
    const p = productRaw.trim();
    if (/แฮปปี้|HAPPY/gi.test(p)) return "SAVING-HAPPY";
    if (/14\/6|มันนี่|เซฟวิ่ง|money.?saving|ออม/gi.test(p)) return "SAVING-MONEYSAVING14/6";
    if (/เติมเงิน|top.?up/gi.test(p)) return "HEALTH-TOPUP-SICK";
    if (/เหมาสบายใจ|สบายใจ|sabai/gi.test(p)) return "HEALTH-SABAI-JAI";
    if (/สูงวัยมีทรัพย์|buphakari/gi.test(p)) return "LIFE-EXTRASENIOR-BUPHAKARI";
    if (/โบนแคร์|bone.?care/gi.test(p)) return "LIFE-SENIOR-BONECARE";
    if (/ไร้กังวล|สูงวัยไร้กังวล|มรดก|moradok|morradok/gi.test(p)) return "LIFE-SENIOR-MORRADOK";
    return p;
};

export const parseAdSetInterest = (adSetName) => {
    if (!adSetName) return { category: 'Unknown', interest: 'Unknown' };

    // 1. Remove Prefix/Suffix
    let clean = adSetName.replace(/^INTEREST_/i, '').replace(/_TH_ALL_.*$/i, '');

    // 2. Handle Non-Standard Categories with Hyphens
    if (clean.toUpperCase().startsWith('NON-CATEGORY')) {
        // "NON-CATEGORY-BROAD" -> "Non-Category", "BROAD"
        return {
            category: 'Non-Category',
            interest: clean.substring(13) // Remove "NON-CATEGORY-"
        };
    }

    // 3. Standard Split by First Hyphen
    // "SHOPPING-KITCHENWARE" -> "SHOPPING", "KITCHENWARE"
    const firstHyphen = clean.indexOf('-');
    if (firstHyphen !== -1) {
        return {
            category: clean.substring(0, firstHyphen).trim(),
            interest: clean.substring(firstHyphen + 1).trim()
        };
    }

    // Fallback
    return { category: 'Other', interest: clean };
};

export const processAppendData = (data) => {
    return data.map(row => {
        const adSetName = row.Ad_set_name || '';
        const adName = row.Ad_name || '';
        const campName = row.Campaign_name || '';

        const { category, interest } = parseAdSetInterest(adSetName);

        const creativeMatch = adName.match(/_(.*)/);
        const partnerMatch = campName.match(/_(.*?)\+/);
        const productMatch = campName.match(/THAILIFE\+(.*?)(?:_|$)/);

        return {
            ...row,
            Category_Normalized: interest, // Use Interest as the main key for AudienceAnalysis compatibility
            Category_Group: category,      // Store the high-level category
            Creative: creativeMatch ? creativeMatch[1] : adName,
            Partner: partnerMatch ? partnerMatch[1].trim() : 'Unknown',
            Product: productMatch ? productMatch[1] : 'Unknown',
            Day: row.Day,
            Time: row.Time // Ensure Time column is passed through
        };
    });
};

export const processSentData = (data) => {
    return data.map(row => ({
        ...row,
        Product_Normalized: normalizeProduct(row.Product1),
        Day: row.Day
    }));
};

export const getRecommendation = (cpl, targetCpl) => {
    if (!targetCpl || targetCpl === 0) return { type: 'neutral', text: 'No Target', color: 'bg-slate-100 text-slate-600' };
    if (cpl === 0) return { type: 'neutral', text: 'No Spend', color: 'bg-slate-100 text-slate-600' };

    const ratio = cpl / targetCpl;
    if (ratio < 0.8) return { type: 'success', text: 'SCALE AGGRESSIVELY', color: 'bg-emerald-100 text-emerald-700', icon: Zap };
    if (ratio <= 1.0) return { type: 'success', text: 'SCALE', color: 'bg-green-100 text-green-700', icon: TrendingUp };
    if (ratio <= 1.2) return { type: 'warning', text: 'MONITOR', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
    return { type: 'danger', text: 'REDUCE / FIX', color: 'bg-rose-100 text-rose-700', icon: XCircle };
};
