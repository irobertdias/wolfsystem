import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso, supabaseServer } from "../../../_auth";
import { SEM_CACHE, exigirRevisional, lerConfig } from "../../_shared";
import { linhaCrmDaProposta } from "../../../../lib/revisional-contrato";

// PATCH { acao: "cancelar" | "renovar", horas? }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: "Proposta inválida" }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(body.workspace || ""));
    await exigirRevisional(acesso);

    const { data: proposta, error } = await supabaseServer
      .from("revisional_propostas").select("id,numero,tipo,status,consultor_email,consultor_nome,cliente_nome,cliente_documento,cliente_telefone,dados,resultado,empresa")
      .eq("id", id).eq("workspace_id", acesso.workspaceId).maybeSingle();
    if (error) throw error;
    if (!proposta) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    const gestor = acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.revisional_todas === true;
    if (!gestor && proposta.consultor_email !== acesso.email) {
      return NextResponse.json({ success: false, error: "Proposta de outro consultor" }, { status: 403 });
    }
    // Proposta aceita: garantir o cliente no CRM e marcar o contrato como gerado.
    if (proposta.status === "aceita" && (body.acao === "cliente_crm" || body.acao === "contrato_gerado")) {
      const dados = { ...((proposta.dados as any) || {}) };
      if (body.acao === "cliente_crm" && !dados.crm_proposta_id) {
        const { data: crm, error: erroCrm } = await supabaseServer.from("proposta")
          .insert([linhaCrmDaProposta(proposta as any, acesso.workspaceId)]).select("id").single();
        if (erroCrm) throw erroCrm;
        dados.crm_proposta_id = crm.id;
      }
      if (body.acao === "contrato_gerado") {
        dados.contrato_gerado = true;
        dados.contrato_gerado_em = new Date().toISOString();
      }
      const { error: erroDados } = await supabaseServer.from("revisional_propostas")
        .update({ dados, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", acesso.workspaceId);
      if (erroDados) throw erroDados;
      return NextResponse.json({ success: true, crm_proposta_id: dados.crm_proposta_id || null }, { headers: SEM_CACHE });
    }
    if (proposta.status === "aceita" || proposta.status === "recusada") {
      return NextResponse.json({ success: false, error: "O cliente já respondeu esta proposta" }, { status: 409 });
    }

    let update: Record<string, unknown>;
    if (body.acao === "cancelar") {
      update = { status: "cancelada" };
    } else if (body.acao === "renovar") {
      const config = await lerConfig(acesso.workspaceId);
      const horas = Math.min(720, Math.max(1, Number(body.horas) || config.validade_horas));
      update = {
        expira_em: new Date(Date.now() + horas * 3600_000).toISOString(),
        status: proposta.status === "cancelada" ? "enviada" : proposta.status,
      };
    } else {
      return NextResponse.json({ success: false, error: "Ação inválida" }, { status: 400 });
    }
    const { error: erroUpdate } = await supabaseServer
      .from("revisional_propostas").update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id).eq("workspace_id", acesso.workspaceId);
    if (erroUpdate) throw erroUpdate;
    return NextResponse.json({ success: true }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
