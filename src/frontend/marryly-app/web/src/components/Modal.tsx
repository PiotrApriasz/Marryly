import type { ReactNode } from 'react';

interface ModalProps {
    open: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
}

export default function Modal({
    open,
    title,
    children,
    onClose,
}: ModalProps) {
    if (!open) {
        return null;
    }

    return (
        <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button
                type="button"
                className="modal-backdrop"
                aria-label="Zamknij okno"
                onClick={onClose}
            />
            <div className="modal-panel">
                <div className="modal-header">
                    <h2 id="modal-title" className="font-serif text-2xl text-ink">{title}</h2>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}
