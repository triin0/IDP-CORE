export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
}
