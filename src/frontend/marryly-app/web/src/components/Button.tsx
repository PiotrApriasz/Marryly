import type {ButtonHTMLAttributes, ReactNode} from 'react';
import LoadingSpinner from './LoadingSpinner';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: ReactNode;
    loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'border border-gold bg-gold text-white hover:bg-gold/90 hover:shadow-md',
    secondary: 'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
    ghost: 'border border-transparent bg-transparent text-ink hover:bg-accent',
    danger: 'border border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

export default function Button({
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    loading = false,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cn(
                'rounded-lg font-medium transition-all duration-300',
                'hover:scale-105 active:scale-95',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100',
                variantStyles[variant],
                sizeStyles[size],
                className
            )}
            disabled={disabled || loading}
            aria-busy={loading}
            {...props}>
            <span className="relative inline-flex items-center justify-center">
                {loading ? (
                    <>
                        <span className="invisible">{children}</span>
                        <span className="absolute inset-0 flex items-center justify-center">
                            <LoadingSpinner size="sm" className="text-current" />
                        </span>
                    </>
                ) : (
                    children
                )}
            </span>
        </button>
    );
}
