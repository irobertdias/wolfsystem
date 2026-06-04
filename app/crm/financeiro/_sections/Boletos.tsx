"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🎫 Boletos — cadastro + leitura da linha digitável + lançar a pagar
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

// Lê a linha digitável (47 dígitos): fator de vencimento + valor
function lerLinha(linha: string): { valor: number; vencimento: string } | null {
  const d = (linha || "").replace(/\D/g, "");
  if (d.length < 47) return null;
  const fator = parseInt(d.slice(33, 37), 10);
  const valor = parseInt(d.slice(37, 47), 10) / 100;
  let vencimento = "";
  if (fator > 0) {
    const base = new Date(Date.UTC(1997, 9, 7));
    base.setUTCDate(base.getUTCDate() + fator);
    vencimento = base.toISOString().slice(0, 10);
  }
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
    const base = {
      tipo: "boleto", direcao: "recebida", emitente_nome: form.emitente_nome.trim(),
      numero: form.numero.trim() || null, linha_digitavel: form.linha_digitavel.replace(/\D/g, "") || null,
      valor_total: parseFloat(String(form.valor_total).replace(",", ".")) || 0, vencimento: form.vencimento || null,
    };
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
    const { data } = await supabase.from("fin_lancamentos").insert({
      workspace_id: wsId, tipo: "despesa", descricao: `Boleto ${b.emitente_nome}`,
      valor: b.valor_total || 0, vencimento: b.vencimento, status: "pendente", forma_pagamento: "Boleto",
    }).select("id").maybeSingle();
    await supabase.from("fin_notas").update({ status: "processada", lancamento_id: data?.id || null }).eq("id", b.id).eq("workspace_id", wsId);
    carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎫</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Boletos</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Novo boleto</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Cole a linha digitável e o sistema lê valor e vencimento. Depois lance em Contas a Pagar.</p>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhum boleto.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {lista.map((b, i) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{b.emitente_nome}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Venc. {(b.vencimento || "").split("-").reverse().join("/")}{b.numero ? ` · nº ${b.numero}` : ""}</div>
              </div>
              {b.lancamento_id ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#16a34a14", border: "1px solid #16a34a44", borderRadius: 20, padding: "3px 10px" }}>Lançado</span>
              ) : (
                <button onClick={() => lancar(b)} style={{ fontSize: 12, fontWeight: 700, color: COR, background: `${COR}14`, border: `1px solid ${COR}55`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>→ Lançar a pagar</button>
              )}
              <div style={{ fontSize: 15, fontWeight: 800, color: "#dc2626", minWidth: 100, textAlign: "right" }}>{brl(b.valor_total)}</div>
              <button onClick={() => abrirEdicao(b)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
              <button onClick={() => remover(b)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar" : "Novo"} boleto</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Linha digitável</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.linha_digitavel} onChange={(e) => setForm({ ...form, linha_digitavel: e.target.value })} style={inputStyle} placeholder="47 dígitos" />
                <button onClick={lerDaLinha} style={{ background: `${COR}14`, color: COR, border: `1px solid ${COR}55`, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>📷 Ler</button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Beneficiário *</label>
              <input value={form.emitente_nome} onChange={(e) => setForm({ ...form, emitente_nome: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 140 }}>
                <label style={labelStyle}>Valor</label>
                <input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={inputStyle} placeholder="0,00" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ width: 110 }}>
                <label style={labelStyle}>Nº</label>
                <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.emitente_nome.trim()} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando || !form.emitente_nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}