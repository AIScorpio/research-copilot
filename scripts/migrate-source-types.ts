/**
 * Migration script to populate sourceType for existing papers
 * Run with: npx ts-node scripts/migrate-source-types.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting sourceType migration...')
    
    // Get all sources with their types
    const sources = await prisma.source.findMany({
        select: { name: true, type: true }
    })
    
    // Create a lookup map
    const sourceTypeMap = new Map(
        sources.map(s => [s.name.toLowerCase(), s.type])
    )
    
    console.log(`Found ${sources.length} sources in database`)
    
    // Get papers without sourceType
    const papersWithoutSourceType = await prisma.paper.findMany({
        where: { sourceType: null },
        select: { id: true, source: true }
    })
    
    console.log(`Found ${papersWithoutSourceType.length} papers without sourceType`)
    
    let updated = 0
    let skipped = 0
    
    for (const paper of papersWithoutSourceType) {
        const sourceType = sourceTypeMap.get(paper.source.toLowerCase()) || 'internal'
        
        try {
            await prisma.paper.update({
                where: { id: paper.id },
                data: { sourceType }
            })
            updated++
            
            if (updated % 100 === 0) {
                console.log(`Updated ${updated} papers...`)
            }
        } catch (error) {
            console.error(`Failed to update paper ${paper.id}:`, error)
            skipped++
        }
    }
    
    console.log(`\nMigration complete!`)
    console.log(`Updated: ${updated}`)
    console.log(`Skipped: ${skipped}`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
