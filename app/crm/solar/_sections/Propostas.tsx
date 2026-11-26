"use client";
import { useEffect, useMemo, useState } from "react";
import { Table, Empty, tdStyle } from "../../financeiro/_sections/_ui";
import { ETAPAS_SOLAR, etapaSolar, brl, brl0, kwpTxt } from "../../../lib/solar";
import { sol, dataBR, expirada, baixarCSV, nomeUsuario, mudarEtapaSolar, diasDesde, entrouNaEtapa, type PropostaSolar } from "../_dados";
import EditorSolar from "./EditorSolar";
import { SxTitulo } from "./_sx";

// Funil de vendas solar: quadro (arrastar entre etapas) ou lista.
const COLUNAS = ["LEAD", "PROPOSTA ENVIADA", "ACEITA", "VISITA TECNICA", "CONTRATO", "PERDIDA"];

function selo(p: PropostaSolar) {
  const d = sol(p);
  if (d.aceite) return { t: "✓ aceita", c: "#136633", f: "#E6F4E9" };
  if (d.recusa) return { t: "recusada", c: "#B91C1C", f: "#FDECEC" };
  if (!d.token) return null;
  if (expirada(d)) return { t: "link vencido", c: "#B45309", f: "#FFF1E6" };
  if (d.visualizado_em) return { t: "👀 viu", c: "#1D4ED8", f: "#EAF0FF" };
  return { t: "enviada", c: "#5B6B63", f: "#F1F4EC" };
}

export default function Propostas({ dados, alvo }: any) {
  const { propostas, carregando, erro, usuarios, wsId, carregar } = dados as { propostas: PropostaSolar[]; carregando: boolean; erro: string; usuarios: any[]; wsId: string; carregar: () => Promise<void> };
  const [aberta, setAberta] = useState<number | "nova" | null>(null);
  const [preenchido, setPreenchido] = useState<any>(null);
  const [etapa, setEtapa] = useState("");
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"quadro" | "lista">("quadro");
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvoCol, setAlvoCol] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => { try { const m = localStorage.getItem("wolf_solar_funil"); if (m === "lista" || m === "quadro") setModo(m); } catch {} }, []);
  useEffect(() => {
    if (alvo?.propostaId) { setAberta(alvo.propostaId); setPreenchido(null); }
    else if (alvo?.novo) { setAberta("nova"); setPreenchido(alvo.preenchido || null); }
    else if (alvo?.etapa !== undefined) { setEtapa(alvo.etapa); setAberta(null); setModo("lista"); }
  }, [alvo?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  const trocarModo = (m: "quadro" | "lista") => { setModo(m); try { localStorage.setItem("wolf_solar_funil", m); } catch {} };

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return propostas.filter((p) => (!etapa || modo === "quadro" || (p.status_venda || "LEAD") === etapa)
      && (!q || [p.nome, p.telefone1, p.cidade, sol(p).numero].some((x) => String(x || "").toLowerCase().includes(q))));
  }, [propostas, etapa, busca, modo]);

  const mover = async (id: number, nova: string) => {
    const p = propostas.find((x) => x.id === id);
    setArrastando(null); setAlvoCol("");
    if (!p || (p.status_venda || "LEAD") === nova) return;
    const { error } = await mudarEtapaSolar(wsId, p, nova);
    if (error) setAviso(error.message); else { setAviso(`${p.nome} → ${etapaSolar(nova).label}`); await carregar(); }
    setTimeout(() => setAviso(""), 3500);
  };

  if (aberta !== null) {
    const p = aberta === "nova" ? null : propostas.find((x) => x.id === aberta) || null;
    return (
      <div>
        <SxTitulo titulo={p ? p.nome : "Nova proposta solar"} sub={p ? `Proposta ${sol(p).numero || p.id} · ${etapaSolar(p.status_venda).label} · criada em ${dataBR(p.created_at)}` : "Preencha a conta de luz: o sistema é calculado na hora"}
          acao={<button className="sx-btn sx-btn-leve" onClick={() => setAberta(null)}>← Voltar ao funil</button>} />
        <EditorSolar key={String(aberta)} dados={dados} proposta={p} preenchido={preenchido} onSalvo={(id) => setAberta(id)} onFechar={() => setAberta(null)} />
      </div>
    );
  }

  const contagem = (k: string) => propostas.filter((p) => (p.status_venda || "LEAD") === k).length;
  const exportar = () => baixarCSV("propostas-solar.csv", [
    ["Número", "Data", "Cliente", "WhatsApp", "Cidade", "UF", "Etapa", "kWp", "Painéis", "Consumo kWh", "Economia/mês", "Valor", "Vendedor"],
    ...lista.map((p) => { const r = sol(p).resultado; return [sol(p).numero || p.id, dataBR(p.created_at), p.nome, p.telefone1 || "", p.cidade || "", p.estado || "", etapaSolar(p.status_venda).label, r?.kwp || "", r?.paineis || "", r?.consumo_kwh || "", r?.economia_mes || "", p.valor_plano || 0, nomeUsuario(usuarios, p.vendedor)]; }),
  ]);

  return (
    <div>
      <SxTitulo titulo="Funil de vendas" sub="Arraste o cartão para mudar de etapa. Clique para abrir a proposta."
        acao={<>
          <div style={{ display: "flex", background: "#fff", borderRadius: 12, padding: 4, boxShadow: "inset 0 0 0 1px #E7E9DF" }}>
            {(["quadro", "lista"] as const).map((m) => <button key={m} className={`sx-chip${modo === m ? " on" : ""}`} style={{ padding: "7px 12px" }} onClick={() => trocarModo(m)}>{m === "quadro" ? "Quadro" : "Lista"}</button>)}
          </div>
          <input className="sx-input" style={{ width: 220 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, cidade, nº" />
          <button className="sx-btn sx-btn-leve" onClick={exportar}>Exportar</button>
          <button className="sx-btn sx-btn-verde" onClick={() => { setPreenchido(null); setAberta("nova"); }}>+ Nova proposta</button>
        </>} />
      {erro && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 8 }}>{erro}</div>}
      {aviso && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 90, background: "#0B3324", color: "#FFF3C4", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: "0 18px 40px -16px rgba(0,0,0,.6)" }}>{aviso}</div>}

      {carregando ? <div style={{ padding: 30, color: "#94A3B8" }}>Carregando…</div> : modo === "quadro" ? (
        <div className="sx-quadro">
          {COLUNAS.map((c) => {
            const e = etapaSolar(c);
            const l = lista.filter((p) => (p.status_venda || "LEAD") === c);
            return (
              <div key={c} className={`sx-col${alvoCol === c ? " alvo" : ""}`}
                onDragOver={(ev) => { ev.preventDefault(); if (alvoCol !== c) setAlvoCol(c); }}
                onDragLeave={() => setAlvoCol("")}
                onDrop={(ev) => { ev.preventDefault(); const id = Number(ev.dataTransfer.getData("text/plain") || arrastando); if (id) mover(id, c); }}>
                <div className="sx-col-t"><i style={{ background: e.cor }} /><b>{e.label}</b><em>{l.length}</em></div>
                <div className="sx-col-soma">{brl0(l.reduce((s, p) => s + (Number(p.valor_plano) || 0), 0))}</div>
                {l.map((p) => {
                  const d = sol(p), r = d.resultado, s = selo(p), dias = diasDesde(entrouNaEtapa(p));
                  return (
                    <div key={p.id} className="sx-cartao" draggable onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", String(p.id)); setArrastando(p.id); }} onDragEnd={() => { setArrastando(null); setAlvoCol(""); }}
                      onClick={() => setAberta(p.id)} style={{ opacity: arrastando === p.id ? 0.5 : 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <b style={{ flex: 1, minWidth: 0 }}>{p.nome}</b>
                        {d.canal === "whatsapp_ia" && <span className="sx-tag" style={{ background: "#FFF6DA", color: "#8A6314" }}>IA</span>}
                      </div>
                      <div className="sx-cartao-v">{brl(Number(p.valor_plano) || 0)}</div>
                      <div className="sx-cartao-l">{r ? <>{kwpTxt(r.kwp)} · {r.paineis} painéis · {brl0(r.economia_mes)}/mês</> : "sem cálculo"}</div>
                      <div className="sx-cartao-l">
                        {s && <span className="sx-tag" style={{ background: s.f, color: s.c }}>{s.t}</span>}
                        <span style={{ marginLeft: "auto", color: dias > 5 ? "#B45309" : "#94A39A" }}>{dias ? `${dias}d na etapa` : "hoje"}</span>
                      </div>
                    </div>
                  );
                })}
                {!l.length && <div style={{ fontSize: 12, color: "#9AA89F", padding: "10px 6px" }}>Solte um cartão aqui</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => setEtapa("")} className={`sx-chip${!etapa ? " on" : ""}`}>Todas ({propostas.length})</button>
            {ETAPAS_SOLAR.map((e) => <button key={e.key} onClick={() => setEtapa(e.key)} className={`sx-chip${etapa === e.key ? " on" : ""}`}>{e.curto} ({contagem(e.key)})</button>)}
          </div>
          {!lista.length ? (
            <Empty icone="☀️" titulo="Nenhuma proposta aqui" sub="Crie a primeira proposta com a conta de luz do cliente, ou ligue a Vendedora IA para ela criar sozinha no WhatsApp." />
          ) : (
            <Table cols={[{ label: "Cliente" }, { label: "Sistema" }, { label: "Economia" }, { label: "Valor", align: "right" }, { label: "Etapa" }, { label: "Link" }]}>
              {lista.map((p) => {
                const d = sol(p), r = d.resultado, e = etapaSolar(p.status_venda), s = selo(p);
                return (
                  <tr key={p.id} onClick={() => setAberta(p.id)} style={{ cursor: "pointer" }}>
                    <td style={tdStyle}><b>{p.nome}</b><div style={{ color: "#94A3B8", fontSize: 12 }}>{[d.numero, p.cidade && `${p.cidade}/${p.estado || ""}`, dataBR(p.created_at), d.canal === "whatsapp_ia" ? "pela IA" : ""].filter(Boolean).join(" · ")}</div></td>
                    <td style={tdStyle}>{r ? <>{kwpTxt(r.kwp)}<div style={{ color: "#94A3B8", fontSize: 12 }}>{r.paineis} painéis · {r.consumo_kwh} kWh</div></> : "—"}</td>
                    <td style={tdStyle}>{r ? `${brl(r.economia_mes)}/mês` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(Number(p.valor_plano) || 0)}</td>
                    <td style={tdStyle}><span className="sx-tag" style={{ background: `${e.cor}1A`, color: e.cor }}>{e.curto}</span></td>
                    <td style={tdStyle}>{s ? <span className="sx-tag" style={{ background: s.f, color: s.c }}>{s.t}</span> : "—"}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </>
      )}
    </div>
  );
}
