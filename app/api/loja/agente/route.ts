import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseServer, segredoInternoWolf } from "../../_auth";
import { modulosLoja, lojaComModulos } from "../_modulos";
import { calcularFrete } from "../_frete";
import { linkPagamentoDoPedido } from "../_pagamento";
import { novoToken } from "../../../lib/loja-orcamento";

// ═══════════════════════════════════════════════════════════════════════
// Ferramentas da Vendedora IA das lojas (módulo "ia_vendas").
// Chamado só pelo serviço do WhatsApp (servidor → servidor, x-wolf-internal-secret).
// Tudo vem do sistema do workspace: catálogo, estoque, frete, pedido, pagamento e status.
// A IA nunca define preço: o pedido é montado aqui com os preços do catálogo.
//
// POST { workspaceId, acao, ... }
//   catalogo        { busca?, categoria?, limite? }
//   produto         { produto_id }
//   frete           { cep, itens:[{produto_id, variante_id?, qtd}] }
//   criar_pedido    { cliente:{nome, telefone, cpf?, email?}, itens:[...], entrega:"retirada"|"entrega",
//                     cep?, endereco?, cidade?, uf?, servico_frete?, pagamento?, observacoes? }
//   link_pagamento  { pedido_id, documento? }
//   status_pedido   { pedido_id? , telefone? }
//   config          {}  → nome da loja, pagamentos, entrega, se tem pagamento online
// ═══════════════════════════════════════════════════════════════════════

export const maxDuration = 60;
const n = (v: any) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const so = (v: any) => String(v || "").replace(/\D/g, "");
const norm = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ETAPA: Record<string, string> = {
  PENDENTE: "recebido", "EM NEGOCIACAO": "orçamento enviado", "AGUARDANDO PAGAMENTO": "aguardando pagamento",
  "EM SEPARACAO": "pago, em separação", "AGUARDANDO ENTREGA": "enviado / saiu para entrega", ENTREGUE: "entregue",
  FECHADA: "concluído", CANCELADA: "cancelado", PERDIDA: "cancelado",
};

function autorizado(request: NextRequest) {
  const enviado = request.headers.get("x-wolf-internal-secret") || "";
  let certo = ""; try { certo = segredoInternoWolf(); } catch { return false; }
  const a = Buffer.from(enviado), b = Buffer.from(certo);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

const estoqueDe = (p: any) => (p.variantes || []).reduce((s: number, v: any) => s + n(v.estoque), 0);
function resumoProduto(p: any, origem: string, ws: string) {
  return {
    produto_id: p.id, nome: p.nome, categoria: p.categoria || "", marca: p.marca || "", modelo: p.modelo || "", sku: p.sku || "",
    preco: n(p.preco), preco_texto: brl(n(p.preco)), servico: !!p.servico,
    estoque_total: p.servico ? null : estoqueDe(p), disponivel: p.servico || estoqueDe(p) > 0,
    garantia_meses: p.garantia_meses || null,
    descricao: String(p.descricao || "").slice(0, 600),
    variantes: (p.variantes || []).length > 1 || (p.variantes?.[0]?.tamanho || p.variantes?.[0]?.cor)
      ? (p.variantes || []).map((v: any) => ({ variante_id: v.id, tamanho: v.tamanho || "", cor: v.cor || "", estoque: n(v.estoque) })) : undefined,
    foto_url: p.foto ? `${origem}/api/loja/produto-foto?ws=${encodeURIComponent(ws)}&id=${encodeURIComponent(p.id)}` : null,
  };
}

/** Monta os itens com preço do catálogo e confere o estoque. */
function montarItens(entrada: any[], produtos: any[]) {
  const itens: any[] = []; const faltas: string[] = [];
  for (const e of (entrada || []).slice(0, 30)) {
    const p = produtos.find((x: any) => x.id === e.produto_id && x.ativo !== false);
    if (!p) { faltas.push(`produto ${e.produto_id} não encontrado`); continue; }
    const vs = p.variantes || [];
    const v = vs.find((x: any) => x.id === e.variante_id) || (vs.length === 1 ? vs[0] : null);
    if (!v && vs.length > 1) { faltas.push(`${p.nome}: escolha o tamanho/cor (variante_id)`); continue; }
    const qtd = Math.max(1, Math.round(n(e.qtd) || 1));
    if (!p.servico && v && n(v.estoque) < qtd) { faltas.push(`${p.nome}${v.tamanho || v.cor ? ` (${[v.tamanho, v.cor].filter(Boolean).join(" ")})` : ""}: só ${n(v.estoque)} em estoque`); continue; }
    itens.push({ produto_id: p.id, variante_id: v?.id || "", nome: p.nome, tamanho: v?.tamanho, cor: v?.cor, qtd, preco: n(p.preco), servico: !!p.servico, garantia_meses: p.garantia_meses });
  }
  return { itens, faltas };
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  try {
    const b = await request.json().catch(() => ({}));
    const ws = String(b.workspaceId || b.workspace_id || "").trim();
    if (!ws) return NextResponse.json({ ok: false, erro: "workspaceId obrigatório" }, { status: 400 });
    const { liberado } = await modulosLoja(ws);
    if (!liberado("ia_vendas")) return NextResponse.json({ ok: false, erro: "Módulo Vendedora IA não liberado para este workspace" }, { status: 403 });

    const origem = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const [{ data: cfgRow }, { data: wsRow }] = await Promise.all([
      supabaseServer.from("fin_config").select("config").eq("workspace_id", ws).maybeSingle(),
      supabaseServer.from("workspaces").select("nome").eq("username", ws).maybeSingle(),
    ]);
    const config = (cfgRow as any)?.config || {};
    const loja = lojaComModulos(config.loja || {}, liberado);
    const produtos: any[] = (loja.produtos || []).filter((p: any) => p.ativo !== false);
    const online = liberado("pagamento_online") && config.gateway_loja?.token && config.gateway_loja.ativo !== false;
    const acao = String(b.acao || "");

    if (acao === "config") {
      return NextResponse.json({ ok: true, loja: loja.empresa?.nome || (wsRow as any)?.nome || "", telefone: loja.empresa?.telefone || "", endereco: [loja.empresa?.endereco, loja.empresa?.cidade].filter(Boolean).join(" · "),
        formas_pagamento: loja.formas_pagamento || [], pagamento_online: !!online, frete: loja.frete?.modo === "calculado" ? "calculado pelo CEP (Sedex/PAC)" : `fixo ${brl(n(loja.taxa_entrega))}`,
        frete_gratis_acima: n(loja.frete?.gratis_acima) || null, categorias: loja.categorias || [], instrucoes: loja.ia_vendas?.instrucoes || "" });
    }

    if (acao === "catalogo") {
      const termos = norm(b.busca).split(/\s+/).filter((t: string) => t.length > 1);
      const cat = norm(b.categoria);
      let lista = produtos.filter((p) => (!cat || norm(p.categoria) === cat))
        .map((p) => ({ p, pontos: termos.length ? termos.filter((t: string) => norm(`${p.nome} ${p.marca} ${p.modelo} ${p.categoria} ${p.sku} ${p.descricao}`).includes(t)).length : 1 }))
        .filter((x) => x.pontos > 0).sort((a, c) => c.pontos - a.pontos || (estoqueDe(c.p) > 0 ? 1 : 0) - (estoqueDe(a.p) > 0 ? 1 : 0));
      const limite = Math.min(20, Math.max(1, n(b.limite) || 8));
      return NextResponse.json({ ok: true, total: lista.length, produtos: lista.slice(0, limite).map((x) => resumoProduto(x.p, origem, ws)) });
    }

    if (acao === "produto") {
      const p = produtos.find((x) => x.id === b.produto_id);
      return p ? NextResponse.json({ ok: true, produto: resumoProduto(p, origem, ws) }) : NextResponse.json({ ok: false, erro: "Produto não encontrado" }, { status: 404 });
    }

    if (acao === "frete") {
      const { itens, faltas } = montarItens(b.itens, produtos);
      if (!itens.length) return NextResponse.json({ ok: false, erro: faltas.join("; ") || "Informe os itens" }, { status: 400 });
      const r = await calcularFrete(loja, String(b.cep || ""), itens);
      return NextResponse.json({ ok: true, ...r, opcoes: r.opcoes.map((o) => ({ ...o, valor_texto: o.valor ? brl(o.valor) : "grátis" })) });
    }

    if (acao === "criar_pedido") {
      const c = b.cliente || {};
      const nome = String(c.nome || "").trim().slice(0, 120);
      const tel = so(c.telefone);
      if (nome.length < 2 || tel.length < 10) return NextResponse.json({ ok: false, erro: "Informe nome e telefone do cliente" }, { status: 400 });
      const { itens, faltas } = montarItens(b.itens, produtos);
      if (faltas.length) return NextResponse.json({ ok: false, erro: faltas.join("; ") }, { status: 409 });
      if (!itens.length) return NextResponse.json({ ok: false, erro: "Pedido sem itens" }, { status: 400 });
      const entrega = b.entrega === "entrega" ? "entrega" : "retirada";
      let frete = 0, servicoFrete: string | undefined, prazoFrete: string | undefined;
      if (entrega === "entrega") {
        if (so(b.cep).length !== 8 && loja.frete?.modo === "calculado") return NextResponse.json({ ok: false, erro: "Informe o CEP para a entrega" }, { status: 400 });
        if (!String(b.endereco || "").trim()) return NextResponse.json({ ok: false, erro: "Informe o endereço de entrega" }, { status: 400 });
        const fr = await calcularFrete(loja, String(b.cep || ""), itens);
        const op = fr.opcoes.find((o) => o.servico === b.servico_frete) || fr.opcoes[0];
        if (!op) return NextResponse.json({ ok: false, erro: fr.aviso || "Não consegui calcular o frete" }, { status: 400 });
        frete = op.valor; servicoFrete = op.servico; prazoFrete = op.prazo;
      }
      const formas: string[] = loja.formas_pagamento || [];
      const pagamento = online && norm(b.pagamento).includes("online") ? "Pagamento online"
        : formas.find((f) => norm(f) === norm(b.pagamento)) || (online ? "Pagamento online" : formas[0] || "");
      const subtotal = itens.reduce((s, i) => s + i.qtd * i.preco, 0);
      const total = Math.max(0, subtotal + frete);
      const agora = new Date().toISOString();
      const numero = String(Date.now()).slice(-6);
      const endereco = String(b.endereco || "").trim().slice(0, 200), cidade = String(b.cidade || "").trim().slice(0, 80), uf = String(b.uf || "").trim().slice(0, 2).toUpperCase();
      const pedido = {
        numero, tipo: "pedido", itens, desconto: 0, frete, servico_frete: servicoFrete, prazo_frete: prazoFrete, pagamento, entrega,
        endereco_entrega: entrega === "entrega" ? [endereco, cidade, uf, so(b.cep)].filter(Boolean).join(" · ") : undefined,
        observacoes: String(b.observacoes || "").slice(0, 500) || undefined,
        link_token: novoToken(), canal: "whatsapp_ia",
        aceite: { em: agora, entrega, endereco, cidade, estado: uf, cep: so(b.cep), pagamento, observacoes: "Confirmado no WhatsApp com a vendedora IA" },
        aprovado_cliente_em: agora,
        historico: [{ em: agora, etapa: "AGUARDANDO PAGAMENTO", nota: "Pedido fechado pela vendedora IA no WhatsApp", por: "ia_vendas" }],
      };
      const { data: novo, error } = await supabaseServer.from("proposta").insert([{
        workspace_id: ws, nome, telefone1: tel.replace(/^55(?=\d{10,11}$)/, ""), cpf: so(c.cpf) || null, email: String(c.email || "").trim() || null,
        endereco: entrega === "entrega" ? endereco : null, cidade: entrega === "entrega" ? cidade : null, estado: entrega === "entrega" ? uf || null : null,
        status_venda: "AGUARDANDO PAGAMENTO", valor_plano: total, plano: itens.map((i) => `${i.qtd}x ${i.nome}`).join(", ").slice(0, 240),
        operadora: pagamento, data_proposta: agora.slice(0, 10), vendedor: "IA vendas",
        dados_customizados: { pedido, criado_por: "ia_vendas" },
      }]).select("id,workspace_id,nome,cpf,email,telefone1,status_venda,valor_plano,dados_customizados").single();
      if (error || !novo) throw error || new Error("falha ao gravar");
      let link_pagamento: string | undefined, aviso_pagamento: string | undefined;
      if (pagamento === "Pagamento online") {
        try { const r = await linkPagamentoDoPedido(novo, origem, c.cpf); link_pagamento = r.url; aviso_pagamento = r.erro; } catch (e: any) { aviso_pagamento = String(e?.message || e).slice(0, 160); }
      }
      return NextResponse.json({ ok: true, pedido_id: (novo as any).id, numero, subtotal, frete, total, total_texto: brl(total), servico_frete: servicoFrete, prazo_frete: prazoFrete, pagamento,
        link_pedido: `${origem}/pedido/${pedido.link_token}`, link_pagamento, aviso_pagamento });
    }

    if (acao === "link_pagamento") {
      if (!online) return NextResponse.json({ ok: false, erro: "A loja não tem pagamento online ativo" }, { status: 400 });
      const { data: x } = await supabaseServer.from("proposta").select("id,workspace_id,nome,cpf,email,telefone1,status_venda,valor_plano,dados_customizados").eq("workspace_id", ws).eq("id", n(b.pedido_id)).maybeSingle();
      if (!x) return NextResponse.json({ ok: false, erro: "Pedido não encontrado" }, { status: 404 });
      const r = await linkPagamentoDoPedido(x, origem, b.documento);
      return r.url ? NextResponse.json({ ok: true, link_pagamento: r.url }) : NextResponse.json({ ok: false, erro: r.erro }, { status: 409 });
    }

    if (acao === "status_pedido") {
      let q = supabaseServer.from("proposta").select("id,nome,telefone1,status_venda,valor_plano,plano,created_at,dados_customizados").eq("workspace_id", ws).not("dados_customizados->pedido", "is", null);
      if (n(b.pedido_id)) q = q.eq("id", n(b.pedido_id));
      else {
        const t = so(b.telefone).replace(/^55(?=\d{10,11}$)/, "");
        if (t.length < 10) return NextResponse.json({ ok: false, erro: "Informe pedido_id ou telefone" }, { status: 400 });
        q = q.in("telefone1", [t, "55" + t]);
      }
      const { data } = await q.order("created_at", { ascending: false }).limit(5);
      return NextResponse.json({ ok: true, pedidos: (data || []).map((x: any) => { const d = x.dados_customizados?.pedido || {}; return {
        pedido_id: x.id, numero: d.numero || String(x.id), data: String(x.created_at).slice(0, 10), itens: x.plano, total: brl(n(x.valor_plano)),
        etapa: ETAPA[x.status_venda] || x.status_venda, pago: d.pagamento_online?.status === "pago" || ["EM SEPARACAO", "AGUARDANDO ENTREGA", "ENTREGUE", "FECHADA"].includes(x.status_venda),
        entrega: d.entrega === "entrega" ? `entrega${d.servico_frete ? " " + d.servico_frete : ""}${d.prazo_frete ? ` (${d.prazo_frete})` : ""}` : "retirada na loja",
        rastreio: d.rastreio || null, link_pedido: d.link_token ? `${origem}/pedido/${d.link_token}` : null,
        link_pagamento: d.pagamento_online?.status !== "pago" ? d.pagamento_online?.url || null : null,
      }; }) });
    }

    return NextResponse.json({ ok: false, erro: "ação desconhecida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: String(e?.message || "falha interna").slice(0, 200) }, { status: 500 });
  }
}
