import { cn } from '../utils/cn';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-10 w-10 border-4',
    lg: 'h-14 w-14 border-4',
};

export default function LoadingSpinner({
    size = 'md',
    className,
}: LoadingSpinnerProps) {
    return (
        <div
            className={cn(
                'animate-spin rounded-full border-current border-t-transparent',
                sizeClasses[size],
                className
            )}
            aria-hidden="true"
        />
    );
}
