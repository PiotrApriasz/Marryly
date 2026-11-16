import { useEffect, useRef, type RefObject } from 'react';
import Button from './Button';
import Notice from './Notice';

interface InfiniteLoadMoreProps {
    hasMore: boolean;
    loading: boolean;
    onLoadMore: () => void | Promise<void>;
    label: string;
    itemCount: number;
    error?: string | null;
    scrollRootRef?: RefObject<HTMLElement | null>;
}

export default function InfiniteLoadMore({
    hasMore,
    loading,
    onLoadMore,
    label,
    itemCount,
    error,
    scrollRootRef,
}: InfiniteLoadMoreProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const requestedItemCountRef = useRef<number | null>(null);

    useEffect(() => {
        const node = sentinelRef.current;

        if (!node || !hasMore || loading || error) {
            return;
        }

        const root = scrollRootRef?.current ?? null;
        const prefetchDistance = Math.max(1200, (root?.clientHeight ?? window.innerHeight) * 2);
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;

            if (!entry) {
                return;
            }

            if (!entry.isIntersecting) {
                requestedItemCountRef.current = null;
                return;
            }

            // Recheck after a page extends the grid, including when a short page
            // still leaves the end nearby. No progress must not cause a retry loop.
            if (requestedItemCountRef.current !== itemCount) {
                requestedItemCountRef.current = itemCount;
                void onLoadMore();
            }
        }, {
            root,
            rootMargin: `0px 0px ${prefetchDistance}px 0px`,
        });

        observer.observe(node);

        return () => observer.disconnect();
    }, [error, hasMore, itemCount, loading, onLoadMore, scrollRootRef]);

    if (!hasMore) {
        return null;
    }

    return (
        <div className="mt-8 flex flex-col items-center gap-4">
            <div ref={sentinelRef} className="h-1 w-full" />
            {error ? <Notice tone="error" role="alert"><p>{error}</p></Notice> : null}
            <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                    requestedItemCountRef.current = itemCount;
                    void onLoadMore();
                }}
                loading={loading}
            >
                {label}
            </Button>
        </div>
    );
}
