"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";

// 📊 Dashboard financeiro — visão geral (lê de fin_contas + fin_lancamentos)
const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);

export default function DashboardFinanceiro() {
  const { wsId } = useWorkspace();
  const [contas, setContas] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, l] = await Promise.all([
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true),
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
    ]);
    setContas((c.data as any[]) || []);
    setLancs((l.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const mes = mesAtual();
  const saldoTotal = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const aReceber = lancs.filter((l) => l.tipo === "receita" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const aPagar = lancs.filter((l) => l.tipo === "despesa" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const recebidoMes = lancs.filter((l) => l.tipo === "receita" && l.status === "pago" && (l.pago_em || "").slice(0, 7) === mes).reduce((s, l) => s + (l.valor || 0), 0);
  const pagoMes = lancs.filter((l) => l.tipo === "despesa" && l.status === "pago" && (l.pago_em || "").slice(0, 7) === mes).reduce((s, l) => s + (l.valor || 0), 0);
  const atrasados = lancs.filter((l) => l.status === "pendente" && l.vencimento && l.vencimento < hoje());

  const proximos = lancs
    .filter((l) => l.status === "pendente" && l.vencimento && l.vencimento >= hoje())
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
    .slice(0, 8);

  function Card({ label, valor, cor, icone }: any) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: `3px solid ${cor}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{icone} {label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: cor, marginTop: 6 }}>{brl(valor)}</div>
      </div>
    );
  }

  if (carregando) return <div style={{ padding: 24, color: "#9ca3af" }}>Carregando…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 26 }}>📊</span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Dashboard financeiro</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 22 }}>
        <Card label="Saldo em contas" valor={saldoTotal} cor={saldoTotal >= 0 ? "#16a34a" : "#dc2626"} icone="🏦" />
        <Card label="A receber" valor={aReceber} cor="#16a34a" icone="📥" />
        <Card label="A pagar" valor={aPagar} cor="#dc2626" icone="📤" />
        <Card label="Recebido no mês" valor={recebidoMes} cor="#2563eb" icone="✅" />
        <Card label="Pago no mês" valor={pagoMes} cor="#d97706" icone="💸" />
      </div>

      {atrasados.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 22, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
          ⚠️ {atrasados.length} lançamento(s) em atraso — total {brl(atrasados.reduce((s, l) => s + (l.valor || 0), 0))}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#111827", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 10px" }}>Próximos vencimentos</h3>
      {proximos.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic" }}>Nada pendente à frente.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          {proximos.map((l, i) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 80 }}>{(l.vencimento || "").split("-").reverse().join("/")}</span>
              <span style={{ flex: 1, fontSize: 14, color: "#111827" }}>{l.descricao}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: l.tipo === "receita" ? "#16a34a" : "#dc2626" }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}