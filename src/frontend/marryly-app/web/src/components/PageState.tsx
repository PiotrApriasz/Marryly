import type { ReactNode } from 'react';
import ApiErrorAlert from './ApiErrorAlert';
import EmptyStateMessage from './EmptyStateMessage';

interface PageStateProps {
    loading: boolean;
    error: string | null;
    isEmpty: boolean;
    emptyMessage: string;
    loadingFallback: ReactNode;
    children: ReactNode;
}

export default function PageState({
    loading,
    error,
    isEmpty,
    emptyMessage,
    loadingFallback,
    children,
}: PageStateProps) {
    if (loading) {
        return <>{loadingFallback}</>;
    }

    if (error) {
        return <ApiErrorAlert message={error} />;
    }

    if (isEmpty) {
        return <EmptyStateMessage message={emptyMessage} />;
    }

    return <>{children}</>;
}
