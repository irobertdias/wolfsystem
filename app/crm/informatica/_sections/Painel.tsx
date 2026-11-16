"use client";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Vazio, Pill } from "../../financeiro/_sections/_ui";
import {
  CONFIRMADAS, ETAPAS_OS, OS_ABERTAS, brl, dataBR, hoje, ped, totalPedido, qtdItens, mesDe, custoItens, num, nomeUsuario,
  os, totalOS, fimGarantia, etapaOS, etapaDe, type Pedido, type Produto,
} from "../_dados";

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)";

function Barras({ itens, formato }: { itens: { nome: string; valor: number; extra?: string; cor?: string }[]; formato: (n: number) => string }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  if (!itens.length) return <div style={{ color: "#94A3B8", fontSize: 13, padding: "10px 0" }}>Sem dados ainda.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {itens.map((i) => (
        <div key={i.nome} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", fontSize: 13, gap: 8 }}><span style={{ color: "#334155", fontWeight: 700 }}>{i.nome}</span><span style={{ marginLeft: "auto", fontWeight: 800, whiteSpace: "nowrap" }}>{formato(i.valor)}{i.extra ? <span style={{ color: "#94A3B8", fontWeight: 600 }}> · {i.extra}</span> : null}</span></div>
          <div style={{ height: 8, borderRadius: 99, background: "#EEF2F1", overflow: "hidden" }}><div style={{ height: "100%", width: `${(i.valor / max) * 100}%`, background: i.cor || "linear-gradient(90deg, var(--w-400), var(--w-600))", borderRadius: 99 }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function Painel({ dados, ir }: any) {
  const { pedidos, ordens, cfg, usuarios, carregando, erro, carregar } = dados as { pedidos: Pedido[]; ordens: Pedido[]; cfg: any; usuarios: any[]; carregando: boolean; erro: string; carregar: () => void };
  const mes = new Date().toISOString().slice(0, 7), hojeISO = hoje();
  const vendidas = pedidos.filter((p) => CONFIRMADAS.vendas.includes(p.status_venda || ""));
  const vendasMes = vendidas.filter((p) => mesDe(p) === mes);
  const fatVendas = vendasMes.reduce((s, p) => s + totalPedido(ped(p)), 0);
  const custoVendas = vendasMes.reduce((s, p) => s + custoItens(ped(p).itens, cfg.produtos), 0);
  const osEntregues = ordens.filter((p) => p.status_venda === "ENTREGUE");
  const osMes = osEntregues.filter((p) => String(os(p).entregue_em || mesDe(p)).slice(0, 7) === mes);
  const fatServicos = osMes.reduce((s, p) => s + totalOS(os(p)), 0);
  const total = fatVendas + fatServicos;
  const abertas = ordens.filter((p) => OS_ABERTAS.includes(p.status_venda || "RECEBIDO"));
  const atrasadas = abertas.filter((p) => p.status_venda !== "PRONTO" && os(p).previsao && os(p).previsao! < hojeISO);
  const aprovar = ordens.filter((p) => p.status_venda === "AGUARDANDO APROVACAO");
  const prontas = ordens.filter((p) => p.status_venda === "PRONTO");
  const orcs = pedidos.filter((p) => ped(p).tipo === "orcamento" || p.status_venda === "EM NEGOCIACAO");
  const conversao = orcs.length ? Math.round((orcs.filter((p) => p.status_venda === "FECHADA").length / orcs.length) * 100) : 0;
  const aguardandoPgto = pedidos.filter((p) => p.status_venda === "AGUARDANDO PAGAMENTO");
  const produtos: Produto[] = cfg.produtos || [];
  const baixo = produtos.filter((p) => !p.servico).flatMap((p) => p.variantes.filter((v) => num(v.estoque) <= cfg.estoque_minimo).map(() => p.nome));
  const em30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const garantiasVencendo = osEntregues.filter((p) => { const f = fimGarantia(os(p)); return f && f >= hojeISO && f <= em30; });

  const top: Record<string, { valor: number; qtd: number }> = {};
  vendasMes.forEach((p) => ped(p).itens.forEach((i) => { top[i.nome] = top[i.nome] || { valor: 0, qtd: 0 }; top[i.nome].valor += i.qtd * i.preco; top[i.nome].qtd += i.qtd; }));
  const maisVendidos = Object.entries(top).map(([nome, v]) => ({ nome, valor: v.qtd, extra: brl(v.valor) })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const tec: Record<string, { qtd: number; valor: number }> = {};
  osMes.forEach((p) => { const k = os(p).tecnico || "Sem técnico"; tec[k] = tec[k] || { qtd: 0, valor: 0 }; tec[k].qtd++; tec[k].valor += totalOS(os(p)); });
  const tecnicos = Object.entries(tec).map(([nome, v]) => ({ nome, valor: v.qtd, extra: brl(v.valor) })).sort((a, b) => b.valor - a.valor);
  const porEtapaOS = ETAPAS_OS.filter((e) => OS_ABERTAS.includes(e.key)).map((e) => ({ nome: e.label, valor: abertas.filter((p) => (p.status_venda || "RECEBIDO") === e.key).length, cor: e.cor })).filter((e) => e.valor);
  const eq: Record<string, number> = {};
  ordens.forEach((p) => { const k = os(p).equipamento || "Outro"; eq[k] = (eq[k] || 0) + 1; });
  const porEquip = Object.entries(eq).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + k); return d.toISOString().slice(0, 7); });
  const porMes = meses.map((m) => ({ m,
    vendas: vendidas.filter((p) => mesDe(p) === m).reduce((s, p) => s + totalPedido(ped(p)), 0),
    servicos: osEntregues.filter((p) => String(os(p).entregue_em || mesDe(p)).slice(0, 7) === m).reduce((s, p) => s + totalOS(os(p)), 0) }));
  const maxMes = Math.max(...porMes.map((x) => x.vendas + x.servicos), 1);
  const recentes = [...ordens.map((p) => ({ p, os: true })), ...pedidos.map((p) => ({ p, os: false }))].sort((a, b) => String(b.p.created_at).localeCompare(String(a.p.created_at))).slice(0, 7);

  return (
    <Page>
      <PageHeader titulo="Painel da loja" subtitulo={`Vendas e assistência técnica · ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        acao={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn variante="ghost" onClick={carregar}>Atualizar</Btn><Btn variante="ghost" onClick={() => ir("orcamentos", { novo: true, orcamento: true })}>＋ Orçamento</Btn><Btn variante="ghost" onClick={() => ir("pedidos", { novo: true })}>＋ Venda</Btn><Btn onClick={() => ir("os", { novo: true })}>＋ Nova OS</Btn></div>} />
      {erro && <Banner tipo="warn">Não foi possível carregar: {erro}</Banner>}
      {produtos.length === 0 && <Banner tipo="info">Comece cadastrando equipamentos, peças e serviços. <a onClick={() => ir("catalogo")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Abrir produtos</a></Banner>}
      {atrasadas.length > 0 && <Banner tipo="warn"><b>{atrasadas.length} OS com previsão vencida.</b> <a onClick={() => ir("os")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Ver assistência</a></Banner>}
      {baixo.length > 0 && <Banner tipo="warn"><b>{baixo.length} item(ns) com estoque baixo</b>: {[...new Set(baixo)].slice(0, 4).join(", ")}{baixo.length > 4 ? "…" : ""}. <a onClick={() => ir("estoque")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Ver estoque</a></Banner>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="hero-nicho" style={{ gridColumn: "span 2", minWidth: 0, borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, var(--w-500) 0%, var(--w-600) 42%, var(--w-800) 100%)", boxShadow: "0 22px 44px -24px rgba(15,23,42,.55)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Faturamento do mês</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{carregando ? "…" : brl(total)}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>Vendas {brl(fatVendas)} · Assistência {brl(fatServicos)}{custoVendas ? ` · lucro bruto nas vendas ${brl(fatVendas - custoVendas)}` : ""}</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: SOMBRA, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Assistência técnica</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#0F172A" }}>{abertas.length} <span style={{ fontSize: 14, color: "#94A3B8" }}>OS abertas</span></span>
          <span style={{ fontSize: 13, color: "#475569" }}>{aprovar.length} aguardando aprovação · {prontas.length} pronta(s) para retirada</span>
          <div><Btn variante="ghost" onClick={() => ir("os")}>Abrir assistência</Btn></div>
        </div>
      </div>

      <Stats>
        <Stat label="Vendas no mês" icone="🛒" valor={String(vendasMes.length)} sub={`${vendasMes.reduce((s, p) => s + qtdItens(ped(p).itens), 0)} item(ns)`} />
        <Stat label="OS entregues no mês" icone="🛠️" valor={String(osMes.length)} />
        <Stat label="Conversão de orçamentos" icone="📝" valor={`${conversao}%`} />
        <Stat label="Aguardando pagamento" icone="⏳" valor={brl(aguardandoPgto.reduce((s, p) => s + totalPedido(ped(p)), 0))} cor="#C2410C" sub={`${aguardandoPgto.length} venda(s)`} />
        <Stat label="Garantias vencendo (30 dias)" icone="🛡️" valor={String(garantiasVencendo.length)} />
      </Stats>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card titulo="Últimos 6 meses (vendas + assistência)">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, paddingTop: 10 }}>
            {porMes.map((x) => (
              <div key={x.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700 }}>{x.vendas + x.servicos ? brl(x.vendas + x.servicos).replace(",00", "") : ""}</span>
                <div title={`Assistência ${brl(x.servicos)}`} style={{ width: "100%", maxWidth: 46, height: `${(x.servicos / maxMes) * 120}px`, borderRadius: "10px 10px 0 0", background: "var(--w-300)" }} />
                <div title={`Vendas ${brl(x.vendas)}`} style={{ width: "100%", maxWidth: 46, height: `${Math.max((x.vendas / maxMes) * 120, x.vendas + x.servicos ? 0 : 2)}px`, borderRadius: x.servicos ? "0 0 10px 10px" : 10, background: x.m === mes ? "var(--w-700)" : "var(--w-500)", marginTop: -4 }} />
                <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 700 }}>{new Date(x.m + "-02").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#64748B", marginTop: 8 }}><span><b style={{ color: "var(--w-600)" }}>■</b> Vendas</span><span><b style={{ color: "var(--w-300)" }}>■</b> Assistência</span></div>
        </Card>
        <Card titulo="OS abertas por etapa" acao={<Btn variante="ghost" onClick={() => ir("os")}>Ver OS</Btn>}><Barras itens={porEtapaOS} formato={(n) => `${n}`} /></Card>
        <Card titulo="Técnicos no mês"><Barras itens={tecnicos} formato={(n) => `${n} OS`} /></Card>
        <Card titulo="Mais vendidos no mês"><Barras itens={maisVendidos} formato={(n) => `${n} un.`} /></Card>
        <Card titulo="Equipamentos atendidos"><Barras itens={porEquip} formato={(n) => `${n}`} /></Card>
        <Card titulo="Movimento recente">
          {recentes.length === 0 ? <Vazio icone="💻" titulo="Nada ainda" sub="Registre a primeira venda ou OS." /> : recentes.map(({ p, os: ehOs }) => {
            const e = ehOs ? etapaOS(p.status_venda) : etapaDe("vendas", p.status_venda);
            return (
              <button key={(ehOs ? "o" : "v") + p.id} onClick={() => ir(ehOs ? "os" : ped(p).tipo === "orcamento" && ["PENDENTE", "EM NEGOCIACAO"].includes(p.status_venda || "") ? "orcamentos" : "pedidos", { pedidoId: p.id })} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 4px", border: 0, borderTop: "1px solid #F1F5F4", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{ehOs ? `🛠️ ${os(p).numero || ""}` : "🛒"} {p.nome}</b><span style={{ display: "block", fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.plano || ""} · {dataBR(p.created_at)} · {nomeUsuario(usuarios, p.vendedor)}</span></span>
                <span style={{ textAlign: "right" }}><b style={{ display: "block", fontSize: 13.5 }}>{brl(ehOs ? totalOS(os(p)) : totalPedido(ped(p)))}</b><Pill texto={e.curto} cor={e.cor} /></span>
              </button>
            );
          })}
        </Card>
      </div>
    </Page>
  );
}
