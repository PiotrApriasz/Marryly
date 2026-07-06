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
                        title="Dodaj zdjęcia i filmy"
                        description="Zrób lub wybierz zdjęcia albo filmy, a wysyłanie rozpocznie się automatycznie."
                    />
                    <div className="mt-12">
                        <PhotoUploadPanel
                            addButtonLabel="Dodaj zdjęcia lub filmy"
                            addButtonDescription="Otworzy aparat, kamerę lub galerię w telefonie."
                            successTitle="Pliki zapisane"
                            onCreateUpload={(payload) => apiClient.createMediaUpload(payload)}
                            onCompleteUpload={(payload) => apiClient.completeMediaUpload(payload)}
                        />
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
