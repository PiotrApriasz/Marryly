import type { ElementType, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    align?: 'center' | 'left';
    titleAs?: ElementType;
    className?: string;
    titleClassName?: string;
    descriptionClassName?: string;
}

export default function PageHeader({
    title,
    description,
    actions,
    align = 'center',
    titleAs: TitleTag = 'h1',
    className,
    titleClassName,
    descriptionClassName,
}: PageHeaderProps) {
    const isLeftAligned = align === 'left';

    return (
        <div className={cn('page-header', isLeftAligned && 'page-header-left', className)}>
            <TitleTag className={cn('page-title', titleClassName)}>
                {title}
            </TitleTag>
            <div className={cn('page-divider', isLeftAligned && 'page-divider-left')} />
            {description ? (
                <p className={cn('page-description', isLeftAligned && 'mx-0', descriptionClassName)}>
                    {description}
                </p>
            ) : null}
            {actions ? <div className="mt-8">{actions}</div> : null}
        </div>
    );
}
