"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🏦 CONTAS BANCÁRIAS / caixa / cartão (fin_contas)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };

const TIPOS = [
  { v: "corrente", l: "Conta Corrente", i: "🏦", g1: "#2563eb", g2: "#60a5fa" },
  { v: "poupanca", l: "Poupança", i: "🐷", g1: "#16a34a", g2: "#22c55e" },
  { v: "caixa", l: "Caixa / Dinheiro", i: "💵", g1: "#d97706", g2: "#f59e0b" },
  { v: "cartao", l: "Cartão", i: "💳", g1: "#7c3aed", g2: "#a78bfa" },
  { v: "investimento", l: "Investimento", i: "📈", g1: "#0891b2", g2: "#22d3ee" },
];
const tipoMeta = (v: string) => TIPOS.find((t) => t.v === v) || TIPOS[0];
const vazio = { nome: "", tipo: "corrente", banco: "", agencia: "", conta: "", saldo_inicial: "0", ativo: true };

export default function ContasBancarias() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_contas").select("*").eq("workspace_id", wsId).order("nome");
    setLista((data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: any) { setEditando(c); setForm({ nome: c.nome, tipo: c.tipo, banco: c.banco || "", agencia: c.agencia || "", conta: c.conta || "", saldo_inicial: String(c.saldo_inicial ?? 0), ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const si = parseFloat(String(form.saldo_inicial).replace(",", ".")) || 0;
    const base = { nome: form.nome.trim(), tipo: form.tipo, banco: form.banco.trim() || null, agencia: form.agencia.trim() || null, conta: form.conta.trim() || null, saldo_inicial: si, ativo: form.ativo };
    if (editando) await supabase.from("fin_contas").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_contas").insert({ ...base, saldo_atual: si, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: any) {
    if (!wsId || !confirm(`Excluir a conta "${c.nome}"? Os lançamentos ligados a ela ficam sem conta.`)) return;
    await supabase.from("fin_contas").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const ativas = lista.filter((c) => c.ativo);
  const total = ativas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const maior = ativas.reduce((m, c) => Math.max(m, c.saldo_atual || 0), 0);

  const kpis = [
    { label: "Saldo total (ativas)", valor: brl(total), cor: total >= 0 ? "#16a34a" : "#dc2626", g2: total >= 0 ? "#22c55e" : "#f87171", icone: "💰" },
    { label: "Contas ativas", valor: String(ativas.length), cor: "#2563eb", g2: "#60a5fa", icone: "🏦" },
    { label: "Maior saldo", valor: brl(maior), cor: "#7c3aed", g2: "#a78bfa", icone: "📈" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(217,119,6,0.35)" }}><span style={{ filter: "saturate(0) brightness(2)" }}>🏦</span></div>
          <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Contas bancárias</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Bancos, caixa, cartões e investimentos</p></div>
        </div>
        <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(217,119,6,0.4)" }}>+ Nova conta</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p>
        : lista.length === 0 ? (
          <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 42 }}>🏦</div>
            <h3 style={{ color: "#1f2937", fontSize: 16, fontWeight: 700, margin: "10px 0 4px" }}>Nenhuma conta cadastrada</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px" }}>Cadastre suas contas pra controlar saldos e ligar aos lançamentos.</p>
            <button onClick={abrirNovo} style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nova conta</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
            {lista.map((c) => {
              const t = tipoMeta(c.tipo);
              return (
                <div key={c.id} style={{ ...card, overflow: "hidden", opacity: c.ativo ? 1 : 0.6 }}>
                  <div style={{ background: `linear-gradient(135deg, ${t.g1} 0%, ${t.g2} 100%)`, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24, filter: "saturate(0) brightness(2)" }}>{t.i}</span>
                      <div><div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>{c.nome}</div><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11 }}>{t.l}{c.banco ? ` · ${c.banco}` : ""}</div></div>
                    </div>
                    {!c.ativo && <span style={{ background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>inativa</span>}
                  </div>
                  <div style={{ padding: 18 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Saldo atual</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? "#16a34a" : "#dc2626", letterSpacing: -1, margin: "2px 0 10px" }}>{brl(c.saldo_atual)}</div>
                    {(c.agencia || c.conta) && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Ag <b>{c.agencia || "—"}</b> · CC <b>{c.conta || "—"}</b></div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => abrirEdicao(c)} style={{ flex: 1, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 9, padding: "8px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                      <button onClick={() => remover(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 470, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: "#d97706", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "✏️ Editar conta" : "🏦 Nova conta"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Itaú Principal" /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Tipo</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {TIPOS.map((t) => { const on = form.tipo === t.v; return (
                  <button key={t.v} onClick={() => setForm({ ...form, tipo: t.v })} style={{ padding: "8px 12px", borderRadius: 9, border: on ? `2px solid ${t.g1}` : "1px solid #e5e7eb", background: on ? `${t.g1}12` : "#fff", color: on ? t.g1 : "#6b7280", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.i} {t.l}</button>
                ); })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Banco</label><input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} style={input} placeholder="Itaú" /></div>
              <div><label style={lbl}>Agência</label><input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} style={input} /></div>
              <div><label style={lbl}>Conta</label><input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>Saldo inicial</label><input value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} style={{ ...input, maxWidth: 200 }} placeholder="0,00" />{editando && <span style={{ fontSize: 11, color: "#9ca3af", display: "block", marginTop: 4 }}>Mudar o saldo inicial não recalcula lançamentos já feitos.</span>}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#374151" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Conta ativa</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1, boxShadow: "0 4px 12px rgba(217,119,6,0.4)" }}>{salvando ? "Salvando…" : "💾 Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}