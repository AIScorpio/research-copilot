import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { digestEngine } from '@/lib/daily-digest/engine';
import { getBeijingDayRange } from '@/lib/timezone-utils';

/**
 * Check if digest needs refresh by comparing paper counts
 */
async function shouldRefresh(dateCode: string): Promise<boolean> {
  const digest = await prisma.dailyDigestLog.findUnique({
    where: { dateCode },
    select: { actualCount: true, status: true }
  });
  
  if (!digest) return true; // Doesn't exist, need to create
  if (digest.status === 'error') return true; // Error state, retry
  
  // Count current papers for this date (using Beijing Time range)
  const { startUTC: startDate, endUTC: endDate } = getBeijingDayRange(dateCode);
  
  const currentPaperCount = await prisma.paper.count({
    where: {
      collectedAt: {
        gte: startDate,
        lt: endDate
      },
      deletedAt: null
    }
  });
  
  console.log(`[LazyLoad] ${dateCode}: stored=${digest.actualCount}, current=${currentPaperCount}, refresh=${currentPaperCount !== digest.actualCount}`);
  
  // Refresh if paper count changed
  return currentPaperCount !== digest.actualCount;
}

/**
 * Count papers for a specific date
 */
async function countPapersForDate(dateCode: string): Promise<number> {
  const { startUTC: startDate, endUTC: endDate } = getBeijingDayRange(dateCode);
  
  return await prisma.paper.count({
    where: {
      collectedAt: {
        gte: startDate,
        lt: endDate
      },
      deletedAt: null
    }
  });
}

/**
 * GET /api/daily-digest
 * Get daily digest for a specific date or list all digests
 * Implements lazy loading: auto-regenerates if paper count changed
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateCode = searchParams.get('date');

    if (dateCode) {
      // Get specific digest with lazy loading
      let digest = await prisma.dailyDigestLog.findUnique({
        where: { dateCode },
        include: { papers: true }
      });

      // Check current paper count
      const paperCount = await countPapersForDate(dateCode);
      
      // Edge Case 1: No papers at all
      if (paperCount === 0) {
        // If digest exists but no papers, delete it
        if (digest) {
          await prisma.dailyDigestLog.delete({ where: { dateCode } });
          console.log(`[LazyLoad] ${dateCode}: No papers, deleted stale digest`);
        }
        return NextResponse.json({
          success: true,
          status: 'empty',
          message: 'No papers collected for this date',
          digest: null
        });
      }
      
      // Edge Case 2: Check if digest needs refresh
      const needsRefresh = !digest || digest.status === 'error' || await shouldRefresh(dateCode);
      
      if (needsRefresh) {
        console.log(`[LazyLoad] ${dateCode}: Triggering generation/refresh...`);
        
        // Trigger generation (don't await to avoid timeout for long generation)
        const generationPromise = digestEngine.triggerDailyDigestUpdate(new Date(dateCode));
        
        // If we have existing digest (even if stale), return it immediately
        // Client can poll or refresh to get updated content
        if (digest && digest.status !== 'error') {
          return NextResponse.json({
            success: true,
            status: 'stale',
            message: 'Digest is being updated with latest papers',
            digest: digest,
            paperCount: paperCount,
            needsRefresh: true
          });
        }
        
        // No existing digest, wait for generation
        try {
          const result = await generationPromise;
          if (result.success && result.digest) {
            // Fetch complete digest with papers
            const freshDigest = await prisma.dailyDigestLog.findUnique({
              where: { dateCode },
              include: { papers: true }
            });
            
            return NextResponse.json({
              success: true,
              status: 'ready',
              digest: freshDigest,
              paperCount: paperCount,
              fresh: true
            });
          } else {
            return NextResponse.json({
              success: false,
              status: 'error',
              error: result.error?.message || 'Generation failed',
              digest: null
            }, { status: 500 });
          }
        } catch (error) {
          console.error(`[LazyLoad] ${dateCode}: Generation failed`, error);
          return NextResponse.json({
            success: false,
            status: 'error',
            error: 'Failed to generate digest',
            digest: null
          }, { status: 500 });
        }
      }
      
      // Digest is up to date
      return NextResponse.json({
        success: true,
        status: 'ready',
        digest: digest,
        paperCount: paperCount,
        fresh: true
      });
    } else {
      // List all digests
      const digests = await prisma.dailyDigestLog.findMany({
        orderBy: { dateCode: 'desc' },
        take: 30,
        include: { papers: true }
      });

      return NextResponse.json({
        success: true,
        digests
      });
    }
  } catch (error) {
    console.error('[DailyDigest API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch daily digest' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-digest
 * Trigger digest regeneration for a specific date
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dateCode } = body;

    if (!dateCode) {
      return NextResponse.json(
        { success: false, error: 'dateCode is required' },
        { status: 400 }
      );
    }

    const result = await digestEngine.regenerateDigest(dateCode);

    if (result.success) {
      // Fetch complete digest with papers
      const digestWithPapers = await prisma.dailyDigestLog.findUnique({
        where: { dateCode },
        include: { papers: true }
      });
      
      return NextResponse.json({
        success: true,
        status: 'ready',
        digest: digestWithPapers,
        retries: result.retries
      });
    } else {
      return NextResponse.json(
        { success: false, status: 'error', error: result.error?.message || 'Generation failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[DailyDigest API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate digest' },
      { status: 500 }
    );
  }
}
