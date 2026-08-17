import { NextRequest, NextResponse } from "next/server";
import { autenticarWorkspace, exigirModulo, exigirPermissao, respostaErroAcesso, segredoInternoWolf, supabaseServer, type AcessoWolf } from "../_auth";

const WHATSAPP_URL = process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "http://localhost:3001";
function normalizarRota(valor: string) { const rota = decodeURIComponent(valor || "status").replace(/^\/+|\/+$/g, ""); if (!/^[a-z0-9_\-/:]+$/i.test(rota) || rota.includes("..") || rota.includes("//")) throw Object.assign(new Error("Rota inválida"), { statusCode: 400 }); return rota; }
function exigirPermissaoDaRota(acesso: AcessoWolf, rota: string, metodo: string) {
  if (rota.startsWith("disparos/")) return exigirPermissao(acesso, "disparo_enviar");
  if (rota.startsWith("templates/") || rota.startsWith("waba/")) return exigirPermissao(acesso, "templates_waba", "conexoes");
  if (rota.startsWith("validar-numeros") || rota.startsWith("validacao-numeros")) return exigirPermissao(acesso, "disparo_enviar");
  if (rota === "qr-data") return exigirPermissao(acesso, "conexoes", "disparo_enviar");
  if (rota.startsWith("voip/ura/")) return exigirPermissao(acesso, "voip_campanhas", "voip_conexoes");
  if (rota === "voip/conexoes/listar" && metodo === "GET") return exigirPermissao(acesso, "voip_usar", "voip_conexoes");
  if (rota.startsWith("voip/conexao") || rota.startsWith("voip/conexoes")) return exigirPermissao(acesso, "voip_conexoes");
  if (rota.startsWith("voip/")) return exigirPermissao(acesso, "voip_usar", "voip_conexoes");
  if (rota.startsWith("canal/") || ["configurar-ia", "resetar", "reconectar", "sincronizar-conversas", "desconectar"].some((item) => rota === item || rota.startsWith(item + "/"))) return exigirPermissao(acesso, "conexoes");
  if (["enviar", "enviar-template", "enviar-midia-url", "apagar-mensagem", "assumir", "finalizar", "devolver"].includes(rota)) { if (rota === "finalizar") return exigirPermissao(acesso, "finalizar_chat"); if (rota === "devolver") return exigirPermissao(acesso, "transferir_chat"); return exigirPermissao(acesso, "chat_proprio", "chat_todos"); }
  if (metodo === "GET") return exigirPermissao(acesso, "chat_proprio", "chat_todos", "conexoes");
  exigirPermissao(acesso, "administrador");
}
async function exigirEscopoDoAtendimento(acesso: AcessoWolf, rota: string, body: Record<string, unknown>) {
  if (acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.chat_todos === true || rota === "assumir") return;
  if (acesso.permissoes.chat_proprio !== true) return;
  if (!["enviar", "enviar-template", "enviar-midia-url", "apagar-mensagem", "finalizar", "devolver"].includes(rota)) return;
  let numero = String(body.numero || ""); let canalId = String(body.canalId || body.canal_id || "");
  if (rota === "apagar-mensagem" && body.mensagemId) {
    const { data: mensagem } = await supabaseServer.from("mensagens").select("numero,canal_id").eq("id", body.mensagemId).eq("workspace_id", acesso.workspaceId).maybeSingle();
    numero = String(mensagem?.numero || ""); canalId = String(mensagem?.canal_id || "");
  }
  if (!numero || !canalId) throw Object.assign(new Error("Atendimento não identificado"), { statusCode: 403 });
  const { data: atendimento } = await supabaseServer.from("atendimentos").select("id,atendente").eq("workspace_id", acesso.workspaceId).eq("numero", numero).eq("canal_id", canalId).maybeSingle();
  if (!atendimento || String(atendimento.atendente || "").toLowerCase() !== acesso.email) throw Object.assign(new Error("Este atendimento não está atribuído ao seu usuário"), { statusCode: 403 });
}
function gerenciaTodasConexoesVoip(acesso: AcessoWolf) {
  return acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.voip_conexoes === true;
}

async function conexoesVoipPermitidas(acesso: AcessoWolf): Promise<number[] | null> {
  if (gerenciaTodasConexoesVoip(acesso)) return null;
  const { data, error } = await supabaseServer.from("usuarios_workspace")
    .select("voip_conexoes_acesso")
    .eq("workspace_id", acesso.workspaceId)
    .ilike("email", acesso.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.voip_conexoes_acesso)
    ? data.voip_conexoes_acesso.map(Number).filter(Number.isFinite)
    : [];
}

async function exigirConexaoVoipPermitida(acesso: AcessoWolf, rota: string, body: Record<string, unknown>) {
  if (!rota.startsWith("voip/") || gerenciaTodasConexoesVoip(acesso)) return;
  let valor = body.conexaoId ?? body.canalVoipId ?? body.conexao_id ?? body.canal_voip_id;
  const campanhaId = body.campanhaId ?? body.campanha_id;
  if ((valor === undefined || valor === null || valor === "") && campanhaId) {
    const { data: campanha, error } = await supabaseServer.from("voip_ura_campanhas")
      .select("conexao_id").eq("workspace_id", acesso.workspaceId).eq("id", campanhaId).maybeSingle();
    if (error) throw error;
    if (!campanha) throw Object.assign(new Error("Campanha de telefonia não encontrada"), { statusCode: 404 });
    valor = campanha.conexao_id;
  }
  if (valor === undefined || valor === null || valor === "") return;
  const conexaoId = Number(valor);
  const permitidas = await conexoesVoipPermitidas(acesso);
  if (!Number.isFinite(conexaoId) || !permitidas?.includes(conexaoId)) {
    throw Object.assign(new Error("Canal de telefonia não autorizado para este usuário"), { statusCode: 403 });
  }
}
async function encaminhar(request: NextRequest, metodo: "GET" | "POST") {
  try {
    const entrada = new URL(request.url); const rota = normalizarRota(entrada.searchParams.get("rota") || "status");
    const body = metodo === "POST" ? await request.json().catch(() => ({})) as Record<string, unknown> : {};
    const acesso = await autenticarWorkspace(request, String(entrada.searchParams.get("workspaceId") || body.workspaceId || body.workspace_id || "")); exigirPermissaoDaRota(acesso, rota, metodo);
    if (rota.startsWith("validar-numeros") || rota.startsWith("validacao-numeros")) await exigirModulo(acesso, "modulo_validacao_numeros");
    if (rota.startsWith("voip/")) await exigirModulo(acesso, "modulo_voip");
    if (rota === "disparos/criar") await exigirModulo(acesso, "modulo_disparos_web");
    if (rota === "disparos/criar-waba") await exigirModulo(acesso, "modulo_disparos_api");
    await exigirEscopoDoAtendimento(acesso, rota, body);
    await exigirConexaoVoipPermitida(acesso, rota, { ...body, campanhaId: body.campanhaId || entrada.searchParams.get("campanhaId"), conexaoId: body.conexaoId || entrada.searchParams.get("conexaoId") });
    // A identidade de quem assume um atendimento vem exclusivamente da sessao
    // autenticada. Nunca confie no e-mail enviado pelo navegador.
    const bodySeguro = rota === "assumir"
      ? { ...body, atendenteEmail: acesso.email }
      : body;
    const params = new URLSearchParams(); entrada.searchParams.forEach((valor, chave) => { if (chave !== "rota") params.set(chave, valor); }); params.set("workspaceId", acesso.workspaceId);
    const resp = await fetch(`${WHATSAPP_URL}/${rota}${params.size ? `?${params.toString()}` : ""}`, { method: metodo, cache: "no-store", headers: { "ngrok-skip-browser-warning": "true", "x-wolf-internal-secret": segredoInternoWolf(), ...(metodo === "POST" ? { "Content-Type": "application/json" } : {}) }, ...(metodo === "POST" ? { body: JSON.stringify({ ...bodySeguro, workspaceId: acesso.workspaceId, workspace_id: acesso.workspaceId }) } : {}) });
    const texto = await resp.text();
    if (!resp.ok) {
      let detalhe = texto;
      try {
        const json = JSON.parse(texto) as { error?: unknown; erro?: unknown; message?: unknown };
        detalhe = String(json.error || json.erro || json.message || texto);
      } catch {}
      return NextResponse.json({ success: false, status: "erro", upstreamStatus: resp.status, error: detalhe.slice(0, 500) }, { status: resp.status });
    }
    try {
      const json = JSON.parse(texto) as Record<string, any>;
      if (rota === "voip/conexoes/listar" && metodo === "GET") {
        const permitidas = await conexoesVoipPermitidas(acesso);
        if (permitidas !== null) {
          json.conexoes = Array.isArray(json.conexoes)
            ? json.conexoes.filter((conexao: any) => permitidas.includes(Number(conexao.id)))
            : [];
        }
      }
      if (rota === "voip/ura/campanhas" && metodo === "GET") {
        const permitidas = await conexoesVoipPermitidas(acesso);
        if (permitidas !== null) {
          json.campanhas = Array.isArray(json.campanhas)
            ? json.campanhas.filter((campanha: any) => permitidas.includes(Number(campanha.conexao_id)))
            : [];
        }
      }
      return NextResponse.json(json);
    } catch {
      return NextResponse.json({ success: false, error: "VPS não retornou JSON" }, { status: 502 });
    }
  } catch (error) { const item = respostaErroAcesso(error); console.error(`[proxy ${metodo}]`, item.message); return NextResponse.json({ success: false, status: "erro", error: item.message }, { status: item.status }); }
}
export async function GET(request: NextRequest) { return encaminhar(request, "GET"); }
export async function POST(request: NextRequest) { return encaminhar(request, "POST"); }
