import type { ReactNode } from 'react';
import Button, { type ButtonSize, type ButtonVariant } from './Button';

interface ConfirmActionButtonProps {
    confirmMessage: string;
    onConfirm: () => void | Promise<void>;
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
}

export default function ConfirmActionButton({
    confirmMessage,
    onConfirm,
    children,
    variant = 'danger',
    size = 'sm',
    className,
    disabled,
    loading,
    type = 'button',
}: ConfirmActionButtonProps) {
    const handleClick = async () => {
        if (!window.confirm(confirmMessage)) {
            return;
        }

        await onConfirm();
    };

    return (
        <Button
            type={type}
            variant={variant}
            size={size}
            className={className}
            disabled={disabled}
            loading={loading}
            onClick={() => void handleClick()}
        >
            {children}
        </Button>
    );
}
