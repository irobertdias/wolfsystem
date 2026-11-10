"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 📈 INDICADORES — saúde financeira (fin_lancamentos + fin_categorias)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
const hoje = () => new Date().toISOString().slice(0, 10);
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };

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
  const topRec = agrega("receita", "#059669");
  const topDesp = agrega("despesa", "#dc2626");
  const maxRec = topRec[0]?.valor || 1; const maxDesp = topDesp[0]?.valor || 1;

  const kpis = [
    { label: "Recebido (total)", valor: brl(recebido), cor: "#059669", g2: "#10B981", icone: "📥" },
    { label: "Pago (total)", valor: brl(pago), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Resultado", valor: brl(resultado), cor: resultado >= 0 ? "#059669" : "#dc2626", g2: resultado >= 0 ? "#10B981" : "#f87171", icone: "📈" },
    { label: "Ticket médio", valor: brl(ticket), cor: "#0F766E", g2: "#14B8A6", icone: "🎫" },
    { label: "Margem", valor: pct(margem), cor: "#047857", g2: "#34D399", icone: "📊" },
    { label: "Inadimplência", valor: pct(inadimplencia), cor: "#C2410C", g2: "#FB923C", icone: "⚠️" },
  ];

  function Barras({ titulo, dados, max, emoji }: any) {
    return (
      <div style={{ ...card, padding: 22 }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{<IconeEmoji e={emoji} />} {titulo}</h3>
        {carregando ? <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Carregando…</p>
          : dados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#94A3B8" }}><div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="📊" tamanho={24} /></div><p style={{ fontSize: 13, margin: "6px 0 0", fontStyle: "italic" }}>Sem dados pagos ainda.</p></div>
          ) : dados.map((d: any, i: number) => (
            <div key={i} style={{ marginBottom: i === dados.length - 1 ? 0 : 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: d.cor }} />{d.nome}</span>
                <span style={{ color: "#0F172A", fontWeight: 800 }}>{brl(d.valor)}</span>
              </div>
              <div style={{ height: 10, background: "#F1F5F4", borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${(d.valor / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${d.cor} 0%, ${d.cor}99 100%)`, borderRadius: 6 }} /></div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Indicadores</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Saúde financeira do negócio</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
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