import type {ButtonHTMLAttributes, ReactNode} from 'react';
import { cn } from '../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: 'border border-gold bg-gold text-white hover:bg-gold/90 hover:shadow-md',
    secondary: 'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
    ghost: 'border border-transparent bg-transparent text-ink hover:bg-accent',
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
            {...props}>
            {children}
        </button>
    );
}
