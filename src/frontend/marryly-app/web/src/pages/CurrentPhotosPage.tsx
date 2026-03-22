import { useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Section from '../components/Section';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { useInfinitePhotos } from '../hooks/useInfinitePhotos';

function PhotosLoadingFallback() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                    key={item}
                    className="aspect-square animate-pulse rounded-2xl border border-sand bg-white/50"
                />
            ))}
        </div>
    );
}

export default function CurrentPhotosPage() {
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
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Aktualne zdjęcia
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Najnowsze zdjęcia dodane przez gości.
                        </p>
                    </div>

                    <div className="mt-12">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                            {/*<div className="flex items-center gap-2">
                                <div className="h-3 w-3 animate-pulse rounded-full bg-gold" />
                                <span className="font-sans text-sm font-medium text-ink">
                                    Widok korzysta z krótkiego cache dla szybszego działania
                                </span>
                            </div>*/}
                            <span className="font-sans text-sm text-muted">
                                {photos.length} zdjęć gotowych do obejrzenia
                            </span>
                        </div>

                        <PageState
                            loading={loading}
                            error={error}
                            isEmpty={photos.length === 0}
                            emptyMessage="Tutaj pojawią się zdjęcia dodane przez gości."
                            loadingFallback={<PhotosLoadingFallback />}
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
