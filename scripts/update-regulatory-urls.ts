import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Updating regulatory feed URLs in database...\n');

  // Based on testing and research:
  // BIS: Multiple RSS feeds available, using press releases
  // ECB: Testing various RSS URLs
  // FCA: Already working
  // PRA: Need to find correct RSS URL
  // Federal Reserve: Already working

  const updates = [
    {
      name: 'BIS (Bank for International Settlements)',
      newUrl: 'https://www.bis.org/doclist/all_pressrels.rss',
    },
    {
      name: 'ECB (European Central Bank)',
      newUrl: 'https://www.ecb.europa.eu/press/news/pressreleases/xml/rssstandard.en.html',
    },
    {
      name: 'PRA (Prudential Regulation Authority)',
      newUrl: 'https://www.bankofengland.co.uk/pra/-/media/boe/files/pra/rss/pra-rss.xml',
    },
  ];

  for (const update of updates) {
    try {
      const source = await prisma.source.findFirst({
        where: { name: update.name },
      });

      if (source) {
        const oldUrl = source.url;
        await prisma.source.update({
          where: { id: source.id },
          data: { url: update.newUrl },
        });
        console.log(`✓ Updated: ${update.name}`);
        console.log(`  Old: ${oldUrl}`);
        console.log(`  New: ${update.newUrl}\n`);
      } else {
        console.log(`✗ Not found: ${update.name}`);
      }
    } catch (error) {
      console.error(`✗ Error updating ${update.name}:`, error);
    }
  }

  console.log('\n✅ URL updates complete!');
  await prisma.$disconnect();
}

main().catch(console.error);
