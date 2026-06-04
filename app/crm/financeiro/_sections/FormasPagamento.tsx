"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 💳 Formas de Pagamento (fin_formas_pagamento)
const COR = "#d97706";
const PADROES = ["Pix", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência (TED/DOC)"];
type Forma = { id: string; workspace_id: string; nome: string; tipo: string | null; ativo: boolean };
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function FormasPagamento() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Forma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Forma | null>(null);
  const [form, setForm] = useState<any>({ nome: "", ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_formas_pagamento").select("*").eq("workspace_id", wsId).order("nome");
    setLista((data as Forma[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ nome: "", ativo: true }); setModal(true); }
  function abrirEdicao(f: Forma) { setEditando(f); setForm({ nome: f.nome, ativo: f.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), ativo: form.ativo };
    if (editando) await supabase.from("fin_formas_pagamento").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_formas_pagamento").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(f: Forma) {
    if (!wsId || !confirm(`Excluir "${f.nome}"?`)) return;
    await supabase.from("fin_formas_pagamento").delete().eq("id", f.id).eq("workspace_id", wsId);
    carregar();
  }
  async function criarPadroes() {
    if (!wsId) return;
    const existentes = lista.map((f) => f.nome.toLowerCase());
    const novas = PADROES.filter((p) => !existentes.includes(p.toLowerCase())).map((nome) => ({ nome, ativo: true, workspace_id: wsId }));
    if (novas.length === 0) return;
    await supabase.from("fin_formas_pagamento").insert(novas);
    carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>💳</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Formas de Pagamento</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Nova</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Como os lançamentos são recebidos/pagos.</p>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic", margin: "0 0 12px" }}>Nenhuma forma cadastrada.</p>
          <button onClick={criarPadroes} style={{ background: `${COR}14`, color: COR, border: `1px solid ${COR}55`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⚡ Criar formas padrão</button>
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {lista.map((f, i) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", opacity: f.ativo ? 1 : 0.5 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111827" }}>{f.nome}</span>
              {!f.ativo && <span style={{ fontSize: 11, color: "#9ca3af" }}>inativo</span>}
              <button onClick={() => abrirEdicao(f)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
              <button onClick={() => remover(f)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar" : "Nova"} forma de pagamento</h2>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} placeholder="Ex: Pix" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando || !form.nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}