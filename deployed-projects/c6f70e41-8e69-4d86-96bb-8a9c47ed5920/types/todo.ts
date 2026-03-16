export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface CreateTodoInput {
  title: string;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}
