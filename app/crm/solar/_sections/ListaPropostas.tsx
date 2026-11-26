"use client";
import { useEffect, useMemo, useState } from "react";
import { Empty } from "../../financeiro/_sections/_ui";
import Icone from "../../../components/a2/Icone";
import { ETAPAS_SOLAR, etapaSolar, brl, brl0, kwpTxt } from "../../../lib/solar";
import {
  sol, dataBR, expirada, linkProposta, gerarLinkSolar, excluirPropostaSolar, salvarPropostaSolar, nomeUsuario,
  type PropostaSolar,
} from "../_dados";
import EditorSolar from "./EditorSolar";
import { SxTitulo } from "./_sx";

// Propostas: todas numa lista, com as ações à mão (abrir/editar, link, PDF,
// WhatsApp, recalcular com os preços atuais e excluir).

function situacao(p: PropostaSolar) {
  const d = sol(p);
  if (d.aceite) return { t: "✓ aceita", c: "#136633", f: "#E6F4E9" };
  if (d.recusa) return { t: "recusada", c: "#B91C1C", f: "#FDECEC" };
  if (!d.token) return { t: "sem link", c: "#64748B", f: "#F1F5F9" };
  if (expirada(d)) return { t: "link vencido", c: "#B45309", f: "#FFF1E6" };
  if (d.visualizado_em) return { t: "👀 cliente viu", c: "#1D4ED8", f: "#EAF0FF" };
  return { t: "link enviado", c: "#5B6B63", f: "#F1F4EC" };
}

export default function ListaPropostas({ dados, alvo }: any) {
  const { propostas, carregando, erro, usuarios, wsId, cfg, carregar } = dados as { propostas: PropostaSolar[]; carregando: boolean; erro: string; usuarios: any[]; wsId: string; cfg: any; carregar: () => Promise<void> };
  const [aberta, setAberta] = useState<number | "nova" | null>(null);
  const [preenchido, setPreenchido] = useState<any>(null);
  const [etapa, setEtapa] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (alvo?.propostaId) { setAberta(alvo.propostaId); setPreenchido(null); }
    else if (alvo?.novo) { setAberta("nova"); setPreenchido(alvo.preenchido || null); }
    else if (alvo?.etapa !== undefined) { setEtapa(alvo.etapa); setAberta(null); }
  }, [alvo?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(""), 4000); };

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return propostas.filter((p) => (!etapa || (p.status_venda || "LEAD") === etapa)
      && (!q || [p.nome, p.telefone1, p.cidade, sol(p).numero].some((x) => String(x || "").toLowerCase().includes(q))));
  }, [propostas, etapa, busca]);

  if (aberta !== null) {
    const p = aberta === "nova" ? null : propostas.find((x) => x.id === aberta) || null;
    return (
      <div>
        <SxTitulo titulo={p ? p.nome : "Nova proposta solar"} sub={p ? `Proposta ${sol(p).numero || p.id} · ${etapaSolar(p.status_venda).label} · criada em ${dataBR(p.created_at)}` : "Preencha a conta de luz: o sistema é calculado na hora"}
          acao={<button className="sx-btn sx-btn-leve" onClick={() => setAberta(null)}>← Voltar às propostas</button>} />
        <EditorSolar key={String(aberta)} dados={dados} proposta={p} preenchido={preenchido} onSalvo={(id) => setAberta(id)} onFechar={() => setAberta(null)} />
      </div>
    );
  }

  /** Gera o link se ainda não houver (ou se venceu) e devolve a URL. */
  const garantirLink = async (p: PropostaSolar) => {
    const d = sol(p);
    if (d.token && !expirada(d)) return linkProposta(d.token, wsId);
    const token = await gerarLinkSolar(wsId, p, cfg);
    await carregar();
    return linkProposta(token, wsId);
  };

  const acao = async (p: PropostaSolar, tipo: "link" | "pdf" | "zap" | "recalcular" | "excluir") => {
    if (ocupado) return;
    if (tipo === "excluir" && !confirm(`Excluir a proposta de ${p.nome}? Não dá para desfazer.`)) return;
    if (tipo === "recalcular" && !confirm(`Recalcular a proposta de ${p.nome} com os preços, kits e juros atuais? O link continua o mesmo.`)) return;
    // abre a aba antes do await para o navegador não bloquear
    const janela = tipo === "pdf" || tipo === "zap" ? window.open("about:blank", "_blank") : null;
    setOcupado(p.id);
    try {
      if (tipo === "excluir") { await excluirPropostaSolar(wsId, p.id); await carregar(); avisar("Proposta excluída."); return; }
      if (tipo === "recalcular") {
        const d = sol(p);
        await salvarPropostaSolar(wsId, cfg, { nome: p.nome, telefone1: p.telefone1 || "", email: p.email || "", cpf: p.cpf || "", endereco: p.endereco || "", cidade: p.cidade || "", estado: p.estado || "" }, d.entrada || {}, p);
        await carregar(); avisar("Proposta recalculada com os valores atuais."); return;
      }
      const url = await garantirLink(p);
      if (tipo === "link") { try { await navigator.clipboard.writeText(url); avisar("Link copiado: " + url); } catch { prompt("Copie o link:", url); } return; }
      if (tipo === "pdf") { if (janela) janela.location.href = url + "/pdf"; return; }
      const fone = String(p.telefone1 || "").replace(/\D/g, "");
      const r = sol(p).resultado;
      const texto = `Olá, ${p.nome.split(" ")[0] || ""}! ☀️ Segue a sua proposta de energia solar${r ? ` de ${kwpTxt(r.kwp)}` : ""}.${r ? `\n\nEconomia estimada: ${brl(r.economia_mes)}/mês.\nInvestimento: ${brl(r.preco)}.` : ""}\n\nVeja tudo, baixe em PDF e aprove por aqui:\n${url}`;
      const zap = `https://wa.me/${fone.length >= 10 ? (fone.startsWith("55") ? fone : "55" + fone) : ""}?text=${encodeURIComponent(texto)}`;
      if (janela) janela.location.href = zap; else window.open(zap, "_blank");
    } catch (e: any) {
      janela?.close();
      avisar("Erro: " + (e?.message || e));
    } finally { setOcupado(null); }
  };

  const contagem = (k: string) => propostas.filter((p) => (p.status_venda || "LEAD") === k).length;
  const Bt = ({ t, i, onClick, perigo }: { t: string; i: string; onClick: () => void; perigo?: boolean }) => (
    <button title={t} onClick={(e) => { e.stopPropagation(); onClick(); }} className="sx-lp-bt" style={perigo ? { color: "#B91C1C" } : undefined}><Icone nome={i} tamanho={14} /><span>{t}</span></button>
  );

  return (
    <div>
      <style>{`
        .sx-lp{display:flex;flex-direction:column;gap:10px}
        .sx-lp-it{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 12px 26px -20px rgba(11,51,36,.45);border:1px solid #EEF0E8;display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(140px,1fr) minmax(110px,.8fr) auto;gap:14px;align-items:center;cursor:pointer}
        .sx-lp-it:hover{border-color:#D8C98F}
        .sx-lp-n{font-weight:800;color:#0F172A;font-size:14.5px}
        .sx-lp-s{color:#7A8A80;font-size:12px;margin-top:2px}
        .sx-lp-v{font-weight:800;color:#0B3324;font-size:15px}
        .sx-lp-ac{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
        .sx-lp-bt{display:inline-flex;align-items:center;gap:5px;border:1px solid #E5E8DE;background:#FAFAF6;border-radius:10px;padding:6px 9px;font-size:12px;font-weight:700;color:#24443A;cursor:pointer}
        .sx-lp-bt:hover{background:#F3EFD9}
        @media (max-width:900px){.sx-lp-it{grid-template-columns:1fr 1fr}.sx-lp-ac{grid-column:1/-1;justify-content:flex-start}}
      `}</style>
      <SxTitulo titulo="Propostas" sub="Todas as propostas: abra para editar, copie o link, baixe o PDF, mande no WhatsApp ou exclua."
        acao={<>
          <input className="sx-input" style={{ width: 220 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, cidade, nº" />
          <button className="sx-btn sx-btn-verde" onClick={() => { setPreenchido(null); setAberta("nova"); }}>+ Nova proposta</button>
        </>} />
      {erro && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 8 }}>{erro}</div>}
      {aviso && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 90, background: "#0B3324", color: "#FFF3C4", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)", maxWidth: "90vw", wordBreak: "break-all" }}>{aviso}</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setEtapa("")} className={`sx-chip${!etapa ? " on" : ""}`}>Todas ({propostas.length})</button>
        {ETAPAS_SOLAR.map((e) => <button key={e.key} onClick={() => setEtapa(e.key)} className={`sx-chip${etapa === e.key ? " on" : ""}`}>{e.curto} ({contagem(e.key)})</button>)}
      </div>

      {carregando ? <div style={{ padding: 30, color: "#94A3B8" }}>Carregando…</div> : !lista.length ? (
        <Empty icone="☀️" titulo="Nenhuma proposta aqui" sub="Clique em “+ Nova proposta” e preencha a conta de luz do cliente." />
      ) : (
        <div className="sx-lp">
          {lista.map((p) => {
            const d = sol(p), r = d.resultado, e = etapaSolar(p.status_venda), s = situacao(p);
            return (
              <div key={p.id} className="sx-lp-it" onClick={() => setAberta(p.id)} style={{ opacity: ocupado === p.id ? 0.55 : 1 }}>
                <div>
                  <div className="sx-lp-n">{p.nome}{d.canal === "whatsapp_ia" && <span className="sx-tag" style={{ marginLeft: 6, background: "#FFF6DA", color: "#8A6314" }}>IA</span>}</div>
                  <div className="sx-lp-s">{[d.numero, dataBR(p.created_at), p.cidade && `${p.cidade}/${p.estado || ""}`, nomeUsuario(usuarios, p.vendedor)].filter(Boolean).join(" · ")}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span className="sx-tag" style={{ background: `${e.cor}1A`, color: e.cor }}>{e.label}</span>
                    <span className="sx-tag" style={{ background: s.f, color: s.c }}>{s.t}</span>
                  </div>
                </div>
                <div>
                  {r ? <><div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13.5 }}>{kwpTxt(r.kwp)} · {r.paineis} placas</div>
                    <div className="sx-lp-s">{r.consumo_kwh} kWh/mês · economia {brl0(r.economia_mes)}/mês{r.linha_nome ? ` · ${r.linha_nome}` : ""}</div></> : <span className="sx-lp-s">sem cálculo</span>}
                </div>
                <div className="sx-lp-v">{brl(Number(p.valor_plano) || 0)}</div>
                <div className="sx-lp-ac">
                  <Bt t="Abrir / editar" i="editar" onClick={() => setAberta(p.id)} />
                  <Bt t="Copiar link" i="link" onClick={() => acao(p, "link")} />
                  <Bt t="PDF" i="download" onClick={() => acao(p, "pdf")} />
                  <Bt t="WhatsApp" i="whatsapp" onClick={() => acao(p, "zap")} />
                  <Bt t="Recalcular" i="atualizar" onClick={() => acao(p, "recalcular")} />
                  <Bt t="Excluir" i="lixeira" perigo onClick={() => acao(p, "excluir")} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
