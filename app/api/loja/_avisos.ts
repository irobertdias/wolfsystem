import { supabaseServer, segredoInternoWolf } from "../_auth";
import { modulosLoja } from "./_modulos";

// Avisos automáticos ao cliente pelo WhatsApp quando o pedido muda de etapa
// (módulo "ia_vendas" do nicho). Usa o canal do atendimento do cliente; sem
// atendimento, o canal padrão configurado em Ajustes. Cada aviso sai uma vez só.

const WHATSAPP_URL = process.env.WHATSAPP_URL || process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://api.wolfgyn.com.br";
const so = (v: any) => String(v || "").replace(/\D/g, "");
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type ChaveAviso = "pago" | "separacao" | "enviado" | "retirada" | "entregue";
export const AVISOS_PADRAO: Record<ChaveAviso, string> = {
  pago: "Olá, {nome}! ✅ Recebemos o pagamento do pedido nº {numero} ({total}). Ele já está em separação e avisamos assim que sair.",
  separacao: "Olá, {nome}! Seu pedido nº {numero} está em separação. Avisamos assim que sair. 📦",
  enviado: "📦 {nome}, seu pedido nº {numero} foi enviado!{rastreio}",
  retirada: "✅ {nome}, seu pedido nº {numero} está pronto para retirada na {empresa}.",
  entregue: "Pedido nº {numero} entregue. Obrigado pela compra, {nome}! Qualquer coisa é só chamar aqui. 😊",
};

/** Envia um texto pelo serviço do WhatsApp do workspace (canal do atendimento ou o padrão). */
export async function enviarWhatsappLoja(ws: string, telefone: string, texto: string, canalPadrao?: number | null) {
  const d = so(telefone).replace(/^0+/, "");
  if (d.length < 10) return { ok: false, motivo: "cliente sem WhatsApp" };
  const candidatos = [...new Set([d, d.startsWith("55") ? d.slice(2) : "55" + d])];
  const { data: at } = await supabaseServer.from("atendimentos").select("numero,canal_id").eq("workspace_id", ws).in("numero", candidatos).order("id", { ascending: false }).limit(1).maybeSingle();
  const canalId = (at as any)?.canal_id || canalPadrao;
  if (!canalId) return { ok: false, motivo: "sem canal de WhatsApp (escolha o canal padrão em Ajustes)" };
  const numero = (at as any)?.numero || (d.startsWith("55") ? d : "55" + d);
  try {
    const r = await fetch(`${WHATSAPP_URL}/enviar`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json", "x-wolf-internal-secret": segredoInternoWolf() },
      body: JSON.stringify({ numero, mensagem: texto, canalId, workspaceId: ws, workspace_id: ws }),
    });
    const j: any = await r.json().catch(() => ({}));
    return r.ok && j.success !== false ? { ok: true } : { ok: false, motivo: String(j.error || j.erro || `WhatsApp ${r.status}`).slice(0, 160) };
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e).slice(0, 160) };
  }
}

const ORIGEM_PADRAO = (process.env.NEXT_PUBLIC_APP_URL || "https://wolfgyn.com.br").replace(/\/+$/, "");

/** Grava um registro no histórico do pedido e mescla campos em dados_customizados.pedido. */
async function anotarPedido(pedidoId: number, nota: string, extra: (d: any) => any = () => ({})) {
  const { data: atual } = await supabaseServer.from("proposta").select("dados_customizados").eq("id", pedidoId).maybeSingle();
  const dd = (atual as any)?.dados_customizados?.pedido || {};
  const novo = { ...dd, ...extra(dd), historico: [...(dd.historico || []), { em: new Date().toISOString(), nota, por: "ia_vendas" }] };
  await supabaseServer.from("proposta").update({ dados_customizados: { ...(atual as any)?.dados_customizados, pedido: novo } }).eq("id", pedidoId);
}

/**
 * Avisa o dono da loja no WhatsApp (loja.ia_vendas.dono_whatsapp) de um pedido novo
 * aguardando pagamento ou com pagamento aprovado. Uma vez por situação e pedido.
 */
export async function avisarDono(ws: string, pedidoId: number, situacao: "aguardando" | "pago", origem = ORIGEM_PADRAO) {
  try {
    const [{ data: p }, { data: cfg }] = await Promise.all([
      supabaseServer.from("proposta").select("id,nome,telefone1,cpf,valor_plano,operadora,dados_customizados").eq("workspace_id", ws).eq("id", pedidoId).maybeSingle(),
      supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
    ]);
    if (!p) return { ok: false, motivo: "pedido não encontrado" };
    const conf = (cfg as any)?.config?.loja?.ia_vendas || {};
    const dono = so(conf.dono_whatsapp);
    if (dono.length < 10) return { ok: false, motivo: "sem WhatsApp do dono" };
    const x: any = p; const d = x.dados_customizados?.pedido || {};
    if (d.dono_avisado?.[situacao]) return { ok: true, motivo: "já avisado" };
    const itens = (d.itens || []).map((i: any) => `• ${i.qtd}x ${i.nome} — ${brl(Number(i.preco) * Number(i.qtd))}`).join("\n");
    const entrega = d.entrega === "entrega"
      ? `Entrega${d.servico_frete ? ` (${d.servico_frete}${d.prazo_frete ? `, ${d.prazo_frete}` : ""})` : ""}: ${d.endereco_entrega || "-"}\nFrete: ${brl(Number(d.frete) || 0)}`
      : "Retirada na loja";
    const cabeca = situacao === "pago" ? `✅ *PAGAMENTO APROVADO — Pedido nº ${d.numero || x.id}*` : `🛒 *NOVO PEDIDO nº ${d.numero || x.id}* — aguardando pagamento`;
    const blocos = [
      cabeca,
      `👤 ${x.nome || "-"}${x.telefone1 ? ` · ${x.telefone1}` : ""}${x.cpf ? `\nCPF: ${x.cpf}` : ""}`,
      itens,
      [entrega, `Pagamento: ${d.pagamento || x.operadora || "-"}${situacao === "pago" && d.pagamento_online?.metodo ? ` (${d.pagamento_online.metodo})` : ""}`, `*Total: ${brl(Number(x.valor_plano) || 0)}*`].join("\n"),
      d.canal === "whatsapp_ia" ? "Fechado pela vendedora IA no WhatsApp." : "",
      d.link_token ? `${origem}/pedido/${d.link_token}` : "",
    ];
    const texto = blocos.filter(Boolean).join("\n\n");
    const r = await enviarWhatsappLoja(ws, dono, texto, conf.canal_id);
    await anotarPedido(pedidoId, r.ok ? `Dono avisado no WhatsApp (${situacao === "pago" ? "pagamento aprovado" : "aguardando pagamento"})` : `Aviso ao dono não enviado: ${r.motivo}`,
      (dd) => (r.ok ? { dono_avisado: { ...(dd.dono_avisado || {}), [situacao]: new Date().toISOString() } } : {}));
    return r;
  } catch (e: any) {
    return { ok: false, motivo: String(e?.message || e).slice(0, 160) };
  }
}

/**
 * Depois que o cliente aceita o orçamento pelo link: a vendedora manda no WhatsApp
 * as informações de pagamento (link online ou a forma combinada) e avisa o dono.
 */
export async function aposAceiteDoOrcamento(ws: string, pedidoId: number, origem = ORIGEM_PADRAO) {
  const { liberado } = await modulosLoja(ws);
  if (!liberado("ia_vendas")) return { ok: false, motivo: "módulo desligado" };
  const [{ data: p }, { data: cfg }] = await Promise.all([
    supabaseServer.from("proposta").select("id,workspace_id,nome,cpf,email,telefone1,status_venda,valor_plano,dados_customizados").eq("workspace_id", ws).eq("id", pedidoId).maybeSingle(),
    supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
  ]);
  if (!p) return { ok: false, motivo: "pedido não encontrado" };
  const x: any = p; const d = x.dados_customizados?.pedido || {};
  const loja = (cfg as any)?.config?.loja || {};
  const conf = loja.ia_vendas || {};
  const nome = String(x.nome || "").split(" ")[0] || "";
  const total = brl(Number(x.valor_plano) || 0);
  const online = /online/i.test(String(d.pagamento || ""));
  let texto: string;
  if (online) {
    const { linkPagamentoDoPedido } = await import("./_pagamento");
    const r = await linkPagamentoDoPedido(x, origem).catch((e: any) => ({ url: undefined, erro: String(e?.message || e) }));
    texto = r.url
      ? `Oba, ${nome}! 🎉 Recebi a aprovação do orçamento nº ${d.numero || x.id}.\n\nTotal: *${total}*\nPague por aqui (PIX, cartão ou boleto):\n${r.url}\n\nAssim que o pagamento cair, te aviso aqui e o pedido já vai para separação. 📦`
      : `Oba, ${nome}! 🎉 Recebi a aprovação do orçamento nº ${d.numero || x.id} (total *${total}*). Já vou te passar o pagamento por aqui. 😊`;
  } else {
    const retirada = d.entrega !== "entrega";
    texto = `Oba, ${nome}! 🎉 Recebi a aprovação do orçamento nº ${d.numero || x.id}.\n\nTotal: *${total}*\nPagamento: ${d.pagamento || "a combinar"}${retirada ? `\nVocê paga na retirada, na loja${loja.empresa?.endereco ? ` (${loja.empresa.endereco})` : ""}.` : ""}\n\nQualquer dúvida é só me chamar aqui. 😊`;
  }
  const r = await enviarWhatsappLoja(ws, x.telefone1 || "", texto, conf.canal_id);
  await anotarPedido(pedidoId, r.ok ? "WhatsApp ao cliente: informações de pagamento após o aceite" : `Pagamento não enviado ao cliente: ${r.motivo}`);
  await avisarDono(ws, pedidoId, "aguardando", origem);
  return r;
}

/** Cliente recusou o orçamento pelo link: a vendedora agradece e oferece outra opção no WhatsApp. */
export async function aposRecusaDoOrcamento(ws: string, pedidoId: number, motivo: string) {
  const { liberado } = await modulosLoja(ws);
  if (!liberado("ia_vendas")) return { ok: false, motivo: "módulo desligado" };
  const [{ data: p }, { data: cfg }] = await Promise.all([
    supabaseServer.from("proposta").select("id,nome,telefone1,dados_customizados").eq("workspace_id", ws).eq("id", pedidoId).maybeSingle(),
    supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
  ]);
  if (!p) return { ok: false, motivo: "pedido não encontrado" };
  const x: any = p; const d = x.dados_customizados?.pedido || {};
  const conf = (cfg as any)?.config?.loja?.ia_vendas || {};
  const nome = String(x.nome || "").split(" ")[0];
  const oi = nome && !/^cliente$/i.test(nome) ? `${nome}, ` : "";
  const texto = `Poxa, ${oi}vi que você recusou o orçamento nº ${d.numero || x.id}. Obrigada por me contar o motivo: "${motivo}". 🙏\n\nSe quiser, monto outra opção que caiba melhor pra você. É só me falar aqui! 😊`;
  const r = await enviarWhatsappLoja(ws, x.telefone1 || "", texto, conf.canal_id);
  await anotarPedido(pedidoId, r.ok ? "WhatsApp ao cliente após a recusa (oferta de outra opção)" : `Mensagem após a recusa não enviada: ${r.motivo}`);
  return r;
}

const chaveDaEtapa = (etapa: string, entrega?: string): ChaveAviso | null =>
  etapa === "EM SEPARACAO" ? "separacao"
  : etapa === "AGUARDANDO ENTREGA" ? (entrega === "retirada" ? "retirada" : "enviado")
  : etapa === "FECHADA" || etapa === "ENTREGUE" ? "entregue" : null;

/** Avisa o cliente da etapa do pedido (uma vez por etapa). `chave` força o aviso (ex.: "pago"). */
export async function avisarEtapa(ws: string, pedidoId: number, etapaOuChave: string) {
  const { liberado } = await modulosLoja(ws);
  if (!liberado("ia_vendas")) return { ok: false, motivo: "módulo desligado" };
  const [{ data: p }, { data: cfg }, { data: w }] = await Promise.all([
    supabaseServer.from("proposta").select("id,nome,telefone1,status_venda,valor_plano,dados_customizados").eq("workspace_id", ws).eq("id", pedidoId).maybeSingle(),
    supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
    supabaseServer.from("workspaces").select("nome").eq("username", ws).maybeSingle(),
  ]);
  if (!p) return { ok: false, motivo: "pedido não encontrado" };
  const x: any = p; const d = x.dados_customizados?.pedido || {};
  const loja = (cfg as any)?.config?.loja || {};
  const conf = loja.ia_vendas || {};
  if (conf.avisos === false) return { ok: false, motivo: "avisos desligados" };
  const chave: ChaveAviso | null = (["pago", "separacao", "enviado", "retirada", "entregue"] as string[]).includes(etapaOuChave) ? etapaOuChave as ChaveAviso : chaveDaEtapa(etapaOuChave, d.entrega);
  if (!chave) return { ok: false, motivo: "etapa sem aviso" };
  const ja = d.avisos_enviados || {};
  if (ja[chave] || (chave === "separacao" && ja.pago)) return { ok: true, motivo: "já avisado" };
  if (chave === "entregue" && !ja.enviado && !ja.retirada && !ja.pago && !ja.separacao) return { ok: false, motivo: "venda de balcão" };

  const modelo = String(conf.mensagens?.[chave] || AVISOS_PADRAO[chave]);
  const texto = modelo
    .replace(/\{nome\}/g, String(x.nome || "").split(" ")[0] || "")
    .replace(/\{numero\}/g, String(d.numero || x.id))
    .replace(/\{total\}/g, brl(Number(x.valor_plano) || 0))
    .replace(/\{empresa\}/g, loja.empresa?.nome || (w as any)?.nome || "loja")
    .replace(/\{rastreio\}/g, d.rastreio ? `\nCódigo de rastreio: ${d.rastreio}` : "");
  const r = await enviarWhatsappLoja(ws, x.telefone1 || "", texto, conf.canal_id);

  // Registro no pedido (mesmo quando falha, para o vendedor ver o motivo)
  const { data: atual } = await supabaseServer.from("proposta").select("dados_customizados").eq("id", pedidoId).maybeSingle();
  const dd = (atual as any)?.dados_customizados?.pedido || d;
  const agora = new Date().toISOString();
  const novo = { ...dd,
    avisos_enviados: r.ok ? { ...(dd.avisos_enviados || {}), [chave]: agora } : dd.avisos_enviados,
    historico: [...(dd.historico || []), { em: agora, nota: r.ok ? `WhatsApp ao cliente: aviso de ${chave}` : `Aviso de ${chave} não enviado: ${r.motivo}`, por: "ia_vendas" }] };
  await supabaseServer.from("proposta").update({ dados_customizados: { ...(atual as any)?.dados_customizados, pedido: novo } }).eq("id", pedidoId);
  return r;
}
