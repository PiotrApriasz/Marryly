import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';

export default function AttractionsPage() {
    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Atrakcje"
                        description="Wkrótce pojawi się tutaj lista atrakcji przygotowanych na wesele"
                    />
                </Section>
            </div>
        </Layout>
    );
}
