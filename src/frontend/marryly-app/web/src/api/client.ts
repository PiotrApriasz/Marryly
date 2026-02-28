import { config } from '../app/config';
import type { Menu, Event } from '../types/wedding.types';

export class ApiClient {
    private readonly baseUrl: string;
    private readonly eventId: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
        this.eventId = config.eventId;
    }

    async getMenu(): Promise<Menu> {
        const response = await fetch(
            `${this.baseUrl}/events/${this.eventId}/menu`
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Menu not found');
            }
            throw new Error('Failed to fetch menu');
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid API response - expected JSON but received HTML. Check API configuration.');
        }

        return response.json();
    }

    async getEvents(): Promise<Event[]> {
        const response = await fetch(
            `${this.baseUrl}/events/${this.eventId}/schedule`
        );

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Events not found');
            }
            throw new Error('Failed to fetch events');
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid API response - expected JSON but received HTML. Check API configuration.');
        }

        return response.json();
    }
}

export const apiClient = new ApiClient();