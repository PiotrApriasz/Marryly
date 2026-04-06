export type AuthFailureReason = 'unauthorized' | 'forbidden';

export interface AuthFailureDetail {
    reason: AuthFailureReason;
    status: number;
    code?: string;
    message?: string;
    detail?: string;
}

const AUTH_FAILURE_EVENT = 'auth-failure';

export function notifyAuthFailure(detail: AuthFailureDetail): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent<AuthFailureDetail>(AUTH_FAILURE_EVENT, { detail }));
}

export function subscribeToAuthFailures(
    handler: (detail: AuthFailureDetail) => void
): () => void {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const wrappedHandler = (event: Event) => {
        const customEvent = event as CustomEvent<AuthFailureDetail>;
        handler(customEvent.detail);
    };

    window.addEventListener(AUTH_FAILURE_EVENT, wrappedHandler as EventListener);
    return () => {
        window.removeEventListener(AUTH_FAILURE_EVENT, wrappedHandler as EventListener);
    };
}
