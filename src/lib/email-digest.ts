import { prisma } from './db';
import { generatePowerPoint } from './ppt-generator';
import { generateSocialMediaPosts } from './social-media';
import { logger } from './logger';

export interface DigestConfig {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipientEmail: string;
    includePowerPoint?: boolean;
    includeSocialPosts?: boolean;
    includeStats?: boolean;
    maxPapers?: number;
    topics?: string[];
    sinceDate?: Date;
}

export interface EmailDigest {
    id: string;
    recipientEmail: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    paperCount: number;
    sentAt?: Date;
    generatedAt: Date;
    attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType: string;
    }>;
}

export async function generateEmailDigest(config: DigestConfig): Promise<EmailDigest> {
    const {
        frequency,
        recipientEmail,
        includePowerPoint = false,
        includeSocialPosts = false,
        includeStats = true,
        maxPapers = 20,
        topics,
        sinceDate: configSinceDate
    } = config;

    // Determine date range based on frequency
    const since = configSinceDate || getDateRangeByFrequency(frequency);
    const to = new Date();

    // Fetch papers
    const whereClause: any = {
        publicationDate: {
            gte: since,
            lte: to
        }
    };

    if (topics && topics.length > 0) {
        whereClause.tags = {
            some: {
                tag: {
                    name: { in: topics }
                }
            }
        };
    }

    const papers = await prisma.paper.findMany({
        where: whereClause,
        include: {
            tags: {
                include: {
                    tag: true
                }
            }
        },
        orderBy: {
            publicationDate: 'desc'
        },
        take: maxPapers
    });

    // Generate stats
    let statsHtml = '';
    let statsText = '';

    if (includeStats) {
        const stats = await generateDigestStats(since, to);
        statsHtml = generateStatsHtml(stats);
        statsText = generateStatsText(stats);
    }

    // Generate PowerPoint if requested
    let pptAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
    if (includePowerPoint && papers.length > 0) {
        const formattedPapers = papers.map(p => ({
            id: p.id,
            title: p.title,
            abstract: p.abstract || undefined,
            url: p.url,
            source: p.source,
            publicationDate: p.publicationDate,
            aiSummary: p.aiSummary || undefined,
            assessmentReason: p.assessmentReason || undefined,
            tags: p.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name, category: pt.tag.category }))
        }));

        const pptxBuffer = await generatePowerPoint(formattedPapers, {
            title: `Research Digest - ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}`,
            subtitle: formatDateRange(since, to)
        });

        pptAttachment = {
            filename: `research-digest-${new Date().toISOString().split('T')[0]}.pptx`,
            content: pptxBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
    }

    // Generate social media posts if requested
    let socialPostsHtml = '';
    let socialPostsText = '';

    if (includeSocialPosts && papers.length > 0) {
        const posts = await generateSocialMediaPosts(papers.slice(0, 3).map(p => p.id), 'LinkedIn', 3);
        socialPostsHtml = generateSocialPostsHtml(posts);
        socialPostsText = generateSocialPostsText(posts);
    }

    // Generate email content
    const { htmlContent, textContent } = await generateEmailContent({
        frequency,
        papers,
        statsHtml,
        statsText,
        socialPostsHtml,
        socialPostsText,
        since,
        to,
        recipientEmail
    });

    return {
        id: `digest-${Date.now()}`,
        recipientEmail,
        subject: generateSubject(frequency, papers.length, since),
        htmlContent,
        textContent,
        paperCount: papers.length,
        generatedAt: new Date(),
        attachments: pptAttachment ? [pptAttachment] : undefined
    };
}

function getDateRangeByFrequency(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
        case 'daily':
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case 'weekly':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'monthly':
            return new Date(now.setMonth(now.getMonth() - 1));
        default:
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
}

async function generateDigestStats(since: Date, to: Date): Promise<any> {
    const papers = await prisma.paper.findMany({
        where: {
            publicationDate: { gte: since, lte: to }
        },
        include: { tags: { include: { tag: true } } }
    });

    const sources = [...new Set(papers.map(p => p.source))];
    const allTags = papers.flatMap(p => p.tags.map((pt: any) => pt.tag.name));
    const uniqueTags = [...new Set(allTags)];

    const bySource: Record<string, number> = {};
    papers.forEach(p => {
        bySource[p.source] = (bySource[p.source] || 0) + 1;
    });

    const byTag: Record<string, number> = {};
    allTags.forEach(tag => {
        byTag[tag] = (byTag[tag] || 0) + 1;
    });

    const topTags = Object.entries(byTag)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

    return {
        totalPapers: papers.length,
        sources: sources.length,
        uniqueTags: uniqueTags.length,
        bySource,
        topTags
    };
}

function generateStatsHtml(stats: any): string {
    return `
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #1F4E78;">Digest Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div>
                    <p style="margin: 0; font-size: 14px; color: #666;">Total Papers</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1F4E78;">${stats.totalPapers}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 14px; color: #666;">Sources</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1F4E78;">${stats.sources}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 14px; color: #666;">Unique Topics</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #1F4E78;">${stats.uniqueTags}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 14px; color: #666;">Top Topics</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #1F4E78;">
                        ${stats.topTags.map((t: any) => t.tag).join(', ')}
                    </p>
                </div>
            </div>
        </div>
    `;
}

function generateStatsText(stats: any): string {
    return `
        ---
        Digest Statistics
        ---
        Total Papers: ${stats.totalPapers}
        Sources: ${stats.sources}
        Unique Topics: ${stats.uniqueTags}
        Top Topics: ${stats.topTags.map((t: any) => `${t.tag} (${t.count})`).join(', ')}
    `;
}

function generateSocialPostsHtml(posts: any[]): string {
    if (posts.length === 0) return '';

    return `
        <div style="background-color: #E8F4F8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #1F4E78;">Ready-to-Share Social Media Posts</h3>
            ${posts.map((post, i) => `
                <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 10px;">
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #666;">${post.platform} Post ${i + 1}</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333;">${post.content}</p>
                </div>
            `).join('')}
        </div>
    `;
}

function generateSocialPostsText(posts: any[]): string {
    if (posts.length === 0) return '';

    return `
        ---
        Ready-to-Share Social Media Posts
        ---
        ${posts.map((post, i) => `
            ${post.platform} Post ${i + 1}:
            ${post.content}
            ---
        `).join('\n')}
    `;
}

async function generateEmailContent(params: {
    frequency: string;
    papers: any[];
    statsHtml: string;
    statsText: string;
    socialPostsHtml: string;
    socialPostsText: string;
    since: Date;
    to: Date;
    recipientEmail: string;
}): Promise<{ htmlContent: string; textContent: string }> {
    const { frequency, papers, statsHtml, statsText, socialPostsHtml, socialPostsText, since, to, recipientEmail: _recipientEmail } = params;

    const papersHtml = papers.map((paper, i) => `
        <div style="border-bottom: 1px solid #e5e7eb; padding: 20px 0; ${i === papers.length - 1 ? 'border-bottom: none;' : ''}">
            <div style="margin-bottom: 10px;">
                <a href="${paper.url}" style="text-decoration: none; color: #1F4E78; font-size: 18px; font-weight: bold;">
                    ${paper.title}
                </a>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 10px; font-size: 12px; color: #666;">
                <span>${paper.source}</span>
                <span>•</span>
                <span>${formatDate(paper.publicationDate)}</span>
            </div>
            ${paper.tags && paper.tags.length > 0 ? `
                <div style="margin-bottom: 10px;">
                    ${paper.tags.slice(0, 4).map((pt: any) => `
                        <span style="display: inline-block; background-color: #1F4E78; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; margin-right: 5px; margin-bottom: 5px;">
                            ${pt.tag.name}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
            ${paper.abstract ? `
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #555;">
                    ${paper.abstract.substring(0, 300)}${paper.abstract.length > 300 ? '...' : ''}
                </p>
            ` : ''}
            ${paper.aiSummary ? `
                <div style="background-color: #E8F4F8; padding: 12px; border-radius: 6px; margin-top: 10px;">
                    <p style="margin: 0; font-size: 12px; font-weight: bold; color: #1F4E78; margin-bottom: 5px;">AI Perspective</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #333;">${paper.aiSummary}</p>
                </div>
            ` : paper.assessmentReason ? `
                <div style="background-color: #F0F7F0; padding: 12px; border-radius: 6px; margin-top: 10px;">
                    <p style="margin: 0; font-size: 12px; font-weight: bold; color: #2E7D32; margin-bottom: 5px;">Why Included</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #333;">${paper.assessmentReason.substring(0, 300)}${paper.assessmentReason.length > 300 ? '...' : ''}</p>
                </div>
            ` : ''}
        </div>
    `).join('');

    const papersText = papers.map((paper) => `
        ${paper.title}
        Source: ${paper.source} | ${formatDate(paper.publicationDate)}
        URL: ${paper.url}
        ${paper.abstract ? `Abstract: ${paper.abstract.substring(0, 200)}...` : ''}
        ---
    `).join('\n');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background-color: white; }
                .header { background-color: #1F4E78; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .header p { margin: 10px 0 0 0; opacity: 0.9; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
                a { color: #1F4E78; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Research Intelligence Digest</h1>
                    <p>${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Summary • ${formatDateRange(since, to)}</p>
                </div>
                
                ${statsHtml}
                
                <h2 style="margin: 30px 0 20px 0; color: #1F4E78;">Recent Papers (${papers.length})</h2>
                ${papersHtml}
                
                ${socialPostsHtml}
                
                <div class="footer">
                    <p>Generated by Research Copilot</p>
                    <p>Manage your preferences in the app</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const textContent = `
        Research Intelligence Digest
        ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Summary • ${formatDateRange(since, to)}
        ==========================================
        
        ${statsText}
        
        Recent Papers (${papers.length})
        =====================
        ${papersText}
        
        ${socialPostsText}
        
        ---
        Generated by Research Copilot
    `;

    return { htmlContent, textContent };
}

function generateSubject(frequency: string, paperCount: number, since: Date): string {
    const dateStr = since.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Research Digest: ${paperCount} papers since ${dateStr}`;
}

function formatDateRange(since: Date, to: Date): string {
    return `${since.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function sendEmailDigest(digest: EmailDigest): Promise<boolean> {
    // Placeholder for email sending
    // In production, this would integrate with:
    // - SendGrid
    // - AWS SES
    // - Nodemailer
    // - Or Outlook/Exchange for enterprise

    logger.debug(`Email Digest To: ${digest.recipientEmail}`);
    logger.debug(`Email Digest Subject: ${digest.subject}`);
    logger.debug(`Email Digest Papers: ${digest.paperCount}`);

    if (digest.attachments) {
        logger.debug(`Email Digest Attachments: ${digest.attachments.map(a => a.filename).join(', ')}`);
    }
    
    // Simulate successful send
    return true;
}

export async function scheduleDigest(config: DigestConfig): Promise<string> {
    // Placeholder for scheduling
    // In production, this would integrate with:
    // - Bull queue with scheduler
    // - AWS EventBridge
    // - Cron jobs

    logger.debug(`Schedule Digest Frequency: ${config.frequency}`);
    logger.debug(`Schedule Digest Recipient: ${config.recipientEmail}`);

    return `scheduled-${Date.now()}`;
}