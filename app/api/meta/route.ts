import { NextRequest, NextResponse } from "next/server";
import {
  autenticarWorkspace,
  exigirAtendimentoDoUsuario,
  exigirPermissao,
  respostaErroAcesso,
  segredoInternoWolf,
  supabaseServer,
} from "../_auth";

export const dynamic = "force-dynamic";

const META_URL = process.env.META_URL || process.env.NEXT_PUBLIC_META_URL || "http://localhost:3002";
const ROTAS_POST = new Set(["send/texto", "send/enviar-midia-arquivo", "send/marcar-lida", "auth/listar-pages", "auth/conectar-pages"]);

function rotaNormalizada(request: NextRequest) {
  return String(new URL(request.url).searchParams.get("rota") || "").replace(/^\/+|\/+$/g, "");
}

function headersInternos(contentType = "") {
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    "x-wolf-internal-secret": segredoInternoWolf(),
  };
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  try {
    if (rotaNormalizada(request) !== "midia") {
      return NextResponse.json({ success: false, error: "Rota Meta invalida" }, { status: 404 });
    }

    const filename = String(params.get("filename") || "");
    if (!filename || filename !== filename.replace(/\\/g, "/").split("/").pop()) {
      return NextResponse.json({ success: false, error: "Nome de midia invalido" }, { status: 400 });
    }

    const acesso = await autenticarWorkspace(request, params.get("workspaceId") || "");
    exigirPermissao(acesso, "chat_proprio", "chat_todos");

    const { data: referencias, error } = await supabaseServer
      .from("mensagens")
      .select("numero,canal_id,mensagem")
      .eq("workspace_id", acesso.workspaceId)
      .ilike("mensagem", `%${filename}%`)
      .limit(20);
    if (error) throw error;
    const referencia = (referencias || []).find((item) => String(item.mensagem || "").includes(filename));
    if (!referencia) {
      return NextResponse.json({ success: false, error: "Midia nao pertence a este workspace" }, { status: 403 });
    }

    await exigirAtendimentoDoUsuario(acesso, String(referencia.numero || ""), String(referencia.canal_id || ""));

    const range = request.headers.get("range");
    const upstream = await fetch(`${META_URL}/midia/${encodeURIComponent(filename)}`, {
      cache: "no-store",
      headers: { ...headersInternos(), ...(range ? { Range: range } : {}) },
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ success: false, error: `Midia indisponivel (${upstream.status})` }, { status: upstream.status === 404 ? 404 : 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    for (const name of ["content-length", "content-range", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (error) {
    const item = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: item.message }, { status: item.status });
  }
}

export async function POST(request: NextRequest) {
  const rota = rotaNormalizada(request);
  try {
    if (!ROTAS_POST.has(rota)) {
      return NextResponse.json({ success: false, error: "Rota Meta invalida" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const entrada = await request.formData();
      const acesso = await autenticarWorkspace(request, String(entrada.get("workspaceId") || ""));
      exigirPermissao(acesso, "chat_proprio", "chat_todos");
      const numero = String(entrada.get("recipientId") || "");
      const canalId = String(entrada.get("canalId") || "");
      await exigirAtendimentoDoUsuario(acesso, numero, canalId);

      const saida = new FormData();
      for (const [chave, valor] of entrada.entries()) saida.append(chave, valor);
      saida.set("workspaceId", acesso.workspaceId);

      const upstream = await fetch(`${META_URL}/${rota}`, {
        method: "POST",
        body: saida,
        headers: headersInternos(),
      });
      const data = await upstream.json().catch(() => ({ success: false, error: "Resposta invalida do Wolf Meta" }));
      return NextResponse.json(data, { status: upstream.status });
    }

    const body = await request.json();
    const acesso = await autenticarWorkspace(request, String(body.workspaceId || ""));
    if (rota.startsWith("auth/")) {
      exigirPermissao(acesso, "conexoes");
    } else {
      exigirPermissao(acesso, "chat_proprio", "chat_todos");
      await exigirAtendimentoDoUsuario(acesso, String(body.recipientId || body.numero || ""), String(body.canalId || ""));
    }
    body.workspaceId = acesso.workspaceId;

    const upstream = await fetch(`${META_URL}/${rota}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: headersInternos("application/json"),
    });
    const data = await upstream.json().catch(() => ({ success: false, error: "Resposta invalida do Wolf Meta" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    const item = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: item.message }, { status: item.status });
  }
}

