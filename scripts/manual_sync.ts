
// scripts/manual_sync.ts
import dotenv from 'dotenv';
// Attempt to load .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

console.log("DEBUG: Env Check:", {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ FOUND' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ FOUND' : '❌ MISSING'
});

async function main() {
    console.log("🚀 Starting Manual Sync...");

    // Dynamically import modules to prevent strict hoisting from initializing them before dotenv works
    const { supabaseAdmin } = await import('../src/utils/supabase/admin');
    const { decryptToken } = await import('../src/utils/crypto');
    const { AgentOrchestrator } = await import('../src/agents/orchestrator');

    const userId = 'user-123';

    // 1. Get Token
    const { data: token, error: tokenError } = await supabaseAdmin
        .from('facebook_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (tokenError || !token) {
        console.error("❌ Token Error:", tokenError);
        return;
    }
    console.log("✅ Found Token ID:", token.id);

    // 2. Get Selected Account
    const { data: accounts, error: accountError } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('token_id', token.id)
        .eq('is_selected', true);

    if (accountError || !accounts || accounts.length === 0) {
        console.error("❌ No selected account found for this token.");
        const { data: allAccounts } = await supabaseAdmin.from('accounts').select('*').limit(1);
        if (allAccounts && allAccounts.length > 0) {
            console.log("⚠️ Falling back to first available account:", allAccounts[0].account_id);
            accounts!.push(allAccounts[0]);
        } else {
            return;
        }
    }

    const account = accounts![0];
    console.log("✅ Target Account:", account.account_id);

    // 3. Decrypt
    let accessToken = "";
    try {
        accessToken = decryptToken(token.encrypted_access_token);
        console.log("✅ Token Decrypted");
    } catch (e) {
        console.error("❌ Decryption Failed:", e);
        return;
    }

    // 4. Run Orchestrator
    console.log("🔄 Initializing Orchestrator with 'maximum' preset...");
    const orchestrator = new AgentOrchestrator({
        config: {
            userId: userId,
            accessToken: accessToken,
            ad_account_id: account.account_id,
            date_range: { start: 'maximum', end: 'today', cycle_type: 'campaign' }
        }
    });

    try {
        const result = await orchestrator.run();
        // Log deep output to see if items were inserted
        console.log("\nFINISHED! Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("❌ Orchestrator Execution Failed:", e);
    }
}

main();
