export interface HttpRequest {
  method: string;
  path: string;
  headers: Partial<Record<string, string>>;
  body: Buffer;
  requestLines: string[];
}

export interface HttpResponse {
  status: 200 | 201 | 400 | 404 | 405 | 500;
  headers?: Record<string, string>;
  body?: Uint8Array;
}
