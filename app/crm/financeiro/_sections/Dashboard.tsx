"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Card, brl, hoje, mesAtual, dataBR, C, cardStyle } from "./_ui";

// 📊 Dashboard financeiro — visão geral (fin_contas + fin_lancamentos)
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
    .slice(0, 10);

  return (
    <Page>
      <PageHeader icone="📊" titulo="Dashboard financeiro" subtitulo="Resumo do mês e próximos vencimentos" />

      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : (
        <>
          <Stats>
            <Stat label="Saldo em contas" valor={brl(saldoTotal)} cor={saldoTotal >= 0 ? C.green : C.red} icone="🏦" />
            <Stat label="A receber" valor={brl(aReceber)} cor={C.green} icone="📥" />
            <Stat label="A pagar" valor={brl(aPagar)} cor={C.red} icone="📤" />
            <Stat label="Recebido no mês" valor={brl(recebidoMes)} cor={C.blue} icone="✅" />
            <Stat label="Pago no mês" valor={brl(pagoMes)} cor={C.amber} icone="💸" />
          </Stats>

          {atrasados.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 18px", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
              ⚠️ {atrasados.length} lançamento(s) em atraso — total {brl(atrasados.reduce((s, l) => s + (l.valor || 0), 0))}
            </div>
          )}

          <Card titulo="Próximos vencimentos" pad={0}>
            {proximos.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 14, fontStyle: "italic", padding: 20, margin: 0 }}>Nada pendente à frente.</p>
            ) : proximos.map((l, i) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 84, fontWeight: 600 }}>{dataBR(l.vencimento)}</span>
                <span style={{ flex: 1, fontSize: 14, color: "#1f2937", fontWeight: 600 }}>{l.descricao}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: l.tipo === "receita" ? C.green : C.red }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </Page>
  );
}