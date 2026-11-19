import { NextResponse, type NextRequest } from "next/server";
import { autenticarWorkspace, respostaErroAcesso, supabaseServer } from "../../_auth";
import { SEM_CACHE, exigirRevisional, lerConfigCrm, podeConfigurarRevisional } from "../_shared";

// Configuração do CRM revisional (honorários, modalidades, modelos de documentos),
// guardada em fin_config.config.revisional. Passa pelo servidor porque, direto
// do navegador, o banco só libera fin_config para o dono/administrador.

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticarWorkspace(request, request.nextUrl.searchParams.get("workspace") || "");
    await exigirRevisional(acesso);
    const config = await lerConfigCrm(acesso.workspaceId);
    return NextResponse.json({ success: true, config, podeConfigurar: podeConfigurarRevisional(acesso) }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const acesso = await autenticarWorkspace(request, String(body.workspace || ""));
    await exigirRevisional(acesso);
    if (!podeConfigurarRevisional(acesso)) {
      return NextResponse.json({ success: false, error: "Sem permissão para alterar as configurações do Revisional" }, { status: 403 });
    }
    const revisional = body.config;
    if (!revisional || typeof revisional !== "object" || Array.isArray(revisional)) {
      return NextResponse.json({ success: false, error: "Configuração inválida" }, { status: 400 });
    }
    if (JSON.stringify(revisional).length > 1_500_000) {
      return NextResponse.json({ success: false, error: "Configuração grande demais" }, { status: 413 });
    }
    const { data } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", acesso.workspaceId).maybeSingle();
    const config = { ...(((data as any)?.config as Record<string, unknown>) || {}), revisional };
    const { error } = data
      ? await supabaseServer.from("fin_config").update({ config }).eq("workspace_id", acesso.workspaceId)
      : await supabaseServer.from("fin_config").insert({ workspace_id: acesso.workspaceId, regime: "simples", config });
    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: SEM_CACHE });
  } catch (error) {
    const { status, message } = respostaErroAcesso(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
