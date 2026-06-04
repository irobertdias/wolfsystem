"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🧑‍🤝‍🧑 Clientes / Fornecedores (fin_contatos)
const COR = "#d97706";
const TIPOS = [
  { v: "cliente", l: "Cliente", cor: "#16a34a" },
  { v: "fornecedor", l: "Fornecedor", cor: "#2563eb" },
  { v: "ambos", l: "Ambos", cor: "#7c3aed" },
];
type Contato = { id: string; workspace_id: string; nome: string; tipo: string; documento: string | null; email: string | null; telefone: string | null; observacao: string | null; ativo: boolean };
const vazio = { nome: "", tipo: "cliente", documento: "", email: "", telefone: "", observacao: "", ativo: true };
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function Contatos() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Contato | null>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).order("nome");
    setLista((data as Contato[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: Contato) { setEditando(c); setForm({ nome: c.nome, tipo: c.tipo, documento: c.documento || "", email: c.email || "", telefone: c.telefone || "", observacao: c.observacao || "", ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), tipo: form.tipo, documento: form.documento.trim() || null, email: form.email.trim() || null, telefone: form.telefone.trim() || null, observacao: form.observacao.trim() || null, ativo: form.ativo };
    if (editando) await supabase.from("fin_contatos").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_contatos").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: Contato) {
    if (!wsId || !confirm(`Excluir "${c.nome}"?`)) return;
    await supabase.from("fin_contatos").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const filtrada = lista.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase().trim()) && (!filtroTipo || c.tipo === filtroTipo || (filtroTipo !== "ambos" && c.tipo === "ambos"))
  );

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🧑‍🤝‍🧑</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Clientes / Fornecedores</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Novo</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Cadastro usado nas contas a pagar e a receber.</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar..." style={{ ...inputStyle, maxWidth: 280 }} />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }}>
          <option value="">Todos</option>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : filtrada.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhum contato.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {filtrada.map((c, i) => {
            const t = TIPOS.find((x) => x.v === c.tipo);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", opacity: c.ativo ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{[c.documento, c.telefone, c.email].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: t?.cor, background: `${t?.cor}14`, border: `1px solid ${t?.cor}44`, borderRadius: 20, padding: "3px 10px" }}>{t?.l}</span>
                <button onClick={() => abrirEdicao(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
                <button onClick={() => remover(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar" : "Novo"} contato</h2>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nome *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ width: 140 }}>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>CPF / CNPJ</label>
              <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>E-mail</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Telefone</label>
                <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Observação</label>
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
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