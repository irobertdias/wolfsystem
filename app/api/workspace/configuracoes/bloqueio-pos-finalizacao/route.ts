import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const SUPER_ADMIN_EMAIL = "robert.dias@live.com";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function autenticar(request: NextRequest, workspaceSolicitado: string) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Nao autenticado"), { statusCode: 401 });
  const token = authorization.slice(7).trim();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) throw Object.assign(new Error("Sessao invalida"), { statusCode: 401 });

  const workspaceId = String(workspaceSolicitado || "").trim();
  if (!workspaceId) throw Object.assign(new Error("workspaceId obrigatorio"), { statusCode: 400 });
  const email = user.email.toLowerCase();

  if (email === SUPER_ADMIN_EMAIL) {
    const { data: workspace } = await supabaseAdmin.from("workspaces")
      .select("username").eq("username", workspaceId).maybeSingle();
    if (!workspace) throw Object.assign(new Error("Workspace nao encontrado"), { statusCode: 404 });
    return { workspaceId };
  }

  const { data: workspace, error: workspaceError } = await supabaseAdmin.from("workspaces")
    .select("owner_id,owner_email").eq("username", workspaceId).maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) throw Object.assign(new Error("Workspace nao encontrado"), { statusCode: 404 });
  if (workspace.owner_id === user.id || String(workspace.owner_email || "").toLowerCase() === email) return { workspaceId };

  const { data: vinculo, error: vinculoError } = await supabaseAdmin.from("usuarios_workspace")
    .select("perfil,grupo_id").eq("workspace_id", workspaceId).ilike("email", user.email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (vinculoError) throw vinculoError;
  if (!vinculo) throw Object.assign(new Error("Usuario nao pertence a este workspace"), { statusCode: 403 });
  if (vinculo.perfil === "Administrador") return { workspaceId };

  let permitido = false;
  if (vinculo.grupo_id) {
    const { data: grupo, error: grupoError } = await supabaseAdmin.from("grupos_permissao")
      .select("permissoes").eq("id", vinculo.grupo_id).maybeSingle();
    if (grupoError) throw grupoError;
    permitido = grupo?.permissoes?.configuracoes_workspace === true;
  }
  if (!permitido) throw Object.assign(new Error("Sem permissao para alterar configuracoes do workspace"), { statusCode: 403 });
  return { workspaceId };
}

function respostaErro(error: unknown) {
  const item = error as { message?: string; statusCode?: number };
  const status = Number(item?.statusCode || 500);
  return NextResponse.json(
    { success: false, error: item?.message || "Erro interno" },
    { status: status >= 400 && status <= 599 ? status : 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await autenticar(request, request.nextUrl.searchParams.get("workspaceId") || "");
    const { data, error } = await supabaseAdmin.from("workspaces")
      .select("bloqueio_pos_finalizacao_horas").eq("username", acesso.workspaceId).single();
    if (error) throw error;
    const horas = data.bloqueio_pos_finalizacao_horas === null
      ? 24
      : Math.max(0, Math.min(720, Number(data.bloqueio_pos_finalizacao_horas) || 0));
    return NextResponse.json({ success: true, workspaceId: acesso.workspaceId, horas });
  } catch (error) {
    return respostaErro(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const acesso = await autenticar(request, String(body.workspaceId || ""));
    const horasInformadas = Number(body.horas);
    if (!Number.isInteger(horasInformadas) || horasInformadas < 0 || horasInformadas > 720) {
      return NextResponse.json({ success: false, error: "Informe uma quantidade inteira entre 0 e 720 horas" }, { status: 400 });
    }

    const { data: workspaceAtualizado, error: updateError } = await supabaseAdmin.from("workspaces")
      .update({ bloqueio_pos_finalizacao_horas: horasInformadas })
      .eq("username", acesso.workspaceId)
      .select("username,bloqueio_pos_finalizacao_horas").single();
    if (updateError) throw updateError;

    let atendimentosLiberados = 0;
    if (horasInformadas === 0) {
      const { data: liberados, error: liberarError } = await supabaseAdmin.from("atendimentos")
        .update({ bloqueado_ate: null, atendente_finalizou: null })
        .eq("workspace_id", acesso.workspaceId)
        .not("bloqueado_ate", "is", null).select("id");
      if (liberarError) throw liberarError;
      atendimentosLiberados = liberados?.length || 0;
    }

    return NextResponse.json({
      success: true,
      workspaceId: workspaceAtualizado.username,
      horas: Number(workspaceAtualizado.bloqueio_pos_finalizacao_horas) || 0,
      atendimentosLiberados,
    });
  } catch (error) {
    return respostaErro(error);
  }
}
