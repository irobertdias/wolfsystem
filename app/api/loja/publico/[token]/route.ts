import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "../../../_auth";
import { calcularFrete } from "../../_frete";
import { NOME_GATEWAY, PAGAR_ONLINE } from "../../_pagamento";
import { modulosLoja, lojaComModulos } from "../../_modulos";

const so = (v: any) => String(v || "").replace(/\D/g, "");

// Página pública do orçamento/pedido das lojas (Informática, Vendas, Roupas).
// Sem login: o token do link é a credencial. Os preços vêm sempre do banco.

const SEM_CACHE = { "Cache-Control": "no-store" };
const tokenValido = (t: string) => /^[A-Za-z0-9_-]{40,64}$/.test(t);
const num = (v: any) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "")); return Number.isFinite(x) ? x : 0; };
const ABERTOS = ["PENDENTE", "EM NEGOCIACAO"];

async function buscar(token: string) {
  const { data, error } = await supabaseServer.from("proposta")
    .select("id,workspace_id,created_at,data_proposta,nome,cpf,telefone1,email,endereco,cidade,estado,status_venda,dados_customizados")
    .eq("dados_customizados->pedido->>link_token", token).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: cfgRow } = await supabaseServer.from("fin_config").select("config").eq("workspace_id", data.workspace_id).maybeSingle();
  const gw = (cfgRow as any)?.config?.gateway_loja;
  const { liberado } = await modulosLoja(data.workspace_id);
  const online = liberado("pagamento_online") && gw?.token && gw.ativo !== false;
  const loja = { ...lojaComModulos((cfgRow as any)?.config?.loja || {}, liberado), _online: online ? NOME_GATEWAY[gw.gateway as keyof typeof NOME_GATEWAY] || "online" : "" };
  const { data: ws } = await supabaseServer.from("workspaces").select("nome").eq("username", data.workspace_id).maybeSingle();
  return { p: data as any, loja, nomeWs: (ws as any)?.nome || "" };
}

function publico(p: any, loja: any, nomeWs: string) {
  const d = p.dados_customizados?.pedido || {};
  const itens = (d.itens || []).map((i: any) => ({ nome: i.nome, qtd: num(i.qtd), preco: num(i.preco), detalhe: [i.tamanho, i.cor, i.garantia_meses ? `garantia ${i.garantia_meses} meses` : ""].filter(Boolean).join(" · ") }));
  const sub = itens.reduce((s: number, i: any) => s + i.qtd * i.preco, 0);
  const vencido = d.tipo === "orcamento" && d.validade && String(d.validade) < new Date().toISOString().slice(0, 10);
  const aberto = ABERTOS.includes(p.status_venda || "PENDENTE") && !d.aceite;
  const emp = loja.empresa || {};
  return {
    tipo: d.tipo === "orcamento" ? "orcamento" : "pedido",
    numero: d.numero || String(p.id),
    data: p.data_proposta || p.created_at,
    validade: d.validade || null,
    cliente: { nome: p.nome, telefone: p.telefone1 || "", endereco: p.endereco || "", cidade: p.cidade || "", estado: p.estado || "" },
    itens, subtotal: sub, desconto: num(d.desconto), frete: num(d.frete),
    entrega: d.entrega || "retirada", pagamento: d.pagamento || "", observacoes: d.observacoes || "",
    // frete só conta se for entrega (orçamento de retirada não cobra frete)
    ...(d.entrega === "entrega" ? {} : { frete: 0 }),
    empresa: { nome: emp.nome || nomeWs, cnpj: emp.cnpj || "", ie: emp.ie || "", endereco: emp.endereco || "", cidade: emp.cidade || "", cep: emp.cep || "", telefone: emp.telefone || "", email: emp.email || "", site: emp.site || "", logo: emp.logo || "", condicoes: emp.condicoes || "", cor: emp.cor || "", cor2: emp.cor2 || "" },
    formas_pagamento: [...(loja._online ? [PAGAR_ONLINE] : []), ...(Array.isArray(loja.formas_pagamento) && loja.formas_pagamento.length ? loja.formas_pagamento : ["PIX", "Cartão de crédito", "Cartão de débito", "Dinheiro"])],
    pagamento_online: loja._online ? { gateway: loja._online, status: d.pagamento_online?.status || "", pago_em: d.pagamento_online?.pago_em || null } : null,
    taxa_entrega: num(loja.taxa_entrega),
    frete_modo: loja.frete?.modo === "calculado" ? "calculado" : "fixo",
    frete_gratis_acima: num(loja.frete?.gratis_acima),
    servico_frete: d.servico_frete || "", prazo_frete: d.prazo_frete || "",
    cor: emp.cor || "", cor2: emp.cor2 || "",
    status: d.aceite ? "aceito" : vencido ? "expirado" : aberto ? "aberto" : "fechado",
    aceite: d.aceite || null,
  };
}

export async function GET(_r: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const r = await buscar(token);
    if (!r) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 });
    const d = r.p.dados_customizados?.pedido || {};
    if (!d.visualizado_em) {
      await supabaseServer.from("proposta").update({ dados_customizados: { ...r.p.dados_customizados, pedido: { ...d, visualizado_em: new Date().toISOString() } } }).eq("id", r.p.id);
    }
    return NextResponse.json({ success: true, pedido: publico(r.p, r.loja, r.nomeWs) }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}

// POST { entrega: "entrega"|"retirada", endereco, cidade, estado, cep, pagamento, observacoes, documento }
export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!tokenValido(token)) return NextResponse.json({ success: false, error: "Link inválido" }, { status: 400 });
  try {
    const b = await request.json().catch(() => ({}));
    const r = await buscar(token);
    if (!r) return NextResponse.json({ success: false, error: "Orçamento não encontrado" }, { status: 404 });
    const pub = publico(r.p, r.loja, r.nomeWs);
    if (pub.status === "aceito") return NextResponse.json({ success: false, error: "Este orçamento já foi aceito" }, { status: 409 });
    if (pub.status === "expirado") return NextResponse.json({ success: false, error: "O prazo deste orçamento expirou. Fale com a loja." }, { status: 410 });
    if (pub.status !== "aberto") return NextResponse.json({ success: false, error: "Este orçamento não pode mais ser aceito" }, { status: 409 });

    const txt = (v: any, max = 200) => String(v ?? "").trim().slice(0, max);
    const entrega = b.entrega === "entrega" ? "entrega" : "retirada";
    const pagamento = txt(b.pagamento, 60);
    if (!pub.formas_pagamento.includes(pagamento)) return NextResponse.json({ success: false, error: "Escolha a forma de pagamento" }, { status: 400 });
    const endereco = txt(b.endereco), cidade = txt(b.cidade, 80), estado = txt(b.estado, 2).toUpperCase(), cep = txt(b.cep, 9);
    if (entrega === "entrega" && (!endereco || !cidade)) return NextResponse.json({ success: false, error: "Informe o endereço e a cidade para a entrega" }, { status: 400 });

    const agora = new Date().toISOString();
    const d = r.p.dados_customizados?.pedido || {};
    // Frete: recalculado aqui pelo CEP (calculado) ou a taxa fixa — nunca o valor que veio do navegador.
    let frete = 0, servicoFrete = "", prazoFrete = "";
    if (entrega === "entrega") {
      if (pub.frete_modo === "calculado") {
        if (so(cep).length !== 8) return NextResponse.json({ success: false, error: "Informe o CEP para calcular o frete" }, { status: 400 });
        const calc = await calcularFrete(r.loja, cep, d.itens || []);
        const op = calc.opcoes.find((o) => o.servico === txt(b.servico_frete, 20)) || calc.opcoes[0];
        if (!op) return NextResponse.json({ success: false, error: calc.aviso || "Não foi possível calcular o frete para este CEP" }, { status: 400 });
        frete = op.valor; servicoFrete = op.servico; prazoFrete = op.prazo || "";
      } else {
        frete = num(d.frete) || pub.taxa_entrega;
        if (pub.frete_gratis_acima > 0 && pub.subtotal >= pub.frete_gratis_acima) frete = 0;
      }
    }
    const aceite = { em: agora, entrega, endereco, cidade, estado, cep, pagamento, observacoes: txt(b.observacoes, 500), ip: (request.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) };
    const novo = {
      ...d, tipo: "pedido", entrega, frete, pagamento, aceite, aprovado_cliente_em: agora,
      servico_frete: entrega === "entrega" ? servicoFrete || undefined : undefined, prazo_frete: entrega === "entrega" ? prazoFrete || undefined : undefined,
      endereco_entrega: entrega === "entrega" ? [endereco, cidade, estado, cep].filter(Boolean).join(" · ") : d.endereco_entrega,
      historico: [...(d.historico || []), { em: agora, etapa: "AGUARDANDO PAGAMENTO", nota: `Orçamento aprovado pelo cliente pelo link e virou pedido (${entrega === "entrega" ? `entrega${servicoFrete ? " " + servicoFrete : ""} ${frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "retirada"} · ${pagamento})`, por: "cliente" }],
    };
    const total = Math.max(0, pub.subtotal - pub.desconto + frete);
    const doc = txt(b.documento, 18).replace(/\D/g, "");
    const { data: ok, error } = await supabaseServer.from("proposta").update({
      status_venda: "AGUARDANDO PAGAMENTO",
      valor_plano: total,
      operadora: pagamento,
      ...(entrega === "entrega" ? { endereco, cidade, estado: estado || null } : {}),
      ...(doc ? { cpf: doc } : {}),
      dados_customizados: { ...r.p.dados_customizados, pedido: novo },
      updated_at: agora,
    }).eq("id", r.p.id).in("status_venda", ABERTOS).select("id");
    if (error) throw error;
    if (!ok?.length) return NextResponse.json({ success: false, error: "Este orçamento não pode mais ser aceito" }, { status: 409 });
    const atualizado = publico({ ...r.p, status_venda: "AGUARDANDO PAGAMENTO", dados_customizados: { ...r.p.dados_customizados, pedido: novo } }, r.loja, r.nomeWs);
    // Vendedora IA: manda o pagamento ao cliente no WhatsApp e avisa o dono (não segura a resposta da página se falhar).
    try { const { aposAceiteDoOrcamento } = await import("../../_avisos"); await aposAceiteDoOrcamento(r.p.workspace_id, r.p.id, request.nextUrl.origin); } catch {}
    return NextResponse.json({ success: true, pedido: atualizado }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ success: false, error: "Serviço temporariamente indisponível" }, { status: 502 });
  }
}
