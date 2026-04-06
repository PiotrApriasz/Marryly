import type { AccessTokenClaims, AccessUser } from '../types/auth.types';

export const ACCESS_TOKEN_HEADER = 'X-Marryly-Access-Token';

const ACCESS_TOKEN_KEY = 'marryly_access_token';
const ACCESS_USER_KEY = 'marryly_access_user';
const SESSION_CACHE_PREFIXES = ['wedding_', 'admin_'];

function decodeBase64Url(value: string): string | null {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        return window.atob(padded);
    } catch {
        return null;
    }
}

function parseJwtPayload(token: string): AccessTokenClaims | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
        return null;
    }

    const payload = decodeBase64Url(parts[1]);
    if (!payload) {
        return null;
    }

    try {
        return JSON.parse(payload) as AccessTokenClaims;
    } catch {
        return null;
    }
}

export function readAccessToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function writeAccessToken(token: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function readAccessTokenClaims(): AccessTokenClaims | null {
    const token = readAccessToken();
    return token ? parseJwtPayload(token) : null;
}

export function hasValidAccessToken(): boolean {
    const payload = readAccessTokenClaims();
    if (!payload) {
        return false;
    }

    if (!payload.exp) {
        return true;
    }

    return payload.exp * 1000 > Date.now();
}

export function writeAccessUser(user: AccessUser): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(ACCESS_USER_KEY, JSON.stringify(user));
}

export function readAccessUser(): AccessUser | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const storedValue = window.localStorage.getItem(ACCESS_USER_KEY);
    if (!storedValue) {
        return null;
    }

    try {
        return JSON.parse(storedValue) as AccessUser;
    } catch {
        window.localStorage.removeItem(ACCESS_USER_KEY);
        return null;
    }
}

export function clearAppSessionCache(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index);
        if (key && SESSION_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
}

export function clearAccessSession(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(ACCESS_USER_KEY);
    clearAppSessionCache();
}
