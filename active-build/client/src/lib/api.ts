import { seedUsers, seedEvents, seedRsvps } from './seed-data';
import type { User, Event, Rsvp } from '../../../../server/src/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-memory store for preview mode
let memoryStore = {
  users: [...seedUsers] as User[],
  events: [...seedEvents] as Event[],
  rsvps: [...seedRsvps] as Rsvp[],
};

const getAuthToken = () => localStorage.getItem('authToken');

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) return null as T;
    return response.json();
  } catch (error) {
    console.warn(`API fetch failed for ${path}. Falling back to preview data.`, error);
    throw error; // Re-throw to be handled by callers, which will then use fallback
  }
}

// --- Fallback Functions ---
const handleApiError = <T>(fallbackFn: () => T) => (error: any): T => {
  console.warn('API call failed, using fallback.', error);
  return fallbackFn();
};

// --- Auth API ---
export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<{ token: string; user: User }> =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData: { name: string; email: string; password: string }): Promise<{ token: string; user: User }> =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getProfile: (): Promise<User> => apiFetch('/auth/profile'),
};

// --- Events API ---
export const eventsApi = {
  list: (): Promise<Event[]> =>
    apiFetch<Event[]>('/events').catch(handleApiError(() => memoryStore.events)),
  get: (id: number): Promise<Event> =>
    apiFetch<Event>(`/events/${id}`).catch(handleApiError(() => memoryStore.events.find(e => e.id === id)!)),
  create: (eventData: Omit<Event, 'id' | 'createdAt' | 'createdById'>): Promise<Event> =>
    apiFetch<Event>('/events', { method: 'POST', body: JSON.stringify(eventData) }).catch(handleApiError(() => {
        const newEvent: Event = { ...eventData, id: Date.now(), createdAt: new Date().toISOString(), createdById: 1 }; // Assume user 1 for seed
        memoryStore.events.push(newEvent);
        return newEvent;
    })),
  update: (id: number, eventData: Partial<Event>): Promise<Event> =>
    apiFetch<Event>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(eventData) }).catch(handleApiError(() => {
        const index = memoryStore.events.findIndex(e => e.id === id);
        if (index === -1) throw new Error('Event not found');
        memoryStore.events[index] = { ...memoryStore.events[index], ...eventData };
        return memoryStore.events[index];
    })),
  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/events/${id}`, { method: 'DELETE' }).catch(handleApiError(() => {
        memoryStore.events = memoryStore.events.filter(e => e.id !== id);
    })),
  rsvp: (id: number, status: 'yes' | 'no' | 'maybe'): Promise<Rsvp> =>
    apiFetch<Rsvp>(`/events/${id}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }).catch(handleApiError(() => {
        const newRsvp: Rsvp = { id: Date.now(), eventId: id, userId: 1, status, createdAt: new Date().toISOString() }; // Assume user 1
        memoryStore.rsvps.push(newRsvp);
        return newRsvp;
    })),
};

// --- Admin API ---
export const adminApi = {
  list: <T>(table: string): Promise<T[]> =>
    apiFetch<T[]>(`/admin/${table}`).catch(handleApiError(() => (memoryStore as any)[table] || [])),
  create: <T>(table: string, data: any): Promise<T> =>
    apiFetch<T>(`/admin/${table}`, { method: 'POST', body: JSON.stringify(data) }).catch(handleApiError(() => {
        const newItem = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
        (memoryStore as any)[table].push(newItem);
        return newItem;
    })),
  update: <T>(table: string, id: number, data: any): Promise<T> =>
    apiFetch<T>(`/admin/${table}/${id}`, { method: 'PUT', body: JSON.stringify(data) }).catch(handleApiError(() => {
        const tableData = (memoryStore as any)[table];
        const index = tableData.findIndex((item: any) => item.id === id);
        if (index === -1) throw new Error('Item not found');
        tableData[index] = { ...tableData[index], ...data };
        return tableData[index];
    })),
  delete: (table: string, id: number): Promise<void> =>
    apiFetch<void>(`/admin/${table}/${id}`, { method: 'DELETE' }).catch(handleApiError(() => {
        (memoryStore as any)[table] = (memoryStore as any)[table].filter((item: any) => item.id !== id);
    })),
};
