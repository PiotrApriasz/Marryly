import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type CardPadding = 'md' | 'lg' | 'xl' | 'none';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    interactive?: boolean;
    padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
    none: '',
};

export default function Card({
    children,
    className,
    interactive = false,
    padding = 'lg',
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'surface-card',
                interactive && 'surface-card-hover',
                paddingClasses[padding],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
