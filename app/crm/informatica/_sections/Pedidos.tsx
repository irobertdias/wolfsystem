"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Btn, Banner, Field, Row, Table, Vazio, Pill, Modal, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import {
  etapasDo, etapaDe, FLUXO, ENCERRADAS, brl, dataBR, hoje, num, telFmt, ped, descVariante, subtotal, totalPedido, qtdItens,
  salvarPedido, mudarEtapa, textoPedido, nomeUsuario, baixarCSV, type Pedido, type DadosPedido, type Item, type Produto,
} from "../_dados";
import Icone from "../../../components/a2/Icone";
import AcoesOrcamentoLoja from "../../../components/AcoesOrcamentoLoja";
import { useModulos } from "../../../hooks/useModulos";
import { nichoLiberado } from "../../../lib/modulos-nicho";

type Form = { nome: string; telefone1: string; cpf: string; email: string; endereco: string; cidade: string; estado: string; status_venda: string; d: DadosPedido };

export default function Pedidos({ dados, alvo, gestor, orcamentos }: any) {
  const { wsId, empresa, modo, pedidos, cfg, usuarios, carregar } = dados as { wsId: string; empresa: string; modo: "roupas" | "vendas"; pedidos: Pedido[]; cfg: any; usuarios: any[]; carregar: () => void };
  const etapas = etapasDo(modo);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<string>("ativos");
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState<Pedido | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [copiado, setCopiado] = useState(false);
  const produtos: Produto[] = (cfg.produtos || []).filter((p: Produto) => p.ativo !== false);
  const { modulos } = useModulos();
  const nichoOk = nichoLiberado(modulos.nicho_opcoes, "informatica", "orcamentos");

  const ehOrc = (p: Pedido) => ped(p).tipo === "orcamento" && ["PENDENTE", "EM NEGOCIACAO"].includes(p.status_venda || "PENDENTE");
  const base = orcamentos ? pedidos.filter((p) => ped(p).tipo === "orcamento" || p.status_venda === "EM NEGOCIACAO") : pedidos.filter((p) => !ehOrc(p));

  const novo = (orc = !!orcamentos): Form => ({
    nome: "", telefone1: "", cpf: "", email: "", endereco: "", cidade: "", estado: "",
    status_venda: orc ? "EM NEGOCIACAO" : "PENDENTE",
    d: { tipo: orc ? "orcamento" : "pedido", itens: [], desconto: 0, frete: modo === "roupas" ? num(cfg.taxa_entrega) : 0, pagamento: cfg.formas_pagamento[0] || "", entrega: modo === "roupas" ? "entrega" : "retirada",
      validade: orc ? new Date(Date.now() + (cfg.validade_orcamento_dias || 7) * 86400_000).toISOString().slice(0, 10) : undefined },
  });
  const abrir = (p?: Pedido | null, orc?: boolean) => {
    setErro(""); setCopiado(false);
    if (p) { const d = ped(p); setAtual(p); setF({ nome: p.nome || "", telefone1: telFmt(p.telefone1), cpf: p.cpf || "", email: p.email || "", endereco: p.endereco || "", cidade: p.cidade || "", estado: p.estado || "", status_venda: p.status_venda || "PENDENTE", d: { ...d, itens: d.itens.map((i) => ({ ...i })) } }); }
    else { setAtual(null); setF(novo(orc)); }
    setAberto(true);
  };
  useEffect(() => {
    if (!alvo?.t) return;
    if (alvo.novo) abrir(null, alvo.orcamento);
    else if (alvo.pedidoId) { const p = pedidos.find((x) => x.id === alvo.pedidoId); if (p) abrir(p); }
    else if (alvo.telefone) setBusca(alvo.telefone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.t, pedidos.length]);

  const lista = useMemo(() => base.filter((p) => {
    const st = p.status_venda || "PENDENTE";
    if (filtro === "ativos" && ENCERRADAS.includes(st)) return false;
    if (filtro === "ativos" && (modo === "roupas" ? st === "ENTREGUE" : st === "FECHADA") && Date.now() - new Date(p.updated_at || p.created_at).getTime() > 7 * 86400_000) return false;
    if (filtro !== "ativos" && filtro !== "todos" && st !== filtro) return false;
    const q = busca.trim().toLowerCase(), dig = busca.replace(/\D/g, "");
    return !q || `${p.nome} ${ped(p).numero || ""} ${p.plano || ""}`.toLowerCase().includes(q) || (dig.length >= 4 && String(p.telefone1 || "").includes(dig));
  }), [base, filtro, busca, modo]);

  // ─── itens ───
  const setD = (patch: Partial<DadosPedido>) => setF((x) => (x ? { ...x, d: { ...x.d, ...patch } } : x));
  const setItem = (i: number, patch: Partial<Item>) => setF((x) => (x ? { ...x, d: { ...x.d, itens: x.d.itens.map((it, j) => (j === i ? { ...it, ...patch } : it)) } } : x));
  const addItem = () => {
    const p = produtos[0];
    if (!p) { setErro(modo === "roupas" ? "Cadastre as peças no Catálogo primeiro." : "Cadastre os produtos ou serviços primeiro."); return; }
    const v = p.variantes[0];
    setD({ itens: [...(f?.d.itens || []), { produto_id: p.id, variante_id: v?.id || "", nome: p.nome, tamanho: v?.tamanho, cor: v?.cor, qtd: 1, preco: num(p.preco), servico: p.servico, garantia_meses: p.garantia_meses }] });
  };
  const trocarProduto = (i: number, id: string) => {
    const p = produtos.find((x) => x.id === id); if (!p) return;
    const v = p.variantes[0];
    setItem(i, { produto_id: p.id, variante_id: v?.id || "", nome: p.nome, tamanho: v?.tamanho, cor: v?.cor, preco: num(p.preco), servico: p.servico, garantia_meses: p.garantia_meses, serie: "" });
  };
  const trocarVariante = (i: number, vid: string) => {
    const it = f!.d.itens[i]; const p = produtos.find((x) => x.id === it.produto_id); const v = p?.variantes.find((x) => x.id === vid);
    if (v) setItem(i, { variante_id: v.id, tamanho: v.tamanho, cor: v.cor });
  };
  const estoqueDe = (it: Item) => produtos.find((p) => p.id === it.produto_id)?.variantes.find((v) => v.id === it.variante_id)?.estoque;

  async function salvar() {
    if (!f) return;
    if (!f.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    if (!f.d.itens.length) { setErro("Adicione pelo menos um item."); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const mudou = !atual || (atual.status_venda || "PENDENTE") !== f.status_venda;
    const d: DadosPedido = { ...f.d, itens: f.d.itens.map((i) => ({ ...i, qtd: Math.max(1, Math.round(num(i.qtd))), preco: num(i.preco) })), desconto: num(f.d.desconto), frete: num(f.d.frete) };
    if (mudou) d.historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: f.status_venda, nota: atual ? `Etapa: ${etapaDe(modo, f.status_venda).label}` : d.tipo === "orcamento" ? "Orçamento criado" : "Pedido criado", por: user?.email || "" }];
    const campos: Partial<Pedido> = { nome: f.nome.trim(), telefone1: f.telefone1.replace(/\D/g, "") || null, cpf: f.cpf.replace(/\D/g, "") || null, email: f.email.trim() || null, endereco: f.endereco.trim() || null, cidade: f.cidade.trim() || null, estado: f.estado.trim().toUpperCase() || null, status_venda: f.status_venda };
    const { error } = await salvarPedido(wsId, modo, campos, d, atual);
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setAberto(false); carregar();
  }

  async function avancar(p: Pedido, nova: string) {
    setAviso("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await mudarEtapa(wsId, modo, p, nova, "", user?.email || "");
    if (error) setAviso("Não foi possível mudar a etapa: " + error.message); else carregar();
  }
  async function excluir() {
    if (!atual || !confirm(`Excluir de vez ${ped(atual).tipo === "orcamento" ? "o orçamento" : "o pedido"} de ${atual.nome}?`)) return;
    if (ped(atual).estoque_baixado) { const { moverEstoque } = await import("../_dados"); await moverEstoque(wsId, ped(atual).itens, 1); }
    const { error } = await supabase.from("proposta").delete().eq("workspace_id", wsId).eq("id", atual.id);
    if (error) { setErro("Erro ao excluir: " + error.message); return; }
    setAberto(false); carregar();
  }

  const titulo = orcamentos ? "Orçamentos" : "Vendas";
  const proxima = (p: Pedido) => { const fl = FLUXO[modo]; const i = fl.indexOf(p.status_venda || "PENDENTE"); return i >= 0 && i < fl.length - 1 ? fl[i + 1] : null; };
  const conversao = (() => { const orcs = pedidos.filter((p) => ped(p).tipo === "orcamento" || p.status_venda === "EM NEGOCIACAO"); const fech = orcs.filter((p) => p.status_venda === "FECHADA").length; return orcs.length ? Math.round((fech / orcs.length) * 100) : 0; })();

  return (
    <Page>
      <PageHeader titulo={titulo}
        subtitulo={orcamentos ? `${lista.length} orçamento(s) · ${conversao}% viram venda` : `${lista.length} de ${base.length}`}
        acao={<div style={{ display: "flex", gap: 8 }}>
          <Btn variante="ghost" onClick={() => baixarCSV(`${orcamentos ? "orcamentos" : "pedidos"}-${hoje()}.csv`, [["Nº", "Data", "Cliente", "Telefone", "Itens", "Total", "Pagamento", "Etapa", "Vendedor"], ...lista.map((p) => [ped(p).numero || p.id, dataBR(p.data_proposta || p.created_at), p.nome, telFmt(p.telefone1), p.plano || "", totalPedido(ped(p)).toFixed(2).replace(".", ","), ped(p).pagamento || "", etapaDe(modo, p.status_venda).label, nomeUsuario(usuarios, p.vendedor)])])}>Exportar</Btn>
          <Btn onClick={() => abrir(null, !!orcamentos)}>＋ {orcamentos ? "Novo orçamento" : "Novo pedido"}</Btn>
        </div>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      <Row>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, telefone, nº ou item" style={{ ...inputSm, flex: "2 1 260px", width: "auto" }} />
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...inputSm, flex: "1 1 200px", width: "auto" }}>
          <option value="ativos">Em andamento</option><option value="todos">Todos</option>
          {etapas.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
      </Row>
      <Table cols={[{ label: "Nº / data" }, { label: "Cliente" }, { label: modo === "roupas" ? "Peças" : "Itens" }, { label: "Total", align: "right" }, { label: "Etapa" }, { label: "", align: "right" }]}
        empty={lista.length === 0 ? <Vazio icone={orcamentos ? "📝" : "🛍️"} titulo={orcamentos ? "Nenhum orçamento" : "Nenhum pedido"} sub={produtos.length ? "Crie o primeiro pelo botão acima." : modo === "roupas" ? "Comece cadastrando as peças no Catálogo." : "Comece cadastrando produtos e serviços."} /> : undefined}>
        {lista.map((p) => {
          const d = ped(p), e = etapaDe(modo, p.status_venda), prox = proxima(p);
          return (
            <tr key={p.id}>
              <td style={{ ...tdStyle, cursor: "pointer" }} onClick={() => abrir(p)}><b>#{d.numero || p.id}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{dataBR(p.data_proposta || p.created_at)}</div></td>
              <td style={{ ...tdStyle, cursor: "pointer" }} onClick={() => abrir(p)}><b>{p.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{telFmt(p.telefone1)}{d.entrega === "entrega" && p.cidade ? ` · ${p.cidade}` : d.entrega === "retirada" ? " · retirada" : ""}</div></td>
              <td style={{ ...tdStyle, cursor: "pointer", maxWidth: 280 }} onClick={() => abrir(p)}><span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 13 } as any}>{p.plano || "—"}</span></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(totalPedido(d))}<div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{d.pagamento || ""}</div></td>
              <td style={tdStyle}><Pill texto={e.label} cor={e.cor} /></td>
              <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                {prox && !ENCERRADAS.includes(p.status_venda || "") && <Btn variante="ghost" onClick={() => avancar(p, prox)}>{orcamentos && prox === "AGUARDANDO PAGAMENTO" ? "Virar pedido" : etapaDe(modo, prox).curto} →</Btn>}
              </td>
            </tr>
          );
        })}
      </Table>

      {aberto && f && (
        <Modal titulo={atual ? `${f.d.tipo === "orcamento" ? "Orçamento" : "Pedido"} #${f.d.numero || atual.id} · ${atual.nome}` : f.d.tipo === "orcamento" ? "Novo orçamento" : "Novo pedido"} onClose={() => setAberto(false)} maxWidth={900}
          footer={<>
            {atual && gestor && <Btn variante="danger" onClick={excluir}>Excluir</Btn>}
            <Btn variante="ghost" onClick={async () => { await navigator.clipboard.writeText(textoPedido({ nome: f.nome }, f.d, empresa, modo)); setCopiado(true); }}>{copiado ? "Copiado ✓" : "Copiar para WhatsApp"}</Btn>
            {f.telefone1.replace(/\D/g, "").length >= 10 && <a href={`https://wa.me/55${f.telefone1.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(textoPedido({ nome: f.nome }, f.d, empresa, modo))}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn variante="ghost">Enviar no WhatsApp</Btn></a>}
            <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn>
          </>}>
          {erro && <Banner tipo="warn">{erro}</Banner>}
          <Row>
            <Field label="Cliente" flex="2 1 240px"><input style={inputSm} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
            <Field label="WhatsApp" flex="1 1 160px"><input style={inputSm} value={f.telefone1} onChange={(e) => setF({ ...f, telefone1: e.target.value })} placeholder="(00) 00000-0000" /></Field>
            <Field label="Etapa" flex="1 1 200px"><select style={inputSm} value={f.status_venda} onChange={(e) => setF({ ...f, status_venda: e.target.value })}>{etapas.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></Field>
          </Row>

          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--w-700)", letterSpacing: ".04em", textTransform: "uppercase" }}>{modo === "roupas" ? "Peças do pedido" : "Itens"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {f.d.itens.map((it, i) => {
              const p = produtos.find((x) => x.id === it.produto_id);
              const est = estoqueDe(it);
              const falta = !it.servico && est !== undefined && num(it.qtd) > num(est) && !(atual && ped(atual).estoque_baixado);
              return (
                <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#F7FAF9", borderRadius: 12, padding: 8 }}>
                  <select style={{ ...inputSm, flex: "2 1 200px", width: "auto" }} value={it.produto_id} onChange={(e) => trocarProduto(i, e.target.value)}>
                    {!p && <option value={it.produto_id}>{it.nome} (removido do catálogo)</option>}
                    {produtos.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.servico ? " (serviço)" : ""}</option>)}
                  </select>
                  {p && p.variantes.length > 1 && (
                    <select style={{ ...inputSm, flex: "1 1 150px", width: "auto" }} value={it.variante_id} onChange={(e) => trocarVariante(i, e.target.value)}>
                      {p.variantes.map((v) => <option key={v.id} value={v.id}>{descVariante(v) || "Único"} · {v.estoque} em estoque</option>)}
                    </select>
                  )}
                  {!it.servico && <input style={{ ...inputSm, width: 150 }} value={it.serie || ""} onChange={(e) => setItem(i, { serie: e.target.value })} placeholder="Nº de série" title="Nº de série" />}<input style={{ ...inputSm, width: 70 }} inputMode="numeric" value={it.qtd} onChange={(e) => setItem(i, { qtd: e.target.value as any })} title="Quantidade" />
                  <input style={{ ...inputSm, width: 110 }} inputMode="decimal" value={String(it.preco).replace(".", ",")} onChange={(e) => setItem(i, { preco: e.target.value as any })} title="Preço unitário" />
                  <b style={{ minWidth: 90, textAlign: "right", fontSize: 13.5 }}>{brl(num(it.qtd) * num(it.preco))}</b>
                  <button onClick={() => setD({ itens: f.d.itens.filter((_, j) => j !== i) })} title="Remover" style={{ border: 0, background: "#FEF2F2", color: "#B91C1C", borderRadius: 9, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="lixeira" tamanho={14} /></button>
                  {falta && <span style={{ width: "100%", fontSize: 12, color: "#B45309", fontWeight: 700 }}>Só há {est} em estoque desta {modo === "roupas" ? "peça" : "variação"}.</span>}
                </div>
              );
            })}
            <div><Btn variante="ghost" onClick={addItem}>＋ Adicionar {modo === "roupas" ? "peça" : "item"}</Btn></div>
          </div>

          <Row>
            <Field label="Desconto (R$)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={f.d.desconto ?? ""} onChange={(e) => setD({ desconto: e.target.value as any })} /></Field>
            <Field label={modo === "roupas" ? "Entrega ou retirada" : "Entrega"} flex="1 1 170px">
              <select style={inputSm} value={f.d.entrega || "retirada"} onChange={(e) => setD({ entrega: e.target.value as any, frete: e.target.value === "entrega" && !num(f.d.frete) ? cfg.taxa_entrega : e.target.value === "retirada" ? 0 : f.d.frete })}>
                <option value="entrega">Entrega</option><option value="retirada">Retirada {modo === "roupas" ? "na loja" : ""}</option>
              </select>
            </Field>
            <Field label={modo === "roupas" ? "Taxa de entrega (R$)" : "Frete (R$)"} flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={f.d.frete ?? ""} onChange={(e) => setD({ frete: e.target.value as any })} /></Field>
            <Field label="Pagamento" flex="1 1 170px"><select style={inputSm} value={f.d.pagamento || ""} onChange={(e) => setD({ pagamento: e.target.value })}><option value="">—</option>{cfg.formas_pagamento.map((x: string) => <option key={x}>{x}</option>)}</select></Field>
          </Row>
          {f.d.entrega === "entrega" && (
            <Row>
              <Field label="Endereço de entrega" flex="3 1 300px"><input style={inputSm} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} placeholder="Rua, número, bairro, complemento" /></Field>
              <Field label="Cidade" flex="1 1 140px"><input style={inputSm} value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Field>
              <Field label="Data de entrega" flex="1 1 150px"><input type="date" style={inputSm} value={f.d.data_entrega || ""} onChange={(e) => setD({ data_entrega: e.target.value })} /></Field>
              <Field label="Período" flex="1 1 120px"><select style={inputSm} value={f.d.periodo_entrega || ""} onChange={(e) => setD({ periodo_entrega: e.target.value })}><option value="">—</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></Field>
            </Row>
          )}
          {f.d.tipo === "orcamento" && <Row><Field label="Válido até" flex="0 1 200px"><input type="date" style={inputSm} value={f.d.validade || ""} onChange={(e) => setD({ validade: e.target.value })} /></Field></Row>}
          <div style={{ display: "flex", gap: 18, justifyContent: "flex-end", flexWrap: "wrap", fontSize: 13.5, color: "#475569", background: "var(--w-50)", borderRadius: 14, padding: "12px 16px" }}>
            <span>{qtdItens(f.d.itens)} {modo === "roupas" ? "peça(s)" : "item(ns)"}</span>
            <span>Subtotal <b>{brl(subtotal(f.d.itens.map((i) => ({ ...i, qtd: num(i.qtd), preco: num(i.preco) }))))}</b></span>
            {num(f.d.desconto) > 0 && <span>Desconto <b>-{brl(num(f.d.desconto))}</b></span>}
            {num(f.d.frete) > 0 && <span>{modo === "roupas" ? "Entrega" : "Frete"} <b>{brl(num(f.d.frete))}</b></span>}
            <span style={{ color: "var(--w-800)", fontSize: 16 }}>Total <b>{brl(totalPedido({ ...f.d, itens: f.d.itens.map((i) => ({ ...i, qtd: num(i.qtd), preco: num(i.preco) })), desconto: num(f.d.desconto), frete: num(f.d.frete) }))}</b></span>
          </div>
          <Field label="Observações"><textarea style={{ ...inputSm, minHeight: 60, resize: "vertical" }} value={f.d.observacoes || ""} onChange={(e) => setD({ observacoes: e.target.value })} /></Field>
          {nichoOk && <AcoesOrcamentoLoja key={atual?.id || "novo"} wsId={wsId} atual={atual} form={f} empresa={cfg.empresa} nomeLoja={empresa} onAtualizado={carregar} />}
          {atual && (ped(atual).historico || []).length > 0 && (
            <div style={{ fontSize: 12.5, color: "#64748B" }}>
              {[...(ped(atual).historico || [])].reverse().slice(0, 6).map((h, i) => <div key={i}>{new Date(h.em).toLocaleString("pt-BR")} · {h.nota}{h.por ? ` · ${nomeUsuario(usuarios, h.por)}` : ""}</div>)}
            </div>
          )}
        </Modal>
      )}
    </Page>
  );
}
