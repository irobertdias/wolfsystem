import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer, autenticarWorkspace, respostaErroAcesso } from "../../_auth";
import { lerConfigLoja } from "../_ia-chave";
import { urlWebhook, type Gateway } from "../_pagamento";

// Ajustes da loja → gateway de pagamento do lojista (Mercado Pago ou Asaas).
// A chave nunca volta inteira para o navegador.

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, request.nextUrl.searchParams.get("ws") || "");
    const { config } = await lerConfigLoja(acesso.workspaceId);
    const g = config.gateway_loja || null;
    return NextResponse.json({
      success: true,
      gateway: g?.gateway || null, ambiente: g?.ambiente || "producao", ativo: g ? g.ativo !== false : false,
      final: g?.token ? String(g.token).slice(-4) : "",
      webhook: urlWebhook(request.nextUrl.origin, acesso.workspaceId, (g?.gateway || "asaas") as Gateway),
    });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// POST { ws, gateway, token?, ambiente, ativo, remover? }
export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(b.ws || ""));
    if (!acesso.isSuperAdmin && !acesso.isDono && !acesso.isAdministrador) return NextResponse.json({ success: false, error: "Só o dono ou um administrador pode alterar o gateway." }, { status: 403 });
    const { existe, config } = await lerConfigLoja(acesso.workspaceId);
    const atual = config.gateway_loja || {};
    const novo = { ...config };
    if (b.remover === true) delete novo.gateway_loja;
    else {
      const gateway: Gateway = b.gateway === "asaas" ? "asaas" : "mercadopago";
      const token = String(b.token || "").trim() || (atual.gateway === gateway ? atual.token : "");
      if (token.length < 20) return NextResponse.json({ success: false, error: "Cole a chave (token) do gateway." }, { status: 400 });
      novo.gateway_loja = { gateway, token, ambiente: b.ambiente === "sandbox" ? "sandbox" : "producao", ativo: b.ativo !== false, atualizado_em: new Date().toISOString() };
    }
    const { error } = existe
      ? await supabaseServer.from("fin_config").update({ config: novo }).eq("workspace_id", acesso.workspaceId)
      : await supabaseServer.from("fin_config").insert({ workspace_id: acesso.workspaceId, regime: "simples", config: novo });
    if (error) throw error;
    const g = novo.gateway_loja;
    return NextResponse.json({ success: true, gateway: g?.gateway || null, ambiente: g?.ambiente || "producao", ativo: g ? g.ativo !== false : false, final: g?.token ? String(g.token).slice(-4) : "", webhook: urlWebhook(request.nextUrl.origin, acesso.workspaceId, (g?.gateway || "asaas") as Gateway) });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
