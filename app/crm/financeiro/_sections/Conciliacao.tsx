"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// ═══════════════════════════════════════════════════════════════════════
// 🔁 CONCILIAÇÃO — casa fin_extratos (linhas do banco) com fin_lancamentos
//   ao conciliar: marca pago, liga os dois e ajusta o saldo da conta.
// ═══════════════════════════════════════════════════════════════════════
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) => (iso || "").slice(0, 10).split("-").reverse().join("/");
const card: any = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" };
const COR = "#2563eb", G2 = "#60a5fa";

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
    { label: "Valor pendente", valor: brl(valorPendente), cor: "#d97706", g2: "#f59e0b", icone: "💰" },
    { label: "Já conciliadas", valor: String(totConc), cor: "#16a34a", g2: "#22c55e", icone: "✅" },
    { label: "Taxa de conciliação", valor: `${taxa.toFixed(0)}%`, cor: "#7c3aed", g2: "#a78bfa", icone: "📊" },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22, width: "100%", boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${COR} 0%, ${G2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: `0 8px 20px ${COR}40` }}><span style={{ filter: "saturate(0) brightness(2)" }}>🔁</span></div>
        <div><h1 style={{ color: "#1f2937", fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Conciliação</h1><p style={{ color: "#6b7280", fontSize: 13, margin: "3px 0 0" }}>Ligue cada linha do extrato ao lançamento correspondente</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: 20, borderTop: `3px solid ${k.cor}`, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 24px ${k.cor}22`; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${k.cor} 0%, ${k.g2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 4px 10px ${k.cor}30` }}><span style={{ filter: "saturate(0) brightness(2)" }}>{k.icone}</span></div>
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{k.label}</span>
            </div>
            <div style={{ color: k.cor, fontSize: 25, fontWeight: 800, letterSpacing: -1 }}>{k.valor}</div>
          </div>
        ))}
      </div>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p>
        : extratos.length === 0 ? (
          <div style={{ ...card, padding: "52px 24px", textAlign: "center" }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 12px" }}>✓</div>
            <h3 style={{ color: "#16a34a", fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>Tudo conciliado!</h3>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Importe um extrato (OFX) em <b>Importar extrato</b> pra trazer novas linhas.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {extratos.map((ex) => {
              const cand = candidatos(ex); const credito = ex.tipo === "credito";
              return (
                <div key={ex.id} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: credito ? "#f0fdf4" : "#fef2f2", border: `1px solid ${credito ? "#bbf7d0" : "#fecaca"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{credito ? "📥" : "📤"}</div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>{ex.descricao}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{dataBR(ex.data)} · {nomeConta(ex.conta_id)}</div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: credito ? "#16a34a" : "#dc2626", minWidth: 110, textAlign: "right" }}>{credito ? "+" : "-"}{brl(ex.valor)}</div>
                  <select value={sel[ex.id] || ""} onChange={(e) => setSel((p) => ({ ...p, [ex.id]: e.target.value }))} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, minWidth: 230, color: "#1f2937", background: "#fff" }}>
                    <option value="">{cand.length ? `Escolher lançamento (${cand.length})…` : "Sem correspondência"}</option>
                    {cand.map((l) => <option key={l.id} value={l.id}>{l.descricao} — {dataBR(l.vencimento)}</option>)}
                  </select>
                  <button onClick={() => conciliar(ex)} disabled={!sel[ex.id]} style={{ background: sel[ex.id] ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)" : "#e5e7eb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: sel[ex.id] ? "pointer" : "default", boxShadow: sel[ex.id] ? "0 4px 12px rgba(22,163,74,0.3)" : "none" }}>✓ Conciliar</button>
                  <button onClick={() => ignorar(ex)} style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#9ca3af", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Ignorar</button>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}