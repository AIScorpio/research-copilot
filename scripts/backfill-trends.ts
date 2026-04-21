import { prisma } from '../src/lib/db';
import { backfillTrendData } from '../src/lib/trends';

process.env.DATABASE_URL = `file:${process.cwd()}/prisma/dev.db`;

async function main() {
  console.log('🚀 Starting trend data backfill...');

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);

  const endDate = new Date();

  console.log(`📅 Backfilling from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const result = await backfillTrendData(startDate, endDate);

  console.log('✅ Backfill complete!');
  console.log(`   Processed: ${result.processed} entries`);
  console.log(`   Created: ${result.created} new records`);
  console.log(`   Updated: ${result.updated} existing records`);
}

main()
  .catch((e) => {
    console.error('❌ Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
