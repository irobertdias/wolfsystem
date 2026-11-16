"use client";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Vazio, Pill } from "../../financeiro/_sections/_ui";
import { etapasDo, etapaDe, CONFIRMADAS, ENCERRADAS, brl, dataBR, ped, totalPedido, qtdItens, mesDe, custoItens, descVariante, num, nomeUsuario, type Pedido, type Produto } from "../_dados";

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
  const { modo, pedidos, cfg, usuarios, carregando, erro, carregar } = dados as { modo: "roupas" | "vendas"; pedidos: Pedido[]; cfg: any; usuarios: any[]; carregando: boolean; erro: string; carregar: () => void };
  const roupas = modo === "roupas";
  const mes = new Date().toISOString().slice(0, 7);
  const vendidos = pedidos.filter((p) => CONFIRMADAS[modo].includes(p.status_venda || ""));
  const doMes = vendidos.filter((p) => mesDe(p) === mes);
  const faturamento = doMes.reduce((s, p) => s + totalPedido(ped(p)), 0);
  const custo = doMes.reduce((s, p) => s + custoItens(ped(p).itens, cfg.produtos), 0);
  const ticket = doMes.length ? faturamento / doMes.length : 0;
  const pecas = doMes.reduce((s, p) => s + qtdItens(ped(p).itens), 0);
  const aguardandoPgto = pedidos.filter((p) => p.status_venda === "AGUARDANDO PAGAMENTO");
  const orcs = pedidos.filter((p) => ped(p).tipo === "orcamento" || p.status_venda === "EM NEGOCIACAO");
  const orcAbertos = orcs.filter((p) => ["PENDENTE", "EM NEGOCIACAO"].includes(p.status_venda || "PENDENTE"));
  const conversao = orcs.length ? Math.round((orcs.filter((p) => CONFIRMADAS.vendas.includes(p.status_venda || "")).length / orcs.length) * 100) : 0;
  const separar = pedidos.filter((p) => p.status_venda === "EM SEPARACAO").length;
  const naRua = pedidos.filter((p) => p.status_venda === "AGUARDANDO ENTREGA").length;
  const produtos: Produto[] = cfg.produtos || [];
  const baixo = produtos.filter((p) => !p.servico).flatMap((p) => p.variantes.filter((v) => num(v.estoque) <= cfg.estoque_minimo).map((v) => ({ p, v })));

  const top: Record<string, { valor: number; qtd: number }> = {};
  doMes.forEach((p) => ped(p).itens.forEach((i) => { const k = i.nome; top[k] = top[k] || { valor: 0, qtd: 0 }; top[k].valor += i.qtd * i.preco; top[k].qtd += i.qtd; }));
  const maisVendidos = Object.entries(top).map(([nome, v]) => ({ nome, valor: v.qtd, extra: brl(v.valor) })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const tam: Record<string, number> = {};
  doMes.forEach((p) => ped(p).itens.forEach((i) => { if (i.tamanho) tam[i.tamanho] = (tam[i.tamanho] || 0) + i.qtd; }));
  // Ordem da grade configurada; numerações fora dela (36, 38…) entram depois.
  const ordemTam = [...cfg.tamanhos, ...Object.keys(tam).filter((t) => !cfg.tamanhos.includes(t)).sort((a, b) => num(a) - num(b))];
  const porTamanho = ordemTam.filter((t: string) => tam[t]).map((t: string) => ({ nome: t, valor: tam[t] }));
  const pg: Record<string, number> = {};
  doMes.forEach((p) => { const k = ped(p).pagamento || "—"; pg[k] = (pg[k] || 0) + totalPedido(ped(p)); });
  const porPagamento = Object.entries(pg).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  const rk: Record<string, number> = {};
  doMes.forEach((p) => { const k = nomeUsuario(usuarios, p.vendedor); rk[k] = (rk[k] || 0) + totalPedido(ped(p)); });
  const ranking = Object.entries(rk).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const porEtapa = etapasDo(modo).map((e) => ({ nome: e.label, valor: pedidos.filter((p) => (p.status_venda || "PENDENTE") === e.key && !(ped(p).tipo === "orcamento" && roupas)).length, cor: e.cor })).filter((e) => e.valor);
  const meses = Array.from({ length: 6 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + k); return d.toISOString().slice(0, 7); });
  const porMes = meses.map((m) => ({ m, valor: vendidos.filter((p) => mesDe(p) === m).reduce((s, p) => s + totalPedido(ped(p)), 0) }));
  const maxMes = Math.max(...porMes.map((x) => x.valor), 1);

  return (
    <Page>
      <PageHeader titulo={roupas ? "Painel da loja" : "Painel de vendas"} subtitulo={new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={carregar}>Atualizar</Btn>{!roupas && <Btn variante="ghost" onClick={() => ir("orcamentos", { novo: true, orcamento: true })}>＋ Orçamento</Btn>}<Btn onClick={() => ir("pedidos", { novo: true })}>＋ Novo pedido</Btn></div>} />
      {erro && <Banner tipo="warn">Não foi possível carregar: {erro}</Banner>}
      {produtos.length === 0 && <Banner tipo="info">{roupas ? "Comece cadastrando as peças no Catálogo, com a grade de tamanhos e cores." : "Comece cadastrando seus produtos e serviços."} <a onClick={() => ir("catalogo")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Abrir catálogo</a></Banner>}
      {baixo.length > 0 && <Banner tipo="warn"><b>{baixo.length} {roupas ? "item(ns) da grade" : "produto(s)"} com estoque baixo.</b> <a onClick={() => ir("estoque")} style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 700 }}>Ver estoque</a></Banner>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="hero-nicho" style={{ gridColumn: "span 2", minWidth: 0, borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, var(--w-500) 0%, var(--w-600) 42%, var(--w-800) 100%)", boxShadow: "0 22px 44px -24px rgba(15,23,42,.55)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Faturamento do mês</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{carregando ? "…" : brl(faturamento)}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>{doMes.length} {roupas ? "pedido(s)" : "venda(s)"} · {pecas} {roupas ? "peça(s)" : "item(ns)"} · ticket médio {brl(ticket)}{custo ? ` · lucro bruto ${brl(faturamento - custo)}` : ""}</span>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: 20, boxShadow: SOMBRA, display: "flex", flexDirection: "column", gap: 8 }}>
          {roupas ? (<>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Separação e entrega</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#0F172A" }}>{separar} <span style={{ fontSize: 14, color: "#94A3B8" }}>a separar</span></span>
            <span style={{ fontSize: 13, color: "#475569" }}>{naRua} na rua / aguardando retirada</span>
            <div><Btn variante="ghost" onClick={() => ir("entregas")}>Abrir entregas</Btn></div>
          </>) : (<>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748B" }}>Conversão de orçamentos</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#0F172A" }}>{conversao}%</span>
            <span style={{ height: 6, borderRadius: 99, background: "#EEF2F1", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${conversao}%`, background: "var(--w-500)" }} /></span>
            <span style={{ fontSize: 12.5, color: "#94A3B8" }}>{orcAbertos.length} orçamento(s) em aberto</span>
          </>)}
        </div>
      </div>

      <Stats>
        <Stat label="Aguardando pagamento" icone="⏳" valor={brl(aguardandoPgto.reduce((s, p) => s + totalPedido(ped(p)), 0))} sub={`${aguardandoPgto.length} pedido(s)`} cor="#C2410C" />
        <Stat label={roupas ? "Peças vendidas no mês" : "Itens vendidos no mês"} icone="🛍️" valor={String(pecas)} />
        <Stat label="Ticket médio" icone="💳" valor={brl(ticket)} />
        <Stat label="Em andamento" icone="📋" valor={String(pedidos.filter((p) => !ENCERRADAS.includes(p.status_venda || "") && !CONFIRMADAS[modo].includes(p.status_venda || "")).length)} sub="pedidos abertos" />
      </Stats>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card titulo="Vendas dos últimos 6 meses">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 170, paddingTop: 10 }}>
            {porMes.map((x) => (
              <div key={x.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 700 }}>{x.valor ? brl(x.valor).replace(",00", "") : ""}</span>
                <div style={{ width: "100%", maxWidth: 46, height: `${Math.max((x.valor / maxMes) * 120, x.valor ? 6 : 2)}px`, borderRadius: 10, background: x.m === mes ? "linear-gradient(180deg, var(--w-400), var(--w-700))" : "var(--w-200)" }} />
                <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 700 }}>{new Date(x.m + "-02").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card titulo={roupas ? "Peças mais vendidas" : "Mais vendidos"}><Barras itens={maisVendidos} formato={(n) => `${n} un.`} /></Card>
        {roupas && <Card titulo="Tamanhos mais vendidos"><Barras itens={porTamanho} formato={(n) => `${n} peça(s)`} /></Card>}
        <Card titulo="Pedidos por etapa" acao={<Btn variante="ghost" onClick={() => ir("pedidos")}>Ver pedidos</Btn>}><Barras itens={porEtapa} formato={(n) => `${n}`} /></Card>
        <Card titulo="Formas de pagamento do mês"><Barras itens={porPagamento} formato={brl} /></Card>
        <Card titulo="Ranking de vendedores"><Barras itens={ranking} formato={brl} /></Card>
        <Card titulo="Últimos pedidos" acao={<Btn variante="ghost" onClick={() => ir("pedidos")}>Ver todos</Btn>}>
          {pedidos.length === 0 ? <Vazio icone={roupas ? "🛍️" : "🧾"} titulo="Nenhum pedido ainda" /> : pedidos.slice(0, 6).map((p) => {
            const e = etapaDe(modo, p.status_venda), d = ped(p);
            return (
              <button key={p.id} onClick={() => ir(d.tipo === "orcamento" && ["PENDENTE", "EM NEGOCIACAO"].includes(p.status_venda || "") ? "orcamentos" : "pedidos", { pedidoId: p.id })} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 4px", border: 0, borderTop: "1px solid #F1F5F4", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13.5 }}>{p.nome}</b><span style={{ display: "block", fontSize: 12, color: "#94A3B8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.itens.map((i) => `${i.qtd}x ${i.nome}${descVariante(i) ? ` ${descVariante(i)}` : ""}`).join(", ")} · {dataBR(p.created_at)}</span></span>
                <span style={{ textAlign: "right" }}><b style={{ display: "block", fontSize: 13.5 }}>{brl(totalPedido(d))}</b><Pill texto={e.curto} cor={e.cor} /></span>
              </button>
            );
          })}
        </Card>
      </div>
    </Page>
  );
}
