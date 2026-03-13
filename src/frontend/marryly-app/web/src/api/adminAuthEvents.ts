export type AdminAuthFailureReason = 'unauthorized' | 'forbidden';

export interface AdminAuthFailureDetail {
    reason: AdminAuthFailureReason;
    status: number;
}

const ADMIN_AUTH_FAILURE_EVENT = 'admin-auth-failure';

export function notifyAdminAuthFailure(detail: AdminAuthFailureDetail): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent<AdminAuthFailureDetail>(ADMIN_AUTH_FAILURE_EVENT, { detail }));
}

export function subscribeToAdminAuthFailures(
    handler: (detail: AdminAuthFailureDetail) => void
): () => void {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const wrappedHandler = (event: Event) => {
        const customEvent = event as CustomEvent<AdminAuthFailureDetail>;
        handler(customEvent.detail);
    };

    window.addEventListener(ADMIN_AUTH_FAILURE_EVENT, wrappedHandler as EventListener);
    return () => {
        window.removeEventListener(ADMIN_AUTH_FAILURE_EVENT, wrappedHandler as EventListener);
    };
}
