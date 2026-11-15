interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: any): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}
