"use client";
import { useMemo, useState } from "react";
import { ETAPAS_SOLAR, ETAPAS_GANHAS, etapaSolar, brl, brl0, kwpTxt } from "../../../lib/solar";
import { sol, dataBR, nomeUsuario, diasDesde, entrouNaEtapa, linkProposta, type PropostaSolar } from "../_dados";
import { SxTitulo, SxCard, SxKpi, SxAnel } from "./_sx";

// Central Solar: o mês em números, a meta, a "usina" dos clientes e o que fazer agora.

const mesDe = (p: PropostaSolar) => String(p.data_proposta || p.created_at).slice(0, 7);
const ganhaEm = (p: PropostaSolar) => {
  const h = (sol(p).historico || []).find((x) => x.etapa && ETAPAS_GANHAS.includes(x.etapa));
  return String(h?.em || p.updated_at || p.created_at).slice(0, 7);
};
const nomeMes = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const zap = (p: PropostaSolar, texto: string) => {
  const f = String(p.telefone1 || "").replace(/\D/g, "");
  return `https://wa.me/${f.length >= 10 ? (f.startsWith("55") ? f : "55" + f) : ""}?text=${encodeURIComponent(texto)}`;
};

type Acao = { p: PropostaSolar; ic: string; cor: string; fundo: string; titulo: string; sub: string; prio: number; texto: string; botao: string };

export default function Painel({ dados, ir }: any) {
  const { propostas, carregando, usuarios, cfg } = dados as { propostas: PropostaSolar[]; carregando: boolean; usuarios: any[]; cfg: any };
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  const k = useMemo(() => {
    const doMes = propostas.filter((p) => mesDe(p) === mes);
    const ganhas = propostas.filter((p) => ETAPAS_GANHAS.includes(p.status_venda || "") && ganhaEm(p) === mes);
    const abertas = propostas.filter((p) => ["LEAD", "PROPOSTA ENVIADA", "ACEITA", "VISITA TECNICA"].includes(p.status_venda || "LEAD"));
    const soma = (l: PropostaSolar[], f: (p: PropostaSolar) => number) => l.reduce((s, p) => s + (f(p) || 0), 0);
    const todasGanhas = propostas.filter((p) => ETAPAS_GANHAS.includes(p.status_venda || ""));
    const ligadas = propostas.filter((p) => p.status_venda === "CONCLUIDA");
    const ranking = Object.entries(ganhas.reduce((a: Record<string, { qtd: number; valor: number }>, p) => {
      const v = p.vendedor || "—"; a[v] ||= { qtd: 0, valor: 0 }; a[v].qtd++; a[v].valor += Number(p.valor_plano) || 0; return a;
    }, {})).sort((a, b) => b[1].valor - a[1].valor).slice(0, 5);
    const ultimos = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${mes}-15T12:00:00`); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
    const serie = ultimos.map((m) => ({ m, v: soma(todasGanhas.filter((p) => ganhaEm(p) === m), (p) => Number(p.valor_plano)) }));
    return {
      doMes, ganhas, abertas, ranking, serie,
      pelaIA: doMes.filter((p) => sol(p).canal === "whatsapp_ia").length,
      valorGanho: soma(ganhas, (p) => Number(p.valor_plano)),
      kwpGanho: soma(ganhas, (p) => sol(p).resultado?.kwp || 0),
      valorAberto: soma(abertas, (p) => Number(p.valor_plano)),
      conversao: doMes.length ? (doMes.filter((p) => ETAPAS_GANHAS.includes(p.status_venda || "")).length / doMes.length) * 100 : 0,
      usinaKwp: soma(todasGanhas, (p) => sol(p).resultado?.kwp || 0),
      usinaKwh: soma(todasGanhas, (p) => sol(p).resultado?.geracao_kwh || 0),
      usinaEco: soma(todasGanhas, (p) => sol(p).resultado?.economia_mes || 0),
      ligadas: ligadas.length,
    };
  }, [propostas, mes]);

  const acoes = useMemo(() => {
    const l: Acao[] = [];
    const agora = Date.now();
    for (const p of propostas) {
      const d = sol(p), st = p.status_venda || "LEAD", nome = p.nome.split(" ")[0];
      const link = linkProposta(d.token);
      if (st === "PROPOSTA ENVIADA" && !d.aceite && !d.recusa && d.token) {
        const venc = d.validade_ate ? new Date(d.validade_ate).getTime() : 0;
        if (d.visualizado_em && agora - new Date(d.visualizado_em).getTime() > 6 * 3600000 && (!venc || venc > agora)) {
          const h = Math.round((agora - new Date(d.visualizado_em).getTime()) / 3600000);
          l.push({ p, ic: "👀", cor: "#136633", fundo: "#E6F4E9", prio: 1, titulo: `${p.nome} viu a proposta e não respondeu`, sub: `aberta há ${h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`} · ${brl0(Number(p.valor_plano) || 0)}`, botao: "Chamar", texto: `Oi, ${nome}! Tudo bem? Vi que você abriu a proposta do seu sistema solar ☀️ Ficou alguma dúvida? Posso te ajudar a escolher a melhor forma de pagamento.` });
        } else if (venc && venc > agora && venc - agora < 24 * 3600000) {
          l.push({ p, ic: "⏳", cor: "#8A6314", fundo: "#FFF6DA", prio: 2, titulo: `Proposta de ${p.nome} vence hoje`, sub: `vale até ${new Date(venc).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${brl0(Number(p.valor_plano) || 0)}`, botao: "Avisar", texto: `Oi, ${nome}! Passando para lembrar que a condição da sua proposta solar vale só até hoje ☀️ Quer garantir? ${link}` });
        } else if (venc && venc < agora && agora - venc < 7 * 86400000) {
          l.push({ p, ic: "↻", cor: "#B45309", fundo: "#FFF1E6", prio: 3, titulo: `Link de ${p.nome} expirou sem resposta`, sub: "renove a proposta e chame de novo", botao: "Abrir", texto: "" });
        } else if (!d.visualizado_em && d.enviada_em && diasDesde(d.enviada_em) >= 2) {
          l.push({ p, ic: "✉", cor: "#1D4ED8", fundo: "#EAF0FF", prio: 4, titulo: `${p.nome} ainda não abriu a proposta`, sub: `enviada há ${diasDesde(d.enviada_em)} dias`, botao: "Chamar", texto: `Oi, ${nome}! Te mandei a proposta do seu sistema de energia solar ☀️ Conseguiu ver? Aqui está o link: ${link}` });
        }
      }
      if (st === "ACEITA" && diasDesde(entrouNaEtapa(p)) >= 1 && !d.visita?.data) {
        l.push({ p, ic: "📅", cor: "#6D28D9", fundo: "#F1EBFF", prio: 0, titulo: `Agendar visita técnica de ${p.nome}`, sub: `aceita há ${diasDesde(entrouNaEtapa(p))} dia(s) · ${brl0(Number(p.valor_plano) || 0)}`, botao: "Agendar", texto: `Oi, ${nome}! Parabéns pela decisão ☀️ Vamos agendar a visita técnica? Qual o melhor dia e horário para você?` });
      }
      const parada = diasDesde(entrouNaEtapa(p));
      const limite: Record<string, number> = { VISITA_TECNICA: 5, CONTRATO: 7, HOMOLOGACAO: 40, INSTALACAO: 10 };
      const lim = limite[st.replace(" ", "_")];
      if (lim && parada > lim) l.push({ p, ic: "⚠", cor: "#B91C1C", fundo: "#FDECEC", prio: 2, titulo: `${p.nome} parado em ${etapaSolar(st).curto.toLowerCase()}`, sub: `${parada} dias nesta etapa`, botao: "Ver obra", texto: "" });
    }
    return l.sort((a, b) => a.prio - b.prio).slice(0, 8);
  }, [propostas]);

  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
  const meta = Number(cfg?.meta_mes) || 0;
  const maxSerie = Math.max(1, ...k.serie.map((s) => s.v));
  const hora = new Date().getHours();
  const saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  if (carregando) return <div style={{ padding: 30, color: "#94A3B8" }}>Carregando…</div>;

  return (
    <div className="sx-grid">
      <SxTitulo titulo={`${saud}! Vamos vender sol ☀️`} sub="O mês em números, o que está pendente e quem precisa de um toque hoje"
        acao={<select className="sx-input" value={mes} onChange={(e) => setMes(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{m.split("-").reverse().join("/")}</option>)}</select>} />

      <div className="sx-grid sx-g4">
        <SxKpi destaque="verde" rotulo="Fechado no mês" valor={brl0(k.valorGanho)} sub={`${k.ganhas.length} sistema(s) · ${kwpTxt(k.kwpGanho)}`} icone="✓" />
        <SxKpi rotulo="Propostas no mês" valor={k.doMes.length} sub={k.pelaIA ? `${k.pelaIA} feitas pela Vendedora IA` : "criadas no mês"} icone="☀" />
        <SxKpi rotulo="Em negociação" valor={brl0(k.valorAberto)} sub={`${k.abertas.length} proposta(s) abertas`} icone="⇄" />
        <SxKpi destaque="ouro" rotulo="Conversão" valor={`${k.conversao.toFixed(0)}%`} sub="das propostas do mês fecharam" icone="%" />
      </div>

      <div className="sx-grid sx-g2">
        <SxCard escuro titulo={meta ? "Meta do mês" : "Vendas dos últimos meses"}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            {meta > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <SxAnel pct={(k.valorGanho / meta) * 100} tamanho={132} rotulo="da meta" />
                <span style={{ fontSize: 12, opacity: .8 }}>{brl0(k.valorGanho)} de {brl0(meta)}</span>
              </div>
            )}
            <svg viewBox="0 0 300 150" style={{ flex: "1 1 260px", minWidth: 0, height: 150 }} aria-label="Vendas fechadas por mês">
              <defs><linearGradient id="sxBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6D77A" /><stop offset="1" stopColor="#E3B547" stopOpacity=".55" /></linearGradient></defs>
              {k.serie.map((s, i) => {
                const h = (s.v / maxSerie) * 100, x = 10 + i * 48;
                return (
                  <g key={s.m}>
                    <rect x={x} y={8} width="32" height="100" rx="8" fill="rgba(255,255,255,.07)" />
                    <rect x={x} y={108 - h} width="32" height={Math.max(h, 2)} rx="8" fill={s.m === mes ? "url(#sxBar)" : "rgba(246,215,122,.45)"} />
                    <text x={x + 16} y={126} textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,.75)" fontWeight="700">{nomeMes(s.m)}</text>
                    <text x={x + 16} y={142} textAnchor="middle" fontSize="9" fill="rgba(255,243,196,.8)">{s.v ? `${Math.round(s.v / 1000)}k` : "–"}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {!meta && <div style={{ fontSize: 12, opacity: .7, marginTop: 6 }}>Defina a meta do mês em "Kit, preços e ajustes" para acompanhar aqui.</div>}
        </SxCard>

        <SxCard titulo="A usina dos seus clientes">
          <div className="sx-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["⚡", kwpTxt(k.usinaKwp), "de potência vendida"],
              ["☀", `${k.usinaKwh.toLocaleString("pt-BR")} kWh`, "gerados por mês"],
              ["💰", brl0(k.usinaEco), "de economia por mês para os clientes"],
              ["🌳", `${((k.usinaKwh * 12 * 0.0817) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`, "de CO₂ evitadas por ano"],
            ].map(([ic, v, s]) => (
              <div key={s} style={{ borderRadius: 16, padding: "12px 14px", background: "linear-gradient(140deg,#F4F8F0,#EEF6F1)", border: "1px solid #E1EDE3" }}>
                <div style={{ fontSize: 18 }}>{ic}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: "#0B3324", marginTop: 4 }}>{v}</div>
                <div style={{ fontSize: 11.5, color: "#5B6B63" }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#6B7B73", marginTop: 10 }}>{k.ligadas} sistema(s) já ligados · soma de todos os projetos fechados.</div>
        </SxCard>
      </div>

      <div className="sx-grid sx-g2">
        <SxCard titulo={`Faça agora${acoes.length ? ` · ${acoes.length}` : ""}`}>
          {!acoes.length ? (
            <div style={{ padding: "18px 4px", fontSize: 13.5, color: "#5B6B63" }}>Tudo em dia por aqui. ✨ Quando um cliente abrir a proposta e não responder, ou uma obra ficar parada, aparece aqui.</div>
          ) : acoes.map((a, i) => (
            <div key={`${a.p.id}-${i}`} className="sx-acao">
              <span className="sx-acao-ic" style={{ background: a.fundo, color: a.cor }}>{a.ic}</span>
              <button className="sx-acao-txt" onClick={() => ir(a.botao === "Ver obra" ? "obras" : "propostas", { propostaId: a.p.id })} style={{ border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                <b>{a.titulo}</b><span>{a.sub}</span>
              </button>
              {a.texto && a.p.telefone1
                ? <a className="sx-mini" href={zap(a.p, a.texto)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{a.botao}</a>
                : <button className="sx-mini" onClick={() => ir(a.botao === "Ver obra" ? "obras" : "propostas", { propostaId: a.p.id })}>{a.botao === "Chamar" || a.botao === "Avisar" || a.botao === "Agendar" ? "Abrir" : a.botao}</button>}
            </div>
          ))}
        </SxCard>

        <SxCard titulo="Funil" acao={<button className="sx-mini" onClick={() => ir("propostas")}>Ver quadro</button>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {ETAPAS_SOLAR.map((e) => {
              const l = propostas.filter((p) => (p.status_venda || "LEAD") === e.key);
              const max = Math.max(1, ...ETAPAS_SOLAR.map((x) => propostas.filter((p) => (p.status_venda || "LEAD") === x.key).length));
              return (
                <button key={e.key} onClick={() => ir("propostas", { etapa: e.key })} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", fontSize: 12.5, color: "#33453C", marginBottom: 4 }}><span>{e.label}</span><b style={{ marginLeft: "auto" }}>{l.length} · {brl0(l.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0))}</b></div>
                  <div style={{ height: 9, borderRadius: 99, background: "#F0F3EB" }}><div style={{ width: `${Math.max(l.length ? 4 : 0, (l.length / max) * 100)}%`, height: "100%", borderRadius: 99, background: e.cor }} /></div>
                </button>
              );
            })}
          </div>
        </SxCard>
      </div>

      <div className="sx-grid sx-g2">
        <SxCard titulo="Últimas propostas" acao={<button className="sx-mini" onClick={() => ir("propostas", { novo: true })}>+ Nova</button>}>
          {propostas.slice(0, 7).map((p) => {
            const r = sol(p).resultado, e = etapaSolar(p.status_venda);
            return (
              <button key={p.id} className="sx-acao" onClick={() => ir("propostas", { propostaId: p.id })} style={{ width: "100%", border: 0, borderTop: "1px solid #F0F2EA", background: "none", cursor: "pointer", textAlign: "left" }}>
                <span className="sx-acao-ic" style={{ background: "#F0FAF2", color: "#17803C", fontWeight: 900 }}>{(p.nome || "?").slice(0, 1).toUpperCase()}</span>
                <span className="sx-acao-txt"><b>{p.nome}</b><span>{dataBR(p.created_at)} · {r ? `${kwpTxt(r.kwp)} · ${brl(r.economia_mes)}/mês` : "sem cálculo"}{sol(p).canal === "whatsapp_ia" ? " · pela IA" : ""}</span></span>
                <span className="sx-tag" style={{ background: `${e.cor}1A`, color: e.cor }}>{e.curto}</span>
              </button>
            );
          })}
          {!propostas.length && <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma proposta ainda. Crie a primeira ou ligue a Vendedora IA.</span>}
        </SxCard>
        <SxCard titulo="Vendedores do mês">
          {!k.ranking.length ? <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma venda fechada neste mês ainda.</span> : k.ranking.map(([v, x], i) => (
            <div key={v} className="sx-acao">
              <span className="sx-acao-ic" style={{ background: i === 0 ? "linear-gradient(135deg,#FFF3C4,#E3B547)" : "#F1F4EC", color: i === 0 ? "#3A2600" : "#136633", fontWeight: 900 }}>{i + 1}º</span>
              <span className="sx-acao-txt"><b>{nomeUsuario(usuarios, v)}</b><span>{x.qtd} sistema(s)</span></span>
              <b style={{ color: "#0F4A30" }}>{brl0(x.valor)}</b>
            </div>
          ))}
        </SxCard>
      </div>
    </div>
  );
}
