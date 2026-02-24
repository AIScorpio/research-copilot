import { Paper, Tag, PaperTag, UserFavorite } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Paper, Tag, PaperTag, UserFavorite } from '@prisma/client';

// Tag DTOs
export interface TagDTO {
    name: string;
    category: string;
}

export interface CreateTagDTO {
    name: string;
    category: string;
}

// Paper DTOs
export interface CreatePaperDTO {
    title: string;
    abstract?: string;
    url: string;
    source: string;
    publicationDate: Date;
    aiSummary?: string;
}

export interface UpdatePaperDTO {
    title?: string;
    abstract?: string;
    publicationDate?: Date;
    aiSummary?: string;
}

// Pagination DTOs
export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    sector?: string;
    topic?: string;
}

export interface PaginatedPapers {
    papers: PaperWithTags[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Extended types with relations
export interface PaperWithTags extends Paper {
    tags: (PaperTag & { tag: Tag })[];
    favoritedBy?: UserFavorite[];
}

// Collection DTOs
export interface CollectionParams {
    query: string;
    horizon?: 'today' | 'week' | 'month' | 'year' | 'custom';
    dateFrom?: string;
    dateTo?: string;
    useAgent?: boolean;
}

export interface CollectionResult {
    success: boolean;
    message: string;
    newCount: number;
    totalFound: number;
    newPaperIds: string[];
}

export interface RawPaper {
    title: string;
    abstract: string;
    url: string;
    source: string;
    publicationDate: Date;
}

export interface ProcessedPaper extends RawPaper {
    suggestedTags: Array<{ name: string; category: string }>;
}

// Paper filter params
export interface PaperFilterParams {
    search?: string;
    sector?: string;
    topic?: string;
    sortBy?: 'publicationDate' | 'collectedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
}

// Favorite DTO
export interface FavoriteResult {
    favorited: boolean;
}

// User context (for future auth implementation)
export interface UserContext {
    userId: string;
    email: string;
}
