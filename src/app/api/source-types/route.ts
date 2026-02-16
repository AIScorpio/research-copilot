import { NextResponse } from 'next/server'
import { loadSourceTypesConfig } from '@/lib/source-config'

export async function GET() {
    try {
        const config = await loadSourceTypesConfig()
        return NextResponse.json(config)
    } catch (error) {
        console.error('[API] Failed to load source types config:', error)
        return NextResponse.json(
            { error: 'Failed to load source types configuration' },
            { status: 500 }
        )
    }
}
