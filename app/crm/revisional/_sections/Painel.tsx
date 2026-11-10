"use client";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Vazio, Pill, C } from "../../financeiro/_sections/_ui";
import { ETAPAS, ETAPAS_ATIVAS, etapa, rev, calcular, honorariosPrevistos, brl, dataBR, hoje } from "../_dados";

import { IconeEmoji } from "../../../components/a2/Icone";
export default function Painel({ dados, ir }: any) {
  const { contratos, cfg, carregando, erro, carregar } = dados;

  const linhas = contratos.map((c: any) => {
    const d = rev(c);
    const calc = calcular(d, c.plano, cfg);
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

  return (
    <Page>
      <PageHeader
        icone="📊"
        titulo="Painel revisional"
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
