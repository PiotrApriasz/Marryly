import type { AdminLoginResponse, AdminSessionResponse } from '../types/admin.types';
import { ApiError } from '../errors/apiError';
import { adminApiClient } from './adminApiClient';
import { clearAdminAccessToken, writeAdminAccessToken, writeAdminLoginDiagnostics, writeAdminUser } from './adminTokenStorage';

export class AdminAuthClient {
    async login(email: string, password: string): Promise<AdminLoginResponse> {
        const response = await adminApiClient.post<AdminLoginResponse>(
            '/panel/auth/login',
            { email, password },
            { suppressAuthFailureEvent: true }
        );

        if (response.accessToken) {
            writeAdminAccessToken(response.accessToken);
        }

        if (response.user) {
            writeAdminUser(response.user);
        }

        if (response.diagnostics) {
            writeAdminLoginDiagnostics(response.diagnostics);
        }

        return response;
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
                clearAdminAccessToken();
                return;
            }

            throw error;
        } finally {
            clearAdminAccessToken();
        }
    }
}

export const adminAuthClient = new AdminAuthClient();
