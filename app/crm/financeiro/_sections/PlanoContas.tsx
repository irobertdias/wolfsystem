"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🏷️ PLANO DE CONTAS — categorias de receita/despesa com hierarquia,
//     valor movimentado por categoria e criação de plano padrão.
//     (fin_categorias + leitura de fin_lancamentos)
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const input: any = { width: "100%", background: "#F7FAF9", border: "1px solid #E6ECEA", borderRadius: 12, padding: "11px 14px", color: "#0F172A", fontSize: 14, fontWeight: 600, boxSizing: "border-box", outline: "none" };
const lbl: any = { color: "#64748B", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6 };
const PALETA = ["#059669", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#475569", "#ea580c", "#0d9488", "#9333ea"];

const PADRAO_DESPESA = ["Folha de Pagamento", "Aluguel", "Fornecedores", "Impostos e Taxas", "Marketing", "Despesas Operacionais", "Energia / Água / Internet"];
const PADRAO_RECEITA = ["Vendas de Produtos", "Prestação de Serviços", "Outras Receitas"];

export default function PlanoContas() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"receita" | "despesa">("despesa");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", tipo: "despesa", pai_id: "", cor: PALETA[0], ativo: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [cat, l] = await Promise.all([
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId).order("nome"),
      supabase.from("fin_lancamentos").select("categoria_id, valor, tipo, status").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
    ]);
    setLista((cat.data as any[]) || []); setLancs((l.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo(tipo: "receita" | "despesa", paiId = "") { setEditando(null); setForm({ nome: "", tipo, pai_id: paiId, cor: PALETA[Math.floor(Math.random() * PALETA.length)], ativo: true }); setModal(true); }
  function abrirEdicao(c: any) { setEditando(c); setForm({ nome: c.nome, tipo: c.tipo, pai_id: c.pai_id || "", cor: c.cor || PALETA[0], ativo: c.ativo }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.nome.trim()) return;
    setSalvando(true);
    const base = { nome: form.nome.trim(), tipo: form.tipo, pai_id: form.pai_id || null, cor: form.cor, ativo: form.ativo };
    if (editando) await supabase.from("fin_categorias").update(base).eq("id", editando.id).eq("workspace_id", wsId);
    else await supabase.from("fin_categorias").insert({ ...base, workspace_id: wsId });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(c: any) {
    if (!wsId || !confirm(`Excluir a categoria "${c.nome}"? As subcategorias e os lançamentos ligados ficam sem categoria.`)) return;
    await supabase.from("fin_categorias").delete().eq("id", c.id).eq("workspace_id", wsId);
    carregar();
  }
  async function criarPadrao() {
    if (!wsId) return;
    const existentes = lista.map((c) => `${c.tipo}|${c.nome.toLowerCase()}`);
    const novas: any[] = [];
    PADRAO_DESPESA.forEach((n, i) => { if (!existentes.includes(`despesa|${n.toLowerCase()}`)) novas.push({ workspace_id: wsId, nome: n, tipo: "despesa", cor: PALETA[i % PALETA.length], ativo: true }); });
    PADRAO_RECEITA.forEach((n, i) => { if (!existentes.includes(`receita|${n.toLowerCase()}`)) novas.push({ workspace_id: wsId, nome: n, tipo: "receita", cor: PALETA[(i + 5) % PALETA.length], ativo: true }); });
    if (novas.length) await supabase.from("fin_categorias").insert(novas);
    carregar();
  }

  // valor movimentado por categoria (inclui o próprio + filhos)
  const movDireto = (id: string) => lancs.filter((l) => l.categoria_id === id && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const doTipo = lista.filter((c) => c.tipo === aba);
  const raizes = doTipo.filter((c) => !c.pai_id);
  const filhos = (paiId: string) => doTipo.filter((c) => c.pai_id === paiId);
  const movTotal = (c: any) => movDireto(c.id) + filhos(c.id).reduce((s, f) => s + movDireto(f.id), 0);
  const totalTipo = raizes.reduce((s, c) => s + movTotal(c), 0) || 1;
  const possiveisPais = lista.filter((c) => c.tipo === form.tipo && (!editando || c.id !== editando.id) && !c.pai_id);

  const nReceitas = lista.filter((c) => c.tipo === "receita").length;
  const nDespesas = lista.filter((c) => c.tipo === "despesa").length;
  const nSubs = lista.filter((c) => c.pai_id).length;
  const corAba = aba === "receita" ? "#059669" : "#dc2626";
  const g2Aba = aba === "receita" ? "#10B981" : "#f87171";

  const kpis = [
    { label: "Total de categorias", valor: String(lista.length), cor: "#C2410C", g2: "#FB923C", icone: "🏷️" },
    { label: "Categorias de receita", valor: String(nReceitas), cor: "#059669", g2: "#10B981", icone: "📥" },
    { label: "Categorias de despesa", valor: String(nDespesas), cor: "#dc2626", g2: "#f87171", icone: "📤" },
    { label: "Subcategorias", valor: String(nSubs), cor: "#047857", g2: "#34D399", icone: "↳" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Plano de Contas</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Categorias de receita e despesa, com subcategorias e movimentação</p></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={criarPadrao} style={{ background: "#fff", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 11, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Plano padrão</button>
          <button onClick={() => abrirNovo(aba)} style={{ background: `linear-gradient(135deg, ${corAba} 0%, ${g2Aba} 100%)`, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 12px ${corAba}40` }}>+ Nova categoria</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {(["despesa", "receita"] as const).map((t) => {
          const on = aba === t; const cc = t === "receita" ? "#059669" : "#dc2626"; const qt = lista.filter((c) => c.tipo === t).length;
          return (
            <button key={t} onClick={() => setAba(t)} style={{ flex: 1, padding: "14px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 14, border: on ? `2px solid ${cc}` : "1px solid #E6ECEA", background: on ? `${cc}10` : "#fff", color: on ? cc : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {t === "receita" ? "Receitas" : "Despesas"} <span style={{ background: on ? cc : "#E6ECEA", color: on ? "#fff" : "#64748B", fontSize: 11, padding: "2px 9px", borderRadius: 20 }}>{qt}</span>
            </button>
          );
        })}
      </div>

      {carregando ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Carregando…</p>
        : raizes.length === 0 ? (
          <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><IconeEmoji e="🏷️" tamanho={24} /></div>
            <h3 style={{ color: "#0F172A", fontSize: 16, fontWeight: 700, margin: "10px 0 4px" }}>Nenhuma categoria de {aba}</h3>
            <p style={{ color: "#94A3B8", fontSize: 13, margin: "0 0 16px" }}>Crie do zero ou comece com um plano de contas padrão pronto.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={criarPadrao} style={{ background: "#fff", color: "#047857", border: "1px solid #A7F3D0", borderRadius: 10, padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Criar plano padrão</button>
              <button onClick={() => abrirNovo(aba)} style={{ background: `linear-gradient(135deg, ${corAba} 0%, ${g2Aba} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nova categoria</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(390px, 1fr))", gap: 18 }}>
            {raizes.map((c) => {
              const subs = filhos(c.id);
              const mov = movTotal(c);
              const share = (mov / totalTipo) * 100;
              return (
                <div key={c.id} style={{ ...card, overflow: "hidden", opacity: c.ativo ? 1 : 0.6 }}>
                  <div style={{ height: 5, background: c.cor || corAba }} />
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 5, background: c.cor || corAba, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{c.nome}</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{subs.length} subcategoria(s){!c.ativo ? " · inativa" : ""}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => abrirNovo(aba, c.id)} title="Subcategoria" style={{ background: "#F3F6F5", borderRadius: 8, padding: "4px 8px", fontSize: 12, cursor: "pointer", fontWeight: 700, color: "#64748B" }}>+ sub</button>
                        <button onClick={() => abrirEdicao(c)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 10, padding: "4px 8px", fontSize: 13, cursor: "pointer" }}><Icone nome="editar" tamanho={15} /></button>
                        <button onClick={() => remover(c)} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "4px 8px", fontSize: 13, cursor: "pointer" }}><Icone nome="lixeira" tamanho={15} /></button>
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, }}>Movimentado</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: corAba }}>{brl(mov)}</span>
                      </div>
                      <div style={{ height: 8, background: "#F1F5F4", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.min(share, 100)}%`, height: "100%", background: `linear-gradient(90deg, ${c.cor || corAba} 0%, ${c.cor || corAba}99 100%)`, borderRadius: 5 }} /></div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{share.toFixed(1)}% do total de {aba}s</div>
                    </div>

                    {subs.length > 0 && (
                      <div style={{ marginTop: 14, borderTop: "1px solid #F1F5F4", paddingTop: 10 }}>
                        {subs.map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
                            <span style={{ color: "#CBD5E1", fontSize: 13 }}>↳</span>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.cor || corAba }} />
                            <span style={{ flex: 1, fontSize: 13, color: "#334155", fontWeight: 600 }}>{s.nome}</span>
                            <span style={{ fontSize: 12.5, color: "#64748B", fontWeight: 700 }}>{brl(movDireto(s.id))}</span>
                            <button onClick={() => abrirEdicao(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}><Icone nome="editar" tamanho={15} /></button>
                            <button onClick={() => remover(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}><Icone nome="lixeira" tamanho={15} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, padding: 28, width: "100%", maxWidth: 470 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ color: form.tipo === "receita" ? "#059669" : "#dc2626", fontSize: 18, fontWeight: 800, margin: 0 }}>{editando ? "Editar categoria" : form.pai_id ? "↳ Nova subcategoria" : "Nova categoria"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", border: "none", color: "#64748B", cursor: "pointer", width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={16} /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["receita", "despesa"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, tipo: t, pai_id: "" })} style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, border: form.tipo === t ? `2px solid ${t === "receita" ? "#059669" : "#dc2626"}` : "1px solid #E6ECEA", background: form.tipo === t ? (t === "receita" ? "#ECFDF5" : "#fef2f2") : "#fff", color: t === "receita" ? "#059669" : "#dc2626" }}>{t === "receita" ? "Receita" : "Despesa"}</button>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={input} placeholder="Ex: Vendas de produtos" /></div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Subcategoria de (opcional)</label><select value={form.pai_id} onChange={(e) => setForm({ ...form, pai_id: e.target.value })} style={input}><option value="">— Categoria principal —</option>{possiveisPais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Cor</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PALETA.map((cor) => <button key={cor} onClick={() => setForm({ ...form, cor })} style={{ width: 30, height: 30, borderRadius: 8, background: cor, border: form.cor === cor ? "3px solid #0F172A" : "2px solid #fff", boxShadow: "0 0 0 1px #E6ECEA", cursor: "pointer" }} />)}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, cursor: "pointer", fontSize: 14, color: "#334155" }}><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #E6ECEA", paddingTop: 16 }}>
              <button onClick={() => setModal(false)} style={{ background: "#F3F6F5", color: "#334155", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim()} style={{ background: `linear-gradient(135deg, ${form.tipo === "receita" ? "#059669" : "#dc2626"} 0%, ${form.tipo === "receita" ? "#10B981" : "#f87171"} 100%)`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 26px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: salvando || !form.nome.trim() ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}