"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Card, Empty, brl, pct, hoje, C } from "./_ui";

// 📈 Indicadores financeiros
export default function Indicadores() {
  const { wsId } = useWorkspace();
  const [lancs, setLancs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [l, c] = await Promise.all([
      supabase.from("fin_lancamentos").select("*").eq("workspace_id", wsId).in("tipo", ["receita", "despesa"]),
      supabase.from("fin_categorias").select("*").eq("workspace_id", wsId),
    ]);
    setLancs((l.data as any[]) || []);
    setCats((c.data as any[]) || []);
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  const recPagas = lancs.filter((l) => l.tipo === "receita" && l.status === "pago");
  const recebido = recPagas.reduce((s, l) => s + (l.valor || 0), 0);
  const pago = lancs.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + (l.valor || 0), 0);
  const resultado = recebido - pago;
  const ticket = recPagas.length ? recebido / recPagas.length : 0;
  const margem = recebido ? (resultado / recebido) * 100 : 0;
  const aReceber = lancs.filter((l) => l.tipo === "receita" && l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + (l.valor || 0), 0);
  const atrasado = lancs.filter((l) => l.status === "pendente" && l.vencimento && l.vencimento < hoje()).reduce((s, l) => s + (l.valor || 0), 0);
  const inadimplencia = (aReceber + atrasado) ? (atrasado / (aReceber + atrasado)) * 100 : 0;

  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome || "Sem categoria";
  const desp: Record<string, number> = {};
  lancs.filter((l) => l.tipo === "despesa" && l.status === "pago").forEach((l) => { const k = l.categoria_id || "—"; desp[k] = (desp[k] || 0) + (l.valor || 0); });
  const topDesp = Object.entries(desp).map(([id, v]) => ({ nome: id === "—" ? "Sem categoria" : nomeCat(id), valor: v })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const maxDesp = topDesp[0]?.valor || 1;

  return (
    <Page>
      <PageHeader icone="📈" titulo="Indicadores" subtitulo="Saúde financeira do negócio" cor={C.purple} />
      {carregando ? <p style={{ color: "#9ca3af", fontSize: 14 }}>Carregando…</p> : (
        <>
          <Stats>
            <Stat label="Recebido (total)" valor={brl(recebido)} cor={C.green} icone="📥" />
            <Stat label="Pago (total)" valor={brl(pago)} cor={C.red} icone="📤" />
            <Stat label="Resultado" valor={brl(resultado)} cor={resultado >= 0 ? C.green : C.red} icone="📈" />
            <Stat label="Ticket médio" valor={brl(ticket)} cor={C.blue} icone="🎫" />
            <Stat label="Margem" valor={pct(margem)} cor={C.purple} icone="％" />
            <Stat label="Inadimplência" valor={pct(inadimplencia)} cor={C.amber} icone="⚠️" />
          </Stats>

          {topDesp.length === 0 ? (
            <Empty icone="📊" titulo="Sem despesas pagas ainda" sub="Os indicadores se preenchem conforme você lança e quita movimentações." />
          ) : (
            <Card titulo="Top despesas por categoria" cor={C.red}>
              {topDesp.map((d, i) => (
                <div key={i} style={{ marginBottom: i === topDesp.length - 1 ? 0 : 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: "#374151", fontWeight: 600 }}>{d.nome}</span>
                    <span style={{ color: C.red, fontWeight: 700 }}>{brl(d.valor)}</span>
                  </div>
                  <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: `${(d.valor / maxDesp) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.red} 0%, #f87171 100%)`, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}