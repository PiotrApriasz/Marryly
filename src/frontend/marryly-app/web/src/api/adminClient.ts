import { adminApiClient } from './adminApiClient';
import type { AdminOverview } from '../types/admin.types';

export class AdminClient {
    async getOverview(): Promise<AdminOverview> {
        return adminApiClient.get<AdminOverview>('/panel/overview');
    }
}

export const adminClient = new AdminClient();
