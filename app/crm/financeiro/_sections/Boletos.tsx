"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🎫 BOLETOS — cadastro com leitura da linha digitável + lançar a pagar
//   (fin_notas tipo=boleto) → fin_lancamentos (despesa)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };
const COR = "#ca8a04", G2 = "#facc15";

// lê a linha digitável (47 dígitos): fator de vencimento + valor
function lerLinha(linha: string): { valor: number; vencimento: string } | null {
  const d = (linha || "").replace(/\D/g, "");
  if (d.length < 47) return null;
  const fator = parseInt(d.slice(33, 37), 10);
  const valor = parseInt(d.slice(37, 47), 10) / 100;
  let vencimento = "";
  if (fator > 0) { const base = new Date(Date.UTC(1997, 9, 7)); base.setUTCDate(base.getUTCDate() + fator); vencimento = base.toISOString().slice(0, 10); }
  return { valor: isNaN(valor) ? 0 : valor, vencimento };
}

export default function Boletos() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ emitente_nome: "", numero: "", linha_digitavel: "", valor_total: "", vencimento: hoje() });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_notas").select("*").eq("workspace_id", wsId).eq("tipo", "boleto").order("vencimento", { ascending: true });
    setLista((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ emitente_nome: "", numero: "", linha_digitavel: "", valor_total: "", vencimento: hoje() }); setModal(true); }
  function abrirEdicao(b: any) { setEditando(b); setForm({ emitente_nome: b.emitente_nome || "", numero: b.numero || "", linha_digitavel: b.linha_digitavel || "", valor_total: String(b.valor_total ?? ""), vencimento: b.vencimento || hoje() }); setModal(true); }
  function lerDaLinha() {
    const r = lerLinha(form.linha_digitavel);
    if (!r) { alert("Linha digitável inválida (precisa de 47 dígitos)."); return; }
    setForm((p: any) => ({ ...p, valor_total: r.valor ? String(r.valor) : p.valor_total, vencimento: r.vencimento || p.vencimento }));
  }
  async function salvar() {
    if (!wsId || !form.emitente_nome.trim()) return;
    setSalvando(true);
    const base = { tipo: "boleto", direcao: "recebida", emitente_nome: form.emitente_nome.trim(), numero: form.numero.trim() || null, linha_digitavel: form.linha_digitavel.replace(/\D/g, "") || null, valor_total: parseFloat(String(form.valor_total).replace(",", ".")) || 0, vencimento: form.vencimento || null };
    if (editando) await supabase.from("fin_notas").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_notas").insert({ ...base, status: "importada", workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(b: any) {
    if (!wsId || !confirm(`Excluir o boleto de "${b.emitente_nome}"?`)) return;
    await supabase.from("fin_notas").delete().eq("id", b.id).eq("workspace_id", wsId);
    carregar();
  }
  async function lancar(b: any) {
    if (!wsId || b.lancamento_id) return;
    const { data } = await supabase.from("fin_lancamentos").insert({ workspace_id: wsId, tipo: "despesa", descricao: `Boleto ${b.emitente_nome}`, valor: b.valor_total || 0, vencimento: b.vencimento, status: "pendente", forma_pagamento: "Boleto" }).select("id").maybeSingle();
    await supabase.from("fin_notas").update({ status: "processada", lancamento_id: data?.id || null }).eq("id", b.id).eq("workspace_id", wsId);
    carregar();
  }

  const sit = (b: any) => {
    if (b.lancamento_id) return { l: "Lançado", c: "#16a34a", bg: "#f0fdf4", bd: "#bbf7d0" };
    if (b.vencimento && b.vencimento < hoje()) return { l: "Vencido", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca" };
    return { l: "A vencer", c: "#ca8a04", bg: "#fefce8", bd: "#fde68a" };
  };
  const total = lista.reduce((s, b) => s + (b.valor_total || 0), 0);
  const aVencer = lista.filter((b) => !b.lancamento_id && (!b.vencimento || b.vencimento >= hoje())).reduce((s, b) => s + (b.valor_total || 0), 0);
  const vencidos = lista.filter((b) => !b.lancamento_id && b.vencimento && b.vencimento < hoje());
  const kpis = [
    { label: "Boletos", valor: String(lista.length), cor: COR, g2: G2, icone: "🎫" },
    { label: "Valor total", valor: brl(total), cor: "#2563eb", g2: "#60a5fa", icone: "💰" },
    { label: "A vencer", valor: brl(aVencer), cor: "#ca8a04", g2: "#facc15", icone: "🕐" },
    { label: "Vencidos", valor: String(vencidos.length), cor: "#dc2626", g2: "#f87171", icone: "⚠️" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>🎫</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Boletos</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Cole a linha digitável — o sistema lê valor e vencimento</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${COR}40` }}>+ Novo boleto</button>
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
            <div style={{ color: k.cor, fontSize: 25, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            <th style={th}>Beneficiário</th><th style={th}>Nº</th><th style={th}>Vencimento</th><th style={th}>Situação</th>
            <th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              : lista.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>🎫</div>
                  <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum boleto</p>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>Cole a linha digitável e o sistema preenche valor e vencimento.</p>
                  <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo boleto</button>
                </td></tr>
              ) : lista.map((b, i) => {
                const s = sit(b);
                return (
                  <tr key={b.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.emitente_nome}{b.linha_digitavel && <div style={{ fontSize: 10.5, color: "#9ca3af", fontFamily: "monospace" }}>{b.linha_digitavel.slice(0, 20)}…</div>}</td>
                    <td style={{ ...td, color: "#6b7280" }}>{b.numero || "—"}</td>
                    <td style={{ ...td, color: "#6b7280" }}>{dataBR(b.vencimento)}</td>
                    <td style={td}>{b.lancamento_id ? <span style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{s.l}</span> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{s.l}</span><button onClick={() => lancar(b)} style={{ background: `${COR}12`, color: COR, border: `1px solid ${COR}55`, borderRadius: 9, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>→ Lançar</button></div>
                    )}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#dc2626", whiteSpace: "nowrap" }}>{brl(b.valor_total)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEdicao(b)} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => remover(b)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: COR, fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "✏️ Editar boleto" : "🎫 Novo boleto"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Linha digitável</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.linha_digitavel} onChange={(e) => setForm({ ...form, linha_digitavel: e.target.value })} style={input} placeholder="47 dígitos do código de barras" />
                <button onClick={lerDaLinha} style={{ background: `${COR}14`, color: COR, border: `1px solid ${COR}55`, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>🔎 Ler</button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Beneficiário *</label><input value={form.emitente_nome} onChange={(e) => setForm({ ...form, emitente_nome: e.target.value })} style={input} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 120px", gap: 12, marginBottom: 20 }}>
              <div><label style={lbl}>Valor</label><input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={input} placeholder="0,00" /></div>
              <div><label style={lbl}>Vencimento</label><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={input} /></div>
              <div><label style={lbl}>Nº</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={input} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.emitente_nome.trim()} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.emitente_nome.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}