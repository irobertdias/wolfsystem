import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const supabaseContratos = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SUPER_ADMIN = "robert.dias@live.com";

export type AcessoContratos = {
  workspaceId: string;
  email: string;
  superAdmin: boolean;
};

async function exigirModuloContratos(workspaceId: string, superAdmin: boolean) {
  if (superAdmin) return;
  const { data: workspace } = await supabaseContratos
    .from("workspaces").select("owner_email").eq("username", workspaceId).maybeSingle();
  const ownerEmail = String(workspace?.owner_email || "").toLowerCase();
  if (ownerEmail === SUPER_ADMIN) return;
  const { data: cadastro } = await supabaseContratos
    .from("cadastros").select("modulo_contratos_assinaturas").ilike("email", ownerEmail).maybeSingle();
  if (cadastro?.modulo_contratos_assinaturas !== true) {
    throw Object.assign(new Error("Módulo Contratos e Assinaturas não contratado para este workspace"), { statusCode: 403 });
  }
}
export async function autenticarContratos(
  request: NextRequest,
  workspaceSolicitado = ""
): Promise<AcessoContratos> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw Object.assign(new Error("Não autenticado"), { statusCode: 401 });
  }
  const token = authorization.slice(7).trim();
  const { data: { user }, error } = await supabaseContratos.auth.getUser(token);
  if (error || !user?.email) {
    throw Object.assign(new Error("Sessão inválida"), { statusCode: 401 });
  }

  const email = user.email.toLowerCase();
  const superAdmin = email === SUPER_ADMIN;
  const solicitado = String(workspaceSolicitado || "").trim();

  const { data: workspaceDono } = await supabaseContratos
    .from("workspaces")
    .select("username")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (workspaceDono?.username) {
    if (solicitado && solicitado !== workspaceDono.username && !superAdmin) {
      throw Object.assign(new Error("Workspace não autorizado"), { statusCode: 403 });
    }
    const workspaceId = solicitado && superAdmin ? solicitado : workspaceDono.username;
    await exigirModuloContratos(workspaceId, superAdmin);
    return { workspaceId, email, superAdmin };
  }

  let vinculoQuery = supabaseContratos
    .from("usuarios_workspace")
    .select("workspace_id,perfil,grupo_id")
    .eq("email", user.email)
    .order("created_at", { ascending: false })
    .limit(1);
  if (solicitado) vinculoQuery = vinculoQuery.eq("workspace_id", solicitado);
  const { data: vinculo } = await vinculoQuery.maybeSingle();

  if (superAdmin && solicitado) {
    const { data: workspace } = await supabaseContratos
      .from("workspaces").select("username").eq("username", solicitado).maybeSingle();
    if (!workspace) throw Object.assign(new Error("Workspace não encontrado"), { statusCode: 404 });
    await exigirModuloContratos(solicitado, true);
    return { workspaceId: solicitado, email, superAdmin: true };
  }

  if (!vinculo?.workspace_id) {
    throw Object.assign(new Error("Usuário sem workspace"), { statusCode: 403 });
  }
  if (vinculo.perfil === "Administrador") {
    await exigirModuloContratos(vinculo.workspace_id, superAdmin);
    return { workspaceId: vinculo.workspace_id, email, superAdmin };
  }

  let permitido = false;
  if (vinculo.grupo_id) {
    const { data: grupo } = await supabaseContratos
      .from("grupos_permissao").select("permissoes").eq("id", vinculo.grupo_id).maybeSingle();
    permitido = grupo?.permissoes?.contratos_acessar === true;
  }
  if (!permitido) {
    throw Object.assign(new Error("Sem permissão para acessar Contratos"), { statusCode: 403 });
  }
  await exigirModuloContratos(vinculo.workspace_id, superAdmin);
  return { workspaceId: vinculo.workspace_id, email, superAdmin };
}

export function respostaErroContratos(error: unknown) {
  const item = error as { message?: string; statusCode?: number };
  const status = Number(item?.statusCode || 500);
  return { status: status >= 400 && status <= 599 ? status : 500, message: item?.message || "Erro interno" };
}