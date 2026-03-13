import { config } from '../app/config';
import type { AdminLoginResponse, AdminSessionResponse } from '../types/admin.types';
import { responseProcessor } from './responseProcessor.ts';

const ACCEPT_HEADER = 'application/json, application/problem+json';

async function parseOptionalJson<T>(response: Response): Promise<T | null> {
    const text = await response.text().catch(() => '');
    if (!text.trim()) {
        return null;
    }

    return JSON.parse(text) as T;
}

export class AdminAuthClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    async login(email: string, password: string): Promise<AdminLoginResponse> {
        const response = await fetch(`${this.baseUrl}/panel/auth/login`, {
            method: 'POST',
            headers: {
                Accept: ACCEPT_HEADER,
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });

        return responseProcessor.parseResponse<AdminLoginResponse>(response);
    }

    async getSession(): Promise<AdminSessionResponse> {
        const response = await fetch(`${this.baseUrl}/panel/auth/session`, {
            headers: {
                Accept: ACCEPT_HEADER,
            },
            credentials: 'include',
        });

        if (response.status === 401) {
            return { authenticated: false };
        }

        return responseProcessor.parseResponse<AdminSessionResponse>(response);
    }

    async logout(): Promise<void> {
        const response = await fetch(`${this.baseUrl}/panel/auth/logout`, {
            method: 'POST',
            headers: {
                Accept: ACCEPT_HEADER,
            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw await responseProcessor.parseError(response);
        }

        await parseOptionalJson<unknown>(response);
    }
}

export const adminAuthClient = new AdminAuthClient();
