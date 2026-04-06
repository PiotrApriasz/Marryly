import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type NoticeTone = 'error' | 'warning' | 'success' | 'info';

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
    tone: NoticeTone;
    heading?: ReactNode;
    children: ReactNode;
    contentClassName?: string;
}

const toneClasses: Record<NoticeTone, string> = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export default function Notice({
    tone,
    heading,
    children,
    className,
    contentClassName,
    ...props
}: NoticeProps) {
    return (
        <div className={cn('notice', toneClasses[tone], className)} {...props}>
            {heading ? <p className="notice-title">{heading}</p> : null}
            <div className={cn('notice-body', !heading && 'mt-0', contentClassName)}>{children}</div>
        </div>
    );
}
