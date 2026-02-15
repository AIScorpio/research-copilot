'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <nav aria-label="Breadcrumb" className={cn('w-full', className)}>
            <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <li className="flex items-center gap-2">
                    <Link
                        href="/"
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        aria-label="Home"
                    >
                        <Home className="w-4 h-4" />
                    </Link>
                </li>
                
                {items.map((item, index) => (
                    <li key={item.href || index} className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground/50" />
                        {item.href ? (
                            <Link
                                href={item.href}
                                className="hover:text-foreground transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-foreground">{item.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

export default Breadcrumb;