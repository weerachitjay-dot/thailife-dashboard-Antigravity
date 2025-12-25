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

        // 1. Get Token ID for User
        const { data: token } = await supabaseAdmin
            .from('facebook_tokens')
            .select('id')
            .eq('user_id', userId)
            .eq('is_valid', true)
            .single();

        if (!token) {
            return NextResponse.json({ success: false, error: 'No valid token found' }, { status: 404 });
        }

        // 2. Get Accounts linked to Token
        const { data: accounts } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('token_id', token.id)
            .order('name');

        return NextResponse.json({ success: true, accounts: accounts || [] });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
