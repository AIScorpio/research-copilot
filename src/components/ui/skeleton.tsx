'use client';

import { memo, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'text' | 'circular' | 'card';
    className?: string;
}

export const Skeleton = memo(function Skeleton({ 
    className, 
    variant = 'default', 
    ...props 
}: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse',
                'rounded-md',
                'bg-muted',
                variant === 'default' && 'h-4 w-full',
                variant === 'text' && 'h-4 w-full',
                variant === 'circular' && 'h-10 w-10 rounded-full',
                variant === 'card' && 'h-24 w-full rounded-lg',
                className
            )}
            {...props}
        />
    );
});

Skeleton.displayName = 'Skeleton';