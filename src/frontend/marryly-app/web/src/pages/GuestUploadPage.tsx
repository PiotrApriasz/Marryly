import Layout from '../components/Layout';
import Section from '../components/Section';
import PageHeader from '../components/PageHeader';
import { apiClient } from '../api/client';
import { appText } from '../content/appText';
import PhotoUploadPanel from '../components/PhotoUploadPanel';

export default function GuestUploadPage() {
    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title={appText.public.guestUpload.title}
                        description={appText.public.guestUpload.description}
                    />
                    <div className="mt-12">
                        <PhotoUploadPanel
                            addButtonLabel={appText.public.guestUpload.addButtonLabel}
                            addButtonDescription={appText.public.guestUpload.addButtonDescription}
                            successTitle={appText.public.guestUpload.successTitle}
                            onCreateUpload={(payload) => apiClient.createMediaUpload(payload)}
                            onCompleteUpload={(payload) => apiClient.completeMediaUpload(payload)}
                        />
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
