'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = DEFAULT_DURATION) => {
        const id = Math.random().toString(36).substring(2, 15);
        setToasts(prev => [...prev, { id, type, message, duration }]);
        
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function Toast({ toast }: { toast: Toast }) {
    const { removeToast } = useToast();

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            case 'info':
            default:
                return <Info className="w-5 h-5 text-blue-500" />;
        }
    };

    const getBgColor = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-900';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-900';
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200 text-blue-900';
        }
    };

    return (
        <div
            className={`flex items-center gap-3 p-4 rounded-lg border-2 shadow-lg animate-in slide-in-from-top-2 transition-all duration-300 ease-out ${getBgColor()}`}
            role="alert"
            aria-live="polite"
        >
            {getIcon()}
            <div className="flex-1">
                <p className="font-medium">{toast.message}</p>
            </div>
            <button
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Close notification"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const { toasts } = useToast();

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    );
}