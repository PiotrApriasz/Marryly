import { useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { useInfinitePhotos } from '../hooks/useInfinitePhotos';

function GalleryLoadingFallback() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((item) => (
                <div
                    key={item}
                    className="aspect-square animate-pulse rounded-2xl border border-sand bg-white/50"
                />
            ))}
        </div>
    );
}

export default function GalleryPage() {
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const { photos, loading, error, hasMore, loadingMore, loadMore } = useInfinitePhotos({
        pageSize: 50,
    });

    useEffect(() => {
        const node = sentinelRef.current;

        if (!node || !hasMore || loadingMore) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;

            if (entry?.isIntersecting) {
                void loadMore();
            }
        }, {
            rootMargin: '300px 0px',
        });

        observer.observe(node);

        return () => observer.disconnect();
    }, [hasMore, loadMore, loadingMore, photos.length]);

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader title="Album" />

                    <div className="mt-12">
                        <PageState
                            loading={loading}
                            error={error}
                            isEmpty={photos.length === 0}
                            emptyMessage="Galeria będzie widoczna, gdy pierwsze zdjęcia zostaną przetworzone."
                            loadingFallback={<GalleryLoadingFallback />}
                        >
                            <>
                                <PhotoGalleryGrid photos={photos} showUploadedAt />
                                {hasMore ? (
                                    <div className="mt-8 flex flex-col items-center gap-4">
                                        <div ref={sentinelRef} className="h-1 w-full" />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="md"
                                            onClick={() => void loadMore()}
                                            disabled={loadingMore}
                                        >
                                            {loadingMore ? 'Pobieranie...' : 'Pokaż więcej zdjęć'}
                                        </Button>
                                    </div>
                                ) : null}
                            </>
                        </PageState>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
