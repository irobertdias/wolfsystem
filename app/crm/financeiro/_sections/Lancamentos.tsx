"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Card, Empty, Modal, Btn, Field, Row, Pill, brl, hoje, mesAtual, dataBR, C, inputStyle, thStyle, tdStyle } from "./_ui";

// 💰 Lançamentos — motor de fin_lancamentos
//   secKey "contas_receber" → receitas | "contas_pagar" → despesas | senão → tudo (caixa)
export default function Lancamentos({ secKey }: any) {
  const { wsId } = useWorkspace();
  const modo = secKey === "contas_receber" ? "receber" : secKey === "contas_pagar" ? "pagar" : "todos";
  const tipoFixo = modo === "receber" ? "receita" : modo === "pagar" ? "despesa" : null;
  const titulo = modo === "receber" ? "Contas a Receber" : modo === "pagar" ? "Contas a Pagar" : "Lançamentos / Caixa";
  const icone = modo === "receber" ? "📥" : modo === "pagar" ? "📤" : "💵";
  const corHead = modo === "receber" ? C.green : modo === "pagar" ? C.red : C.amber;

  const [lancs, setLancs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contatos, setContatos] = useState<any[]>([]);
  const [formas, setFormas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(mesAtual());
  const [fStatus, setFStatus] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [salvando, setSalvando] = useState(false);

  const novoForm = () => ({ tipo: tipoFixo || "despesa", descricao: "", valor: "", vencimento: hoje(), conta_id: "", categoria_id: "", contato_id: "", forma_pagamento: "", status: "pendente", observacao: "" });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    let q = supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId);
    if (tipoFixo) q = q.eq("tipo", tipoFixo); else q = q.in("tipo", ["receita", "despesa"]);
    const [l, c, cat, ct, fp] = await Promise.all([
      q.order("vencimento", { ascending: true }),
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true),
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId).eq("ativo", true),
      supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_formas_pagamento").select("*").eq("workspace_id", wsId).eq("ativo", true),
    ]);
    setLancs((l.data as any[]) || []); setContas((c.data as any[]) || []);
    setCategorias((cat.data as any[]) || []); setContatos((ct.data as any[]) || []); setFormas((fp.data as any[]) || []);
    setCarregando(false);
  }, [wsId, tipoFixo]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setForm(novoForm()); setModal(true); }
  function abrirEdicao(l: any) {
    setEditando(l);
    setForm({ tipo: l.tipo, descricao: l.descricao, valor: String(l.valor ?? ""), vencimento: l.vencimento || hoje(), conta_id: l.conta_id || "", categoria_id: l.categoria_id || "", contato_id: l.contato_id || "", forma_pagamento: l.forma_pagamento || "", status: l.status || "pendente", observacao: l.observacao || "" });
    setModal(true);
  }
  async function salvar() {
    if (!wsId || !form.descricao.trim()) return;
    setSalvando(true);
    const valor = parseFloat(String(form.valor).replace(",", ".")) || 0;
    const base = { tipo: form.tipo, descricao: form.descricao.trim(), valor, vencimento: form.vencimento || null, conta_id: form.conta_id || null, categoria_id: form.categoria_id || null, contato_id: form.contato_id || null, forma_pagamento: form.forma_pagamento || null, status: form.status, pago_em: form.status === "pago" ? hoje() : null, valor_pago: form.status === "pago" ? valor : null, observacao: form.observacao.trim() || null };
    if (editando) await supabase.from("fin_lancamentos").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_lancamentos").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function alternarPago(l: any) {
    if (!wsId) return;
    const novo = l.status === "pago" ? "pendente" : "pago";
    const base = (l.tipo === "receita" ? 1 : l.tipo === "despesa" ? -1 : 0) * (l.valor || 0);
    const delta = base * (novo === "pago" ? 1 : -1);
    await supabase.from("fin_lancamentos").update({ status: novo, pago_em: novo === "pago" ? hoje() : null, valor_pago: novo === "pago" ? l.valor : null }).eq("id", l.id).eq("workspace_id", wsId);
    if (l.conta_id && delta) {
      const conta = contas.find((c) => c.id === l.conta_id);
      if (conta) await supabase.from("fin_contas").update({ saldo_atual: (conta.saldo_atual || 0) + delta }).eq("id", conta.id).eq("workspace_id", wsId);
    }
    carregar();
  }
  async function remover(l: any) {
    if (!wsId || !confirm(`Excluir "${l.descricao}"?`)) return;
    if (l.status === "pago" && l.conta_id) {
      const base = (l.tipo === "receita" ? 1 : l.tipo === "despesa" ? -1 : 0) * (l.valor || 0);
      const conta = contas.find((c) => c.id === l.conta_id);
      if (conta && base) await supabase.from("fin_contas").update({ saldo_atual: (conta.saldo_atual || 0) - base }).eq("id", conta.id).eq("workspace_id", wsId);
    }
    await supabase.from("fin_lancamentos").delete().eq("id", l.id).eq("workspace_id", wsId);
    carregar();
  }

  const statusReal = (l: any) => (l.status === "pendente" && l.vencimento && l.vencimento < hoje() ? "atrasado" : l.status);
  const noMes = lancs.filter((l) => (l.vencimento || "").slice(0, 7) === mes);
  const visiveis = noMes.filter((l) => !fStatus || statusReal(l) === fStatus);
  const somaPend = noMes.filter((l) => l.status !== "pago").reduce((s, l) => s + (l.valor || 0), 0);
  const somaPago = noMes.filter((l) => l.status === "pago").reduce((s, l) => s + (l.valor || 0), 0);
  const somaAtraso = noMes.filter((l) => statusReal(l) === "atrasado").reduce((s, l) => s + (l.valor || 0), 0);
  const catsDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const nome = (arr: any[], id: string) => arr.find((x) => x.id === id)?.nome || "";
  const STBADGE: any = { pago: { l: "Pago", c: C.green }, pendente: { l: "Pendente", c: C.amber }, atrasado: { l: "Atrasado", c: C.red }, cancelado: { l: "Cancelado", c: "#9ca3af" } };

  return (
    <Page>
      <PageHeader icone={icone} titulo={titulo} cor={corHead}
        subtitulo={modo === "todos" ? "Todas as entradas e saídas" : modo === "receber" ? "O que entra" : "O que sai"}
        acao={<Btn cor={corHead} onClick={abrirNovo}>+ Novo lançamento</Btn>} />

      <Stats>
        <Stat label={modo === "receber" ? "A receber" : modo === "pagar" ? "A pagar" : "Em aberto"} valor={brl(somaPend)} cor={C.amber} icone="🕐" />
        <Stat label={modo === "receber" ? "Recebido" : modo === "pagar" ? "Pago" : "Liquidado"} valor={brl(somaPago)} cor={C.green} icone="✅" />
        <Stat label="Atrasado" valor={brl(somaAtraso)} cor={C.red} icone="⚠️" />
      </Stats>

      <Row>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
          <option value="">Todos os status</option><option value="pendente">Pendentes</option><option value="pago">Pagos</option><option value="atrasado">Atrasados</option>
        </select>
      </Row>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : visiveis.length === 0 ? (
        <Empty icone={icone} titulo="Nenhum lançamento neste mês" sub="Troque o mês no filtro ou crie um novo lançamento." acao={<Btn cor={corHead} onClick={abrirNovo}>+ Novo lançamento</Btn>} />
      ) : (
        <Card pad={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...thStyle, width: 44 }}></th><th style={thStyle}>Descrição</th><th style={thStyle}>Vencimento</th><th style={thStyle}>Categoria</th><th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: "right" }}>Valor</th><th style={{ ...thStyle, textAlign: "right" }}>Ações</th></tr></thead>
              <tbody>
                {visiveis.map((l) => {
                  const st = STBADGE[statusReal(l)] || STBADGE.pendente; const ehReceita = l.tipo === "receita";
                  return (
                    <tr key={l.id}>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button onClick={() => alternarPago(l)} title={l.status === "pago" ? "Desmarcar" : "Marcar como pago"} style={{ width: 24, height: 24, borderRadius: 7, cursor: "pointer", border: `2px solid ${l.status === "pago" ? C.green : "#d1d5db"}`, background: l.status === "pago" ? C.green : "#fff", color: "#fff", fontSize: 13 }}>{l.status === "pago" ? "✓" : ""}</button>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{l.descricao}{l.contato_id ? <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {nome(contatos, l.contato_id)}</span> : null}</td>
                      <td style={{ ...tdStyle, color: "#6b7280" }}>{dataBR(l.vencimento)}</td>
                      <td style={{ ...tdStyle, color: "#6b7280" }}>{nome(categorias, l.categoria_id) || "—"}</td>
                      <td style={tdStyle}><Pill texto={st.l} cor={st.c} /></td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: ehReceita ? C.green : C.red }}>{ehReceita ? "+" : "-"}{brl(l.valor)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button onClick={() => abrirEdicao(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
                        <button onClick={() => remover(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <Modal titulo={`${editando ? "Editar" : "Novo"} lançamento`} cor={corHead} onClose={() => setModal(false)}
          footer={<><Btn variante="ghost" cor="#6b7280" onClick={() => setModal(false)}>Cancelar</Btn><Btn cor={corHead} onClick={salvar} disabled={salvando || !form.descricao.trim()}>{salvando ? "Salvando…" : "Salvar"}</Btn></>}>
          {!tipoFixo && (
            <Row gap={8}>
              {["receita", "despesa"].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, tipo: t, categoria_id: "" })} style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, border: form.tipo === t ? `2px solid ${t === "receita" ? C.green : C.red}` : "1px solid #e5e7eb", background: form.tipo === t ? (t === "receita" ? "#16a34a14" : "#dc262614") : "#fff", color: t === "receita" ? C.green : C.red }}>
                  {t === "receita" ? "📥 Receita" : "📤 Despesa"}
                </button>
              ))}
            </Row>
          )}
          <Row>
            <Field label="Descrição *" flex="1 1 200px"><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} /></Field>
            <Field label="Valor *" flex="0 0 140px"><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={inputStyle} placeholder="0,00" /></Field>
          </Row>
          <Row>
            <Field label="Vencimento" flex="1 1 150px"><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={inputStyle} /></Field>
            <Field label="Conta" flex="1 1 150px"><select value={form.conta_id} onChange={(e) => setForm({ ...form, conta_id: e.target.value })} style={inputStyle}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          </Row>
          <Row>
            <Field label="Categoria" flex="1 1 150px"><select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} style={inputStyle}><option value="">—</option>{catsDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label={form.tipo === "receita" ? "Cliente" : "Fornecedor"} flex="1 1 150px"><select value={form.contato_id} onChange={(e) => setForm({ ...form, contato_id: e.target.value })} style={inputStyle}><option value="">—</option>{contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          </Row>
          <Row>
            <Field label="Forma de pagamento" flex="1 1 150px"><select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} style={inputStyle}><option value="">—</option>{formas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></Field>
            <Field label="Status" flex="1 1 150px"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select></Field>
          </Row>
          <Field label="Observação"><input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={inputStyle} /></Field>
        </Modal>
      )}
    </Page>
  );
}