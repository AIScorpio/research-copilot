import { NextResponse } from 'next/server'
import { loadSourceTypesConfig } from '@/lib/source-config'
import { logger } from '@/lib/logger'

export async function GET() {
    try {
        const config = await loadSourceTypesConfig()
        return NextResponse.json(config)
    } catch (error) {
        logger.error('[API] Failed to load source types config:', { error: error instanceof Error ? error.message : String(error) })
        return NextResponse.json(
            { error: 'Failed to load source types configuration' },
            { status: 500 }
        )
    }
}
