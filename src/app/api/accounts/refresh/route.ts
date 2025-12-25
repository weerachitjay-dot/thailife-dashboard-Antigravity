
import { NextResponse } from 'next/server';
import { FacebookService } from '@/services/facebook';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { decryptToken } from '@/utils/crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
        }

        // 1. Get Token
        const { data: tokenRow } = await supabaseAdmin
            .from('facebook_tokens')
            .select('id, encrypted_access_token')
            .eq('user_id', userId)
            .eq('is_valid', true)
            .single();

        if (!tokenRow) {
            return NextResponse.json({ success: false, error: 'No valid token found' }, { status: 404 });
        }

        const accessToken = decryptToken(tokenRow.encrypted_access_token);

        // 2. Fetch Accounts from FB
        const adAccounts = await FacebookService.getAdAccounts(accessToken);

        if (adAccounts.length === 0) {
            return NextResponse.json({ success: false, error: 'No Ad Accounts found on Facebook.' });
        }

        // 3. Upsert to DB
        const upsertData = adAccounts.map(acc => ({
            account_id: acc.id,
            name: acc.name,
            token_id: tokenRow.id,
            is_active: true,
            updated_at: new Date().toISOString()
        }));

        const { error: upsertError } = await supabaseAdmin
            .from('accounts')
            .upsert(upsertData, { onConflict: 'account_id' });

        if (upsertError) throw upsertError;

        // 4. Return fresh list
        const { data: accounts } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('token_id', tokenRow.id)
            .order('name');

        return NextResponse.json({ success: true, accounts: accounts || [] });

    } catch (error: any) {
        console.error("Refresh Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
