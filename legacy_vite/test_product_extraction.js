// Verification Script for Campaign Product Extraction
// Run with: node test_product_extraction.js

// Mocking the function from formatters.js to avoid import issues in standalone script
// (Copying the logic exactly as implemented)
const extractProductFromCampaign = (campaignName) => {
    if (!campaignName) return 'Unknown';
    const parts = campaignName.split('_');
    const thailifeIndex = parts.findIndex(p => p.includes('THAILIFE+'));

    if (thailifeIndex === -1) return 'Unknown';

    const thailifePart = parts[thailifeIndex];
    const cleanPart = thailifePart.replace(/.*?THAILIFE\+/, '');

    if (!cleanPart.includes('-')) {
        if (parts[thailifeIndex + 1]) {
            return parts[thailifeIndex + 1];
        }
        return cleanPart;
    }

    const firstHyphen = cleanPart.indexOf('-');
    if (firstHyphen !== -1) {
        return cleanPart.substring(firstHyphen + 1);
    }

    return cleanPart;
};

const examples = [
    {
        input: 'LEADGENERATION_THAILIFE+LIFE_SAVING-HAPPY_EMPLOY_2025-12-10_(ประกันชีวิตเพื่อคนไทย)',
        expected: 'SAVING-HAPPY'
    },
    {
        input: 'CONVERSIONS_THAILIFE+LIFE-EXTRASENIOR-BUPHAKARI_Day spa_2025-11-19_(เพจสร้างมรดกหลักล้าน ด้วยประกันชีวิต)_LP2',
        expected: 'EXTRASENIOR-BUPHAKARI'
    },
    {
        input: 'CONVERSIONS_THAILIFE+LIFE_SENIOR-MORRADOK_CAMPING+LIFE INSURANCE_2025-11-07_(เพจสร้างมรดกหลักล้าน ด้วยประกันชีวิต)',
        expected: 'SENIOR-MORRADOK'
    },
    {
        input: 'CONVERSIONS_THAILIFE+LIFE-SENIOR-MORRADOK_CAMPING+LIFE INSURANCE_2025-11-07_(เพจสร้างมรดกหลักล้าน ด้วยประกันชีวิต)',
        expected: 'SENIOR-MORRADOK'
    }
];

console.log("--- Testing Campaign Product Extraction ---");
let passCount = 0;
examples.forEach((ex, i) => {
    const result = extractProductFromCampaign(ex.input);
    const pass = result === ex.expected;
    console.log(`[Test ${i + 1}]`);
    console.log(`Input:    ${ex.input}`);
    console.log(`Expected: ${ex.expected}`);
    console.log(`Actual:   ${result}`);
    console.log(`Status:   ${pass ? "PASS" : "FAIL"}`);
    console.log("-".repeat(40));
    if (pass) passCount++;
});

console.log(`Total: ${passCount}/${examples.length} Passed`);
process.exit(passCount === examples.length ? 0 : 1);
