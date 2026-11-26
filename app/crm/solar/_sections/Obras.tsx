"use client";
import { useEffect, useState } from "react";
import { Empty } from "../../financeiro/_sections/_ui";
import { ETAPAS_SOLAR, PASSOS_OBRA, TOTAL_PASSOS, progressoObra, etapaSolar, brl, kwpTxt, type ObraSolar } from "../../../lib/solar";
import { sol, mudarEtapaSolar, salvarObraSolar, dataBR, dataHoraBR, diasDesde, entrouNaEtapa, type PropostaSolar } from "../_dados";
import { SxTitulo } from "./_sx";

// Projetos e homologação: do aceite ao sistema ligado, com checklist de documentos,
// projeto, distribuidora e instalação, e a procuração pronta para assinar.
const COLUNAS = ["ACEITA", "VISITA TECNICA", "CONTRATO", "HOMOLOGACAO", "INSTALACAO", "CONCLUIDA"];
const so = (v: any) => String(v || "").replace(/\D/g, "");
const cpfFmt = (v: string) => { const d = so(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : v; };
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function proximoPasso(o?: ObraSolar) {
  for (const g of PASSOS_OBRA) for (const i of g.itens) if (!o?.checks?.[i.k]) return i.label;
  return "";
}

/** Abre a procuração (modelo para homologação na distribuidora) pronta para imprimir/assinar. */
function abrirProcuracao(p: PropostaSolar, o: ObraSolar, cfg: any) {
  const proc = cfg.procurador || {};
  const nome = String(p.nome || "").toUpperCase();
  const doc = so(o.cpf_titular || p.cpf);
  const tipoDoc = doc.length === 14 ? "CNPJ" : "CPF";
  const pessoa = doc.length === 14 ? "pessoa jurídica" : "pessoa física";
  const distrib = String(o.distribuidora || cfg.distribuidora || "distribuidora de energia local").toUpperCase();
  const cidade = String(cfg.empresa?.cidade || p.cidade || "").split(/[-/]/)[0].trim() || "_____________";
  const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase().replace(/ DE (\d{4})$/, " de $1");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Procuração · ${esc(p.nome)}</title>
<style>@page{size:A4;margin:28mm 24mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:15.5px;line-height:1.55;max-width:720px;margin:40px auto;padding:0 20px}
h1{text-align:center;font-size:16px;text-decoration:underline;margin:30px 0 60px;letter-spacing:.02em}p{text-align:justify}.dt{text-align:center;margin:90px 0 120px}
.ass{text-align:center;margin-top:40px}.ass hr{width:330px;border:0;border-top:1.5px solid #111;margin:0 auto 8px}.ass b{display:block}
.bar{position:fixed;top:12px;right:12px;display:flex;gap:8px}.bar button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#0F4A30;color:#FFF3C4}
@media print{.bar{display:none}body{margin:0}}</style></head><body>
<div class="bar"><button onclick="window.print()">Imprimir / salvar PDF</button></div>
<h1>INSTRUMENTO PARTICULAR DE PROCURAÇÃO</h1>
<p>Pelo presente instrumento particular de procuração, eu ${pessoa}, <b>${esc(nome)}</b> inscrita sob <b>${tipoDoc}: ${esc(cpfFmt(doc) || "____________________")}</b>${o.uc ? `, titular da unidade consumidora nº <b>${esc(o.uc)}</b>,` : ""} constituo meu bastante procurador, <b>${esc(String(proc.titulo || "").toUpperCase())} ${esc(String(proc.nome || "____________________").toUpperCase())}</b>, pessoa física sob o <b>CPF ${esc(cpfFmt(proc.cpf || "") || "____________________")}</b>. Com o ato específico para assinatura de <b>ART</b>, elaboração do projeto fotovoltaico, consulta para disponibilidade da rede de distribuição, projeto e aumento de carga, alteração de titularidade junto à distribuidora de energia local <b>${esc(distrib)}</b>, referente às unidades consumidoras sob minha responsabilidade.</p>
<p class="dt">${esc(cidade)}, ${esc(data)}.</p>
<div class="ass"><hr><b>${esc(nome)}</b><b>${tipoDoc}: ${esc(cpfFmt(doc) || "____________________")}</b></div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Libere as janelas pop-up para abrir a procuração."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function Gaveta({ p, dados, onFechar }: { p: PropostaSolar; dados: any; onFechar: () => void }) {
  const { wsId, cfg, carregar } = dados;
  const d = sol(p), r = d.resultado;
  const [o, setO] = useState<ObraSolar>({ distribuidora: cfg.distribuidora || "", cpf_titular: p.cpf || d.aceite?.cpf || "", ...(d.obra || {}) });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof ObraSolar, v: string) => setO((x) => ({ ...x, [k]: v }));
  const pct = progressoObra(o);
  const etapa = p.status_venda || "ACEITA";

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const gravar = async (novo: ObraSolar, nota = "") => {
    setSalvando(true); setMsg("");
    const { error } = await salvarObraSolar(wsId, p, novo, nota);
    setSalvando(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return false; }
    await carregar(); return true;
  };
  const marcar = async (k: string, label: string) => {
    const checks = { ...(o.checks || {}) };
    const ligando = !checks[k];
    if (ligando) checks[k] = new Date().toISOString(); else delete checks[k];
    const novo = { ...o, checks };
    setO(novo);
    await gravar(novo, `${ligando ? "✓" : "✗"} ${label}`);
  };
  const mudar = async (nova: string) => {
    const { error } = await mudarEtapaSolar(wsId, p, nova);
    if (error) setMsg(error.message); else { await carregar(); setMsg(`Etapa: ${etapaSolar(nova).label}`); }
  };

  return (
    <div className="sx-veu" onClick={onFechar}>
      <aside className="sx-gaveta" onClick={(e) => e.stopPropagation()} aria-label={`Projeto de ${p.nome}`}>
        <div className="sx-gaveta-topo">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "#F6D77A" }}>Projeto {d.numero || p.id}</div>
              <div className="sx-serif" style={{ fontSize: 24, fontWeight: 800, color: "#FFFBEB", marginTop: 2 }}>{p.nome}</div>
              <div style={{ fontSize: 12.5, opacity: .8, marginTop: 2 }}>{[r && `${kwpTxt(r.kwp)} · ${r.paineis} painéis`, brl(Number(p.valor_plano) || 0), p.cidade].filter(Boolean).join(" · ")}</div>
            </div>
            <button onClick={onFechar} aria-label="Fechar" style={{ border: 0, background: "rgba(255,255,255,.12)", color: "#fff", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <div className="sx-barra" style={{ flex: 1, background: "rgba(255,255,255,.15)", height: 8 }}><i style={{ width: `${pct}%` }} /></div>
            <b style={{ color: "#FFF3C4", fontSize: 13 }}>{pct}%</b>
          </div>
          <div style={{ fontSize: 12, opacity: .75, marginTop: 6 }}>{d.aceite ? `Aceita em ${dataBR(d.aceite.em)} · ${diasDesde(d.aceite.em)} dias de projeto` : `${diasDesde(entrouNaEtapa(p))} dias na etapa`}{d.aceite?.pagamento ? ` · ${d.aceite.pagamento}${d.aceite.prazo ? ` ${d.aceite.prazo}x` : ""}` : ""}</div>
        </div>

        <div className="sx-gaveta-corpo">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select className="sx-input" value={etapa} onChange={(e) => mudar(e.target.value)} style={{ flex: "1 1 200px" }}>
              {ETAPAS_SOLAR.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
            <button className="sx-btn sx-btn-ouro" onClick={() => abrirProcuracao(p, o, cfg)}>📄 Procuração</button>
          </div>
          {(!cfg.procurador?.nome || !cfg.distribuidora) && <div style={{ fontSize: 12, color: "#8A6314", background: "#FFF6DA", borderRadius: 12, padding: "8px 12px" }}>Cadastre o engenheiro (procurador) e a distribuidora em "Kit, preços e ajustes" para a procuração sair completa.</div>}
          {msg && <div style={{ fontSize: 12.5, color: msg.startsWith("Erro") ? "#B91C1C" : "#136633", fontWeight: 700 }}>{msg}</div>}

          {PASSOS_OBRA.map((g) => {
            const feitos = g.itens.filter((i) => o.checks?.[i.k]).length;
            return (
              <div key={g.grupo} className="sx-card" style={{ padding: 12 }}>
                <div className="sx-card-t" style={{ marginBottom: 4, padding: "0 6px" }}><span>{g.grupo}</span><em style={{ marginLeft: "auto", fontStyle: "normal", fontSize: 12, fontWeight: 800, color: feitos === g.itens.length ? "#136633" : "#94A39A" }}>{feitos}/{g.itens.length}</em></div>
                {g.itens.map((i) => {
                  const ok = !!o.checks?.[i.k];
                  return (
                    <button key={i.k} className={`sx-check${ok ? " ok" : ""}`} onClick={() => marcar(i.k, i.label)} disabled={salvando}>
                      <i>{ok ? "✓" : ""}</i><span>{i.label}</span>{ok && <small>{dataHoraBR(o.checks![i.k])}</small>}
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="sx-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="sx-card-t" style={{ marginBottom: 0 }}><span>Dados da homologação</span></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="sx-campo">CPF/CNPJ do titular<input className="sx-input" value={o.cpf_titular || ""} onChange={(e) => set("cpf_titular", e.target.value)} /></label>
              <label className="sx-campo">Unidade consumidora (UC)<input className="sx-input" value={o.uc || ""} onChange={(e) => set("uc", e.target.value)} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="sx-campo">Distribuidora<input className="sx-input" value={o.distribuidora || ""} onChange={(e) => set("distribuidora", e.target.value)} /></label>
              <label className="sx-campo">Nº do protocolo<input className="sx-input" value={o.protocolo || ""} onChange={(e) => set("protocolo", e.target.value)} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label className="sx-campo">Data da instalação<input type="date" className="sx-input" value={o.instalacao_data || ""} onChange={(e) => set("instalacao_data", e.target.value)} /></label>
              <label className="sx-campo">Equipe<input className="sx-input" value={o.equipe || ""} onChange={(e) => set("equipe", e.target.value)} placeholder="ex.: Equipe 1 · João" /></label>
            </div>
            <label className="sx-campo">Observações<textarea className="sx-input" style={{ height: 70, padding: 10, resize: "vertical" }} value={o.obs || ""} onChange={(e) => set("obs", e.target.value)} /></label>
            <div><button className="sx-btn sx-btn-verde" disabled={salvando} onClick={async () => { if (await gravar(o, "Dados da homologação atualizados")) setMsg("Salvo."); }}>{salvando ? "Salvando…" : "Salvar dados"}</button></div>
          </div>

          {(d.historico || []).length > 0 && (
            <div className="sx-card" style={{ padding: 14 }}>
              <div className="sx-card-t"><span>Linha do tempo</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderLeft: "2px solid #E3E9DD", paddingLeft: 12 }}>
                {[...(d.historico || [])].reverse().slice(0, 25).map((h, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: "#33453C", position: "relative" }}>
                    <span style={{ position: "absolute", left: -18, top: 5, width: 9, height: 9, borderRadius: 9, background: h.etapa ? etapaSolar(h.etapa).cor : "#C9D3C3" }} />
                    <b style={{ fontWeight: 700 }}>{h.nota}</b>
                    <div style={{ fontSize: 11, color: "#94A39A" }}>{dataHoraBR(h.em)}{h.por ? ` · ${h.por}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function Obras({ dados }: any) {
  const { propostas, wsId, carregar } = dados as { propostas: PropostaSolar[]; wsId: string; carregar: () => Promise<void> };
  const [aberta, setAberta] = useState<number | null>(null);
  const [alvoCol, setAlvoCol] = useState("");
  const [erro, setErro] = useState("");
  const naObra = propostas.filter((p) => COLUNAS.includes(p.status_venda || ""));
  const atual = aberta ? propostas.find((p) => p.id === aberta) || null : null;
  const ativas = naObra.filter((p) => p.status_venda !== "CONCLUIDA");

  const mover = async (id: number, nova: string) => {
    setAlvoCol("");
    const p = propostas.find((x) => x.id === id);
    if (!p || p.status_venda === nova) return;
    const { error } = await mudarEtapaSolar(wsId, p, nova);
    if (error) setErro(error.message); else await carregar();
  };

  return (
    <div>
      <SxTitulo titulo="Projetos e homologação" sub={`Do aceite ao sistema ligado · ${ativas.length} em andamento · ${TOTAL_PASSOS} passos por projeto`} />
      {erro && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 8 }}>{erro}</div>}
      {!naObra.length ? <Empty icone="🛠️" titulo="Nenhum projeto em andamento" sub="Quando o cliente aceitar a proposta, o projeto aparece aqui: visita técnica, documentos, ART, protocolo na distribuidora, instalação e vistoria." /> : (
        <div className="sx-quadro sx-quadro-obra">
          {COLUNAS.map((c) => {
            const e = etapaSolar(c);
            const l = naObra.filter((p) => p.status_venda === c);
            return (
              <div key={c} className={`sx-col${alvoCol === c ? " alvo" : ""}`}
                onDragOver={(ev) => { ev.preventDefault(); if (alvoCol !== c) setAlvoCol(c); }} onDragLeave={() => setAlvoCol("")}
                onDrop={(ev) => { ev.preventDefault(); const id = Number(ev.dataTransfer.getData("text/plain")); if (id) mover(id, c); }}>
                <div className="sx-col-t"><i style={{ background: e.cor }} /><b>{e.label}</b><em>{l.length}</em></div>
                {l.map((p) => {
                  const d = sol(p), r = d.resultado, pct = progressoObra(d.obra), prox = proximoPasso(d.obra), dias = diasDesde(entrouNaEtapa(p));
                  const atraso = (c === "HOMOLOGACAO" && dias > 40) || (["VISITA TECNICA", "CONTRATO"].includes(c) && dias > 7) || (c === "INSTALACAO" && dias > 10);
                  return (
                    <div key={p.id} className="sx-cartao" draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(p.id))} onClick={() => setAberta(p.id)}>
                      <b>{p.nome}</b>
                      <div className="sx-cartao-l">{r ? `${kwpTxt(r.kwp)} · ${r.paineis} painéis` : ""} · {brl(Number(p.valor_plano) || 0)}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="sx-barra" style={{ flex: 1 }}><i style={{ width: `${pct}%` }} /></div><span style={{ fontSize: 11.5, fontWeight: 800, color: "#136633" }}>{pct}%</span></div>
                      {c !== "CONCLUIDA" && prox && <div className="sx-cartao-l">Próximo: <b style={{ fontSize: 12 }}>{prox}</b></div>}
                      <div className="sx-cartao-l">
                        {d.obra?.instalacao_data && <span className="sx-tag" style={{ background: "#FFF6DA", color: "#8A6314" }}>instala {dataBR(d.obra.instalacao_data)}</span>}
                        {d.obra?.protocolo && <span className="sx-tag" style={{ background: "#EAF0FF", color: "#1D4ED8" }}>protocolo</span>}
                        <span style={{ marginLeft: "auto", color: atraso ? "#B91C1C" : "#94A39A", fontWeight: atraso ? 800 : 500 }}>{atraso ? "⚠ " : ""}{dias}d</span>
                      </div>
                    </div>
                  );
                })}
                {!l.length && <div style={{ fontSize: 12, color: "#9AA89F", padding: "10px 6px" }}>Solte um cartão aqui</div>}
              </div>
            );
          })}
        </div>
      )}
      {atual && <Gaveta key={atual.id} p={atual} dados={dados} onFechar={() => setAberta(null)} />}
    </div>
  );
}
