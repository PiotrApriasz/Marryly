import { useEffect, useRef } from 'react';
import Button from './Button';

interface InfiniteLoadMoreProps {
    hasMore: boolean;
    loading: boolean;
    onLoadMore: () => void | Promise<void>;
    label: string;
}

export default function InfiniteLoadMore({
    hasMore,
    loading,
    onLoadMore,
    label,
}: InfiniteLoadMoreProps) {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const awaitingSentinelExitRef = useRef(false);

    useEffect(() => {
        const node = sentinelRef.current;

        if (!node || !hasMore || loading) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;

            if (!entry) {
                return;
            }

            if (!entry.isIntersecting) {
                awaitingSentinelExitRef.current = false;
                return;
            }

            if (!awaitingSentinelExitRef.current) {
                awaitingSentinelExitRef.current = true;
                void onLoadMore();
            }
        }, {
            rootMargin: '300px 0px',
        });

        observer.observe(node);

        return () => observer.disconnect();
    }, [hasMore, loading, onLoadMore]);

    if (!hasMore) {
        return null;
    }

    return (
        <div className="mt-8 flex flex-col items-center gap-4">
            <div ref={sentinelRef} className="h-1 w-full" />
            <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => void onLoadMore()}
                loading={loading}
            >
                {label}
            </Button>
        </div>
    );
}
