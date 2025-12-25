import { NextResponse } from 'next/server';
import { FacebookService } from '@/services/facebook';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { encryptToken } from '@/utils/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            return NextResponse.json({ success: false, error: 'Facebook Auth Error: ' + error }, { status: 400 });
        }

        if (!code) {
            return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 });
        }

        const clientId = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID;
        const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.error('Missing FB Credentials');
            return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
        }

        // MUST match the Login Route exact URL
        const redirectUri = "https://thailife-dashboard-antigravity.vercel.app/api/auth/facebook/callback";

        // Mock User ID (Consistent with "No-Admin" Refactor Context)
        const userId = 'user-123';

        // 1. Exchange Code for Short Token
        const shortToken = await FacebookService.exchangeCodeForToken(code, redirectUri, clientId, clientSecret);

        // 2. Exchange Short for Long Token
        const { access_token: longToken, expires_in } = await FacebookService.getLongLivedToken(shortToken, clientId, clientSecret);

        // Calculate Expiry
        let expiresAt = null;
        if (expires_in) {
            const now = new Date();
            now.setSeconds(now.getSeconds() + expires_in);
            expiresAt = now.toISOString();
        }

        // 3. Encrypt & Persist
        const encrypted = encryptToken(longToken);

        // Check for existing token row
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

        // 4. Fetch & Link Accounts
        const adAccounts = await FacebookService.getAdAccounts(longToken);

        for (const account of adAccounts) {
            await supabaseAdmin.from('accounts').upsert({
                account_id: account.id,
                name: account.name,
                token_id: tokenId,
                is_active: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'account_id' });
        }

        // 5. Success Redirect
        return NextResponse.redirect(new URL('/', req.url));

    } catch (error: any) {
        console.error('Callback Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
