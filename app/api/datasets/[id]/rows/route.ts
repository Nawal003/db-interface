import type { NextRequest } from "next/server";
import { getDataset, queryRows } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: RouteContext<"/api/datasets/[id]/rows">,
) {
  const { id } = await params;
  const ds = getDataset(id);
  if (!ds) {
    return Response.json(
      { error: "Jeu de données introuvable" },
      { status: 404 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const dirParam = sp.get("dir");
  const result = queryRows(ds, {
    q: sp.get("q") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    dir: dirParam === "desc" ? "desc" : dirParam === "asc" ? "asc" : undefined,
    page: numParam(sp.get("page")),
    pageSize: numParam(sp.get("pageSize")),
  });

  return Response.json({ columns: ds.columns, ...result });
}

function numParam(v: string | null): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
