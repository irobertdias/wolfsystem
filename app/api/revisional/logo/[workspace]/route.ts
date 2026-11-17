import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../_auth";

/** Logo do escritório (marca do Revisional) como imagem, para a prévia do link da proposta. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  if (!/^[a-z0-9_-]{2,60}$/i.test(workspace)) return new NextResponse(null, { status: 404 });
  const { data } = await supabaseServer.from("revisional_config").select("marca").eq("workspace_id", workspace).maybeSingle();
  const logo = String((data?.marca as any)?.logo || "");
  const m = logo.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (m) {
    return new NextResponse(Buffer.from(m[2], "base64"), {
      headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  }
  if (/^https:\/\//.test(logo)) return NextResponse.redirect(logo, 302);
  return new NextResponse(null, { status: 404 });
}
