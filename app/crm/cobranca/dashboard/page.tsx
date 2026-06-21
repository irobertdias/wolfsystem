"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
// 🆕 multi-tenant: usa hooks do Wolf em vez de useTemPermissao
import { useWorkspace } from "../../../hooks/useWorkspace";
import { useModulos, ModuloBloqueado } from "../../../hooks/useModulos";
import {
  type Proposta, type FaturaStatusDB,
  formatNum, pctOf,
  carregarPropostas, carregarFaturasStatus,
} from "../../../lib/cobranca_lib";

// ═══════════════════════════════════════════════════════════════════════════
// 📊 DASHBOARD DE COBRANÇA — Wolf System (multi-tenant)
// ───────────────────────────────────────────────────────────────────────────
// O QUE MOSTRA:
//   • KPIs principais (faturas/clientes/inadimplência) com variação % vs período anterior
//   • Resumo dos 12 status agrupados em 6 categorias visuais
//   • Evolução mês a mês (barras empilhadas + linha % pago)
//   • Top 10 clientes inadimplentes com ação rápida pra negociação
//   • Alertas: vencem em 3 dias, promessas vencem hoje, 30d+ em atraso
//   • Banner de "última atualização" (quando o operador subiu a última planilha)
//   • Insights automáticos em linguagem natural
//
// FONTE DOS DADOS: tabela faturas_status (alimentada pela pagina /atualizacao)
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "robert.dias@live.com";

// ─── estilos ──────────────────────────────────────────────────────────────
const card = { background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const btnSec = { background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 };
const sectionTitle = { color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "0 0 18px 0", display: "flex", alignItems: "center", gap: 8 };

// ─── 12 STATUS AGRUPADOS EM 6 BUCKETS VISUAIS ─────────────────────────────
type GrupoStatus = "recebidas" | "negociacao" | "risco" | "pendentes" | "perdidas" | "juridico";

const GRUPO_DE_STATUS: Record<string, GrupoStatus> = {
  paga: "recebidas",
  paga_atraso: "recebidas",
  paga_parcial: "recebidas",
  promessa: "negociacao",
  negociacao: "negociacao",
  acordo: "negociacao",
  atrasada: "risco",
  pendente: "pendentes",
  nao_pagara: "perdidas",
  cancelada: "perdidas",
  juridico: "juridico",
  protestada: "juridico",
};

const META_GRUPO: Record<GrupoStatus, { label: string; icone: string; cor: string; bg: string; border: string; desc: string }> = {
  recebidas:   { label: "Recebidas",       icone: "✅", cor: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", desc: "Faturas pagas (no prazo, com atraso ou parcial)" },
  negociacao:  { label: "Em Negociação",   icone: "🤝", cor: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", desc: "Promessa de pagamento, acordo ou negociação ativa" },
  risco:       { label: "Em Risco",        icone: "⚠️", cor: "#d97706", bg: "#fffbeb", border: "#fde68a", desc: "Atrasadas — precisam de ação imediata" },
  pendentes:   { label: "A Vencer",        icone: "⏳", cor: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", desc: "Ainda não venceram, dentro do prazo" },
  perdidas:    { label: "Perdidas",        icone: "❌", cor: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", desc: "Marcadas como 'não vai pagar' ou canceladas" },
  juridico:    { label: "Jurídico",        icone: "⚖️", cor: "#dc2626", bg: "#fef2f2", border: "#fecaca", desc: "Em cobrança judicial ou protestadas" },
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const mesLabel = (ref: string) => {
  const m = (ref || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return ref;
  return `${MESES[Number(m[2]) - 1]}/${m[1].slice(2)}`;
};

const formatTempo = (data: Date | null) => {
  if (!data) return "—";
  const agora = Date.now();
  const dif = agora - data.getTime();
  const dias = Math.floor(dif / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) return `há ${Math.floor(dias / 7)} sem.`;
  return `há ${Math.floor(dias / 30)} mês(es)`;
};

// ─── Tipo dos pontos do gráfico ────────────────────────────────────────────
type Serie = { mes: string; ref: string; Pagas: number; Pendentes: number; Inadimplentes: number; total: number; pctPago: number };

// ─── Gráficos SVG puros (sem recharts) ────────────────────────────────────
function GraficoBarras({ data, mobile }: { data: Serie[]; mobile: boolean }) {
  const H = mobile ? 260 : 330, padL = 36, padB = 26, padT = 10, padR = 8;
  const W = Math.max(data.length * (mobile ? 38 : 54) + padL + padR, 320);
  const maxV = Math.max(1, ...data.map(d => d.total));
  const passos = 4, plotH = H - padT - padB, plotW = W - padL - padR;
  const bw = Math.min(mobile ? 22 : 34, (plotW / data.length) * 0.6);
  const y = (v: number) => padT + plotH * (1 - v / maxV);
  const cores: [keyof Serie, string][] = [["Pagas", "#16a34a"], ["Pendentes", "#d97706"], ["Inadimplentes", "#dc2626"]];
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={W} height={H} style={{ minWidth: "100%", display: "block" }}>
        {Array.from({ length: passos + 1 }).map((_, i) => {
          const v = (maxV / passos) * i, yy = y(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={10} fill="#9ca3af">{Math.round(v)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = padL + (plotW / data.length) * (i + 0.5);
          let acc = 0;
          return (
            <g key={d.mes}>
              {cores.map(([k, cor]) => {
                const val = d[k] as number;
                if (!val) return null;
                const hSeg = (val / maxV) * plotH;
                const yTop = y(acc + val); acc += val;
                return <rect key={k} x={cx - bw / 2} y={yTop} width={bw} height={Math.max(hSeg, 0)} fill={cor} rx={2}><title>{`${d.mes} — ${k}: ${val}`}</title></rect>;
              })}
              <text x={cx} y={H - padB + 14} textAnchor="middle" fontSize={10} fill="#6b7280">{d.mes}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GraficoLinha({ data, mobile, series, height, pct }: { data: Serie[]; mobile: boolean; series: [keyof Serie, string][]; height?: number; pct?: boolean }) {
  const H = height ?? (mobile ? 260 : 330), padL = 38, padB = 26, padT = 10, padR = 10;
  const W = Math.max(data.length * (mobile ? 40 : 60) + padL + padR, 320);
  const maxV = pct ? 100 : Math.max(1, ...data.flatMap(d => series.map(([k]) => d[k] as number)));
  const passos = pct ? 5 : 4, plotH = H - padT - padB, plotW = W - padL - padR;
  const x = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => padT + plotH * (1 - v / maxV);
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={W} height={H} style={{ minWidth: "100%", display: "block" }}>
        {Array.from({ length: passos + 1 }).map((_, i) => {
          const v = (maxV / passos) * i, yy = y(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={10} fill="#9ca3af">{Math.round(v)}{pct ? "%" : ""}</text>
            </g>
          );
        })}
        {series.map(([k, cor]) => {
          const pts = data.map((d, i) => `${x(i)},${y(d[k] as number)}`).join(" ");
          return (
            <g key={k}>
              <polyline points={pts} fill="none" stroke={cor} strokeWidth={2.5} />
              {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d[k] as number)} r={3} fill={cor}><title>{`${d.mes}: ${d[k]}${pct ? "%" : ""}`}</title></circle>)}
            </g>
          );
        })}
        {data.map((d, i) => <text key={d.mes} x={x(i)} y={H - padB + 14} textAnchor="middle" fontSize={10} fill="#6b7280">{d.mes}</text>)}
      </svg>
    </div>
  );
}

// ─── Componente: Variação % vs período anterior ───────────────────────────
function Variacao({ atual, anterior, invertido }: { atual: number; anterior: number; invertido?: boolean }) {
  if (anterior === 0 && atual === 0) return <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>—</span>;
  if (anterior === 0) return <span style={{ color: "#16a34a", fontSize: 11, fontWeight: 700 }}>NOVO</span>;
  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  const subiu = variacao > 0;
  // Se "invertido", inadimplência subir é ruim (vermelho); caso normal, subir é bom (verde)
  const bom = invertido ? !subiu : subiu;
  if (variacao === 0) return <span style={{ color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>= 0%</span>;
  return (
    <span style={{ color: bom ? "#16a34a" : "#dc2626", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {subiu ? "↗" : "↘"} {Math.abs(variacao)}%
    </span>
  );
}

export default function CobrancaDashboard() {
  const router = useRouter();
  // 🆕 multi-tenant: gates do Wolf
  const { wsId, user, wsPronto } = useWorkspace();
  const { modulos, carregado: modulosCarregados } = useModulos();

  const isSuperAdmin = user?.email === ADMIN_EMAIL;
  const temAcesso = isSuperAdmin || !!modulos.cobranca;

  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [faturas, setFaturas] = useState<FaturaStatusDB[]>([]);
  const [tipoGrafico, setTipoGrafico] = useState<"barras" | "linha">("barras");
  const [periodo, setPeriodo] = useState<"mes" | "30d" | "3m" | "tudo">("3m");

  useEffect(() => {
    const ck = () => setIsMobile(window.innerWidth < 768);
    ck(); window.addEventListener("resize", ck);
    return () => window.removeEventListener("resize", ck);
  }, []);

  useEffect(() => {
    if (!wsPronto || !modulosCarregados) return;
    if (!temAcesso) { setLoading(false); return; }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }   // 🆕 login do Wolf é "/"
      const [rp, rf] = await Promise.all([
        carregarPropostas(wsId),
        carregarFaturasStatus(wsId),
      ]);
      setPropostas(rp.propostas);
      setFaturas(Array.from(rf.statusMap.values()));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsPronto, modulosCarregados, temAcesso, wsId]);

  // ─── Mapas auxiliares ──────────────────────────────────────────────────────
  const propostaPorId = useMemo(() => {
    const m = new Map<number, Proposta>();
    for (const p of propostas) m.set(p.id, p);
    return m;
  }, [propostas]);

  // ─── Filtro por período ────────────────────────────────────────────────────
  const faturasFiltradas = useMemo(() => {
    if (periodo === "tudo") return faturas;
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
    const limite = new Date(hoje);
    if (periodo === "mes") limite.setDate(1);
    else if (periodo === "30d") limite.setDate(limite.getDate() - 30);
    else if (periodo === "3m") limite.setMonth(limite.getMonth() - 3);
    limite.setHours(0, 0, 0, 0);
    return faturas.filter(f => {
      const ref = f.numero_referencia || "";
      if (!/^\d{4}-\d{2}/.test(ref)) return false;
      const d = new Date(ref.slice(0, 7) + "-01");
      return d >= limite && d <= hoje;
    });
  }, [faturas, periodo]);

  // ─── Período ANTERIOR (pra comparar variação) ──────────────────────────────
  const faturasPeriodoAnterior = useMemo(() => {
    if (periodo === "tudo") return [];
    const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
    const inicioAnterior = new Date(hoje);
    const fimAnterior = new Date(hoje);
    if (periodo === "mes") {
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 1, 1);
      fimAnterior.setDate(0);
    } else if (periodo === "30d") {
      fimAnterior.setDate(fimAnterior.getDate() - 30);
      inicioAnterior.setDate(inicioAnterior.getDate() - 60);
    } else {
      fimAnterior.setMonth(fimAnterior.getMonth() - 3);
      inicioAnterior.setMonth(inicioAnterior.getMonth() - 6);
    }
    inicioAnterior.setHours(0, 0, 0, 0);
    return faturas.filter(f => {
      const ref = f.numero_referencia || "";
      if (!/^\d{4}-\d{2}/.test(ref)) return false;
      const d = new Date(ref.slice(0, 7) + "-01");
      return d >= inicioAnterior && d <= fimAnterior;
    });
  }, [faturas, periodo]);

  // ─── Contagem por GRUPO de status (6 buckets) ──────────────────────────────
  const calcularGrupos = (lista: FaturaStatusDB[]) => {
    const acc: Record<GrupoStatus, number> = {
      recebidas: 0, negociacao: 0, risco: 0, pendentes: 0, perdidas: 0, juridico: 0,
    };
    const clientesUnicos = new Set<number>();
    for (const f of lista) {
      const g = GRUPO_DE_STATUS[f.status] as GrupoStatus | undefined;
      if (!g) continue;
      acc[g]++;
      clientesUnicos.add(f.proposta_id);
    }
    return { grupos: acc, totalClientes: clientesUnicos.size, totalFaturas: lista.length };
  };

  const dadosAtual = useMemo(() => calcularGrupos(faturasFiltradas), [faturasFiltradas]);
  const dadosAnterior = useMemo(() => calcularGrupos(faturasPeriodoAnterior), [faturasPeriodoAnterior]);

  // ─── KPIs principais ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const { grupos, totalClientes, totalFaturas } = dadosAtual;
    const inadimplentes = grupos.risco + grupos.juridico;
    const totalClassificado = (Object.values(grupos) as number[]).reduce((a, b) => a + b, 0);
    return {
      totalFaturas,
      totalClientes,
      recebidas: grupos.recebidas,
      inadimplentes,
      pendentes: grupos.pendentes,
      negociacao: grupos.negociacao,
      perdidas: grupos.perdidas,
      juridico: grupos.juridico,
      risco: grupos.risco,
      pctInad: pctOf(inadimplentes, totalClassificado),
      pctRecebida: pctOf(grupos.recebidas, totalClassificado),
    };
  }, [dadosAtual]);

  const kpisAnt = useMemo(() => {
    const { grupos } = dadosAnterior;
    return {
      recebidas: grupos.recebidas,
      inadimplentes: grupos.risco + grupos.juridico,
      negociacao: grupos.negociacao,
    };
  }, [dadosAnterior]);

  // ─── Evolução mensal (gráfico) ─────────────────────────────────────────────
  const serieMensal = useMemo(() => {
    const porMes = new Map<string, { pagas: number; pendentes: number; inadimplentes: number }>();
    for (const f of faturasFiltradas) {
      const ref = (f.numero_referencia || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ref)) continue;
      let r = porMes.get(ref);
      if (!r) { r = { pagas: 0, pendentes: 0, inadimplentes: 0 }; porMes.set(ref, r); }
      const g = GRUPO_DE_STATUS[f.status];
      if (g === "recebidas") r.pagas++;
      else if (g === "pendentes" || g === "negociacao") r.pendentes++;
      else if (g === "risco" || g === "juridico") r.inadimplentes++;
    }
    return Array.from(porMes.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ref, v]) => ({
        mes: mesLabel(ref), ref,
        Pagas: v.pagas, Pendentes: v.pendentes, Inadimplentes: v.inadimplentes,
        total: v.pagas + v.pendentes + v.inadimplentes,
        pctPago: pctOf(v.pagas, v.pagas + v.pendentes + v.inadimplentes),
      }));
  }, [faturasFiltradas]);

  // ─── TOP devedores (clientes com mais faturas em risco/atraso) ─────────────
  const topDevedores = useMemo(() => {
    const m = new Map<number, { proposta: Proposta | undefined; emRisco: number; emJuridico: number; total: number; pior: string }>();
    for (const f of faturasFiltradas) {
      const g = GRUPO_DE_STATUS[f.status];
      if (g !== "risco" && g !== "juridico") continue;
      let r = m.get(f.proposta_id);
      if (!r) { r = { proposta: propostaPorId.get(f.proposta_id), emRisco: 0, emJuridico: 0, total: 0, pior: f.status }; m.set(f.proposta_id, r); }
      if (g === "juridico") r.emJuridico++;
      else r.emRisco++;
      r.total++;
      if (g === "juridico" && r.pior !== "juridico" && r.pior !== "protestada") r.pior = f.status;
    }
    return Array.from(m.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [faturasFiltradas, propostaPorId]);

  // ─── ALERTAS / Ações necessárias ───────────────────────────────────────────
  const alertas = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let vencemEm3 = 0;
    let atrasadasMais30d = 0;
    let promessasHoje = 0;

    for (const f of faturasFiltradas) {
      // Vence em 3 dias? (pendente + venc próximo)
      if (f.status === "pendente" && f.data_vencimento) {
        const venc = new Date(f.data_vencimento);
        const dif = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
        if (dif >= 0 && dif <= 3) vencemEm3++;
      }
      // Atrasada há mais de 30 dias
      if ((f.status === "atrasada" || f.status === "juridico" || f.status === "protestada") && f.data_vencimento) {
        const venc = new Date(f.data_vencimento);
        const dif = Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
        if (dif > 30) atrasadasMais30d++;
      }
      // Promessa de pagamento pra hoje
      if (f.status === "promessa" && f.data_vencimento) {
        const venc = new Date(f.data_vencimento);
        if (venc.toDateString() === hoje.toDateString()) promessasHoje++;
      }
    }
    return { vencemEm3, atrasadasMais30d, promessasHoje };
  }, [faturasFiltradas]);

  // ─── ÚLTIMA ATUALIZAÇÃO (banner) ───────────────────────────────────────────
  const ultimaAtualizacao = useMemo(() => {
    let mais: Date | null = null;
    let porQuem: string | null = null;
    let totalNoDia = 0;
    for (const f of faturas) {
      const at = (f as any).atualizado_em || (f as any).updated_at;
      if (!at) continue;
      const d = new Date(at);
      if (isNaN(d.getTime())) continue;
      if (!mais || d > mais) { mais = d; porQuem = (f as any).atualizado_por || null; }
    }
    if (mais) {
      const dStr = mais.toDateString();
      for (const f of faturas) {
        const at = (f as any).atualizado_em || (f as any).updated_at;
        if (!at) continue;
        if (new Date(at).toDateString() === dStr) totalNoDia++;
      }
    }
    return { quando: mais, porQuem, totalNoDia };
  }, [faturas]);

  // ─── INSIGHTS automáticos ──────────────────────────────────────────────────
  const insights = useMemo(() => {
    const out: { tipo: "ok" | "alerta" | "info"; texto: string }[] = [];

    if (kpisAnt.recebidas > 0 && kpis.recebidas > 0) {
      const varRecebidas = Math.round(((kpis.recebidas - kpisAnt.recebidas) / kpisAnt.recebidas) * 100);
      if (varRecebidas >= 10) out.push({ tipo: "ok", texto: `📈 As faturas recebidas subiram ${varRecebidas}% comparado ao período anterior. Bom trabalho do time!` });
      else if (varRecebidas <= -10) out.push({ tipo: "alerta", texto: `📉 As faturas recebidas caíram ${Math.abs(varRecebidas)}% comparado ao período anterior. Vale revisar a estratégia.` });
    }

    if (kpisAnt.inadimplentes > 0 && kpis.inadimplentes > 0) {
      const varInad = Math.round(((kpis.inadimplentes - kpisAnt.inadimplentes) / kpisAnt.inadimplentes) * 100);
      if (varInad <= -10) out.push({ tipo: "ok", texto: `✅ A inadimplência caiu ${Math.abs(varInad)}% — o esforço de recuperação está dando resultado.` });
      else if (varInad >= 20) out.push({ tipo: "alerta", texto: `🚨 A inadimplência subiu ${varInad}%. Priorize as cobranças mais antigas.` });
    }

    if (kpis.negociacao > 0) {
      out.push({ tipo: "info", texto: `🤝 Você tem ${kpis.negociacao} fatura(s) em negociação ativa. Acompanhe de perto — promessas e acordos precisam de follow-up.` });
    }

    if (alertas.atrasadasMais30d > 0) {
      out.push({ tipo: "alerta", texto: `⏰ ${alertas.atrasadasMais30d} fatura(s) estão atrasadas há mais de 30 dias. Considere passar pra jurídico ou tentar negociação.` });
    }

    if (kpis.pctRecebida >= 80) {
      out.push({ tipo: "ok", texto: `🏆 ${kpis.pctRecebida}% das suas faturas no período foram recebidas. Excelente performance!` });
    } else if (kpis.pctRecebida < 50 && kpis.totalFaturas > 10) {
      out.push({ tipo: "alerta", texto: `⚠️ Apenas ${kpis.pctRecebida}% das faturas foram recebidas. Foque nas inadimplências mais antigas e nas negociações em andamento.` });
    }

    return out;
  }, [kpis, kpisAnt, alertas]);

  // ─── GATES ────────────────────────────────────────────────────────────────
  if (!wsPronto || !modulosCarregados || loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#6b7280" }}>Carregando dashboard...</div>;
  }
  if (!temAcesso) {
    return <ModuloBloqueado modulo="cobranca" />;
  }

  const vazio = kpis.totalFaturas === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20 }}>

      {/* ════════ HEADER ════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>📊</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: isMobile ? 20 : 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Dashboard de Cobrança</h1>
            <p style={{ color: "#6b7280", fontSize: 12, margin: "2px 0 0" }}>
              Acompanhe o resultado do que sua equipe atualiza · <b>{formatNum(kpis.totalFaturas)}</b> faturas analisadas
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/crm/cobranca/negociacoes")} style={btnSec}>🤝 Negociações</button>
          <button onClick={() => router.push("/crm/cobranca/atualizacao")} style={{ ...btnSec, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", border: "none" }}>📤 Atualizar planilha</button>
        </div>
      </div>

      {/* ════════ BANNER: ÚLTIMA ATUALIZAÇÃO ════════ */}
      {ultimaAtualizacao.quando && (
        <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", border: "1px solid #bbf7d0", borderLeft: "4px solid #16a34a", borderRadius: 12, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 26 }}>🔄</div>
            <div>
              <p style={{ color: "#15803d", fontSize: 13, margin: 0, fontWeight: 700 }}>
                Última atualização da planilha: {formatTempo(ultimaAtualizacao.quando)}
                {ultimaAtualizacao.porQuem && <> por <b>{ultimaAtualizacao.porQuem}</b></>}
              </p>
              <p style={{ color: "#16a34a", fontSize: 11.5, margin: "2px 0 0", fontWeight: 600 }}>
                {formatNum(ultimaAtualizacao.totalNoDia)} fatura(s) foram atualizadas nessa carga
              </p>
            </div>
          </div>
          <button onClick={() => router.push("/crm/cobranca/atualizacao")} style={{ ...btnSec, padding: "8px 14px", fontSize: 12, background: "#fff", color: "#16a34a", borderColor: "#86efac" }}>Atualizar agora →</button>
        </div>
      )}

      {/* ════════ SELETOR DE PERÍODO ════════ */}
      <div style={{ ...card, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#6b7280", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Período:</span>
        <div style={{ display: "flex", gap: 4 }}>
          {([
            { k: "mes" as const, l: "Este mês" },
            { k: "30d" as const, l: "Últimos 30 dias" },
            { k: "3m" as const, l: "Últimos 3 meses" },
            { k: "tudo" as const, l: "Tudo" },
          ]).map(p => (
            <button key={p.k} onClick={() => setPeriodo(p.k)} style={{ borderRadius: 20, padding: "6px 13px", fontSize: 12, cursor: "pointer", fontWeight: periodo === p.k ? 700 : 600, border: `1px solid ${periodo === p.k ? "#2563eb" : "#e5e7eb"}`, background: periodo === p.k ? "#eff6ff" : "#fff", color: periodo === p.k ? "#2563eb" : "#6b7280" }}>{p.l}</button>
          ))}
        </div>
        {periodo !== "tudo" && (
          <span style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto", fontStyle: "italic" }}>
            Comparando com o período anterior pra mostrar variações
          </span>
        )}
      </div>

      {vazio && (
        <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "1px solid #bfdbfe", borderLeft: "4px solid #2563eb", borderRadius: 12, padding: "16px 20px" }}>
          <p style={{ color: "#1e40af", fontSize: 14, margin: 0, fontWeight: 700 }}>💡 Ainda não há faturas no período selecionado</p>
          <p style={{ color: "#3b82f6", fontSize: 12.5, margin: "4px 0 0" }}>
            Suba a planilha de pagamento em <b>📤 Atualizar planilha</b> ou amplie o período pra "Tudo".
          </p>
        </div>
      )}

      {/* ════════ KPIs PRINCIPAIS ════════ */}
      {!vazio && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 14 }}>
          {/* Recebidas */}
          <div style={{ ...card, padding: isMobile ? 14 : 18, borderTop: "4px solid #16a34a" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>✅</div>
                <p style={{ color: "#6b7280", fontSize: 10.5, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>Recebidas</p>
              </div>
              {periodo !== "tudo" && <Variacao atual={kpis.recebidas} anterior={kpisAnt.recebidas} />}
            </div>
            <p style={{ color: "#16a34a", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{formatNum(kpis.recebidas)}</p>
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "3px 0 0", fontWeight: 500 }}>
              {kpis.pctRecebida}% do total · faturas pagas
            </p>
          </div>

          {/* Em Negociação */}
          <div style={{ ...card, padding: isMobile ? 14 : 18, borderTop: "4px solid #2563eb" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🤝</div>
                <p style={{ color: "#6b7280", fontSize: 10.5, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>Em negociação</p>
              </div>
              {periodo !== "tudo" && <Variacao atual={kpis.negociacao} anterior={kpisAnt.negociacao} />}
            </div>
            <p style={{ color: "#2563eb", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{formatNum(kpis.negociacao)}</p>
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "3px 0 0", fontWeight: 500 }}>
              promessa, acordo ou em conversa
            </p>
          </div>

          {/* Inadimplentes */}
          <div style={{ ...card, padding: isMobile ? 14 : 18, borderTop: "4px solid #dc2626" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🔴</div>
                <p style={{ color: "#6b7280", fontSize: 10.5, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>Inadimplentes</p>
              </div>
              {periodo !== "tudo" && <Variacao atual={kpis.inadimplentes} anterior={kpisAnt.inadimplentes} invertido />}
            </div>
            <p style={{ color: "#dc2626", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{formatNum(kpis.inadimplentes)}</p>
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "3px 0 0", fontWeight: 500 }}>
              atrasadas + jurídico/protesto
            </p>
          </div>

          {/* Taxa de Inadimplência */}
          <div style={{ ...card, padding: isMobile ? 14 : 18, borderTop: "4px solid #4f46e5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eef2ff", border: "1px solid #c7d2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📉</div>
              <p style={{ color: "#6b7280", fontSize: 10.5, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>Tx. Inadimplência</p>
            </div>
            <p style={{ color: kpis.pctInad < 10 ? "#16a34a" : kpis.pctInad < 25 ? "#d97706" : "#dc2626", fontSize: isMobile ? 24 : 30, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>{kpis.pctInad}%</p>
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "3px 0 0", fontWeight: 500 }}>
              {kpis.pctInad < 10 ? "✓ saudável" : kpis.pctInad < 25 ? "atenção" : "crítico"} · inad/total
            </p>
          </div>
        </div>
      )}

      {/* ════════ INSIGHTS AUTOMÁTICOS ════════ */}
      {!vazio && insights.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 16 : 20, background: "linear-gradient(135deg, #fefefe 0%, #f9fafb 100%)" }}>
          <h3 style={{ ...sectionTitle, margin: "0 0 12px" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>💡</span>
            O que esses números te dizem
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, background: ins.tipo === "ok" ? "#f0fdf4" : ins.tipo === "alerta" ? "#fef2f2" : "#eff6ff", borderLeft: `3px solid ${ins.tipo === "ok" ? "#16a34a" : ins.tipo === "alerta" ? "#dc2626" : "#2563eb"}` }}>
                <p style={{ color: ins.tipo === "ok" ? "#15803d" : ins.tipo === "alerta" ? "#991b1b" : "#1e40af", fontSize: 13, margin: 0, fontWeight: 600, lineHeight: 1.5 }}>{ins.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════ ALERTAS / AÇÕES NECESSÁRIAS ════════ */}
      {!vazio && (alertas.vencemEm3 > 0 || alertas.atrasadasMais30d > 0 || alertas.promessasHoje > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
          {alertas.vencemEm3 > 0 && (
            <div style={{ ...card, padding: 16, borderLeft: "4px solid #d97706", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>⏰</div>
              <div>
                <p style={{ color: "#d97706", fontSize: 18, fontWeight: 800, margin: 0 }}>{formatNum(alertas.vencemEm3)}</p>
                <p style={{ color: "#92400e", fontSize: 12, margin: 0, fontWeight: 600 }}>fatura(s) vencem nos próximos 3 dias</p>
              </div>
            </div>
          )}
          {alertas.promessasHoje > 0 && (
            <div style={{ ...card, padding: 16, borderLeft: "4px solid #2563eb", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>🤝</div>
              <div>
                <p style={{ color: "#2563eb", fontSize: 18, fontWeight: 800, margin: 0 }}>{formatNum(alertas.promessasHoje)}</p>
                <p style={{ color: "#1e40af", fontSize: 12, margin: 0, fontWeight: 600 }}>promessa(s) de pagamento pra hoje</p>
              </div>
            </div>
          )}
          {alertas.atrasadasMais30d > 0 && (
            <div style={{ ...card, padding: 16, borderLeft: "4px solid #dc2626", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>🚨</div>
              <div>
                <p style={{ color: "#dc2626", fontSize: 18, fontWeight: 800, margin: 0 }}>{formatNum(alertas.atrasadasMais30d)}</p>
                <p style={{ color: "#991b1b", fontSize: 12, margin: 0, fontWeight: 600 }}>atrasadas há mais de 30 dias</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ STATUS DETALHADOS (6 grupos) ════════ */}
      {!vazio && (
        <div style={{ ...card, padding: isMobile ? 16 : 22 }}>
          <h3 style={{ ...sectionTitle, margin: "0 0 4px" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#f9fafb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🗂️</span>
            Distribuição dos 12 status agrupados
          </h3>
          <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "0 0 16px" }}>Os 12 status que sua equipe usa estão organizados aqui em 6 grupos visuais</p>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12 }}>
            {(Object.keys(META_GRUPO) as GrupoStatus[]).map(g => {
              const meta = META_GRUPO[g];
              const qtd = dadosAtual.grupos[g];
              const pct = pctOf(qtd, dadosAtual.totalFaturas);
              return (
                <div key={g} style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", border: `1px solid ${meta.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{meta.icone}</div>
                    <p style={{ color: meta.cor, fontSize: 12, fontWeight: 800, margin: 0 }}>{meta.label}</p>
                  </div>
                  <p style={{ color: meta.cor, fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1 }}>{formatNum(qtd)}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: "2px 0 6px", fontWeight: 600 }}>{pct}% do total</p>
                  <p style={{ color: "#6b7280", fontSize: 10.5, margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>{meta.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════ GRÁFICO: EVOLUÇÃO MÊS A MÊS ════════ */}
      {serieMensal.length > 0 && (
        <div style={{ ...card, padding: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ ...sectionTitle, margin: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📈</span>
                Evolução mês a mês
              </h3>
              <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "4px 0 0 40px" }}>Como a cobrança evoluiu ao longo do tempo</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["barras", "linha"] as const).map(t => (
                <button key={t} onClick={() => setTipoGrafico(t)} style={{ borderRadius: 20, padding: "6px 13px", fontSize: 12, cursor: "pointer", fontWeight: tipoGrafico === t ? 700 : 600, border: `1px solid ${tipoGrafico === t ? "#2563eb" : "#e5e7eb"}`, background: tipoGrafico === t ? "#eff6ff" : "#fff", color: tipoGrafico === t ? "#2563eb" : "#6b7280" }}>{t === "barras" ? "📊 Barras" : "📈 Linha"}</button>
              ))}
            </div>
          </div>
          {tipoGrafico === "barras"
            ? <GraficoBarras data={serieMensal} mobile={isMobile} />
            : <GraficoLinha data={serieMensal} mobile={isMobile} series={[["Pagas", "#16a34a"], ["Pendentes", "#d97706"], ["Inadimplentes", "#dc2626"]]} />}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, justifyContent: "center" }}>
            {([["Pagas", "#16a34a"], ["Pendentes", "#d97706"], ["Inadimplentes", "#dc2626"]] as [string, string][]).map(([l, cor]) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 12, height: 4, borderRadius: 2, background: cor }} /> {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ════════ % PAGO POR MÊS + DESTAQUES ════════ */}
      {serieMensal.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 14 }}>
          <div style={{ ...card, padding: isMobile ? 16 : 24 }}>
            <h3 style={{ ...sectionTitle, fontSize: 14 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#f0fdf4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✅</span>
              % de faturas pagas por mês
            </h3>
            <GraficoLinha data={serieMensal} mobile={isMobile} height={200} pct series={[["pctPago", "#16a34a"]]} />
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "10px 0 0", textAlign: "center", fontStyle: "italic" }}>
              Quanto maior, melhor — quer dizer que sua cobrança está mais eficiente nesse mês
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...card, padding: 16, borderLeft: "4px solid #2563eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 24 }}>👥</div>
                <div>
                  <p style={{ color: "#2563eb", fontSize: 20, fontWeight: 800, margin: 0 }}>{formatNum(kpis.totalClientes)}</p>
                  <p style={{ color: "#6b7280", fontSize: 11.5, margin: 0, fontWeight: 600 }}>clientes c/ faturas no período</p>
                </div>
              </div>
            </div>
            <div style={{ ...card, padding: 16, borderLeft: "4px solid #16a34a" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 24 }}>📑</div>
                <div>
                  <p style={{ color: "#16a34a", fontSize: 20, fontWeight: 800, margin: 0 }}>{formatNum(kpis.totalFaturas)}</p>
                  <p style={{ color: "#6b7280", fontSize: 11.5, margin: 0, fontWeight: 600 }}>faturas analisadas no período</p>
                </div>
              </div>
            </div>
            <div style={{ ...card, padding: 16, borderLeft: `4px solid ${kpis.perdidas > 0 ? "#9ca3af" : "#e5e7eb"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 24 }}>❌</div>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 20, fontWeight: 800, margin: 0 }}>{formatNum(kpis.perdidas)}</p>
                  <p style={{ color: "#6b7280", fontSize: 11.5, margin: 0, fontWeight: 600 }}>marcadas como "não vai pagar"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ TOP 10 INADIMPLENTES ════════ */}
      {topDevedores.length > 0 && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ ...sectionTitle, margin: 0 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🚨</span>
              Top 10 clientes inadimplentes
            </h3>
            <p style={{ color: "#9ca3af", fontSize: 11.5, margin: "4px 0 0 36px" }}>Esses clientes precisam de atenção prioritária</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 600 : "auto" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["#", "Cliente", "Faturas em risco", "Jurídico", "Total devido", "Ação"].map(h => (
                    <th key={h} style={{ padding: "11px 14px", color: "#6b7280", fontSize: 11, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topDevedores.map((c, i) => (
                  <tr key={c.proposta?.id || i} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 14px", color: "#9ca3af", fontSize: 12, fontWeight: 700 }}>#{i + 1}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <p style={{ color: "#1f2937", fontSize: 13, fontWeight: 700, margin: 0 }}>{c.proposta?.nome || "—"}</p>
                      {c.proposta?.dados_customizados?.custcode && <p style={{ color: "#9ca3af", fontSize: 10.5, margin: "2px 0 0", fontFamily: "monospace" }}>{c.proposta.dados_customizados.custcode}</p>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {c.emRisco > 0 ? <span style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 10, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>⚠️ {c.emRisco}</span> : <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {c.emJuridico > 0 ? <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>⚖️ {c.emJuridico}</span> : <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 14px", color: "#dc2626", fontSize: 14, fontWeight: 800 }}>{c.total} fat.</td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => c.proposta && router.push(`/crm/cobranca/negociacoes?proposta=${c.proposta.id}`)}
                        style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                        🤝 Negociar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ COMO LER ESTE DASHBOARD ════════ */}
      {!vazio && (
        <div style={{ ...card, padding: isMobile ? 16 : 22, background: "linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%)" }}>
          <h3 style={{ ...sectionTitle, margin: "0 0 12px", color: "#374151" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📖</span>
            Como ler este dashboard
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            {[
              { titulo: "De onde vêm os dados?", desc: "Sua equipe atualiza pela página '📤 Atualizar planilha' subindo o arquivo da operadora. Este dashboard mostra o resultado disso." },
              { titulo: "O que significa 'em risco'?", desc: "São faturas atrasadas mas que ainda podem ser recuperadas. Quanto antes negociar, melhor a chance de pagamento." },
              { titulo: "E 'em negociação'?", desc: "Quando o cliente fez uma promessa, fechou acordo ou está em conversa ativa. Acompanhe pra garantir que cumpre o combinado." },
              { titulo: "Taxa de inadimplência saudável?", desc: "Abaixo de 10% é considerada saudável. Entre 10% e 25% pede atenção. Acima de 25%, é crítico — revise a operação." },
            ].map((q, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #e5e7eb" }}>
                <p style={{ color: "#1f2937", fontSize: 12.5, margin: "0 0 4px", fontWeight: 700 }}>{q.titulo}</p>
                <p style={{ color: "#6b7280", fontSize: 11.5, margin: 0, lineHeight: 1.5 }}>{q.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}