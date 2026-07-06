import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import { appText } from '../content/appText';

export default function AttractionsPage() {
    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title={appText.public.attractions.title}
                        description={appText.public.attractions.description}
                    />
                </Section>
            </div>
        </Layout>
    );
}
