"use client";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Vazio, Pill } from "../_ui";
import { ETAPAS, ETAPAS_ANDAMENTO, etapa, produto, brl, dataBR, mesDe, valorLiberado, valorBruto, comissaoValor, cons, nomeUsuario, type Contrato } from "../_dados";

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

function Barras({ itens, formato }: { itens: { nome: string; valor: number; extra?: string; cor?: string }[]; formato: (n: number) => string }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  if (!itens.length) return <div style={{ color: "var(--k-mut)", fontSize: 13, padding: "10px 0" }}>Sem dados ainda.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {itens.map((i) => (
        <div key={i.nome} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", fontSize: 13 }}>
            <span style={{ color: "var(--k-txt2)", fontWeight: 700 }}>{i.nome}</span>
            <span style={{ marginLeft: "auto", color: "var(--k-tinta)", fontWeight: 800 }}>{formato(i.valor)}{i.extra ? <span style={{ color: "var(--k-mut)", fontWeight: 600 }}> · {i.extra}</span> : null}</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: "var(--k-borda)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(i.valor / max) * 100}%`, background: i.cor || "linear-gradient(90deg, var(--w-400), var(--w-600))", borderRadius: 99 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Painel({ dados, ir }: any) {
  const { contratos, cfg, usuarios, carregando, erro, carregar } = dados as { contratos: Contrato[]; cfg: any; usuarios: any[]; carregando: boolean; erro: string; carregar: () => void };
  const mes = new Date().toISOString().slice(0, 7);
  const pagos = contratos.filter((c) => c.status_venda === "PAGO");
  const pagosMes = pagos.filter((c) => mesDe(c) === mes);
  const andamento = contratos.filter((c) => ETAPAS_ANDAMENTO.includes(c.status_venda || "SIMULACAO"));
  const liberadoMes = pagosMes.reduce((s, c) => s + valorLiberado(c), 0);
  const brutoMes = pagosMes.reduce((s, c) => s + valorBruto(c), 0);
  const emAndamento = andamento.reduce((s, c) => s + valorLiberado(c), 0);
  const comissaoMes = pagosMes.reduce((s, c) => s + comissaoValor(c, cfg), 0);
  const comissaoAndamento = andamento.reduce((s, c) => s + comissaoValor(c, cfg), 0);
  const aReceber = pagos.filter((c) => !cons(c).comissao_recebida_em).reduce((s, c) => s + comissaoValor(c, cfg), 0);
  const ticket = pagosMes.length ? liberadoMes / pagosMes.length : 0;
  const encerrados = contratos.filter((c) => ["PAGO", "REPROVADA", "CANCELADA"].includes(c.status_venda || "")).length;
  const aprovacao = encerrados ? Math.round((pagos.length / encerrados) * 100) : 0;
  const paradosAverbacao = contratos.filter((c) => c.status_venda === "AGUARDANDO AVERBACAO" && Date.now() - new Date(c.updated_at || c.created_at).getTime() > 5 * 86400_000);

  const porEtapa = ETAPAS.map((e) => {
    const l = contratos.filter((c) => (c.status_venda || "SIMULACAO") === e.key);
    return { nome: `${e.icone} ${e.label}`, valor: l.length, extra: brl(l.reduce((s, c) => s + valorLiberado(c), 0)), cor: e.cor };
  }).filter((e) => e.valor > 0);

  const agrupar = (lista: Contrato[], chave: (c: Contrato) => string) => {
    const g: Record<string, { valor: number; qtd: number }> = {};
    lista.forEach((c) => { const k = chave(c) || "—"; g[k] = g[k] || { valor: 0, qtd: 0 }; g[k].valor += valorLiberado(c); g[k].qtd++; });
    return Object.entries(g).map(([nome, v]) => ({ nome, valor: v.valor, extra: `${v.qtd} contrato${v.qtd > 1 ? "s" : ""}` })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  };
  const porBanco = agrupar(pagosMes.length ? pagosMes : pagos, (c) => (c.operadora || "Sem banco").trim());
  const porProduto = agrupar(pagosMes.length ? pagosMes : pagos, (c) => produto(c.plano));
  const ranking = agrupar(pagosMes, (c) => nomeUsuario(usuarios, c.vendedor));

  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + k); return d.toISOString().slice(0, 7); });
  const porMes = meses.map((m) => ({ m, valor: pagos.filter((c) => mesDe(c) === m).reduce((s, c) => s + valorLiberado(c), 0) }));
  const maxMes = Math.max(...porMes.map((x) => x.valor), 1);

  return (
    <Page>
      <PageHeader
        titulo="Painel de produção"
        subtitulo={`Contratos de crédito consignado · ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={carregar}>Atualizar</Btn><Btn onClick={() => ir("simulador")}>Simular margem</Btn><Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn></div>}
      />
      {erro && <Banner tipo="warn">Não foi possível carregar os contratos: {erro}</Banner>}
      {paradosAverbacao.length > 0 && (
        <Banner tipo="warn"><b>{paradosAverbacao.length} contrato(s) aguardando averbação há mais de 5 dias.</b>{" "}
          <a onClick={() => ir("esteira")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Ver na esteira</a></Banner>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="hero-nicho" style={{ gridColumn: "span 2", minWidth: 0, borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, var(--w-500) 0%, var(--w-600) 42%, var(--w-800) 100%)", boxShadow: "0 22px 44px -24px rgba(15,23,42,.55)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Valor liberado aos clientes no mês</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{carregando ? "…" : brl(liberadoMes)}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>{pagosMes.length} contrato(s) pago(s) · produção bruta {brl(brutoMes)} · ticket médio {brl(ticket)}</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, border: "1px solid var(--k-borda)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--k-sub)" }}>Taxa de aprovação</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "var(--k-tinta)" }}>{aprovacao}%</span>
          <span style={{ height: 6, borderRadius: 99, background: "var(--k-borda)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${aprovacao}%`, background: "var(--w-500)" }} /></span>
          <span style={{ fontSize: 12.5, color: "var(--k-mut)" }}>{pagos.length} pagos de {encerrados} finalizados</span>
        </div>
      </div>

      <Stats>
        <Stat label="Em andamento" icone="⏳" valor={brl(emAndamento)} sub={`${andamento.length} contrato(s) na esteira`} />
        <Stat label="Comissão do mês" icone="💰" valor={brl(comissaoMes)} sub="contratos pagos no mês" />
        <Stat label="Comissão prevista" icone="📈" valor={brl(comissaoAndamento)} sub="se a esteira atual for paga" />
        <Stat label="Comissão a receber" icone="🧾" valor={brl(aReceber)} sub="pagos sem baixa da comissão" cor="#C2410C" />
      </Stats>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card titulo="Esteira por etapa" acao={<Btn variante="ghost" onClick={() => ir("esteira")}>Abrir esteira</Btn>}>
          <Barras itens={porEtapa} formato={(n) => `${n}`} />
        </Card>
        <Card titulo="Produção dos últimos 6 meses">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, paddingTop: 10 }}>
            {porMes.map((x) => (
              <div key={x.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 11, color: "var(--k-sub)", fontWeight: 700 }}>{x.valor ? brl(x.valor).replace(",00", "") : ""}</span>
                <div title={brl(x.valor)} style={{ width: "100%", maxWidth: 46, height: `${Math.max((x.valor / maxMes) * 120, x.valor ? 6 : 2)}px`, borderRadius: 10, background: x.m === mes ? "linear-gradient(180deg, var(--w-400), var(--w-700))" : "var(--w-200)" }} />
                <span style={{ fontSize: 11.5, color: "var(--k-mut)", fontWeight: 700 }}>{new Date(x.m + "-02").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card titulo={pagosMes.length ? "Bancos do mês" : "Bancos (pagos)"}><Barras itens={porBanco} formato={brl} /></Card>
        <Card titulo={pagosMes.length ? "Produtos do mês" : "Produtos (pagos)"}><Barras itens={porProduto} formato={brl} /></Card>
        <Card titulo="Ranking de vendedores do mês"><Barras itens={ranking} formato={brl} /></Card>
        <Card titulo="Últimos contratos" acao={<Btn variante="ghost" onClick={() => ir("contratos")}>Ver todos</Btn>}>
          {contratos.length === 0 ? <Vazio icone="📄" titulo="Nenhum contrato ainda" sub="Comece pela simulação de margem ou cadastre um contrato." /> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {contratos.slice(0, 6).map((c) => {
                const e = etapa(c.status_venda);
                return (
                  <button key={c.id} onClick={() => ir("contratos", { contratoId: c.id })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", border: 0, borderTop: "1px solid var(--k-borda)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13.5, color: "var(--k-tinta)" }}>{c.nome}</b>
                      <span style={{ display: "block", fontSize: 12, color: "var(--k-mut)" }}>{c.operadora || "—"} · {produto(c.plano)} · {dataBR(c.data_proposta || c.created_at)}</span>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <b style={{ display: "block", fontSize: 13.5 }}>{brl(valorLiberado(c))}</b>
                      <Pill texto={e.curto} cor={e.cor} />
                    </span>
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
