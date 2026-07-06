import type { NextRequest } from "next/server";
import { browseDir } from "@/lib/browse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path");
  try {
    return Response.json(browseDir(p ?? undefined));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
