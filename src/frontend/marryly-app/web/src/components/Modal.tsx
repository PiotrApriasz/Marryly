import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        const backgrounds = [...document.querySelectorAll<HTMLElement>('#root, body > .lightbox-overlay')].filter((element) => !element.inert);
        const inertStates = backgrounds.map((element) => element.inert);
        backgrounds.forEach((element) => { element.inert = true; });
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            backgrounds.forEach((element, index) => { element.inert = inertStates[index]; });
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        };
    }, [open]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="modal-title"
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); onClose(); }
                if (event.key === 'Tab') {
                    const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? [])];
                    const first = controls[0];
                    const last = controls[controls.length - 1];
                    if (!first) { event.preventDefault(); return; }
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
                        event.preventDefault(); last.focus();
                    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
                        event.preventDefault(); first.focus();
                    }
                }
            }}>
            <button
                type="button"
                className="modal-backdrop"
                aria-label="Zamknij okno"
                onClick={onClose}
            />
            <div className="modal-panel outline-none" tabIndex={-1} ref={panelRef}>
                <div className="modal-header">
                    <h2 id="modal-title" className="font-serif text-2xl text-ink">{title}</h2>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>, document.body
    );
}
