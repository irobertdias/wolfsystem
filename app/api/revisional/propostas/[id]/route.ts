import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso, supabaseServer } from "../../../_auth";
import { SEM_CACHE, exigirRevisional, lerConfig } from "../../_shared";

// PATCH { acao: "cancelar" | "renovar", horas? }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: "Proposta inválida" }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(body.workspace || ""));
    await exigirRevisional(acesso);

    const { data: proposta, error } = await supabaseServer
      .from("revisional_propostas").select("id,status,consultor_email")
      .eq("id", id).eq("workspace_id", acesso.workspaceId).maybeSingle();
    if (error) throw error;
    if (!proposta) return NextResponse.json({ success: false, error: "Proposta não encontrada" }, { status: 404 });
    const gestor = acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.revisional_todas === true;
    if (!gestor && proposta.consultor_email !== acesso.email) {
      return NextResponse.json({ success: false, error: "Proposta de outro consultor" }, { status: 403 });
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
