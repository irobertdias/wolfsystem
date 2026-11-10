"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 💳 FORMAS DE PAGAMENTO (fin_formas_pagamento)
//   mostra o uso de cada forma (qtd e valor) a partir de fin_lancamentos
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };

const TIPOS = [
  { v: "pix", l: "Pix", i: "⚡" }, { v: "dinheiro", l: "Dinheiro", i: "💵" },
  { v: "cartao_credito", l: "Cartão de Crédito", i: "💳" }, { v: "cartao_debito", l: "Cartão de Débito", i: "💳" },
  { v: "boleto", l: "Boleto", i: "🧾" }, { v: "transferencia", l: "Transferência", i: "🏦" }, { v: "outro", l: "Outro", i: "📋" },
];
const tipoMeta = (v: string) => TIPOS.find((t) => t.v === v) || TIPOS[TIPOS.length - 1];
const PADRAO = [
  { nome: "Pix", tipo: "pix" }, { nome: "Dinheiro", tipo: "dinheiro" },
  { nome: "Cartão de Crédito", tipo: "cartao_credito" }, { nome: "Cartão de Débito", tipo: "cartao_debito" },
  { nome: "Boleto", tipo: "boleto" }, { nome: "Transferência (TED/DOC)", tipo: "transferencia" },
];
const COR = "#059669", G2 = "#10B981";

export default function FormasPagamento() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", tipo: "pix", ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [f, l] = await Promise.all([
      supabase.from("fin_formas_pagamento").select("*").eq("workspace_id", wsId).order("nome"),
      supabase.from("fin_lancamentos").select("forma_pagamento, valor, status").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
    ]);
    setLista((f.data as any[]) || []); setLancs((l.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ nome: "", tipo: "pix", ativo: true }); setModal(true); }
  function abrirEdicao(f: any) { setEditando(f); setForm({ nome: f.nome, tipo: f.tipo || "outro", ativo: f.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), tipo: form.tipo, ativo: form.ativo };
    if (editando) await supabase.from("fin_formas_pagamento").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_formas_pagamento").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(f: any) {
    if (!wsId || !confirm(`Excluir "${f.nome}"?`)) return;
    await supabase.from("fin_formas_pagamento").delete().eq("id", f.id).eq("workspace_id", wsId);
    carregar();
  }
  async function criarPadroes() {
    if (!wsId) return;
    const existentes = lista.map((f) => f.nome.toLowerCase());
    const novas = PADRAO.filter((p) => !existentes.includes(p.nome.toLowerCase())).map((p) => ({ ...p, ativo: true, workspace_id: wsId }));
    if (novas.length) await supabase.from("fin_formas_pagamento").insert(novas);
    carregar();
  }

  const usoDe = (nome: string) => {
    const rel = lancs.filter((l) => l.forma_pagamento === nome && l.status !== "cancelado");
    return { qtd: rel.length, valor: rel.reduce((s, l) => s + (l.valor || 0), 0) };
  };
  const maxValor = Math.max(...lista.map((f) => usoDe(f.nome).valor), 1);
  const ativas = lista.filter((f) => f.ativo).length;
  const totalMov = lista.reduce((s, f) => s + usoDe(f.nome).valor, 0);
  const maisUsada = [...lista].sort((a, b) => usoDe(b.nome).valor - usoDe(a.nome).valor)[0];

  const kpis = [
    { label: "Formas cadastradas", valor: String(lista.length), cor: COR, g2: G2, icone: "💳" },
    { label: "Ativas", valor: String(ativas), cor: "#059669", g2: "#10B981", icone: "✅" },
    { label: "Movimentado (total)", valor: brl(totalMov), cor: "#0F766E", g2: "#14B8A6", icone: "💰" },
    { label: "Mais usada", valor: maisUsada ? maisUsada.nome : "—", cor: "#047857", g2: "#34D399", icone: "🏆" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Formas de Pagamento</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Como os lançamentos são recebidos e pagos</p></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={criarPadroes} style={{ background: "#fff", color: COR, border: `1px solid ${COR}55`, borderRadius: 11, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Criar padrões</button>
          <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${COR}40` }}>+ Nova forma</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: k.label === "Mais usada" ? 17 : 25, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Carregando…</p>
        : lista.length === 0 ? (
          <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="💳" tamanho={24} /></div>
            <h3 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: "10px 0 4px" }}>Nenhuma forma cadastrada</h3>
            <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 16px" }}>Comece com as formas mais comuns ou crie as suas.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={criarPadroes} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Criar formas padrão</button>
              <button onClick={abrirNovo} style={{ background: "#fff", color: COR, border: `1px solid ${COR}55`, borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nova forma</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {lista.map((f) => {
              const t = tipoMeta(f.tipo); const uso = usoDe(f.nome); const share = (uso.valor / maxValor) * 100;
              return (
                <div key={f.id} style={{ ...card, padding: 18, opacity: f.ativo ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${COR}12`, border: `1px solid ${COR}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{t.i}</div>
                      <div><div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{f.nome}</div><div style={{ fontSize: 11.5, color: "#94A3B8" }}>{t.l}{!f.ativo ? " · inativa" : ""}</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => abrirEdicao(f)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => remover(f)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}><Icone nome="lixeira" tamanho={15} /></button>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                      <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 600 }}>{uso.qtd} lançamento(s)</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: COR }}>{brl(uso.valor)}</span>
                    </div>
                    <div style={{ height: 8, background: "#F1F5F4", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.min(share, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${COR} 0%, ${G2} 100%)`, borderRadius: 5 }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: COR, fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar forma" : "Nova forma de pagamento"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Pix" /></div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {TIPOS.map((t) => { const on = form.tipo === t.v; return <button key={t.v} onClick={() => setForm({ ...form, tipo: t.v })} style={{ padding: "8px 12px", borderRadius: 9, border: on ? `2px solid ${COR}` : "1px solid #E6ECEA", background: on ? `${COR}12` : "#fff", color: on ? COR : "#64748B", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.i} {t.l}</button>; })}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#334155" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}