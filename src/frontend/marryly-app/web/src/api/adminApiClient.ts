import { config } from '../app/config';
import { ApiError } from '../errors/apiError';
import { notifyAdminAuthFailure } from './adminAuthEvents';
import { readAdminAccessToken } from './adminTokenStorage';
import { responseProcessor } from './responseProcessor.ts';

const ACCEPT_HEADER = 'application/json, application/problem+json';
const ADMIN_TOKEN_HEADER = 'X-Marryly-Admin-Token';

interface AdminRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    suppressAuthFailureEvent?: boolean;
}

export class AdminApiClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    async get<T>(path: string, options?: Omit<AdminRequestOptions, 'method' | 'body'>): Promise<T> {
        return this.request<T>(path, { ...options, method: 'GET' });
    }

    async post<T>(path: string, body?: unknown, options?: Omit<AdminRequestOptions, 'method' | 'body'>): Promise<T> {
        return this.request<T>(path, { ...options, method: 'POST', body });
    }

    async put<T>(path: string, body?: unknown, options?: Omit<AdminRequestOptions, 'method' | 'body'>): Promise<T> {
        return this.request<T>(path, { ...options, method: 'PUT', body });
    }

    async delete<T>(path: string, options?: Omit<AdminRequestOptions, 'method' | 'body'>): Promise<T> {
        return this.request<T>(path, { ...options, method: 'DELETE' });
    }

    private async request<T>(path: string, options: AdminRequestOptions): Promise<T> {
        const { method = 'GET', body, headers, suppressAuthFailureEvent = false } = options;
        const hasBody = body !== undefined;
        const accessToken = readAdminAccessToken();
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                Accept: ACCEPT_HEADER,
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...(accessToken ? { [ADMIN_TOKEN_HEADER]: accessToken } : {}),
                ...headers,
            },
            ...(hasBody ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            const apiError = await responseProcessor.parseError(response);

            if (!suppressAuthFailureEvent && apiError instanceof ApiError) {
                if (apiError.status === 401) {
                    notifyAdminAuthFailure({
                        reason: 'unauthorized',
                        status: 401,
                        code: apiError.code,
                        message: apiError.message,
                        detail: apiError.detail,
                    });
                } else if (apiError.status === 403) {
                    notifyAdminAuthFailure({
                        reason: 'forbidden',
                        status: 403,
                        code: apiError.code,
                        message: apiError.message,
                        detail: apiError.detail,
                    });
                }
            }

            throw apiError;
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return responseProcessor.parseResponse<T>(response);
    }
}

export const adminApiClient = new AdminApiClient();
