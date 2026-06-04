"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📊 Indicadores financeiros
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;
const hoje = () => new Date().toISOString().slice(0, 10);

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
    setLancs((l.data as any[]) || []);
    setCats((c.data as any[]) || []);
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

  // top 5 categorias de despesa
  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";
  const desp: Record<string, number> = {};
  lancs.filter((l) => l.tipo === "despesa" && l.status === "pago").forEach((l) => { const k = l.categoria_id || "—"; desp[k] = (desp[k] || 0) + (l.valor || 0); });
  const topDesp = Object.entries(desp).map(([id, v]) => ({ nome: id === "—" ? "Sem categoria" : nomeCat(id), valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const maxDesp = topDesp[0]?.valor || 1;

  function Kpi({ label, valor, cor, icone }: any) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${cor}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>{icone} {label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: cor, marginTop: 6 }}>{valor}</div>
      </div>
    );
  }

  if (carregando) return <div style={{ padding: 24, color: "#9ca3af" }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 26 }}>📊</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Indicadores</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Kpi label="Recebido (total)" valor={brl(recebido)} cor="#16a34a" icone="📥" />
        <Kpi label="Pago (total)" valor={brl(pago)} cor="#dc2626" icone="📤" />
        <Kpi label="Resultado" valor={brl(resultado)} cor={resultado >= 0 ? "#16a34a" : "#dc2626"} icone="📈" />
        <Kpi label="Ticket médio" valor={brl(ticket)} cor="#2563eb" icone="🎫" />
        <Kpi label="Margem" valor={pct(margem)} cor="#7c3aed" icone="%" />
        <Kpi label="Inadimplência" valor={pct(inadimplencia)} cor="#d97706" icone="⚠️" />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", textTransform: "uppercase", margin: "0 0 12px" }}>Top despesas por categoria</h3>
      {topDesp.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Sem despesas pagas ainda.</p> : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18 }}>
          {topDesp.map((d, i) => (
            <div key={i} style={{ marginBottom: i === topDesp.length - 1 ? 0 : 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#374151", fontWeight: 600 }}>{d.nome}</span>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>{brl(d.valor)}</span>
              </div>
              <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(d.valor / maxDesp) * 100}%`, height: "100%", background: "#dc2626" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}