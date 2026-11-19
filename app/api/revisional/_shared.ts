import { randomBytes, randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { SUPER_ADMIN_EMAIL, exigirPermissao, supabaseServer, type AcessoWolf } from "../_auth";

/**
 * Módulo liberado pelo super admin (cadastros.modulo_revisional) + permissão do
 * usuário (revisional_acessar; dono/administrador sempre têm).
 * O workspace do próprio admin Wolf tem tudo liberado, como no useModulos.
 */
export async function exigirRevisional(acesso: AcessoWolf) {
  if (!acesso.isSuperAdmin) {
    const { data: ws } = await supabaseServer
      .from("workspaces").select("owner_email").eq("username", acesso.workspaceId).maybeSingle();
    const dono = String(ws?.owner_email || "").toLowerCase();
    if (!dono) throw Object.assign(new Error("Workspace não encontrado"), { statusCode: 404 });
    if (dono !== SUPER_ADMIN_EMAIL) {
      const { data: cad, error } = await supabaseServer
        .from("cadastros").select("modulo_revisional").ilike("email", dono).maybeSingle();
      if (error || cad?.modulo_revisional !== true) {
        throw Object.assign(new Error("Módulo Revisional não liberado para este workspace"), { statusCode: 403 });
      }
    }
  }
  exigirPermissao(acesso, "revisional_acessar");
}

const ehGestor = (a: AcessoWolf) => a.isSuperAdmin || a.isDono || a.isAdministrador || a.perfil === "Administrador";
/** Taxas, honorários, marca e modelos de documentos: gestor ou permissão "revisional_config". */
export const podeConfigurarRevisional = (a: AcessoWolf) => ehGestor(a) || a.permissoes.revisional_config === true;
/** Excluir propostas: gestor ou permissão "revisional_excluir". */
export const podeExcluirRevisional = (a: AcessoWolf) => ehGestor(a) || a.permissoes.revisional_excluir === true;

/** Configuração do CRM revisional (honorários, modalidades, modelos de documentos) em fin_config.config.revisional. */
export async function lerConfigCrm(workspaceId: string): Promise<Record<string, any>> {
  const { data } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", workspaceId).maybeSingle();
  return ((data as any)?.config?.revisional as Record<string, any>) || {};
}

export type ConfigRevisional = {
  workspace_id: string;
  empresa_nome: string;
  empresa_cnpj: string;
  whatsapp_contato: string;
  validade_horas: number;
  percentual_imovel: number;
  percentual_veiculo: number;
  taxa_veiculo: number;
  metodo_veiculo: "percentual" | "taxa";
  marca: MarcaRevisional;
};

/** Identidade visual do escritório no link e no PDF da proposta. */
export type MarcaRevisional = { logo?: string; cor?: string; cor2?: string };

const HEX = /^#[0-9a-f]{6}$/i;
/** Valida a marca recebida: logo em data URL de imagem (até ~400 KB) ou https; cores #RRGGBB. */
export function limparMarca(m: any): MarcaRevisional {
  const out: MarcaRevisional = {};
  const logo = String(m?.logo || "");
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo) && logo.length <= 550_000) out.logo = logo;
  else if (/^https:\/\/[^\s"']{5,500}$/.test(logo)) out.logo = logo;
  if (HEX.test(String(m?.cor || ""))) out.cor = String(m.cor).toUpperCase();
  if (HEX.test(String(m?.cor2 || ""))) out.cor2 = String(m.cor2).toUpperCase();
  return out;
}

export const CONFIG_PADRAO: Omit<ConfigRevisional, "workspace_id"> = {
  empresa_nome: "",
  empresa_cnpj: "",
  whatsapp_contato: "",
  validade_horas: 24,
  percentual_imovel: 35,
  percentual_veiculo: 35,
  taxa_veiculo: 1.5,
  metodo_veiculo: "percentual",
  marca: {},
};

export async function lerConfig(workspaceId: string): Promise<ConfigRevisional> {
  const { data, error } = await supabaseServer
    .from("revisional_config").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw error;
  const base = { workspace_id: workspaceId, ...CONFIG_PADRAO, ...(data || {}) };
  return {
    ...base,
    validade_horas: Number(base.validade_horas),
    percentual_imovel: Number(base.percentual_imovel),
    percentual_veiculo: Number(base.percentual_veiculo),
    taxa_veiculo: Number(base.taxa_veiculo),
    marca: limparMarca((base as any).marca),
  };
}

export function novoToken() {
  return randomBytes(32).toString("base64url"); // 43 chars
}

export function novoNumero() {
  const h = randomUUID().replace(/-/g, "").toUpperCase();
  return `${h.slice(0, 4)}${h.slice(4, 5)}-${h.slice(5, 9)}`;
}

export function tokenValido(token: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

/**
 * Subdomínio próprio do escritório, usado só no link da proposta enviado ao cliente
 * (o sistema continua em app.wolfgyn.com.br). O host precisa estar no projeto da Vercel
 * e na lista do proxy.ts (HOSTS_PROPOSTA).
 */
const SUBDOMINIOS_ATIVOS = true;
export const SUBDOMINIO_PROPOSTA: Record<string, string> = {
  clickconsultoria: "clickconsultoria.wolfgyn.com.br",
  aproveconsultoria: "aproveconsultoria.wolfgyn.com.br",
};

/** Link público. Usa o subdomínio do escritório; senão o rev.* (NEXT_PUBLIC_REVISIONAL_URL). */
export function linkPublico(request: NextRequest, token: string, workspaceId?: string) {
  // Domínio novo: adicionar no projeto "wolfsystem" da Vercel antes de colocar na lista.
  const proprio = SUBDOMINIOS_ATIVOS && workspaceId ? SUBDOMINIO_PROPOSTA[workspaceId] : "";
  if (proprio) return `https://${proprio}/p/${token}`;
  const base = (process.env.NEXT_PUBLIC_REVISIONAL_URL || "").replace(/\/+$/, "");
  if (base) return `${base}/p/${token}`;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  if (host.startsWith("rev.")) return `${proto}://${host}/p/${token}`;
  return `${proto}://${host}/revisional/p/${token}`;
}

export function statusEfetivo(p: { status: string; expira_em: string }) {
  if ((p.status === "enviada" || p.status === "visualizada") && new Date(p.expira_em).getTime() <= Date.now()) {
    return "expirada";
  }
  return p.status;
}

export const SEM_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };
