import type { ReactNode } from 'react';
import ApiErrorAlert from './ApiErrorAlert';
import EmptyStateMessage from './EmptyStateMessage';
import LoadingState from './LoadingState';

interface PageStateProps {
    loading: boolean;
    error: string | null;
    isEmpty: boolean;
    emptyMessage: string;
    loadingFallback?: ReactNode;
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
        return <>{loadingFallback ?? <LoadingState />}</>;
    }

    if (error) {
        return <ApiErrorAlert message={error} />;
    }

    if (isEmpty) {
        return <EmptyStateMessage message={emptyMessage} />;
    }

    return <>{children}</>;
}
