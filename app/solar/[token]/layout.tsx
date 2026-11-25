import type { Metadata } from "next";
import { supabaseServer } from "../../api/_auth";

/** Prévia do link no WhatsApp: nome da empresa solar em vez do Wolf. Não conta como visualização. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return { title: "Proposta de energia solar" };
  const { data: p } = await supabaseServer.from("proposta").select("workspace_id,dados_customizados").eq("dados_customizados->solar->>token", token).limit(1).maybeSingle();
  if (!p) return { title: "Proposta de energia solar" };
  const [{ data: c }, { data: w }] = await Promise.all([
    supabaseServer.from("fin_config").select("config").eq("workspace_id", (p as any).workspace_id).maybeSingle(),
    supabaseServer.from("workspaces").select("nome").eq("username", (p as any).workspace_id).maybeSingle(),
  ]);
  const emp = (c as any)?.config?.solar?.empresa || {};
  const nome = String(emp.nome || (w as any)?.nome || "Energia solar").trim();
  const r = (p as any).dados_customizados?.solar?.resultado;
  const titulo = `${nome} | Sua proposta de energia solar`;
  const descricao = r ? `Sistema de ${String(r.kwp).replace(".", ",")} kWp com economia estimada de ${Number(r.economia_mes).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por mês.` : `Proposta de energia solar preparada pela ${nome}.`;
  const logo = /^https?:\/\//.test(String(emp.logo || "")) ? String(emp.logo) : undefined;
  return {
    title: titulo, description: descricao, robots: { index: false, follow: false },
    icons: logo ? { icon: logo, apple: logo } : undefined,
    openGraph: { title: titulo, description: descricao, siteName: nome, type: "website", images: logo ? [{ url: logo, alt: nome }] : [] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
