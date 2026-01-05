import { SearchResult } from './collector';

export interface ProcessedPaper extends SearchResult {
    suggestedTags: { name: string; type: 'Academic' | 'Industrial' }[];
}

export async function processPaper(paper: SearchResult): Promise<ProcessedPaper> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    const tags: { name: string; type: 'Academic' | 'Industrial' }[] = [];
    const text = (paper.title + " " + paper.abstract).toLowerCase();

    // Industrial Categories
    if (text.includes("compliance") || text.includes("aml") || text.includes("laundering")) {
        tags.push({ name: "AML Compliance & Control", type: "Industrial" });
    }
    if (text.includes("risk") || text.includes("credit") || text.includes("default")) {
        tags.push({ name: "Investment Risk Control", type: "Industrial" });
    }
    if (text.includes("fraud") || text.includes("detection")) {
        tags.push({ name: "Fraud Detection", type: "Industrial" });
    }
    if (text.includes("kyc") || text.includes("cdd") || text.includes("due diligence") || text.includes("onboarding")) {
        tags.push({ name: "eKYC & CDD", type: "Industrial" });
    }
    if (text.includes("portfolio") || text.includes("trading") || text.includes("asset")) {
        tags.push({ name: "Portfolio Optimization", type: "Industrial" });
    }
    if (text.includes("servicing") || text.includes("customer")) {
        tags.push({ name: "Customer Servicing", type: "Industrial" });
    }

    // Academic Categories
    if (text.includes("agent") || text.includes("autonomous") || text.includes("multi-agent")) {
        tags.push({ name: "Agent Designing", type: "Academic" });
        tags.push({ name: "Agentic AI Pipeline", type: "Academic" });
    }
    if (text.includes("llm") || text.includes("language model") || text.includes("gpt") || text.includes("bert")) {
        tags.push({ name: "LLM SFT", type: "Academic" });
    }
    if (text.includes("reinforcement") || text.includes("rl") || text.includes("q-network")) {
        tags.push({ name: "RLHF", type: "Academic" });
    }

    // Deduplicate tags
    const uniqueTags = tags.filter((tag, index, self) =>
        index === self.findIndex((t) => t.name === tag.name && t.type === tag.type)
    );

    return {
        ...paper,
        suggestedTags: uniqueTags,
    };
}
