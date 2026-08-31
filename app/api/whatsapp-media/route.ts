import { NextRequest, NextResponse } from "next/server";
import { autenticarWorkspace, exigirAtendimentoDoUsuario, exigirPermissao, respostaErroAcesso, segredoInternoWolf, supabaseServer } from "../_auth";

export const dynamic = "force-dynamic";
const WHATSAPP_URL = process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm",
  ogg: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8", txt: "text/plain; charset=utf-8", zip: "application/zip",
};

function cabecalhosMidia(filename: string, upstream: Headers) {
  const extensao = filename.split(".").pop()?.toLowerCase() || "";
  const recebidoCompleto = upstream.get("content-type") || "";
  const recebido = recebidoCompleto.split(";")[0].trim().toLowerCase();
  const generico = !recebido || recebido === "application/octet-stream" || recebido === "binary/octet-stream";
  const contentType = generico ? MIME_POR_EXTENSAO[extensao] || "application/octet-stream" : recebidoCompleto;
  const inline = /^(image|audio|video)\//i.test(contentType) || /^application\/pdf/i.test(contentType) || /^text\//i.test(contentType);
  const nomeAscii = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", (inline ? "inline" : "attachment") + '; filename="' + nomeAscii + '"; filename*=UTF-8' + String.fromCharCode(39, 39) + encodeURIComponent(filename));
  headers.set("Accept-Ranges", upstream.get("accept-ranges") || "bytes");
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

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
    try {
      await exigirAtendimentoDoUsuario(acesso, String(referencia.numero || ""), String(referencia.canal_id || ""));
    } catch (erroCanalHistorico) {
      const { data: atendimentoAtual, error: erroAtendimento } = await supabaseServer
        .from("atendimentos")
        .select("id")
        .eq("workspace_id", acesso.workspaceId)
        .eq("numero", String(referencia.numero || ""))
        .ilike("atendente", acesso.email)
        .limit(1)
        .maybeSingle();
      if (erroAtendimento) throw erroAtendimento;
      if (!atendimentoAtual) throw erroCanalHistorico;
    }
    const range = req.headers.get("range");
    const upstream = await fetch(`${WHATSAPP_URL}/audios/${encodeURIComponent(filename)}`, { cache: "no-store", headers: { "ngrok-skip-browser-warning": "true", "x-wolf-internal-secret": segredoInternoWolf(), ...(range ? { Range: range } : {}) } });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: `Mídia indisponível (${upstream.status})` }, { status: upstream.status === 404 ? 404 : 502 });
    const headers = cabecalhosMidia(filename, upstream.headers);
    return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error) { const item = respostaErroAcesso(error); console.error("[whatsapp-media]", item.message); return NextResponse.json({ error: item.message }, { status: item.status }); }
}
