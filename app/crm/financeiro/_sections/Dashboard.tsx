"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 📊 DASHBOARD FINANCEIRO — visão completa (fin_contas + fin_lancamentos)
// ═══════════════════════════════════════════════════════════════════════

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const MESES_ABR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPO_CONTA: Record<string, { i: string; l: string }> = {
  corrente: { i: "🏦", l: "Conta Corrente" }, poupanca: { i: "🐷", l: "Poupança" },
  caixa: { i: "💵", l: "Caixa" }, cartao: { i: "💳", l: "Cartão" }, investimento: { i: "📈", l: "Investimento" },
};

const cardStyle: any = { background: "#fff", borderRadius: 16, border: "1px solid #E6ECEA", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };

export default function DashboardFinanceiro() {
  const { wsId } = useWorkspace();
  const [contas, setContas] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, l, ct] = await Promise.all([
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId),
    ]);
    setContas((c.data as any[]) || []);
    setLancs((l.data as any[]) || []);
    setCats((ct.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  // ─── métricas ───
  const mes = mesAtual();
  const saldoTotal = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const aReceber = lancs.filter((l) => l.tipo === "receita" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const aPagar = lancs.filter((l) => l.tipo === "despesa" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const recebidoMes = lancs.filter((l) => l.tipo === "receita" && l.status === "pago" && (l.pago_em || "").slice(0, 7) === mes).reduce((s, l) => s + (l.valor || 0), 0);
  const pagoMes = lancs.filter((l) => l.tipo === "despesa" && l.status === "pago" && (l.pago_em || "").slice(0, 7) === mes).reduce((s, l) => s + (l.valor || 0), 0);
  const resultadoMes = recebidoMes - pagoMes;
  const atrasados = lancs.filter((l) => l.status === "pendente" && l.vencimento && l.vencimento < hoje());
  const totAtrasado = atrasados.reduce((s, l) => s + (l.valor || 0), 0);

  // ─── série de 6 meses (entradas x saídas realizadas) ───
  const serie = (() => {
    const arr: { label: string; entrada: number; saida: number }[] = [];
    const base = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(base.getFullYear(), base.getMonth() - k, 1);
      const pref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const doMes = lancs.filter((l) => l.status === "pago" && (l.pago_em || "").slice(0, 7) === pref);
      arr.push({
        label: MESES_ABR[d.getMonth()],
        entrada: doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0),
        saida: doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0),
      });
    }
    return arr;
  })();
  const maxBar = Math.max(...serie.flatMap((m) => [m.entrada, m.saida]), 1);

  // ─── próximos vencimentos ───
  const proximos = lancs
    .filter((l) => l.status === "pendente" && l.vencimento)
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
    .slice(0, 8);

  // ─── top despesas por categoria (pagas) ───
  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";
  const corCat = (id: string) => cats.find((c) => c.id === id)?.cor || "#dc2626";
  const despAgg: Record<string, number> = {};
  lancs.filter((l) => l.tipo === "despesa" && l.status === "pago").forEach((l) => { const k = l.categoria_id || "—"; despAgg[k] = (despAgg[k] || 0) + (l.valor || 0); });
  const topDesp = Object.entries(despAgg).map(([id, v]) => ({ id, nome: id === "—" ? "Sem categoria" : nomeCat(id), cor: id === "—" ? "#94A3B8" : corCat(id), valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const maxDesp = topDesp[0]?.valor || 1;

  const stStatus = (l: any) => (l.vencimento && l.vencimento < hoje() ? { l: "Atrasado", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca" } : { l: "Pendente", c: "#C2410C", bg: "#fffbeb", bd: "#fde68a" });

  // ─── KPIs ───
  const kpis = [
    { label: "Saldo em contas", valor: brl(saldoTotal), cor: saldoTotal >= 0 ? "#059669" : "#dc2626", g1: "#059669", g2: "#10B981", icone: "🏦", sub: `${contas.length} conta(s) ativa(s)` },
    { label: "A receber", valor: brl(aReceber), cor: "#059669", g1: "#059669", g2: "#34d399", icone: "📥", sub: "em aberto" },
    { label: "A pagar", valor: brl(aPagar), cor: "#dc2626", g1: "#dc2626", g2: "#f87171", icone: "📤", sub: "em aberto" },
    { label: "Recebido no mês", valor: brl(recebidoMes), cor: "#0F766E", g1: "#0F766E", g2: "#14B8A6", icone: "✅", sub: "liquidado" },
    { label: "Pago no mês", valor: brl(pagoMes), cor: "#C2410C", g1: "#C2410C", g2: "#FB923C", icone: "💸", sub: "liquidado" },
    { label: "Resultado do mês", valor: brl(resultadoMes), cor: resultadoMes >= 0 ? "#059669" : "#dc2626", g1: resultadoMes >= 0 ? "#059669" : "#dc2626", g2: resultadoMes >= 0 ? "#10B981" : "#f87171", icone: "📈", sub: "receitas − despesas" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Dashboard financeiro</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Visão geral de {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <button onClick={carregar} style={{ background: "#fff", color: "#334155", border: "none", borderRadius: 12, height: 42, padding: "0 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 6px 16px -10px rgba(16,24,40,.25)" }}>
          <Icone nome="atualizar" tamanho={15} />Atualizar
        </button>
      </div>

      {/* ═══ ALERTA ATRASO ═══ */}
      {atrasados.length > 0 && (
        <div style={{ background: "#FEF2F2", boxShadow: "inset 0 0 0 1.5px #FECACA", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEE2E2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="alerta" tamanho={18} /></div>
          <div>
            <p style={{ margin: 0, color: "#991b1b", fontSize: 14, fontWeight: 800 }}>{atrasados.length} lançamento(s) em atraso</p>
            <p style={{ margin: "2px 0 0", color: "#b91c1c", fontSize: 12 }}>Total vencido: <b>{brl(totAtrasado)}</b> — regularize em Contas a Pagar / Receber.</p>
          </div>
        </div>
      )}

      {/* ═══ KPIs ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 16 }}>
        {kpis.map((k, idx) => {
          // A2: o primeiro cartão (saldo) ganha destaque em verde, como no protótipo.
          const destaque = idx === 0 && saldoTotal >= 0;
          const negativo = k.cor === "#dc2626";
          return (
            <div key={k.label}
              style={destaque
                ? { position: "relative", overflow: "hidden", borderRadius: 18, padding: "20px 22px", color: "#fff", background: "linear-gradient(140deg, #059669, #065F46)", boxShadow: "0 16px 32px -16px rgba(6,95,70,.7)" }
                : { ...cardStyle, padding: "20px 22px", borderRadius: 18 }}>
              {destaque && <div aria-hidden style={{ position: "absolute", right: -30, top: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.1)" }} />}
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: destaque ? "rgba(255,255,255,.18)" : negativo ? "#FEF2F2" : "#ECFDF5", color: destaque ? "#fff" : negativo ? "#B91C1C" : "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconeEmoji e={k.icone} tamanho={16} />
                </span>
                <span style={{ color: destaque ? "rgba(255,255,255,.85)" : "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
              </div>
              <div style={{ position: "relative", color: destaque ? "#fff" : negativo ? "#DC2626" : "#0F172A", fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.1 }}>{k.valor}</div>
              <div style={{ position: "relative", color: destaque ? "rgba(255,255,255,.85)" : "#64748B", fontSize: 12.5, marginTop: 6 }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ═══ GRÁFICO 6 MESES + SALDO POR CONTA ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 18 }}>

        {/* gráfico de barras */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Entradas × Saídas <span style={{ color: "#94A3B8", fontWeight: 600, fontSize: 12 }}>· últimos 6 meses</span></h3>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748B", fontWeight: 600 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#059669", display: "inline-block" }} /> Entradas</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#dc2626", display: "inline-block" }} /> Saídas</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, height: 200, padding: "0 4px" }}>
            {serie.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, width: "100%", justifyContent: "center" }}>
                  <div title={`Entradas: ${brl(m.entrada)}`} style={{ width: "42%", maxWidth: 26, height: `${Math.max((m.entrada / maxBar) * 100, m.entrada > 0 ? 4 : 0)}%`, minHeight: m.entrada > 0 ? 4 : 0, background: "linear-gradient(180deg, #10B981 0%, #059669 100%)", borderRadius: "6px 6px 0 0" }} />
                  <div title={`Saídas: ${brl(m.saida)}`} style={{ width: "42%", maxWidth: 26, height: `${Math.max((m.saida / maxBar) * 100, m.saida > 0 ? 4 : 0)}%`, minHeight: m.saida > 0 ? 4 : 0, background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)", borderRadius: "6px 6px 0 0" }} />
                </div>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>{m.label}</span>
              </div>
            ))}
          </div>
          {serie.every((m) => m.entrada === 0 && m.saida === 0) && !carregando && (
            <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 13, fontStyle: "italic", margin: "12px 0 0" }}>Sem movimentações liquidadas ainda — os números aparecem conforme você marca lançamentos como pagos.</p>
          )}
        </div>

        {/* saldo por conta */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Saldo por conta</h3>
          {carregando ? <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Carregando…</p>
            : contas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="predio" tamanho={20} /></span>
                <p style={{ fontSize: 13, margin: 0, color: "#64748B" }}>Nenhuma conta cadastrada.</p>
              </div>
            ) : contas.map((c, i) => {
              const t = TIPO_CONTA[c.tipo] || TIPO_CONTA.corrente;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid #F1F5F4" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><IconeEmoji e={t.i} tamanho={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "#0F172A", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.l}</div>
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? "#059669" : "#dc2626" }}>{brl(c.saldo_atual)}</span>
                </div>
              );
            })}
          {contas.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "2px solid #F1F5F4" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#64748B", }}>Total</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: saldoTotal >= 0 ? "#059669" : "#dc2626" }}>{brl(saldoTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PRÓXIMOS VENCIMENTOS + TOP DESPESAS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 18 }}>

        {/* próximos vencimentos */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Próximos vencimentos</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F7FAF9" }}>
                {["Vencimento", "Descrição", "Status", "Valor"].map((h, i) => (
                  <th key={i} style={{ padding: "12px 20px", color: "#64748B", fontSize: 12, textAlign: i === 3 ? "right" : "left", fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={4} style={{ padding: "34px", textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              ) : proximos.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px 24px", textAlign: "center" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, background: "#ECFDF5", color: "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icone nome="check" tamanho={20} /></span>
                  <p style={{ color: "#0F172A", fontSize: 14, fontWeight: 800, margin: "8px 0 2px" }}>Nada pendente à frente</p>
                  <p style={{ color: "#94A3B8", fontSize: 12, margin: 0 }}>Você está em dia com os vencimentos.</p>
                </td></tr>
              ) : proximos.map((l, i) => {
                const st = stStatus(l);
                return (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13, color: "#64748B", fontWeight: 600, borderTop: "1px solid #F1F5F4" }}>{dataBR(l.vencimento)}</td>
                    <td style={{ padding: "12px 20px", fontSize: 13.5, color: "#0F172A", fontWeight: 600, borderTop: "1px solid #F1F5F4" }}>{l.descricao}</td>
                    <td style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F4" }}>
                      <span style={{ background: st.c === "#dc2626" ? "#FEF2F2" : "#FFF7ED", color: st.c === "#dc2626" ? "#B91C1C" : "#C2410C", fontSize: 12, padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>{st.l}</span>
                    </td>
                    <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 800, textAlign: "right", color: l.tipo === "receita" ? "#059669" : "#dc2626", borderTop: "1px solid #F1F5F4", whiteSpace: "nowrap" }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* top despesas */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Top despesas por categoria</h3>
          {carregando ? <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Carregando…</p>
            : topDesp.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="grafico" tamanho={20} /></span>
                <p style={{ fontSize: 13, margin: 0, color: "#64748B" }}>Sem despesas pagas ainda.</p>
              </div>
            ) : topDesp.map((d, i) => (
              <div key={i} style={{ marginBottom: i === topDesp.length - 1 ? 0 : 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor }} />{d.nome}</span>
                  <span style={{ color: "#0F172A", fontWeight: 800 }}>{brl(d.valor)}</span>
                </div>
                <div style={{ height: 10, background: "#F1F5F4", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(d.valor / maxDesp) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${d.cor} 0%, ${d.cor}99 100%)`, borderRadius: 6 }} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}