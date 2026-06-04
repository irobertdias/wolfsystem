"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🌊 FLUXO DE CAIXA — entradas/saídas realizadas (pago) mês a mês no ano
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, outline: "none" };
const th: any = { padding: "11px 16px", color: "#6b7280", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap" };
const tdc: any = { padding: "11px 16px", fontSize: 13, textAlign: "right", borderTop: "1px solid #f3f4f6", whiteSpace: "nowrap" };
const COR = "#0891b2", G2 = "#22d3ee";

export default function FluxoCaixa() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ano, setAno] = useState(new Date().getFullYear());

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_lancamentos").select("pago_em, valor, tipo").eq("workspace_id", wsId).eq("status", "pago").in("tipo", ["receita", "despesa"]);
    setLancs((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const linhas = MESES.map((nome, i) => {
    const pref = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const doMes = lancs.filter((l) => (l.pago_em || "").slice(0, 7) === pref);
    const entrada = doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
    const saida = doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
    return { nome, entrada, saida, saldo: entrada - saida };
  });
  let acc = 0;
  const comAcc = linhas.map((l) => { acc += l.saldo; return { ...l, acumulado: acc }; });
  const totE = linhas.reduce((s, l) => s + l.entrada, 0);
  const totS = linhas.reduce((s, l) => s + l.saida, 0);
  const maxBar = Math.max(...linhas.flatMap((m) => [m.entrada, m.saida]), 1);
  const semDados = totE === 0 && totS === 0;

  const kpis = [
    { label: "Entradas (ano)", valor: brl(totE), cor: "#16a34a", g2: "#22c55e", icone: "📥" },
    { label: "Saídas (ano)", valor: brl(totS), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Resultado (ano)", valor: brl(totE - totS), cor: (totE - totS) >= 0 ? "#16a34a" : "#dc2626", g2: (totE - totS) >= 0 ? "#22c55e" : "#f87171", icone: "📈" },
    { label: "Saldo acumulado", valor: brl(acc), cor: acc >= 0 ? "#0891b2" : "#dc2626", g2: acc >= 0 ? "#22d3ee" : "#f87171", icone: "🌊" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>🌊</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Fluxo de Caixa</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Entradas e saídas realizadas, mês a mês</p></div>
        </div>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} style={input}>
          {[0, 1, 2, 3].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y}</option>; })}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 23, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* gráfico 12 meses */}
      <div style={{ ...card, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Entradas × Saídas <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: 12 }}>· {ano}</span></h3>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#16a34a" }} /> Entradas</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#dc2626" }} /> Saídas</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 190 }}>
          {linhas.map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, width: "100%", justifyContent: "center" }}>
                <div title={`Entradas: ${brl(m.entrada)}`} style={{ width: "44%", maxWidth: 18, height: `${Math.max((m.entrada / maxBar) * 100, m.entrada > 0 ? 3 : 0)}%`, minHeight: m.entrada > 0 ? 3 : 0, background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)", borderRadius: "5px 5px 0 0" }} />
                <div title={`Saídas: ${brl(m.saida)}`} style={{ width: "44%", maxWidth: 18, height: `${Math.max((m.saida / maxBar) * 100, m.saida > 0 ? 3 : 0)}%`, minHeight: m.saida > 0 ? 3 : 0, background: "linear-gradient(180deg, #f87171 0%, #dc2626 100%)", borderRadius: "5px 5px 0 0" }} />
              </div>
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>{m.nome}</span>
            </div>
          ))}
        </div>
        {semDados && !carregando && <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: "12px 0 0" }}>Sem movimentações liquidadas em {ano}.</p>}
      </div>

      {/* tabela */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f9fafb" }}><th style={{ ...th, textAlign: "left" }}>Mês</th><th style={th}>Entradas</th><th style={th}>Saídas</th><th style={th}>Saldo</th><th style={th}>Acumulado</th></tr></thead>
            <tbody>
              {carregando ? <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
                : comAcc.map((l, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={{ ...tdc, textAlign: "left", fontWeight: 700, color: "#1f2937" }}>{l.nome}</td>
                    <td style={{ ...tdc, color: l.entrada ? "#16a34a" : "#d1d5db" }}>{l.entrada ? brl(l.entrada) : "—"}</td>
                    <td style={{ ...tdc, color: l.saida ? "#dc2626" : "#d1d5db" }}>{l.saida ? brl(l.saida) : "—"}</td>
                    <td style={{ ...tdc, fontWeight: 700, color: l.saldo >= 0 ? "#16a34a" : "#dc2626" }}>{brl(l.saldo)}</td>
                    <td style={{ ...tdc, fontWeight: 800, color: l.acumulado >= 0 ? "#0891b2" : "#dc2626" }}>{brl(l.acumulado)}</td>
                  </tr>
                ))}
              <tr style={{ background: "#f1f5f9" }}>
                <td style={{ ...tdc, textAlign: "left", fontWeight: 800 }}>Total</td>
                <td style={{ ...tdc, fontWeight: 800, color: "#16a34a" }}>{brl(totE)}</td>
                <td style={{ ...tdc, fontWeight: 800, color: "#dc2626" }}>{brl(totS)}</td>
                <td style={{ ...tdc, fontWeight: 800, color: (totE - totS) >= 0 ? "#16a34a" : "#dc2626" }}>{brl(totE - totS)}</td>
                <td style={tdc}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}