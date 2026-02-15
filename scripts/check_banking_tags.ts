import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bankingTags = await prisma.tag.findMany({
    where: { type: 'Banking' },
    orderBy: { name: 'asc' }
  });
  
  console.log(`Found ${bankingTags.length} banking tags:`);
  bankingTags.forEach(tag => {
    console.log(`  - ${tag.name} (category: ${tag.category || 'none'})`);
  });
  
  // Also check papers with banking tags
  const papersWithBankingTags = await prisma.paper.findMany({
    where: {
      tags: {
        some: {
          tag: {
            type: 'Banking'
          }
        }
      }
    },
    include: {
      tags: {
        where: {
          tag: {
            type: 'Banking'
          }
        },
        include: {
          tag: true
        }
      }
    },
    take: 5
  });
  
  console.log(`\nFound ${papersWithBankingTags.length} papers with banking tags (sample):`);
  papersWithBankingTags.forEach(paper => {
    const bankingTagNames = paper.tags.map(pt => pt.tag.name).join(', ');
    console.log(`  - ${paper.title}`);
    console.log(`    Tags: ${bankingTagNames}`);
  });
  
  await prisma.$disconnect();
}

main();
