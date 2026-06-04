"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

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

const cardStyle: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };

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
  const topDesp = Object.entries(despAgg).map(([id, v]) => ({ id, nome: id === "—" ? "Sem categoria" : nomeCat(id), cor: id === "—" ? "#9ca3af" : corCat(id), valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const maxDesp = topDesp[0]?.valor || 1;

  const stStatus = (l: any) => (l.vencimento && l.vencimento < hoje() ? { l: "Atrasado", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca" } : { l: "Pendente", c: "#d97706", bg: "#fffbeb", bd: "#fde68a" });

  // ─── KPIs ───
  const kpis = [
    { label: "Saldo em contas", valor: brl(saldoTotal), cor: saldoTotal >= 0 ? "#16a34a" : "#dc2626", g1: "#16a34a", g2: "#22c55e", icone: "🏦", sub: `${contas.length} conta(s) ativa(s)` },
    { label: "A receber", valor: brl(aReceber), cor: "#16a34a", g1: "#16a34a", g2: "#34d399", icone: "📥", sub: "em aberto" },
    { label: "A pagar", valor: brl(aPagar), cor: "#dc2626", g1: "#dc2626", g2: "#f87171", icone: "📤", sub: "em aberto" },
    { label: "Recebido no mês", valor: brl(recebidoMes), cor: "#2563eb", g1: "#2563eb", g2: "#60a5fa", icone: "✅", sub: "liquidado" },
    { label: "Pago no mês", valor: brl(pagoMes), cor: "#d97706", g1: "#d97706", g2: "#fbbf24", icone: "💸", sub: "liquidado" },
    { label: "Resultado do mês", valor: brl(resultadoMes), cor: resultadoMes >= 0 ? "#16a34a" : "#dc2626", g1: resultadoMes >= 0 ? "#16a34a" : "#dc2626", g2: resultadoMes >= 0 ? "#22c55e" : "#f87171", icone: "📈", sub: "receitas − despesas" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(217,119,6,0.3)" }}>
            <span style={{ filter: "saturate(0) brightness(2)" }}>📊</span>
          </div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Dashboard financeiro</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Visão geral de {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <button onClick={carregar} style={{ background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          🔄 Atualizar
        </button>
      </div>

      {/* ═══ ALERTA ATRASO ═══ */}
      {atrasados.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", border: "1px solid #fecaca", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fecaca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚠️</div>
          <div>
            <p style={{ margin: 0, color: "#991b1b", fontSize: 14, fontWeight: 800 }}>{atrasados.length} lançamento(s) em atraso</p>
            <p style={{ margin: "2px 0 0", color: "#b91c1c", fontSize: 12 }}>Total vencido: <b>{brl(totAtrasado)}</b> — regularize em Contas a Pagar / Receber.</p>
          </div>
        </div>
      )}

      {/* ═══ KPIs ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label}
            style={{ ...cardStyle, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.g1} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 10px ${k.cor}30` }}>
                <span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span>
              </div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 27, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1 }}>{k.valor}</div>
            <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 5, fontWeight: 600 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══ GRÁFICO 6 MESES + SALDO POR CONTA ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 18 }}>

        {/* gráfico de barras */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Entradas × Saídas <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: 12 }}>· últimos 6 meses</span></h3>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#16a34a", display: "inline-block" }} /> Entradas</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#dc2626", display: "inline-block" }} /> Saídas</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, height: 200, padding: "0 4px" }}>
            {serie.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, width: "100%", justifyContent: "center" }}>
                  <div title={`Entradas: ${brl(m.entrada)}`} style={{ width: "42%", maxWidth: 26, height: `${Math.max((m.entrada / maxBar) * 100, m.entrada > 0 ? 4 : 0)}%`, minHeight: m.entrada > 0 ? 4 : 0, background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)", borderRadius: "6px 6px 0 0" }} />
                  <div title={`Saídas: ${brl(m.saida)}`} style={{ width: "42%", maxWidth: 26, height: `${Math.max((m.saida / maxBar) * 100, m.saida > 0 ? 4 : 0)}%`, minHeight: m.saida > 0 ? 4 : 0, background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)", borderRadius: "6px 6px 0 0" }} />
                </div>
                <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{m.label}</span>
              </div>
            ))}
          </div>
          {serie.every((m) => m.entrada === 0 && m.saida === 0) && !carregando && (
            <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: "12px 0 0" }}>Sem movimentações liquidadas ainda — os números aparecem conforme você marca lançamentos como pagos.</p>
          )}
        </div>

        {/* saldo por conta */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Saldo por conta</h3>
          {carregando ? <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Carregando…</p>
            : contas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 30 }}>🏦</div>
                <p style={{ fontSize: 13, margin: "6px 0 0", fontStyle: "italic" }}>Nenhuma conta cadastrada.</p>
              </div>
            ) : contas.map((c, i) => {
              const t = TIPO_CONTA[c.tipo] || TIPO_CONTA.corrente;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{t.i}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: "#1f2937", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{t.l}</div>
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? "#16a34a" : "#dc2626" }}>{brl(c.saldo_atual)}</span>
                </div>
              );
            })}
          {contas.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: "2px solid #f3f4f6" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>Total</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: saldoTotal >= 0 ? "#16a34a" : "#dc2626" }}>{brl(saldoTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PRÓXIMOS VENCIMENTOS + TOP DESPESAS ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 18 }}>

        {/* próximos vencimentos */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>⏰ Próximos vencimentos</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Vencimento", "Descrição", "Status", "Valor"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 20px", color: "#6b7280", fontSize: 10.5, textAlign: i === 3 ? "right" : "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={4} style={{ padding: "34px", textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              ) : proximos.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "40px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 34 }}>🎉</div>
                  <p style={{ color: "#1f2937", fontSize: 14, fontWeight: 700, margin: "8px 0 2px" }}>Nada pendente à frente</p>
                  <p style={{ color: "#9ca3af", fontSize: 12, margin: 0 }}>Você está em dia com os vencimentos.</p>
                </td></tr>
              ) : proximos.map((l, i) => {
                const st = stStatus(l);
                return (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13, color: "#6b7280", fontWeight: 600, borderTop: "1px solid #f3f4f6" }}>{dataBR(l.vencimento)}</td>
                    <td style={{ padding: "12px 20px", fontSize: 13.5, color: "#1f2937", fontWeight: 600, borderTop: "1px solid #f3f4f6" }}>{l.descricao}</td>
                    <td style={{ padding: "12px 20px", borderTop: "1px solid #f3f4f6" }}>
                      <span style={{ background: st.bg, color: st.c, border: `1px solid ${st.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{st.l}</span>
                    </td>
                    <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 800, textAlign: "right", color: l.tipo === "receita" ? "#16a34a" : "#dc2626", borderTop: "1px solid #f3f4f6", whiteSpace: "nowrap" }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* top despesas */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 800, color: "#1f2937" }}>🔥 Top despesas por categoria</h3>
          {carregando ? <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Carregando…</p>
            : topDesp.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 30 }}>📊</div>
                <p style={{ fontSize: 13, margin: "6px 0 0", fontStyle: "italic" }}>Sem despesas pagas ainda.</p>
              </div>
            ) : topDesp.map((d, i) => (
              <div key={i} style={{ marginBottom: i === topDesp.length - 1 ? 0 : 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor }} />{d.nome}</span>
                  <span style={{ color: "#1f2937", fontWeight: 800 }}>{brl(d.valor)}</span>
                </div>
                <div style={{ height: 10, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(d.valor / maxDesp) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${d.cor} 0%, ${d.cor}99 100%)`, borderRadius: 6 }} />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}