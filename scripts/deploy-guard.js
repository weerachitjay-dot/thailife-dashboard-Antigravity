import os from 'os';

console.log("\n==================================================================");
console.log("🛡️  DEPLOYMENT GUARD ACTIVE");
console.log("==================================================================");
console.log("Strictly enforcing policy: NO DEPLOYMENTS TO oh-jay.duckdns.org");
console.log("------------------------------------------------------------------");

// Simple check: If we are in an environment that looks like the VPS (e.g. user 'ubuntu' or hostname)
const user = process.env.USER || '';
const hostname = os.hostname();

if (hostname.includes('oh-jay') || user === 'ubuntu') {
    console.error("❌ CRITICAL: PREVENTING RUN ON RESTRICTED HOST.");
    process.exit(1);
}

console.log("✅ Environment check passed. Allowed for Vercel/Local.");
console.log("==================================================================\n");
