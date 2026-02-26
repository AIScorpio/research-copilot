import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const businessAreaTags = await prisma.tag.findMany({
    where: { category: 'business-area' },
    orderBy: { name: 'asc' }
  });
  
  console.log(`Found ${businessAreaTags.length} business-area tags:`);
  businessAreaTags.forEach((tag: { name: string; category?: string | null }) => {
    console.log(`  - ${tag.name} (category: ${tag.category || 'none'})`);
  });
  
  const papersWithBusinessAreaTags = await prisma.paper.findMany({
    where: {
      tags: {
        some: {
          tag: {
            category: 'business-area'
          }
        }
      }
    },
    include: {
      tags: {
        where: {
          tag: {
            category: 'business-area'
          }
        },
        include: {
          tag: true
        }
      }
    },
    take: 5
  });
  
  console.log(`\nFound ${papersWithBusinessAreaTags.length} papers with business-area tags (sample):`);
  papersWithBusinessAreaTags.forEach((paper: typeof papersWithBusinessAreaTags[0]) => {
    const businessTagNames = paper.tags.map(pt => pt.tag.name).join(', ');
    console.log(`  - ${paper.title}`);
    console.log(`    Tags: ${businessTagNames}`);
  });
  
  await prisma.$disconnect();
}

main();
