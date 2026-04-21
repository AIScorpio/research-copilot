import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSamplePapers() {
  console.log('📄 Seeding sample papers with banking tags...');
  
  const samplePapers = [
    {
      title: 'Large Language Models for Regulatory Compliance in Banking',
      abstract: 'This paper explores the use of LLMs for analyzing regulatory documents and ensuring compliance with banking regulations. We present a pilot implementation that demonstrates significant efficiency gains.',
      url: 'https://example.com/paper1',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      tags: ['LLM Applications', 'Compliance', 'Regulatory Risk', 'NLP Compliance']
    },
    {
      title: 'Graph Neural Networks for Anti-Money Laundering Detection',
      abstract: 'A novel approach using GNNs for detecting suspicious transactions in AML monitoring. Our production-ready system shows 95% accuracy in real-world deployment.',
      url: 'https://example.com/paper2',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      tags: ['Graph Analytics', 'Anomaly Detection', 'Fraud Detection']
    },
    {
      title: 'Deep Learning for Credit Risk Assessment in Banking',
      abstract: 'Deep learning models for predicting credit default risk. Our pilot study on loan applications demonstrates improved accuracy over traditional scoring models.',
      url: 'https://example.com/paper3',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      tags: ['Credit Risk', 'Predictive Modeling', 'Deep Learning']
    },
    {
      title: 'Fraud Detection Using Anomaly Detection in Banking Transactions',
      abstract: 'An automated system for detecting fraudulent transactions using machine learning. Implemented in production at major financial institutions.',
      url: 'https://example.com/paper4',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      tags: ['Fraud Detection', 'Anomaly Detection', 'Cyber Risk']
    },
    {
      title: 'NLP-Based Compliance Rule Extraction from Regulatory Documents',
      abstract: 'Extracting compliance rules from regulatory documents using NLP. Experimental approach showing promising results for automated compliance monitoring.',
      url: 'https://example.com/paper5',
      source: 'arxiv',
      publicationDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      tags: ['NLP Compliance', 'Compliance', 'Model Governance']
    }
  ];

  for (const paperData of samplePapers) {
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

  console.log('\n✅ Sample data seeded successfully!');
  await prisma.$disconnect();
}

seedSamplePapers().catch(console.error);
