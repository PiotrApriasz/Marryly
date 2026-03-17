import type { AdminUser } from '../types/admin.types';

const ADMIN_ACCESS_TOKEN_KEY = 'admin_access_token';
const ADMIN_USER_KEY = 'admin_user';

interface JwtPayload {
    exp?: number;
    email?: string;
    sub?: string;
}

function decodeBase64Url(value: string): string | null {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        return window.atob(padded);
    } catch {
        return null;
    }
}

function parseJwtPayload(token: string): JwtPayload | null {
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
        return JSON.parse(payload) as JwtPayload;
    } catch {
        return null;
    }
}

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

export function hasValidAdminAccessToken(): boolean {
    const token = readAdminAccessToken();
    if (!token) {
        return false;
    }

    const payload = parseJwtPayload(token);
    if (!payload?.exp) {
        return true;
    }

    return payload.exp * 1000 > Date.now();
}

export function writeAdminUser(user: AdminUser): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function readAdminUser(): AdminUser | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const storedValue = window.sessionStorage.getItem(ADMIN_USER_KEY);
    if (!storedValue) {
        return null;
    }

    try {
        return JSON.parse(storedValue) as AdminUser;
    } catch {
        return null;
    }
}

export function clearAdminAccessToken(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(ADMIN_USER_KEY);
}
