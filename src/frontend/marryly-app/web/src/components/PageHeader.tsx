import type { ElementType, ReactNode } from 'react';
import HelpTooltip from './HelpTooltip';
import { cn } from '../utils/cn';

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    helpText?: ReactNode;
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
    helpText,
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
            <div className={cn('page-title-row', isLeftAligned && 'page-title-row-left')}>
                <TitleTag className={cn('page-title', titleClassName)}>
                    {title}
                </TitleTag>
                {helpText ? <HelpTooltip content={helpText} /> : null}
            </div>
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
