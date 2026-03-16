export type ArtStyle =
  | 'pixel'
  | 'vector'
  | 'isometric'
  | 'handpainted'
  | 'lowpoly'
  | 'concept';

export type AssetType =
  | 'character'
  | 'environment'
  | 'icon'
  | 'item'
  | 'ui'
  | 'texture';

export interface ArtRequest {
  prompt: string;
  style: ArtStyle;
  assetType: AssetType;
  width: number;
  height: number;
  seed?: number;
}

export interface GeneratedArt {
  id: string;
  prompt: string;
  style: ArtStyle;
  assetType: AssetType;
  width: number;
  height: number;
  seed: number;
  imageDataUrl: string;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface ApiOk<T> {
  data: T;
}
