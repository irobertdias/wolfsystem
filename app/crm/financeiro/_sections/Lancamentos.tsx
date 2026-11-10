"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 💰 LANÇAMENTOS — motor de fin_lancamentos
//   secKey "contas_receber" → receitas | "contas_pagar" → despesas | senão → tudo (caixa)
//   marcar pago ajusta o saldo da conta; parcelamento gera N lançamentos.
// ═══════════════════════════════════════════════════════════════════════

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00"); const dia = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ult = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ult));
  return alvo.toISOString().slice(0, 10);
}

const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
const th: any = { padding: "12px 18px", color: "#64748B", fontSize: 12, textAlign: "left",  fontWeight: 700, borderBottom: "1px solid #E6ECEA", whiteSpace: "nowrap" };
const td: any = { padding: "12px 18px", fontSize: 13.5, color: "#0F172A", borderTop: "1px solid #F1F5F4", verticalAlign: "middle" };

const ST: any = {
  pago: { l: "Pago", c: "#059669", bg: "#ECFDF5", bd: "#A7F3D0" },
  pendente: { l: "Pendente", c: "#C2410C", bg: "#fffbeb", bd: "#fde68a" },
  atrasado: { l: "Atrasado", c: "#dc2626", bg: "#fef2f2", bd: "#fecaca" },
  cancelado: { l: "Cancelado", c: "#64748B", bg: "#F1F5F4", bd: "#E6ECEA" },
};

export default function Lancamentos({ secKey }: any) {
  const { wsId } = useWorkspace();
  const modo = secKey === "contas_receber" ? "receber" : secKey === "contas_pagar" ? "pagar" : "todos";
  const tipoFixo = modo === "receber" ? "receita" : modo === "pagar" ? "despesa" : null;
  const meta = modo === "receber"
    ? { titulo: "Contas a Receber", sub: "Tudo o que entra", icone: "📥", cor: "#059669", g2: "#10B981" }
    : modo === "pagar"
      ? { titulo: "Contas a Pagar", sub: "Tudo o que sai", icone: "📤", cor: "#dc2626", g2: "#f87171" }
      : { titulo: "Lançamentos / Caixa", sub: "Entradas e saídas", icone: "💵", cor: "#059669", g2: "#10B981" };

  const [lancs, setLancs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contatos, setContatos] = useState<any[]>([]);
  const [formas, setFormas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState(mesAtual());
  const [fStatus, setFStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [salvando, setSalvando] = useState(false);

  const novoForm = () => ({ tipo: tipoFixo || "despesa", descricao: "", valor: "", vencimento: hoje(), conta_id: "", categoria_id: "", contato_id: "", forma_pagamento: "", status: "pendente", observacao: "", parcelas: "1" });

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
    setForm({ tipo: l.tipo, descricao: l.descricao, valor: String(l.valor ?? ""), vencimento: l.vencimento || hoje(), conta_id: l.conta_id || "", categoria_id: l.categoria_id || "", contato_id: l.contato_id || "", forma_pagamento: l.forma_pagamento || "", status: l.status || "pendente", observacao: l.observacao || "", parcelas: "1" });
    setModal(true);
  }
  async function salvar() {
    if (!wsId || !form.descricao.trim()) return;
    setSalvando(true);
    const valor = parseFloat(String(form.valor).replace(",", ".")) || 0;
    const comum = { tipo: form.tipo, valor, conta_id: form.conta_id || null, categoria_id: form.categoria_id || null, contato_id: form.contato_id || null, forma_pagamento: form.forma_pagamento || null, status: form.status, pago_em: form.status === "pago" ? hoje() : null, valor_pago: form.status === "pago" ? valor : null, observacao: form.observacao.trim() || null };
    if (editando) {
      await supabase.from("fin_lancamentos").update({ ...comum, descricao: form.descricao.trim(), vencimento: form.vencimento || null }).eq("id", editando.id).eq("workspace_id", wsId);
    } else {
      const n = Math.max(1, Math.min(parseInt(form.parcelas) || 1, 360));
      const rows = Array.from({ length: n }, (_, i) => ({
        ...comum, workspace_id: wsId,
        descricao: n > 1 ? `${form.descricao.trim()} (${i + 1}/${n})` : form.descricao.trim(),
        vencimento: form.vencimento ? addMonths(form.vencimento, i) : null,
        parcela: i + 1, total_parcelas: n,
      }));
      await supabase.from("fin_lancamentos").insert(rows);
    }
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
  const visiveis = noMes
    .filter((l) => !fStatus || statusReal(l) === fStatus)
    .filter((l) => !busca || (l.descricao || "").toLowerCase().includes(busca.toLowerCase().trim()));
  const somaPend = noMes.filter((l) => l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const somaPago = noMes.filter((l) => l.status === "pago").reduce((s, l) => s + (l.valor || 0), 0);
  const somaAtraso = noMes.filter((l) => statusReal(l) === "atrasado").reduce((s, l) => s + (l.valor || 0), 0);

  const catsDoTipo = categorias.filter((c) => c.tipo === form.tipo);
  const nomeDe = (arr: any[], id: string) => arr.find((x) => x.id === id)?.nome || "";

  const FILTROS = [{ k: "", l: "Todos" }, { k: "pendente", l: "Pendentes" }, { k: "pago", l: "Pagos" }, { k: "atrasado", l: "Atrasados" }];

  const kpis = [
    { label: modo === "receber" ? "A receber" : modo === "pagar" ? "A pagar" : "Em aberto", valor: brl(somaPend), cor: "#C2410C", g2: "#FB923C", icone: "🕐" },
    { label: modo === "receber" ? "Recebido" : modo === "pagar" ? "Pago" : "Liquidado", valor: brl(somaPago), cor: "#059669", g2: "#10B981", icone: "✅" },
    { label: "Atrasado", valor: brl(somaAtraso), cor: "#dc2626", g2: "#f87171", icone: "⚠️" },
    { label: "Lançamentos no mês", valor: String(noMes.length), cor: "#0F766E", g2: "#14B8A6", icone: "📋" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>{meta.titulo}</h1>
            <p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>{meta.sub} · {new Date(mes + "-01T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
        <button onClick={abrirNovo} style={{ background: `linear-gradient(140deg, ${meta.g2}, ${meta.cor})`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${meta.cor}40` }}>+ Novo lançamento</button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ ...card, padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...input, width: "auto" }} />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {FILTROS.map((f) => {
            const on = fStatus === f.k;
            return <button key={f.k} onClick={() => setFStatus(f.k)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${on ? `${meta.cor}55` : "#E6ECEA"}`, background: on ? `${meta.cor}14` : "#fff", color: on ? meta.cor : "#64748B", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>;
          })}
        </div>
        <input placeholder="Buscar descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...input, flex: 1, minWidth: 180, borderRadius: 20 }} />
      </div>

      {/* TABELA */}
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#F7FAF9" }}>
            <th style={{ ...th, width: 50, textAlign: "center" }}>✓</th>
            <th style={th}>Descrição</th><th style={th}>Vencimento</th><th style={th}>Categoria</th>
            <th style={th}>Forma</th><th style={th}>Status</th>
            <th style={{ ...th, textAlign: "right" }}>Valor</th><th style={{ ...th, textAlign: "right" }}>Ações</th>
          </tr></thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Carregando…</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 38 }}>{<IconeEmoji e={meta.icone} />}</div>
                <p style={{ color: "#0F172A", fontSize: 15, fontWeight: 700, margin: "10px 0 2px" }}>Nenhum lançamento neste mês</p>
                <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 14px" }}>Troque o mês no filtro ou crie um novo.</p>
                <button onClick={abrirNovo} style={{ background: `linear-gradient(140deg, ${meta.g2}, ${meta.cor})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Novo lançamento</button>
              </td></tr>
            ) : visiveis.map((l, i) => {
              const st = ST[statusReal(l)] || ST.pendente; const ehRec = l.tipo === "receita";
              return (
                <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7FAF9" }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => alternarPago(l)} title={l.status === "pago" ? "Desmarcar" : "Marcar como pago"} style={{ width: 26, height: 26, borderRadius: 8, cursor: "pointer", border: `2px solid ${l.status === "pago" ? "#059669" : "#CBD5E1"}`, background: l.status === "pago" ? "#059669" : "#fff", color: "#fff", fontSize: 14, lineHeight: "22px" }}>{l.status === "pago" ? "✓" : ""}</button>
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{l.descricao}{l.contato_id ? <div style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 400 }}>{nomeDe(contatos, l.contato_id)}</div> : null}</td>
                  <td style={{ ...td, color: "#64748B" }}>{dataBR(l.vencimento)}</td>
                  <td style={{ ...td, color: "#64748B" }}>{nomeDe(categorias, l.categoria_id) || "—"}</td>
                  <td style={{ ...td, color: "#64748B" }}>{l.forma_pagamento || "—"}</td>
                  <td style={td}><span style={{ background: st.bg, color: st.c, border: `1px solid ${st.bd}`, fontSize: 10.5, padding: "3px 11px", borderRadius: 20, fontWeight: 700 }}>{st.l}</span></td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: ehRec ? "#059669" : "#dc2626", whiteSpace: "nowrap" }}>{ehRec ? "+" : "-"}{brl(l.valor)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => abrirEdicao(l)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>✏️</button>
                    <button onClick={() => remover(l)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "5px 9px", fontSize: 13, cursor: "pointer", marginLeft: 5 }}><Icone nome="lixeira" tamanho={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: meta.cor, fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar lançamento" : "Novo lançamento"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>

            {!tipoFixo && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["receita", "despesa"].map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, tipo: t, categoria_id: "" })} style={{ flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13.5, border: form.tipo === t ? `2px solid ${t === "receita" ? "#059669" : "#dc2626"}` : "1px solid #E6ECEA", background: form.tipo === t ? (t === "receita" ? "#ECFDF5" : "#fef2f2") : "#fff", color: t === "receita" ? "#059669" : "#dc2626" }}>{t === "receita" ? "Receita" : "Despesa"}</button>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Descrição *</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={input} placeholder="Ex: Aluguel da loja" /></div>
              <div><label style={lbl}>Valor *</label><input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} style={input} placeholder="0,00" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Vencimento</label><input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} style={input} /></div>
              <div><label style={lbl}>Conta</label><select value={form.conta_id} onChange={(e) => setForm({ ...form, conta_id: e.target.value })} style={input}><option value="">—</option>{contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Categoria</label><select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} style={input}><option value="">—</option>{catsDoTipo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
              <div><label style={lbl}>{form.tipo === "receita" ? "Cliente" : "Fornecedor"}</label><select value={form.contato_id} onChange={(e) => setForm({ ...form, contato_id: e.target.value })} style={input}><option value="">—</option>{contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Forma de pagamento</label><select value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} style={input}><option value="">—</option>{formas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}</select></div>
              <div><label style={lbl}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select></div>
            </div>
            {!editando && (
              <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12 }}>
                <label style={lbl}>Parcelar em (nº de meses)</label>
                <input type="number" min={1} max={360} value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} style={{ ...input, maxWidth: 120 }} />
                <span style={{ fontSize: 11, color: "#92400e", marginLeft: 10 }}>{(parseInt(form.parcelas) || 1) > 1 ? `Gera ${parseInt(form.parcelas)} lançamentos mensais.` : "1 = lançamento único."}</span>
              </div>
            )}
            <div style={{ marginBottom: 20 }}><label style={lbl}>Observação</label><input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} style={input} /></div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.descricao.trim()} style={{ background: `linear-gradient(140deg, ${meta.g2}, ${meta.cor})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.descricao.trim() ? 0.6 : 1, boxShadow: `0 4px 12px ${meta.cor}40` }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}