import type { SelectHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    surface?: 'white' | 'muted';
}

export default function Select({
    className,
    surface = 'white',
    children,
    ...props
}: SelectProps) {
    return (
        <div className="field-select-shell">
            <select
                className={cn('field-control field-select', surface === 'muted' && 'field-control-muted', className)}
                {...props}
            >
                {children}
            </select>
            <span className="field-select-indicator" aria-hidden="true">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        </div>
    );
}
