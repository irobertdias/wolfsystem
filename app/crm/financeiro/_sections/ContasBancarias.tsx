"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🏦 Contas bancárias / caixa / cartão (fin_contas)
const COR = "#d97706";
const TIPOS = [
  { v: "corrente", l: "Conta Corrente", i: "🏦" },
  { v: "poupanca", l: "Poupança", i: "🐷" },
  { v: "caixa", l: "Caixa / Dinheiro", i: "💵" },
  { v: "cartao", l: "Cartão", i: "💳" },
  { v: "investimento", l: "Investimento", i: "📈" },
];

type Conta = {
  id: string; workspace_id: string; nome: string; tipo: string;
  banco: string | null; agencia: string | null; conta: string | null;
  saldo_inicial: number; saldo_atual: number; cor: string | null; ativo: boolean;
};

const vazio = { nome: "", tipo: "corrente", banco: "", agencia: "", conta: "", saldo_inicial: "0", ativo: true };
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function ContasBancarias() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Conta | null>(null);
  const [form, setForm] = useState<any>({ ...vazio });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const { data } = await supabase.from("fin_contas").select("*").eq("workspace_id", wsId).order("nome");
    setLista((data as Conta[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm({ ...vazio }); setModal(true); }
  function abrirEdicao(c: Conta) {
    setEditando(c);
    setForm({ nome: c.nome, tipo: c.tipo, banco: c.banco || "", agencia: c.agencia || "", conta: c.conta || "", saldo_inicial: String(c.saldo_inicial ?? 0), ativo: c.ativo });
    setModal(true);
  }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const si = parseFloat(String(form.saldo_inicial).replace(",", ".")) || 0;
    const base = { nome: form.nome.trim(), tipo: form.tipo, banco: form.banco.trim() || null, agencia: form.agencia.trim() || null, conta: form.conta.trim() || null, saldo_inicial: si, ativo: form.ativo };
    if (editando) {
      await supabase.from("fin_contas").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    } else {
      await supabase.from("fin_contas").insert({ ...base, saldo_atual: si, workspace_id: wsId });
    }
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: Conta) {
    if (!wsId || !confirm(`Excluir a conta "${c.nome}"?`)) return;
    await supabase.from("fin_contas").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }

  const total = lista.filter((c) => c.ativo).reduce((s, c) => s + (c.saldo_atual || 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🏦</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Contas bancárias</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Nova conta</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>
        Saldo total (contas ativas): <strong style={{ color: total >= 0 ? "#16a34a" : "#dc2626" }}>{brl(total)}</strong>
      </p>

      {carregando ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhuma conta cadastrada.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {lista.map((c) => {
            const t = TIPOS.find((x) => x.v === c.tipo);
            return (
              <div key={c.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: `4px solid ${c.cor || COR}`, borderRadius: 12, padding: 16, opacity: c.ativo ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{t?.i} {c.nome}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t?.l}{c.banco ? ` · ${c.banco}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => abrirEdicao(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
                    <button onClick={() => remover(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? "#16a34a" : "#dc2626" }}>{brl(c.saldo_atual)}</div>
                {(c.agencia || c.conta) && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Ag {c.agencia || "—"} · CC {c.conta || "—"}</div>}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar conta" : "Nova conta"}</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nome *</label>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} placeholder="Ex: Itaú Principal" />
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                  {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Banco</label>
                <input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} style={inputStyle} placeholder="Itaú" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Agência</label>
                <input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Conta</label>
                <input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Saldo inicial</label>
              <input value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} style={inputStyle} placeholder="0,00" />
              {editando && <span style={{ fontSize: 11, color: "#9ca3af" }}>Editar o saldo inicial não recalcula lançamentos já feitos.</span>}
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