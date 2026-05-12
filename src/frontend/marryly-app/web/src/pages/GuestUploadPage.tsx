import Layout from '../components/Layout';
import Section from '../components/Section';
import PageHeader from '../components/PageHeader';
import { apiClient } from '../api/client';
import PhotoUploadPanel from '../components/PhotoUploadPanel';

export default function GuestUploadPage() {
    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Dodaj zdjęcia"
                        description="Zrób lub wybierz zdjęcia, a wysyłanie rozpocznie się automatycznie."
                    />
                    <div className="mt-12">
                        <PhotoUploadPanel
                            onCreateUpload={(payload) => apiClient.createPhotoUpload(payload)}
                            onCompleteUpload={(payload) => apiClient.completePhotoUpload(payload)}
                        />
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
