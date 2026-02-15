import { prisma } from './db';
import { logger } from './logger';

export interface SocialMediaPost {
    platform: 'LinkedIn' | 'Twitter' | 'X';
    content: string;
    hashtags: string[];
    url?: string;
    emoji?: string[];
    estimatedReach?: string;
    tone: 'professional' | 'casual' | 'thought-leadership';
}

export interface Paper {
    title: string;
    abstract?: string | null;
    url: string;
    tags?: Array<{ tag: { name: string } }>;
    publicationDate: Date | string;
}

export async function generateSocialMediaPosts(
    paperIds?: string[],
    platform: 'LinkedIn' | 'Twitter' | 'X' = 'LinkedIn',
    count: number = 1
): Promise<SocialMediaPost[]> {
    let papers: Paper[];

    if (paperIds && paperIds.length > 0) {
        const dbPapers = await prisma.paper.findMany({
            where: { id: { in: paperIds } },
            include: { tags: { include: { tag: true } } }
        });
        papers = dbPapers;
    } else {
        const recentPapers = await prisma.paper.findMany({
            where: {
                publicationDate: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            },
            include: { tags: { include: { tag: true } } },
            orderBy: { publicationDate: 'desc' },
            take: 10
        });
        papers = recentPapers;
    }

    const posts: SocialMediaPost[] = [];

    for (const paper of papers) {
        if (posts.length >= count) break;

        const post = generatePostForPaper(paper, platform);
        if (post) {
            posts.push(post);
        }
    }

    return posts;
}

function generatePostForPaper(paper: Paper, targetPlatform: 'LinkedIn' | 'Twitter' | 'X'): SocialMediaPost | null {
    const topics = paper.tags?.map(t => t.tag.name) || [];
    const isBankingRelated = topics.some(t => 
        ['Credit Risk', 'Fraud Detection', 'AML', 'Compliance', 'Regulatory'].some(k => t.includes(k))
    );

    if (targetPlatform === 'Twitter' || targetPlatform === 'X') {
        return generateTwitterPost(paper, topics, isBankingRelated);
    }

    return generateLinkedInPost(paper, topics, isBankingRelated);
}

function generateTwitterPost(paper: Paper, topics: string[], isBankingRelated: boolean): SocialMediaPost {
    const maxLength = 280;
    let content = '';

    const hooks = [
        '🚀 New research: ',
        '📢 Interesting paper: ',
        '💡 Check this out: ',
        '🤖 AI research: ',
        '📊 Just read: '
    ];

    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    content += hook;

    const titleTruncated = truncateText(paper.title, 100);
    content += `${titleTruncated}\n\n`;

    if (paper.abstract && paper.abstract.length > 0) {
        const insight = extractInsight(paper.abstract, 80);
        if (insight) {
            content += `${insight}\n\n`;
        }
    }

    content += `📄 ${paper.url}`;

    const hashtags = generateHashtags(topics, 'Twitter', isBankingRelated);
    if (hashtags.length > 0) {
        content += '\n\n';
        content += hashtags.join(' ');
    }

    content = truncateText(content, maxLength);

    return {
        platform: 'Twitter',
        content,
        hashtags,
        url: paper.url,
        emoji: extractEmojis(content),
        estimatedReach: '1K-5K',
        tone: 'casual'
    };
}

function generateLinkedInPost(paper: Paper, topics: string[], isBankingRelated: boolean): SocialMediaPost {
    let content = '';

    if (isBankingRelated) {
        content += '🏦 #Finance & #AI in Banking\n\n';
    } else {
        content += '🔬 #Research & #Innovation\n\n';
    }

    content += `📌 **${paper.title}**\n\n`;

    if (paper.abstract && paper.abstract.length > 0) {
        const summary = summarizeAbstract(paper.abstract, 150);
        content += `📝 ${summary}\n\n`;
    }

    content += '💡 Key Insights:\n';
    const insights = generateInsights(paper, topics);
    insights.forEach(insight => {
        content += `• ${insight}\n`;
    });

    content += '\n';

    if (isBankingRelated) {
        content += '🎯 This could impact:\n';
        const impacts = ['Risk Management', 'Compliance', 'Customer Experience', 'Operational Efficiency'];
        impacts.slice(0, 2).forEach(impact => {
            content += `• ${impact}\n`;
        });
    } else {
        content += '🔍 Why this matters:\n';
        content += '• Advancing state-of-the-art\n';
        content += '• Practical applications possible\n';
    }

    content += '\n';
    content += '🔗 Read the full paper:\n';
    content += paper.url;

    const hashtags = generateHashtags(topics, 'LinkedIn', isBankingRelated);
    if (hashtags.length > 0) {
        content += '\n\n';
        content += hashtags.join(' ');
    }

    content += '\n\n';
    content += '🔔 Follow for more AI & research updates';

    return {
        platform: 'LinkedIn',
        content,
        hashtags,
        url: paper.url,
        emoji: extractEmojis(content),
        estimatedReach: '5K-20K',
        tone: 'professional'
    };
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

function extractInsight(abstract: string, maxLength: number): string | null {
    if (!abstract) return null;

    const sentences = abstract.split(/[.!?]/);
    const insightfulSentences = sentences.filter(s => {
        const lower = s.toLowerCase();
        return lower.includes('improves') ||
               lower.includes('achieves') ||
               lower.includes('demonstrates') ||
               lower.includes('shows') ||
               lower.includes('novel') ||
               lower.includes('effective');
    });

    if (insightfulSentences.length > 0) {
        return truncateText(insightfulSentences[0].trim(), maxLength);
    }

    return truncateText(sentences[0].trim(), maxLength);
}

function summarizeAbstract(abstract: string, maxLength: number): string {
    const sentences = abstract.split(/[.!?]/);
    const summary = sentences.slice(0, 3).join('. ');
    return truncateText(summary, maxLength);
}

function generateInsights(paper: Paper, topics: string[]): string[] {
    const insights: string[] = [];

    if (topics.includes('Deep Learning')) {
        insights.push('Leverages deep learning for improved performance');
    }

    if (topics.includes('NLP')) {
        insights.push('Advanced natural language processing capabilities');
    }

    if (topics.includes('Fraud Detection') || topics.includes('Credit Risk')) {
        insights.push('Addresses critical banking challenges');
    }

    if (paper.abstract) {
        const hasNovelty = paper.abstract.toLowerCase().includes('novel') ||
                          paper.abstract.toLowerCase().includes('innovative') ||
                          paper.abstract.toLowerCase().includes('new approach');
        if (hasNovelty) {
            insights.push('Novel approach to the problem');
        }
    }

    if (insights.length === 0) {
        insights.push('Promising research direction');
        insights.push('Potential practical applications');
    }

    return insights.slice(0, 3);
}

function generateHashtags(
    topics: string[],
    platform: 'LinkedIn' | 'Twitter' | 'X',
    isBankingRelated: boolean
): string[] {
    const hashtags: string[] = [];

    if (isBankingRelated) {
        hashtags.push('#AI', '#Banking', '#Fintech', '#Finance');
    } else {
        hashtags.push('#AI', '#Research', '#MachineLearning', '#AcademicResearch');
    }

    const topicTags = topics
        .filter(t => t.length < 20 && !t.includes(' '))
        .map(t => `#${t.replace(/\s+/g, '')}`);

    hashtags.push(...topicTags.slice(0, 3));

    const platformSpecific = platform === 'LinkedIn'
        ? ['#Innovation', '#ThoughtLeadership']
        : ['#AIResearch', '#DeepLearning'];

    hashtags.push(...platformSpecific.slice(0, 2));

    return [...new Set(hashtags)].slice(0, 10);
}

function extractEmojis(text: string): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? [...new Set(matches)] : [];
}

export async function saveSocialMediaDrafts(posts: SocialMediaPost[]): Promise<void> {
    for (const post of posts) {
        logger.debug(`Social Media Draft ${post.platform}: ${post.content.substring(0, 100)}...`);
    }
}