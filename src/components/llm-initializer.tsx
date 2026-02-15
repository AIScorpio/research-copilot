'use client';

import { useEffect } from 'react';

/**
 * LLM Initializer - Client component to initialize LLM system
 * 
 * NOTE: Direct database access is not available in client components.
 * LLM initialization is handled via API routes on the server side.
 * This component ensures the API is called to initialize LLM providers.
 */
export function LLMInitializer() {
    useEffect(() => {
        // Call API to ensure LLM providers are initialized
        // This is a lightweight ping to trigger server-side initialization
        fetch('/api/llm-init', { method: 'POST' })
            .catch(() => {
                // Silent fail - API routes will initialize on first use
            });
    }, []);

    return null;
}
