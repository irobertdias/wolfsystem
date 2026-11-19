import type { Metadata } from "next";
import { supabaseServer } from "../../api/_auth";
import { modeloServicos } from "../../lib/orcamento";

/**
 * Prévia do link (WhatsApp etc.). Orçamento de serviços sai com o nome de quem
 * emite, sem a marca Wolf. Lê direto do banco, sem contar como visualização.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return { title: "Orçamento" };
  const { data: o } = await supabaseServer
    .from("wolf_orcamentos").select("cliente_nome,pagamento").eq("token", token).maybeSingle();
  const sv = modeloServicos(o?.pagamento as any);
  if (!o || !sv) return { title: "Orçamento | Wolf System" };
  const nome = sv.empresa || "Orçamento";
  const titulo = `Seu orçamento | ${nome}`;
  const descricao = `Orçamento para ${String(o.cliente_nome || "").trim()}${sv.emissor ? `, preparado por ${sv.emissor}` : ""}.`;
  return {
    title: titulo,
    description: descricao,
    openGraph: { title: titulo, description: descricao, siteName: nome, type: "website", images: [] },
    twitter: { card: "summary", title: titulo, description: descricao, images: [] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
