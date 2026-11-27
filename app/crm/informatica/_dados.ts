"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { numerosAtendidos, propostaDeClienteAtendido } from "../../lib/escopo-usuario";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import type { EmpresaLoja, FreteConfig } from "../../lib/loja-orcamento";

// ═══════════════════════════════════════════════════════════════════════
// Informática — loja de informática e assistência técnica (vendas, orçamentos, estoque e OS)
// ───────────────────────────────────────────────────────────────────────
// Pedido/orçamento = linha da tabela `proposta`:
//   nome/cpf/telefone1/email/endereco/cidade/estado → cliente
//   status_venda → etapa · valor_plano → total · plano → resumo dos itens
//   operadora → forma de pagamento · dados_customizados.pedido → itens,
//   descontos, frete, entrega, histórico e controle de baixa de estoque.
// Catálogo, estoque e regras ficam em fin_config.config.loja.
// ═══════════════════════════════════════════════════════════════════════

export type Modo = "roupas" | "vendas";

export type Etapa = { key: string; label: string; curto: string; cor: string };
const ETAPAS_ROUPAS: Etapa[] = [
  { key: "PENDENTE", label: "Novo pedido", curto: "Novo", cor: "#64748B" },
  { key: "AGUARDANDO PAGAMENTO", label: "Aguardando pagamento", curto: "Pagamento", cor: "#D97706" },
  { key: "EM SEPARACAO", label: "Em separação", curto: "Separação", cor: "#7C3AED" },
  { key: "AGUARDANDO ENTREGA", label: "Pronto / saiu para entrega", curto: "Entrega", cor: "#0891B2" },
  { key: "ENTREGUE", label: "Entregue", curto: "Entregue", cor: "#16A34A" },
  { key: "CANCELADA", label: "Cancelado", curto: "Cancelado", cor: "#94A3B8" },
];
const ETAPAS_VENDAS: Etapa[] = [
  { key: "PENDENTE", label: "Novo / em atendimento", curto: "Novo", cor: "#64748B" },
  { key: "EM NEGOCIACAO", label: "Orçamento enviado", curto: "Orçamento", cor: "#2563EB" },
  { key: "AGUARDANDO PAGAMENTO", label: "Aguardando pagamento", curto: "Pagamento", cor: "#D97706" },
  { key: "EM SEPARACAO", label: "Pago · em separação", curto: "Separação", cor: "#7C3AED" },
  { key: "AGUARDANDO ENTREGA", label: "Enviado / saiu para entrega", curto: "Enviado", cor: "#0891B2" },
  { key: "FECHADA", label: "Venda concluída", curto: "Concluída", cor: "#16A34A" },
  { key: "PERDIDA", label: "Perdida", curto: "Perdida", cor: "#DC2626" },
  { key: "CANCELADA", label: "Cancelada", curto: "Cancelada", cor: "#94A3B8" },
];
export const etapasDo = (m: Modo) => (m === "roupas" ? ETAPAS_ROUPAS : ETAPAS_VENDAS);
export const etapaDe = (m: Modo, key?: string | null) => etapasDo(m).find((e) => e.key === key) || etapasDo(m)[0];
// Etapas em que o estoque já saiu e a venda conta no faturamento.
export const CONFIRMADAS: Record<Modo, string[]> = { roupas: ["EM SEPARACAO", "AGUARDANDO ENTREGA", "ENTREGUE"], vendas: ["EM SEPARACAO", "AGUARDANDO ENTREGA", "FECHADA"] };
export const CONCLUIDAS: Record<Modo, string[]> = { roupas: ["ENTREGUE", "AGUARDANDO ENTREGA", "EM SEPARACAO"], vendas: ["EM SEPARACAO", "AGUARDANDO ENTREGA", "FECHADA"] };
export const ENCERRADAS = ["CANCELADA", "PERDIDA"];
// Ordem do fluxo principal (botão "avançar").
export const FLUXO: Record<Modo, string[]> = {
  roupas: ["PENDENTE", "AGUARDANDO PAGAMENTO", "EM SEPARACAO", "AGUARDANDO ENTREGA", "ENTREGUE"],
  vendas: ["PENDENTE", "EM NEGOCIACAO", "AGUARDANDO PAGAMENTO", "EM SEPARACAO", "AGUARDANDO ENTREGA", "FECHADA"],
};

export type Variante = { id: string; tamanho?: string; cor?: string; estoque: number; sku?: string };
export type Produto = {
  id: string; nome: string; categoria?: string; marca?: string; sku?: string; descricao?: string;
  preco: number; custo?: number; foto?: string; ativo: boolean;
  peso_kg?: number;              // usado no frete calculado
  codigo_fornecedor?: string;    // código na tabela da distribuidora (importação)
  ean?: string;
  fornecedor?: string;
  preco_ref?: { em: string; kabum?: number | null; terabyte?: number | null }; // última comparação com a concorrência
  servico?: boolean;             // serviço não controla estoque
  modelo?: string;
  garantia_meses?: number;       // garantia do produto vendido
  variantes: Variante[];
};
export type ConfigLoja = {
  produtos: Produto[];
  empresa?: EmpresaLoja;        // logo, CNPJ e contatos para orçamento/PDF/link
  frete?: FreteConfig;          // frete fixo ou calculado pelo CEP
  ia_vendas?: any;              // vendedora IA no WhatsApp e avisos do pedido
  categorias: string[];
  formas_pagamento: string[];
  taxa_entrega: number;
  estoque_minimo: number;
  tamanhos: string[];
  validade_orcamento_dias: number;
  tecnicos?: string[];           // assistência técnica
  garantia_servico_dias?: number;
};
export const CONFIG_PADRAO: Record<Modo, ConfigLoja> = {
  roupas: {
    produtos: [], categorias: ["Blusas", "Camisetas", "Calças", "Vestidos", "Saias", "Shorts", "Moda praia", "Acessórios", "Calçados"],
    formas_pagamento: ["PIX", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Link de pagamento"],
    taxa_entrega: 10, estoque_minimo: 2, tamanhos: ["PP", "P", "M", "G", "GG", "XG"], validade_orcamento_dias: 7,
  },
  vendas: {
    produtos: [], categorias: ["Notebooks", "Computadores", "Monitores", "Componentes", "Periféricos", "Armazenamento", "Redes", "Impressão", "Acessórios", "Softwares e licenças", "Serviços"],
    formas_pagamento: ["PIX", "Cartão de crédito", "Cartão de débito", "Boleto", "Dinheiro", "Transferência"],
    taxa_entrega: 0, estoque_minimo: 2, tamanhos: [], validade_orcamento_dias: 7,
    tecnicos: [], garantia_servico_dias: 90,
  },
};

// ─── Assistência técnica: ordens de serviço ───────────────────────────
// Cada OS também é uma linha da `proposta`, com dados_customizados.os
// (as vendas usam dados_customizados.pedido). status_venda = etapa da OS.
export const ETAPAS_OS: Etapa[] = [
  { key: "RECEBIDO", label: "Recebido", curto: "Recebido", cor: "#64748B" },
  { key: "EM DIAGNOSTICO", label: "Em diagnóstico", curto: "Diagnóstico", cor: "#2563EB" },
  { key: "AGUARDANDO APROVACAO", label: "Aguardando aprovação", curto: "Aprovação", cor: "#D97706" },
  { key: "EM REPARO", label: "Em reparo", curto: "Reparo", cor: "#7C3AED" },
  { key: "PRONTO", label: "Pronto para retirada", curto: "Pronto", cor: "#0891B2" },
  { key: "ENTREGUE", label: "Entregue", curto: "Entregue", cor: "#16A34A" },
  { key: "SEM CONSERTO", label: "Sem conserto / devolvido", curto: "Sem conserto", cor: "#DC2626" },
  { key: "CANCELADA", label: "Cancelada", curto: "Cancelada", cor: "#94A3B8" },
];
export const FLUXO_OS = ["RECEBIDO", "EM DIAGNOSTICO", "AGUARDANDO APROVACAO", "EM REPARO", "PRONTO", "ENTREGUE"];
export const OS_ABERTAS = ["RECEBIDO", "EM DIAGNOSTICO", "AGUARDANDO APROVACAO", "EM REPARO", "PRONTO"];
export const OS_PECAS_BAIXADAS = ["PRONTO", "ENTREGUE"];
export const etapaOS = (key?: string | null) => ETAPAS_OS.find((e) => e.key === key) || ETAPAS_OS[0];
export const EQUIPAMENTOS = ["Notebook", "Desktop / PC", "All-in-one", "Monitor", "Impressora", "Celular", "Tablet", "Console", "Placa / componente", "Outro"];

export type DadosOS = {
  numero?: string;
  equipamento?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  acessorios?: string;        // o que o cliente deixou junto (carregador, bolsa…)
  senha?: string;
  defeito?: string;           // relato do cliente
  diagnostico?: string;       // laudo técnico
  tecnico?: string;
  pecas: Item[];              // peças do estoque usadas no reparo
  mao_obra?: number;
  desconto?: number;
  previsao?: string;
  garantia_dias?: number;
  aprovado_em?: string | null;
  pronto_em?: string | null;
  entregue_em?: string | null;
  pagamento?: string;
  estoque_baixado?: boolean;
  observacoes?: string;
  historico?: Historico[];
};
export const os = (p: Pedido): DadosOS => ({ pecas: [], ...(p.dados_customizados?.os || {}) });
export const ehOS = (p: Pedido) => !!p.dados_customizados?.os;
export const totalOS = (d: DadosOS) => Math.max(0, subtotal(d.pecas) + num(d.mao_obra) - num(d.desconto));
export const fimGarantia = (d: DadosOS) => {
  if (!d.entregue_em || !num(d.garantia_dias)) return "";
  const x = new Date(d.entregue_em + "T12:00:00"); x.setDate(x.getDate() + num(d.garantia_dias)); return x.toISOString().slice(0, 10);
};

/** Mensagem ao cliente conforme a etapa da OS. */
export function mensagemOS(p: { nome: string }, d: DadosOS, etapa: string, empresa: string) {
  const eq = [d.equipamento, d.marca, d.modelo].filter(Boolean).join(" ");
  const cab = `*${empresa}* — Ordem de serviço nº ${d.numero || ""}\n${eq}${d.serie ? ` (série ${d.serie})` : ""}`;
  if (etapa === "AGUARDANDO APROVACAO") return `${cab}\n\nOlá, ${p.nome.split(" ")[0]}! Terminamos o diagnóstico:\n${d.diagnostico || "-"}\n\n${d.pecas.map((i) => `• ${i.qtd}x ${i.nome} — ${brl(i.qtd * i.preco)}`).join("\n")}${num(d.mao_obra) ? `\n• Mão de obra — ${brl(num(d.mao_obra))}` : ""}\n*Total: ${brl(totalOS(d))}*\n\nPosso aprovar o reparo?`;
  if (etapa === "PRONTO") return `${cab}\n\nOlá, ${p.nome.split(" ")[0]}! Seu equipamento está *pronto para retirada*. Total: ${brl(totalOS(d))}.${num(d.garantia_dias) ? ` Garantia do serviço: ${d.garantia_dias} dias.` : ""}`;
  if (etapa === "ENTREGUE") return `${cab}\n\nObrigado, ${p.nome.split(" ")[0]}! Equipamento entregue.${num(d.garantia_dias) ? ` Garantia do serviço de ${d.garantia_dias} dias.` : ""}`;
  return `${cab}\n\nOlá, ${p.nome.split(" ")[0]}! Recebemos seu equipamento.\nDefeito relatado: ${d.defeito || "-"}${d.acessorios ? `\nAcessórios deixados: ${d.acessorios}` : ""}${d.previsao ? `\nPrevisão: ${dataBR(d.previsao)}` : ""}\nAvisaremos a cada etapa.`;
}

/** Salva a OS; baixa as peças do estoque quando fica pronta e devolve se cancelar ou trocar as peças. */
export async function salvarOS(wsId: string, campos: Partial<Pedido>, d: DadosOS, atual?: Pedido | null) {
  const etapa = campos.status_venda || atual?.status_venda || "RECEBIDO";
  const baixar = OS_PECAS_BAIXADAS.includes(etapa);
  const dados: DadosOS = { ...d };
  const anterior = atual ? os(atual) : null;
  if (anterior?.estoque_baixado && (!baixar || JSON.stringify(anterior.pecas) !== JSON.stringify(dados.pecas))) { await moverEstoque(wsId, anterior.pecas, 1); dados.estoque_baixado = false; }
  if (baixar && !dados.estoque_baixado && dados.pecas.length) { await moverEstoque(wsId, dados.pecas, -1); dados.estoque_baixado = true; }
  if (etapa === "PRONTO" && !dados.pronto_em) dados.pronto_em = hoje();
  if (etapa === "ENTREGUE" && !dados.entregue_em) dados.entregue_em = hoje();
  if (["EM REPARO", "PRONTO", "ENTREGUE"].includes(etapa) && !dados.aprovado_em) dados.aprovado_em = hoje();
  const payload: any = {
    ...campos,
    valor_plano: totalOS(dados),
    plano: [dados.equipamento, dados.marca, dados.modelo].filter(Boolean).join(" ") || "Ordem de serviço",
    operadora: dados.tecnico || null,
    dados_customizados: { ...(atual?.dados_customizados || {}), os: dados },
    updated_at: new Date().toISOString(),
  };
  if (atual) return supabase.from("proposta").update(payload).eq("workspace_id", wsId).eq("id", atual.id);
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) { payload.dados_customizados.criado_por = user.email; if (!payload.vendedor) payload.vendedor = user.email; }
  if (!dados.numero) payload.dados_customizados.os.numero = "OS" + String(Date.now()).slice(-5);
  return supabase.from("proposta").insert([{ ...payload, workspace_id: wsId, data_proposta: hoje() }]);
}

export type Item = { produto_id: string; variante_id: string; nome: string; tamanho?: string; cor?: string; qtd: number; preco: number; servico?: boolean; serie?: string; garantia_meses?: number };
export type Historico = { em: string; etapa?: string; nota: string; por?: string };
export type DadosPedido = {
  numero?: string;
  link_token?: string;          // link público de aceite
  aprovado_cliente_em?: string; // aprovado pelo cliente no link (vira pedido)
  servico_frete?: string;       // SEDEX / PAC / Entrega
  prazo_frete?: string;
  aceite?: { em: string; entrega?: string; endereco?: string; cidade?: string; estado?: string; cep?: string; pagamento?: string; observacoes?: string; ip?: string };
  tipo?: "pedido" | "orcamento";
  recusa?: { em: string; motivo: string; por?: string }; // cliente recusou o orçamento (link ou WhatsApp)
  itens: Item[];
  desconto?: number;
  frete?: number;
  pagamento?: string;
  pago_em?: string | null;
  entrega?: "entrega" | "retirada";
  endereco_entrega?: string;
  data_entrega?: string;
  periodo_entrega?: string;
  rastreio?: string;
  validade?: string;
  observacoes?: string;
  estoque_baixado?: boolean;
  historico?: Historico[];
};
export type Pedido = {
  id: number; created_at: string; updated_at?: string; data_proposta?: string | null;
  nome: string; cpf?: string | null; telefone1?: string | null; email?: string | null;
  endereco?: string | null; cidade?: string | null; estado?: string | null;
  status_venda?: string | null; vendedor?: string | null; valor_plano?: number | null;
  operadora?: string | null; plano?: string | null; dados_customizados?: any;
};

export const ped = (p: Pedido): DadosPedido => ({ itens: [], ...(p.dados_customizados?.pedido || {}) });

// ─── formatação ───
export const brl = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (iso?: string | null) => (iso || "").slice(0, 10).split("-").reverse().join("/");
export const hoje = () => new Date().toISOString().slice(0, 10);
export const num = (v: any) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const telFmt = (t?: string | null) => {
  const s = String(t || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return s.length === 11 ? s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : s.length === 10 ? s.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") : String(t || "");
};
export const novoId = () => Math.random().toString(36).slice(2, 10);
export const descVariante = (v: { tamanho?: string; cor?: string }) => [v.tamanho, v.cor].filter(Boolean).join(" · ");

// ─── contas ───
export const subtotal = (itens: Item[]) => itens.reduce((s, i) => s + num(i.qtd) * num(i.preco), 0);
// Frete só conta na entrega (retirada não cobra frete, mesmo que tenha sobrado valor no campo)
export const totalPedido = (d: DadosPedido) => Math.max(0, subtotal(d.itens) - num(d.desconto) + (d.entrega === "retirada" ? 0 : num(d.frete)));
export const qtdItens = (itens: Item[]) => itens.reduce((s, i) => s + num(i.qtd), 0);
export const resumoItens = (itens: Item[]) => itens.map((i) => `${i.qtd}x ${i.nome}${descVariante(i) ? ` (${descVariante(i)})` : ""}`).join(", ").slice(0, 240);
export const estoqueProduto = (p: Produto) => p.variantes.reduce((s, v) => s + num(v.estoque), 0);
export const mesDe = (p: Pedido) => String(ped(p).pago_em || p.data_proposta || p.created_at).slice(0, 7);
export const custoItens = (itens: Item[], produtos: Produto[]) => itens.reduce((s, i) => s + num(i.qtd) * num(produtos.find((p) => p.id === i.produto_id)?.custo), 0);

/** Texto do orçamento/pedido para mandar ao cliente no WhatsApp. */
export function textoPedido(p: { nome: string }, d: DadosPedido, empresa: string, modo: Modo) {
  const titulo = d.tipo === "orcamento" ? "ORÇAMENTO" : "PEDIDO";
  const linhas = [
    `*${titulo}${d.numero ? ` nº ${d.numero}` : ""}* — ${empresa}`,
    `Cliente: ${p.nome}`, "",
    ...d.itens.map((i) => `• ${i.qtd}x ${i.nome}${i.serie ? ` (S/N ${i.serie})` : ""} — ${brl(num(i.preco) * num(i.qtd))}${i.garantia_meses ? ` · garantia ${i.garantia_meses} meses` : ""}`),
    "", `Subtotal: ${brl(subtotal(d.itens))}`,
    ...(num(d.desconto) ? [`Desconto: -${brl(num(d.desconto))}`] : []),
    ...(num(d.frete) ? [`${modo === "roupas" ? "Entrega" : "Frete"}: ${brl(num(d.frete))}`] : []),
    `*Total: ${brl(totalPedido(d))}*`,
    ...(d.pagamento ? [`Pagamento: ${d.pagamento}`] : []),
    ...(d.tipo === "orcamento" && d.validade ? [`Válido até ${dataBR(d.validade)}`] : []),
  ];
  return linhas.join("\n");
}

// ─── carregamento ───
export function useLoja(modo: Modo) {
  const { wsId, workspace } = useWorkspace() as any;
  const { veTudo, perfil, permissoes, loading } = usePermissao() as any;
  const verTodos = !!(veTudo || perfil === "Administrador" || perfil === "Supervisor" || permissoes?.vendas_equipe);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ordens, setOrdens] = useState<Pedido[]>([]);
  const [cfg, setCfg] = useState<ConfigLoja>(CONFIG_PADRAO[modo]);
  const [usuarios, setUsuarios] = useState<{ email: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId || loading) return;
    setCarregando(true);
    const [p, c, u, eu] = await Promise.all([
      supabase.from("proposta").select("id,created_at,updated_at,data_proposta,nome,cpf,telefone1,email,endereco,cidade,estado,status_venda,vendedor,valor_plano,operadora,plano,dados_customizados")
        .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(3000),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
      supabase.from("usuarios_workspace").select("email,nome").eq("workspace_id", wsId),
      supabase.auth.getUser(),
    ]);
    if (p.error) setErro(p.error.message); else setErro("");
    const todos = (p.data as Pedido[]) || [];
    const email = eu.data.user?.email || "";
    const meuNome = ((u.data as any[]) || []).find((x) => String(x?.email || "").toLowerCase() === email.toLowerCase())?.nome;
    const numeros = verTodos ? new Set<string>() : await numerosAtendidos(supabase, wsId, email, [meuNome]);
    const meus = verTodos ? todos : todos.filter((x) => [x.vendedor, x.dados_customizados?.criado_por].some((v) => v && email && v.toLowerCase() === email.toLowerCase()) || propostaDeClienteAtendido(x, numeros));
    setPedidos(meus.filter((x) => !x.dados_customizados?.os));
    setOrdens(meus.filter((x) => !!x.dados_customizados?.os));
    const salvo = (c.data as any)?.config?.loja || {};
    setCfg({ ...CONFIG_PADRAO[modo], ...salvo, produtos: Array.isArray(salvo.produtos) ? salvo.produtos : [] });
    setUsuarios(((u.data as any[]) || []).filter((x) => x?.email).map((x) => ({ email: x.email, nome: x.nome || x.email })));
    setCarregando(false);
  }, [wsId, loading, verTodos, modo]);

  useEffect(() => { carregar(); }, [carregar]);
  return { wsId, empresa: workspace?.nome || "", modo, pedidos, ordens, cfg, usuarios, carregando, erro, carregar, verTodos };
}

export async function salvarConfig(wsId: string, cfg: ConfigLoja) {
  const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
  const config = { ...((data as any)?.config || {}), loja: cfg };
  if (data) return supabase.from("fin_config").update({ config }).eq("workspace_id", wsId);
  return supabase.from("fin_config").insert({ workspace_id: wsId, regime: "simples", config });
}

/** Ajusta o estoque das variantes (delta por item) lendo a configuração mais recente. */
export async function moverEstoque(wsId: string, itens: Item[], sinal: 1 | -1) {
  const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
  const loja = (data as any)?.config?.loja;
  if (!loja?.produtos) return { error: null };
  const produtos: Produto[] = loja.produtos.map((p: Produto) => ({ ...p, variantes: p.variantes.map((v) => ({ ...v })) }));
  for (const i of itens) {
    const p = produtos.find((x) => x.id === i.produto_id);
    if (!p || p.servico) continue;
    const v = p.variantes.find((x) => x.id === i.variante_id);
    if (v) v.estoque = num(v.estoque) + sinal * num(i.qtd);
  }
  return salvarConfig(wsId, { ...loja, produtos });
}

/** Salva o pedido e acerta o estoque quando ele entra ou sai das etapas confirmadas. */
export async function salvarPedido(wsId: string, modo: Modo, campos: Partial<Pedido>, d: DadosPedido, atual?: Pedido | null) {
  const etapa = campos.status_venda || atual?.status_venda || "PENDENTE";
  const confirmada = CONFIRMADAS[modo].includes(etapa);
  const dados: DadosPedido = { ...d };
  const anterior = atual ? ped(atual) : null;
  // Estoque: baixa ao confirmar; devolve ao cancelar ou se os itens mudarem depois da baixa.
  if (anterior?.estoque_baixado && (!confirmada || JSON.stringify(anterior.itens) !== JSON.stringify(dados.itens))) {
    await moverEstoque(wsId, anterior.itens, 1);
    dados.estoque_baixado = false;
  }
  if (confirmada && !dados.estoque_baixado && dados.tipo !== "orcamento") {
    await moverEstoque(wsId, dados.itens, -1);
    dados.estoque_baixado = true;
  }
  if (confirmada && !dados.pago_em) dados.pago_em = hoje();
  const payload: any = {
    ...campos,
    valor_plano: totalPedido(dados),
    plano: resumoItens(dados.itens) || null,
    operadora: dados.pagamento || null,
    dados_customizados: { ...(atual?.dados_customizados || {}), pedido: dados },
    updated_at: new Date().toISOString(),
  };
  if (atual) return supabase.from("proposta").update(payload).eq("workspace_id", wsId).eq("id", atual.id);
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) { payload.dados_customizados.criado_por = user.email; if (!payload.vendedor) payload.vendedor = user.email; }
  if (!dados.numero) payload.dados_customizados.pedido.numero = String(Date.now()).slice(-6);
  return supabase.from("proposta").insert([{ ...payload, workspace_id: wsId, data_proposta: hoje() }]);
}

export async function mudarEtapa(wsId: string, modo: Modo, p: Pedido, nova: string, nota = "", por?: string) {
  const d = ped(p);
  const historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: nova, nota: nota || `Etapa: ${etapaDe(modo, nova).label}`, por }];
  const tipo = d.tipo === "orcamento" && !["PENDENTE", "EM NEGOCIACAO"].includes(nova) ? "pedido" : d.tipo;
  return salvarPedido(wsId, modo, { status_venda: nova }, { ...d, tipo, historico }, p);
}

export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const nomeUsuario = (usuarios: { email: string; nome: string }[], v?: string | null) => usuarios.find((u) => !!v && u.email.toLowerCase() === v.toLowerCase())?.nome || v || "—";
