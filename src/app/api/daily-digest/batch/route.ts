/**
 * @swagger
 * /api/daily-digest/batch:
 *   get:
 *     summary: Get dates missing digests
 *     description: Retrieve all dates that have papers but no corresponding digests
 *     tags:
 *       - Daily Digest
 *     responses:
 *       200:
 *         description: List of dates with papers but no digests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 dates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       dateCode:
 *                         type: string
 *                         example: "2026-03-21"
 *                       paperCount:
 *                         type: integer
 *                         example: 13
 *                 total:
 *                   type: integer
 *                   example: 8
 *       500:
 *         description: Server error
 *   post:
 *     summary: Generate digests for dates
 *     description: Generate daily digests for specific historical dates
 *     tags:
 *       - Daily Digest
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dateCodes
 *             properties:
 *               dateCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["2026-03-21", "2026-03-22"]
 *               maxConcurrent:
 *                 type: integer
 *                 description: Maximum concurrent generations (1-5)
 *                 default: 3
 *                 example: 3
 *     responses:
 *       200:
 *         description: Batch processing results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 processed:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       dateCode:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [success, failed, error, skipped]
 *                       paperCount:
 *                         type: integer
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { digestEngine } from "@/lib/daily-digest/engine";
import { getBeijingDateCode, getBeijingDayRange } from "@/lib/timezone-utils";
export async function GET() {
  try {
    // Find all papers and group by Beijing date
    const papers = await prisma.paper.findMany({
      where: { deletedAt: null },
      select: { 
        collectedAt: true,
        id: true
      },
      orderBy: { collectedAt: 'desc' }
    });

    // Group by Beijing date
    const dateMap = new Map<string, number>();
    papers.forEach(paper => {
      const dateCode = getBeijingDateCode(paper.collectedAt);
      dateMap.set(dateCode, (dateMap.get(dateCode) || 0) + 1);
    });

    // Check which dates already have digests
    const existingDigests = await prisma.dailyDigestLog.findMany({
      select: { dateCode: true },
      where: { status: { not: 'error' } }
    });
    const existingDates = new Set(existingDigests.map(d => d.dateCode));

    // Filter dates without digests
    const missingDates = Array.from(dateMap.entries())
      .filter(([dateCode]) => !existingDates.has(dateCode))
      .map(([dateCode, count]) => ({ dateCode, paperCount: count }))
      .sort((a, b) => b.dateCode.localeCompare(a.dateCode));

    return NextResponse.json({
      success: true,
      dates: missingDates,
      total: missingDates.length
    });

  } catch (error) {
    console.error('[BatchDigest] Error fetching dates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-digest/batch
 * Generate digests for specific dates (batch processing)
 * Body: { dateCodes: string[], maxConcurrent?: number }
 */
export async function POST(request: Request) {
  try {
    const { dateCodes, maxConcurrent = 3 } = await request.json();

    if (!dateCodes || !Array.isArray(dateCodes) || dateCodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'dateCodes array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to avoid Vercel timeout (60s)
    const batchSize = Math.min(dateCodes.length, maxConcurrent);
    const batch = dateCodes.slice(0, batchSize);

    console.log(`[BatchDigest] Processing ${batch.length} dates:`, batch);

    // Define result type
    interface BatchResult {
      dateCode: string;
      status: string;
      paperCount?: number;
      reason?: string;
      error?: string;
    }

    // Process dates sequentially to avoid overwhelming the system
    const results: BatchResult[] = [];
    for (const dateCode of batch) {
      try {
        console.log(`[BatchDigest] Generating digest for ${dateCode}...`);
        
        // Check if papers exist for this date
        const papers = await prisma.paper.findMany({
          where: {
            collectedAt: {
              gte: new Date(dateCode + 'T00:00:00+08:00'),
              lt: new Date(dateCode + 'T23:59:59+08:00')
            },
            deletedAt: null
          }
        });

        if (papers.length === 0) {
          results.push({ dateCode, status: 'skipped', reason: 'No papers found' });
          continue;
        }

        // Trigger digest generation
        const result = await digestEngine.triggerDailyDigestUpdate(new Date(dateCode + 'T00:00:00+08:00'));
        
        results.push({
          dateCode,
          status: result.success ? 'success' : 'failed',
          paperCount: papers.length,
          error: result.error?.message
        });

        // Add small delay between generations to avoid rate limiting
        if (batch.indexOf(dateCode) < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`[BatchDigest] Failed for ${dateCode}:`, error);
        results.push({
          dateCode,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const remaining = dateCodes.length - batchSize;

    return NextResponse.json({
      success: true,
      processed: results,
      summary: {
        total: dateCodes.length,
        processed: batchSize,
        successful: successCount,
        failed: batchSize - successCount,
        remaining: remaining > 0 ? remaining : 0
      }
    });

  } catch (error) {
    console.error('[BatchDigest] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Batch processing failed' },
      { status: 500 }
    );
  }
}
