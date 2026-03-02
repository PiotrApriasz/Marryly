interface ApiErrorAlertProps {
    message: string;
}

export default function ApiErrorAlert({ message }: ApiErrorAlertProps) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
                <p className="font-sans text-left text-lg text-rose-800 whitespace-pre-wrap break-words">
                    {message}
                </p>
                <p className="mt-4 text-sm text-rose-600">
                    Spróbuj odświeżyć stronę
                </p>
            </div>
        </div>
    );
}
