"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🧑‍🤝‍🧑 CLIENTES / FORNECEDORES (fin_contatos)
//   mostra, por contato, o total a receber e a pagar (de fin_lancamentos)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };

const TIPOS = [
  { v: "cliente", l: "Cliente", cor: "#16a34a", bg: "#f0fdf4", bd: "#bbf7d0", g1: "#16a34a", g2: "#22c55e" },
  { v: "fornecedor", l: "Fornecedor", cor: "#2563eb", bg: "#eff6ff", bd: "#bfdbfe", g1: "#2563eb", g2: "#60a5fa" },
  { v: "ambos", l: "Ambos", cor: "#7c3aed", bg: "#f5f3ff", bd: "#ddd6fe", g1: "#7c3aed", g2: "#a78bfa" },
];
const tipoMeta = (v: string) => TIPOS.find((t) => t.v === v) || TIPOS[0];
const vazio = { nome: "", tipo: "cliente", documento: "", email: "", telefone: "", observacao: "", ativo: true };
const inicial = (nome: string) => (nome || "?").trim().charAt(0).toUpperCase();

export default function Contatos() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, l] = await Promise.all([
      supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).order("nome"),
      supabase.from("fin_lancamentos").select("contato_id, valor, tipo, status").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
    ]);
    setLista((c.data as any[]) || []); setLancs((l.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: any) { setEditando(c); setForm({ nome: c.nome, tipo: c.tipo, documento: c.documento || "", email: c.email || "", telefone: c.telefone || "", observacao: c.observacao || "", ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), tipo: form.tipo, documento: form.documento.trim() || null, email: form.email.trim() || null, telefone: form.telefone.trim() || null, observacao: form.observacao.trim() || null, ativo: form.ativo };
    if (editando) await supabase.from("fin_contatos").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_contatos").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: any) {
    if (!wsId || !confirm(`Excluir "${c.nome}"? Os lançamentos ligados a ele ficam sem contato.`)) return;
    await supabase.from("fin_contatos").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  // valores por contato
  const aReceberDe = (id: string) => lancs.filter((l) => l.contato_id === id && l.tipo === "receita" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const aPagarA = (id: string) => lancs.filter((l) => l.contato_id === id && l.tipo === "despesa" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);

  const filtrada = lista.filter((c) => {
    const okBusca = !busca || [c.nome, c.documento, c.email, c.telefone].some((v) => (v || "").toLowerCase().includes(busca.toLowerCase().trim()));
    const okTipo = !fTipo || c.tipo === fTipo || c.tipo === "ambos";
    return okBusca && okTipo;
  });

  const nClientes = lista.filter((c) => c.tipo === "cliente" || c.tipo === "ambos").length;
  const nFornec = lista.filter((c) => c.tipo === "fornecedor" || c.tipo === "ambos").length;
  const totReceber = lista.reduce((s, c) => s + aReceberDe(c.id), 0);
  const totPagar = lista.reduce((s, c) => s + aPagarA(c.id), 0);

  const kpis = [
    { label: "Total de contatos", valor: String(lista.length), cor: "#0d9488", g2: "#2dd4bf", icone: "🧑‍🤝‍🧑" },
    { label: "Clientes", valor: String(nClientes), cor: "#16a34a", g2: "#22c55e", icone: "🟢" },
    { label: "Fornecedores", valor: String(nFornec), cor: "#2563eb", g2: "#60a5fa", icone: "🔵" },
    { label: "A receber (total)", valor: brl(totReceber), cor: "#16a34a", g2: "#34d399", icone: "📥" },
    { label: "A pagar (total)", valor: brl(totPagar), cor: "#dc2626", g2: "#f87171", icone: "📤" },
  ];
  const FILTROS = [{ k: "", l: "Todos" }, { k: "cliente", l: "Clientes" }, { k: "fornecedor", l: "Fornecedores" }, { k: "ambos", l: "Ambos" }];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(13,148,136,0.35)" }}><span style={{ filter: "saturate(0) brightness(2)" }}>🧑‍🤝‍🧑</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Clientes / Fornecedores</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Cadastro usado nas contas a pagar e a receber</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,148,136,0.4)" }}>+ Novo contato</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 16 }}>
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

      <div style={{ ...card, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {FILTROS.map((f) => { const on = fTipo === f.k; return <button key={f.k} onClick={() => setFTipo(f.k)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${on ? "#0d948855" : "#e5e7eb"}`, background: on ? "#0d948814" : "#fff", color: on ? "#0d9488" : "#6b7280", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>; })}
        </div>
        <input placeholder="🔍 Buscar nome, documento, e-mail, telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...input, flex: 1, minWidth: 220, borderRadius: 20 }} />
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            <th style={th}>Contato</th><th style={th}>Tipo</th><th style={th}>Documento</th><th style={th}>Telefone / E-mail</th>
            <th style={{ ...th, textAlign: "right" }}>A receber</th><th style={{ ...th, textAlign: "right" }}>A pagar</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              : filtrada.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>🧑‍🤝‍🧑</div>
                  <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum contato</p>
                  <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>Cadastre clientes e fornecedores pra usar nos lançamentos.</p>
                  <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo contato</button>
                </td></tr>
              ) : filtrada.map((c, i) => {
                const t = tipoMeta(c.tipo); const rec = aReceberDe(c.id); const pag = aPagarA(c.id);
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", opacity: c.ativo ? 1 : 0.55 }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${t.g1} 0%, ${t.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{inicial(c.nome)}</div>
                        <div><div style={{ fontWeight: 700, color: "#1f2937" }}>{c.nome}</div>{!c.ativo && <div style={{ fontSize: 11, color: "#9ca3af" }}>inativo</div>}</div>
                      </div>
                    </td>
                    <td style={td}><span style={{ background: t.bg, color: t.cor, border: `1px solid ${t.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{t.l}</span></td>
                    <td style={{ ...td, color: "#6b7280", fontFamily: "monospace" }}>{c.documento || "—"}</td>
                    <td style={{ ...td, color: "#6b7280" }}>{c.telefone ? <div>{c.telefone}</div> : null}{c.email ? <div style={{ fontSize: 12 }}>{c.email}</div> : null}{!c.telefone && !c.email ? "—" : null}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: rec > 0 ? "#16a34a" : "#d1d5db" }}>{rec > 0 ? brl(rec) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: pag > 0 ? "#dc2626" : "#d1d5db" }}>{pag > 0 ? brl(pag) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEdicao(c)} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => remover(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: "#0d9488", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "✏️ Editar contato" : "🧑‍🤝‍🧑 Novo contato"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {TIPOS.map((t) => { const on = form.tipo === t.v; return <button key={t.v} onClick={() => setForm({ ...form, tipo: t.v })} style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, border: on ? `2px solid ${t.cor}` : "1px solid #e5e7eb", background: on ? t.bg : "#fff", color: t.cor }}>{t.l}</button>; })}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Nome / razão social" /></div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>CPF / CNPJ</label><input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} style={input} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} style={input} placeholder="(62) 99999-9999" /></div>
              <div><label style={lbl}>E-mail</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>Observação</label><input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={input} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1, boxShadow: "0 4px 12px rgba(13,148,136,0.4)" }}>{salvando ? "Salvando…" : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}