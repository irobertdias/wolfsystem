"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 💰 Lançamentos — motor de fin_lancamentos
//   secKey "contas_receber" → só receitas
//   secKey "contas_pagar"   → só despesas
//   secKey "caixa"/outro    → tudo (receita + despesa)
// ═══════════════════════════════════════════════════════════════════════
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const inputStyle: any = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box" };
const labelStyle: any = { fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 };

export default function Lancamentos({ secKey }: any) {
  const { wsId } = useWorkspace();
  const modo = secKey === "contas_receber" ? "receber" : secKey === "contas_pagar" ? "pagar" : "todos";
  const tipoFixo = modo === "receber" ? "receita" : modo === "pagar" ? "despesa" : null;
  const titulo = modo === "receber" ? "Contas a Receber" : modo === "pagar" ? "Contas a Pagar" : "Lançamentos / Caixa";
  const icone = modo === "receber" ? "📥" : modo === "pagar" ? "📤" : "💵";

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

  const novoForm = () => ({
    tipo: tipoFixo || "despesa", descricao: "", valor: "", vencimento: hoje(),
    conta_id: "", categoria_id: "", contato_id: "", forma_pagamento: "", status: "pendente", observacao: "",
  });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    let q = supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId);
    if (tipoFixo) q = q.eq("tipo", tipoFixo);
    else q = q.in("tipo", ["receita", "despesa"]);
    const [l, c, cat, ct, fp] = await Promise.all([
      q.order("vencimento", { ascending: true }),
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true),
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId).eq("ativo", true),
      supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_formas_pagamento").select("*").eq("workspace_id", wsId).eq("ativo", true),
    ]);
    setLancs((l.data as any[]) || []);
    setContas((c.data as any[]) || []);
    setCategorias((cat.data as any[]) || []);
    setContatos((ct.data as any[]) || []);
    setFormas((fp.data as any[]) || []);
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
    const base = {
      tipo: form.tipo, descricao: form.descricao.trim(), valor,
      vencimento: form.vencimento || null, conta_id: form.conta_id || null,
      categoria_id: form.categoria_id || null, contato_id: form.contato_id || null,
      forma_pagamento: form.forma_pagamento || null, status: form.status,
      pago_em: form.status === "pago" ? hoje() : null,
      valor_pago: form.status === "pago" ? valor : null,
      observacao: form.observacao.trim() || null,
    };
    if (editando) await supabase.from("fin_lancamentos").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_lancamentos").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }

  // marca/desmarca pago e ajusta o saldo da conta
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
    // se estava pago, reverte o saldo
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

  const STBADGE: any = {
    pago: { l: "Pago", c: "#16a34a" }, pendente: { l: "Pendente", c: "#d97706" },
    atrasado: { l: "Atrasado", c: "#dc2626" }, cancelado: { l: "Cancelado", c: "#9ca3af" },
  };

  function Kpi({ label, valor, cor }: any) {
    return (
      <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${cor}`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: cor, marginTop: 4 }}>{brl(valor)}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 26 }}>{icone}</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{titulo}</h1>
        </div>
        <button onClick={abrirNovo} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Novo lançamento</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Kpi label={modo === "receber" ? "A receber" : modo === "pagar" ? "A pagar" : "Em aberto"} valor={somaPend} cor="#d97706" />
        <Kpi label={modo === "receber" ? "Recebido" : modo === "pagar" ? "Pago" : "Liquidado"} valor={somaPago} cor="#16a34a" />
        <Kpi label="Atrasado" valor={somaAtraso} cor="#dc2626" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagos</option>
          <option value="atrasado">Atrasados</option>
        </select>
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : visiveis.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nenhum lançamento neste mês.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {visiveis.map((l, i) => {
            const st = STBADGE[statusReal(l)] || STBADGE.pendente;
            const ehReceita = l.tipo === "receita";
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                <button onClick={() => alternarPago(l)} title={l.status === "pago" ? "Desmarcar" : "Marcar como pago"}
                  style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `2px solid ${l.status === "pago" ? "#16a34a" : "#d1d5db"}`, background: l.status === "pago" ? "#16a34a" : "#fff", color: "#fff", fontSize: 13, lineHeight: "18px" }}>
                  {l.status === "pago" ? "✓" : ""}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.descricao}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>
                    {(l.vencimento || "").split("-").reverse().join("/")}
                    {l.contato_id ? ` · ${nome(contatos, l.contato_id)}` : ""}
                    {l.categoria_id ? ` · ${nome(categorias, l.categoria_id)}` : ""}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.c, background: `${st.c}14`, border: `1px solid ${st.c}44`, borderRadius: 20, padding: "3px 10px" }}>{st.l}</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: ehReceita ? "#16a34a" : "#dc2626", minWidth: 110, textAlign: "right" }}>{ehReceita ? "+" : "-"}{brl(l.valor)}</div>
                <button onClick={() => abrirEdicao(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>✏️</button>
                <button onClick={() => remover(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: "#111827" }}>{editando ? "Editar" : "Novo"} lançamento</h2>

            {!tipoFixo && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {["receita", "despesa"].map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t, categoria_id: "" })}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13,
                      border: form.tipo === t ? `2px solid ${t === "receita" ? "#16a34a" : "#dc2626"}` : "1px solid #d1d5db",
                      background: form.tipo === t ? (t === "receita" ? "#16a34a14" : "#dc262614") : "#fff",
                      color: t === "receita" ? "#16a34a" : "#dc2626" }}>
                    {t === "receita" ? "📥 Receita" : "📤 Despesa"}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Descrição *</label>
                <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>Valor *</label>
                <input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={inputStyle} placeholder="0,00" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Conta</label>
                <select value={form.conta_id} onChange={(e) => setForm({ ...form, conta_id: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Categoria</label>
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {catsDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{form.tipo === "receita" ? "Cliente" : "Fornecedor"}</label>
                <select value={form.contato_id} onChange={(e) => setForm({ ...form, contato_id: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Forma de pagamento</label>
                <select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} style={inputStyle}>
                  <option value="">—</option>
                  {formas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Observação</label>
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.descricao.trim()} style={{ background: COR, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando || !form.descricao.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}