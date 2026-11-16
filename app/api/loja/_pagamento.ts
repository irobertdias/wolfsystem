import { supabaseServer } from "../_auth";
import { buscarComTempo } from "./_web";

// Pagamento online das lojas (Informática, Vendas, Roupas) com o gateway do próprio lojista.
// Credenciais em fin_config.config.gateway_loja (só o servidor lê; a tela recebe só o final).
//  • Mercado Pago: Checkout Pro (preferência) → PIX, cartão e boleto. Aviso por notification_url.
//  • Asaas: cobrança "UNDEFINED" (o cliente escolhe PIX, cartão ou boleto na fatura). Aviso pelo
//    webhook configurado no painel do Asaas.
// O aviso (webhook) nunca é confiado sozinho: o pagamento é consultado de novo no gateway com a
// chave do lojista antes de dar baixa.

export type Gateway = "mercadopago" | "asaas";
export type GatewayCfg = { gateway: Gateway; token: string; ambiente?: "producao" | "sandbox"; ativo?: boolean; atualizado_em?: string };
export const NOME_GATEWAY: Record<Gateway, string> = { mercadopago: "Mercado Pago", asaas: "Asaas" };
export const PAGAR_ONLINE = "Pagar online (PIX, cartão ou boleto)";

const so = (v: any) => String(v || "").replace(/\D/g, "");
const arred = (v: number) => Math.round(v * 100) / 100;

export async function lerGateway(ws: string): Promise<GatewayCfg | null> {
  const { data } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle();
  const g = (data as any)?.config?.gateway_loja;
  if (!g?.token || !g?.gateway || g.ativo === false) return null;
  return g as GatewayCfg;
}

export const urlWebhook = (origem: string, ws: string, g: Gateway) => `${origem}/api/loja/pagamento/webhook?ws=${encodeURIComponent(ws)}&g=${g}`;
const asaasBase = (g: GatewayCfg) => (g.ambiente === "sandbox" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");
const asaasHeaders = (g: GatewayCfg) => ({ access_token: g.token, "Content-Type": "application/json", "User-Agent": "WolfSystem" });

type Cobranca = { ws: string; pedidoId: number; numero: string; descricao: string; total: number; cliente: { nome: string; documento?: string; email?: string; telefone?: string }; voltar: string; origem: string };

/** Cria a cobrança no gateway do lojista e devolve o link de pagamento. */
export async function criarCobranca(g: GatewayCfg, c: Cobranca): Promise<{ id: string; url: string }> {
  if (g.gateway === "mercadopago") {
    const r = await buscarComTempo("https://api.mercadopago.com/checkout/preferences", 15000, {
      method: "POST",
      headers: { Authorization: `Bearer ${g.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: String(c.pedidoId), title: c.descricao.slice(0, 250), quantity: 1, unit_price: arred(c.total), currency_id: "BRL" }],
        external_reference: String(c.pedidoId),
        notification_url: urlWebhook(c.origem, c.ws, "mercadopago"),
        back_urls: { success: c.voltar, pending: c.voltar, failure: c.voltar },
        auto_return: "approved",
        statement_descriptor: c.descricao.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 13) || undefined,
        payer: { name: c.cliente.nome, ...(c.cliente.email ? { email: c.cliente.email } : {}) },
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || `Mercado Pago ${r.status}`);
    const teste = g.token.startsWith("TEST-");
    return { id: String(j.id), url: (teste ? j.sandbox_init_point : j.init_point) || j.init_point };
  }
  // Asaas
  const doc = so(c.cliente.documento);
  if (doc.length !== 11 && doc.length !== 14) throw new Error("Informe o CPF ou CNPJ para pagar online.");
  const h = asaasHeaders(g), base = asaasBase(g);
  const rc = await buscarComTempo(`${base}/customers`, 15000, { method: "POST", headers: h, body: JSON.stringify({ name: c.cliente.nome, cpfCnpj: doc, ...(c.cliente.email ? { email: c.cliente.email } : {}), ...(so(c.cliente.telefone).length >= 10 ? { mobilePhone: so(c.cliente.telefone).replace(/^55/, "") } : {}), notificationDisabled: true }) });
  const jc: any = await rc.json().catch(() => ({}));
  if (!rc.ok || !jc.id) throw new Error(jc?.errors?.[0]?.description || `Asaas ${rc.status}`);
  const venc = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const rp = await buscarComTempo(`${base}/payments`, 15000, { method: "POST", headers: h, body: JSON.stringify({ customer: jc.id, billingType: "UNDEFINED", value: arred(c.total), dueDate: venc, description: c.descricao.slice(0, 500), externalReference: String(c.pedidoId), callback: { successUrl: c.voltar, autoRedirect: true } }) });
  const jp: any = await rp.json().catch(() => ({}));
  if (!rp.ok || !jp.id) throw new Error(jp?.errors?.[0]?.description || `Asaas ${rp.status}`);
  return { id: String(jp.id), url: jp.invoiceUrl };
}

/** Consulta o pagamento no gateway (com a chave do lojista). */
export async function consultarPagamento(g: GatewayCfg, id: string): Promise<{ pago: boolean; ref: string; valor: number; status: string; metodo?: string } | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (g.gateway === "mercadopago") {
    const r = await buscarComTempo(`https://api.mercadopago.com/v1/payments/${id}`, 12000, { headers: { Authorization: `Bearer ${g.token}` } });
    if (!r.ok) return null;
    const j: any = await r.json();
    return { pago: j.status === "approved", ref: String(j.external_reference || ""), valor: Number(j.transaction_amount) || 0, status: String(j.status || ""), metodo: j.payment_type_id };
  }
  const r = await buscarComTempo(`${asaasBase(g)}/payments/${id}`, 12000, { headers: asaasHeaders(g) });
  if (!r.ok) return null;
  const j: any = await r.json();
  return { pago: ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(j.status), ref: String(j.externalReference || ""), valor: Number(j.value) || 0, status: String(j.status || ""), metodo: j.billingType };
}

/** Dá baixa no pedido pago: etapa seguinte do fluxo, data do pagamento e saída do estoque. */
export async function confirmarPagamento(ws: string, pedidoId: number, info: { gateway: Gateway; id: string; valor: number; metodo?: string }) {
  const { data: p } = await supabaseServer.from("proposta").select("id,status_venda,dados_customizados").eq("workspace_id", ws).eq("id", pedidoId).maybeSingle();
  if (!p) return { ok: false, motivo: "pedido não encontrado" };
  const d = (p as any).dados_customizados?.pedido || {};
  if (d.pagamento_online?.status === "pago") return { ok: true, motivo: "já estava pago" };
  const { data: w } = await supabaseServer.from("workspaces").select("vertical").eq("username", ws).maybeSingle();
  const roupas = (w as any)?.vertical === "roupas";
  const proxima = roupas ? "EM SEPARACAO" : "FECHADA";
  const agora = new Date().toISOString();

  // Estoque: mesma regra da tela (sai ao confirmar), feita aqui porque não há ninguém logado.
  let baixado = !!d.estoque_baixado;
  if (!baixado && Array.isArray(d.itens) && d.itens.length) {
    const { data: cfg } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle();
    const config = (cfg as any)?.config || {};
    const produtos = (config.loja?.produtos || []).map((x: any) => ({ ...x, variantes: (x.variantes || []).map((v: any) => ({ ...v })) }));
    for (const i of d.itens) {
      const prod = produtos.find((x: any) => x.id === i.produto_id);
      if (!prod || prod.servico) continue;
      const v = prod.variantes.find((x: any) => x.id === i.variante_id);
      if (v) v.estoque = (Number(v.estoque) || 0) - (Number(i.qtd) || 0);
    }
    if (config.loja) { await supabaseServer.from("fin_config").update({ config: { ...config, loja: { ...config.loja, produtos } } }).eq("workspace_id", ws); baixado = true; }
  }
  const novo = {
    ...d, tipo: "pedido", estoque_baixado: baixado, pago_em: d.pago_em || agora.slice(0, 10),
    pagamento_online: { ...(d.pagamento_online || {}), gateway: info.gateway, pagamento_id: info.id, status: "pago", pago_em: agora, valor: info.valor, metodo: info.metodo },
    historico: [...(d.historico || []), { em: agora, etapa: proxima, nota: `Pago online pelo ${NOME_GATEWAY[info.gateway]} (${info.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${info.metodo ? ` · ${info.metodo}` : ""})`, por: "gateway" }],
  };
  const etapa = ["CANCELADA", "PERDIDA"].includes((p as any).status_venda) ? (p as any).status_venda : proxima;
  await supabaseServer.from("proposta").update({ status_venda: etapa, dados_customizados: { ...(p as any).dados_customizados, pedido: novo }, updated_at: agora }).eq("workspace_id", ws).eq("id", pedidoId);
  return { ok: true };
}
