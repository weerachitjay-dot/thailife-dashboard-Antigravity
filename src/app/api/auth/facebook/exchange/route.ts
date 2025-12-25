import { NextResponse } from 'next/server';
import { FacebookService } from '@/services/facebook';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { encryptToken } from '@/utils/crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { code, redirectUri, userId } = await request.json();

        if (!code || !userId) {
            return NextResponse.json({ success: false, error: 'Missing code or userId' }, { status: 400 });
        }

        const clientId = process.env.FACEBOOK_CLIENT_ID;
        const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return NextResponse.json({ success: false, error: 'Server misconfiguration: Missing FB Credentials' }, { status: 500 });
        }

        // 1. Exchange Code for Short Token
        const shortToken = await FacebookService.exchangeCodeForToken(code, redirectUri || '', clientId, clientSecret);

        // 2. Exchange Short for Long Token
        const { access_token: longToken, expires_in } = await FacebookService.getLongLivedToken(shortToken, clientId, clientSecret);

        // Calculate Expiry Date (expires_in is seconds)
        // If expires_in is undefined or 0 (never expires), handle appropriately (set far future or null)
        let expiresAt = null;
        if (expires_in) {
            const now = new Date();
            now.setSeconds(now.getSeconds() + expires_in);
            expiresAt = now.toISOString();
        }

        // 3. Encrypt Token
        const encrypted = encryptToken(longToken);

        // 4. Upsert Token to DB
        // Check if user already has a token row? We enforce 1 token per user for simplicity or upsert by user_id?
        // Let's query by user_id first to get ID or insert new.
        const { data: existingToken } = await supabaseAdmin
            .from('facebook_tokens')
            .select('id')
            .eq('user_id', userId)
            .single();

        let tokenId = existingToken?.id;

        const tokenPayload = {
            user_id: userId,
            encrypted_access_token: encrypted,
            expires_at: expiresAt,
            is_valid: true,
            last_refreshed_at: new Date().toISOString()
        };

        if (tokenId) {
            await supabaseAdmin.from('facebook_tokens').update(tokenPayload).eq('id', tokenId);
        } else {
            const { data: newToken, error: insertError } = await supabaseAdmin.from('facebook_tokens').insert(tokenPayload).select('id').single();
            if (insertError) throw insertError;
            tokenId = newToken.id;
        }

        // 5. Fetch and Link Ad Accounts
        const adAccounts = await FacebookService.getAdAccounts(longToken);

        for (const account of adAccounts) {
            // Upsert Account and Link Token
            await supabaseAdmin.from('accounts').upsert({
                account_id: account.id,
                name: account.name,
                token_id: tokenId,
                is_active: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'account_id' });
        }

        return NextResponse.json({ success: true, accounts_linked: adAccounts.length });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
