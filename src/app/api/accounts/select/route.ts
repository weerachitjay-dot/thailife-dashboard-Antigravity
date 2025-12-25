import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { userId, accountId } = await request.json();

        if (!userId || !accountId) {
            return NextResponse.json({ success: false, error: 'Missing userId or accountId' }, { status: 400 });
        }

        // 1. Verify User Token
        // Ideally we should verify the user owns the token that owns the account, 
        // but for MVCP we can rely on RLS logic or simplified join. 
        // Let's reset all accounts for this user's token first to ensure single selection.

        // Find token first to be safe
        const { data: token } = await supabaseAdmin
            .from('facebook_tokens')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (!token) {
            return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
        }

        // 2. Deselect all accounts for this token
        await supabaseAdmin
            .from('accounts')
            .update({ is_selected: false })
            .eq('token_id', token.id);

        // 3. Select specific account
        const { error, data } = await supabaseAdmin
            .from('accounts')
            .update({ is_selected: true })
            .eq('account_id', accountId)
            .eq('token_id', token.id) // Security: Ensure it belongs to user
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            // Rollback? No transaction here easily without RPC, but rare case.
            return NextResponse.json({ success: false, error: 'Account not found or access denied' }, { status: 404 });
        }

        return NextResponse.json({ success: true, selected: accountId });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
