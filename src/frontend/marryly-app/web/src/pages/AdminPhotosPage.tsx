import AdminBackLink from '../components/AdminBackLink';
import AdminMediaGrid from '../components/AdminMediaGrid';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { appText } from '../content/appText';
import { useAdminPhotos } from '../hooks/admin/useAdminPhotos';

const PAGE_SIZE = 50;

export default function AdminPhotosPage() {
    const { items, loading, loadingMore, error, hasMore, totalCount, loadMore } = useAdminPhotos(PAGE_SIZE);

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title={appText.admin.media.title}
                        helpText={appText.admin.media.helpText}
                    />

                    <p className="mt-8 font-sans text-sm text-muted">
                        {totalCount} {appText.admin.media.totalSuffix}
                    </p>
                </Section>

                <section className="shared-gallery-album-photos-screen" aria-label={appText.admin.media.title}>
                    <div className="shared-gallery-album-photos-content">
                        <PageState
                            loading={loading}
                            error={error}
                            isEmpty={items.length === 0}
                            emptyMessage={appText.admin.media.empty}
                        >
                            <>
                                <AdminMediaGrid
                                    items={items}
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
                </section>
            </div>
        </Layout>
    );
}
