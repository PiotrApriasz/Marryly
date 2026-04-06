import type { AccessLoginResponse, AccessSessionResponse } from '../types/auth.types';
import { authApiClient } from './authApiClient';

export class AdminAuthClient {
    async login(email: string, password: string): Promise<AccessLoginResponse> {
        return authApiClient.loginAsAdmin(email, password);
    }

    async getSession(): Promise<AccessSessionResponse> {
        return authApiClient.getSession();
    }

    async logout(): Promise<void> {
        await authApiClient.logout();
    }
}

export const adminAuthClient = new AdminAuthClient();
