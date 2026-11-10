"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
// ═══════════════════════════════════════════════════════════════════════
// 🔁 CONCILIAÇÃO — casa fin_extratos (linhas do banco) com fin_lancamentos
//   ao conciliar: marca pago, liga os dois e ajusta o saldo da conta.
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" };
const COR = "#059669", G2 = "#10B981";

export default function Conciliacao() {
  const { wsId } = useWorkspace();
  const [extratos, setExtratos] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [totConc, setTotConc] = useState(0);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [e, l, c, conc] = await Promise.all([
      supabase.from("fin_extratos").select("*").eq("workspace_id", wsId).eq("conciliado", false).order("data", { ascending: true }),
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).eq("conciliado", false).in("tipo", ["receita", "despesa"]),
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId),
      supabase.from("fin_extratos").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("conciliado", true),
    ]);
    setExtratos((e.data as any[]) || []); setLancs((l.data as any[]) || []); setContas((c.data as any[]) || []);
    setTotConc((conc as any).count || 0);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const candidatos = (ex: any) => lancs.filter((l) => Math.abs((l.valor || 0) - (ex.valor || 0)) < 0.01);
  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome || "—";

  async function conciliar(ex: any) {
    if (!wsId) return;
    const lancId = sel[ex.id]; if (!lancId) return;
    const l = lancs.find((x) => x.id === lancId);
    await supabase.from("fin_extratos").update({ conciliado: true, lancamento_id: lancId }).eq("id", ex.id).eq("workspace_id", wsId);
    await supabase.from("fin_lancamentos").update({ conciliado: true, status: "pago", pago_em: ex.data, valor_pago: l?.valor }).eq("id", lancId).eq("workspace_id", wsId);
    if (l && l.conta_id && l.status !== "pago") {
      const base = (l.tipo === "receita" ? 1 : -1) * (l.valor || 0);
      const c = contas.find((x) => x.id === l.conta_id);
      if (c) await supabase.from("fin_contas").update({ saldo_atual: (c.saldo_atual || 0) + base }).eq("id", c.id).eq("workspace_id", wsId);
    }
    carregar();
  }
  async function ignorar(ex: any) {
    if (!wsId || !confirm("Marcar esta linha como conciliada sem ligar a um lançamento?")) return;
    await supabase.from("fin_extratos").update({ conciliado: true }).eq("id", ex.id).eq("workspace_id", wsId);
    carregar();
  }

  const valorPendente = extratos.reduce((s, e) => s + (e.valor || 0), 0);
  const totalLinhas = extratos.length + totConc;
  const taxa = totalLinhas ? (totConc / totalLinhas) * 100 : 0;
  const kpis = [
    { label: "A conciliar", valor: String(extratos.length), cor: COR, g2: G2, icone: "🔁" },
    { label: "Valor pendente", valor: brl(valorPendente), cor: "#C2410C", g2: "#FB923C", icone: "💰" },
    { label: "Já conciliadas", valor: String(totConc), cor: "#059669", g2: "#10B981", icone: "✅" },
    { label: "Taxa de conciliação", valor: `${taxa.toFixed(0)}%`, cor: "#047857", g2: "#34D399", icone: "📊" },
  ];

  return (
    <div style={{ padding: "4px 0 28px", display: "flex", flexDirection: "column", gap: 20, width: "100%", boxSizing: "border-box", fontFamily: "var(--font-wolf), system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div><h1 style={{ color: "#0F172A", fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-.02em" }}>Conciliação</h1><p style={{ color: "#64748B", fontSize: 14, margin: "6px 0 0" }}>Ligue cada linha do extrato ao lançamento correspondente</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${k.cor}14`, color: k.cor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "none" }}><IconeEmoji e={k.icone} tamanho={17} /></div>
              <span style={{ color: "#64748B", fontSize: 13, fontWeight: 600 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor === "#dc2626" ? "#DC2626" : "#0F172A", fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#94A3B8", fontSize: 14 }}>Carregando…</p>
        : extratos.length === 0 ? (
          <div style={{ ...card, padding: "52px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icone nome="check" tamanho={26} /></div>
            <h3 style={{ color: "#059669", fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Tudo conciliado!</h3>
            <p style={{ color: "#94A3B8", fontSize: 13, margin: 0 }}>Importe um extrato (OFX) em <b>Importar extrato</b> pra trazer novas linhas.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {extratos.map((ex) => {
              const cand = candidatos(ex); const credito = ex.tipo === "credito";
              return (
                <div key={ex.id} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: credito ? "#ECFDF5" : "#fef2f2", border: `1px solid ${credito ? "#A7F3D0" : "#fecaca"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{credito ? "📥" : "📤"}</div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{ex.descricao}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8" }}>{dataBR(ex.data)} · {nomeConta(ex.conta_id)}</div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: credito ? "#059669" : "#dc2626", minWidth: 110, textAlign: "right" }}>{credito ? "+" : "-"}{brl(ex.valor)}</div>
                  <select value={sel[ex.id] || ""} onChange={(e) => setSel((p) => ({ ...p, [ex.id]: e.target.value }))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E6ECEA", fontSize: 13, minWidth: 230, color: "#0F172A", background: "#fff" }}>
                    <option value="">{cand.length ? `Escolher lançamento (${cand.length})…` : "Sem correspondência"}</option>
                    {cand.map((l) => <option key={l.id} value={l.id}>{l.descricao} — {dataBR(l.vencimento)}</option>)}
                  </select>
                  <button onClick={() => conciliar(ex)} disabled={!sel[ex.id]} style={{ background: sel[ex.id] ? "linear-gradient(140deg, #10B981, #059669 60%, #047857)" : "#E6ECEA", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: sel[ex.id] ? "pointer" : "default", boxShadow: sel[ex.id] ? "0 4px 12px rgba(5,150,105,0.3)" : "none" }}>Conciliar</button>
                  <button onClick={() => ignorar(ex)} style={{ background: "#F3F6F5", color: "#94A3B8", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ignorar</button>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}