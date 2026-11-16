import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../_auth";

// Foto de um produto do catálogo (para a vendedora IA mandar no WhatsApp).
// GET ?ws=&id=  → a imagem (as fotos ficam como data URL na config da loja).
export async function GET(request: NextRequest) {
  const ws = request.nextUrl.searchParams.get("ws") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!ws || !id || ws.length > 120 || id.length > 40) return new NextResponse("não encontrado", { status: 404 });
  const { data } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle();
  const p = ((data as any)?.config?.loja?.produtos || []).find((x: any) => x.id === id && x.ativo !== false);
  const m = String(p?.foto || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new NextResponse("não encontrado", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=600" } });
}
