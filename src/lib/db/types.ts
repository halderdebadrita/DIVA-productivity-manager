import type { TableName } from "../types";

export interface Filter {
  eq?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  lte?: Record<string, unknown>;
  gte?: Record<string, unknown>;
}

export interface SelectOptions {
  order?: { column: string; ascending?: boolean }[];
  limit?: number;
}

/** Minimal storage-agnostic table API used by every service. */
export interface Db {
  select<T>(table: TableName, filter?: Filter, opts?: SelectOptions): Promise<T[]>;
  insert<T>(table: TableName, rows: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]>;
  update<T>(table: TableName, filter: Filter, patch: Record<string, unknown>): Promise<T[]>;
  remove(table: TableName, filter: Filter): Promise<number>;
}

export interface FileStore {
  upload(path: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  /** Returns a short-lived URL (supabase) or null when the file is served by /api/files */
  signedUrl(path: string): Promise<string | null>;
  read?(path: string): Promise<Buffer | null>;
  remove(paths: string[]): Promise<void>;
}

export class DbError extends Error {
  constructor(
    message: string,
    public code: "unique" | "not_found" | "fk" | "unknown" = "unknown",
  ) {
    super(message);
  }
}

export function isUnique(e: unknown) {
  return e instanceof DbError && e.code === "unique";
}
