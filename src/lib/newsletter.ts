import { prisma } from './db';
import { logger } from './logger';
import { generateTextWithFallback } from './llm-service';

export interface PaperForReport {
    title: string;
    abstract: string;
    source: string;
    url: string;
    tags: string[];
}

/**
 * Generates an AI-powered research newsletter report using Groq.
 */
export async function generateNewsletterReport(papers: PaperForReport[]): Promise<string> {
    if (papers.length === 0) return "No new research papers were collected in this session.";

    const paperContent = papers.map((p, i) =>
        `${i + 1}. **${p.title}** (${p.source})
        Tags: ${p.tags.join(', ')}
        Abstract: ${p.abstract.substring(0, 300)}...
        URL: ${p.url}`
    ).join('\n\n');

    const prompt = `You are a research bot specializing in AI and Banking. You just completed a collection session. 
    Below is a list of newly collected research papers. 
    
    Create a professional, highly readable newsletter digest titled "Research Copilot: Daily Intelligence Digest".
    
    Structure:
    1. **Executive Summary**: A 2-3 sentence overview of the collective focus of these papers.
    2. **Featured Insights**: Group the papers by 2-3 common themes (e.g., "Generative AI in Risk", "Network Optimization") and provide a one-paragraph technical synthesis of the findings in each theme.
    3. **Actionable Takeaways**: 3 bullet points on how a banking institution could use this new knowledge.
    
    Papers:
    ${paperContent}
    
    Format in Markdown. Be technical, precise, and professional.`;

    try {
        // Use LLM service with fallback support (Groq → Ollama)
        const content = await generateTextWithFallback(prompt);

        // Add Appendix
        const appendix = `\n\n---\n## 📚 Paper Sources Appendix\n\n` +
            papers.map(p => `- [${p.title}](${p.url}) *via ${p.source}*`).join('\n');

        return content + appendix;

    } catch (error) {
        logger.error('Newsletter Error generating report', { error });
        return "An error occurred while synthesizing the newsletter report.";
    }
}

/**
 * Simulates sending an email by logging it to the console.
 */
export async function sendNotificationEmail(to: string, subject: string, _content: string) {
    logger.debug(`EMAIL SERVICE Sending Notification to: ${to}, Subject: ${subject}`);

    return { success: true, message: "Email sent (simulation mode)" };
}

/**
 * Orchestrator: Fetches user preferences and sends reports if needed.
 */
export async function triggerCollectionAlerts(newPaperIds: string[]) {
    try {
        if (newPaperIds.length === 0) return;

        const dateCode = new Date().toISOString().split('T')[0]; // e.g. "2026-01-06"

        // Find existing log for today to see if we need an update
        const existingLog = await prisma.newsletterLog.findUnique({
            where: { dateCode },
            include: { papers: true }
        });

        // 1. Determine the cumulative list of papers for today
        let finalPaperIds: string[] = [...newPaperIds];
        if (existingLog) {
            const existingIds = existingLog.papers.map(p => p.id);
            // Deduplicate
            finalPaperIds = Array.from(new Set([...existingIds, ...newPaperIds]));
        }

        // 2. Fetch full paper data for the report
        const papers = await prisma.paper.findMany({
            where: { id: { in: finalPaperIds } },
            include: {
                tags: {
                    include: { tag: true }
                }
            }
        });

        const papersForReport: PaperForReport[] = papers.map(p => ({
            title: p.title,
            abstract: p.abstract || "",
            source: p.source,
            url: p.url,
            tags: p.tags.map(t => t.tag.name)
        }));

        // 3. Generate the report (Cumulative for the day)
        const newsletterReport = await generateNewsletterReport(papersForReport);

        // 4. Persistence: Create or Update the Daily Diary entry
        if (existingLog) {
            await prisma.newsletterLog.update({
                where: { dateCode },
                data: {
                    content: newsletterReport,
                    paperCount: finalPaperIds.length,
                    papers: {
                        set: finalPaperIds.map(id => ({ id }))
                    }
                }
            });
            logger.debug(`Alerts Updated Daily Diary for ${dateCode}`);
        } else {
            await prisma.newsletterLog.create({
                data: {
                    dateCode,
                    title: `Research Digest: ${dateCode}`,
                    content: newsletterReport,
                    paperCount: finalPaperIds.length,
                    type: "Newsletter",
                    papers: {
                        connect: finalPaperIds.map(id => ({ id }))
                    }
                }
            });
            logger.debug(`Alerts Created new Daily Diary for ${dateCode}`);
        }

        // 5. Notifications: Fetch all users and their subscribers
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { emailAlerts: true },
                    { newsletterAlerts: true }
                ]
            },
            include: { subscribers: true }
        });

        for (const user of users) {
            const targetEmails = [user.email, ...user.subscribers.map(s => s.email)];

            if (user.newsletterAlerts) {
                for (const email of targetEmails) {
                    await sendNotificationEmail(
                        email,
                        `Research Copilot: Daily Digest Update (${dateCode})`,
                        newsletterReport
                    );
                }
            } else if (user.emailAlerts) {
                // For immediate alerts, we just list the *new* ones found in this run
                const newPapers = papers.filter(p => newPaperIds.includes(p.id));
                const alertMsg = `New papers added to your library: \n\n` +
                    newPapers.map(p => `- ${p.title} (${p.source})`).join('\n');

                for (const email of targetEmails) {
                    await sendNotificationEmail(email, "Research Copilot: New Papers Alert", alertMsg);
                }
            }
        }
    } catch (error) {
        logger.error('Alerts Error triggering collection alerts', { error });
    }
}
