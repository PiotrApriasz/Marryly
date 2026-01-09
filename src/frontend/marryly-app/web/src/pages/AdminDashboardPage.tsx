import Layout from '../components/Layout';
import Section from '../components/Section';

export default function AdminDashboardPage() {
    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Panel Administratora
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Zarządzanie treścią, gośćmi i ustawieniami wesela
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                            { title: 'Zdjęcia', icon: '📸', count: '0' },
                            { title: 'Goście', icon: '👥', count: '0' },
                            { title: 'Wpisy', icon: '💬', count: '0' },
                            { title: 'Menu', icon: '🍽️', count: '-' },
                            { title: 'Atrakcje', icon: '🎉', count: '-' },
                            { title: 'Ustawienia', icon: '⚙️', count: '-' },
                        ].map((item) => (
                            <div key={item.title}
                                className="rounded-2xl border border-sand bg-white p-6 text-center transition-all hover:shadow-md">
                                <div className="text-4xl">{item.icon}</div>
                                <h3 className="mt-4 font-serif text-xl text-ink">{item.title}</h3>
                                <p className="mt-2 text-3xl font-bold text-gold">{item.count}</p>
                            </div>
                        ))}
                    </div>
                </Section>
            </div>
        </Layout>
    );
}