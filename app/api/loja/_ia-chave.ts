import { supabaseServer } from "../_auth";

// Chave de IA própria do cadastro de produtos (Ajustes da loja), separada da IA
// do atendimento (Conexões). Guardada em fin_config.config.ia_cadastro.

export type ChaveIA = { ia: "gpt" | "claude"; chave: string };

export async function lerConfigLoja(ws: string) {
  const { data } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle();
  return { existe: !!data, config: ((data as any)?.config || {}) as Record<string, any> };
}

export async function lerChaveCadastro(ws: string): Promise<ChaveIA | null> {
  const { config } = await lerConfigLoja(ws);
  const c = config.ia_cadastro;
  return c?.chave && String(c.chave).length > 20 ? { ia: c.ia === "claude" ? "claude" : "gpt", chave: String(c.chave) } : null;
}
