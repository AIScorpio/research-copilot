import { prisma } from '@/lib/db';

async function main() {
  console.log('🚀 Starting simplified trend data backfill...');

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  const endDate = new Date();

  const tags = await prisma.tag.findMany({
    select: {
      id: true,
      name: true
    }
  });

  console.log(`📊 Found ${tags.length} tags`);

  let totalProcessed = 0;
  let totalCreated = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const currentDateStr = currentDate.toISOString().split('T')[0];

    for (const tag of tags) {
      totalProcessed++;

      const count = await prisma.paper.count({
        where: {
          tags: {
            some: {
              tagId: tag.id
            }
          },
          publicationDate: {
            gte: new Date(currentDateStr),
            lt: new Date(nextDate.toISOString().split('T')[0])
          }
        }
      });

      const existing = await prisma.trendData.findFirst({
        where: {
          tagId: tag.id,
          date: {
            gte: new Date(currentDateStr),
            lt: new Date(nextDate.toISOString().split('T')[0])
          }
        }
      });

      if (!existing) {
        await prisma.trendData.create({
          data: {
            id: `${tag.id}-${currentDateStr}`,
            tagId: tag.id,
            date: currentDate.toISOString(),
            count
          }
        });
        totalCreated++;
      } else {
        await prisma.trendData.update({
          where: {
            id: existing.id
          },
          data: {
            count
          }
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('✅ Backfill complete!');
  console.log(`   Processed: ${totalProcessed} entries`);
  console.log(`   Created: ${totalCreated} new records`);
}

main()
  .catch((e) => {
    console.error('❌ Error during backfill:', e);
    process.exit(1);
  });
