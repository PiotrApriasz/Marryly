const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token';

export function readAdminAccessToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
}

export function writeAdminAccessToken(token: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token);
}

export function clearAdminAccessToken(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
}
