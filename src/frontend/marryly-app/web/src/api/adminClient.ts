import { adminApiClient } from './adminApiClient';
import type { AdminGuestBookEntriesPage, AdminOverview } from '../types/admin.types';

export class AdminClient {
    async getOverview(): Promise<AdminOverview> {
        return adminApiClient.get<AdminOverview>('/panel/overview');
    }

    async getGuestBookEntries(page: number, pageSize: number): Promise<AdminGuestBookEntriesPage> {
        return adminApiClient.get<AdminGuestBookEntriesPage>(`/panel/guestbook?page=${page}&pageSize=${pageSize}`);
    }
}

export const adminClient = new AdminClient();
