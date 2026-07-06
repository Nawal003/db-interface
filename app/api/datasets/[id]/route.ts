import type { NextRequest } from "next/server";
import { deleteDataset, renameDataset } from "@/lib/store";
import { reconcileById } from "@/lib/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext<"/api/datasets/[id]">,
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { name?: unknown };
    const name = body?.name;
    if (typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "Nom requis" }, { status: 400 });
    }
    const dataset = renameDataset(id, name);
    return Response.json({ dataset });
  } catch (e) {
    const message = (e as Error).message;
    return Response.json(
      { error: message },
      { status: message === "Jeu de données introuvable" ? 404 : 400 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/datasets/[id]">,
) {
  const { id } = await params;
  const dataset = reconcileById(id);
  if (!dataset) {
    return Response.json(
      { error: "Jeu de données introuvable" },
      { status: 404 },
    );
  }
  return Response.json({ dataset });
}

export async function DELETE(
  _req: Request,
  { params }: RouteContext<"/api/datasets/[id]">,
) {
  const { id } = await params;
  deleteDataset(id);
  return new Response(null, { status: 204 });
}
