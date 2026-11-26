"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useWorkspace } from "../../hooks/useWorkspace";
import { usePermissao } from "../../hooks/usePermissao";
import { novoToken } from "../../lib/loja-orcamento";
import { calcularSolar, configSolar, etapaSolar, type ConfigSolar, type DadosSolar, type EntradaSolar, type ObraSolar } from "../../lib/solar";

// ═══════════════════════════════════════════════════════════════════════
// Energia Solar — dados do CRM
// Cada proposta é uma linha da tabela `proposta` do workspace:
//   nome/telefone1/email/cidade/estado/endereco → cliente
//   status_venda → etapa (ETAPAS_SOLAR) · valor_plano → preço do sistema
//   plano → potência ("6,1 kWp") · operadora → kit (marca do módulo)
//   dados_customizados.solar → entrada, resultado do cálculo, link, aceite, histórico
// A configuração (kit, preços, tarifa, financiamento) fica em fin_config.config.solar.
// ═══════════════════════════════════════════════════════════════════════

export type PropostaSolar = {
  id: number;
  created_at: string;
  updated_at?: string | null;
  data_proposta?: string | null;
  nome: string;
  telefone1?: string | null;
  email?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  operadora?: string | null;
  plano?: string | null;
  status_venda?: string | null;
  vendedor?: string | null;
  valor_plano?: number | null;
  dados_customizados?: any;
};

export const sol = (p: PropostaSolar): DadosSolar => (p.dados_customizados?.solar || {}) as DadosSolar;
export const dataBR = (iso?: string | null) => (iso || "").slice(0, 10).split("-").reverse().join("/");
export const dataHoraBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
export const hoje = () => new Date().toISOString().slice(0, 10);
export const linkProposta = (token?: string) => (token ? `${typeof window !== "undefined" ? window.location.origin : "https://app.wolfgyn.com.br"}/solar/${token}` : "");
export const expirada = (d: DadosSolar) => !!d.validade_ate && new Date(d.validade_ate).getTime() < Date.now() && !d.aceite;

const mesmo = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function useSolar() {
  const { wsId } = useWorkspace();
  const { veTudo, perfil, permissoes, loading } = usePermissao() as any;
  const verTodos = !!(veTudo || perfil === "Administrador" || perfil === "Supervisor" || permissoes?.vendas_equipe);
  const [propostas, setPropostas] = useState<PropostaSolar[]>([]);
  const [cfg, setCfg] = useState<ConfigSolar>(configSolar(null));
  const [usuarios, setUsuarios] = useState<{ email: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!wsId || loading) return;
    setCarregando(true);
    const [p, c, u, eu] = await Promise.all([
      supabase.from("proposta")
        .select("id,created_at,updated_at,data_proposta,nome,telefone1,email,cpf,endereco,cidade,estado,operadora,plano,status_venda,vendedor,valor_plano,dados_customizados")
        .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(3000),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
      supabase.from("usuarios_workspace").select("email,nome").eq("workspace_id", wsId),
      supabase.auth.getUser(),
    ]);
    if (p.error) setErro(p.error.message); else setErro("");
    const todos = ((p.data as PropostaSolar[]) || []).filter((x) => x.dados_customizados?.solar);
    const email = eu.data.user?.email || "";
    setPropostas(verTodos ? todos : todos.filter((x) => mesmo(x.vendedor, email) || mesmo(x.dados_customizados?.criado_por, email)));
    setCfg(configSolar((c.data as any)?.config?.solar));
    setUsuarios(((u.data as any[]) || []).filter((x) => x?.email).map((x) => ({ email: x.email, nome: x.nome || x.email })));
    setCarregando(false);
  }, [wsId, verTodos, loading]);

  useEffect(() => { carregar(); }, [carregar]);
  return { wsId, propostas, cfg, usuarios, carregando, erro, carregar, verTodos };
}

export async function salvarConfigSolar(wsId: string, cfg: ConfigSolar) {
  const { data } = await supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle();
  const config = { ...((data as any)?.config || {}), solar: cfg };
  if (data) return supabase.from("fin_config").update({ config }).eq("workspace_id", wsId);
  return supabase.from("fin_config").insert({ workspace_id: wsId, regime: "simples", config });
}

export type ClienteSolar = { nome: string; telefone1: string; email: string; cpf: string; endereco: string; cidade: string; estado: string };

/** Grava a proposta recalculando o sistema com a configuração atual. Devolve o id. */
export async function salvarPropostaSolar(wsId: string, cfg: ConfigSolar, cliente: ClienteSolar, entrada: EntradaSolar, atual?: PropostaSolar | null, extra: Partial<DadosSolar> = {}, etapaNova?: string) {
  const resultado = calcularSolar({ ...entrada, uf: entrada.uf || cliente.estado }, cfg);
  const d0 = atual ? sol(atual) : {};
  const { data: { user } } = await supabase.auth.getUser();
  const d: DadosSolar = { ...d0, ...extra, entrada, resultado };
  if (!d.numero) d.numero = `SOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  if (!atual) d.historico = [{ em: new Date().toISOString(), etapa: etapaNova || "LEAD", nota: "Proposta criada", por: user?.email }];
  const payload: any = {
    nome: cliente.nome.trim() || "Cliente", telefone1: cliente.telefone1 || null, email: cliente.email || null, cpf: cliente.cpf || null,
    endereco: cliente.endereco || null, cidade: cliente.cidade || null, estado: (cliente.estado || resultado.uf || "").toUpperCase() || null,
    plano: `${String(resultado.kwp).replace(".", ",")} kWp`, operadora: cfg.painel_marca, valor_plano: resultado.preco,
    dados_customizados: { ...(atual?.dados_customizados || {}), solar: d, ...(atual ? {} : { criado_por: user?.email }) },
    updated_at: new Date().toISOString(),
  };
  if (etapaNova) payload.status_venda = etapaNova;
  if (atual) {
    const { error } = await supabase.from("proposta").update(payload).eq("workspace_id", wsId).eq("id", atual.id);
    if (error) throw error;
    return atual.id;
  }
  const { data, error } = await supabase.from("proposta").insert([{ ...payload, workspace_id: wsId, data_proposta: hoje(), status_venda: etapaNova || "LEAD", vendedor: user?.email || null }]).select("id").single();
  if (error) throw error;
  return (data as any).id as number;
}

/** Muda a etapa e anota no histórico. */
export async function mudarEtapaSolar(wsId: string, p: PropostaSolar, nova: string, nota = "") {
  const { data: { user } } = await supabase.auth.getUser();
  const d = sol(p);
  const historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: nova, nota: nota || `Etapa: ${etapaSolar(nova).label}`, por: user?.email }];
  return supabase.from("proposta").update({ status_venda: nova, dados_customizados: { ...(p.dados_customizados || {}), solar: { ...d, historico } }, updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("id", p.id);
}

/** Gera (ou renova) o link da proposta para o cliente. Devolve o token. */
export async function gerarLinkSolar(wsId: string, p: PropostaSolar, cfg: ConfigSolar, minutos?: number) {
  const { data: { user } } = await supabase.auth.getUser();
  const d = sol(p);
  const token = d.token || novoToken();
  const min = Math.min(43200, Math.max(1, Math.round(minutos || cfg.validade_minutos || 10080)));
  const validade_ate = new Date(Date.now() + min * 60000).toISOString();
  const historico = [...(d.historico || []), { em: new Date().toISOString(), nota: d.token ? `Link renovado por ${min} minutos` : "Link da proposta gerado", por: user?.email }];
  const etapa = ["LEAD", "PERDIDA"].includes(p.status_venda || "LEAD") ? "PROPOSTA ENVIADA" : p.status_venda;
  const { error } = await supabase.from("proposta").update({
    status_venda: etapa,
    dados_customizados: { ...(p.dados_customizados || {}), solar: { ...d, token, validade_ate, enviada_em: d.enviada_em || new Date().toISOString(), recusa: undefined, historico } },
    updated_at: new Date().toISOString(),
  }).eq("workspace_id", wsId).eq("id", p.id);
  if (error) throw error;
  return token;
}

/** Grava o projeto/homologação (dados_customizados.solar.obra) e anota no histórico. */
export async function salvarObraSolar(wsId: string, p: PropostaSolar, obra: ObraSolar, nota = "") {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: atual } = await supabase.from("proposta").select("dados_customizados").eq("workspace_id", wsId).eq("id", p.id).maybeSingle();
  const dc = (atual as any)?.dados_customizados || p.dados_customizados || {};
  const d: DadosSolar = dc.solar || {};
  const historico = nota ? [...(d.historico || []), { em: new Date().toISOString(), nota, por: user?.email }] : d.historico;
  return supabase.from("proposta").update({ dados_customizados: { ...dc, solar: { ...d, obra, historico } }, ...(obra.cpf_titular && !p.cpf ? { cpf: obra.cpf_titular } : {}), updated_at: new Date().toISOString() }).eq("workspace_id", wsId).eq("id", p.id);
}

/** Dias desde a data (ISO). */
export const diasDesde = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);
/** Quando a proposta entrou na etapa atual (pelo histórico). */
export const entrouNaEtapa = (p: PropostaSolar) => {
  const h = [...(sol(p).historico || [])].reverse().find((x) => x.etapa === p.status_venda);
  return h?.em || p.updated_at || p.created_at;
};

export async function excluirPropostaSolar(wsId: string, id: number) {
  return supabase.from("proposta").delete().eq("workspace_id", wsId).eq("id", id);
}

export const nomeUsuario = (usuarios: { email: string; nome: string }[], v?: string | null) => usuarios.find((u) => mesmo(u.email, v))?.nome || v || "—";

export function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
