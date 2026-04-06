interface EmptyStateMessageProps {
    message: string;
}

export default function EmptyStateMessage({ message }: EmptyStateMessageProps) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <p className="page-description mt-0">
                {message}
            </p>
        </div>
    );
}
