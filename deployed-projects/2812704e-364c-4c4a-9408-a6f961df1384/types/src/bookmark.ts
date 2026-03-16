export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  tags: string[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface CreateBookmarkInput {
  title: string;
  url: string;
  description?: string | null;
  tags?: string[];
}

export interface UpdateBookmarkInput {
  title?: string;
  url?: string;
  description?: string | null;
  tags?: string[];
}
