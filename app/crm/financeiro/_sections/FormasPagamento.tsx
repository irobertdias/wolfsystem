"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 💳 FORMAS DE PAGAMENTO (fin_formas_pagamento)
//   mostra o uso de cada forma (qtd e valor) a partir de fin_lancamentos
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };

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
const COR = "#db2777", G2 = "#f472b6";

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
    { label: "Ativas", valor: String(ativas), cor: "#16a34a", g2: "#22c55e", icone: "✅" },
    { label: "Movimentado (total)", valor: brl(totalMov), cor: "#2563eb", g2: "#60a5fa", icone: "💰" },
    { label: "Mais usada", valor: maisUsada ? maisUsada.nome : "—", cor: "#7c3aed", g2: "#a78bfa", icone: "🏆" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>💳</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Formas de Pagamento</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Como os lançamentos são recebidos e pagos</p></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={criarPadroes} style={{ background: "#fff", color: COR, border: `1px solid ${COR}55`, borderRadius: 11, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⚡ Criar padrões</button>
          <button onClick={abrirNovo} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${COR}40` }}>+ Nova forma</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: k.label === "Mais usada" ? 17 : 25, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p>
        : lista.length === 0 ? (
          <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 42 }}>💳</div>
            <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "10px 0 4px" }}>Nenhuma forma cadastrada</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px" }}>Comece com as formas mais comuns ou crie as suas.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={criarPadroes} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⚡ Criar formas padrão</button>
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
                      <div><div style={{ fontSize: 15, fontWeight: 800, color: "#1f2937" }}>{f.nome}</div><div style={{ fontSize: 11.5, color: "#9ca3af" }}>{t.l}{!f.ativo ? " · inativa" : ""}</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button onClick={() => abrirEdicao(f)} style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                      <button onClick={() => remover(f)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 8px", fontSize: 13, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                      <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 600 }}>{uso.qtd} lançamento(s)</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: COR }}>{brl(uso.valor)}</span>
                    </div>
                    <div style={{ height: 8, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.min(share, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${COR} 0%, ${G2} 100%)`, borderRadius: 5 }} /></div>
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
              <h2 style={{ color: COR, fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "✏️ Editar forma" : "💳 Nova forma de pagamento"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Pix" /></div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {TIPOS.map((t) => { const on = form.tipo === t.v; return <button key={t.v} onClick={() => setForm({ ...form, tipo: t.v })} style={{ padding: "8px 12px", borderRadius: 9, border: on ? `2px solid ${COR}` : "1px solid #e5e7eb", background: on ? `${COR}12` : "#fff", color: on ? COR : "#6b7280", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.i} {t.l}</button>; })}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${COR}40` }}>{salvando ? "Salvando…" : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}