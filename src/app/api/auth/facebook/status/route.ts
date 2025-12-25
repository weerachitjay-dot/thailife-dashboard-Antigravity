import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
        }

        const { data: token } = await supabaseAdmin
            .from('facebook_tokens')
            .select('expires_at, is_valid')
            .eq('user_id', userId)
            .single();

        if (!token) {
            return NextResponse.json({ status: 'not_connected' });
        }

        if (!token.is_valid) {
            return NextResponse.json({ status: 'expired' });
        }

        let expiresInDays = null;
        if (token.expires_at) {
            const now = new Date();
            const expiry = new Date(token.expires_at);
            const diffTime = Math.abs(expiry.getTime() - now.getTime());
            expiresInDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (expiry < now) return NextResponse.json({ status: 'expired', expires_in_days: 0 });
            if (expiresInDays <= 7) return NextResponse.json({ status: 'warning', expires_in_days: expiresInDays });
        }

        return NextResponse.json({ status: 'healthy', expires_in_days: expiresInDays });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
