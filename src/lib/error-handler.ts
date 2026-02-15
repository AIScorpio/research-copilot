/**
 * Standardized Error Handler
 * Provides consistent error responses across all API routes
 */

import { logger } from './logger';

export enum ErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export class AppError extends Error {
    constructor(
        public code: ErrorCode,
        public message: string,
        public statusCode: number = 500,
        public details?: any
    ) {
        super(message);
        this.name = 'AppError';
    }
}

/**
 * Create standardized error response
 */
export function handleError(error: unknown): {
    success: false;
    error: string;
    code?: string;
    details?: any;
    statusCode: number;
} {
    logger.error('Error Handler', { error });

    // Log full error for debugging
    if (error instanceof Error) {
        logger.error('Error stack', { stack: error.stack });
    }

    // Handle known error types
    if (error instanceof AppError) {
        return {
            success: false,
            error: error.message,
            code: error.code,
            statusCode: error.statusCode,
            details: error.details
        };
    }

    // Handle validation errors (Zod)
    if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as any;
        return {
            success: false,
            error: 'Validation failed: ' + zodError.issues.map((e: any) => e.message).join(', '),
            code: ErrorCode.VALIDATION_ERROR,
            statusCode: 400,
            details: zodError.issues
        };
    }

    // Handle Prisma errors
    if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as any;
        const prismaErrorMessages: Record<string, string> = {
            P2002: 'Database connection failed',
            P2003: 'Foreign key constraint failed',
            P2025: 'Unique constraint failed',
            P2014: 'Record not found',
        };

        return {
            success: false,
            error: prismaErrorMessages[prismaError.code] || 'Database error',
            code: ErrorCode.DATABASE_ERROR,
            statusCode: 500,
            details: { prismaCode: prismaError.code }
        };
    }

    // Default error handling
    return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500
    };
}

/**
 * Create validation error
 */
export function createValidationError(message: string, details?: any): AppError {
    return new AppError(
        ErrorCode.VALIDATION_ERROR,
        message,
        400,
        details
    );
}

/**
 * Create not found error
 */
export function createNotFoundError(resource: string): AppError {
    return new AppError(
        ErrorCode.NOT_FOUND,
        `${resource} not found`,
        404
    );
}

/**
 * Create unauthorized error
 */
export function createUnauthorizedError(message: string = 'Unauthorized'): AppError {
    return new AppError(
        ErrorCode.UNAUTHORIZED,
        message,
        401
    );
}

/**
 * Create database error
 */
export function createDatabaseError(message: string): AppError {
    return new AppError(
        ErrorCode.DATABASE_ERROR,
        message,
        500
    );
}

/**
 * Create external service error (for API calls to external services)
 */
export function createExternalServiceError(service: string, message: string): AppError {
    return new AppError(
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `${service}: ${message}`,
        502 // Bad Gateway
    );
}

/**
 * Log error with context
 */
export function logError(context: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    const errorDetails = {
        timestamp,
        context,
        error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : error
    };

    logger.error(JSON.stringify(errorDetails, null, 2));
}

/**
 * Async wrapper for error handling
 */
export async function withErrorHandling<T>(
    context: string,
    operation: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        logError(context, error);
        throw error;
    }
}
