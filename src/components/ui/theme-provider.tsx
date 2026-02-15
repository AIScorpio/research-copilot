'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useLayoutEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
    children, 
    attribute = 'class',
    defaultTheme = 'system',
    enableSystem = true,
    disableTransitionOnChange = false
}: {
    children: ReactNode;
    attribute?: string;
    defaultTheme?: Theme;
    enableSystem?: boolean;
    disableTransitionOnChange?: boolean;
}) {
    const [theme, setThemeState] = useState<Theme>(defaultTheme);

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') as Theme;
        if (storedTheme) {
            setThemeState(storedTheme);
        }
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        
        if (theme === 'system' && enableSystem) {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
            
            root.setAttribute(attribute, systemTheme);
        } else {
            root.setAttribute(attribute, theme);
        }

        if (theme !== 'system') {
            localStorage.setItem('theme', theme);
        }

        if (!disableTransitionOnChange) {
            root.classList.add('theme-changing');
            setTimeout(() => {
                root.classList.remove('theme-changing');
            }, 0);
        }
    }, [theme, attribute, enableSystem, disableTransitionOnChange]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const toggleTheme = () => {
        setThemeState(prev => {
            if (prev === 'dark') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}