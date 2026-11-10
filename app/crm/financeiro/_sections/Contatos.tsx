"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🧑‍🤝‍🧑 CLIENTES / FORNECEDORES (fin_contatos)
//   mostra, por contato, o total a receber e a pagar (de fin_lancamentos)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };

const TIPOS = [
  { v: "cliente", l: "Cliente", cor: "#059669", bg: "#ECFDF5", bd: "#A7F3D0", g1: "#059669", g2: "#10B981" },
  { v: "fornecedor", l: "Fornecedor", cor: "#0F766E", bg: "#E0F2F1", bd: "#99F6E4", g1: "#0F766E", g2: "#14B8A6" },
  { v: "ambos", l: "Ambos", cor: "#047857", bg: "#ECFDF5", bd: "#A7F3D0", g1: "#047857", g2: "#34D399" },
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
    { label: "Clientes", valor: String(nClientes), cor: "#059669", g2: "#10B981", icone: "🟢" },
    { label: "Fornecedores", valor: String(nFornec), cor: "#0F766E", g2: "#14B8A6", icone: "🔵" },
    { label: "A receber (total)", valor: brl(totReceber), cor: "#059669", g2: "#34d399", icone: "📥" },
    { label: "A pagar (total)", valor: brl(totPagar), cor: "#dc2626", g2: "#f87171", icone: "📤" },
  ];
  const FILTROS = [{ k: "", l: "Todos" }, { k: "cliente", l: "Clientes" }, { k: "fornecedor", l: "Fornecedores" }, { k: "ambos", l: "Ambos" }];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Clientes / Fornecedores</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Cadastro usado nas contas a pagar e a receber</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #059669 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,148,136,0.4)" }}>+ Novo contato</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 16 }}>
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

      <div style={{ ...card, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {FILTROS.map((f) => { const on = fTipo === f.k; return <button key={f.k} onClick={() => setFTipo(f.k)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${on ? "#0d948855" : "#E6ECEA"}`, background: on ? "#0d948814" : "#fff", color: on ? "#059669" : "#64748B", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>; })}
        </div>
        <input placeholder="Buscar nome, documento, e-mail, telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...input, flex: 1, minWidth: 220, borderRadius: 20 }} />
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}>
            <th style={th}>Contato</th><th style={th}>Tipo</th><th style={th}>Documento</th><th style={th}>Telefone / E-mail</th>
            <th style={{ ...th, textAlign: "right" }}>A receber</th><th style={{ ...th, textAlign: "right" }}>A pagar</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
              : filtrada.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>🧑‍🤝‍🧑</div>
                  <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum contato</p>
                  <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 14px" }}>Cadastre clientes e fornecedores pra usar nos lançamentos.</p>
                  <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #059669 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo contato</button>
                </td></tr>
              ) : filtrada.map((c, i) => {
                const t = tipoMeta(c.tipo); const rec = aReceberDe(c.id); const pag = aPagarA(c.id);
                return (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9", opacity: c.ativo ? 1 : 0.55 }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${t.g1} 0%, ${t.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{inicial(c.nome)}</div>
                        <div><div style={{ fontWeight: 700, color: "#0F172A" }}>{c.nome}</div>{!c.ativo && <div style={{ fontSize: 11, color: "#94A3B8" }}>inativo</div>}</div>
                      </div>
                    </td>
                    <td style={td}><span style={{ background: t.bg, color: t.cor, border: `1px solid ${t.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{t.l}</span></td>
                    <td style={{ ...td, color: "#64748B", fontFamily: "monospace" }}>{c.documento || "—"}</td>
                    <td style={{ ...td, color: "#64748B" }}>{c.telefone ? <div>{c.telefone}</div> : null}{c.email ? <div style={{ fontSize: 12 }}>{c.email}</div> : null}{!c.telefone && !c.email ? "—" : null}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: rec > 0 ? "#059669" : "#CBD5E1" }}>{rec > 0 ? brl(rec) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: pag > 0 ? "#dc2626" : "#CBD5E1" }}>{pag > 0 ? brl(pag) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEdicao(c)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => remover(c)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}><Icone nome="lixeira" tamanho={15} /></button>
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
              <h2 style={{ color: "#059669", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar contato" : "Novo contato"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: "flex", gap: 8 }}>
                {TIPOS.map((t) => { const on = form.tipo === t.v; return <button key={t.v} onClick={() => setForm({ ...form, tipo: t.v })} style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, border: on ? `2px solid ${t.cor}` : "1px solid #E6ECEA", background: on ? t.bg : "#fff", color: t.cor }}>{t.l}</button>; })}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Nome / razão social" /></div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>CPF / CNPJ</label><input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} style={input} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Telefone</label><input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} style={input} placeholder="(62) 99999-9999" /></div>
              <div><label style={lbl}>E-mail</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>Observação</label><input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={input} /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#334155" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: "linear-gradient(135deg, #059669 0%, #2dd4bf 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1, boxShadow: "0 4px 12px rgba(13,148,136,0.4)" }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}