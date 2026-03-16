export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  public constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string): HttpError => new HttpError(400, 'BAD_REQUEST', message);
export const notFound = (message: string): HttpError => new HttpError(404, 'NOT_FOUND', message);
