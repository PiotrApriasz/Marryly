import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { useGalleryAlbum } from '../hooks/useGalleryAlbum';
import { useInfiniteAlbumMedia } from '../hooks/useInfiniteAlbumMedia';

function AlbumLoadingFallback() {
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

export default function GalleryAlbumPage() {
    const { slug } = useParams();
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const { album, loading: albumLoading, error: albumError } = useGalleryAlbum(slug);
    const { photos, loading, error, hasMore, loadingMore, loadMore } = useInfiniteAlbumMedia({
        albumSlug: slug,
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
                    <PageHeader
                        title={album?.title ?? 'Galeria'}
                        description={album?.description ?? 'Album z naszymi wspomnieniami.'}
                    />

                    <div className="mt-12">
                        <PageState
                            loading={albumLoading || loading}
                            error={albumError ?? error}
                            isEmpty={photos.length === 0}
                            emptyMessage="Ten album jest jeszcze pusty."
                            loadingFallback={<AlbumLoadingFallback />}
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
                                            loading={loadingMore}
                                        >
                                            Pokaż więcej zdjęć
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
