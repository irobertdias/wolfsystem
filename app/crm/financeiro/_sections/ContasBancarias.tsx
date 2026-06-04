"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Empty, Modal, Btn, Field, Row, brl, C, inputStyle, cardStyle } from "./_ui";

// 🏦 Contas bancárias / caixa / cartão (fin_contas)
const TIPOS = [
  { v: "corrente", l: "Conta Corrente", i: "🏦" }, { v: "poupanca", l: "Poupança", i: "🐷" },
  { v: "caixa", l: "Caixa / Dinheiro", i: "💵" }, { v: "cartao", l: "Cartão", i: "💳" },
  { v: "investimento", l: "Investimento", i: "📈" },
];
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
    if (!wsId || !confirm(`Excluir a conta "${c.nome}"?`)) return;
    await supabase.from("fin_contas").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }
  const total = lista.filter((c) => c.ativo).reduce((s, c) => s + (c.saldo_atual || 0), 0);

  return (
    <Page>
      <PageHeader icone="🏦" titulo="Contas bancárias" subtitulo="Bancos, caixa, cartões e investimentos"
        acao={<Btn onClick={abrirNovo}>+ Nova conta</Btn>} />

      <Stats><Stat label="Saldo total (ativas)" valor={brl(total)} cor={total >= 0 ? C.green : C.red} icone="💰" /></Stats>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <Empty icone="🏦" titulo="Nenhuma conta cadastrada" sub="Cadastre suas contas pra começar a controlar saldos." acao={<Btn onClick={abrirNovo}>+ Nova conta</Btn>} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {lista.map((c) => {
            const t = TIPOS.find((x) => x.v === c.tipo);
            return (
              <div key={c.id} style={{ ...cardStyle, borderLeft: `4px solid ${c.cor || C.amber}`, padding: 18, opacity: c.ativo ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2937" }}>{t?.i} {c.nome}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t?.l}{c.banco ? ` · ${c.banco}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => abrirEdicao(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
                    <button onClick={() => remover(c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? C.green : C.red, letterSpacing: -0.5 }}>{brl(c.saldo_atual)}</div>
                {(c.agencia || c.conta) && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Ag {c.agencia || "—"} · CC {c.conta || "—"}</div>}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal titulo={editando ? "Editar conta" : "Nova conta"} onClose={() => setModal(false)} maxWidth={460}
          footer={<><Btn variante="ghost" cor="#6b7280" onClick={() => setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando || !form.nome.trim()}>{salvando ? "Salvando…" : "Salvar"}</Btn></>}>
          <Field label="Nome *"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} placeholder="Ex: Itaú Principal" /></Field>
          <Row>
            <Field label="Tipo" flex="1 1 150px"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></Field>
            <Field label="Banco" flex="1 1 150px"><input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} style={inputStyle} placeholder="Itaú" /></Field>
          </Row>
          <Row>
            <Field label="Agência" flex="1 1 120px"><input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} style={inputStyle} /></Field>
            <Field label="Conta" flex="1 1 120px"><input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} style={inputStyle} /></Field>
          </Row>
          <Field label="Saldo inicial"><input value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} style={inputStyle} placeholder="0,00" /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#374151" }}>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Conta ativa
          </label>
        </Modal>
      )}
    </Page>
  );
}