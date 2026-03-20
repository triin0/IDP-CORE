export const entityTypeEnum = {
  enumValues: ['person', 'company'],
} as const;

export type EntityType = (typeof entityTypeEnum.enumValues)[number];

export interface Entity {
  id: number;
  name: string;
  type: EntityType;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  amount: number;
  description: string;
  date: string;
  sourceEntityId: number;
  destinationEntityId: number;
  createdAt: string;
  updatedAt: string;
  sourceEntity?: { name: string };
  destinationEntity?: { name: string };
}

export type NewEntity = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;
export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'sourceEntity' | 'destinationEntity'>;

export type AdminRecord = Record<string, any> & { id: number | string };
