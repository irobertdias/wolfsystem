import { randomBytes, randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseServer } from "../_auth";

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
};

export const CONFIG_PADRAO: Omit<ConfigRevisional, "workspace_id"> = {
  empresa_nome: "",
  empresa_cnpj: "",
  whatsapp_contato: "",
  validade_horas: 24,
  percentual_imovel: 35,
  percentual_veiculo: 35,
  taxa_veiculo: 1.5,
  metodo_veiculo: "percentual",
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

/** Link público. Em produção usa o subdomínio rev.* (NEXT_PUBLIC_REVISIONAL_URL). */
export function linkPublico(request: NextRequest, token: string) {
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
