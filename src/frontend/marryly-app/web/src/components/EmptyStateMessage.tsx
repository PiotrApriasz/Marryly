interface EmptyStateMessageProps {
    message: string;
}

export default function EmptyStateMessage({ message }: EmptyStateMessageProps) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <p className="font-sans text-lg text-muted">
                {message}
            </p>
        </div>
    );
}
