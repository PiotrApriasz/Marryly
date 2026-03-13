import { adminApiClient } from './adminApiClient';
import type { AdminGuestBookEntry, AdminOverview } from '../types/admin.types';

export class AdminClient {
    async getOverview(): Promise<AdminOverview> {
        return adminApiClient.get<AdminOverview>('/panel/overview');
    }

    async getGuestBookEntries(): Promise<AdminGuestBookEntry[]> {
        return adminApiClient.get<AdminGuestBookEntry[]>('/panel/guestbook');
    }
}

export const adminClient = new AdminClient();
