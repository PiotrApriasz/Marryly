import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

interface DrawerProps {
    open: boolean;
    title: string;
    description?: string;
    children: ReactNode;
    onClose: () => void;
    className?: string;
}

export default function Drawer({
    open,
    title,
    description,
    children,
    onClose,
    className,
}: DrawerProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="drawer-root" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
            <button
                type="button"
                className="drawer-backdrop"
                aria-label="Zamknij panel"
                onClick={onClose}
            />
            <aside className={cn('drawer-panel', className)}>
                <div className="drawer-header">
                    <div>
                        <h2 id="drawer-title" className="font-serif text-2xl text-ink">{title}</h2>
                        {description ? (
                            <p className="mt-2 font-sans text-sm leading-6 text-muted">{description}</p>
                        ) : null}
                    </div>
                    <button type="button" className="drawer-close" onClick={onClose}>
                        Zamknij
                    </button>
                </div>
                <div className="drawer-body">
                    {children}
                </div>
            </aside>
        </div>
    );
}
