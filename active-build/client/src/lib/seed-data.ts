import type { User, Event, Rsvp } from '../../../../server/src/types';

const now = new Date();

export const seedUsers: User[] = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: 2,
    name: 'Bob Williams',
    email: 'bob@example.com',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 3,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

export const seedEvents: Event[] = [
  {
    id: 1,
    title: 'Tech Meetup: The Future of AI',
    description: 'Join us for a deep dive into the latest advancements in artificial intelligence, featuring guest speakers from top tech companies.',
    date: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    location: 'Innovation Hall, 123 Tech Street',
    capacity: 100,
    createdById: 1,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
  {
    id: 2,
    title: 'Design Workshop: UX for Startups',
    description: 'A hands-on workshop covering the fundamentals of user experience design for early-stage startups. Bring your laptops!',
    date: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    location: 'Creative Hub, 456 Design Avenue',
    capacity: 30,
    createdById: 2,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: 3,
    title: 'Starlight Gala Charity Event',
    description: 'An evening of elegance and philanthropy under the stars to support local community projects. Formal attire required.',
    date: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    location: 'The Grand Ballroom, 789 Charity Lane',
    capacity: 250,
    createdById: 1,
    createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export const seedRsvps: Rsvp[] = [
  { id: 1, eventId: 1, userId: 2, status: 'yes', createdAt: new Date().toISOString() },
  { id: 2, eventId: 1, userId: 3, status: 'maybe', createdAt: new Date().toISOString() },
  { id: 3, eventId: 2, userId: 1, status: 'yes', createdAt: new Date().toISOString() },
  { id: 4, eventId: 3, userId: 2, status: 'no', createdAt: new Date().toISOString() },
];
