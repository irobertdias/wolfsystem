import { supabaseServer, SUPER_ADMIN_EMAIL } from "../_auth";
import { nichoLiberado } from "../../lib/modulos-nicho";

// Módulos do nicho liberados pelo admin para o cliente (cadastros.nicho_opcoes),
// conferidos no servidor — esconder o botão na tela não basta.
export async function modulosLoja(ws: string) {
  const { data: w } = await supabaseServer.from("workspaces").select("owner_email,vertical").eq("username", ws).maybeSingle();
  const dono = String((w as any)?.owner_email || "").toLowerCase();
  const vertical = (w as any)?.vertical || "";
  if (dono === SUPER_ADMIN_EMAIL) return { liberado: (_k: string) => true, vertical };
  const { data: cad } = dono ? await supabaseServer.from("cadastros").select("nicho_opcoes").ilike("email", dono).maybeSingle() : { data: null };
  const opcoes = (cad as any)?.nicho_opcoes || {};
  return { liberado: (k: string) => nichoLiberado(opcoes, vertical, k), vertical };
}

/** Aplica os módulos na config da loja: sem "frete_calculado" o frete volta a ser fixo. */
export function lojaComModulos(loja: any, liberado: (k: string) => boolean) {
  if (liberado("frete_calculado") || loja?.frete?.modo !== "calculado") return loja;
  return { ...loja, frete: { ...loja.frete, modo: "fixo" } };
}
