import type { NextRequest } from "next/server";
import { reconcileAll } from "@/lib/reconcile";
import { importSource } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ datasets: reconcileAll() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { path?: unknown };
    const filePath = body?.path;
    if (typeof filePath !== "string" || !filePath.trim()) {
      return Response.json({ error: "Chemin requis" }, { status: 400 });
    }
    const datasets = importSource(filePath);
    // `dataset` (first table) drives selection; `datasets` reports all created.
    return Response.json({ dataset: datasets[0], datasets }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
