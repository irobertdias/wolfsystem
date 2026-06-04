"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🔄 TRANSFERÊNCIAS entre contas (fin_lancamentos tipo="transferencia")
//   ajusta o saldo das duas contas automaticamente; reverte ao excluir.
// ═══════════════════════════════════════════════════════════════════════

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");

const TIPO_CONTA: Record<string, string> = { corrente: "🏦", poupanca: "🐷", caixa: "💵", cartao: "💳", investimento: "📈" };
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const input: any = { width: "100%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 13px", color: "#1f2937", fontSize: 13.5, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#6b7280", fontSize: 10.5, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td: any = { padding: "13px 18px", fontSize: 13.5, color: "#1f2937", borderTop: "1px solid #f3f4f6", verticalAlign: "middle" };

export default function Transferencias() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<any>({ origem: "", destino: "", valor: "", data: hoje(), descricao: "" });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [t, c] = await Promise.all([
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).eq("tipo", "transferencia").order("vencimento", { ascending: false }),
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
    ]);
    setLista((t.data as any[]) || []); setContas((c.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrir() { setForm({ origem: "", destino: "", valor: "", data: hoje(), descricao: "" }); setModal(true); }
  async function salvar() {
    if (!wsId) return;
    const valor = parseFloat(String(form.valor).replace(",", ".")) || 0;
    if (!form.origem || !form.destino || form.origem === form.destino || valor <= 0) { alert("Escolha contas diferentes e um valor válido."); return; }
    setSalvando(true);
    const cO = contas.find((c) => c.id === form.origem); const cD = contas.find((c) => c.id === form.destino);
    await supabase.from("fin_lancamentos").insert({ workspace_id: wsId, tipo: "transferencia", descricao: form.descricao.trim() || `Transferência ${cO?.nome} → ${cD?.nome}`, valor, vencimento: form.data, pago_em: form.data, valor_pago: valor, status: "pago", conta_id: form.origem, conta_destino_id: form.destino });
    if (cO) await supabase.from("fin_contas").update({ saldo_atual: (cO.saldo_atual || 0) - valor }).eq("id", cO.id).eq("workspace_id", wsId);
    if (cD) await supabase.from("fin_contas").update({ saldo_atual: (cD.saldo_atual || 0) + valor }).eq("id", cD.id).eq("workspace_id", wsId);
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(t: any) {
    if (!wsId || !confirm("Excluir esta transferência e reverter os saldos das contas?")) return;
    const cO = contas.find((c) => c.id === t.conta_id); const cD = contas.find((c) => c.id === t.conta_destino_id);
    if (cO) await supabase.from("fin_contas").update({ saldo_atual: (cO.saldo_atual || 0) + (t.valor || 0) }).eq("id", cO.id).eq("workspace_id", wsId);
    if (cD) await supabase.from("fin_contas").update({ saldo_atual: (cD.saldo_atual || 0) - (t.valor || 0) }).eq("id", cD.id).eq("workspace_id", wsId);
    await supabase.from("fin_lancamentos").delete().eq("id", t.id).eq("workspace_id", wsId);
    carregar();
  }
  const cont = (id: string) => contas.find((c) => c.id === id);
  const nome = (id: string) => cont(id)?.nome || "—";

  const mes = mesAtual();
  const totMes = lista.filter((t) => (t.vencimento || "").slice(0, 7) === mes).reduce((s, t) => s + (t.valor || 0), 0);
  const saldoTotal = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);

  const kpis = [
    { label: "Transferido no mês", valor: brl(totMes), cor: "#2563eb", g2: "#60a5fa", icone: "🔄" },
    { label: "Nº de transferências", valor: String(lista.length), cor: "#7c3aed", g2: "#a78bfa", icone: "📋" },
    { label: "Saldo total em contas", valor: brl(saldoTotal), cor: saldoTotal >= 0 ? "#16a34a" : "#dc2626", g2: saldoTotal >= 0 ? "#22c55e" : "#f87171", icone: "💰" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 8px 20px rgba(37,99,235,0.35)" }}><span style={{ filter: "saturate(0) brightness(2)" }}>🔄</span></div>
          <div>
            <h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Transferências</h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Mova saldo entre contas — ajusta as duas automaticamente</p>
          </div>
        </div>
        <button onClick={abrir} style={{ background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}>+ Nova transferência</button>
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

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}><h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1f2937" }}>Histórico de transferências</h3></div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#f9fafb" }}>
            <th style={th}>Data</th><th style={th}>De → Para</th><th style={th}>Descrição</th>
            <th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 38 }}>🔄</div>
                <p style={{ color: "#1f2937", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhuma transferência ainda</p>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 14px" }}>Registre movimentações de saldo entre as suas contas.</p>
                <button onClick={abrir} style={{ background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nova transferência</button>
              </td></tr>
            ) : lista.map((t, i) => {
              const o = cont(t.conta_id); const d = cont(t.conta_destino_id);
              return (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ ...td, color: "#6b7280" }}>{dataBR(t.vencimento)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 10px" }}>{TIPO_CONTA[o?.tipo] || "🏦"} {nome(t.conta_id)}</span>
                      <span style={{ color: "#2563eb", fontSize: 16, fontWeight: 800 }}>→</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 10px", color: "#1e40af" }}>{TIPO_CONTA[d?.tipo] || "🏦"} {nome(t.conta_destino_id)}</span>
                    </div>
                  </td>
                  <td style={{ ...td, color: "#6b7280" }}>{t.descricao || "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#2563eb", whiteSpace: "nowrap" }}>{brl(t.valor)}</td>
                  <td style={{ ...td, textAlign: "right" }}><button onClick={() => remover(t)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>🗑️</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: "#2563eb", fontSize: 18, fontWeight: 800, margin: 0 }}>🔄 Nova transferência</h2>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8 }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end", marginBottom: 14 }}>
              <div><label style={lbl}>De (origem)</label><select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} style={input}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div style={{ paddingBottom: 10, color: "#2563eb", fontSize: 20, fontWeight: 800 }}>→</div>
              <div><label style={lbl}>Para (destino)</label><select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} style={input}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Valor *</label><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={input} placeholder="0,00" /></div>
              <div><label style={lbl}>Data</label><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={input} /></div>
            </div>
            <div style={{ marginBottom: 20 }}><label style={lbl}>Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={input} placeholder="opcional" /></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background: "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando ? 0.6 : 1, boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}>{salvando ? "Salvando…" : "💸 Transferir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}