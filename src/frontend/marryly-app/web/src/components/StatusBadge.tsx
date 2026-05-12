import { cn } from '../utils/cn';

type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
    label: string;
    tone?: StatusBadgeTone;
    className?: string;
}

const toneClasses: Record<StatusBadgeTone, string> = {
    neutral: 'border-sand bg-sand/50 text-ink',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
};

export default function StatusBadge({
    label,
    tone = 'neutral',
    className,
}: StatusBadgeProps) {
    return (
        <span className={cn('status-badge', toneClasses[tone], className)}>
            {label}
        </span>
    );
}
