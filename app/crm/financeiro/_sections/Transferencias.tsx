"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Card, Empty, Modal, Btn, Field, Row, brl, hoje, dataBR, C, inputStyle, thStyle, tdStyle } from "./_ui";

// 🔄 Transferências entre contas (fin_lancamentos tipo="transferencia")
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
    if (!wsId || !confirm("Excluir esta transferência e reverter os saldos?")) return;
    const cO = contas.find((c) => c.id === t.conta_id); const cD = contas.find((c) => c.id === t.conta_destino_id);
    if (cO) await supabase.from("fin_contas").update({ saldo_atual: (cO.saldo_atual || 0) + (t.valor || 0) }).eq("id", cO.id).eq("workspace_id", wsId);
    if (cD) await supabase.from("fin_contas").update({ saldo_atual: (cD.saldo_atual || 0) - (t.valor || 0) }).eq("id", cD.id).eq("workspace_id", wsId);
    await supabase.from("fin_lancamentos").delete().eq("id", t.id).eq("workspace_id", wsId);
    carregar();
  }
  const nome = (id: string) => contas.find((c) => c.id === id)?.nome || "—";

  return (
    <Page>
      <PageHeader icone="🔄" titulo="Transferências" cor={C.blue} subtitulo="Mova saldo entre contas — ajusta as duas automaticamente"
        acao={<Btn cor={C.blue} onClick={abrir}>+ Nova transferência</Btn>} />

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : lista.length === 0 ? (
        <Empty icone="🔄" titulo="Nenhuma transferência" sub="Registre movimentações de saldo entre suas contas." acao={<Btn cor={C.blue} onClick={abrir}>+ Nova transferência</Btn>} />
      ) : (
        <Card pad={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={thStyle}>Data</th><th style={thStyle}>De → Para</th><th style={thStyle}>Descrição</th><th style={{ ...thStyle, textAlign: "right" }}>Valor</th><th style={{ ...thStyle, textAlign: "right" }}></th></tr></thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.id}>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{dataBR(t.vencimento)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{nome(t.conta_id)} <span style={{ color: C.blue }}>→</span> {nome(t.conta_destino_id)}</td>
                    <td style={{ ...tdStyle, color: "#6b7280" }}>{t.descricao || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: C.blue }}>{brl(t.valor)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}><button onClick={() => remover(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <Modal titulo="Nova transferência" cor={C.blue} onClose={() => setModal(false)} maxWidth={480}
          footer={<><Btn variante="ghost" cor="#6b7280" onClick={() => setModal(false)}>Cancelar</Btn><Btn cor={C.blue} onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Transferir"}</Btn></>}>
          <Row>
            <Field label="De (origem)" flex="1 1 180px"><select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} style={inputStyle}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label="Para (destino)" flex="1 1 180px"><select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} style={inputStyle}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          </Row>
          <Row>
            <Field label="Valor *" flex="0 0 150px"><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={inputStyle} placeholder="0,00" /></Field>
            <Field label="Data" flex="1 1 150px"><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={inputStyle} /></Field>
          </Row>
          <Field label="Descrição"><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} placeholder="opcional" /></Field>
        </Modal>
      )}
    </Page>
  );
}