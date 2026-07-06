import { appText } from '../content/appText';
import Notice from './Notice';

interface ApiErrorAlertProps {
    message: string;
}

export default function ApiErrorAlert({ message }: ApiErrorAlertProps) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <Notice tone="error" className="rounded-lg p-6 text-left">
                <p className="whitespace-pre-wrap break-words font-sans text-lg">
                    {message}
                </p>
                <p className="mt-4 text-sm text-rose-600">
                    {appText.components.apiErrorAlert.refresh}
                </p>
            </Notice>
        </div>
    );
}
