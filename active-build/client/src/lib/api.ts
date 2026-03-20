import { seedEntities, seedTransactions } from './seed-data';
import { Entity, Transaction, NewEntity, NewTransaction, AdminRecord } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// In-memory store for preview mode
let memoryEntities: Entity[] = JSON.parse(JSON.stringify(seedEntities));
let memoryTransactions: Transaction[] = JSON.parse(JSON.stringify(seedTransactions));

const apiRequest = async <T>(method: string, path: string, body?: any): Promise<T> => {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (!response.ok) {
      // This will be caught and fallback to in-memory store
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.warn(`API call failed for ${method} ${path}, falling back to in-memory store.`, error);
    throw error; // Re-throw to be handled by fallback logic
  }
};

// Entities API
export const getEntities = async (): Promise<Entity[]> => {
  try {
    return await apiRequest<Entity[]>('GET', '/entities');
  } catch (e) {
    return [...memoryEntities];
  }
};

export const createEntity = async (entity: NewEntity): Promise<Entity> => {
  try {
    return await apiRequest<Entity>('POST', '/entities', entity);
  } catch (e) {
    const newId = Math.max(0, ...memoryEntities.map(e => e.id)) + 1;
    const newEntity: Entity = { ...entity, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memoryEntities.push(newEntity);
    return newEntity;
  }
};

// Transactions API
export const getTransactions = async (): Promise<Transaction[]> => {
  try {
    return await apiRequest<Transaction[]>('GET', '/transactions');
  } catch (e) {
    const transactionsWithEntities = memoryTransactions.map(t => ({
      ...t,
      sourceEntity: { name: memoryEntities.find(e => e.id === t.sourceEntityId)?.name || 'Unknown' },
      destinationEntity: { name: memoryEntities.find(e => e.id === t.destinationEntityId)?.name || 'Unknown' },
    }));
    return transactionsWithEntities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
};

export const createTransaction = async (transaction: NewTransaction): Promise<Transaction> => {
  try {
    return await apiRequest<Transaction>('POST', '/transactions', transaction);
  } catch (e) {
    const newId = Math.max(0, ...memoryTransactions.map(t => t.id)) + 1;
    const newTransaction: Transaction = { ...transaction, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memoryTransactions.push(newTransaction);
    return newTransaction;
  }
};

// Admin API
const adminMemoryStore: Record<string, any[]> = {
  entities: memoryEntities,
  transactions: memoryTransactions,
};

export const getAdminTable = async (tableName: string): Promise<AdminRecord[]> => {
  try {
    return await apiRequest<AdminRecord[]>('GET', `/admin/${tableName}`);
  } catch (e) {
    return [...(adminMemoryStore[tableName] || [])];
  }
};

export const createAdminRecord = async (tableName: string, record: Omit<AdminRecord, 'id'>): Promise<AdminRecord> => {
  try {
    return await apiRequest<AdminRecord>('POST', `/admin/${tableName}`, record);
  } catch (e) {
    const table = adminMemoryStore[tableName];
    if (!table) throw new Error('Table not found in memory store');
    const newId = Math.max(0, ...table.map(r => r.id)) + 1;
    const newRecord = { ...record, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    table.push(newRecord);
    return newRecord;
  }
};

export const updateAdminRecord = async (tableName: string, id: number | string, record: Partial<AdminRecord>): Promise<AdminRecord> => {
  try {
    return await apiRequest<AdminRecord>('PUT', `/admin/${tableName}/${id}`, record);
  } catch (e) {
    const table = adminMemoryStore[tableName];
    if (!table) throw new Error('Table not found in memory store');
    const recordIndex = table.findIndex(r => r.id === id);
    if (recordIndex === -1) throw new Error('Record not found');
    table[recordIndex] = { ...table[recordIndex], ...record, updatedAt: new Date().toISOString() };
    return table[recordIndex];
  }
};

export const deleteAdminRecord = async (tableName: string, id: number | string): Promise<{ id: number | string }> => {
  try {
    return await apiRequest<{ id: number | string }>('DELETE', `/admin/${tableName}/${id}`);
  } catch (e) {
    const table = adminMemoryStore[tableName];
    if (!table) throw new Error('Table not found in memory store');
    const initialLength = table.length;
    adminMemoryStore[tableName] = table.filter(r => r.id !== id);
    if (table.length === initialLength) throw new Error('Record not found');
    return { id };
  }
};
