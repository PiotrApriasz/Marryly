import { config } from '../app/config';
import type { Menu, Event } from '../types/wedding.types';
import {responseProcessor} from "./responseProcessor.ts";

export class ApiClient {
    private readonly baseUrl: string;
    private readonly eventId: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
        this.eventId = config.eventId;
    }

    private async fetchJson<T>(path: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                Accept: 'application/json, application/problem+json',
            },
        });

        return responseProcessor.parseResponse<T>(response);
    }

    async getMenu(): Promise<Menu> {
        return this.fetchJson<Menu>(`/events/${this.eventId}/menu`);
    }

    async getEvents(): Promise<Event[]> {
        return this.fetchJson<Event[]>(`/events/${this.eventId}/schedule`);
    }
}

export const apiClient = new ApiClient();
