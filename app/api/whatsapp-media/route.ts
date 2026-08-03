import { NextRequest, NextResponse } from "next/server";
import { autenticarWorkspace, exigirAtendimentoDoUsuario, exigirPermissao, respostaErroAcesso, segredoInternoWolf, supabaseServer } from "../_auth";

export const dynamic = "force-dynamic";
const WHATSAPP_URL = process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const filename = params.get("filename") || "";
  try {
    if (!filename || filename !== filename.replace(/\\/g, "/").split("/").pop()) return NextResponse.json({ error: "Nome de mídia inválido" }, { status: 400 });
    const acesso = await autenticarWorkspace(req, params.get("workspaceId") || "");
    exigirPermissao(acesso, "chat_proprio", "chat_todos");
    const { data: referencias, error } = await supabaseServer.from("mensagens").select("numero,canal_id,mensagem").eq("workspace_id", acesso.workspaceId).ilike("mensagem", `%${filename}%`).limit(20);
    if (error) throw error;
    const referencia = (referencias || []).find((item) => String(item.mensagem || "").includes(filename));
    if (!referencia) return NextResponse.json({ error: "Mídia não pertence a este workspace" }, { status: 403 });
    await exigirAtendimentoDoUsuario(acesso, String(referencia.numero || ""), String(referencia.canal_id || ""));
    const range = req.headers.get("range");
    const upstream = await fetch(`${WHATSAPP_URL}/audios/${encodeURIComponent(filename)}`, { cache: "no-store", headers: { "ngrok-skip-browser-warning": "true", "x-wolf-internal-secret": segredoInternoWolf(), ...(range ? { Range: range } : {}) } });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: `Mídia indisponível (${upstream.status})` }, { status: upstream.status === 404 ? 404 : 502 });
    const headers = new Headers(); headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream"); headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    for (const name of ["content-length", "content-range", "content-disposition"]) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
    headers.set("Cache-Control", "private, no-store, max-age=0"); headers.set("X-Content-Type-Options", "nosniff"); return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error) { const item = respostaErroAcesso(error); console.error("[whatsapp-media]", item.message); return NextResponse.json({ error: item.message }, { status: item.status }); }
}
