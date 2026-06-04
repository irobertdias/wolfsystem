"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 🔁 Conciliação bancária — casa fin_extratos com fin_lancamentos
const COR = "#d97706";
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Conciliacao() {
  const { wsId } = useWorkspace();
  const [extratos, setExtratos] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [e, l] = await Promise.all([
      supabase.from("fin_extratos").select("*").eq("workspace_id", wsId).eq("conciliado", false).order("data", { ascending: true }),
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).eq("conciliado", false).in("tipo", ["receita", "despesa"]),
    ]);
    setExtratos((e.data as any[]) || []);
    setLancs((l.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  // candidatos: lançamentos com mesmo valor (tolerância 1 centavo)
  const candidatos = (ex: any) => lancs.filter((l) => Math.abs((l.valor || 0) - (ex.valor || 0)) < 0.01);

  async function conciliar(ex: any) {
    if (!wsId) return;
    const lancId = sel[ex.id];
    if (!lancId) return;
    const l = lancs.find((x) => x.id === lancId);
    await supabase.from("fin_extratos").update({ conciliado: true, lancamento_id: lancId }).eq("id", ex.id).eq("workspace_id", wsId);
    await supabase.from("fin_lancamentos").update({ conciliado: true, status: "pago", pago_em: ex.data, valor_pago: l?.valor }).eq("id", lancId).eq("workspace_id", wsId);
    // ajusta saldo da conta do lançamento (se ainda não estava pago)
    if (l && l.conta_id && l.status !== "pago") {
      const base = (l.tipo === "receita" ? 1 : -1) * (l.valor || 0);
      const { data: c } = await supabase.from("fin_contas").select("saldo_atual").eq("id", l.conta_id).eq("workspace_id", wsId).maybeSingle();
      if (c) await supabase.from("fin_contas").update({ saldo_atual: (c.saldo_atual || 0) + base }).eq("id", l.conta_id).eq("workspace_id", wsId);
    }
    carregar();
  }
  async function ignorar(ex: any) {
    if (!wsId) return;
    await supabase.from("fin_extratos").update({ conciliado: true }).eq("id", ex.id).eq("workspace_id", wsId);
    carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 26 }}>🔁</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Conciliação</h1>
      </div>
      <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>Linhas do extrato ainda não conciliadas. Ligue cada uma ao lançamento correspondente.</p>

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : extratos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "#16a34a" }}>
          <div style={{ fontSize: 40 }}>✓</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 0" }}>Tudo conciliado!</p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Importe um extrato (OFX) pra trazer novas linhas.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {extratos.map((ex) => {
            const cand = candidatos(ex);
            return (
              <div key={ex.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 78 }}>{(ex.data || "").split("-").reverse().join("/")}</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{ex.descricao}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: ex.tipo === "credito" ? "#16a34a" : "#dc2626" }}>{ex.tipo === "credito" ? "+" : "-"}{brl(ex.valor)}</div>
                </div>
                <select value={sel[ex.id] || ""} onChange={(e) => setSel((p) => ({ ...p, [ex.id]: e.target.value }))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, minWidth: 200 }}>
                  <option value="">{cand.length ? "Escolher lançamento…" : "Sem correspondência"}</option>
                  {cand.map((l) => <option key={l.id} value={l.id}>{l.descricao} — {brl(l.valor)}</option>)}
                </select>
                <button onClick={() => conciliar(ex)} disabled={!sel[ex.id]} style={{ background: sel[ex.id] ? "#16a34a" : "#e5e7eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: sel[ex.id] ? "pointer" : "default" }}>Conciliar</button>
                <button onClick={() => ignorar(ex)} style={{ background: "none", border: "1px solid #e5e7eb", color: "#9ca3af", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Ignorar</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
