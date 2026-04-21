import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMorePapers() {
  console.log('📄 Seeding more sample papers...');
  
  const morePapers = [
    {
      title: 'Advanced LLM Applications for Banking Compliance',
      abstract: 'Using large language models for automated compliance checking and regulatory analysis. Pilot implementation at JPMorgan Chase.',
      url: 'https://example.com/paper6',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      tags: ['LLM Applications', 'Compliance', 'Regulatory Risk', 'NLP Compliance']
    },
    {
      title: 'Graph Analytics for AML Transaction Networks',
      abstract: 'Analyzing money laundering patterns using graph neural networks. Production system deployed at multiple banks.',
      url: 'https://example.com/paper7',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      tags: ['Graph Analytics', 'Anomaly Detection', 'Fraud Detection']
    },
    {
      title: 'Predictive Modeling for Credit Risk Assessment',
      abstract: 'Machine learning models for predicting loan defaults. Real-world validation with major banking institutions.',
      url: 'https://example.com/paper8',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      tags: ['Credit Risk', 'Predictive Modeling', 'Deep Learning']
    },
    {
      title: 'NLP Compliance Systems for Regulatory Documents',
      abstract: 'Automated extraction and analysis of compliance rules from regulatory documents using NLP. Experimental framework.',
      url: 'https://example.com/paper9',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      tags: ['NLP Compliance', 'Compliance', 'Model Governance']
    },
    {
      title: 'Fraud Detection Anomalies in Banking Systems',
      abstract: 'Detecting fraudulent transactions using anomaly detection algorithms. Implemented in production at Goldman Sachs.',
      url: 'https://example.com/paper10',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      tags: ['Fraud Detection', 'Anomaly Detection', 'Cyber Risk']
    }
  ];

  for (const paperData of morePapers) {
    const paper = await prisma.paper.create({
      data: {
        title: paperData.title,
        abstract: paperData.abstract,
        url: paperData.url,
        source: paperData.source,
        publicationDate: paperData.publicationDate
      }
    });
    console.log(`  ✓ Created paper: ${paper.title.substring(0, 50)}...`);

    for (const tagName of paperData.tags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: {
          name: tagName,
          category: tagName.toLowerCase().replace(/\s+/g, '-')
        }
      });

      await prisma.paperTag.create({
        data: {
          paperId: paper.id,
          tagId: tag.id
        }
      });
      console.log(`    ✓ Linked tag: ${tagName}`);
    }
  }

  console.log('\n✅ Additional papers seeded successfully!');
  await prisma.$disconnect();
}

seedMorePapers().catch(console.error);
