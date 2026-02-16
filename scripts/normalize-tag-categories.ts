/**
 * Normalize tag categories to standard values
 * Run with: npx ts-node scripts/normalize-tag-categories.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORY_MAPPINGS: Record<string, string> = {
    // Risk Management variants
    'risk management': 'risk-category',
    'risk': 'risk-category',
    'risk management ': 'risk-category',
    'credit risk': 'risk-category',
    'credit risk assessment': 'risk-category',
    'risk-category': 'risk-category',
    
    // AI/ML variants  
    'ai/ml': 'ai-technology',
    'ai/ml in finance': 'ai-technology',
    'ai/ml for finance': 'ai-technology',
    'ai': 'ai-technology',
    'machine learning': 'ai-technology',
    'federated learning': 'ai-technology',
    'time series forecasting': 'ai-technology',
    
    // Banking/Business variants
    'banking': 'business-area',
    'banking technology': 'business-area',
    'finance': 'business-area',
    'financial technology': 'business-area',
    'financial modeling': 'business-area',
    'asset management': 'business-area',
    'trading': 'business-area',
    
    // Compliance variants
    'compliance': 'regulatory',
    'regulatory compliance': 'regulatory',
    'anti-money laundering': 'regulatory',
    
    // Other
    'fairness in ai': 'methodology',
    'model reduction': 'methodology',
    'education': 'methodology',
    'sustainable finance': 'business-area',
    'cybersecurity': 'risk-category',
}

function normalizeCategory(raw: string | null): string {
    if (!raw) return 'uncategorized'
    
    const normalized = raw.toLowerCase().trim()
    return CATEGORY_MAPPINGS[normalized] || 'uncategorized'
}

async function main() {
    console.log('Normalizing tag categories...')
    
    // Get all tags
    const tags = await prisma.tag.findMany()
    console.log(`Found ${tags.length} tags`)
    
    let updated = 0
    let unchanged = 0
    
    for (const tag of tags) {
        const newCategory = normalizeCategory(tag.category)
        
        if (tag.category !== newCategory) {
            await prisma.tag.update({
                where: { id: tag.id },
                data: { category: newCategory }
            })
            updated++
            
            if (updated % 50 === 0) {
                console.log(`Updated ${updated} tags...`)
            }
        } else {
            unchanged++
        }
    }
    
    console.log(`\nNormalization complete!`)
    console.log(`Updated: ${updated}`)
    console.log(`Unchanged: ${unchanged}`)
    
    // Show final distribution
    const distribution = await prisma.tag.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } }
    })
    
    console.log('\nFinal category distribution:')
    distribution.forEach(d => {
        console.log(`  ${d.category || '(empty)'}: ${d._count}`)
    })
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
