import Layout from '../components/Layout';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useMenu } from '../hooks/useMenu';
import { getMenuSectionTypeLabel } from '../utils/menu';

function MenuSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-8 animate-pulse">
            {[1, 2, 3].map((section) => (
                <Card key={section} className="rounded-lg">
                    <div className="mb-4 h-8 w-48 rounded bg-sand" />
                    <div className="space-y-3">
                        {[1, 2].map((item) => (
                            <div key={item} className="h-6 rounded bg-sand/50" />
                        ))}
                    </div>
                </Card>
            ))}
        </div>
    );
}

export default function MenuPage() {
    const { menu, loading, error } = useMenu();
    const visibleBlocks = menu?.blocks
        .map((block) => ({
            ...block,
            sections: block.sections.filter((section) => section.items.length > 0),
        }))
        .filter((block) => block.sections.length > 0) ?? [];

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader title="Menu wesela" className="mb-12" />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={!menu || visibleBlocks.length === 0}
                        emptyMessage="Menu weselne wkrótce zostanie opublikowane"
                        loadingFallback={<MenuSkeleton />}
                    >
                        <div className="menu-public-shell">
                            <div className="space-y-10">
                                {visibleBlocks.map((block, blockIdx) => (
                                    <div key={`${block.title}-${block.sortOrder}-${blockIdx}`} className="space-y-5">
                                        <Card className="menu-public-block-header" padding="lg">
                                            <h2 className="font-serif text-3xl text-ink md:text-4xl">
                                                {block.title}
                                            </h2>
                                        </Card>

                                        <div className="space-y-6">
                                            {block.sections.map((section, sectionIdx) => (
                                                <Card
                                                    key={`${section.sectionType}-${section.sortOrder}-${sectionIdx}`}
                                                    className="menu-public-section"
                                                    padding="none"
                                                >
                                                    <div className="border-b border-sand pb-5">
                                                        <h3 className="font-serif text-2xl text-ink md:text-3xl">
                                                            {getMenuSectionTypeLabel(section.sectionType)}
                                                        </h3>
                                                    </div>

                                                    <div className="mt-2">
                                                        {section.items.map((item, itemIdx) => (
                                                            <article
                                                                key={`${item.name}-${item.sortOrder}-${itemIdx}`}
                                                                className="menu-public-item"
                                                            >
                                                                <div className="menu-public-item-index">
                                                                    {itemIdx + 1}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-serif text-xl text-ink">
                                                                        {item.name}
                                                                    </h4>
                                                                    {item.description && (
                                                                        <p className="mt-2 font-sans text-sm leading-7 text-muted md:text-base">
                                                                            {item.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </article>
                                                        ))}
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
