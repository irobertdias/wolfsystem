"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 📈 INDICADORES — saúde financeira (fin_lancamentos + fin_categorias)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
const hoje = () => new Date().toISOString().slice(0, 10);
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };

export default function Indicadores() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [l, c] = await Promise.all([
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId),
    ]);
    setLancs((l.data as any[]) || []); setCats((c.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const recPagas = lancs.filter((l) => l.tipo === "receita" && l.status === "pago");
  const recebido = recPagas.reduce((s, l) => s + (l.valor || 0), 0);
  const pago = lancs.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + (l.valor || 0), 0);
  const resultado = recebido - pago;
  const ticket = recPagas.length ? recebido / recPagas.length : 0;
  const margem = recebido ? (resultado / recebido) * 100 : 0;
  const aReceber = lancs.filter((l) => l.tipo === "receita" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const atrasado = lancs.filter((l) => l.status === "pendente" && l.vencimento && l.vencimento < hoje()).reduce((s, l) => s + (l.valor || 0), 0);
  const inadimplencia = (aReceber + atrasado) ? (atrasado / (aReceber + atrasado)) * 100 : 0;

  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";
  const corCat = (id: string) => cats.find((c) => c.id === id)?.cor || null;
  function agrega(tipo: string, corFb: string) {
    const m: Record<string, number> = {};
    lancs.filter((l) => l.tipo === tipo && l.status === "pago").forEach((l) => { const k = l.categoria_id || "—"; m[k] = (m[k] || 0) + (l.valor || 0); });
    return Object.entries(m).map(([id, v]) => ({ nome: id === "—" ? "Sem categoria" : nomeCat(id), cor: (id !== "—" && corCat(id)) || corFb, valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  }
  const topRec = agrega("receita", "#16a34a");
  const topDesp = agrega("despesa", "#dc2626");
  const maxRec = topRec[0]?.valor || 1; const maxDesp = topDesp[0]?.valor || 1;

  const kpis = [
    { label: "Recebido (total)", valor: brl(recebido), cor: "#16a34a", g2: "#22c55e", icone: "📥" },
    { label: "Pago (total)", valor: brl(pago), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Resultado", valor: brl(resultado), cor: resultado >= 0 ? "#16a34a" : "#dc2626", g2: resultado >= 0 ? "#22c55e" : "#f87171", icone: "📈" },
    { label: "Ticket médio", valor: brl(ticket), cor: "#2563eb", g2: "#60a5fa", icone: "🎫" },
    { label: "Margem", valor: pct(margem), cor: "#7c3aed", g2: "#a78bfa", icone: "📊" },
    { label: "Inadimplência", valor: pct(inadimplencia), cor: "#d97706", g2: "#f59e0b", icone: "⚠️" },
  ];

  function Barras({ titulo, dados, max, emoji }: any) {
    return (
      <div style={{ ...card, padding: 22 }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 800, color: "#1f2937" }}>{emoji} {titulo}</h3>
        {carregando ? <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Carregando…</p>
          : dados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af" }}><div style={{ fontSize: 30 }}>📊</div><p style={{ fontSize: 13, margin: "6px 0 0", fontStyle: "italic" }}>Sem dados pagos ainda.</p></div>
          ) : dados.map((d: any, i: number) => (
            <div key={i} style={{ marginBottom: i === dados.length - 1 ? 0 : 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor }} />{d.nome}</span>
                <span style={{ color: "#1f2937", fontWeight: 800 }}>{brl(d.valor)}</span>
              </div>
              <div style={{ height: 10, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${(d.valor / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${d.cor} 0%, ${d.cor}99 100%)`, borderRadius: 6 }} /></div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(124,58,237,0.35)" }}><span style={{ filter: "saturate(0) brightness(2)" }}>📈</span></div>
        <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Indicadores</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Saúde financeira do negócio</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Barras titulo="Top receitas por categoria" dados={topRec} max={maxRec} emoji="💚" />
        <Barras titulo="Top despesas por categoria" dados={topDesp} max={maxDesp} emoji="🔥" />
      </div>
    </div>
  );
}