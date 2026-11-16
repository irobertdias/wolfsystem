"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Btn, Modal, NUM } from "../_ui";
import { brl, num, telFmt, descVariante, subtotal, qtdItens, salvarPedido, textoPedido, type Item, type Produto, type DadosPedido } from "../_dados";
import Icone from "../../../components/a2/Icone";

// ═══════════════════════════════════════════════════════════════════════
// Frente de caixa (PDV): busca/leitor de código à esquerda, cupom à direita.
// Enter adiciona o primeiro resultado (leitor de código de barras digita + Enter),
// F9 finaliza. A venda vira um pedido FECHADO e já baixa o estoque.
// ═══════════════════════════════════════════════════════════════════════
type Tecla = { p: Produto; v: Produto["variantes"][number] };

export default function Caixa({ dados, ir }: any) {
  const { wsId, empresa, cfg, carregar } = dados;
  const produtos: Produto[] = (cfg.produtos || []).filter((p: Produto) => p.ativo !== false);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [cliente, setCliente] = useState({ nome: "", tel: "" });
  const [desconto, setDesconto] = useState("");
  const [pagamento, setPagamento] = useState<string>(cfg.formas_pagamento?.[0] || "PIX");
  const [recebido, setRecebido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cupom, setCupom] = useState<{ numero: string; texto: string; total: number; troco: number } | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const teclas: Tecla[] = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.flatMap((p) => p.variantes.map((v) => ({ p, v })))
      .filter(({ p, v }) => (!cat || p.categoria === cat) && (!q || `${p.nome} ${p.sku || ""} ${v.sku || ""} ${p.marca || ""} ${descVariante(v)}`.toLowerCase().includes(q)));
  }, [produtos, busca, cat]);
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))] as string[];

  const sub = subtotal(itens);
  const total = Math.max(0, sub - num(desconto));
  const troco = pagamento === "Dinheiro" && num(recebido) > total ? num(recebido) - total : 0;
  const noCarrinho = (p: Produto, v: Tecla["v"]) => itens.filter((i) => i.produto_id === p.id && i.variante_id === v.id).reduce((s, i) => s + i.qtd, 0);

  function adicionar({ p, v }: Tecla) {
    setErro("");
    if (!p.servico && noCarrinho(p, v) >= num(v.estoque)) { setErro(`Sem estoque de ${p.nome}${descVariante(v) ? ` (${descVariante(v)})` : ""}.`); return; }
    setItens((xs) => {
      const i = xs.findIndex((x) => x.produto_id === p.id && x.variante_id === v.id);
      if (i >= 0) return xs.map((x, j) => (j === i ? { ...x, qtd: x.qtd + 1 } : x));
      return [...xs, { produto_id: p.id, variante_id: v.id, nome: p.nome, tamanho: v.tamanho, cor: v.cor, qtd: 1, preco: num(p.preco), servico: p.servico }];
    });
  }
  const mudarQtd = (i: number, d: number) => setItens((xs) => xs.flatMap((x, j) => (j !== i ? [x] : x.qtd + d <= 0 ? [] : [{ ...x, qtd: x.qtd + d }])));
  const limpar = () => { setItens([]); setCliente({ nome: "", tel: "" }); setDesconto(""); setRecebido(""); setErro(""); buscaRef.current?.focus(); };

  async function finalizar(orcamento = false) {
    if (!itens.length) { setErro("Adicione ao menos um item."); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const d: DadosPedido = { tipo: orcamento ? "orcamento" : "pedido", itens, desconto: num(desconto), frete: 0, pagamento, entrega: "retirada", observacoes: troco ? `Recebido ${brl(num(recebido))} · troco ${brl(troco)}` : undefined,
      historico: [{ em: new Date().toISOString(), etapa: orcamento ? "EM NEGOCIACAO" : "FECHADA", nota: orcamento ? "Orçamento feito no balcão" : "Venda no caixa", por: user?.email || "" }] };
    const nome = cliente.nome.trim() || "Consumidor final";
    const numero = String(Date.now()).slice(-6);
    const { error } = await salvarPedido(wsId, "vendas", { nome, telefone1: cliente.tel.replace(/\D/g, "") || null, status_venda: orcamento ? "EM NEGOCIACAO" : "FECHADA" }, { ...d, numero });
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setCupom({ numero, texto: textoPedido({ nome }, { ...d, numero }, empresa, "vendas"), total, troco });
    carregar();
  }

  useEffect(() => {
    buscaRef.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "F9") { e.preventDefault(); if (!cupom) finalizar(); }
      if (e.key === "Escape" && cupom) { setCupom(null); limpar(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return (
    <div className="com-pdv">
      {/* ─── esquerda: produtos ─── */}
      <section className="com-pdv-produtos">
        <div className="com-pdv-busca">
          <Icone nome="busca" tamanho={20} />
          <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, nome ou passe o leitor…"
            onKeyDown={(e) => { if (e.key === "Enter" && teclas[0]) { adicionar(teclas[0]); setBusca(""); } }} />
          {busca && <button onClick={() => setBusca("")} title="Limpar"><Icone nome="x" tamanho={16} /></button>}
        </div>
        {categorias.length > 0 && (
          <div className="com-pdv-cats">
            <button className={!cat ? "ativo" : ""} onClick={() => setCat("")}>Tudo</button>
            {categorias.map((c) => <button key={c} className={cat === c ? "ativo" : ""} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        {produtos.length === 0 ? (
          <div className="com-pdv-vazio"><b>Nenhum produto cadastrado</b><span>Cadastre os produtos para vender no caixa.</span><Btn onClick={() => ir("catalogo")}>Cadastrar produtos</Btn></div>
        ) : (
          <div className="com-pdv-grade">
            {teclas.map((t, k) => {
              const est = num(t.v.estoque) - noCarrinho(t.p, t.v), sem = !t.p.servico && est <= 0;
              return (
                <button key={t.p.id + t.v.id} className={`com-pdv-tecla${sem ? " sem" : ""}`} onClick={() => adicionar(t)} title={sem ? "Sem estoque" : "Adicionar"}>
                  {t.p.foto ? <span className="foto" style={{ backgroundImage: `url(${t.p.foto})` }} /> : <span className="sigla" style={{ background: `hsl(${(t.p.nome.charCodeAt(0) * 37 + k) % 360} 70% 94%)`, color: `hsl(${(t.p.nome.charCodeAt(0) * 37 + k) % 360} 60% 32%)` }}>{t.p.nome.slice(0, 2).toUpperCase()}</span>}
                  <span className="nome">{t.p.nome}{descVariante(t.v) ? <small>{descVariante(t.v)}</small> : null}</span>
                  <span className="rodape"><b style={NUM}>{brl(t.p.preco)}</b><i>{t.p.servico ? "serviço" : sem ? "esgotado" : `${est} un`}</i></span>
                </button>
              );
            })}
            {teclas.length === 0 && <div className="com-pdv-vazio"><b>Nada encontrado</b><span>Confira o código ou o nome.</span></div>}
          </div>
        )}
      </section>

      {/* ─── direita: cupom ─── */}
      <aside className="com-pdv-cupom">
        <div className="com-cupom-topo">
          <span><Icone nome="dinheiro" tamanho={16} /> Venda atual</span>
          <b style={NUM}>{qtdItens(itens)} item(ns)</b>
        </div>
        <div className="com-cupom-cliente">
          <input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Cliente (opcional)" />
          <input value={cliente.tel} onChange={(e) => setCliente({ ...cliente, tel: telFmt(e.target.value) })} placeholder="WhatsApp" inputMode="tel" />
        </div>
        <div className="com-cupom-itens">
          {itens.length === 0 && <div className="com-cupom-vazio">Cupom vazio.<br />Toque nos produtos ou passe o leitor.</div>}
          {itens.map((i, k) => (
            <div key={k} className="com-cupom-item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{i.nome}</b>
                <span style={NUM}>{descVariante(i) ? `${descVariante(i)} · ` : ""}{brl(i.preco)} un</span>
              </div>
              <div className="qtd">
                <button onClick={() => mudarQtd(k, -1)}>−</button>
                <b style={NUM}>{i.qtd}</b>
                <button onClick={() => adicionar({ p: produtos.find((p) => p.id === i.produto_id)!, v: produtos.find((p) => p.id === i.produto_id)!.variantes.find((v) => v.id === i.variante_id)! })}>+</button>
              </div>
              <b className="valor" style={NUM}>{brl(i.qtd * i.preco)}</b>
            </div>
          ))}
        </div>
        <div className="com-cupom-contas">
          <div><span>Subtotal</span><b style={NUM}>{brl(sub)}</b></div>
          <div><span>Desconto</span><input value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" style={NUM} /></div>
          <div className="pagamentos">
            {(cfg.formas_pagamento || []).slice(0, 6).map((f: string) => <button key={f} className={pagamento === f ? "ativo" : ""} onClick={() => setPagamento(f)}>{f}</button>)}
          </div>
          {pagamento === "Dinheiro" && <div><span>Recebido</span><input value={recebido} onChange={(e) => setRecebido(e.target.value)} placeholder="0,00" inputMode="decimal" style={NUM} /></div>}
          {troco > 0 && <div className="troco"><span>Troco</span><b style={NUM}>{brl(troco)}</b></div>}
        </div>
        <div className="com-cupom-total"><span>TOTAL</span><b style={NUM}>{brl(total)}</b></div>
        {erro && <div className="com-cupom-erro">{erro}</div>}
        <div className="com-cupom-acoes">
          <button className="finalizar" disabled={salvando || !itens.length} onClick={() => finalizar()}>{salvando ? "Registrando…" : <>Finalizar venda <kbd>F9</kbd></>}</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sec" disabled={salvando || !itens.length} onClick={() => finalizar(true)}>Salvar orçamento</button>
            <button className="sec" disabled={!itens.length} onClick={limpar}>Cancelar</button>
          </div>
        </div>
      </aside>

      {cupom && (
        <Modal titulo={`Venda nº ${cupom.numero} registrada`} onClose={() => { setCupom(null); limpar(); }} maxWidth={420}
          footer={<>
            {cliente.tel && <a href={`https://wa.me/55${cliente.tel.replace(/\D/g, "")}?text=${encodeURIComponent(cupom.texto)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn variante="ghost">Enviar no WhatsApp</Btn></a>}
            <Btn onClick={() => { setCupom(null); limpar(); }}>Nova venda (Esc)</Btn>
          </>}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--c-sub)" }}>Total recebido</span>
            <b style={{ fontSize: 40, fontWeight: 900, color: "var(--c-tinta)", letterSpacing: "-.03em", ...NUM }}>{brl(cupom.total)}</b>
            {cupom.troco > 0 && <span style={{ fontSize: 18, fontWeight: 900, color: "#16A34A", ...NUM }}>Troco: {brl(cupom.troco)}</span>}
            <pre style={{ textAlign: "left", background: "#FAFAF9", border: "2px dashed var(--c-borda)", borderRadius: 10, padding: 12, fontSize: 12, whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "ui-monospace, Consolas, monospace" }}>{cupom.texto.replace(/\*/g, "")}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
