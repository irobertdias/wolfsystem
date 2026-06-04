"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🔄 Transferências entre contas (fin_lancamentos tipo="transferencia")
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

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
    setLista((t.data as any[]) || []);
    setContas((c.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrir() { setForm({ origem: "", destino: "", valor: "", data: hoje(), descricao: "" }); setModal(true); }

  async function salvar() {
    if (!wsId) return;
    const valor = parseFloat(String(form.valor).replace(",", ".")) || 0;
    if (!form.origem || !form.destino || form.origem === form.destino || valor <= 0) {
      alert("Escolha contas diferentes e um valor válido.");
      return;
    }
    setSalvando(true);
    const cO = contas.find((c) => c.id === form.origem);
    const cD = contas.find((c) => c.id === form.destino);
    await supabase.from("fin_lancamentos").insert({
      workspace_id: wsId, tipo: "transferencia",
      descricao: form.descricao.trim() || `Transferência ${cO?.nome} → ${cD?.nome}`,
      valor, vencimento: form.data, pago_em: form.data, valor_pago: valor, status: "pago",
      conta_id: form.origem, conta_destino_id: form.destino,
    });
    // ajusta saldos: origem -, destino +
    if (cO) await supabase.from("fin_contas").update({ saldo_atual: (cO.saldo_atual || 0) - valor }).eq("id", cO.id).eq("workspace_id", wsId);
    if (cD) await supabase.from("fin_contas").update({ saldo_atual: (cD.saldo_atual || 0) + valor }).eq("id", cD.id).eq("workspace_id", wsId);
    setSalvando(false); setModal(false); carregar();
  }

  async function remover(t: any) {
    if (!wsId || !confirm("Excluir esta transferência e reverter os saldos?")) return;
    const cO = contas.find((c) => c.id === t.conta_id);
    const cD = contas.find((c) => c.id === t.conta_destino_id);
    if (cO) await supabase.from("fin_contas").update({ saldo_atual: (cO.saldo_atual || 0) + (t.valor || 0) }).eq("id", cO.id).eq("workspace_id", wsId);
    if (cD) await supabase.from("fin_contas").update({ saldo_atual: (cD.saldo_atual || 0) - (t.valor || 0) }).eq("id", cD.id).eq("workspace_id", wsId);
    await supabase.from("fin_lancamentos").delete().eq("id", t.id).eq("workspace_id", wsId);
    carregar();
  }

  const nome = (id: string) => contas.find((c) => c.id === id)?.nome || "—";

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>🔄</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Transferências</h1>
        </div>
        <button onClick={abrir} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Nova transferência</button>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Mova saldo entre contas. Ajusta o saldo das duas automaticamente.</p>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhuma transferência.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {lista.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{nome(t.conta_id)} <span style={{ color: COR }}>→</span> {nome(t.conta_destino_id)}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{(t.vencimento || "").split("-").reverse().join("/")}{t.descricao ? ` · ${t.descricao}` : ""}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#2563eb", minWidth: 110, textAlign: "right" }}>{brl(t.valor)}</div>
              <button onClick={() => remover(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>Nova transferência</h2>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>De (origem)</label>
                <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Para (destino)</label>
                <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 150 }}>
                <label style={labelStyle}>Valor *</label>
                <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={inputStyle} placeholder="0,00" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Data</label>
                <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Descrição</label>
              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} placeholder="opcional" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Transferir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}