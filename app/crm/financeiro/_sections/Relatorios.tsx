"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 📊 RELATÓRIOS — lançamentos filtrados por período/tipo/categoria/status
//   com totais e exportação CSV.
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const iniMes = () => new Date().toISOString().slice(0, 8) + "01";
const hoje = () => new Date().toISOString().slice(0, 10);
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, outline: "none" };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "11px 18px", fontSize: 13, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };
const COR = "#ea580c", G2 = "#fb923c";
const STC: any = { pago: { l: "Pago", c: "#059669" }, pendente: { l: "Pendente", c: "#C2410C" }, cancelado: { l: "Cancelado", c: "#64748B" } };

export default function Relatorios() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [de, setDe] = useState(iniMes());
  const [ate, setAte] = useState(hoje());
  const [fTipo, setFTipo] = useState("");
  const [fCat, setFCat] = useState("");
  const [fStatus, setFStatus] = useState("");

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

  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "—";
  const filtrados = lancs.filter((l) => {
    const v = l.vencimento || "";
    if (v < de || v > ate) return false;
    if (fTipo && l.tipo !== fTipo) return false;
    if (fCat && l.categoria_id !== fCat) return false;
    if (fStatus && l.status !== fStatus) return false;
    return true;
  }).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));

  const totR = filtrados.filter((l) => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
  const totD = filtrados.filter((l) => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);

  function exportarCSV() {
    const linhas = [["Vencimento", "Tipo", "Descricao", "Categoria", "Status", "Valor"]];
    filtrados.forEach((l) => linhas.push([dataBR(l.vencimento), l.tipo, (l.descricao || "").replace(/;/g, ","), nomeCat(l.categoria_id), l.status || "", String(l.valor || 0).replace(".", ",")]));
    const csv = linhas.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio_${de}_a_${ate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = [
    { label: "Receitas", valor: brl(totR), cor: "#059669", g2: "#10B981", icone: "📥" },
    { label: "Despesas", valor: brl(totD), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Saldo", valor: brl(totR - totD), cor: (totR - totD) >= 0 ? "#059669" : "#dc2626", g2: (totR - totD) >= 0 ? "#10B981" : "#f87171", icone: "📈" },
    { label: "Lançamentos", valor: String(filtrados.length), cor: COR, g2: G2, icone: "📋" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Relatórios</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Filtre os lançamentos e exporte</p></div>
        </div>
        <button onClick={exportarCSV} disabled={filtrados.length === 0} style={{ background: filtrados.length ? `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)` : "#E6ECEA", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: filtrados.length ? "pointer" : "default", boxShadow: filtrados.length ? `0 4px 12px ${COR}40` : "none" }}>Exportar CSV</button>
      </div>

      <div style={{ ...card, padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>De</span>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={input} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={input} />
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={input}><option value="">Tipo: todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={input}><option value="">Categoria: todas</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}><option value="">Status: todos</option><option value="pago">Pagos</option><option value="pendente">Pendentes</option></select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}><th style={th}>Vencimento</th><th style={th}>Descrição</th><th style={th}>Categoria</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Valor</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              : filtrados.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="📊" tamanho={24} /></div>
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum lançamento no filtro</p>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Ajuste o período ou os filtros acima.</p>
                </td></tr>
              ) : filtrados.map((l, i) => {
                const st = STC[l.status] || STC.pendente;
                return (
                  <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9" }}>
                    <td style={{ ...td, color: "#64748B" }}>{dataBR(l.vencimento)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{l.descricao}</td>
                    <td style={{ ...td, color: "#64748B" }}>{nomeCat(l.categoria_id)}</td>
                    <td style={td}><span style={{ color: st.c, fontWeight: 700, fontSize: 12 }}>● {st.l}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: l.tipo === "receita" ? "#059669" : "#dc2626", whiteSpace: "nowrap" }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}