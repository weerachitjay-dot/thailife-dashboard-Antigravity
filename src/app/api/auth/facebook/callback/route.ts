import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    return NextResponse.json({
        status: 'callback reached',
        code,
    })
}
