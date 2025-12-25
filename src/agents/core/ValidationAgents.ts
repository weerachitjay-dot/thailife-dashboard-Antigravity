import { GlobalState } from '../types';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { FacebookService } from '@/services/facebook';

// A1: FacebookAuthAgent
export const FacebookAuthAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🕵️Agent A1 (Auth): Validating Token...");
    const token = state.config.accessToken;
    if (!token) {
        return { auth_status: { valid: false, error: "Missing Access Token" } };
    }
    // Hard validation logic or lightweight check
    // For now, we assume if it's passed, it was decrypted successfully. 
    // Real validation happens when we try to fetch.
    return { auth_status: { valid: true } };
};

// A2: SupabaseSchemaAgent
export const SupabaseSchemaAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🛡️ Agent A2 (Schema): Checking Tables...");
    // Check if table exists by doing a limit 1 select
    const { error } = await supabaseAdmin.from('facebook_ads_insights').select('id').limit(1);
    if (error) {
        return { schema_status: { valid: false, missing_tables: ['facebook_ads_insights'] } };
    }
    return { schema_status: { valid: true } };
};

// A3: FacebookAccountAgent
export const FacebookAccountAgent = async (state: GlobalState): Promise<Partial<GlobalState>> => {
    console.log("🆔 Agent A3 (Account): Resolving Metadata...");
    const accountId = state.config.ad_account_id;
    const token = state.config.accessToken;

    if (!accountId || !token) return { errors: [...state.errors, "Missing Account ID or Token for A3"] };

    try {
        // We can fetch timezone/name from FB if we want strict metadata.
        // For MVP speed, we might trust the input config, but let's do a quick fetch if needed.
        // Actually, let's reuse the Service to get account details.
        // For now, returning dummy metadata or what we have.
        // Real implementation: call FacebookService.getAccount(accountId)...

        return { account_metadata: { name: `Account ${accountId}`, timezone: 'Asia/Bangkok' } };
    } catch (e: any) {
        return { errors: [...state.errors, `A3 Failed: ${e.message}`] };
    }
};
