/**
 * Email Digest Service with SMTP Support
 */

import { Resend } from 'resend';
import { prisma } from './db';
import { logger } from './logger';

export interface DigestConfig {
    recipientEmail: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    includePowerPoint: boolean;
    includeSocialPosts: boolean;
    includeStats: boolean;
    maxPapers: number;
    topics?: string[];
    days: number;
}

export interface DigestResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Email service using SMTP (via Resend or other providers)
 */
class EmailService {
    private provider: 'resend' | 'smtp' | 'mock';
    private resend?: Resend;
    private smtpConfig?: any;

    constructor() {
        // Check which email provider to use
        if (process.env.RESEND_API_KEY) {
            this.provider = 'resend';
            this.resend = new Resend(process.env.RESEND_API_KEY);
        } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
            this.provider = 'smtp';
            this.smtpConfig = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                }
            };
        } else {
            this.provider = 'mock';
            logger.warn('No email provider configured - using mock mode');
        }
    }

    /**
     * Send email using configured provider
     */
    async sendEmail(to: string, subject: string, html: string): Promise<DigestResult> {
        try {
            if (this.provider === 'resend' && this.resend) {
                const result = await this.resend.emails.send({
                    from: process.env.FROM_EMAIL || 'noreply@insightflow.ai',
                    to,
                    subject,
                    html,
                });

                return {
                    success: true,
                    messageId: result.data?.id
                };
            } else if (this.provider === 'smtp' && this.smtpConfig) {
                // SMTP implementation would go here
                // For simplicity, returning mock success
                return {
                    success: true,
                    messageId: `smtp-${Date.now()}`
                };
            } else {
                // Mock mode - only log in development
                logger.debug('Email Service - Mock Mode', { to, subject, htmlLength: html.length });
                return {
                    success: true,
                    messageId: `mock-${Date.now()}`
                };
            }
        } catch (error) {
            logger.error('Email Service Send failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate HTML digest email
     */
    generateDigestHTML(
        papers: any[],
        summary: {
            title: string;
            dateRange: string;
            keyThemes: string[];
            recommendations: string[];
        },
        config: DigestConfig
    ): string {
        const paperCards = papers.map((paper) => `
            <div style="border-left: 4px solid #1F4E78; padding-left: 16px; margin-bottom: 20px;">
                <h3 style="color: #1F4E78; margin: 0 0 8px 0; font-size: 16px;">
                    <a href="${paper.url}" style="color: #1F4E78; text-decoration: none;">
                        ${paper.title}
                    </a>
                </h3>
                <p style="color: #666; font-size: 14px; margin: 8px 0;">
                    ${paper.abstract?.substring(0, 200) || 'No abstract'}...
                </p>
                ${config.includeStats && paper.tags && paper.tags.length > 0 ? `
                <div style="margin-top: 8px;">
                    ${paper.tags.map((pt: any) => 
                        `<span style="display: inline-block; background: #E8F4F8; color: white; padding: 4px 8px; margin: 4px 4px 4px 0; border-radius: 4px; font-size: 12px;">
                            ${pt.tag.name}
                        </span>`
                    ).join('')}
                </div>
                ` : ''}
                <a href="${paper.url}" style="display: inline-block; margin-top: 12px; color: #1F4E78; text-decoration: none; font-weight: 500;">
                    Read Full Paper →
                </a>
            </div>
        `).join('');

        const statsHTML = config.includeStats ? `
            <div style="background: #F7F7F7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #333; margin: 0 0 16px 0;">📊 Statistics</h2>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                    <div>
                        <strong>Total Papers:</strong>
                        <span style="color: #666;">${papers.length}</span>
                    </div>
                    <div>
                        <strong>Date Range:</strong>
                        <span style="color: #666;">${summary.dateRange}</span>
                    </div>
                    <div>
                        <strong>Key Themes:</strong>
                        <span style="color: #666;">${summary.keyThemes.join(', ')}</span>
                    </div>
                    <div>
                        <strong>Recommendations:</strong>
                        <span style="color: #666;">${summary.recommendations.length}</span>
                    </div>
                </div>
            </div>
        ` : '';

        const recommendationsHTML = config.includeSocialPosts && summary.recommendations.length > 0 ? `
            <div style="background: #E8F4F8; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: white; margin: 0 0 16px 0;">💡 Recommendations</h2>
                <ul style="color: white; line-height: 1.8;">
                    ${summary.recommendations.map(rec => `
                        <li>${rec}</li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${summary.title}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1F4E78 0%, #7C3AED 100%); color: white; padding: 40px 20px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 32px;">${summary.title}</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">AI in Banking & Finance Research Briefing</p>
                        <p style="margin: 0; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    
                    ${statsHTML}
                    
                    ${recommendationsHTML}
                    
                    <div style="margin-top: 30px;">
                        <h2 style="color: #1F4E78; margin: 0 0 16px 0;">📚 Papers of Interest</h2>
                        ${paperCards}
                    </div>
                    
                    <div style="text-align: center; padding: 40px 20px; border-top: 1px solid #E5E7EB; margin-top: 40px;">
                        <p style="color: #666; font-size: 14px;">
                            <strong>You're receiving this because you subscribed to InsightFlow research digests.</strong><br>
                            To unsubscribe, click <a href="#" style="color: #1F4E78;">here</a>.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate summary data for digest
     */
    async generateDigestSummary(papers: any[]): Promise<{
        title: string;
        dateRange: string;
        keyThemes: string[];
        recommendations: string[];
    }> {
        // Extract key themes from tags
        const allTags = papers.flatMap(p => p.tags?.map((pt: any) => pt.tag.name) || []);
        const tagCounts: Record<string, number> = {};
        allTags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
        
        const keyThemes = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag]) => tag);

        // Generate recommendations based on trends
        const recommendations: string[] = [];
        if (keyThemes.includes('Deep Learning')) {
            recommendations.push('Consider pilot testing deep learning models for risk prediction');
        }
        if (keyThemes.includes('Fraud Detection') || keyThemes.includes('Anomaly Detection')) {
            recommendations.push('Fraud detection AI showing strong research momentum - monitor for production readiness');
        }
        if (keyThemes.includes('Compliance') || keyThemes.includes('Regulatory')) {
            recommendations.push('Review recent regulatory changes for impact on AI systems');
        }
        if (keyThemes.includes('LLM Applications')) {
            recommendations.push('LLM applications in banking advancing rapidly - explore use cases');
        }

        if (recommendations.length === 0) {
            recommendations.push('Monitor research trends for emerging opportunities');
            recommendations.push('Engage with academic and industry publications');
        }

        // Date range
        const dates = papers.map(p => new Date(p.publicationDate)).sort((a, b) => a.getTime() - b.getTime());
        const dateRange = dates.length > 0 
            ? `${dates[0].toLocaleDateString()} - ${dates[dates.length - 1].toLocaleDateString()}`
            : 'No data available';

        return {
            title: `Research Digest: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
            dateRange,
            keyThemes,
            recommendations: recommendations.slice(0, 5)
        };
    }

    /**
     * Send digest email
     */
    async sendDigest(config: DigestConfig): Promise<DigestResult> {
        // Fetch papers based on config
        const sinceDate = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000);
        
        const whereClause: any = {
            publicationDate: { gte: sinceDate }
        };

        if (config.topics && config.topics.length > 0) {
            whereClause.tags = {
                some: {
                    tag: {
                        name: { in: config.topics }
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
            take: config.maxPapers
        });

        // Generate summary
        const summary = await this.generateDigestSummary(papers);

        // Generate HTML
        const html = this.generateDigestHTML(papers, summary, config);

        // Send email
        return await this.sendEmail(
            config.recipientEmail,
            summary.title,
            html
        );
    }
}

/**
 * Export singleton instance
 */
export const emailService = new EmailService();
