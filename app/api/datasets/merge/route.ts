import type { NextRequest } from "next/server";
import { runMerge, type MergeRequest } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MergeRequest;
    if (!body || typeof body !== "object" || !("op" in body)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 });
    }
    const dataset = runMerge(body);
    return Response.json({ dataset }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
