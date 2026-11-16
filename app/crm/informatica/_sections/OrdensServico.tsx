"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Btn, Banner, Field, Row, Table, Vazio, Pill, Modal, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
const MONO = "inherit";
const neon = (c?: string) => c || "var(--w-600)";
import {
  ETAPAS_OS, FLUXO_OS, OS_ABERTAS, EQUIPAMENTOS, etapaOS, os, totalOS, fimGarantia, mensagemOS, salvarOS, moverEstoque,
  brl, dataBR, hoje, num, telFmt, subtotal, mesDe, nomeUsuario, baixarCSV, type Pedido, type DadosOS, type Item, type Produto,
} from "../_dados";
import Icone from "../../../components/a2/Icone";
import BuscaProdutoLoja from "../../../components/BuscaProdutoLoja";

type Form = { nome: string; telefone1: string; cpf: string; status_venda: string; d: DadosOS };

export default function OrdensServico({ dados, alvo, gestor }: any) {
  const { wsId, empresa, ordens, cfg, usuarios, carregar } = dados as { wsId: string; empresa: string; ordens: Pedido[]; cfg: any; usuarios: any[]; carregar: () => void };
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("abertas");
  const [tecnico, setTecnico] = useState("");
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState<Pedido | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const pecas: Produto[] = (cfg.produtos || []).filter((p: Produto) => p.ativo !== false && !p.servico);
  const tecnicos: string[] = (cfg.tecnicos && cfg.tecnicos.length ? cfg.tecnicos : usuarios.map((u: any) => u.nome)).filter(Boolean);
  const hojeISO = hoje();
  const atrasada = (p: Pedido) => OS_ABERTAS.includes(p.status_venda || "RECEBIDO") && p.status_venda !== "PRONTO" && !!os(p).previsao && os(p).previsao! < hojeISO;

  const abrir = (p?: Pedido | null) => {
    setErro(""); setCopiado(false);
    if (p) { const d = os(p); setAtual(p); setF({ nome: p.nome || "", telefone1: telFmt(p.telefone1), cpf: p.cpf || "", status_venda: p.status_venda || "RECEBIDO", d: { ...d, pecas: d.pecas.map((i) => ({ ...i })) } }); }
    else { setAtual(null); setF({ nome: "", telefone1: "", cpf: "", status_venda: "RECEBIDO", d: { equipamento: "Notebook", pecas: [], mao_obra: 0, desconto: 0, garantia_dias: cfg.garantia_servico_dias ?? 90, pagamento: cfg.formas_pagamento[0] || "", previsao: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10) } }); }
    setAberto(true);
  };
  useEffect(() => {
    if (!alvo?.t) return;
    if (alvo.novo) abrir(null);
    else if (alvo.pedidoId) { const p = ordens.find((x) => x.id === alvo.pedidoId); if (p) abrir(p); }
    else if (alvo.telefone) { setBusca(alvo.telefone); setFiltro("todas"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.t, ordens.length]);

  const lista = useMemo(() => ordens.filter((p) => {
    const st = p.status_venda || "RECEBIDO", d = os(p);
    if (filtro === "abertas" && !OS_ABERTAS.includes(st)) return false;
    if (filtro === "atrasadas" && !atrasada(p)) return false;
    if (!["abertas", "todas", "atrasadas"].includes(filtro) && st !== filtro) return false;
    if (tecnico && d.tecnico !== tecnico) return false;
    const q = busca.trim().toLowerCase(), dig = busca.replace(/\D/g, "");
    return !q || `${p.nome} ${d.numero || ""} ${d.equipamento || ""} ${d.marca || ""} ${d.modelo || ""} ${d.serie || ""}`.toLowerCase().includes(q) || (dig.length >= 4 && String(p.telefone1 || "").includes(dig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }).sort((a, b) => String(os(a).previsao || "9").localeCompare(String(os(b).previsao || "9"))), [ordens, filtro, tecnico, busca]);

  // quadro da bancada: etapas abertas + entregues nos últimos 7 dias; filtra só por busca e técnico
  const [visao, setVisao] = useState<"quadro" | "lista">(() => { try { return (localStorage.getItem("wolf_info_os_visao") as any) || "quadro"; } catch { return "quadro"; } });
  const trocarVisao = (v: "quadro" | "lista") => { setVisao(v); try { localStorage.setItem("wolf_info_os_visao", v); } catch {} };
  const [sobre, setSobre] = useState("");
  const COLUNAS = [...OS_ABERTAS, "ENTREGUE"];
  const seteDias = new Date(Date.now() - 7 * 86400_000).toISOString();
  const noQuadro = ordens.filter((p) => {
    const st = p.status_venda || "RECEBIDO", d = os(p);
    if (st === "ENTREGUE" && String(d.entregue_em || p.created_at) < seteDias) return false;
    if (tecnico && d.tecnico !== tecnico) return false;
    const q = busca.trim().toLowerCase(), dig = busca.replace(/\D/g, "");
    return !q || `${p.nome} ${d.numero || ""} ${d.equipamento || ""} ${d.marca || ""} ${d.modelo || ""} ${d.serie || ""}`.toLowerCase().includes(q) || (dig.length >= 4 && String(p.telefone1 || "").includes(dig));
  }).sort((a, b) => String(os(a).previsao || "9").localeCompare(String(os(b).previsao || "9")));
  const abertas = ordens.filter((p) => OS_ABERTAS.includes(p.status_venda || "RECEBIDO"));
  const mes = new Date().toISOString().slice(0, 7);
  const servicosMes = ordens.filter((p) => p.status_venda === "ENTREGUE" && String(os(p).entregue_em || mesDe(p)).slice(0, 7) === mes).reduce((s, p) => s + totalOS(os(p)), 0);

  // ─── peças ───
  const setD = (patch: Partial<DadosOS>) => setF((x) => (x ? { ...x, d: { ...x.d, ...patch } } : x));
  const setPeca = (i: number, patch: Partial<Item>) => setF((x) => (x ? { ...x, d: { ...x.d, pecas: x.d.pecas.map((it, j) => (j === i ? { ...it, ...patch } : it)) } } : x));
  const [escolher, setEscolher] = useState<number | "novo" | null>(null);
  const addPeca = () => {
    if (!pecas.length) { setErro("Cadastre as peças em Produtos, peças e serviços para lançar na OS."); return; }
    setEscolher("novo");
  };
  const escolherPeca = (p: Produto) => {
    const item = { produto_id: p.id, variante_id: p.variantes[0]?.id || "unico", nome: p.nome, preco: num(p.preco) };
    if (escolher === "novo") setD({ pecas: [...(f?.d.pecas || []), { ...item, qtd: 1 }] });
    else if (typeof escolher === "number") setPeca(escolher, item);
    setEscolher(null);
  };
  const estoque = (it: Item) => pecas.find((p) => p.id === it.produto_id)?.variantes.find((v) => v.id === it.variante_id)?.estoque;

  async function salvar() {
    if (!f) return;
    if (!f.nome.trim()) { setErro("Informe o cliente."); return; }
    if (!f.d.defeito?.trim()) { setErro("Descreva o defeito relatado pelo cliente."); return; }
    setSalvando(true); setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const mudou = !atual || (atual.status_venda || "RECEBIDO") !== f.status_venda;
    const d: DadosOS = { ...f.d, pecas: f.d.pecas.map((i) => ({ ...i, qtd: Math.max(1, Math.round(num(i.qtd))), preco: num(i.preco) })), mao_obra: num(f.d.mao_obra), desconto: num(f.d.desconto), garantia_dias: Math.round(num(f.d.garantia_dias)) };
    if (mudou) d.historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: f.status_venda, nota: atual ? `Etapa: ${etapaOS(f.status_venda).label}` : "Equipamento recebido", por: user?.email || "" }];
    const { error } = await salvarOS(wsId, { nome: f.nome.trim(), telefone1: f.telefone1.replace(/\D/g, "") || null, cpf: f.cpf.replace(/\D/g, "") || null, status_venda: f.status_venda }, d, atual);
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setAberto(false); carregar();
  }
  async function avancar(p: Pedido, nova: string) {
    setAviso("");
    const { data: { user } } = await supabase.auth.getUser();
    const d = os(p);
    const { error } = await salvarOS(wsId, { status_venda: nova }, { ...d, historico: [...(d.historico || []), { em: new Date().toISOString(), etapa: nova, nota: `Etapa: ${etapaOS(nova).label}`, por: user?.email || "" }] }, p);
    if (error) setAviso("Erro: " + error.message); else carregar();
  }
  async function excluir() {
    if (!atual || !confirm(`Excluir a OS ${os(atual).numero || ""} de ${atual.nome}?`)) return;
    if (os(atual).estoque_baixado) await moverEstoque(wsId, os(atual).pecas, 1);
    const { error } = await supabase.from("proposta").delete().eq("workspace_id", wsId).eq("id", atual.id);
    if (error) { setErro(error.message); return; }
    setAberto(false); carregar();
  }
  const zap = (tel: string, txt: string) => `https://wa.me/55${tel.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(txt)}`;
  const proxima = (st: string) => { const i = FLUXO_OS.indexOf(st); return i >= 0 && i < FLUXO_OS.length - 1 ? FLUXO_OS[i + 1] : null; };

  return (
    <Page>
      <PageHeader titulo="Assistência técnica" subtitulo="Ordens de serviço: do recebimento à entrega, com garantia"
        acao={<div style={{ display: "flex", gap: 8 }}>
          <Btn variante="ghost" onClick={() => baixarCSV(`ordens-servico-${hojeISO}.csv`, [["OS", "Entrada", "Cliente", "Telefone", "Equipamento", "Série", "Defeito", "Técnico", "Previsão", "Etapa", "Total"], ...lista.map((p) => { const d = os(p); return [d.numero || p.id, dataBR(p.created_at), p.nome, telFmt(p.telefone1), [d.equipamento, d.marca, d.modelo].filter(Boolean).join(" "), d.serie || "", d.defeito || "", d.tecnico || "", dataBR(d.previsao), etapaOS(p.status_venda).label, totalOS(d).toFixed(2).replace(".", ",")]; })])}>Exportar</Btn>
          <Btn onClick={() => abrir(null)}>＋ Nova OS</Btn>
        </div>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      <Stats>
        <Stat label="OS abertas" icone="🛠️" valor={String(abertas.length)} />
        <Stat label="Aguardando aprovação" icone="⏳" valor={String(ordens.filter((p) => p.status_venda === "AGUARDANDO APROVACAO").length)} cor="#C2410C" sub="cliente precisa aprovar" />
        <Stat label="Prontas para retirada" icone="✅" valor={String(ordens.filter((p) => p.status_venda === "PRONTO").length)} />
        <Stat label="Atrasadas" icone="⚠️" valor={String(ordens.filter(atrasada).length)} cor="#DC2626" sub="previsão vencida" />
        <Stat label="Serviços entregues no mês" icone="💰" valor={brl(servicosMes)} />
      </Stats>
      <Row>
        <div style={{ display: "flex", border: "1px solid #E6ECEA", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
          {([["quadro", "▦ Bancada"], ["lista", "☰ Lista"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => trocarVisao(k)} style={{ border: 0, padding: "0 14px", height: 36, cursor: "pointer", fontFamily: MONO, fontSize: 12, fontWeight: 700, background: visao === k ? "var(--w-600)" : "transparent", color: visao === k ? "#fff" : "#334155" }}>{l}</button>
          ))}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, nº da OS, equipamento ou nº de série" style={{ ...inputSm, flex: "2 1 280px", width: "auto" }} />
        {visao === "lista" && <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...inputSm, flex: "1 1 190px", width: "auto" }}>
          <option value="abertas">Abertas</option><option value="atrasadas">Atrasadas</option><option value="todas">Todas</option>
          {ETAPAS_OS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>}
        <select value={tecnico} onChange={(e) => setTecnico(e.target.value)} style={{ ...inputSm, flex: "1 1 160px", width: "auto" }}><option value="">Todos os técnicos</option>{tecnicos.map((t) => <option key={t}>{t}</option>)}</select>
      </Row>
      {visao === "quadro" ? (
        <div className="info-bancada" style={{ display: "grid", gridTemplateColumns: `repeat(${COLUNAS.length}, minmax(230px, 1fr))`, gap: 12, overflowX: "auto", paddingBottom: 6 }}>
          {COLUNAS.map((col) => {
            const e = etapaOS(col), n = neon(e.cor);
            const cards = noQuadro.filter((p) => (p.status_venda || "RECEBIDO") === col);
            return (
              <div key={col} onDragOver={(ev) => { ev.preventDefault(); setSobre(col); }} onDragLeave={() => setSobre((s) => (s === col ? "" : s))}
                onDrop={(ev) => { ev.preventDefault(); setSobre(""); const id = Number(ev.dataTransfer.getData("text/plain")); const p = ordens.find((x) => x.id === id); if (p && (p.status_venda || "RECEBIDO") !== col) avancar(p, col); }}
                style={{ background: sobre === col ? `color-mix(in srgb, ${n} 10%, #F3F6F5)` : "#F3F6F5", border: `1px solid ${sobre === col ? n : "#E6ECEA"}`, borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 360, transition: "background .15s, border-color .15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderBottom: "1px solid #E6ECEA", borderTop: `2px solid ${n}`, borderRadius: "12px 12px 0 0" }}>
                  <i style={{ width: 7, height: 7, borderRadius: 7, background: n, boxShadow: `0 0 10px ${n}` }} />
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: "#0F172A", letterSpacing: ".01em" }}>{e.curto}</span>
                  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: n, border: `1px solid color-mix(in srgb, ${n} 40%, transparent)`, borderRadius: 5, padding: "1px 7px" }}>{cards.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, flex: 1 }}>
                  {cards.length === 0 && <div style={{ border: "1px dashed #E6ECEA", borderRadius: 9, padding: "18px 10px", textAlign: "center", fontSize: 12, color: "#94A3B8", fontFamily: MONO }}>vazio</div>}
                  {cards.map((p) => {
                    const d = os(p), atr = atrasada(p), prox = proxima(p.status_venda || "RECEBIDO");
                    return (
                      <div key={p.id} draggable onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", String(p.id)); ev.dataTransfer.effectAllowed = "move"; }} onClick={() => abrir(p)} className="info-cartao-os"
                        style={{ background: "#fff", border: `1px solid ${atr ? "rgba(248,113,113,.55)" : "#E6ECEA"}`, borderRadius: 9, padding: "10px 11px", cursor: "grab", display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: "var(--w-600)" }}>{d.numero || `#${p.id}`}</span>
                          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "#334155" }}>{totalOS(d) ? brl(totalOS(d)) : ""}</span>
                        </div>
                        <b style={{ fontSize: 13, color: "#0F172A" }}>{[d.equipamento, d.marca, d.modelo].filter(Boolean).join(" ") || "Equipamento"}</b>
                        <span style={{ fontSize: 12, color: "#64748B", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.defeito || "—"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</span>
                          {d.tecnico && <span style={{ marginLeft: "auto", fontFamily: MONO, background: "#F3F6F5", border: "1px solid #E6ECEA", borderRadius: 5, padding: "1px 6px", color: "#334155", whiteSpace: "nowrap" }}>{d.tecnico.split(" ")[0]}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #E6ECEA", paddingTop: 6, marginTop: 2 }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: atr ? "#B91C1C" : "#94A3B8", fontWeight: atr ? 800 : 500 }}>{d.previsao ? `${atr ? "⚠ " : "⏱ "}${dataBR(d.previsao).slice(0, 5)}` : ""}</span>
                          {p.telefone1 && <a onClick={(ev) => ev.stopPropagation()} href={zap(p.telefone1, mensagemOS(p, d, p.status_venda || "RECEBIDO", empresa))} target="_blank" rel="noreferrer" title="Avisar o cliente no WhatsApp" style={{ marginLeft: "auto", display: "inline-flex" }}><Icone nome="whatsapp" tamanho={15} cor="#16A34A" /></a>}
                          {prox && <button onClick={(ev) => { ev.stopPropagation(); avancar(p, prox); }} title={`Mover para ${etapaOS(prox).label}`} style={{ marginLeft: p.telefone1 ? 4 : "auto", border: "1px solid #E6ECEA", background: "transparent", color: "#334155", borderRadius: 6, height: 24, padding: "0 8px", fontSize: 11, fontFamily: MONO, cursor: "pointer" }}>{etapaOS(prox).curto} →</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <Table cols={[{ label: "OS" }, { label: "Cliente" }, { label: "Equipamento / defeito" }, { label: "Técnico / previsão" }, { label: "Total", align: "right" }, { label: "Etapa" }, { label: "", align: "right" }]}
        empty={lista.length === 0 ? <Vazio icone="🛠️" titulo={ordens.length ? "Nenhuma OS neste filtro" : "Nenhuma ordem de serviço ainda"} sub="Registre a entrada do equipamento com o defeito relatado." acao={!ordens.length ? <Btn onClick={() => abrir(null)}>＋ Nova OS</Btn> : undefined} /> : undefined}>
        {lista.map((p) => {
          const d = os(p), e = etapaOS(p.status_venda), prox = proxima(p.status_venda || "RECEBIDO");
          return (
            <tr key={p.id}>
              <td style={{ ...tdStyle, cursor: "pointer" }} onClick={() => abrir(p)}><b>{d.numero || `#${p.id}`}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{dataBR(p.created_at)}</div></td>
              <td style={{ ...tdStyle, cursor: "pointer" }} onClick={() => abrir(p)}><b>{p.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{telFmt(p.telefone1)}</div></td>
              <td style={{ ...tdStyle, cursor: "pointer", maxWidth: 280 }} onClick={() => abrir(p)}>{[d.equipamento, d.marca, d.modelo].filter(Boolean).join(" ")}{d.serie ? <span style={{ color: "#94A3B8" }}> · S/N {d.serie}</span> : null}<div style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.defeito}</div></td>
              <td style={tdStyle}>{d.tecnico || "—"}<div style={{ fontSize: 12, color: atrasada(p) ? "#DC2626" : "#94A3B8", fontWeight: atrasada(p) ? 800 : 500 }}>{d.previsao ? `${atrasada(p) ? "atrasada · " : ""}${dataBR(d.previsao)}` : ""}</div></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(totalOS(d))}</td>
              <td style={tdStyle}><Pill texto={e.label} cor={e.cor} /></td>
              <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                {p.telefone1 && <a href={zap(p.telefone1, mensagemOS(p, d, p.status_venda || "RECEBIDO", empresa))} target="_blank" rel="noreferrer" title="Avisar o cliente no WhatsApp" style={{ marginRight: 6, display: "inline-flex", verticalAlign: "middle" }}><Icone nome="whatsapp" tamanho={18} cor="#16A34A" /></a>}
                {prox && <Btn variante="ghost" onClick={() => avancar(p, prox)}>{etapaOS(prox).curto} →</Btn>}
              </td>
            </tr>
          );
        })}
      </Table>
      )}

      {aberto && f && (
        <Modal titulo={atual ? `OS ${f.d.numero || ""} · ${atual.nome}` : "Nova ordem de serviço"} onClose={() => setAberto(false)} maxWidth={920}
          footer={<>
            {atual && gestor && <Btn variante="danger" onClick={excluir}>Excluir</Btn>}
            <Btn variante="ghost" onClick={async () => { await navigator.clipboard.writeText(mensagemOS({ nome: f.nome }, f.d, f.status_venda, empresa)); setCopiado(true); }}>{copiado ? "Copiado ✓" : "Copiar mensagem"}</Btn>
            {f.telefone1.replace(/\D/g, "").length >= 10 && <a href={zap(f.telefone1, mensagemOS({ nome: f.nome }, f.d, f.status_venda, empresa))} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Btn variante="ghost">Avisar no WhatsApp</Btn></a>}
            <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar OS"}</Btn>
          </>}>
          {erro && <Banner tipo="warn">{erro}</Banner>}
          <Row>
            <Field label="Cliente" flex="2 1 220px"><input style={inputSm} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
            <Field label="WhatsApp" flex="1 1 150px"><input style={inputSm} value={f.telefone1} onChange={(e) => setF({ ...f, telefone1: e.target.value })} placeholder="(00) 00000-0000" /></Field>
            <Field label="CPF / CNPJ" flex="1 1 150px"><input style={inputSm} value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Field>
            <Field label="Etapa" flex="1 1 190px"><select style={inputSm} value={f.status_venda} onChange={(e) => setF({ ...f, status_venda: e.target.value })}>{ETAPAS_OS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></Field>
          </Row>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--w-700)", letterSpacing: ".04em", textTransform: "uppercase" }}>Equipamento</div>
          <Row>
            <Field label="Tipo" flex="1 1 150px"><select style={inputSm} value={f.d.equipamento || ""} onChange={(e) => setD({ equipamento: e.target.value })}>{EQUIPAMENTOS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Marca" flex="1 1 130px"><input style={inputSm} value={f.d.marca || ""} onChange={(e) => setD({ marca: e.target.value })} placeholder="Dell, Lenovo, HP…" /></Field>
            <Field label="Modelo" flex="1 1 150px"><input style={inputSm} value={f.d.modelo || ""} onChange={(e) => setD({ modelo: e.target.value })} /></Field>
            <Field label="Nº de série" flex="1 1 150px"><input style={inputSm} value={f.d.serie || ""} onChange={(e) => setD({ serie: e.target.value })} /></Field>
          </Row>
          <Row>
            <Field label="Acessórios deixados" flex="2 1 240px"><input style={inputSm} value={f.d.acessorios || ""} onChange={(e) => setD({ acessorios: e.target.value })} placeholder="Carregador, bolsa, mouse…" /></Field>
            <Field label="Senha / padrão de desbloqueio" flex="1 1 180px"><input style={inputSm} value={f.d.senha || ""} onChange={(e) => setD({ senha: e.target.value })} /></Field>
          </Row>
          <Field label="Defeito relatado pelo cliente"><textarea style={{ ...inputSm, minHeight: 56, resize: "vertical" }} value={f.d.defeito || ""} onChange={(e) => setD({ defeito: e.target.value })} placeholder="Ex.: não liga, tela piscando, lento, não carrega" /></Field>
          <Field label="Diagnóstico / laudo técnico"><textarea style={{ ...inputSm, minHeight: 56, resize: "vertical" }} value={f.d.diagnostico || ""} onChange={(e) => setD({ diagnostico: e.target.value })} placeholder="O que foi encontrado e o que precisa ser feito" /></Field>
          <Row>
            <Field label="Técnico" flex="1 1 180px"><select style={inputSm} value={f.d.tecnico || ""} onChange={(e) => setD({ tecnico: e.target.value })}><option value="">—</option>{tecnicos.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Previsão de entrega" flex="1 1 160px"><input type="date" style={inputSm} value={f.d.previsao || ""} onChange={(e) => setD({ previsao: e.target.value })} /></Field>
            <Field label="Garantia do serviço (dias)" flex="1 1 150px"><input style={inputSm} inputMode="numeric" value={f.d.garantia_dias ?? ""} onChange={(e) => setD({ garantia_dias: e.target.value as any })} /></Field>
          </Row>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--w-700)", letterSpacing: ".04em", textTransform: "uppercase" }}>Peças e serviço</div>
          {f.d.pecas.map((it, i) => {
            const est = estoque(it), falta = est !== undefined && num(it.qtd) > num(est) && !(atual && os(atual).estoque_baixado);
            return (
              <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#F3F6F5", borderRadius: 12, padding: 8 }}>
                <button type="button" onClick={() => setEscolher(i)} title="Trocar peça" style={{ ...inputSm, flex: "2 1 220px", width: "auto", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", background: "#fff" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flex: "0 0 auto" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{it.nome}</span>
                </button>
                <input style={{ ...inputSm, width: 70 }} inputMode="numeric" value={it.qtd} onChange={(e) => setPeca(i, { qtd: e.target.value as any })} title="Quantidade" />
                <input style={{ ...inputSm, width: 110 }} inputMode="decimal" value={String(it.preco).replace(".", ",")} onChange={(e) => setPeca(i, { preco: e.target.value as any })} title="Preço" />
                <b style={{ minWidth: 90, textAlign: "right", fontSize: 13.5 }}>{brl(num(it.qtd) * num(it.preco))}</b>
                <button onClick={() => setD({ pecas: f.d.pecas.filter((_, j) => j !== i) })} style={{ border: 0, background: "#FEF2F2", color: "#B91C1C", borderRadius: 9, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="lixeira" tamanho={14} /></button>
                {falta && <span style={{ width: "100%", fontSize: 12, color: "#B45309", fontWeight: 700 }}>Só há {est} em estoque.</span>}
              </div>
            );
          })}
          <div><Btn variante="ghost" onClick={addPeca}>＋ Adicionar peça do estoque</Btn></div>
          {escolher !== null && <BuscaProdutoLoja produtos={pecas} titulo={escolher === "novo" ? "Adicionar peça" : "Trocar peça"} onEscolher={escolherPeca} onFechar={() => setEscolher(null)} />}
          <Row>
            <Field label="Mão de obra (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={f.d.mao_obra ?? ""} onChange={(e) => setD({ mao_obra: e.target.value as any })} /></Field>
            <Field label="Desconto (R$)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={f.d.desconto ?? ""} onChange={(e) => setD({ desconto: e.target.value as any })} /></Field>
            <Field label="Pagamento" flex="1 1 170px"><select style={inputSm} value={f.d.pagamento || ""} onChange={(e) => setD({ pagamento: e.target.value })}><option value="">—</option>{cfg.formas_pagamento.map((x: string) => <option key={x}>{x}</option>)}</select></Field>
          </Row>
          <div style={{ display: "flex", gap: 18, justifyContent: "flex-end", flexWrap: "wrap", fontSize: 13.5, color: "#334155", background: "var(--w-50)", borderRadius: 14, padding: "12px 16px" }}>
            <span>Peças <b>{brl(subtotal(f.d.pecas.map((i) => ({ ...i, qtd: num(i.qtd), preco: num(i.preco) }))))}</b></span>
            <span>Mão de obra <b>{brl(num(f.d.mao_obra))}</b></span>
            {num(f.d.desconto) > 0 && <span>Desconto <b>-{brl(num(f.d.desconto))}</b></span>}
            <span style={{ color: "var(--w-800)", fontSize: 16 }}>Total <b>{brl(totalOS({ ...f.d, pecas: f.d.pecas.map((i) => ({ ...i, qtd: num(i.qtd), preco: num(i.preco) })) }))}</b></span>
          </div>
          {atual && os(atual).entregue_em && num(os(atual).garantia_dias) > 0 && <div style={{ fontSize: 13, color: "#334155" }}>Garantia do serviço até <b>{dataBR(fimGarantia(os(atual)))}</b>{fimGarantia(os(atual)) < hojeISO ? " (vencida)" : ""}.</div>}
          <Field label="Observações internas"><textarea style={{ ...inputSm, minHeight: 50, resize: "vertical" }} value={f.d.observacoes || ""} onChange={(e) => setD({ observacoes: e.target.value })} /></Field>
          {atual && (os(atual).historico || []).length > 0 && (
            <div style={{ fontSize: 12.5, color: "#64748B" }}>{[...(os(atual).historico || [])].reverse().slice(0, 8).map((h, i) => <div key={i}>{new Date(h.em).toLocaleString("pt-BR")} · {h.nota}{h.por ? ` · ${nomeUsuario(usuarios, h.por)}` : ""}</div>)}</div>
          )}
        </Modal>
      )}
    </Page>
  );
}
