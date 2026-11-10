"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 📈 DRE — Demonstrativo de Resultado (por mês, agrupado por categoria)
//   base: competência (vencimento) ou caixa (pago_em)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, outline: "none" };
const COR = "#0d9488", G2 = "#2dd4bf";

export default function DRE() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(mesAtual());
  const [base, setBase] = useState<"competencia" | "caixa">("competencia");

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

  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";
  const corCat = (id: string) => cats.find((c) => c.id === id)?.cor || null;

  const noMes = lancs.filter((l) => {
    if (base === "caixa") return l.status === "pago" && (l.pago_em || "").slice(0, 7) === mes;
    return l.status !== "cancelado" && (l.vencimento || "").slice(0, 7) === mes;
  });

  function agrupar(tipo: string, corFb: string) {
    const m: Record<string, number> = {};
    noMes.filter((l) => l.tipo === tipo).forEach((l) => { const k = l.categoria_id || "—"; m[k] = (m[k] || 0) + (l.valor || 0); });
    return Object.entries(m).map(([id, v]) => ({ nome: id === "—" ? "Sem categoria" : nomeCat(id), cor: (id !== "—" && corCat(id)) || corFb, valor: v })).sort((a, b) => b.valor - a.valor);
  }
  const receitas = agrupar("receita", "#059669");
  const despesas = agrupar("despesa", "#dc2626");
  const totR = receitas.reduce((s, x) => s + x.valor, 0);
  const totD = despesas.reduce((s, x) => s + x.valor, 0);
  const resultado = totR - totD;
  const margem = totR ? (resultado / totR) * 100 : 0;

  const kpis = [
    { label: "Receitas", valor: brl(totR), cor: "#059669", g2: "#10B981", icone: "📥" },
    { label: "Despesas", valor: brl(totD), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Resultado", valor: brl(resultado), cor: resultado >= 0 ? "#059669" : "#dc2626", g2: resultado >= 0 ? "#10B981" : "#f87171", icone: "📈" },
    { label: "Margem", valor: `${margem.toFixed(1)}%`, cor: "#047857", g2: "#34D399", icone: "📊" },
  ];

  function Bloco({ titulo, itens, total, cor, emoji }: any) {
    return (
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "15px 20px", borderBottom: "1px solid #F1F5F4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: cor }}>{<IconeEmoji e={emoji} />} {titulo}</h3>
          <span style={{ fontSize: 16, fontWeight: 800, color: cor }}>{brl(total)}</span>
        </div>
        <div style={{ padding: "8px 20px 16px" }}>
          {itens.length === 0 ? <p style={{ color: "#94A3B8", fontSize: 13, margin: "10px 0", fontStyle: "italic" }}>Nada no período.</p>
            : itens.map((x: any, i: number) => {
              const share = total ? (x.valor / total) * 100 : 0;
              return (
                <div key={i} style={{ padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid #F1F5F4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 5 }}>
                    <span style={{ color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: x.cor }} />{x.nome}</span>
                    <span style={{ color: "#0F172A", fontWeight: 700 }}>{brl(x.valor)} <span style={{ color: "#94A3B8", fontWeight: 500, fontSize: 11.5 }}>({share.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: "#F1F5F4", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${share}%`, height: "100%", background: x.cor, borderRadius: 4 }} /></div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>DRE — Demonstrativo de Resultado</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Receitas e despesas do mês, por categoria</p></div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#F1F5F4", borderRadius: 10, padding: 3 }}>
            {([["competencia", "Competência"], ["caixa", "Caixa"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setBase(v)} style={{ padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: base === v ? "#fff" : "transparent", color: base === v ? COR : "#64748B", boxShadow: base === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{l}</button>
            ))}
          </div>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={input} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Carregando…</p> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <Bloco titulo="Receitas" itens={receitas} total={totR} cor="#059669" emoji="📥" />
            <Bloco titulo="Despesas" itens={despesas} total={totD} cor="#dc2626" emoji="📤" />
          </div>
          <div style={{ background: `linear-gradient(135deg, ${resultado >= 0 ? "#059669" : "#dc2626"} 0%, ${resultado >= 0 ? "#10B981" : "#f87171"} 100%)`, color: "#fff", borderRadius: 16, padding: "22px 26px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, boxShadow: `0 8px 24px ${resultado >= 0 ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)"}` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, }}>Resultado do mês</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{resultado >= 0 ? "Lucro" : "Prejuízo"} · margem {margem.toFixed(1)}%</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{brl(resultado)}</div>
          </div>
        </>
      )}
    </div>
  );
}