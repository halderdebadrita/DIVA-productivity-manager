import "server-only";
import { randomUUID } from "node:crypto";
import type { Ctx } from "../context";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from "../constants";
import type { Resource, ResourceEntity } from "../types";

export const listResources = (ctx: Ctx, entity?: { type: ResourceEntity; id?: string | null }) =>
  ctx.db.select<Resource>(
    "resources",
    {
      eq: {
        user_id: ctx.userId,
        ...(entity ? { entity_type: entity.type } : {}),
        ...(entity?.id ? { entity_id: entity.id } : {}),
      },
    },
    { order: [{ column: "created_at", ascending: false }] },
  );

export async function createLinkResource(ctx: Ctx, input: Record<string, unknown>) {
  const [r] = await ctx.db.insert<Resource>("resources", { ...input, user_id: ctx.userId });
  return r;
}

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-120);

export async function uploadResource(
  ctx: Ctx,
  file: File,
  meta: { title: string; kind: string; subject?: string | null; description?: string | null; entity_type: ResourceEntity | null; entity_id: string | null; section?: string | null },
) {
  if (!file || file.size === 0) throw new Error("Choose a file to upload");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files must be 20 MB or smaller");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_UPLOAD_MIME.includes(mime)) throw new Error("That file type isn't supported (PDF, images, Office docs, text, zip)");
  const path = `${ctx.userId}/${meta.entity_type ?? "misc"}/${randomUUID()}-${safeName(file.name)}`;
  await ctx.files.upload(path, await file.arrayBuffer(), mime);
  try {
    const [r] = await ctx.db.insert<Resource>("resources", {
      ...meta,
      title: meta.title || file.name,
      user_id: ctx.userId,
      storage_path: path,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
    });
    return r;
  } catch (e) {
    await ctx.files.remove([path]); // never leave an orphaned file
    throw e;
  }
}

export async function deleteResource(ctx: Ctx, id: string) {
  const [r] = await ctx.db.select<Resource>("resources", { eq: { id, user_id: ctx.userId } });
  if (!r) return;
  await ctx.db.remove("resources", { eq: { id, user_id: ctx.userId } });
  if (r.storage_path) await ctx.files.remove([r.storage_path]);
}

export async function deleteResourcesFor(ctx: Ctx, type: ResourceEntity, id: string) {
  const rs = await listResources(ctx, { type, id });
  if (!rs.length) return;
  await ctx.db.remove("resources", { eq: { user_id: ctx.userId, entity_type: type, entity_id: id } });
  await ctx.files.remove(rs.map((r) => r.storage_path).filter(Boolean) as string[]);
}
