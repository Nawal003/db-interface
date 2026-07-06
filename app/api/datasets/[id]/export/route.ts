import type { NextRequest } from "next/server";
import { buildExport, type ExportFormat } from "@/lib/export";
import { getDataset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = new Set<ExportFormat>(["csv", "json", "xlsx"]);

export async function GET(
  req: NextRequest,
  { params }: RouteContext<"/api/datasets/[id]/export">,
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
  const formatParam = (sp.get("format") ?? "csv") as ExportFormat;
  const format = FORMATS.has(formatParam) ? formatParam : "csv";

  // `keys` is a comma-separated list of internal column keys; default to all.
  const keysParam = sp.get("keys");
  const keys = keysParam
    ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
    : ds.columns.map((c) => c.key);

  try {
    const { filename, contentType, body } = buildExport(ds, {
      keys,
      format,
      q: sp.get("q") ?? undefined,
    });
    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
