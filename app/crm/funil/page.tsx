"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "../../lib/supabase";
import { usePermissao } from "../../hooks/usePermissao";
import { useEquipeFiltro } from "../../hooks/useEquipeFiltro";

// ═══════════════════════════════════════════════════════════════════════
// 🎯 FUNIL DE VENDAS — SISTEMA COMPLETO COM DRILL-DOWN
// Abas: Visão Geral · Instaladas · Pipeline · Canceladas · Vendedores ·
//       Operadoras · Planos · Temporal
// ═══════════════════════════════════════════════════════════════════════

type Proposta = {
  id: number; created_at: string; updated_at?: string; nome: string;
  vendedor: string; valor_plano: number; status_venda: string;
  operadora?: string; plano?: string; workspace_id: string;
  equipe_id?: string | null;
  data_instalacao?: string | null;
  cpf?: string; cidade?: string; estado?: string;
};
type UsuarioWs = { email: string; nome: string };

const STATUS_META: Record<string, { label: string; cor: string; bg: string; border: string; icone: string }> = {
  "GERADA":                { label: "Gerada",       cor: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", icone: "📨" },
  "AGUARDANDO AUDITORIA":  { label: "Em Auditoria", cor: "#06b6d4", bg: "#ecfeff", border: "#a5f3fc", icone: "🔍" },
  "PENDENTE":              { label: "Pendente",     cor: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icone: "⏳" },
  "INSTALADA":             { label: "Instalada",    cor: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icone: "✅" },
  "CANCELADA":             { label: "Cancelada",    cor: "#dc2626", bg: "#fef2f2", border: "#fecaca", icone: "❌" },
};
const STATUS_ATIVOS = ["GERADA", "AGUARDANDO AUDITORIA", "PENDENTE"];

const BUCKETS_VALOR = [
  { label: "Até R$80",  min: 0,   max: 80,       cor: "#94a3b8" },
  { label: "R$80–120",  min: 80,  max: 120,      cor: "#3b82f6" },
  { label: "R$120–150", min: 120, max: 150,      cor: "#06b6d4" },
  { label: "R$150–200", min: 150, max: 200,      cor: "#8b5cf6" },
  { label: "R$200+",    min: 200, max: Infinity, cor: "#f59e0b" },
];

const AGING_BUCKETS = [
  { label: "Até 7 dias", min: 0,  max: 7,        cor: "#16a34a" },
  { label: "8–15 dias",  min: 7,  max: 15,       cor: "#3b82f6" },
  { label: "16–30 dias", min: 15, max: 30,       cor: "#f59e0b" },
  { label: "31+ dias",   min: 30, max: Infinity, cor: "#dc2626" },
];

type Aba = "visao" | "instaladas" | "pipeline" | "canceladas" | "vendedores" | "operadoras" | "planos" | "temporal" | "cohort" | "horarios";

export default function Funil() {
  const router = useRouter();
  const { isDono, isSuperAdmin, permissoes } = usePermissao();

  const [aba, setAba] = useState<Aba>("visao");
  const [filtro, setFiltro] = useState<"semanal" | "mensal" | "trimestral" | "ano">("mensal");
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [usuariosWs, setUsuariosWs] = useState<UsuarioWs[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [filtroOperadora, setFiltroOperadora] = useState<string>("todas");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [workspaceId, setWorkspaceId] = useState<string>("");

  // 👥 Filtro de equipe
  const { equipeId, EquipeSelector } = useEquipeFiltro(workspaceId);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const cardStyle = {
    background: "#ffffff", borderRadius: 14, border: "1px solid #e5e7eb",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  };
  const inputStyle = {
    background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
    padding: "9px 14px", color: "#1f2937", fontSize: 13,
    outline: "none", cursor: "pointer", fontWeight: 600,
  };
  const sectionTitleStyle = {
    color: "#1f2937", fontSize: 15, fontWeight: 700,
    margin: "0 0 16px 0", display: "flex" as const, alignItems: "center" as const, gap: 8,
  };

  // ─── INIT ───
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      let wsIds: string[] = [];
      let ownerEmail = "";
      let wsNomeStr = "";

      const { data: wsDono } = await supabase.from("workspaces").select("*").eq("owner_id", user.id).maybeSingle();
      if (wsDono) {
        if (wsDono.username) wsIds.push(wsDono.username);
        if (wsDono.id) wsIds.push(wsDono.id.toString());
        ownerEmail = wsDono.owner_email || "";
        wsNomeStr = wsDono.nome || "";
      } else {
        const { data: uw } = await supabase.from("usuarios_workspace")
          .select("workspace_id").eq("email", user.email)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (uw?.workspace_id) {
          wsIds.push(uw.workspace_id);
          const { data: wsSub } = await supabase.from("workspaces")
            .select("nome, username, id, owner_email")
            .or(`username.eq.${uw.workspace_id},id.eq.${uw.workspace_id}`).maybeSingle();
          if (wsSub) {
            ownerEmail = wsSub.owner_email || "";
            wsNomeStr = wsSub.nome || "";
            if (wsSub.username && !wsIds.includes(wsSub.username)) wsIds.push(wsSub.username);
            if (wsSub.id && !wsIds.includes(wsSub.id.toString())) wsIds.push(wsSub.id.toString());
          }
        }
      }
      if (wsIds.length === 0) { setLoading(false); return; }
      setWorkspaceId(wsIds[0]);

      const { data: props } = await supabase.from("proposta").select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false })
        .limit(5000);
      setPropostas((props || []) as Proposta[]);

      const lista: UsuarioWs[] = [];
      if (ownerEmail) lista.push({ email: ownerEmail, nome: wsNomeStr || "Dono" });
      const { data: subs } = await supabase.from("usuarios_workspace")
        .select("email, nome").in("workspace_id", wsIds);
      for (const s of (subs || [])) {
        if (s.email && !lista.find(x => x.email?.toLowerCase() === s.email?.toLowerCase())) {
          lista.push({ email: s.email, nome: s.nome || s.email });
        }
      }
      setUsuariosWs(lista);
      setLoading(false);
    };
    init();
  }, []);

  // ─── Helpers ───
  const nomeVendedor = (v: string): string => {
    if (!v) return "—";
    const u = usuariosWs.find(x => x.email?.toLowerCase() === v?.toLowerCase());
    return u?.nome || v;
  };
  const formatBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatBRLCompacto = (v: number): string => {
    if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace(".0", "")}M`;
    if (v >= 1000)    return `R$ ${(v / 1000).toFixed(1).replace(".0", "")}k`;
    return `R$ ${v.toFixed(0)}`;
  };
  const diffDays = (ini: string | Date, fim?: string | Date | null) => {
    const a = new Date(ini).getTime();
    const b = fim ? new Date(fim).getTime() : Date.now();
    return Math.max(0, Math.floor((b - a) / 86400000));
  };
  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
  const trend = (atual: number, anterior: number) => {
    if (anterior === 0) return atual > 0 ? 100 : 0;
    return Math.round(((atual - anterior) / anterior) * 100);
  };

  const periodoEmDias = filtro === "semanal" ? 7 : filtro === "mensal" ? 30 : filtro === "trimestral" ? 90 : 365;
  const filtroLabel: Record<string, string> = { semanal: "7 dias", mensal: "30 dias", trimestral: "90 dias", ano: "1 ano" };

  // ═══ Pipeline de filtros ═══
  const propsFiltradas = useMemo(() => {
    const agora = new Date();
    const limite = new Date(agora.getTime() - periodoEmDias * 86400000);
    return propostas.filter(p => {
      if (new Date(p.created_at) < limite) return false;
      if (equipeId && p.equipe_id !== equipeId) return false;
      if (filtroVendedor !== "todos" && p.vendedor !== filtroVendedor) return false;
      if (filtroOperadora !== "todas" && (p.operadora || "") !== filtroOperadora) return false;
      if (filtroPlano !== "todos" && (p.plano || "") !== filtroPlano) return false;
      return true;
    });
  }, [propostas, periodoEmDias, equipeId, filtroVendedor, filtroOperadora, filtroPlano]);

  const propsAnterior = useMemo(() => {
    const agora = new Date();
    const limFim = new Date(agora.getTime() - periodoEmDias * 86400000);
    const limIni = new Date(agora.getTime() - 2 * periodoEmDias * 86400000);
    return propostas.filter(p => {
      const d = new Date(p.created_at);
      if (d < limIni || d >= limFim) return false;
      if (equipeId && p.equipe_id !== equipeId) return false;
      if (filtroVendedor !== "todos" && p.vendedor !== filtroVendedor) return false;
      if (filtroOperadora !== "todas" && (p.operadora || "") !== filtroOperadora) return false;
      if (filtroPlano !== "todos" && (p.plano || "") !== filtroPlano) return false;
      return true;
    });
  }, [propostas, periodoEmDias, equipeId, filtroVendedor, filtroOperadora, filtroPlano]);

  const porStatus = useMemo(() => {
    const m: Record<string, Proposta[]> = {};
    for (const p of propsFiltradas) {
      const s = p.status_venda || "GERADA";
      if (!m[s]) m[s] = [];
      m[s].push(p);
    }
    return m;
  }, [propsFiltradas]);

  const metricas = useMemo(() => {
    const instaladas = porStatus["INSTALADA"] || [];
    const canceladas = porStatus["CANCELADA"] || [];
    const geradas = porStatus["GERADA"] || [];
    const auditoria = porStatus["AGUARDANDO AUDITORIA"] || [];
    const pendentes = porStatus["PENDENTE"] || [];
    const emPipelineArr = [...geradas, ...auditoria, ...pendentes];

    const receitaRealizada = instaladas.reduce((a, p) => a + (p.valor_plano || 0), 0);
    const pipelineValue = emPipelineArr.reduce((a, p) => a + (p.valor_plano || 0), 0);
    const valorPerdido = canceladas.reduce((a, p) => a + (p.valor_plano || 0), 0);

    const fechados = instaladas.length + canceladas.length;
    const winRate = pct(instaladas.length, fechados);

    const ticketMedio = instaladas.length > 0 ? Math.round(receitaRealizada / instaladas.length) : 0;
    const ticketPipeline = emPipelineArr.length > 0 ? Math.round(pipelineValue / emPipelineArr.length) : 0;

    let cicloMedio = 0;
    if (instaladas.length > 0) {
      const dias = instaladas.map(p => diffDays(p.created_at, p.data_instalacao || p.updated_at));
      cicloMedio = Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
    }
    const forecast = Math.round(pipelineValue * (winRate / 100));

    return {
      receitaRealizada, pipelineValue, valorPerdido, winRate, cicloMedio,
      ticketMedio, ticketPipeline, forecast,
      instaladas: instaladas.length, canceladas: canceladas.length,
      geradas: geradas.length, auditoria: auditoria.length, pendentes: pendentes.length,
      total: propsFiltradas.length, emPipeline: emPipelineArr.length, fechados,
    };
  }, [porStatus, propsFiltradas]);

  const metricasAnt = useMemo(() => {
    const inst = propsAnterior.filter(p => p.status_venda === "INSTALADA");
    const canc = propsAnterior.filter(p => p.status_venda === "CANCELADA");
    const fechados = inst.length + canc.length;
    return {
      receita: inst.reduce((a, p) => a + (p.valor_plano || 0), 0),
      instaladas: inst.length, canceladas: canc.length,
      total: propsAnterior.length, winRate: pct(inst.length, fechados),
    };
  }, [propsAnterior]);

  const etapasFunil = useMemo(() => {
    const total = metricas.total;
    const naAudOuDepois = metricas.auditoria + metricas.pendentes + metricas.instaladas;
    const pendOuDepois = metricas.pendentes + metricas.instaladas;
    const inst = metricas.instaladas;
    return [
      { key: "GERADA",    nome: "Propostas Geradas", qtd: total,         color: STATUS_META["GERADA"].cor,               taxa: 100, icone: "📨", aba: "visao" as Aba },
      { key: "AUDITORIA", nome: "Em Auditoria",      qtd: naAudOuDepois, color: STATUS_META["AGUARDANDO AUDITORIA"].cor, taxa: pct(naAudOuDepois, total), icone: "🔍", aba: "pipeline" as Aba },
      { key: "PENDENTE",  nome: "Pendentes",         qtd: pendOuDepois,  color: STATUS_META["PENDENTE"].cor,             taxa: pct(pendOuDepois, total),  icone: "⏳", aba: "pipeline" as Aba },
      { key: "INSTALADA", nome: "Instaladas",        qtd: inst,          color: STATUS_META["INSTALADA"].cor,            taxa: pct(inst, total),          icone: "✅", aba: "instaladas" as Aba },
    ];
  }, [metricas]);

  const conversoes = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < etapasFunil.length - 1; i++) arr.push(pct(etapasFunil[i + 1].qtd, etapasFunil[i].qtd));
    return arr;
  }, [etapasFunil]);

  const propostasEmRisco = useMemo(() => {
    return propsFiltradas
      .filter(p => p.status_venda === "AGUARDANDO AUDITORIA" || p.status_venda === "PENDENTE")
      .map(p => ({ ...p, diasParado: diffDays(p.updated_at || p.created_at) }))
      .filter(p => p.diasParado >= 7)
      .sort((a, b) => b.diasParado - a.diasParado);
  }, [propsFiltradas]);

  const distribuicaoValor = useMemo(() => {
    const distribuir = (lista: Proposta[]) => BUCKETS_VALOR.map(b => ({
      faixa: b.label,
      qtd: lista.filter(p => (p.valor_plano || 0) >= b.min && (p.valor_plano || 0) < b.max).length,
      valor: lista.filter(p => (p.valor_plano || 0) >= b.min && (p.valor_plano || 0) < b.max).reduce((a, p) => a + (p.valor_plano || 0), 0),
      cor: b.cor,
    }));
    return {
      instaladas: distribuir(porStatus["INSTALADA"] || []),
      pipeline: distribuir([...(porStatus["GERADA"] || []), ...(porStatus["AGUARDANDO AUDITORIA"] || []), ...(porStatus["PENDENTE"] || [])]),
      canceladas: distribuir(porStatus["CANCELADA"] || []),
    };
  }, [porStatus]);

  const agingPipeline = useMemo(() => {
    const ativo = [...(porStatus["GERADA"] || []), ...(porStatus["AGUARDANDO AUDITORIA"] || []), ...(porStatus["PENDENTE"] || [])];
    return AGING_BUCKETS.map(b => {
      const subset = ativo.filter(p => {
        const dias = diffDays(p.updated_at || p.created_at);
        return dias >= b.min && dias < b.max;
      });
      return { faixa: b.label, cor: b.cor, qtd: subset.length, valor: subset.reduce((a, p) => a + (p.valor_plano || 0), 0) };
    });
  }, [porStatus]);

  const topVendas = useMemo(() => (porStatus["INSTALADA"] || []).slice().sort((a, b) => (b.valor_plano || 0) - (a.valor_plano || 0)).slice(0, 10), [porStatus]);
  const topCanceladas = useMemo(() => (porStatus["CANCELADA"] || []).slice().sort((a, b) => (b.valor_plano || 0) - (a.valor_plano || 0)).slice(0, 10), [porStatus]);

  const vendedoresStats = useMemo(() => {
    type Acc = { total: number; instaladas: number; canceladas: number; pipeline: number; valorInstalado: number; valorPipeline: number; valorPerdido: number; ciclos: number[]; };
    const mapa: Record<string, Acc> = {};
    for (const p of propsFiltradas) {
      if (!p.vendedor) continue;
      if (!mapa[p.vendedor]) mapa[p.vendedor] = { total: 0, instaladas: 0, canceladas: 0, pipeline: 0, valorInstalado: 0, valorPipeline: 0, valorPerdido: 0, ciclos: [] };
      const acc = mapa[p.vendedor];
      acc.total++;
      const v = p.valor_plano || 0;
      if (p.status_venda === "INSTALADA") { acc.instaladas++; acc.valorInstalado += v; acc.ciclos.push(diffDays(p.created_at, p.data_instalacao || p.updated_at)); }
      else if (p.status_venda === "CANCELADA") { acc.canceladas++; acc.valorPerdido += v; }
      else if (STATUS_ATIVOS.includes(p.status_venda)) { acc.pipeline++; acc.valorPipeline += v; }
    }
    return Object.entries(mapa).map(([email, d]) => {
      const fechados = d.instaladas + d.canceladas;
      const wr = pct(d.instaladas, fechados);
      const cicloMed = d.ciclos.length > 0 ? Math.round(d.ciclos.reduce((a, b) => a + b, 0) / d.ciclos.length) : 0;
      const ticket = d.instaladas > 0 ? Math.round(d.valorInstalado / d.instaladas) : 0;
      return { email, nome: nomeVendedor(email), ...d, winRate: wr, cicloMed, ticket };
    });
  }, [propsFiltradas, usuariosWs]);

  const agregarPor = (campo: keyof Proposta) => {
    type Acc = { total: number; instaladas: number; canceladas: number; pipeline: number; receita: number; pipelineValor: number; perdido: number; };
    const mapa: Record<string, Acc> = {};
    for (const p of propsFiltradas) {
      const k = (p[campo] as string) || "—";
      if (!mapa[k]) mapa[k] = { total: 0, instaladas: 0, canceladas: 0, pipeline: 0, receita: 0, pipelineValor: 0, perdido: 0 };
      const acc = mapa[k]; acc.total++;
      const v = p.valor_plano || 0;
      if (p.status_venda === "INSTALADA") { acc.instaladas++; acc.receita += v; }
      else if (p.status_venda === "CANCELADA") { acc.canceladas++; acc.perdido += v; }
      else if (STATUS_ATIVOS.includes(p.status_venda)) { acc.pipeline++; acc.pipelineValor += v; }
    }
    return Object.entries(mapa).map(([k, d]) => {
      const fechados = d.instaladas + d.canceladas;
      return { chave: k, ...d, winRate: pct(d.instaladas, fechados) };
    }).sort((a, b) => b.receita - a.receita);
  };

  const operadorasStats = useMemo(() => agregarPor("operadora"), [propsFiltradas]); // eslint-disable-line react-hooks/exhaustive-deps
  const planosStats = useMemo(() => agregarPor("plano"),  [propsFiltradas]); // eslint-disable-line react-hooks/exhaustive-deps

  const serieTemporal = useMemo(() => {
    const dias = Math.min(periodoEmDias, 90);
    const buckets: Record<string, { data: string; geradas: number; instaladas: number; canceladas: number; receita: number; dataLabel: string }> = {};
    const agora = new Date();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(agora.getTime() - i * 86400000);
      const k = d.toISOString().slice(0, 10);
      buckets[k] = { data: k, geradas: 0, instaladas: 0, canceladas: 0, receita: 0, dataLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) };
    }
    for (const p of propsFiltradas) {
      const k = p.created_at.slice(0, 10);
      if (buckets[k]) {
        buckets[k].geradas++;
        if (p.status_venda === "INSTALADA") { buckets[k].instaladas++; buckets[k].receita += (p.valor_plano || 0); }
        else if (p.status_venda === "CANCELADA") buckets[k].canceladas++;
      }
    }
    return Object.values(buckets);
  }, [propsFiltradas, periodoEmDias]);

  const mixReceitaPorVendedor = useMemo(() => vendedoresStats.filter(v => v.valorInstalado > 0).sort((a, b) => b.valorInstalado - a.valorInstalado).slice(0, 7).map(v => ({ nome: v.nome, valor: v.valorInstalado })), [vendedoresStats]);
  const mixReceitaPorOperadora = useMemo(() => operadorasStats.filter(o => o.receita > 0).map(o => ({ nome: o.chave, valor: o.receita })), [operadorasStats]);

  const operadorasUnicas = useMemo(() => Array.from(new Set(propostas.map(p => p.operadora).filter(Boolean) as string[])).sort(), [propostas]);
  const planosUnicos = useMemo(() => Array.from(new Set(propostas.map(p => p.plano).filter(Boolean) as string[])).sort(), [propostas]);

  // ═══ COORTE — propostas geradas por semana e o que aconteceu com elas ═══
  // Olha pras propostas com filtro de equipe/vendedor/plano/operadora (não período).
  const cohort = useMemo(() => {
    let base = propostas;
    if (equipeId) base = base.filter(p => p.equipe_id === equipeId);
    if (filtroVendedor !== "todos") base = base.filter(p => p.vendedor === filtroVendedor);
    const agora = new Date();
    const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const linhas: {
      label: string; total: number;
      instaladas: number; canceladas: number; emAberto: number;
      receita: number;
      taxaInst: number; taxaCanc: number; taxaAberto: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const ini = new Date(hoje0.getTime() - (i + 1) * 7 * 86400000);
      const fim = new Date(hoje0.getTime() - i * 7 * 86400000);
      const semana = base.filter(p => {
        const d = new Date(p.created_at);
        return d >= ini && d < fim;
      });
      const inst = semana.filter(p => p.status_venda === "INSTALADA");
      const canc = semana.filter(p => p.status_venda === "CANCELADA").length;
      const aberto = semana.length - inst.length - canc;
      const total = semana.length;
      linhas.push({
        label: ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        total,
        instaladas: inst.length,
        canceladas: canc,
        emAberto: aberto,
        receita: inst.reduce((a, p) => a + (p.valor_plano || 0), 0),
        taxaInst: total > 0 ? Math.round((inst.length / total) * 100) : 0,
        taxaCanc: total > 0 ? Math.round((canc / total) * 100) : 0,
        taxaAberto: total > 0 ? Math.round((aberto / total) * 100) : 0,
      });
    }
    return linhas;
  }, [propostas, equipeId, filtroVendedor]);

  // ═══ HEATMAP dia da semana × hora do dia (quando entram propostas) ═══
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const p of propsFiltradas) {
      const d = new Date(p.created_at);
      grid[d.getDay()][d.getHours()]++;
    }
    let max = 0;
    for (const row of grid) for (const v of row) if (v > max) max = v;
    return { grid, max };
  }, [propsFiltradas]);

  // Melhor dia/horário (pico)
  const picoHorario = useMemo(() => {
    let best = { dia: 0, hora: 0, qtd: 0 };
    heatmap.grid.forEach((row, dia) => {
      row.forEach((qtd, hora) => {
        if (qtd > best.qtd) best = { dia, hora, qtd };
      });
    });
    return best;
  }, [heatmap]);

  // Totais por dia da semana e por hora (pros gráficos de barra laterais)
  const porDiaSemana = useMemo(() => {
    const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return heatmap.grid.map((row, i) => ({
      dia: DIAS[i],
      qtd: row.reduce((a, b) => a + b, 0),
    }));
  }, [heatmap]);

  const porHora = useMemo(() => {
    const totals = Array(24).fill(0);
    heatmap.grid.forEach(row => row.forEach((v, h) => { totals[h] += v; }));
    return totals.map((qtd, h) => ({ hora: `${h}h`, qtd }));
  }, [heatmap]);

  if (!isDono && !isSuperAdmin && !permissoes.funil) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 32 }}>
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", maxWidth: 480 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 16px", boxShadow: "0 12px 24px rgba(239,68,68,0.25)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🔒</span>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Acesso restrito</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Você não tem permissão para ver o Funil de Vendas.</p>
        </div>
      </div>
    );
  }

  const CORES_PIE = ["#3b82f6", "#16a34a", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#a855f7", "#94a3b8"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 22 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 8px 20px rgba(6,182,212,0.25)", flexShrink: 0 }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Funil de Vendas</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>
              Pipeline, conversão, drill-down · <b style={{ color: "#06b6d4" }}>{metricas.total}</b> propostas em {filtroLabel[filtro]}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <EquipeSelector />
        </div>
      </div>

      {/* ═══ FILTROS GLOBAIS ═══ */}
      <div style={{ ...cardStyle, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginRight: 4 }}>Período:</span>
          {[
            { key: "semanal", label: "7 dias", color: "#16a34a" },
            { key: "mensal", label: "30 dias", color: "#3b82f6" },
            { key: "trimestral", label: "90 dias", color: "#8b5cf6" },
            { key: "ano", label: "1 ano", color: "#f59e0b" },
          ].map(p => {
            const ativo = filtro === p.key;
            return (
              <button key={p.key} onClick={() => setFiltro(p.key as any)}
                style={{ background: ativo ? `${p.color}15` : "#ffffff", color: ativo ? p.color : "#6b7280", border: `1px solid ${ativo ? `${p.color}50` : "#e5e7eb"}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: ativo ? 700 : 600, boxShadow: ativo ? `0 2px 8px ${p.color}20` : "none", transition: "all 0.15s" }}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)} style={{ ...inputStyle, minWidth: 160, flex: isMobile ? "1 1 calc(50% - 4px)" : "0 0 auto" }}>
            <option value="todos">👥 Todos vendedores</option>
            {Array.from(new Set(propostas.map(p => p.vendedor).filter(Boolean) as string[])).map(v => (<option key={v} value={v}>{nomeVendedor(v)}</option>))}
          </select>
          <select value={filtroOperadora} onChange={e => setFiltroOperadora(e.target.value)} style={{ ...inputStyle, minWidth: 160, flex: isMobile ? "1 1 calc(50% - 4px)" : "0 0 auto" }}>
            <option value="todas">📡 Todas operadoras</option>
            {operadorasUnicas.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filtroPlano} onChange={e => setFiltroPlano(e.target.value)} style={{ ...inputStyle, minWidth: 160, flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
            <option value="todos">📦 Todos planos</option>
            {planosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(filtroVendedor !== "todos" || filtroOperadora !== "todas" || filtroPlano !== "todos") && (
            <button onClick={() => { setFiltroVendedor("todos"); setFiltroOperadora("todas"); setFiltroPlano("todos"); }}
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{ ...cardStyle, padding: 6, display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {([
          { key: "visao",      label: "Visão Geral", icone: "📊", color: "#06b6d4" },
          { key: "instaladas", label: "Instaladas",  icone: "✅", color: "#16a34a" },
          { key: "pipeline",   label: "Pipeline",    icone: "🎯", color: "#3b82f6" },
          { key: "canceladas", label: "Canceladas",  icone: "❌", color: "#dc2626" },
          { key: "vendedores", label: "Vendedores",  icone: "👥", color: "#8b5cf6" },
          { key: "operadoras", label: "Operadoras",  icone: "📡", color: "#ec4899" },
          { key: "planos",     label: "Planos",      icone: "📦", color: "#a855f7" },
          { key: "temporal",   label: "Temporal",    icone: "📈", color: "#f59e0b" },
          { key: "cohort",     label: "Coorte",      icone: "🧬", color: "#0ea5e9" },
          { key: "horarios",   label: "Horários",    icone: "🗓️", color: "#14b8a6" },
        ] as { key: Aba; label: string; icone: string; color: string }[]).map(t => {
          const ativo = aba === t.key;
          return (
            <button key={t.key} onClick={() => setAba(t.key)}
              style={{ background: ativo ? `linear-gradient(135deg, ${t.color} 0%, ${t.color}dd 100%)` : "transparent", color: ativo ? "white" : "#6b7280", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700, boxShadow: ativo ? `0 4px 12px ${t.color}40` : "none", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>
              {t.icone} {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "#6b7280" }}>Carregando funil...</div>
      ) : metricas.total === 0 ? (
        <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 16px", boxShadow: "0 12px 24px rgba(6,182,212,0.25)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span>
          </div>
          <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Sem propostas no período</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Tente ampliar o período ou limpar filtros.</p>
        </div>
      ) : (
        <>

        {/* ════ ABA: VISÃO GERAL ════ */}
        {aba === "visao" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {[
                { titulo: "Receita Realizada", icone: "💰", color: "#16a34a", bg: "#f0fdf4", valor: formatBRL(metricas.receitaRealizada), legenda: `${metricas.instaladas} instaladas`, tr: trend(metricas.receitaRealizada, metricasAnt.receita), aba: "instaladas" as Aba },
                { titulo: "Pipeline Ativo", icone: "🎯", color: "#3b82f6", bg: "#eff6ff", valor: formatBRL(metricas.pipelineValue), legenda: `${metricas.emPipeline} em aberto`, tr: 0, aba: "pipeline" as Aba },
                { titulo: "Win Rate", icone: "📊", color: "#8b5cf6", bg: "#f3e8ff", valor: `${metricas.winRate}%`, legenda: `${metricas.instaladas} ✅ vs ${metricas.canceladas} ❌`, tr: trend(metricas.winRate, metricasAnt.winRate), aba: "vendedores" as Aba },
                { titulo: "Ciclo Médio", icone: "⏱️", color: "#f59e0b", bg: "#fffbeb", valor: `${metricas.cicloMedio}d`, legenda: "Geração → Instalação", tr: 0, aba: "temporal" as Aba },
              ].map(card => (
                <div key={card.titulo} onClick={() => setAba(card.aba)}
                  style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderTop: `3px solid ${card.color}`, transition: "all 0.15s", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 20px ${card.color}25`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{card.icone}</div>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.titulo}</p>
                    </div>
                    {card.tr !== 0 && (
                      <span style={{ background: card.tr > 0 ? "#f0fdf4" : "#fef2f2", color: card.tr > 0 ? "#16a34a" : "#dc2626", border: `1px solid ${card.tr > 0 ? "#bbf7d0" : "#fecaca"}`, fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>{card.tr > 0 ? "↑" : "↓"} {Math.abs(card.tr)}%</span>
                    )}
                  </div>
                  <p style={{ color: card.color, fontSize: isMobile ? 19 : 24, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{card.valor}</p>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>{card.legenda}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {[
                { titulo: "Ticket Médio", icone: "💳", color: "#06b6d4", bg: "#ecfeff", valor: formatBRL(metricas.ticketMedio), legenda: "Por instalação", aba: undefined as Aba | undefined },
                { titulo: "Forecast", icone: "🔮", color: "#a855f7", bg: "#f5f3ff", valor: formatBRL(metricas.forecast), legenda: `Pipeline × ${metricas.winRate}% WR`, aba: "pipeline" as Aba },
                { titulo: "Valor Perdido", icone: "💸", color: "#dc2626", bg: "#fef2f2", valor: formatBRL(metricas.valorPerdido), legenda: `${metricas.canceladas} canceladas`, aba: "canceladas" as Aba },
                { titulo: "Em Risco", icone: "⚠️", color: "#f59e0b", bg: "#fffbeb", valor: propostasEmRisco.length.toString(), legenda: "Paradas +7d", aba: "pipeline" as Aba },
              ].map(card => (
                <div key={card.titulo} onClick={() => card.aba && setAba(card.aba)}
                  style={{ ...cardStyle, padding: isMobile ? 12 : 16, cursor: card.aba ? "pointer" : "default", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { if (card.aba) e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}25`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{card.icone}</div>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.titulo}</p>
                  </div>
                  <p style={{ color: card.color, fontSize: isMobile ? 17 : 21, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{card.valor}</p>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: "3px 0 0", fontWeight: 500 }}>{card.legenda}</p>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
                Funil de Conversão
                <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 11, fontWeight: 500 }}>Clique nas etapas →</span>
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {etapasFunil.map((etapa, i) => {
                  const largura = etapasFunil[0].qtd > 0 ? Math.max(30, 100 * (etapa.qtd / etapasFunil[0].qtd)) : 30;
                  return (
                    <div key={etapa.nome}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button onClick={() => setAba(etapa.aba)}
                          style={{ background: `linear-gradient(135deg, ${etapa.color} 0%, ${etapa.color}dd 100%)`, color: "white", width: `${largura}%`, minHeight: isMobile ? 56 : 70, borderRadius: 12, border: "none", padding: isMobile ? "10px 14px" : "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: `0 4px 12px ${etapa.color}40`, gap: 10, cursor: "pointer", transition: "transform 0.15s" }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                          <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                            <p style={{ margin: 0, fontSize: isMobile ? 12 : 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{etapa.icone} {etapa.nome}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 500, opacity: 0.9 }}>{etapa.taxa}% do topo · clique pra detalhes</p>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 800, letterSpacing: -0.5 }}>{etapa.qtd}</p>
                          </div>
                        </button>
                      </div>
                      {i < etapasFunil.length - 1 && (
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "6px 0" }}>
                          <div style={{ background: conversoes[i] >= 50 ? "#f0fdf4" : conversoes[i] >= 25 ? "#fffbeb" : "#fef2f2", color: conversoes[i] >= 50 ? "#16a34a" : conversoes[i] >= 25 ? "#f59e0b" : "#dc2626", border: `1px solid ${conversoes[i] >= 50 ? "#bbf7d0" : conversoes[i] >= 25 ? "#fde68a" : "#fecaca"}`, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>
                            ↓ {conversoes[i]}% convertem
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {metricas.canceladas > 0 && (
                <button onClick={() => setAba("canceladas")}
                  style={{ marginTop: 16, padding: "12px 16px", width: "100%", background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
                  <div>
                    <p style={{ color: "#991b1b", fontSize: 12, fontWeight: 700, margin: 0 }}>❌ Canceladas no período · clique pra analisar</p>
                    <p style={{ color: "#7f1d1d", fontSize: 10, margin: "2px 0 0" }}>Saem do funil — {formatBRL(metricas.valorPerdido)} perdidos</p>
                  </div>
                  <p style={{ color: "#dc2626", fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{metricas.canceladas}</p>
                </button>
              )}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f3e8ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🏆</span>
                Top Vendedores (por receita)
                <button onClick={() => setAba("vendedores")} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#3b82f6", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ver todos →</button>
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vendedoresStats.slice().sort((a, b) => b.valorInstalado - a.valorInstalado).slice(0, 5).map((v, i) => {
                  const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <div key={v.email} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: i < 3 ? `4px solid ${i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : "#a16207"}` : "1px solid #e5e7eb", borderRadius: 10, padding: isMobile ? "10px 14px" : "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        {medalha ? <span style={{ fontSize: 20, flexShrink: 0 }}>{medalha}</span> : <span style={{ background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 8, flexShrink: 0 }}>#{i + 1}</span>}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nome}</p>
                          <p style={{ color: "#6b7280", fontSize: 10, margin: "2px 0 0" }}>{v.instaladas} instaladas · WR {v.winRate}%</p>
                        </div>
                      </div>
                      <p style={{ color: "#16a34a", fontSize: 15, fontWeight: 800, flexShrink: 0, margin: 0, letterSpacing: -0.3 }}>{formatBRL(v.valorInstalado)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════ ABA: INSTALADAS ════ */}
        {aba === "instaladas" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {[
                { titulo: "Receita Total", icone: "💰", color: "#16a34a", bg: "#f0fdf4", valor: formatBRL(metricas.receitaRealizada), legenda: "no período" },
                { titulo: "Instaladas", icone: "✅", color: "#16a34a", bg: "#f0fdf4", valor: metricas.instaladas.toString(), legenda: `de ${metricas.total} no funil` },
                { titulo: "Ticket Médio", icone: "💳", color: "#06b6d4", bg: "#ecfeff", valor: formatBRL(metricas.ticketMedio), legenda: "por instalação" },
                { titulo: "Maior Venda", icone: "🚀", color: "#8b5cf6", bg: "#f3e8ff", valor: topVendas[0] ? formatBRL(topVendas[0].valor_plano || 0) : "R$ 0", legenda: topVendas[0]?.nome || "—" },
              ].map(card => (
                <div key={card.titulo} style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderTop: `3px solid ${card.color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{card.icone}</div>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.titulo}</p>
                  </div>
                  <p style={{ color: card.color, fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{card.valor}</p>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.legenda}</p>
                </div>
              ))}
            </div>

            {serieTemporal.length > 0 && (
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
                <h3 style={sectionTitleStyle}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📈</span>
                  Receita por dia
                </h3>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                  <AreaChart data={serieTemporal} margin={isMobile ? { top: 5, right: 5, left: -15, bottom: 0 } : { top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dataLabel" stroke="#6b7280" fontSize={isMobile ? 9 : 11} />
                    <YAxis stroke="#6b7280" fontSize={isMobile ? 9 : 11} tickFormatter={v => formatBRLCompacto(v)} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} formatter={(value: any) => [formatBRL(value as number), "Receita"]} />
                    <Area type="monotone" dataKey="receita" stroke="#16a34a" strokeWidth={2} fill="url(#colorReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
                Distribuição por faixa de valor
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={distribuicaoValor.instaladas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="qtd" fill="#16a34a" radius={[8, 8, 0, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${distribuicaoValor.instaladas.length}, 1fr)`, gap: 6, marginTop: 12 }}>
                {distribuicaoValor.instaladas.map(b => (
                  <div key={b.faixa} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>{b.faixa}</p>
                    <p style={{ color: b.cor, fontSize: 16, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.5 }}>{b.qtd}</p>
                    <p style={{ color: "#9ca3af", fontSize: 9, margin: "1px 0 0", fontWeight: 500 }}>{formatBRLCompacto(b.valor)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🏆</span>
                Top 10 vendas (maiores tickets)
              </h3>
              {topVendas.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhuma venda instalada no período.</p>
              ) : isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topVendas.map((p, i) => (
                    <div key={p.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: `4px solid ${i < 3 ? "#16a34a" : "#9ca3af"}`, borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>#{i + 1} {p.nome || "—"}</span>
                        <span style={{ color: "#16a34a", fontSize: 14, fontWeight: 800 }}>{formatBRL(p.valor_plano || 0)}</span>
                      </div>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>👤 {nomeVendedor(p.vendedor)}{p.operadora && <> · 📡 {p.operadora}</>}{p.plano && <> · 📦 {p.plano}</>}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflow: "hidden", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#f9fafb" }}>{["#", "Cliente", "Vendedor", "Operadora", "Plano", "Valor"].map(h => (<th key={h} style={{ padding: "10px 14px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>))}</tr></thead>
                    <tbody>
                      {topVendas.map((p, i) => (
                        <tr key={p.id} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                          <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 700 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ color: "#6b7280" }}>#{i + 1}</span>}</td>
                          <td style={{ padding: "10px 14px", color: "#1f2937", fontSize: 12, fontWeight: 700 }}>{p.nome || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{nomeVendedor(p.vendedor)}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{p.operadora || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{p.plano || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#16a34a", fontSize: 13, fontWeight: 800 }}>{formatBRL(p.valor_plano || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {mixReceitaPorVendedor.length > 0 && (
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
                <h3 style={sectionTitleStyle}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f3e8ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎂</span>
                  Mix de receita por vendedor (top 7)
                </h3>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "center" }}>
                  <div style={{ flex: 1, minHeight: 240, width: isMobile ? "100%" : "auto" }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
                      <PieChart>
                        <Pie data={mixReceitaPorVendedor} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={isMobile ? 80 : 100} paddingAngle={2}>
                          {mixReceitaPorVendedor.map((_, i) => (<Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatBRL(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : "auto" }}>
                    {mixReceitaPorVendedor.map((v, i) => {
                      const total = mixReceitaPorVendedor.reduce((a, x) => a + x.valor, 0);
                      const pctR = total > 0 ? Math.round((v.valor / total) * 100) : 0;
                      return (
                        <div key={v.nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                          <span style={{ width: 12, height: 12, borderRadius: 3, background: CORES_PIE[i % CORES_PIE.length], flexShrink: 0 }} />
                          <span style={{ color: "#1f2937", fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nome}</span>
                          <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>{pctR}%</span>
                          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: "right" }}>{formatBRLCompacto(v.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════ ABA: PIPELINE ════ */}
        {aba === "pipeline" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {[
                { titulo: "Pipeline Total", icone: "🎯", color: "#3b82f6", bg: "#eff6ff", valor: formatBRL(metricas.pipelineValue), legenda: `${metricas.emPipeline} propostas` },
                { titulo: "Ticket Médio", icone: "💳", color: "#06b6d4", bg: "#ecfeff", valor: formatBRL(metricas.ticketPipeline), legenda: "no pipeline" },
                { titulo: "Forecast", icone: "🔮", color: "#a855f7", bg: "#f5f3ff", valor: formatBRL(metricas.forecast), legenda: `× ${metricas.winRate}% WR histórico` },
                { titulo: "Em Risco", icone: "⚠️", color: "#dc2626", bg: "#fef2f2", valor: propostasEmRisco.length.toString(), legenda: "paradas +7d" },
              ].map(card => (
                <div key={card.titulo} style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderTop: `3px solid ${card.color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{card.icone}</div>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.titulo}</p>
                  </div>
                  <p style={{ color: card.color, fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{card.valor}</p>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>{card.legenda}</p>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📋</span>
                Pipeline por status
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
                {["GERADA", "AGUARDANDO AUDITORIA", "PENDENTE"].map(st => {
                  const meta = STATUS_META[st];
                  const arr = porStatus[st] || [];
                  const valor = arr.reduce((a, p) => a + (p.valor_plano || 0), 0);
                  return (
                    <div key={st} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderLeft: `4px solid ${meta.cor}`, borderRadius: 10, padding: 14 }}>
                      <p style={{ color: meta.cor, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>{meta.icone} {meta.label}</p>
                      <p style={{ color: "#1f2937", fontSize: 28, fontWeight: 800, margin: "6px 0 0", letterSpacing: -1 }}>{arr.length}</p>
                      <p style={{ color: meta.cor, fontSize: 13, fontWeight: 700, margin: "2px 0 0" }}>{formatBRL(valor)}</p>
                      <p style={{ color: "#6b7280", fontSize: 10, margin: "4px 0 0", fontWeight: 500 }}>Ticket médio: {arr.length > 0 ? formatBRL(Math.round(valor / arr.length)) : "R$ 0"}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⏳</span>
                Aging do pipeline (tempo parado)
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={agingPipeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="qtd" radius={[8, 8, 0, 0]}>
                    {agingPipeline.map((b, i) => <Cell key={i} fill={b.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${agingPipeline.length}, 1fr)`, gap: 6, marginTop: 12 }}>
                {agingPipeline.map(b => (
                  <div key={b.faixa} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>{b.faixa}</p>
                    <p style={{ color: b.cor, fontSize: 16, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.5 }}>{b.qtd}</p>
                    <p style={{ color: "#9ca3af", fontSize: 9, margin: "1px 0 0", fontWeight: 500 }}>{formatBRLCompacto(b.valor)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ ...sectionTitleStyle, margin: 0 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚠️</span>
                  Propostas em risco
                </h3>
                <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>Paradas +7 dias · {propostasEmRisco.length} total</span>
              </div>
              {propostasEmRisco.length === 0 ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, textAlign: "center" }}>
                  <p style={{ color: "#15803d", fontSize: 13, margin: 0, fontWeight: 600 }}>✅ Nenhuma proposta parada — bom trabalho!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {propostasEmRisco.slice(0, 20).map(p => {
                    const meta = STATUS_META[p.status_venda] || STATUS_META["PENDENTE"];
                    const urgencia = p.diasParado >= 30 ? "#dc2626" : p.diasParado >= 15 ? "#f59e0b" : "#6b7280";
                    return (
                      <div key={p.id} onClick={() => router.push("/crm/vendas")}
                        style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: `4px solid ${urgencia}`, borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 10, cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.boxShadow = `0 4px 12px ${urgencia}25`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#f9fafb"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome || "Sem nome"}</p>
                          <p style={{ color: "#6b7280", fontSize: 11, margin: "3px 0 0" }}>👤 {nomeVendedor(p.vendedor)}{(p.valor_plano || 0) > 0 && <> · 💰 {formatBRL(p.valor_plano || 0)}</>}{p.operadora && <> · 📡 {p.operadora}</>}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ background: meta.bg, color: meta.cor, border: `1px solid ${meta.border}`, fontSize: 10, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{meta.icone} {meta.label}</span>
                          <span style={{ background: `${urgencia}15`, color: urgencia, border: `1px solid ${urgencia}40`, fontSize: 11, padding: "4px 12px", borderRadius: 10, fontWeight: 700 }}>⏳ {p.diasParado} dias</span>
                        </div>
                      </div>
                    );
                  })}
                  {propostasEmRisco.length > 20 && (<p style={{ color: "#9ca3af", fontSize: 11, textAlign: "center", margin: "8px 0 0", fontStyle: "italic" }}>+{propostasEmRisco.length - 20} outras em risco</p>)}
                </div>
              )}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
                Pipeline por faixa de valor
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={distribuicaoValor.pipeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="qtd" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ════ ABA: CANCELADAS ════ */}
        {aba === "canceladas" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
              {[
                { titulo: "Canceladas", icone: "❌", valor: metricas.canceladas.toString(), legenda: "no período" },
                { titulo: "Valor Perdido", icone: "💸", valor: formatBRL(metricas.valorPerdido), legenda: "receita potencial" },
                { titulo: "Taxa Cancelamento", icone: "📉", valor: `${pct(metricas.canceladas, metricas.fechados)}%`, legenda: `${metricas.canceladas} de ${metricas.fechados} fechados` },
                { titulo: "Maior Perda", icone: "💔", valor: topCanceladas[0] ? formatBRL(topCanceladas[0].valor_plano || 0) : "R$ 0", legenda: topCanceladas[0]?.nome || "—" },
              ].map(card => (
                <div key={card.titulo} style={{ ...cardStyle, padding: isMobile ? 14 : 18, borderTop: "3px solid #dc2626" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{card.icone}</div>
                    <p style={{ color: "#6b7280", fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{card.titulo}</p>
                  </div>
                  <p style={{ color: "#dc2626", fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: 0, letterSpacing: -0.5, wordBreak: "break-word" }}>{card.valor}</p>
                  <p style={{ color: "#9ca3af", fontSize: 10, margin: "4px 0 0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.legenda}</p>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚖️</span>
                Instaladas vs Canceladas
              </h3>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: Math.max(metricas.instaladas, 1), minWidth: 30, height: 80, background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "white", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{metricas.instaladas}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, margin: 0, opacity: 0.9 }}>✅ Instaladas</p>
                </div>
                <div style={{ flex: Math.max(metricas.canceladas, 1), minWidth: 30, height: 80, background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)", borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "white", boxShadow: "0 4px 12px rgba(220,38,38,0.3)" }}>
                  <p style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{metricas.canceladas}</p>
                  <p style={{ fontSize: 10, fontWeight: 600, margin: 0, opacity: 0.9 }}>❌ Canceladas</p>
                </div>
              </div>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "12px 0 0", textAlign: "center" }}>Win rate de <b style={{ color: "#16a34a" }}>{metricas.winRate}%</b> · {metricas.fechados} propostas fechadas</p>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📉</span>
                Vendedores com mais cancelamentos
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vendedoresStats.filter(v => v.canceladas > 0).sort((a, b) => b.canceladas - a.canceladas).slice(0, 10).map(v => {
                  const taxa = pct(v.canceladas, v.instaladas + v.canceladas);
                  const corTaxa = taxa >= 50 ? "#dc2626" : taxa >= 30 ? "#f59e0b" : "#6b7280";
                  return (
                    <div key={v.email} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: `4px solid ${corTaxa}`, borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{v.nome}</p>
                        <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}><b style={{ color: "#dc2626" }}>{v.canceladas}</b> canc. · <b style={{ color: "#16a34a" }}>{v.instaladas}</b> inst. · {formatBRL(v.valorPerdido)} perdidos</p>
                      </div>
                      <span style={{ background: `${corTaxa}15`, color: corTaxa, border: `1px solid ${corTaxa}40`, fontSize: 13, padding: "5px 14px", borderRadius: 10, fontWeight: 800 }}>{taxa}%</span>
                    </div>
                  );
                })}
                {vendedoresStats.filter(v => v.canceladas > 0).length === 0 && (<p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", textAlign: "center", margin: "12px 0" }}>🎉 Nenhum cancelamento no período!</p>)}
              </div>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>💔</span>
                Top 10 maiores perdas
              </h3>
              {topCanceladas.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhum cancelamento no período.</p>
              ) : isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topCanceladas.map((p, i) => (
                    <div key={p.id} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #dc2626", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>#{i + 1} {p.nome || "—"}</span>
                        <span style={{ color: "#dc2626", fontSize: 14, fontWeight: 800 }}>{formatBRL(p.valor_plano || 0)}</span>
                      </div>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>👤 {nomeVendedor(p.vendedor)}{p.operadora && <> · 📡 {p.operadora}</>}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ overflow: "hidden", border: "1px solid #fecaca", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#fef2f2" }}>{["#", "Cliente", "Vendedor", "Operadora", "Plano", "Valor Perdido"].map(h => (<th key={h} style={{ padding: "10px 14px", color: "#991b1b", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #fecaca" }}>{h}</th>))}</tr></thead>
                    <tbody>
                      {topCanceladas.map((p, i) => (
                        <tr key={p.id} style={{ borderTop: "1px solid #fee2e2", background: i % 2 === 0 ? "#ffffff" : "#fff5f5" }}>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12, fontWeight: 700 }}>#{i + 1}</td>
                          <td style={{ padding: "10px 14px", color: "#1f2937", fontSize: 12, fontWeight: 700 }}>{p.nome || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{nomeVendedor(p.vendedor)}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{p.operadora || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{p.plano || "—"}</td>
                          <td style={{ padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 800 }}>{formatBRL(p.valor_plano || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
                Onde estão as perdas (por faixa de valor)
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
                <BarChart data={distribuicaoValor.canceladas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="faixa" stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 10 : 12} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="qtd" fill="#dc2626" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ════ ABA: VENDEDORES ════ */}
        {aba === "vendedores" && (
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={sectionTitleStyle}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f3e8ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>👥</span>
              Vendedores · análise completa
            </h3>
            {vendedoresStats.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Sem dados de vendedores no período.</p>
            ) : isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {vendedoresStats.slice().sort((a, b) => b.valorInstalado - a.valorInstalado).map((v, i) => {
                  const corWr = v.winRate >= 70 ? "#16a34a" : v.winRate >= 40 ? "#f59e0b" : "#dc2626";
                  return (
                    <div key={v.email} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: `4px solid ${corWr}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ color: "#1f2937", fontSize: 13, fontWeight: 700 }}>#{i + 1} {v.nome}</span>
                        <span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 14, padding: "4px 12px", borderRadius: 10, fontWeight: 800 }}>{v.winRate}%</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                        <div style={{ background: "#eff6ff", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}><p style={{ color: "#3b82f6", fontSize: 14, fontWeight: 800, margin: 0 }}>{v.total}</p><p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600 }}>TOTAL</p></div>
                        <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}><p style={{ color: "#16a34a", fontSize: 14, fontWeight: 800, margin: 0 }}>{v.instaladas}</p><p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600 }}>INST.</p></div>
                        <div style={{ background: "#fef2f2", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}><p style={{ color: "#dc2626", fontSize: 14, fontWeight: 800, margin: 0 }}>{v.canceladas}</p><p style={{ color: "#6b7280", fontSize: 9, margin: 0, fontWeight: 600 }}>CANC.</p></div>
                      </div>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "6px 0 0" }}>💰 Realizado: <b style={{ color: "#16a34a" }}>{formatBRL(v.valorInstalado)}</b></p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>🎯 Pipeline: <b style={{ color: "#3b82f6" }}>{formatBRL(v.valorPipeline)}</b> ({v.pipeline})</p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 0" }}>💳 Ticket: <b style={{ color: "#06b6d4" }}>{formatBRL(v.ticket)}</b> · ⏱️ Ciclo: <b>{v.cicloMed}d</b></p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead><tr style={{ background: "#f9fafb" }}>{["#", "Vendedor", "Total", "✅", "❌", "Pipeline", "Win Rate", "Realizado", "Em Aberto", "Perdido", "Ticket", "Ciclo"].map(h => (<th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {vendedoresStats.slice().sort((a, b) => b.valorInstalado - a.valorInstalado).map((v, i) => {
                      const corWr = v.winRate >= 70 ? "#16a34a" : v.winRate >= 40 ? "#f59e0b" : "#dc2626";
                      return (
                        <tr key={v.email} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                          <td style={{ padding: "12px", fontSize: 14, fontWeight: 700 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ color: "#6b7280", fontSize: 12 }}>#{i + 1}</span>}</td>
                          <td style={{ padding: "12px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>{v.nome}</td>
                          <td style={{ padding: "12px", color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>{v.total}</td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{v.instaladas}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{v.canceladas}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{v.pipeline}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 800 }}>{v.winRate}%</span></td>
                          <td style={{ padding: "12px", color: "#16a34a", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(v.valorInstalado)}</td>
                          <td style={{ padding: "12px", color: "#3b82f6", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(v.valorPipeline)}</td>
                          <td style={{ padding: "12px", color: "#dc2626", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(v.valorPerdido)}</td>
                          <td style={{ padding: "12px", color: "#06b6d4", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(v.ticket)}</td>
                          <td style={{ padding: "12px", color: "#6b7280", fontSize: 12 }}>{v.cicloMed}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════ ABA: OPERADORAS ════ */}
        {aba === "operadoras" && (
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={sectionTitleStyle}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fce7f3", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📡</span>
              Análise por operadora
            </h3>
            {operadorasStats.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Sem operadoras cadastradas nas propostas do período.</p>
            ) : (
              <>
                <div style={{ overflowX: "auto", marginBottom: 18 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead><tr style={{ background: "#f9fafb" }}>{["Operadora", "Total", "Instaladas", "Canceladas", "Win Rate", "Pipeline", "Receita"].map(h => (<th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>))}</tr></thead>
                    <tbody>
                      {operadorasStats.map((o, i) => {
                        const corWr = o.winRate >= 70 ? "#16a34a" : o.winRate >= 40 ? "#f59e0b" : "#dc2626";
                        return (
                          <tr key={o.chave} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                            <td style={{ padding: "12px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>📡 {o.chave}</td>
                            <td style={{ padding: "12px", color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>{o.total}</td>
                            <td style={{ padding: "12px" }}><span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{o.instaladas}</span></td>
                            <td style={{ padding: "12px" }}><span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{o.canceladas}</span></td>
                            <td style={{ padding: "12px" }}><span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 800 }}>{o.winRate}%</span></td>
                            <td style={{ padding: "12px", color: "#3b82f6", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(o.pipelineValor)}</td>
                            <td style={{ padding: "12px", color: "#16a34a", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{formatBRL(o.receita)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {mixReceitaPorOperadora.length > 0 && (
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
                    <h4 style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: "0 0 14px" }}>Mix de receita</h4>
                    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "center" }}>
                      <div style={{ flex: 1, width: isMobile ? "100%" : "auto" }}>
                        <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
                          <PieChart>
                            <Pie data={mixReceitaPorOperadora} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={isMobile ? 80 : 100} paddingAngle={2}>
                              {mixReceitaPorOperadora.map((_, i) => (<Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />))}
                            </Pie>
                            <Tooltip formatter={(value: any) => formatBRL(value as number)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, width: isMobile ? "100%" : "auto" }}>
                        {mixReceitaPorOperadora.map((v, i) => {
                          const total = mixReceitaPorOperadora.reduce((a, x) => a + x.valor, 0);
                          const pctR = total > 0 ? Math.round((v.valor / total) * 100) : 0;
                          return (
                            <div key={v.nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                              <span style={{ width: 12, height: 12, borderRadius: 3, background: CORES_PIE[i % CORES_PIE.length] }} />
                              <span style={{ color: "#1f2937", fontSize: 12, fontWeight: 600, flex: 1 }}>{v.nome}</span>
                              <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>{pctR}%</span>
                              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: "right" }}>{formatBRLCompacto(v.valor)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ ABA: PLANOS ════ */}
        {aba === "planos" && (
          <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
            <h3 style={sectionTitleStyle}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f3ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📦</span>
              Análise por plano
            </h3>
            {planosStats.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Sem planos cadastrados nas propostas do período.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead><tr style={{ background: "#f9fafb" }}>{["Plano", "Total", "Instaladas", "Canceladas", "Win Rate", "Pipeline", "Receita"].map(h => (<th key={h} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {planosStats.map((p, i) => {
                      const corWr = p.winRate >= 70 ? "#16a34a" : p.winRate >= 40 ? "#f59e0b" : "#dc2626";
                      return (
                        <tr key={p.chave} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                          <td style={{ padding: "12px", color: "#1f2937", fontSize: 13, fontWeight: 700 }}>📦 {p.chave}</td>
                          <td style={{ padding: "12px", color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>{p.total}</td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{p.instaladas}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>{p.canceladas}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: `${corWr}15`, color: corWr, border: `1px solid ${corWr}40`, fontSize: 13, padding: "4px 12px", borderRadius: 8, fontWeight: 800 }}>{p.winRate}%</span></td>
                          <td style={{ padding: "12px", color: "#3b82f6", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBRL(p.pipelineValor)}</td>
                          <td style={{ padding: "12px", color: "#16a34a", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{formatBRL(p.receita)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════ ABA: TEMPORAL ════ */}
        {aba === "temporal" && (
          <>
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📈</span>
                Receita por dia
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <AreaChart data={serieTemporal} margin={isMobile ? { top: 5, right: 5, left: -15, bottom: 0 } : { top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRecTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dataLabel" stroke="#6b7280" fontSize={isMobile ? 9 : 11} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 9 : 11} tickFormatter={v => formatBRLCompacto(v)} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} formatter={(value: any) => [formatBRL(value as number), "Receita"]} />
                  <Area type="monotone" dataKey="receita" stroke="#16a34a" strokeWidth={2} fill="url(#colorRecTemp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📊</span>
                Propostas por dia (geradas, instaladas, canceladas)
              </h3>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <LineChart data={serieTemporal} margin={isMobile ? { top: 5, right: 5, left: -15, bottom: 0 } : { top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="dataLabel" stroke="#6b7280" fontSize={isMobile ? 9 : 11} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 9 : 11} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="geradas"    stroke="#3b82f6" strokeWidth={2} dot={false} name="Geradas" />
                  <Line type="monotone" dataKey="instaladas" stroke="#16a34a" strokeWidth={2} dot={false} name="Instaladas" />
                  <Line type="monotone" dataKey="canceladas" stroke="#dc2626" strokeWidth={2} dot={false} name="Canceladas" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#f3e8ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⏮️</span>
                Comparativo: período atual × anterior
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
                {[
                  { label: "Receita", atual: metricas.receitaRealizada, anterior: metricasAnt.receita, fmt: formatBRL, cor: "#16a34a" },
                  { label: "Instaladas", atual: metricas.instaladas, anterior: metricasAnt.instaladas, fmt: (v: number) => v.toString(), cor: "#16a34a" },
                  { label: "Canceladas", atual: metricas.canceladas, anterior: metricasAnt.canceladas, fmt: (v: number) => v.toString(), cor: "#dc2626" },
                  { label: "Total propostas", atual: metricas.total, anterior: metricasAnt.total, fmt: (v: number) => v.toString(), cor: "#3b82f6" },
                  { label: "Win Rate", atual: metricas.winRate, anterior: metricasAnt.winRate, fmt: (v: number) => `${v}%`, cor: "#8b5cf6" },
                ].map(m => {
                  const t = trend(m.atual, m.anterior);
                  return (
                    <div key={m.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>{m.label}</p>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                        <p style={{ color: m.cor, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{m.fmt(m.atual)}</p>
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>vs {m.fmt(m.anterior)} antes</span>
                        {t !== 0 && (<span style={{ background: t > 0 ? "#f0fdf4" : "#fef2f2", color: t > 0 ? "#16a34a" : "#dc2626", border: `1px solid ${t > 0 ? "#bbf7d0" : "#fecaca"}`, fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>{t > 0 ? "↑" : "↓"} {Math.abs(t)}%</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ════ ABA: COORTE ════ */}
        {aba === "cohort" && (
          <>
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#e0f2fe", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🧬</span>
                Análise de Coorte — últimas 12 semanas
              </h3>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 18px", lineHeight: 1.5 }}>
                Cada linha é uma <b>semana em que as propostas foram geradas</b>. As colunas mostram o que aconteceu com elas:
                quantas <b style={{ color: "#16a34a" }}>instalaram</b>, quantas <b style={{ color: "#dc2626" }}>cancelaram</b> e quantas ainda estão <b style={{ color: "#f59e0b" }}>em aberto</b>.
                Serve pra ver se o funil tá esquentando ou esfriando ao longo do tempo.
                {(equipeId || filtroVendedor !== "todos") && <> (Respeitando os filtros de equipe/vendedor; ignora o filtro de período.)</>}
              </p>

              {/* Gráfico: taxa de instalação por semana */}
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
                <BarChart data={cohort} margin={isMobile ? { top: 5, right: 5, left: -15, bottom: 0 } : { top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={isMobile ? 9 : 11} />
                  <YAxis stroke="#6b7280" fontSize={isMobile ? 9 : 11} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }}
                    formatter={(value: any, name: string) => [`${value}%`, name === "taxaInst" ? "Instalação" : name === "taxaCanc" ? "Cancelamento" : "Em aberto"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "taxaInst" ? "Instalação" : v === "taxaCanc" ? "Cancelamento" : "Em aberto"} />
                  <Bar dataKey="taxaInst" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="taxaAberto" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="taxaCanc" stackId="a" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela detalhada da coorte */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
                <h3 style={{ ...sectionTitleStyle, margin: 0 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: "#e0f2fe", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📋</span>
                  Detalhamento por semana
                </h3>
              </div>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 640 : "auto" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Semana de", "Geradas", "✅ Instaladas", "❌ Canceladas", "⏳ Em aberto", "Receita", "Taxa Conv."].map(h => (
                        <th key={h} style={{ padding: "12px 16px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.map((c, i) => {
                      const corConv = c.taxaInst >= 50 ? "#16a34a" : c.taxaInst >= 25 ? "#f59e0b" : "#dc2626";
                      const bgConv = c.taxaInst >= 50 ? "#f0fdf4" : c.taxaInst >= 25 ? "#fffbeb" : "#fef2f2";
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                          <td style={{ padding: "12px 16px", color: "#1f2937", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{c.label}</td>
                          <td style={{ padding: "12px 16px", color: "#3b82f6", fontSize: 13, fontWeight: 700 }}>{c.total}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{c.instaladas}</span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{c.canceladas}</span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#fffbeb", color: "#f59e0b", border: "1px solid #fde68a", fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 700 }}>{c.emAberto}</span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#16a34a", fontSize: 13, fontWeight: 700 }}>{formatBRLCompacto(c.receita)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 6, overflow: "hidden", minWidth: 60, maxWidth: 100 }}>
                                <div style={{ background: corConv, width: `${c.taxaInst}%`, height: "100%", borderRadius: 4 }} />
                              </div>
                              <span style={{ background: bgConv, color: corConv, fontSize: 11, padding: "3px 8px", borderRadius: 8, fontWeight: 800 }}>{c.taxaInst}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ════ ABA: HORÁRIOS (HEATMAP) ════ */}
        {aba === "horarios" && (
          <>
            {/* Pico */}
            <div style={{ ...cardStyle, padding: isMobile ? 16 : 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 8px 20px rgba(20,184,166,0.25)", flexShrink: 0 }}>
                <span style={{ filter: "saturate(0) brightness(2)" }}>🔥</span>
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>Horário de pico</p>
                <p style={{ color: "#0d9488", fontSize: isMobile ? 18 : 22, fontWeight: 800, margin: "2px 0 0", letterSpacing: -0.3 }}>
                  {picoHorario.qtd > 0
                    ? `${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][picoHorario.dia]} às ${picoHorario.hora}h`
                    : "Sem dados suficientes"}
                </p>
                <p style={{ color: "#9ca3af", fontSize: 12, margin: "2px 0 0" }}>
                  {picoHorario.qtd > 0 ? `${picoHorario.qtd} proposta(s) geradas nesse horário` : "—"}
                </p>
              </div>
            </div>

            {/* Heatmap grid */}
            <div style={{ ...cardStyle, padding: isMobile ? 14 : 24 }}>
              <h3 style={sectionTitleStyle}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🗓️</span>
                Mapa de calor — dia da semana × hora
              </h3>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 16px" }}>
                Quanto mais escura a célula, mais propostas entraram naquele dia/horário. Útil pra escalar atendentes nos picos.
              </p>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ minWidth: 680 }}>
                  {/* Cabeçalho de horas */}
                  <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, 1fr)", gap: 2, marginBottom: 2 }}>
                    <div />
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} style={{ textAlign: "center", color: "#9ca3af", fontSize: 8, fontWeight: 600 }}>{h}</div>
                    ))}
                  </div>
                  {/* Linhas por dia */}
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, di) => (
                    <div key={dia} style={{ display: "grid", gridTemplateColumns: "40px repeat(24, 1fr)", gap: 2, marginBottom: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", color: "#6b7280", fontSize: 10, fontWeight: 700 }}>{dia}</div>
                      {heatmap.grid[di].map((qtd, hi) => {
                        const intensidade = heatmap.max > 0 ? qtd / heatmap.max : 0;
                        const bg = qtd === 0
                          ? "#f9fafb"
                          : `rgba(20, 184, 166, ${0.15 + intensidade * 0.85})`;
                        return (
                          <div key={hi}
                            title={`${dia} ${hi}h — ${qtd} proposta(s)`}
                            style={{
                              aspectRatio: "1", borderRadius: 3, background: bg,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 8, fontWeight: 700,
                              color: intensidade > 0.5 ? "#ffffff" : "#0d9488",
                              cursor: "default", minHeight: 18,
                            }}>
                            {qtd > 0 ? qtd : ""}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {/* Legenda */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <span style={{ color: "#9ca3af", fontSize: 11 }}>Menos</span>
                {[0.15, 0.35, 0.55, 0.75, 1].map(o => (
                  <div key={o} style={{ width: 16, height: 16, borderRadius: 3, background: `rgba(20, 184, 166, ${o})` }} />
                ))}
                <span style={{ color: "#9ca3af", fontSize: 11 }}>Mais</span>
              </div>
            </div>

            {/* Barras: por dia da semana + por hora */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
                <h3 style={{ ...sectionTitleStyle, fontSize: 14, margin: "0 0 14px" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📅</span>
                  Propostas por dia da semana
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={porDiaSemana} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dia" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} cursor={{ fill: "#f0fdfa" }} />
                    <Bar dataKey="qtd" fill="#14b8a6" radius={[8, 8, 0, 0]} name="Propostas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardStyle, padding: isMobile ? 16 : 20 }}>
                <h3 style={{ ...sectionTitleStyle, fontSize: 14, margin: "0 0 14px" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⏰</span>
                  Propostas por hora do dia
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={porHora} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="hora" stroke="#6b7280" fontSize={8} interval={1} />
                    <YAxis stroke="#6b7280" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12 }} cursor={{ fill: "#f0fdfa" }} />
                    <Bar dataKey="qtd" fill="#0d9488" radius={[6, 6, 0, 0]} name="Propostas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        </>
      )}
    </div>
  );
}