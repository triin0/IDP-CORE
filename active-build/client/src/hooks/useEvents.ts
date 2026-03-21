import { useState, useEffect, useCallback } from 'react';
import { eventsApi } from '../lib/api';
import type { Event } from '../../../../server/src/types';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await eventsApi.list();
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, error, refetch: fetchEvents };
}

export function useEvent(id: number) {
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await eventsApi.get(id);
      setEvent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const rsvp = async (status: 'yes' | 'no' | 'maybe') => {
    try {
      await eventsApi.rsvp(id, status);
      // Optionally refetch event data to show updated RSVP list
      fetchEvent();
    } catch (err) {
      console.error('Failed to RSVP', err);
      throw err; // re-throw for UI to handle
    }
  };

  return { event, isLoading, error, rsvp, refetch: fetchEvent };
}
