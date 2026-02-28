import Layout from '../components/Layout';
import Section from '../components/Section';
import { useMenu } from '../hooks/useMenu';

function MenuSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-8 animate-pulse">
            {[1, 2, 3].map((section) => (
                <div key={section} className="rounded-lg border border-sand bg-white p-6">
                    <div className="mb-4 h-8 w-48 bg-sand rounded" />
                    <div className="space-y-3">
                        {[1, 2].map((item) => (
                            <div key={item} className="h-6 bg-sand/50 rounded" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function MenuPage() {
    const { menu, loading, error } = useMenu();

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center mb-12">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Menu wesela
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                    </div>

                    {loading && <MenuSkeleton />}

                    {error && (
                        <div className="mx-auto max-w-2xl text-center">
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
                                <p className="font-sans text-lg text-rose-800">
                                    {error}
                                </p>
                                <p className="mt-2 text-sm text-rose-600">
                                    Spróbuj odświeżyć stronę
                                </p>
                            </div>
                        </div>
                    )}

                    {!loading && !error && menu && (
                        <div className="mx-auto max-w-3xl">
                            <h2 className="mb-8 text-center font-script text-3xl text-ink">
                                {menu.title}
                            </h2>

                            <div className="space-y-8">
                                {menu.sections.map((section, idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-lg border border-sand bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
                                    >
                                        <h3 className="mb-6 border-b border-gold pb-2 font-script text-2xl text-ink">
                                            {section.name}
                                        </h3>
                                        <ul className="space-y-3">
                                            {section.items.map((item, itemIdx) => (
                                                <li
                                                    key={itemIdx}
                                                    className="flex items-start"
                                                >
                                                    <span className="mr-3 mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
                                                    <div className="flex-1">
                                                        <span className="font-sans text-lg text-ink">
                                                            {item.name}
                                                        </span>
                                                        {item.description && (
                                                            <p className="mt-1 text-sm text-muted">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && !error && !menu && (
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="font-sans text-lg text-muted">
                                Menu weselne wkrótce zostanie opublikowane
                            </p>
                        </div>
                    )}
                </Section>
            </div>
        </Layout>
    );
}
