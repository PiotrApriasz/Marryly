import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { appText } from '../content/appText';
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
    const { album, loading: albumLoading, error: albumError } = useGalleryAlbum(slug);
    const { photos, loading, error, hasMore, loadingMore, loadMore } = useInfiniteAlbumMedia({
        albumSlug: slug,
        pageSize: 50,
    });

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title={album?.title ?? appText.public.gallery.albumFallbackTitle}
                        description={album?.description ?? appText.public.gallery.albumFallbackDescription}
                    />

                    <div className="mt-12">
                        <PageState
                            loading={albumLoading || loading}
                            error={albumError ?? error}
                            isEmpty={photos.length === 0}
                            emptyMessage={appText.public.gallery.albumEmpty}
                            loadingFallback={<AlbumLoadingFallback />}
                        >
                            <>
                                <PhotoGalleryGrid
                                    photos={photos}
                                    hasMoreMedia={hasMore}
                                    loadingMore={loadingMore}
                                    onRequestMore={loadMore}
                                />
                                <InfiniteLoadMore
                                    hasMore={hasMore}
                                    loading={loadingMore}
                                    onLoadMore={loadMore}
                                    label={appText.public.gallery.loadMore}
                                />
                            </>
                        </PageState>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
