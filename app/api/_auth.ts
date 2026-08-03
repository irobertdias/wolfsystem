import { createClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const SUPER_ADMIN_EMAIL = "robert.dias@live.com";
export const WOLF_SESSION_COOKIE = "wolf_access_token";
export const supabaseServer = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

export type AcessoWolf = { user: User; email: string; workspaceId: string; isSuperAdmin: boolean; isDono: boolean; isAdministrador: boolean; perfil: string; grupoId: string | null; permissoes: Record<string, boolean> };
const PERMISSOES_PADRAO_ATENDENTE = new Set([
  "chat_proprio", "chat_interno", "respostas_rapidas", "transferir_chat", "finalizar_chat",
  "contatos_ver", "dashboard", "vendas_proprio", "proposta_criar", "bater_ponto", "voip_usar",
  "config_proprio", "crm_acessar", "chatbot_acessar", "telefonia_acessar",
]);
const NEGADAS_PADRAO_SUPERVISOR = new Set([
  "conexoes", "usuarios_gerenciar", "grupos_permissao", "configuracoes_workspace", "voip_conexoes",
  "administrador", "contratos_acessar", "contratos_criar", "contratos_editar", "contratos_reenviar",
  "contratos_excluir", "contratos_baixar", "contratos_configurar",
]);
function permissoesPadraoDoPerfil(perfil: string) {
  if (perfil === "Supervisor") {
    return new Proxy({} as Record<string, boolean>, { get: (_alvo, chave) => typeof chave === "string" && !NEGADAS_PADRAO_SUPERVISOR.has(chave) });
  }
  if (perfil === "Atendente" || !perfil) {
    return Object.fromEntries([...PERMISSOES_PADRAO_ATENDENTE].map((chave) => [chave, true]));
  }
  return {};
}
function falhar(message: string, statusCode: number) { return Object.assign(new Error(message), { statusCode }); }
function tokenDaRequisicao(request: NextRequest) { const authorization = request.headers.get("authorization") || ""; return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : request.cookies.get(WOLF_SESSION_COOKIE)?.value || ""; }

export async function autenticarUsuario(request: NextRequest) {
  const token = tokenDaRequisicao(request);
  if (!token) throw falhar("Não autenticado", 401);
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);
  if (error || !user?.email) throw falhar("Sessão inválida", 401);
  const email = user.email.toLowerCase();
  return { user, email, isSuperAdmin: email === SUPER_ADMIN_EMAIL };
}

export async function autenticarWorkspace(request: NextRequest, workspaceSolicitado = ""): Promise<AcessoWolf> {
  const identidade = await autenticarUsuario(request);
  const solicitado = String(workspaceSolicitado || "").trim();
  if (identidade.isSuperAdmin && solicitado) {
    const { data } = await supabaseServer.from("workspaces").select("username").eq("username", solicitado).maybeSingle();
    if (!data) throw falhar("Workspace não encontrado", 404);
    return { ...identidade, workspaceId: solicitado, isDono: true, isAdministrador: true, perfil: "Administrador", grupoId: null, permissoes: { administrador: true } };
  }
  const { data: dono } = await supabaseServer.from("workspaces").select("username,ativo").eq("owner_id", identidade.user.id).limit(1).maybeSingle();
  if (dono?.username) {
    if (dono.ativo !== true) throw falhar("Workspace aguardando autorização ou desativado", 403);
    if (solicitado && solicitado !== dono.username) throw falhar("Workspace não autorizado", 403);
    return { ...identidade, workspaceId: dono.username, isDono: true, isAdministrador: true, perfil: "Administrador", grupoId: null, permissoes: { administrador: true } };
  }
  let query = supabaseServer.from("usuarios_workspace").select("workspace_id,perfil,grupo_id").ilike("email", identidade.email).order("created_at", { ascending: false }).limit(1);
  if (solicitado) query = query.eq("workspace_id", solicitado);
  const { data: vinculo } = await query.maybeSingle();
  if (!vinculo?.workspace_id) throw falhar("Usuário sem acesso a este workspace", 403);
  const { data: workspaceVinculado } = await supabaseServer.from("workspaces").select("ativo").eq("username", vinculo.workspace_id).maybeSingle();
  if (workspaceVinculado?.ativo !== true) throw falhar("Workspace aguardando autorização ou desativado", 403);
  let permissoes: Record<string, boolean> = {};
  if (vinculo.grupo_id) {
    const { data: grupo } = await supabaseServer.from("grupos_permissao").select("permissoes").eq("id", vinculo.grupo_id).eq("workspace_id", vinculo.workspace_id).maybeSingle();
    permissoes = (grupo?.permissoes || {}) as Record<string, boolean>;
  } else {
    permissoes = permissoesPadraoDoPerfil(String(vinculo.perfil || "Atendente"));
  }
  // Administrador com grupo respeita exatamente o grupo; bypass total só sem grupo.
  const isAdministrador = vinculo.perfil === "Administrador" && !vinculo.grupo_id;
  return { ...identidade, workspaceId: vinculo.workspace_id, isDono: false, isAdministrador, perfil: String(vinculo.perfil || "Atendente"), grupoId: vinculo.grupo_id ? String(vinculo.grupo_id) : null, permissoes: isAdministrador ? { ...permissoes, administrador: true } : permissoes };
}

export async function exigirModulo(acesso: AcessoWolf, coluna: string) {
  if (acesso.isSuperAdmin) return;
  if (!/^modulo_[a-z0-9_]+$/.test(coluna)) throw falhar("Módulo inválido", 400);
  const { data: workspace } = await supabaseServer.from("workspaces").select("owner_email").eq("username", acesso.workspaceId).maybeSingle();
  if (!workspace?.owner_email) throw falhar("Workspace não encontrado", 404);
  const { data: cadastro, error } = await supabaseServer.from("cadastros").select(coluna).ilike("email", workspace.owner_email).maybeSingle();
  if (error) throw error;
  if ((cadastro as Record<string, unknown> | null)?.[coluna] !== true) throw falhar("Módulo não contratado para este workspace", 403);
}
export async function exigirAtendimentoDoUsuario(acesso: AcessoWolf, numero: string, canalId: string) {
  if (acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || acesso.permissoes.chat_todos === true) return;
  exigirPermissao(acesso, "chat_proprio");
  const { data } = await supabaseServer.from("atendimentos").select("id,atendente").eq("workspace_id", acesso.workspaceId).eq("numero", numero).eq("canal_id", canalId).limit(1).maybeSingle();
  if (!data || String(data.atendente || "").toLowerCase() !== acesso.email) throw falhar("Este atendimento não está atribuído ao seu usuário", 403);
}

export function exigirPermissao(acesso: AcessoWolf, ...alternativas: string[]) { if (acesso.isSuperAdmin || acesso.isDono || acesso.isAdministrador || alternativas.some((chave) => acesso.permissoes[chave] === true)) return; throw falhar("Sem permissão para esta ação", 403); }
export function respostaErroAcesso(error: unknown) { const item = error as { message?: string; statusCode?: number }; const status = Number(item?.statusCode || 500); return { status: status >= 400 && status <= 599 ? status : 500, message: item?.message || "Erro interno" }; }
export function segredoInternoWolf() { const segredo = process.env.WOLF_INTERNAL_API_SECRET || process.env.WOLF_SIGNATURE_PROXY_SECRET || ""; if (!segredo) throw new Error("WOLF_INTERNAL_API_SECRET ausente na Vercel"); return segredo; }
