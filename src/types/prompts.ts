/**
 * Shared prompt types for frontend and API
 * Used by Settings UI and API routes
 */

export interface PromptTemplates {
    queryOptimization: string;
    contentAssessment: string;
    summaryGeneration: string;
    tagSuggestion: string;
    digestGeneration: string;  // Simple string like other prompts
}
