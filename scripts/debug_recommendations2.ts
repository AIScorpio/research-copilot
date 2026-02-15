import { prisma } from '../src/lib/db';
import { BANKING_TAXONOMY } from '../src/lib/recommendations';

async function debugGrouping() {
  console.log('=== Debug: Grouping Logic ===');
  
  const recentPapers = await prisma.paper.findMany({
    where: {
      publicationDate: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      }
    },
    include: {
      tags: {
        include: {
          tag: true
        }
      }
    },
    orderBy: {
      publicationDate: 'desc'
    }
  });

  const bankingTags = await prisma.tag.findMany({
    where: {
      type: 'Banking'
    }
  });

  const bankingTagNames = new Set(bankingTags.map(bt => bt.name));

  console.log('\nProcessing papers...');
  interface Paper {
    id: string;
    title: string;
    publicationDate: Date;
    tags: Array<{ tag: { name: string } }>;
  }
  const groups: Record<string, Paper[]> = {};

  for (const paper of recentPapers) {
    const tags = paper.tags.map((pt) => pt.tag.name);
    console.log(`\nPaper: ${paper.title}`);
    console.log(`  Tags: [${tags.join(', ')}]`);
    
    const relevantTag = tags.find((tag: string) => 
      BANKING_TAXONOMY.aiTechnologies.some(t => tag.includes(t)) ||
      BANKING_TAXONOMY.useCases.some(t => tag.includes(t)) ||
      bankingTagNames.has(tag)
    );

    console.log(`  Relevant tag: ${relevantTag || 'None'}`);

    if (relevantTag) {
      const key = relevantTag;
      if (!groups[key]) groups[key] = [];
      groups[key].push(paper);
      console.log(`  Added to group: ${key}`);
    }
  }

  console.log(`\n=== Final Groups ===`);
  console.log(`Found ${Object.keys(groups).length} groups:`);
  for (const [topic, papers] of Object.entries(groups)) {
    console.log(`\n- ${topic}: ${papers.length} papers`);
  }

  await prisma.$disconnect();
}

debugGrouping().catch(console.error);
