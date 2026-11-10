"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Vazio, Pill, C } from "../../financeiro/_sections/_ui";
import { ETAPAS, ETAPAS_ATIVAS, etapa, rev, calcular, honorariosPrevistos, beneficioDoContrato, brl, dataBR, hoje, num } from "../_dados";

import Icone, { IconeEmoji } from "../../../components/a2/Icone";
export default function Painel({ dados, ir }: any) {
  const { wsId, contratos, cfg, carregando, erro, carregar } = dados;

  // Propostas da Análise contratual (conversão e aceitas sem contrato)
  const [propostas, setPropostas] = useState<any[] | null>(null);
  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`/api/revisional/propostas?workspace=${encodeURIComponent(wsId)}`, { headers: { Authorization: `Bearer ${session?.access_token || ""}` } }).catch(() => null);
      const j = r && r.ok ? await r.json() : null;
      setPropostas(j?.propostas || []);
    })();
  }, [wsId]);
  const mesAtual = new Date().toISOString().slice(0, 7);
  const propMes = (propostas || []).filter((p) => String(p.created_at).slice(0, 7) === mesAtual);
  const aceitasMes = propMes.filter((p) => p.status === "aceita").length;
  const conversao = propMes.length ? Math.round((aceitasMes / propMes.length) * 100) : 0;
  const aguardandoContrato = (propostas || []).filter((p) => p.status === "aceita" && !p.dados?.contrato_gerado);

  const linhas = contratos.map((c: any) => {
    const d = rev(c);
    const calc0 = calcular(d, c.plano, cfg);
    const calc = { ...calc0, beneficio: beneficioDoContrato(c, calc0) };
    const hon = honorariosPrevistos(d, calc, cfg);
    const parcelas = d.honorarios_parcelas || [];
    return { c, d, calc, hon, parcelas };
  });

  const ativos = linhas.filter((l: any) => ETAPAS_ATIVAS.includes(l.c.status_venda || "NOVO"));
  const beneficio = ativos.reduce((s: number, l: any) => s + l.calc.beneficio, 0);
  const abusivos = ativos.filter((l: any) => l.calc.abusiva).length;
  const ajuizados = linhas.filter((l: any) => l.c.status_venda === "AJUIZADO").length;
  const todasParcelas = linhas.flatMap((l: any) => l.parcelas.map((p: any) => ({ ...p, contrato: l.c })));
  const recebido = todasParcelas.filter((p: any) => p.pago_em).reduce((s: number, p: any) => s + (p.valor || 0), 0);
  const aReceber = todasParcelas.filter((p: any) => !p.pago_em).reduce((s: number, p: any) => s + (p.valor || 0), 0);
  const atrasadas = todasParcelas.filter((p: any) => !p.pago_em && p.vencimento < hoje());
  const exitoPrevisto = ativos.reduce((s: number, l: any) => s + l.hon.exito, 0);
  const ganhos = linhas.filter((l: any) => l.c.status_venda === "GANHO").length;
  const encerrados = linhas.filter((l: any) => l.c.status_venda === "PERDIDO").length;
  const taxaExito = ganhos + encerrados ? (ganhos / (ganhos + encerrados)) * 100 : 0;

  const porEtapa = ETAPAS.map((e) => ({ ...e, qtd: linhas.filter((l: any) => (l.c.status_venda || "NOVO") === e.key).length }));
  const maxEtapa = Math.max(...porEtapa.map((e) => e.qtd), 1);

  const bancosAgg: Record<string, { qtd: number; beneficio: number }> = {};
  ativos.forEach((l: any) => {
    const b = (l.c.operadora || "Sem banco").trim() || "Sem banco";
    bancosAgg[b] = bancosAgg[b] || { qtd: 0, beneficio: 0 };
    bancosAgg[b].qtd++; bancosAgg[b].beneficio += l.calc.beneficio;
  });
  const bancos = Object.entries(bancosAgg).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  const maxBanco = bancos[0]?.qtd || 1;

  const proximas = todasParcelas.filter((p: any) => !p.pago_em).sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
  const recentes = linhas.slice(0, 6);

  // Indicadores financeiros
  const beneficioGerado = linhas.filter((l: any) => l.c.status_venda === "GANHO").reduce((s: number, l: any) => s + l.calc.beneficio, 0);
  const valorRevisado = linhas.reduce((s: number, l: any) => s + num(l.d.valor_financiado), 0);
  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k); return d.toISOString().slice(0, 7); });
  const porMes = meses.map((m) => ({ m, valor: todasParcelas.filter((p: any) => !p.pago_em && String(p.vencimento).slice(0, 7) === m).reduce((s: number, p: any) => s + (p.valor || 0), 0) }));
  const maxMes = Math.max(...porMes.map((x) => x.valor), 1);
  const duracoes = linhas.filter((l: any) => l.c.status_venda === "GANHO").map((l: any) => {
    const h = (l.d.historico || []).find((x: any) => x.etapa === "GANHO");
    return h ? (new Date(h.em).getTime() - new Date(l.c.created_at).getTime()) / 86400_000 : null;
  }).filter((x: any) => x !== null && x >= 0) as number[];
  const tempoMedio = duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null;

  return (
    <Page>
      <PageHeader
        icone="📊"
        titulo="Painel financeiro"
        subtitulo={`Contratos, cálculos e honorários · ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={carregar}>Atualizar</Btn><Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn></div>}
      />

      {erro && <Banner tipo="warn">Não foi possível carregar os contratos: {erro}</Banner>}
      {atrasadas.length > 0 && (
        <Banner tipo="warn">
          <b>{atrasadas.length} parcela(s) de honorários em atraso</b> somando {brl(atrasadas.reduce((s: number, p: any) => s + p.valor, 0))}.{" "}
          <a onClick={() => ir("honorarios")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Ver honorários</a>
        </Banner>
      )}

      {aguardandoContrato.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FFFBEB", boxShadow: "inset 0 0 0 1.5px #FDE68A", borderRadius: 16, padding: "12px 16px" }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="check" tamanho={16} espessura={2.4} /></span>
          <span style={{ flex: 1, minWidth: 220, fontSize: 14, color: "#78350F" }}>
            <b>{aguardandoContrato.length} proposta(s) aceita(s)</b> esperando o contrato: {aguardandoContrato.slice(0, 3).map((p) => p.cliente_nome).join(", ")}{aguardandoContrato.length > 3 ? "…" : ""}
          </span>
          <a href={`/crm/contratos?revisional=${aguardandoContrato[0].id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 14px", borderRadius: 12, background: "linear-gradient(140deg, #10B981, #059669 60%, #047857)", color: "#fff", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}><Icone nome="documento" tamanho={15} /> Gerar contrato de {aguardandoContrato[0].cliente_nome.split(" ")[0]}</a>
        </div>
      )}

      {/* Destaque + conversão */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div style={{ gridColumn: "span 2", minWidth: 0, borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, #10B981 0%, #059669 42%, #065F46 100%)", boxShadow: "0 22px 44px -24px rgba(6,95,70,.8)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Benefício gerado para os clientes</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{carregando ? "…" : brl(beneficioGerado)}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.82)" }}>
            nos contratos concluídos com êxito · {brl(valorRevisado)} em contratos revisados{tempoMedio !== null ? ` · ${tempoMedio} dias em média até o êxito` : ""}
          </span>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Propostas no mês</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#0F172A" }}>{propostas === null ? "…" : `${aceitasMes} de ${propMes.length}`}</span>
          <span style={{ height: 6, borderRadius: 99, background: "#EEF2F1", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${conversao}%`, background: "#10B981" }} /></span>
          <span style={{ fontSize: 12.5, color: "#94A3B8" }}>{conversao}% aceitas pelo cliente</span>
        </div>
      </div>

      <Stats>
        <Stat label="Contratos em andamento" valor={carregando ? "…" : ativos.length} icone="📑" cor={C.blue} sub={`${linhas.length} no total`} />
        <Stat label="Benefício estimado" valor={carregando ? "…" : brl(beneficio)} icone="💎" cor={C.green} sub="economia + valores a restituir" />
        <Stat label="Taxas acima da média" valor={carregando ? "…" : abusivos} icone="🚩" cor={C.red} sub={`${cfg.fator_abusividade}× ou mais a taxa média`} />
        <Stat label="Ações ajuizadas" valor={carregando ? "…" : ajuizados} icone="⚖️" cor={C.amber} sub={`êxito ${taxaExito.toFixed(0)}% dos encerrados`} />
      </Stats>
      <Stats>
        <Stat label="Honorários recebidos" valor={carregando ? "…" : brl(recebido)} icone="✅" cor={C.green} sub="parcelas pagas" />
        <Stat label="Honorários a receber" valor={carregando ? "…" : brl(aReceber)} icone="📥" cor={C.blue} sub="parcelas em aberto" />
        <Stat label="Êxito previsto" valor={carregando ? "…" : brl(exitoPrevisto)} icone="🎯" cor={C.purple} sub="% sobre o benefício estimado" />
      </Stats>

      <Card titulo="Honorários a receber nos próximos 6 meses" acao={<Btn variante="ghost" onClick={() => ir("honorarios")}>Ver honorários</Btn>}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 170, paddingTop: 10 }}>
          {porMes.map((x) => (
            <div key={x.m} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>{x.valor ? brl(x.valor).replace(",00", "") : ""}</span>
              <div title={brl(x.valor)} style={{ width: "70%", maxWidth: 56, height: `${Math.max((x.valor / maxMes) * 100, x.valor ? 6 : 2)}%`, background: x.valor ? "linear-gradient(180deg, #34D399, #059669)" : "#EEF2F1", borderRadius: "8px 8px 4px 4px" }} />
              <span style={{ fontSize: 12, color: "#64748B", textTransform: "capitalize" }}>{new Date(x.m + "-15").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card titulo="Contratos por etapa" acao={<Btn variante="ghost" onClick={() => ir("andamento")}>Abrir andamento</Btn>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {porEtapa.map((e) => (
              <button key={e.key} onClick={() => ir("andamento", { etapa: e.key })} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 4 }}>
                  <span>{<IconeEmoji e={e.icone} />} {e.label}</span><b style={{ color: e.cor }}>{e.qtd}</b>
                </div>
                <div style={{ height: 8, background: "#F1F5F4", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${(e.qtd / maxEtapa) * 100}%`, height: "100%", background: e.cor, borderRadius: 6, transition: "width .3s" }} />
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card titulo="Bancos e financeiras">
          {bancos.length === 0 ? <Vazio icone="🏦" titulo="Sem contratos em andamento" sub="Cadastre o primeiro contrato para ver os bancos aqui." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bancos.map((b) => (
                <div key={b.nome}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 4 }}>
                    <span>{b.nome}</span><span><b>{b.qtd}</b> · <span style={{ color: C.green }}>{brl(b.beneficio)}</span></span>
                  </div>
                  <div style={{ height: 8, background: "#F1F5F4", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${(b.qtd / maxBanco) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.amber}, #fbbf24)`, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card titulo="Próximos honorários" acao={<Btn variante="ghost" onClick={() => ir("honorarios")}>Ver todos</Btn>}>
          {proximas.length === 0 ? <Vazio icone="💰" titulo="Nenhuma parcela em aberto" sub="As parcelas aparecem quando você gera os honorários no contrato." /> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {proximas.map((p: any, k: number) => {
                const atraso = p.vencimento < hoje();
                return (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: k ? "1px solid #F1F5F4" : "none", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.contrato.nome}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>Parcela {p.n} · vence {dataBR(p.vencimento)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: atraso ? C.red : "#0F172A" }}>{brl(p.valor)}</div>
                      {atraso && <Pill texto="Atrasada" cor={C.red} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card titulo="Últimos contratos" acao={<Btn variante="ghost" onClick={() => ir("contratos")}>Ver contratos</Btn>}>
          {recentes.length === 0 ? (
            <Vazio icone="📑" titulo="Nenhum contrato ainda" sub="Cadastre o contrato do cliente para calcular a revisão." acao={<Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentes.map((l: any, k: number) => {
                const e = etapa(l.c.status_venda);
                return (
                  <button key={l.c.id} onClick={() => ir("contratos", { contratoId: l.c.id })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", gap: 10, background: "none", borderLeft: 0, borderRight: 0, borderBottom: 0, borderTop: k ? "1px solid #F1F5F4" : "0", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{l.c.nome}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>{l.c.operadora || "Sem banco"} · {l.calc.valido ? `benefício ${brl(l.calc.beneficio)}` : "cálculo pendente"}</div>
                    </div>
                    <Pill texto={`${e.icone} ${e.label}`} cor={e.cor} />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
