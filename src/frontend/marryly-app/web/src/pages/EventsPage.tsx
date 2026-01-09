import Layout from '../components/Layout';
import Section from '../components/Section';

export default function EventsPage() {
    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Wydarzenia
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Wkrótce pojawi się tutaj harmonogram dnia
                        </p>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
