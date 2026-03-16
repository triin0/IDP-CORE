export type ArtStatus = 'draft' | 'published';

export interface Art {
  id: string;
  title: string;
  description: string;
  status: ArtStatus;
  content: string; // JSON string representing a simple vector scene
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface ListArtsResponse {
  items: Art[];
}

export interface CreateArtRequest {
  title: string;
  description: string;
  content: string;
  status?: ArtStatus;
}

export interface UpdateArtRequest {
  title?: string;
  description?: string;
  content?: string;
  status?: ArtStatus;
}
