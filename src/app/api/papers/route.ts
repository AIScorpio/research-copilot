/**
 * @swagger
 * /api/papers:
 *   get:
 *     summary: Get papers list
 *     description: Retrieve papers with optional filtering, search, and pagination
 *     tags:
 *       - Papers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query for title and abstract
 *       - in: query
 *         name: sector
 *         schema:
 *           type: string
 *         description: Filter by sector tag
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter by topic tag
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of papers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 papers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Server error
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/error-handler';
import { schemas } from '@/lib/validation/schemas';
import { validateQueryParams } from '@/lib/validation/helpers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const validation = validateQueryParams(schemas.papers.query, searchParams);
    if (!validation.success) return validation.response;

    const { search, sector, topic, page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const whereClause: any = {};

    if (search) {
        whereClause.OR = [
            { title: { contains: search } },
            { abstract: { contains: search } }
        ];
    }

    if (sector || topic) {
        whereClause.tags = {
            some: {
                tag: {
                    OR: []
                }
            }
        };

        if (sector) whereClause.tags.some.tag.OR.push({ name: sector });
        if (topic) whereClause.tags.some.tag.OR.push({ name: topic });
    }

    try {
        const [papers, total] = await Promise.all([
            prisma.paper.findMany({
                where: whereClause,
                include: {
                    tags: {
                        include: {
                            tag: true
                        }
                    },
                    favoritedBy: true
                },
                orderBy: {
                    collectedAt: 'desc'
                },
                take: pageSize,
                skip: skip,
            }),
            prisma.paper.count({ where: whereClause })
        ]);

        const formattedPapers = papers.map(p => ({
            ...p,
            tags: p.tags.map(pt => pt.tag)
        }));

        return NextResponse.json({
            papers: formattedPapers,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: skip + papers.length < total,
                hasPreviousPage: page > 1,
            }
        });
    } catch (error) {
        const handled = handleError(error);
        return NextResponse.json(handled, { status: handled.statusCode });
    }
}
