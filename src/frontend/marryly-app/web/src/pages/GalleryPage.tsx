import Layout from '../components/Layout';
import Section from '../components/Section';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { usePhotos } from '../hooks/usePhotos';

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
    const { data: photos, loading, error } = usePhotos({
        cacheKey: 'gallery-photos',
        cacheDuration: 60 * 1000,
    });

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Album
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                    </div>

                    <div className="mt-12">
                        <PageState
                            loading={loading}
                            error={error}
                            isEmpty={photos.length === 0}
                            emptyMessage="Galeria będzie widoczna, gdy pierwsze zdjęcia zostaną przetworzone."
                            loadingFallback={<GalleryLoadingFallback />}
                        >
                            <PhotoGalleryGrid photos={photos} showUploadedAt />
                        </PageState>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
