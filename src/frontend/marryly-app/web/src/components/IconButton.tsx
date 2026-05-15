import type { ButtonHTMLAttributes, ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { cn } from '../utils/cn';

type IconButtonTone = 'neutral' | 'danger';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    icon: ReactNode;
    tone?: IconButtonTone;
    loading?: boolean;
}

const toneClasses: Record<IconButtonTone, string> = {
    neutral: 'border-sand text-ink hover:border-gold hover:text-gold',
    danger: 'border-rose-200 text-rose-700 hover:border-rose-600 hover:bg-rose-50',
};

export default function IconButton({
    label,
    icon,
    tone = 'neutral',
    loading = false,
    className,
    disabled,
    ...props
}: IconButtonProps) {
    return (
        <button
            type="button"
            className={cn('icon-button', toneClasses[tone], className)}
            aria-label={label}
            title={label}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <LoadingSpinner size="sm" className="text-current" /> : icon}
        </button>
    );
}
