import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { urlPublica, buscarComTempo, NAVEGADOR } from "../_web";

// Baixa uma foto sugerida pela IA (o navegador não consegue por CORS) para o
// cadastro reduzir e guardar. Só imagens, até 6 MB, só endereços públicos.
export async function GET(request: NextRequest) {
  try {
    await autenticarWorkspace(request, request.nextUrl.searchParams.get("ws") || "");
    const url = request.nextUrl.searchParams.get("url") || "";
    if (!urlPublica(url)) return NextResponse.json({ success: false, error: "Endereço inválido" }, { status: 400 });
    // Algumas lojas recusam robôs: pede como navegador, vindo da própria loja.
    const r = await buscarComTempo(url, 9000, { headers: { "User-Agent": NAVEGADOR["User-Agent"], Accept: "image/avif,image/webp,image/*,*/*;q=0.8", Referer: new URL(url).origin + "/" } });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || !tipo.startsWith("image/")) return NextResponse.json({ success: false, error: "Não é uma imagem" }, { status: 415 });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 6 * 1024 * 1024) return NextResponse.json({ success: false, error: "Imagem grande demais" }, { status: 413 });
    return new NextResponse(buf, { headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=600" } });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
