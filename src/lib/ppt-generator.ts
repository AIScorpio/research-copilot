import PptxGenJS from 'pptxgenjs';

export interface Paper {
    id: string;
    title: string;
    abstract?: string | null;
    url: string;
    source: string;
    publicationDate: Date | string;
    tags?: Array<{ id: string; name: string; type: string }>;
    aiSummary?: string | null;
    assessmentReason?: string | null;
}

export interface PowerPointExportOptions {
    title?: string;
    subtitle?: string;
    author?: string;
    maxPapers?: number;
    includeAbstract?: boolean;
    includeSummary?: boolean;
    includeTags?: boolean;
}

export async function generatePowerPoint(
    papers: Paper[],
    options: PowerPointExportOptions = {}
): Promise<Buffer> {
    const {
        title = 'Research Intelligence Briefing',
        subtitle = 'AI in Banking & Finance',
        author = 'Research Copilot',
        maxPapers = 10,
        includeAbstract = true,
        includeSummary = true,
        includeTags = true
    } = options;

    const selectedPapers = papers.slice(0, maxPapers);
    const pptx = new PptxGenJS();

    // Presentation metadata
    pptx.title = title;
    pptx.subject = subtitle;
    pptx.author = author;

    // Title Slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: '1F4E78' };
    titleSlide.addText(title, {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
    });
    titleSlide.addText(subtitle, {
        x: 0.5,
        y: 3.0,
        w: '90%',
        h: 0.8,
        fontSize: 24,
        color: 'FFFFFF',
        align: 'center'
    });
    titleSlide.addText(`Generated: ${new Date().toLocaleDateString()}`, {
        x: 0.5,
        y: 4.5,
        w: '90%',
        fontSize: 14,
        color: 'FFFFFF',
        align: 'center'
    });

    // Executive Summary Slide
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: 'F7F7F7' };
    summarySlide.addText('Executive Summary', {
        x: 0.5,
        y: 0.5,
        w: '90%',
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: '1F4E78'
    });

    const summaryContent = [
        `Total Papers Reviewed: ${selectedPapers.length}`,
        `Date Range: ${getDateRange(selectedPapers)}`,
        `Key Themes: ${getKeyThemes(selectedPapers)}`,
        `Insights: ${selectedPapers.filter(p => p.aiSummary || p.assessmentReason).length} AI-analyzed papers`
    ];

    summaryContent.forEach((text, i) => {
        summarySlide.addText(text, {
            x: 0.5,
            y: 1.5 + (i * 0.7),
            w: '90%',
            h: 0.6,
            fontSize: 18,
            color: '000000',
            bullet: true
        });
    });

    // Paper Slides
    for (const paper of selectedPapers) {
        const slide = pptx.addSlide();
        
        slide.addText(paper.title, {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1.2,
            fontSize: 20,
            bold: true,
            color: '1F4E78'
        });

        // Source and Date
        slide.addText(`${paper.source} | ${formatDate(paper.publicationDate)}`, {
            x: 0.5,
            y: 1.8,
            w: '90%',
            fontSize: 12,
            italic: true,
            color: '666666'
        });

        let currentY = 2.4;

        if (includeTags && paper.tags && paper.tags.length > 0) {
            const tagText = paper.tags.map(t => t.name).join(' | ');
            slide.addText(tagText, {
                x: 0.5,
                y: currentY,
                w: '90%',
                fontSize: 11,
                color: '1F4E78',
                bold: true
            });
            currentY += 0.6;
        }

        if (includeSummary && (paper.aiSummary || paper.assessmentReason)) {
            const summaryLabel = paper.aiSummary ? 'AI Summary:' : 'Why Included:';
            const summaryText = paper.aiSummary || paper.assessmentReason;
            
            slide.addText(summaryLabel, {
                x: 0.5,
                y: currentY,
                w: '90%',
                fontSize: 14,
                bold: true,
                color: '000000'
            });
            currentY += 0.5;

            const summaryLines = wrapText(summaryText!, 90);
            summaryLines.forEach((line, i) => {
                if (currentY + (i * 0.4) < 6.5) {
                    slide.addText(line, {
                        x: 0.5,
                        y: currentY + (i * 0.4),
                        w: '90%',
                        fontSize: 12,
                        color: '333333'
                    });
                }
            });
        } else if (includeAbstract && paper.abstract) {
            slide.addText('Abstract:', {
                x: 0.5,
                y: currentY,
                w: '90%',
                fontSize: 14,
                bold: true,
                color: '000000'
            });
            currentY += 0.5;

            const abstractLines = wrapText(paper.abstract, 80);
            abstractLines.forEach((line, i) => {
                if (currentY + (i * 0.4) < 6.5) {
                    slide.addText(line, {
                        x: 0.5,
                        y: currentY + (i * 0.4),
                        w: '90%',
                        fontSize: 12,
                        color: '333333'
                    });
                }
            });
        }

        slide.addText('View Paper:', {
            x: 0.5,
            y: 7.0,
            fontSize: 11,
            bold: true,
            color: '1F4E78'
        });
        slide.addText(paper.url, {
            x: 0.5,
            y: 7.3,
            w: '90%',
            fontSize: 10,
            color: '1F4E78',
            hyperlink: { url: paper.url }
        });
    }

    // Recommendations Slide
    const recsSlide = pptx.addSlide();
    recsSlide.background = { color: 'E8F4F8' };
    recsSlide.addText('Recommendations & Next Steps', {
        x: 0.5,
        y: 0.5,
        w: '90%',
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: '1F4E78'
    });

    const recommendations = generateRecommendations(selectedPapers);
    recommendations.forEach((rec, i) => {
        recsSlide.addText(rec, {
            x: 0.5,
            y: 1.5 + (i * 0.7),
            w: '90%',
            h: 0.6,
            fontSize: 16,
            color: '000000',
            bullet: true
        });
    });

    // Thank You Slide
    const endSlide = pptx.addSlide();
    endSlide.background = { color: '1F4E78' };
    endSlide.addText('Questions?', {
        x: 0.5,
        y: 2.5,
        w: '90%',
        fontSize: 48,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
    });
    endSlide.addText('Thank You', {
        x: 0.5,
        y: 3.5,
        w: '90%',
        fontSize: 36,
        bold: true,
        color: 'FFFFFF',
        align: 'center'
    });

    // Generate buffer
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return buffer as Buffer;
}

function getDateRange(papers: Paper[]): string {
    if (papers.length === 0) return 'N/A';
    
    const dates = papers.map(p => new Date(p.publicationDate)).sort((a, b) => a.getTime() - b.getTime());
    const start = formatDate(dates[0]);
    const end = formatDate(dates[dates.length - 1]);
    
    return `${start} - ${end}`;
}

function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getKeyThemes(papers: Paper[]): string {
    if (papers.length === 0) return 'None identified';
    
    const allTags = papers
        .flatMap(p => p.tags?.map(t => t.name) || [])
        .filter((tag, i, arr) => arr.indexOf(tag) === i);
    
    const topThemes = allTags.slice(0, 5).join(', ');
    return topThemes || 'Various topics';
}

function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + word).length <= maxChars) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.slice(0, 12); // Max 12 lines per slide
}

function generateRecommendations(papers: Paper[]): string[] {
    const recs: string[] = [];

    const highTechPapers = papers.filter(p => 
        p.tags?.some(t => ['Deep Learning', 'LLM Applications', 'Graph Neural Networks'].includes(t.name))
    );
    
    if (highTechPapers.length >= 2) {
        recs.push('Consider pilot for advanced AI technologies with multiple research papers');
    }

    const riskPapers = papers.filter(p =>
        p.tags?.some(t => ['Credit Risk', 'Fraud Detection', 'Cyber Risk'].includes(t.name))
    );
    
    if (riskPapers.length >= 3) {
        recs.push('Risk-focused AI applications show strong research momentum');
    }

    const recentHighActivity = papers.filter(p => {
        const pubDate = new Date(p.publicationDate);
        const daysSince = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < 30;
    });

    if (recentHighActivity.length >= 5) {
        recs.push('Rapidly evolving landscape - schedule quarterly reviews');
    }

    if (recs.length < 3) {
        recs.push('Monitor research trends for emerging opportunities');
        recs.push('Engage with academic and industry publications');
    }

    return recs;
}