"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📊 Relatórios financeiros — lançamentos filtrados + totais
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ini = () => new Date().toISOString().slice(0, 8) + "01";
const hoje = () => new Date().toISOString().slice(0, 10);
const inputStyle: any = { padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" };

export default function Relatorios() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [de, setDe] = useState(ini());
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
    setLancs((l.data as any[]) || []);
    setCats((c.data as any[]) || []);
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

  const cell: any = { padding: "9px 12px", fontSize: 13, borderTop: "1px solid #f3f4f6" };
  const head: any = { padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", textAlign: "left", background: "#f8fafc" };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 26 }}>📊</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Relatórios</h1>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inputStyle} />
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inputStyle} />
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={inputStyle}>
          <option value="">Tipo: todos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option>
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={inputStyle}>
          <option value="">Categoria: todas</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={inputStyle}>
          <option value="">Status: todos</option><option value="pago">Pagos</option><option value="pendente">Pendentes</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e5e7eb", borderTop: "3px solid #16a34a", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>RECEITAS</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#16a34a" }}>{brl(totR)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e5e7eb", borderTop: "3px solid #dc2626", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>DESPESAS</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#dc2626" }}>{brl(totD)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e5e7eb", borderTop: "3px solid #2563eb", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>SALDO</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: (totR - totD) >= 0 ? "#16a34a" : "#dc2626" }}>{brl(totR - totD)}</div>
        </div>
      </div>

      {carregando ? <p style={{ color: "#9ca3af" }}>Carregando…</p> : filtrados.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhum lançamento no filtro.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={head}>Vencimento</th><th style={head}>Descrição</th><th style={head}>Categoria</th><th style={{ ...head, textAlign: "right" }}>Valor</th></tr></thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}>
                  <td style={cell}>{(l.vencimento || "").split("-").reverse().join("/")}</td>
                  <td style={{ ...cell, color: "#111827", fontWeight: 600 }}>{l.descricao}</td>
                  <td style={{ ...cell, color: "#6b7280" }}>{nomeCat(l.categoria_id)}</td>
                  <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: l.tipo === "receita" ? "#16a34a" : "#dc2626" }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}