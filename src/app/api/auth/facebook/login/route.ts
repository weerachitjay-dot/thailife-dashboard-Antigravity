import { NextResponse } from "next/server";

export async function GET() {
    const clientId = process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID;
    const redirectUri =
        "https://thailife-dashboard-antigravity.vercel.app/api/auth/facebook/callback";

    const scope = [
        "ads_read",
        "ads_management",
        "business_management",
    ].join(",");

    if (!clientId) {
        return NextResponse.json(
            { error: "Missing NEXT_PUBLIC_FACEBOOK_CLIENT_ID" },
            { status: 500 }
        );
    }

    const facebookAuthUrl =
        `https://www.facebook.com/v18.0/dialog/oauth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${scope}` +
        `&response_type=code`;

    return NextResponse.redirect(facebookAuthUrl);
}
