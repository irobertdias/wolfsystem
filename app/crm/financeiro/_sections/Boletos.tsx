"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🎫 BOLETOS — cadastro com leitura da linha digitável + lançar a pagar
//   (fin_notas tipo=boleto) → fin_lancamentos (despesa)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };
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
    if (b.lancamento_id) return { l: "Lançado", c: "#059669", bg: "#ECFDF5", bd: "#A7F3D0" };
    if (b.vencimento && b.vencimento < hoje()) return { l: "Vencido", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca" };
    return { l: "A vencer", c: "#ca8a04", bg: "#fefce8", bd: "#fde68a" };
  };
  const total = lista.reduce((s, b) => s + (b.valor_total || 0), 0);
  const aVencer = lista.filter((b) => !b.lancamento_id && (!b.vencimento || b.vencimento >= hoje())).reduce((s, b) => s + (b.valor_total || 0), 0);
  const vencidos = lista.filter((b) => !b.lancamento_id && b.vencimento && b.vencimento < hoje());
  const kpis = [
    { label: "Boletos", valor: String(lista.length), cor: COR, g2: G2, icone: "🎫" },
    { label: "Valor total", valor: brl(total), cor: "#0F766E", g2: "#14B8A6", icone: "💰" },
    { label: "A vencer", valor: brl(aVencer), cor: "#ca8a04", g2: "#facc15", icone: "🕐" },
    { label: "Vencidos", valor: String(vencidos.length), cor: "#dc2626", g2: "#f87171", icone: "⚠️" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Boletos</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Cole a linha digitável — o sistema lê valor e vencimento</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${COR}40` }}>+ Novo boleto</button>
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

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}>
            <th style={th}>Beneficiário</th><th style={th}>Nº</th><th style={th}>Vencimento</th><th style={th}>Situação</th>
            <th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              : lista.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="🎫" tamanho={24} /></div>
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum boleto</p>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 14px" }}>Cole a linha digitável e o sistema preenche valor e vencimento.</p>
                  <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo boleto</button>
                </td></tr>
              ) : lista.map((b, i) => {
                const s = sit(b);
                return (
                  <tr key={b.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9" }}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.emitente_nome}{b.linha_digitavel && <div style={{ fontSize: 10.5, color: "#94A3B8", fontFamily: "monospace" }}>{b.linha_digitavel.slice(0, 20)}…</div>}</td>
                    <td style={{ ...td, color: "#64748B" }}>{b.numero || "—"}</td>
                    <td style={{ ...td, color: "#64748B" }}>{dataBR(b.vencimento)}</td>
                    <td style={td}>{b.lancamento_id ? <span style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{s.l}</span> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ background: s.bg, color: s.c, border: `1px solid ${s.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{s.l}</span><button onClick={() => lancar(b)} style={{ background: `${COR}12`, color: COR, border: `1px solid ${COR}55`, borderRadius: 9, padding: "5px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Lançar</button></div>
                    )}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#dc2626", whiteSpace: "nowrap" }}>{brl(b.valor_total)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEdicao(b)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}><Icone nome="editar" tamanho={15} /></button>
                      <button onClick={() => remover(b)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}><Icone nome="lixeira" tamanho={15} /></button>
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
              <h2 style={{ color: COR, fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar boleto" : "Novo boleto"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Linha digitável</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.linha_digitavel} onChange={(e) => setForm({ ...form, linha_digitavel: e.target.value })} style={input} placeholder="47 dígitos do código de barras" />
                <button onClick={lerDaLinha} style={{ background: `${COR}14`, color: COR, border: `1px solid ${COR}55`, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Ler</button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Beneficiário *</label><input value={form.emitente_nome} onChange={(e) => setForm({ ...form, emitente_nome: e.target.value })} style={input} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 120px", gap: 12, marginBottom: 20 }}>
              <div><label style={lbl}>Valor</label><input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={input} placeholder="0,00" /></div>
              <div><label style={lbl}>Vencimento</label><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={input} /></div>
              <div><label style={lbl}>Nº</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={input} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.emitente_nome.trim()} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.emitente_nome.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}