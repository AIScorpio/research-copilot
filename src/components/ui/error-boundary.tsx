'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ error });
        
        console.error('[Error Boundary] Caught error:', error, errorInfo);
        
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-background p-6">
                    <div className="max-w-md w-full space-y-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                        </div>
                        
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Something went wrong
                        </h1>
                        
                        <p className="text-muted-foreground mb-6">
                            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                        </p>
                        
                        <div className="space-y-3">
                            <Button onClick={this.handleReset} className="w-full">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                            If the problem persists, please contact support.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}