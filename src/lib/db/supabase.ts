import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TableName } from "../types";
import { DbError, type Db, type FileStore, type Filter, type SelectOptions } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(q: any, f?: Filter) {
  if (!f) return q;
  for (const [k, v] of Object.entries(f.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
  for (const [k, v] of Object.entries(f.in ?? {})) q = q.in(k, v);
  for (const [k, v] of Object.entries(f.lte ?? {})) q = q.lte(k, v);
  for (const [k, v] of Object.entries(f.gte ?? {})) q = q.gte(k, v);
  return q;
}

function wrap(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "23505") throw new DbError(error.message, "unique");
  if (error.code === "23503") throw new DbError(error.message, "fk");
  throw new DbError(error.message);
}

export function supabaseDb(client: SupabaseClient): Db {
  return {
    async select<T>(table: TableName, filter?: Filter, opts?: SelectOptions) {
      let q = applyFilter(client.from(table).select("*"), filter);
      for (const o of opts?.order ?? []) q = q.order(o.column, { ascending: o.ascending ?? true, nullsFirst: false });
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      wrap(error);
      return (data ?? []) as T[];
    },
    async insert<T>(table: TableName, rows: Record<string, unknown> | Record<string, unknown>[]) {
      const { data, error } = await client.from(table).insert(rows).select("*");
      wrap(error);
      return (data ?? []) as T[];
    },
    async update<T>(table: TableName, filter: Filter, patch: Record<string, unknown>) {
      const { data, error } = await applyFilter(client.from(table).update(patch), filter).select("*");
      wrap(error);
      return (data ?? []) as T[];
    },
    async remove(table: TableName, filter: Filter) {
      const { data, error } = await applyFilter(client.from(table).delete(), filter).select("*");
      wrap(error);
      return (data ?? []).length;
    },
  };
}

export const BUCKET = "diva-files";

export function supabaseFiles(client: SupabaseClient): FileStore {
  return {
    async upload(path, bytes, contentType) {
      const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error(`Upload failed: ${error.message}`);
    },
    async signedUrl(path) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    async remove(paths) {
      if (!paths.length) return;
      await client.storage.from(BUCKET).remove(paths);
    },
  };
}
