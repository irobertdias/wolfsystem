import type { Metadata } from "next";
import { headers } from "next/headers";
import { supabaseServer } from "../../../api/_auth";

/**
 * Prévia do link (WhatsApp, Instagram etc.): nome e logo do escritório em vez do
 * lobo da Wolf. Lê a proposta direto do banco, sem contar como visualização.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return { title: "Proposta" };
  const { data: p } = await supabaseServer
    .from("revisional_propostas").select("workspace_id,empresa").eq("token", token).maybeSingle();
  if (!p) return { title: "Proposta" };
  const { data: cfg } = await supabaseServer
    .from("revisional_config").select("empresa_nome,marca").eq("workspace_id", p.workspace_id).maybeSingle();
  const nome = String(cfg?.empresa_nome || (p.empresa as any)?.nome || "Proposta").trim();
  const temLogo = Boolean((cfg?.marca as any)?.logo);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "app.wolfgyn.com.br";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const logo = temLogo ? `${proto}://${host}/api/revisional/logo/${encodeURIComponent(p.workspace_id)}` : undefined;
  const titulo = `${nome} | Sua proposta`;
  const descricao = `Proposta de revisão do seu contrato preparada pela ${nome}.`;
  return {
    title: titulo,
    description: descricao,
    icons: logo ? { icon: logo, apple: logo } : undefined,
    openGraph: { title: titulo, description: descricao, siteName: nome, type: "website", images: logo ? [{ url: logo, alt: nome }] : [] },
    twitter: { card: "summary", title: titulo, description: descricao, images: logo ? [logo] : [] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
