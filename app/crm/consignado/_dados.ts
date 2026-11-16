"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";

// ═══════════════════════════════════════════════════════════════════════
// Consignado — dados e cálculos
// ───────────────────────────────────────────────────────────────────────
// Cada contrato é uma linha da tabela `proposta` do workspace:
//   nome/cpf/telefone1/email/cidade/estado → cliente
//   operadora → banco · plano → produto · status_venda → etapa da esteira
//   valor_plano → valor liberado ao cliente (vale para os painéis gerais)
//   dados_customizados.consignado → convênio, benefício, margem, parcela,
//     prazo, taxa, comissão, nº da proposta no banco e histórico.
// A configuração (bancos, comissões, teto de juros e margens) fica em
// fin_config.config.consignado.
// ═══════════════════════════════════════════════════════════════════════

export type Etapa = { key: string; label: string; curto: string; icone: string; cor: string };

// As chaves batem com os status do tipo Consignado no resto do sistema (painel, funil, atendimento).
export const ETAPAS: Etapa[] = [
  { key: "SIMULACAO",             label: "Simulação",             curto: "Simulação",  icone: "🧮", cor: "#64748B" },
  { key: "DIGITADA",              label: "Digitada",              curto: "Digitada",   icone: "⌨️", cor: "#2563EB" },
  { key: "AGUARDANDO DOCUMENTOS", label: "Aguardando documentos", curto: "Documentos", icone: "📂", cor: "#7C3AED" },
  { key: "EM ANALISE NO BANCO",   label: "Em análise no banco",   curto: "Análise",    icone: "🏦", cor: "#0891B2" },
  { key: "AGUARDANDO AVERBACAO",  label: "Aguardando averbação",  curto: "Averbação",  icone: "📝", cor: "#D97706" },
  { key: "PAGO",                  label: "Pago ao cliente",       curto: "Pago",       icone: "💰", cor: "#16A34A" },
  { key: "REPROVADA",             label: "Reprovada",             curto: "Reprovada",  icone: "⛔", cor: "#DC2626" },
  { key: "CANCELADA",             label: "Cancelada",             curto: "Cancelada",  icone: "✖️", cor: "#94A3B8" },
];
export const ETAPAS_ANDAMENTO = ["SIMULACAO", "DIGITADA", "AGUARDANDO DOCUMENTOS", "EM ANALISE NO BANCO", "AGUARDANDO AVERBACAO"];
export const etapa = (key?: string | null) => ETAPAS.find((e) => e.key === key) || ETAPAS[0];

export const PRODUTOS = [
  { key: "novo",               label: "Empréstimo novo" },
  { key: "portabilidade",      label: "Portabilidade" },
  { key: "port_refin",         label: "Portabilidade + refinanciamento" },
  { key: "refinanciamento",    label: "Refinanciamento" },
  { key: "cartao_consignado",  label: "Cartão consignado (RMC)" },
  { key: "cartao_beneficio",   label: "Cartão benefício (RCC)" },
  { key: "saque_fgts",         label: "Antecipação saque-aniversário FGTS" },
];
export const produto = (key?: string | null) => PRODUTOS.find((p) => p.key === key)?.label || key || "—";

export const CONVENIOS = ["INSS", "SIAPE (federal)", "Servidor estadual", "Servidor municipal", "Forças Armadas", "CLT (consignado privado)", "FGTS"];

export type Banco = { nome: string; comissoes: Record<string, number> }; // % por produto
export type ConfigConsignado = {
  bancos: Banco[];
  comissao_padrao: number;   // % quando o banco/produto não tem regra
  base_comissao: "bruto" | "liberado";
  taxa_teto: number;         // % a.m. de referência (teto INSS para empréstimo)
  taxa_teto_cartao: number;  // % a.m. de referência para cartão
  margem_emprestimo: number; // % da renda
  margem_cartao: number;
  margem_beneficio: number;
  prazo_maximo: number;      // meses
};

export const BANCOS_PADRAO = ["Banco do Brasil", "Caixa", "Bradesco", "Itaú", "Santander", "BMG", "Pan", "C6 Consignado", "Daycoval", "Safra", "Mercantil", "Facta", "Banrisul", "Inter", "Agibank"];

export const CONFIG_PADRAO: ConfigConsignado = {
  bancos: BANCOS_PADRAO.map((nome) => ({ nome, comissoes: {} })),
  comissao_padrao: 0,
  base_comissao: "bruto",
  taxa_teto: 1.85,
  taxa_teto_cartao: 2.46,
  margem_emprestimo: 35,
  margem_cartao: 5,
  margem_beneficio: 5,
  prazo_maximo: 96,
};

export type Historico = { em: string; etapa?: string; nota: string; por?: string };

export type DadosConsignado = {
  convenio?: string;
  beneficio?: string;          // nº do benefício / matrícula
  especie?: string;            // espécie do benefício ou órgão
  renda?: number;              // salário/benefício bruto
  margem_disponivel?: number;  // R$ de margem livre informada pelo extrato
  parcela?: number;
  prazo?: number;
  taxa_mensal?: number;        // % a.m.
  valor_bruto?: number;        // valor do contrato
  valor_liberado?: number;     // valor que cai na conta do cliente
  saldo_quitado?: number;      // saldo pago na portabilidade/refin
  banco_origem?: string;       // portabilidade
  proposta_banco?: string;     // nº da proposta / ADE
  data_digitacao?: string;
  data_pagamento?: string;
  comissao_pct?: number | null;
  comissao_recebida_em?: string | null;
  observacoes?: string;
  historico?: Historico[];
};

export type Contrato = {
  id: number;
  created_at: string;
  updated_at?: string;
  data_proposta?: string | null;
  nome: string;
  cpf?: string | null;
  telefone1?: string | null;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  operadora?: string | null;   // banco
  plano?: string | null;       // produto
  status_venda?: string | null;// etapa
  vendedor?: string | null;
  valor_plano?: number | null; // valor liberado
  dados_customizados?: any;
};

export const cons = (c: Contrato): DadosConsignado => (c.dados_customizados?.consignado || {}) as DadosConsignado;

// ─── formatação ───
export const brl = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pctBR = (n: number, casas = 2) => `${(Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
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
export const cpfFmt = (v?: string | null) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : String(v || "");
};

// ─── matemática ───
// Valor presente de n parcelas iguais à taxa i (decimal).
export const valorPresente = (parcela: number, i: number, n: number) => (!parcela || !n ? 0 : !i ? parcela * n : (parcela * (1 - Math.pow(1 + i, -n))) / i);
export const parcelaPrice = (pv: number, i: number, n: number) => (!pv || !n ? 0 : !i ? pv / n : (pv * i) / (1 - Math.pow(1 + i, -n)));

/** Margem consignável e quanto dá para liberar. */
export function simularMargem(p: { renda: number; descontos: number; parcelasAtuais: number; taxa: number; prazo: number; margemPct: number; margemCartaoPct: number; margemBeneficioPct: number }) {
  const base = Math.max(0, p.renda - p.descontos);
  const margemTotal = base * (p.margemPct / 100);
  const margemLivre = Math.max(0, margemTotal - p.parcelasAtuais);
  const i = p.taxa / 100;
  const liberavel = valorPresente(margemLivre, i, p.prazo);
  return {
    base, margemTotal, margemLivre, liberavel,
    margemCartao: base * (p.margemCartaoPct / 100),
    margemBeneficio: base * (p.margemBeneficioPct / 100),
    totalPago: margemLivre * p.prazo,
  };
}

/** % de comissão do contrato: o do próprio contrato, senão a regra do banco/produto, senão o padrão. */
export function comissaoPct(c: Contrato, cfg: ConfigConsignado) {
  const d = cons(c);
  if (d.comissao_pct !== null && d.comissao_pct !== undefined && String(d.comissao_pct) !== "") return num(d.comissao_pct);
  const banco = cfg.bancos.find((b) => b.nome.toLowerCase() === String(c.operadora || "").toLowerCase());
  const regra = banco?.comissoes?.[c.plano || ""];
  return num(regra ?? cfg.comissao_padrao);
}
export function comissaoValor(c: Contrato, cfg: ConfigConsignado) {
  const d = cons(c);
  const base = cfg.base_comissao === "liberado" ? num(d.valor_liberado ?? c.valor_plano) : num(d.valor_bruto) || num(d.valor_liberado ?? c.valor_plano);
  return base * (comissaoPct(c, cfg) / 100);
}
export const valorLiberado = (c: Contrato) => num(cons(c).valor_liberado ?? c.valor_plano);
export const valorBruto = (c: Contrato) => num(cons(c).valor_bruto) || valorLiberado(c);

// ─── carregamento ───
export function useVeTodos() {
  const { veTudo, perfil, permissoes, loading } = usePermissao() as any;
  return { verTodos: !!(veTudo || perfil === "Administrador" || perfil === "Supervisor" || permissoes?.revisional_todas || permissoes?.vendas_equipe), carregandoPerm: !!loading };
}

const mesmo = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

async function filtrarMeus(lista: Contrato[]): Promise<Contrato[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email || "";
  if (!email) return [];
  const nomes = new Set<string>();
  const nomeMeta = String(user?.user_metadata?.nome || user?.user_metadata?.full_name || "").trim();
  if (nomeMeta) nomes.add(nomeMeta.toLowerCase());
  try {
    const { data: uw } = await supabase.from("usuarios_workspace").select("nome").eq("email", email);
    (uw || []).forEach((u: any) => { if (u?.nome) nomes.add(String(u.nome).trim().toLowerCase()); });
  } catch {}
  return lista.filter((c) => mesmo(c.vendedor, email) || mesmo(c.dados_customizados?.criado_por, email) || (!!c.vendedor && nomes.has(c.vendedor.trim().toLowerCase())));
}

export function useConsignado() {
  const { wsId } = useWorkspace();
  const { verTodos, carregandoPerm } = useVeTodos();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cfg, setCfg] = useState<ConfigConsignado>(CONFIG_PADRAO);
  const [usuarios, setUsuarios] = useState<{ email: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId || carregandoPerm) return;
    setCarregando(true);
    const [p, c, u] = await Promise.all([
      supabase.from("proposta")
        .select("id,created_at,updated_at,data_proposta,nome,cpf,telefone1,email,cidade,estado,operadora,plano,status_venda,vendedor,valor_plano,dados_customizados")
        .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(3000),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
      supabase.from("usuarios_workspace").select("email,nome").eq("workspace_id", wsId),
    ]);
    if (p.error) setErro(p.error.message); else setErro("");
    const todos = (p.data as Contrato[]) || [];
    setContratos(verTodos ? todos : await filtrarMeus(todos));
    const salvo = (c.data as any)?.config?.consignado || {};
    setCfg({ ...CONFIG_PADRAO, ...salvo, bancos: Array.isArray(salvo.bancos) && salvo.bancos.length ? salvo.bancos : CONFIG_PADRAO.bancos });
    setUsuarios(((u.data as any[]) || []).filter((x) => x?.email).map((x) => ({ email: x.email, nome: x.nome || x.email })));
    setCarregando(false);
  }, [wsId, verTodos, carregandoPerm]);

  useEffect(() => { carregar(); }, [carregar]);

  return { wsId, contratos, cfg, usuarios, carregando, erro, carregar, verTodos };
}

export async function salvarConfig(wsId: string, cfg: ConfigConsignado) {
  const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
  const config = { ...((data as any)?.config || {}), consignado: cfg };
  if (data) return supabase.from("fin_config").update({ config }).eq("workspace_id", wsId);
  return supabase.from("fin_config").insert({ workspace_id: wsId, regime: "simples", config });
}

export async function salvarContrato(wsId: string, campos: Partial<Contrato>, d: DadosConsignado, id?: number, dadosAtuais?: any) {
  const dados_customizados = { ...(dadosAtuais || {}), consignado: d };
  const payload: any = { ...campos, valor_plano: num(d.valor_liberado), dados_customizados, updated_at: new Date().toISOString() };
  if (id) return supabase.from("proposta").update(payload).eq("workspace_id", wsId).eq("id", id);
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email && !payload.dados_customizados.criado_por) payload.dados_customizados = { ...payload.dados_customizados, criado_por: user.email };
  if (!payload.vendedor && user?.email) payload.vendedor = user.email;
  return supabase.from("proposta").insert([{ ...payload, workspace_id: wsId, data_proposta: hoje() }]);
}

export async function mudarEtapa(wsId: string, c: Contrato, nova: string, nota = "", por?: string) {
  const d = cons(c);
  const extra: Partial<DadosConsignado> = {};
  if (nova === "DIGITADA" && !d.data_digitacao) extra.data_digitacao = hoje();
  if (nova === "PAGO" && !d.data_pagamento) extra.data_pagamento = hoje();
  const historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: nova, nota: nota || `Etapa: ${etapa(nova).label}`, por }];
  return salvarContrato(wsId, { status_venda: nova }, { ...d, ...extra, historico }, c.id, c.dados_customizados);
}

export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const mesDe = (c: Contrato) => String(cons(c).data_pagamento || cons(c).data_digitacao || c.data_proposta || c.created_at).slice(0, 7);
export const nomeUsuario = (usuarios: { email: string; nome: string }[], v?: string | null) => usuarios.find((u) => mesmo(u.email, v))?.nome || v || "—";
