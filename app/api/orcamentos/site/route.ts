import { randomBytes, randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../_auth";
import { PAGAMENTO_PADRAO, calcularOrcamento, itensDoSite } from "../../../lib/orcamento";

// Orçamento montado pelo próprio visitante no "Monte seu plano" do site.
// Sem login: preços sempre da tabela, limites de quantidade e de pedidos por telefone/IP.

const SEM_CACHE = { "Cache-Control": "no-store" };
const VALIDADE_HORAS = 7 * 24;
const erro = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

export async function POST(request: NextRequest) {
  try {
    const b = await request.json().catch(() => ({}));
    if (String(b.site || "").trim()) return erro("Pedido inválido"); // campo isca: só robô preenche

    const nome = String(b.nome || "").trim().slice(0, 120);
    const empresa = String(b.empresa || "").trim().slice(0, 120);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
    const telefone = String(b.telefone || "").replace(/\D/g, "").slice(0, 15);
    if (nome.length < 2) return erro("Informe seu nome");
    if (telefone.length < 10) return erro("Informe seu WhatsApp com DDD");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro("E-mail inválido");

    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count: porTelefone } = await supabaseServer.from("wolf_orcamentos")
      .select("id", { count: "exact", head: true }).eq("criado_por", "site").eq("cliente_telefone", telefone).gte("created_at", umaHora);
    const { count: porIp } = ip
      ? await supabaseServer.from("wolf_orcamentos").select("id", { count: "exact", head: true }).eq("criado_por", "site").eq("aceite_user_agent", `site-ip:${ip}`).gte("created_at", umaHora)
      : { count: 0 };
    if ((porTelefone || 0) >= 5 || (porIp || 0) >= 10) return erro("Muitos orçamentos em pouco tempo. Tente novamente mais tarde ou fale com a gente no WhatsApp.", 429);

    const itens = itensDoSite({ plano: String(b.plano || ""), usuarios: Number(b.usuarios), whatsapps: Number(b.whatsapps), modulos: Array.isArray(b.modulos) ? b.modulos : [] });
    const t = calcularOrcamento(itens);
    const h = randomUUID().replace(/-/g, "").toUpperCase();
    const hoje = new Date();
    const numero = `SITE-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}-${h.slice(0, 4)}`;
    const token = randomBytes(32).toString("base64url");

    const { error } = await supabaseServer.from("wolf_orcamentos").insert({
      numero,
      token,
      cliente_nome: empresa ? `${nome} — ${empresa}` : nome,
      cliente_telefone: telefone,
      itens,
      usuarios_incluidos: Math.max(1, t.usuarios),
      mensalidade: t.mensal,
      configuracao: t.unico,
      pagamento: PAGAMENTO_PADRAO,
      expira_em: new Date(Date.now() + VALIDADE_HORAS * 3600_000).toISOString(),
      criado_por: "site",
      // guarda o IP do pedido para o limite acima (o campo é reescrito no aceite)
      aceite_user_agent: ip ? `site-ip:${ip}` : null,
      // já deixa os dados de contato preenchidos no formulário de implantação
      implantacao: { razao_social: empresa, cnpj: "", responsavel: nome, email, telefone, whatsapp_atendimento: "", whatsapps: [], usuarios: [], pagamento_realizado: false, observacoes: "" },
    });
    if (error) throw error;
    return NextResponse.json({ success: true, numero, link: `/orcamento/${token}` }, { headers: SEM_CACHE });
  } catch {
    return erro("Não foi possível gerar o orçamento agora. Tente novamente em instantes.", 502);
  }
}
