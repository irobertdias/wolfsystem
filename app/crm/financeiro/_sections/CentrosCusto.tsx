"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🎯 CENTROS DE CUSTO (fin_centros_custo)
// ═══════════════════════════════════════════════════════════════════════
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "13px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };
const vazio = { nome: "", codigo: "", descricao: "", ativo: true };

export default function CentrosCusto() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_centros_custo").select("*").eq("workspace_id", wsId).order("codigo").order("nome");
    setLista((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: any) { setEditando(c); setForm({ nome: c.nome, codigo: c.codigo || "", descricao: c.descricao || "", ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), codigo: form.codigo.trim() || null, descricao: form.descricao.trim() || null, ativo: form.ativo };
    if (editando) await supabase.from("fin_centros_custo").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_centros_custo").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: any) {
    if (!wsId || !confirm(`Excluir o centro de custo "${c.nome}"?`)) return;
    await supabase.from("fin_centros_custo").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const filtrada = lista.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase().trim()) || (c.codigo || "").toLowerCase().includes(busca.toLowerCase().trim()));
  const ativos = lista.filter((c) => c.ativo).length;

  const kpis = [
    { label: "Total de centros", valor: String(lista.length), cor: "#7c3aed", g2: "#a78bfa", icone: "🎯" },
    { label: "Ativos", valor: String(ativos), cor: "#16a34a", g2: "#22c55e", icone: "✅" },
    { label: "Inativos", valor: String(lista.length - ativos), cor: "#6b7280", g2: "#9ca3af", icone: "⏸️" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(124,58,237,0.35)" }}><span style={{ filter: "saturate(0) brightness(2)" }}>🎯</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Centros de Custo</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Agrupe receitas e despesas por setor, projeto ou unidade</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>+ Novo centro</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <input placeholder="🔍 Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...input, maxWidth: 360, borderRadius: 20 }} />

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}><th style={{ ...th, width: 110 }}>Código</th><th style={th}>Nome</th><th style={th}>Descrição</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Ações</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              : filtrada.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>🎯</div>
                  <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum centro de custo</p>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>Ex.: Marketing, Operacional, Loja Centro, Projeto X.</p>
                  <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo centro</button>
                </td></tr>
              ) : filtrada.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", opacity: c.ativo ? 1 : 0.55 }}>
                  <td style={{ ...td, fontFamily: "monospace", color: "#6b7280" }}>{c.codigo || "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{c.nome}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{c.descricao || "—"}</td>
                  <td style={td}><span style={{ background: c.ativo ? "#f0fdf4" : "#f3f4f6", color: c.ativo ? "#16a34a" : "#6b7280", border: `1px solid ${c.ativo ? "#bbf7d0" : "#e5e7eb"}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{c.ativo ? "Ativo" : "Inativo"}</span></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => abrirEdicao(c)} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => remover(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}>🗑️</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: "#7c3aed", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "✏️ Editar centro" : "🎯 Novo centro de custo"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Marketing" /></div>
              <div><label style={lbl}>Código</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={input} placeholder="CC01" /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={input} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}