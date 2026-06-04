"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🎯 Centros de Custo (fin_centros_custo)
const COR = "#d97706";
type CC = { id: string; workspace_id: string; nome: string; codigo: string | null; descricao: string | null; ativo: boolean };
const vazio = { nome: "", codigo: "", descricao: "", ativo: true };
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function CentrosCusto() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<CC[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<CC | null>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_centros_custo").select("*").eq("workspace_id", wsId).order("codigo").order("nome");
    setLista((data as CC[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: CC) { setEditando(c); setForm({ nome: c.nome, codigo: c.codigo || "", descricao: c.descricao || "", ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), codigo: form.codigo.trim() || null, descricao: form.descricao.trim() || null, ativo: form.ativo };
    if (editando) await supabase.from("fin_centros_custo").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_centros_custo").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: CC) {
    if (!wsId || !confirm(`Excluir o centro de custo "${c.nome}"?`)) return;
    await supabase.from("fin_centros_custo").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const filtrada = lista.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase().trim()));

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🎯</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Centros de Custo</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Novo</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Agrupe despesas e receitas por setor, projeto ou unidade.</p>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar..." style={{ ...inputStyle, maxWidth: 320, marginBottom: 18 }} />

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : filtrada.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhum centro de custo.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {filtrada.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6", opacity: c.ativo ? 1 : 0.5 }}>
              {c.codigo && <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace", minWidth: 40 }}>{c.codigo}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{c.nome}</div>
                {c.descricao && <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.descricao}</div>}
              </div>
              {!c.ativo && <span style={{ fontSize: 11, color: "#9ca3af" }}>inativo</span>}
              <button onClick={() => abrirEdicao(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
              <button onClick={() => remover(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar" : "Novo"} centro de custo</h2>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nome *</label>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} placeholder="Ex: Marketing" />
              </div>
              <div style={{ width: 110 }}>
                <label style={labelStyle}>Código</label>
                <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={inputStyle} placeholder="CC01" />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Descrição</label>
              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} />
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