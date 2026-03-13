import Layout from '../components/Layout';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminOverview } from '../hooks/admin/useAdminOverview';

function DashboardSkeleton() {
    return (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="rounded-2xl border border-sand bg-white p-6 text-center">
                    <div className="mx-auto h-10 w-10 rounded-full bg-sand" />
                    <div className="mx-auto mt-4 h-6 w-24 rounded bg-sand" />
                    <div className="mx-auto mt-3 h-8 w-12 rounded bg-sand/70" />
                </div>
            ))}
        </div>
    );
}

export default function AdminDashboardPage() {
    const { overview, loading, error } = useAdminOverview();
    const dashboardItems = [
        { title: 'Zdjęcia', icon: '📸', count: String(overview.photosCount) },
        { title: 'Goście', icon: '👥', count: String(overview.guestsCount) },
        { title: 'Wpisy', icon: '💬', count: String(overview.wishesCount) },
        { title: 'Menu', icon: '🍽️', count: overview.menuPublished ? '1' : '0' },
        { title: 'Atrakcje', icon: '🎉', count: String(overview.attractionsCount) },
        { title: 'Ustawienia', icon: '⚙️', count: String(overview.settingsCount) },
    ];

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Panel Młodej Pary
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Zarządzanie treścią, gośćmi i ustawieniami wesela
                        </p>
                    </div>

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={false}
                        emptyMessage=""
                        loadingFallback={<DashboardSkeleton />}
                    >
                        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {dashboardItems.map((item) => (
                                <div key={item.title}
                                    className="rounded-2xl border border-sand bg-white p-6 text-center transition-all hover:shadow-md">
                                    <div className="text-4xl">{item.icon}</div>
                                    <h3 className="mt-4 font-serif text-xl text-ink">{item.title}</h3>
                                    <p className="mt-2 text-3xl font-bold text-gold">{item.count}</p>
                                </div>
                            ))}
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
