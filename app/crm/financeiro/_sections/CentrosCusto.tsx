"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🎯 CENTROS DE CUSTO (fin_centros_custo)
// ═══════════════════════════════════════════════════════════════════════
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "13px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };
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
    { label: "Total de centros", valor: String(lista.length), cor: "#047857", g2: "#34D399", icone: "🎯" },
    { label: "Ativos", valor: String(ativos), cor: "#059669", g2: "#10B981", icone: "✅" },
    { label: "Inativos", valor: String(lista.length - ativos), cor: "#64748B", g2: "#94A3B8", icone: "⏸️" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Centros de Custo</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Agrupe receitas e despesas por setor, projeto ou unidade</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #047857 0%, #34D399 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(5,150,105,0.4)" }}>+ Novo centro</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <input placeholder="Buscar por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...input, maxWidth: 360, borderRadius: 20 }} />

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}><th style={{ ...th, width: 110 }}>Código</th><th style={th}>Nome</th><th style={th}>Descrição</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Ações</th></tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              : filtrada.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="🎯" tamanho={24} /></div>
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum centro de custo</p>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 14px" }}>Ex.: Marketing, Operacional, Loja Centro, Projeto X.</p>
                  <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #047857 0%, #34D399 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo centro</button>
                </td></tr>
              ) : filtrada.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9", opacity: c.ativo ? 1 : 0.55 }}>
                  <td style={{ ...td, fontFamily: "monospace", color: "#64748B" }}>{c.codigo || "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{c.nome}</td>
                  <td style={{ ...td, color: "#64748B" }}>{c.descricao || "—"}</td>
                  <td style={td}><span style={{ background: c.ativo ? "#ECFDF5" : "#F1F5F4", color: c.ativo ? "#059669" : "#64748B", border: `1px solid ${c.ativo ? "#A7F3D0" : "#E6ECEA"}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{c.ativo ? "Ativo" : "Inativo"}</span></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => abrirEdicao(c)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => remover(c)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}><Icone nome="lixeira" tamanho={15} /></button>
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
              <h2 style={{ color: "#047857", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar centro" : "Novo centro de custo"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Marketing" /></div>
              <div><label style={lbl}>Código</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={input} placeholder="CC01" /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={input} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#334155" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: "linear-gradient(135deg, #047857 0%, #34D399 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}