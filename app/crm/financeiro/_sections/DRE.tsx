"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📈 DRE — Demonstrativo de Resultado (por competência/vencimento, mensal)
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const inputStyle: any = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" };

export default function DRE() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(mesAtual());

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

  const noMes = lancs.filter((l) => l.status !== "cancelado" && (l.vencimento || "").slice(0, 7) === mes);
  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";

  function agrupar(tipo: string) {
    const m: Record<string, number> = {};
    noMes.filter((l) => l.tipo === tipo).forEach((l) => {
      const k = l.categoria_id || "—";
      m[k] = (m[k] || 0) + (l.valor || 0);
    });
    return Object.entries(m).map(([id, v]) => ({ nome: id === "—" ? "Sem categoria" : nomeCat(id), valor: v })).sort((a, b) => b.valor - a.valor);
  }
  const receitas = agrupar("receita");
  const despesas = agrupar("despesa");
  const totR = receitas.reduce((s, x) => s + x.valor, 0);
  const totD = despesas.reduce((s, x) => s + x.valor, 0);
  const resultado = totR - totD;

  function Bloco({ titulo, itens, total, cor }: any) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: cor }}>{titulo}</h3>
          <span style={{ fontSize: 15, fontWeight: 800, color: cor }}>{brl(total)}</span>
        </div>
        {itens.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Nada no período.</p> : itens.map((x: any, i: number) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", fontSize: 14, color: "#374151" }}>
            <span>{x.nome}</span><span style={{ fontWeight: 600 }}>{brl(x.valor)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>📈</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>DRE — Resultado</h1>
        </div>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={inputStyle} />
      </div>
      {carregando ? <p style={{ color: "#9ca3af" }}>Carregando…</p> : (
        <>
          <Bloco titulo="Receitas" itens={receitas} total={totR} cor="#16a34a" />
          <Bloco titulo="Despesas" itens={despesas} total={totD} cor="#dc2626" />
          <div style={{ background: resultado >= 0 ? "#16a34a" : "#dc2626", color: "#fff", borderRadius: 12, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Resultado do mês</span>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{brl(resultado)}</span>
          </div>
        </>
      )}
    </div>
  );
}