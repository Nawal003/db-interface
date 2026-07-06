import { resyncDataset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: RouteContext<"/api/datasets/[id]/resync">,
) {
  const { id } = await params;
  try {
    const dataset = await resyncDataset(id);
    return Response.json({ dataset });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
