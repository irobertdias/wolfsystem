"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Table, Card, Banner, brl, hoje, mesAtual, dataBR, C, tdStyle } from "./_ui";

// 📊 Dashboard financeiro
export default function DashboardFinanceiro() {
  const { wsId } = useWorkspace();
  const [contas, setContas] = useState<any[]>([]);
  const [lancs, setLancs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [c, l] = await Promise.all([
      supabase.from("fin_contas").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
    ]);
    setContas((c.data as any[]) || []); setLancs((l.data as any[]) || []);
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
  const proximos = lancs.filter((l) => l.status === "pendente" && l.vencimento && l.vencimento >= hoje()).sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || "")).slice(0, 8);
  const resultadoMes = recebidoMes - pagoMes;

  return (
    <Page>
      <PageHeader icone="📊" titulo="Dashboard financeiro" subtitulo={`Visão geral de ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`} />

      <Stats>
        <Stat label="Saldo em contas" valor={brl(saldoTotal)} cor={saldoTotal >= 0 ? C.green : C.red} icone="🏦" sub={`${contas.length} conta(s) ativa(s)`} />
        <Stat label="A receber" valor={brl(aReceber)} cor={C.green} icone="📥" />
        <Stat label="A pagar" valor={brl(aPagar)} cor={C.red} icone="📤" />
        <Stat label="Recebido no mês" valor={brl(recebidoMes)} cor={C.blue} icone="✅" />
        <Stat label="Resultado do mês" valor={brl(resultadoMes)} cor={resultadoMes >= 0 ? C.green : C.red} icone="📈" sub={`Pago: ${brl(pagoMes)}`} />
      </Stats>

      {atrasados.length > 0 && (
        <Banner tipo="warn"><b>{atrasados.length} lançamento(s) em atraso</b> — total {brl(atrasados.reduce((s, l) => s + (l.valor || 0), 0))}. Veja em Contas a Pagar/Receber.</Banner>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 18 }}>
        <Card titulo="Próximos vencimentos" pad={0}>
          <Table cols={[{ label: "Vencimento", width: 130 }, { label: "Descrição" }, { label: "Valor", align: "right" }]}
            empty={carregando ? <span style={{ color: "#9ca3af" }}>Carregando…</span> : proximos.length === 0 ? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Nada pendente à frente. 🎉</span> : null}>
            {proximos.map((l) => (
              <tr key={l.id}>
                <td style={{ ...tdStyle, color: "#6b7280", fontWeight: 600 }}>{dataBR(l.vencimento)}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{l.descricao}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: l.tipo === "receita" ? C.green : C.red }}>{l.tipo === "receita" ? "+" : "-"}{brl(l.valor)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card titulo="Saldo por conta">
          {carregando ? <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Carregando…</p>
            : contas.length === 0 ? <p style={{ color: "#9ca3af", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhuma conta cadastrada ainda.</p>
            : contas.map((c, i) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 13.5, color: "#374151", fontWeight: 600 }}>{c.nome}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: (c.saldo_atual || 0) >= 0 ? C.green : C.red }}>{brl(c.saldo_atual)}</span>
              </div>
            ))}
        </Card>
      </div>
    </Page>
  );
}