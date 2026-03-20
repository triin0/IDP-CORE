import { Entity, Transaction } from '../types';

const now = new Date();

export const seedEntities: Entity[] = [
  {
    id: 1,
    name: 'Hyperion Dynamics',
    type: 'company',
    createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    name: 'Aria Chen',
    type: 'person',
    createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    name: 'Stellar Solutions Inc.',
    type: 'company',
    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    name: 'Leo Vance',
    type: 'person',
    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const seedTransactions: Transaction[] = [
  {
    id: 1,
    amount: 15000.00,
    description: 'Q1 Consulting Services',
    date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    sourceEntityId: 1,
    destinationEntityId: 3,
    createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    amount: 2500.50,
    description: 'Freelance Design Work',
    date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    sourceEntityId: 3,
    destinationEntityId: 2,
    createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    amount: 850.00,
    description: 'Software License Renewal',
    date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    sourceEntityId: 4,
    destinationEntityId: 1,
    createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    amount: 120000.00,
    description: 'Seed Round Investment',
    date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    sourceEntityId: 2,
    destinationEntityId: 1,
    createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
