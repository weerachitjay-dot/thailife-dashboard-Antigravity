// Verification Script for Forecast Logic
// Run with node test_forecast_logic.js

const campaignConfig = { start: '2025-11-01', end: '2025-11-30' };
const today = new Date(); // Assumes execution date is "Today"
// Simulate "Today" as 2025-11-15 for stable testing if needed, but we'll use dynamic relative tests.

function calculateForecast(startStr, endStr, mockTodayStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date(mockTodayStr);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const totalDuration = Math.max(1, (end - start) / (1000 * 60 * 60 * 24) + 1);

    let processingDate = today > end ? end : today;
    if (processingDate < start) processingDate = start;

    const daysElapsed = Math.max(1, (processingDate - start) / (1000 * 60 * 60 * 24) + 1);
    const daysRemaining = Math.max(0, totalDuration - daysElapsed);

    return { totalDuration, daysElapsed, daysRemaining };
}

console.log("--- TEST CASE 1: Mid-Campaign (Today is 15th, Campaign 1st-30th) ---");
const t1 = calculateForecast('2025-11-01', '2025-11-30', '2025-11-15');
console.log(`Expected: Duration 30, Elapsed 15, Remaining 15`);
console.log(`Actual:   Duration ${t1.totalDuration}, Elapsed ${t1.daysElapsed}, Remaining ${t1.daysRemaining}`);
console.log(t1.totalDuration === 30 && t1.daysElapsed === 15 && t1.daysRemaining === 15 ? "PASS" : "FAIL");

console.log("\n--- TEST CASE 2: Campaign Ended (Today is Dec 1st, Campaign Nov 1st-30th) ---");
const t2 = calculateForecast('2025-11-01', '2025-11-30', '2025-12-01');
console.log(`Expected: Duration 30, Elapsed 30, Remaining 0`);
console.log(`Actual:   Duration ${t2.totalDuration}, Elapsed ${t2.daysElapsed}, Remaining ${t2.daysRemaining}`);
console.log(t2.totalDuration === 30 && t2.daysElapsed === 30 && t2.daysRemaining === 0 ? "PASS" : "FAIL");

console.log("\n--- TEST CASE 3: Future Campaign (Today is Oct 1st, Campaign Nov 1st-30th) ---");
const t3 = calculateForecast('2025-11-01', '2025-11-30', '2025-10-01');
console.log(`Expected: Duration 30, Elapsed 1 (min), Remaining 29`);
console.log(`Actual:   Duration ${t3.totalDuration}, Elapsed ${t3.daysElapsed}, Remaining ${t3.daysRemaining}`);
console.log(t3.totalDuration === 30 && t3.daysElapsed === 1 && t3.daysRemaining === 29 ? "PASS" : "FAIL");

console.log("\n--- TEST CASE 4: Today is Start Date (Today Nov 1st, Campaign Nov 1st-30th) ---");
const t4 = calculateForecast('2025-11-01', '2025-11-30', '2025-11-01');
console.log(`Expected: Duration 30, Elapsed 1, Remaining 29`);
console.log(`Actual:   Duration ${t4.totalDuration}, Elapsed ${t4.daysElapsed}, Remaining ${t4.daysRemaining}`);
console.log(t4.totalDuration === 30 && t4.daysElapsed === 1 && t4.daysRemaining === 29 ? "PASS" : "FAIL");
