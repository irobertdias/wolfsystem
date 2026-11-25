"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Stats, Stat, Card, Btn, Pill } from "../../financeiro/_sections/_ui";
import { ETAPAS_SOLAR, ETAPAS_GANHAS, etapaSolar, brl, brl0, kwpTxt } from "../../../lib/solar";
import { sol, dataBR, nomeUsuario, type PropostaSolar } from "../_dados";

const mesDe = (p: PropostaSolar) => String(p.data_proposta || p.created_at).slice(0, 7);
const ganhaEm = (p: PropostaSolar) => {
  const h = (sol(p).historico || []).find((x) => x.etapa && ETAPAS_GANHAS.includes(x.etapa));
  return String(h?.em || p.updated_at || p.created_at).slice(0, 7);
};

export default function Painel({ dados, ir }: any) {
  const { propostas, carregando, usuarios } = dados as { propostas: PropostaSolar[]; carregando: boolean; usuarios: any[] };
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  const k = useMemo(() => {
    const doMes = propostas.filter((p) => mesDe(p) === mes);
    const ganhas = propostas.filter((p) => ETAPAS_GANHAS.includes(p.status_venda || "") && ganhaEm(p) === mes);
    const abertas = propostas.filter((p) => ["LEAD", "PROPOSTA ENVIADA", "ACEITA", "VISITA TECNICA"].includes(p.status_venda || "LEAD"));
    const soma = (l: PropostaSolar[], f: (p: PropostaSolar) => number) => l.reduce((s, p) => s + (f(p) || 0), 0);
    const pelaIA = doMes.filter((p) => sol(p).canal === "whatsapp_ia").length;
    const ranking = Object.entries(ganhas.reduce((a: Record<string, { qtd: number; valor: number }>, p) => {
      const v = p.vendedor || "—"; a[v] ||= { qtd: 0, valor: 0 }; a[v].qtd++; a[v].valor += Number(p.valor_plano) || 0; return a;
    }, {})).sort((a, b) => b[1].valor - a[1].valor).slice(0, 6);
    return {
      doMes, ganhas, abertas, pelaIA, ranking,
      valorGanho: soma(ganhas, (p) => Number(p.valor_plano)),
      kwpGanho: soma(ganhas, (p) => sol(p).resultado?.kwp || 0),
      valorAberto: soma(abertas, (p) => Number(p.valor_plano)),
      conversao: doMes.length ? (propostas.filter((p) => mesDe(p) === mes && ETAPAS_GANHAS.includes(p.status_venda || "")).length / doMes.length) * 100 : 0,
    };
  }, [propostas, mes]);

  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });

  return (
    <Page>
      <PageHeader titulo="Painel de vendas solar" subtitulo="Propostas, sistemas fechados e potência vendida"
        acao={<div style={{ display: "flex", gap: 8 }}>
          <select value={mes} onChange={(e) => setMes(e.target.value)} style={{ height: 42, borderRadius: 12, border: "1px solid #E6ECEA", padding: "0 12px", fontWeight: 700, background: "#fff" }}>{meses.map((m) => <option key={m} value={m}>{m.split("-").reverse().join("/")}</option>)}</select>
          <Btn onClick={() => ir("propostas", { novo: true })}>Nova proposta</Btn>
        </div>} />
      {carregando ? <div style={{ padding: 30, color: "#94A3B8" }}>Carregando…</div> : (
        <>
          <Stats>
            <Stat label="Propostas no mês" valor={k.doMes.length} sub={k.pelaIA ? `${k.pelaIA} feitas pela IA` : "criadas no mês"} />
            <Stat label="Fechadas no mês" valor={brl0(k.valorGanho)} sub={`${k.ganhas.length} sistema(s) · ${kwpTxt(k.kwpGanho)}`} />
            <Stat label="Em negociação" valor={brl0(k.valorAberto)} sub={`${k.abertas.length} proposta(s) abertas`} />
            <Stat label="Conversão do mês" valor={`${k.conversao.toFixed(0)}%`} sub="propostas do mês que fecharam" />
          </Stats>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
            <Card titulo="Funil">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ETAPAS_SOLAR.map((e) => {
                  const l = propostas.filter((p) => (p.status_venda || "LEAD") === e.key);
                  const max = Math.max(1, ...ETAPAS_SOLAR.map((x) => propostas.filter((p) => (p.status_venda || "LEAD") === x.key).length));
                  return (
                    <button key={e.key} onClick={() => ir("propostas", { etapa: e.key })} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ display: "flex", fontSize: 13, color: "#334155", marginBottom: 4 }}><span>{e.label}</span><b style={{ marginLeft: "auto" }}>{l.length} · {brl0(l.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0))}</b></div>
                      <div style={{ height: 8, borderRadius: 99, background: "#F1F5F4" }}><div style={{ width: `${(l.length / max) * 100}%`, height: "100%", borderRadius: 99, background: e.cor }} /></div>
                    </button>
                  );
                })}
              </div>
            </Card>
            <Card titulo="Últimas propostas">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {propostas.slice(0, 8).map((p) => {
                  const r = sol(p).resultado, e = etapaSolar(p.status_venda);
                  return (
                    <button key={p.id} onClick={() => ir("propostas", { propostaId: p.id })} style={{ border: 0, borderTop: "1px solid #F1F5F4", background: "none", padding: "10px 0", cursor: "pointer", textAlign: "left", display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 13.5, color: "#0F172A" }}>{p.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{dataBR(p.created_at)} · {r ? `${kwpTxt(r.kwp)} · ${brl(r.economia_mes)}/mês` : "sem cálculo"}</div></span>
                      <Pill texto={e.curto} cor={e.cor} />
                    </button>
                  );
                })}
                {!propostas.length && <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma proposta ainda.</span>}
              </div>
            </Card>
            {k.ranking.length > 0 && (
              <Card titulo="Vendedores do mês">
                {k.ranking.map(([v, x], i) => (
                  <div key={v} style={{ display: "flex", padding: "9px 0", borderTop: i ? "1px solid #F1F5F4" : 0, fontSize: 13.5 }}><span>{i + 1}. {nomeUsuario(usuarios, v)}</span><b style={{ marginLeft: "auto" }}>{x.qtd} · {brl0(x.valor)}</b></div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
