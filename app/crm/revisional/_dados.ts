"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";

// ═══════════════════════════════════════════════════════════════════════
// ⚖️ Revisional — dados e cálculos
// ───────────────────────────────────────────────────────────────────────
// Cada contrato do cliente é uma linha da tabela `proposta` do workspace:
//   nome/cpf/telefone1/email/cidade/estado → cliente
//   operadora → banco/financeira · plano → modalidade · status_venda → etapa
//   dados_customizados.revisional → contrato, processo, honorários e histórico
// A configuração (taxas médias, honorários padrão) fica em
// fin_config.config.revisional, junto da configuração do Financeiro.
// ═══════════════════════════════════════════════════════════════════════

export type Etapa = { key: string; label: string; icone: string; cor: string };

export const ETAPAS: Etapa[] = [
  { key: "NOVO",         label: "Novo cliente",      icone: "🆕", cor: "#64748b" },
  { key: "DOCUMENTACAO", label: "Documentação",      icone: "📂", cor: "#2563eb" },
  { key: "CALCULO",      label: "Cálculo / perícia", icone: "🧮", cor: "#7c3aed" },
  { key: "NOTIFICADO",   label: "Notificação",       icone: "✉️", cor: "#0891b2" },
  { key: "AJUIZADO",     label: "Ação ajuizada",     icone: "⚖️", cor: "#d97706" },
  { key: "ACORDO",       label: "Em acordo",         icone: "🤝", cor: "#db2777" },
  { key: "GANHO",        label: "Concluído — êxito", icone: "🏆", cor: "#16a34a" },
  { key: "PERDIDO",      label: "Encerrado",         icone: "⛔", cor: "#dc2626" },
];
export const ETAPAS_ATIVAS = ETAPAS.filter((e) => e.key !== "GANHO" && e.key !== "PERDIDO").map((e) => e.key);
export const etapa = (key?: string | null) => ETAPAS.find((e) => e.key === key) || ETAPAS[0];

export type Modalidade = { key: string; label: string; icone: string; taxaMedia: number };

// Valores de referência (% a.m.). Conferir e atualizar em Configurações com a
// série de taxas médias do Banco Central (SGS) da data de cada contrato.
export const MODALIDADES_PADRAO: Modalidade[] = [
  { key: "veiculo",     label: "Financiamento de veículo", icone: "🚗", taxaMedia: 1.9 },
  { key: "consignado",  label: "Consignado",               icone: "🧾", taxaMedia: 1.7 },
  { key: "pessoal",     label: "Empréstimo pessoal",       icone: "💵", taxaMedia: 5.5 },
  { key: "cartao",      label: "Cartão de crédito",        icone: "💳", taxaMedia: 12.0 },
  { key: "cheque",      label: "Cheque especial",          icone: "🏧", taxaMedia: 7.9 },
  { key: "imobiliario", label: "Financiamento imobiliário", icone: "🏠", taxaMedia: 0.95 },
  { key: "capital_giro",label: "Capital de giro (PJ)",     icone: "🏢", taxaMedia: 2.4 },
  { key: "outro",       label: "Outro",                    icone: "📄", taxaMedia: 2.5 },
];

export type ConfigRevisional = {
  modalidades: Modalidade[];
  fator_abusividade: number;   // taxa contratada acima de X vezes a média = abusiva
  honorarios_entrada: number;  // R$
  honorarios_exito: number;    // % sobre o benefício
  honorarios_parcelas: number; // nº de parcelas da entrada
  repeticao_dobro: boolean;    // devolução em dobro do pago a maior
};

export const CONFIG_PADRAO: ConfigRevisional = {
  modalidades: MODALIDADES_PADRAO,
  fator_abusividade: 1.5,
  honorarios_entrada: 0,
  honorarios_exito: 30,
  honorarios_parcelas: 1,
  repeticao_dobro: false,
};

export type ParcelaHonorario = { n: number; vencimento: string; valor: number; pago_em?: string | null };
export type Historico = { em: string; etapa?: string; nota: string; por?: string };

export type DadosRevisional = {
  numero_contrato?: string;
  data_contrato?: string;
  valor_financiado?: number;
  prazo?: number;
  parcela?: number;
  taxa_mensal?: number;        // % a.m. informada no contrato
  parcelas_pagas?: number;
  taxa_media?: number | null;  // % a.m. usada no cálculo (vazio = da modalidade)
  processo_numero?: string;
  processo_vara?: string;
  processo_data?: string;
  honorarios_entrada?: number;
  honorarios_exito?: number;
  honorarios_parcelas?: ParcelaHonorario[];
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
  plano?: string | null;       // modalidade
  status_venda?: string | null;// etapa
  vendedor?: string | null;    // responsável
  dados_customizados?: any;
};

export const rev = (c: Contrato): DadosRevisional => (c.dados_customizados?.revisional || {}) as DadosRevisional;

// ─── formatação ───
export const brl = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pctBR = (n: number, casas = 2) => `${(Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const dataBR = (iso?: string | null) => (iso || "").slice(0, 10).split("-").reverse().join("/");
export const hoje = () => new Date().toISOString().slice(0, 10);
export const num = (v: any) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(limpo.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// ─── matemática financeira ───
// Parcela de uma série uniforme (Price) com taxa i (decimal) em n meses.
export function pmt(pv: number, i: number, n: number): number {
  if (!pv || !n) return 0;
  if (!i) return pv / n;
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

// Taxa mensal implícita (decimal) a partir de valor, parcela e prazo (Newton).
export function taxaImplicita(pv: number, parcela: number, n: number): number {
  if (!pv || !parcela || !n || parcela * n <= pv) return 0;
  let i = 0.02;
  for (let k = 0; k < 100; k++) {
    const a = Math.pow(1 + i, -n);
    const f = (pv * i) / (1 - a) - parcela;
    const d = (pmt(pv, i + 1e-7, n) - pmt(pv, i, n)) / 1e-7;
    if (!d) break;
    const novo = i - f / d;
    if (!Number.isFinite(novo) || novo <= 0) break;
    if (Math.abs(novo - i) < 1e-10) { i = novo; break; }
    i = novo;
  }
  return i;
}

export const anual = (mensalPct: number) => (Math.pow(1 + mensalPct / 100, 12) - 1) * 100;

export type Calculo = {
  valido: boolean;
  taxaContratada: number;  // % a.m.
  taxaMedia: number;       // % a.m.
  parcelaContratada: number;
  parcelaRevisada: number;
  diferencaParcela: number;
  pagoAMaior: number;      // já pago acima do devido (com dobro, se configurado)
  economiaFutura: number;  // parcelas que faltam
  beneficio: number;       // pagoAMaior + economiaFutura
  totalContratado: number;
  totalRevisado: number;
  abusiva: boolean;
  vezesMedia: number;
};

export function calcular(d: DadosRevisional, modalidade: string | null | undefined, cfg: ConfigRevisional): Calculo {
  const pv = num(d.valor_financiado), n = Math.round(num(d.prazo)), pagas = Math.min(Math.round(num(d.parcelas_pagas)), n);
  const mod = cfg.modalidades.find((m) => m.key === modalidade);
  const taxaMedia = num(d.taxa_media) || mod?.taxaMedia || 0;
  let parcelaContratada = num(d.parcela);
  let taxaContratada = num(d.taxa_mensal);
  if (!taxaContratada && parcelaContratada) taxaContratada = taxaImplicita(pv, parcelaContratada, n) * 100;
  if (!parcelaContratada && taxaContratada) parcelaContratada = pmt(pv, taxaContratada / 100, n);
  const valido = pv > 0 && n > 0 && parcelaContratada > 0 && taxaMedia > 0;
  const parcelaRevisada = valido ? pmt(pv, taxaMedia / 100, n) : 0;
  const diferencaParcela = valido ? Math.max(parcelaContratada - parcelaRevisada, 0) : 0;
  const pagoAMaior = diferencaParcela * pagas * (cfg.repeticao_dobro ? 2 : 1);
  const economiaFutura = diferencaParcela * (n - pagas);
  const vezesMedia = taxaMedia ? taxaContratada / taxaMedia : 0;
  return {
    valido, taxaContratada, taxaMedia, parcelaContratada, parcelaRevisada, diferencaParcela,
    pagoAMaior, economiaFutura, beneficio: pagoAMaior + economiaFutura,
    totalContratado: parcelaContratada * n, totalRevisado: parcelaRevisada * n,
    abusiva: valido && vezesMedia >= cfg.fator_abusividade, vezesMedia,
  };
}

// Honorários previstos de um contrato: entrada + % de êxito sobre o benefício.
export function honorariosPrevistos(d: DadosRevisional, calc: Calculo, cfg: ConfigRevisional) {
  const entrada = d.honorarios_entrada ?? cfg.honorarios_entrada;
  const exitoPct = d.honorarios_exito ?? cfg.honorarios_exito;
  const exito = calc.beneficio * (num(exitoPct) / 100);
  return { entrada: num(entrada), exitoPct: num(exitoPct), exito, total: num(entrada) + exito };
}

// ─── carregamento ───
export function useRevisional() {
  const { wsId } = useWorkspace();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cfg, setCfg] = useState<ConfigRevisional>(CONFIG_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [p, c] = await Promise.all([
      supabase.from("proposta")
        .select("id,created_at,updated_at,data_proposta,nome,cpf,telefone1,email,cidade,estado,operadora,plano,status_venda,vendedor,dados_customizados")
        .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(2000),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
    ]);
    if (p.error) setErro(p.error.message); else setErro("");
    setContratos((p.data as Contrato[]) || []);
    const salvo = (c.data as any)?.config?.revisional || {};
    setCfg({
      ...CONFIG_PADRAO,
      ...salvo,
      modalidades: Array.isArray(salvo.modalidades) && salvo.modalidades.length ? salvo.modalidades : MODALIDADES_PADRAO,
    });
    setCarregando(false);
  }, [wsId]);

  useEffect(() => { carregar(); }, [carregar]);

  return { wsId, contratos, cfg, carregando, erro, carregar };
}

export async function salvarConfig(wsId: string, cfg: ConfigRevisional) {
  const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
  const config = { ...((data as any)?.config || {}), revisional: cfg };
  if (data) return supabase.from("fin_config").update({ config }).eq("workspace_id", wsId);
  return supabase.from("fin_config").insert({ workspace_id: wsId, regime: "simples", config });
}

export async function salvarContrato(wsId: string, campos: Partial<Contrato>, d: DadosRevisional, id?: number, dadosAtuais?: any) {
  const dados_customizados = { ...(dadosAtuais || {}), revisional: d };
  const payload: any = { ...campos, dados_customizados, updated_at: new Date().toISOString() };
  if (id) return supabase.from("proposta").update(payload).eq("workspace_id", wsId).eq("id", id);
  return supabase.from("proposta").insert([{ ...payload, workspace_id: wsId, data_proposta: hoje() }]);
}

export async function mudarEtapa(wsId: string, c: Contrato, nova: string, nota: string, por?: string) {
  const d = rev(c);
  const historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: nova, nota: nota || `Etapa: ${etapa(nova).label}`, por }];
  return salvarContrato(wsId, { status_venda: nova }, { ...d, historico }, c.id, c.dados_customizados);
}

// Gera as parcelas da entrada de honorários a partir do 1º vencimento.
export function gerarParcelas(total: number, qtd: number, primeiro: string): ParcelaHonorario[] {
  const q = Math.max(1, Math.round(qtd || 1));
  const base = Math.floor((total / q) * 100) / 100;
  const ultimo = Math.round((total - base * (q - 1)) * 100) / 100;
  const [a, m, d] = (primeiro || hoje()).split("-").map(Number);
  return Array.from({ length: q }, (_, k) => {
    const dt = new Date(a, m - 1 + k, 1);
    const dia = Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate());
    const venc = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return { n: k + 1, vencimento: venc, valor: k === q - 1 ? ultimo : base, pago_em: null };
  });
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
