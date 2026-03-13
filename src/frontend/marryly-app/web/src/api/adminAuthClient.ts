import type { AdminLoginResponse, AdminSessionResponse } from '../types/admin.types';
import { ApiError } from '../errors/apiError';
import { adminApiClient } from './adminApiClient';

export class AdminAuthClient {
    async login(email: string, password: string): Promise<AdminLoginResponse> {
        return adminApiClient.post<AdminLoginResponse>(
            '/panel/auth/login',
            { email, password },
            { suppressAuthFailureEvent: true }
        );
    }

    async getSession(): Promise<AdminSessionResponse> {
        try {
            return await adminApiClient.get<AdminSessionResponse>(
                '/panel/auth/session',
                { suppressAuthFailureEvent: true }
            );
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                return { authenticated: false };
            }

            throw error;
        }
    }

    async logout(): Promise<void> {
        try {
            await adminApiClient.post<void>(
                '/panel/auth/logout',
                undefined,
                { suppressAuthFailureEvent: true }
            );
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                return;
            }

            throw error;
        }
    }
}

export const adminAuthClient = new AdminAuthClient();
