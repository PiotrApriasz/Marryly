import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface FieldProps {
    label: string;
    htmlFor: string;
    children: ReactNode;
    className?: string;
    labelClassName?: string;
    labelTone?: 'default' | 'strong';
}

export default function Field({
    label,
    htmlFor,
    children,
    className,
    labelClassName,
    labelTone = 'default',
}: FieldProps) {
    return (
        <div className={className}>
            <label
                htmlFor={htmlFor}
                className={cn(
                    'field-label',
                    labelTone === 'strong' && 'field-label-strong',
                    labelClassName
                )}
            >
                {label}
            </label>
            {children}
        </div>
    );
}
