import { config } from '../app/config';
import { ApiError } from '../errors/apiError';
import type { AccessLoginResponse, AccessSessionResponse } from '../types/auth.types';
import { responseProcessor } from './responseProcessor.ts';
import { ACCESS_TOKEN_HEADER, clearAccessSession, readAccessToken, writeAccessToken, writeAccessUser } from './accessTokenStorage';

const ACCEPT_HEADER = 'application/json, application/problem+json';

export class AuthApiClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    async loginWithAccessCode(accessCode: string): Promise<AccessLoginResponse> {
        const response = await fetch(`${this.baseUrl}/auth/access-code`, {
            method: 'POST',
            headers: {
                Accept: ACCEPT_HEADER,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ accessCode }),
        });

        const payload = await responseProcessor.parseResponse<AccessLoginResponse>(response);
        this.persistSession(payload);
        return payload;
    }

    async loginAsAdmin(email: string, password: string): Promise<AccessLoginResponse> {
        const response = await fetch(`${this.baseUrl}/panel/auth/login`, {
            method: 'POST',
            headers: {
                Accept: ACCEPT_HEADER,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const payload = await responseProcessor.parseResponse<AccessLoginResponse>(response);
        this.persistSession(payload);
        return payload;
    }

    async getSession(): Promise<AccessSessionResponse> {
        const accessToken = readAccessToken();
        if (!accessToken) {
            return { authenticated: false };
        }

        try {
            return await responseProcessor.parseResponse<AccessSessionResponse>(
                await fetch(`${this.baseUrl}/auth/session`, {
                    headers: {
                        Accept: ACCEPT_HEADER,
                        [ACCESS_TOKEN_HEADER]: accessToken,
                    },
                })
            );
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                return { authenticated: false };
            }

            throw error;
        }
    }

    async logout(): Promise<void> {
        const accessToken = readAccessToken();
        const response = await fetch(`${this.baseUrl}/auth/logout`, {
            method: 'POST',
            headers: {
                Accept: ACCEPT_HEADER,
                ...(accessToken ? { [ACCESS_TOKEN_HEADER]: accessToken } : {}),
            },
        });

        try {
            if (!response.ok) {
                throw await responseProcessor.parseError(response);
            }
        } catch (error: unknown) {
            if (!(error instanceof ApiError) || error.status !== 401) {
                throw error;
            }
        } finally {
            clearAccessSession();
        }
    }

    private persistSession(response: AccessLoginResponse): void {
        if (response.accessToken) {
            writeAccessToken(response.accessToken);
        }

        if (response.user) {
            writeAccessUser(response.user);
        }
    }
}

export const authApiClient = new AuthApiClient();
