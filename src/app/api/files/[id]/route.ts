import { NextResponse } from "next/server";
import { getCtx } from "@/lib/context";
import type { Resource } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Opens a private file: signed URL redirect (Supabase) or streamed from local demo storage. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  const [r] = await ctx.db.select<Resource>("resources", { eq: { id, user_id: ctx.userId } });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.url && !r.storage_path) return NextResponse.redirect(r.url);
  if (!r.storage_path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const signed = await ctx.files.signedUrl(r.storage_path);
  if (signed) return NextResponse.redirect(signed);
  const bytes = await ctx.files.read?.(r.storage_path);
  if (!bytes) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": r.mime_type ?? "application/octet-stream",
      "content-disposition": `inline; filename="${encodeURIComponent(r.file_name ?? "file")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
