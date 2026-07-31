import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const supabaseContratos = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const SUPER_ADMIN = "robert.dias@live.com";
const LIMITES_CONTRATOS = { essencial: 20, profissional: 100, empresarial: null } as const;
type PlanoContratos = keyof typeof LIMITES_CONTRATOS;
export type PermissaoContratos = "contratos_acessar" | "contratos_criar" | "contratos_editar" | "contratos_reenviar" | "contratos_excluir" | "contratos_baixar" | "contratos_configurar";
const PERMISSOES_CONTRATOS_TOTAIS: Record<PermissaoContratos, boolean> = {
  contratos_acessar: true, contratos_criar: true, contratos_editar: true,
  contratos_reenviar: true, contratos_excluir: true, contratos_baixar: true,
  contratos_configurar: true,
};

export type AcessoContratos = {
  workspaceId: string;
  email: string;
  superAdmin: boolean;
  planoContratos: PlanoContratos;
  limiteMensalContratos: number | null;
  permissoesContratos: Record<string, boolean>;
};

async function exigirModuloContratos(workspaceId: string, superAdmin: boolean) {
  if (superAdmin) return { planoContratos: "empresarial" as const, limiteMensalContratos: null };
  const { data: workspace } = await supabaseContratos
    .from("workspaces").select("owner_email").eq("username", workspaceId).maybeSingle();
  const ownerEmail = String(workspace?.owner_email || "").toLowerCase();
  if (ownerEmail === SUPER_ADMIN) return { planoContratos: "empresarial" as const, limiteMensalContratos: null };
  const { data: cadastro, error } = await supabaseContratos
    .from("cadastros").select("modulo_contratos_assinaturas,modulo_contratos_plano").ilike("email", ownerEmail).maybeSingle();
  if (error) throw error;
  if (cadastro?.modulo_contratos_assinaturas !== true) {
    throw Object.assign(new Error("Módulo Contratos e Assinaturas não contratado para este workspace"), { statusCode: 403 });
  }
  const informado = String(cadastro.modulo_contratos_plano || "essencial");
  const plano = (["essencial", "profissional", "empresarial"].includes(informado) ? informado : "essencial") as PlanoContratos;
  return { planoContratos: plano, limiteMensalContratos: LIMITES_CONTRATOS[plano] };
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
    const modulo = await exigirModuloContratos(workspaceId, superAdmin);
    return { workspaceId, email, superAdmin, ...modulo, permissoesContratos: PERMISSOES_CONTRATOS_TOTAIS };
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
    const modulo = await exigirModuloContratos(solicitado, true);
    return { workspaceId: solicitado, email, superAdmin: true, ...modulo, permissoesContratos: PERMISSOES_CONTRATOS_TOTAIS };
  }

  if (!vinculo?.workspace_id) {
    throw Object.assign(new Error("Usuário sem workspace"), { statusCode: 403 });
  }
  if (vinculo.perfil === "Administrador") {
    const modulo = await exigirModuloContratos(vinculo.workspace_id, superAdmin);
    return { workspaceId: vinculo.workspace_id, email, superAdmin, ...modulo, permissoesContratos: PERMISSOES_CONTRATOS_TOTAIS };
  }

  let permitido = false;
  let permissoesGrupo: Record<string, boolean> = {};
  if (vinculo.grupo_id) {
    const { data: grupo } = await supabaseContratos
      .from("grupos_permissao").select("permissoes").eq("id", vinculo.grupo_id).maybeSingle();
    permissoesGrupo = grupo?.permissoes || {};
    permitido = permissoesGrupo.contratos_acessar === true;
  }
  if (!permitido) {
    throw Object.assign(new Error("Sem permissão para acessar Contratos"), { statusCode: 403 });
  }
  const modulo = await exigirModuloContratos(vinculo.workspace_id, superAdmin);
  return { workspaceId: vinculo.workspace_id, email, superAdmin, ...modulo, permissoesContratos: permissoesGrupo };
}

export function exigirPermissaoContratos(acesso: AcessoContratos, permissao: PermissaoContratos) {
  if (acesso.superAdmin || acesso.permissoesContratos[permissao] === true) return;
  throw Object.assign(new Error("Sem permissão para esta ação em Contratos e Assinaturas"), { statusCode: 403 });
}
export async function exigirFranquiaContratos(acesso: AcessoContratos) {
  if (acesso.limiteMensalContratos === null) return;
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseContratos
    .from("assinatura_wolf_sessoes")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", acesso.workspaceId)
    .gte("created_at", inicio.toISOString());
  if (error) throw error;
  const usados = Number(count || 0);
  if (usados >= acesso.limiteMensalContratos) {
    throw Object.assign(
      new Error(`Limite mensal do plano ${acesso.planoContratos} atingido (${usados}/${acesso.limiteMensalContratos}). Faça upgrade para continuar.`),
      { statusCode: 429 }
    );
  }
}
export function respostaErroContratos(error: unknown) {
  const item = error as { message?: string; statusCode?: number };
  const status = Number(item?.statusCode || 500);
  return { status: status >= 400 && status <= 599 ? status : 500, message: item?.message || "Erro interno" };
}