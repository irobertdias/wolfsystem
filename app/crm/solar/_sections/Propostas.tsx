"use client";
import { useEffect, useMemo, useState } from "react";
import { Page, PageHeader, Btn, Table, Empty, Pill, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import { ETAPAS_SOLAR, etapaSolar, brl, kwpTxt } from "../../../lib/solar";
import { sol, dataBR, expirada, baixarCSV, nomeUsuario, type PropostaSolar } from "../_dados";
import EditorSolar from "./EditorSolar";

export default function Propostas({ dados, alvo }: any) {
  const { propostas, carregando, erro, usuarios } = dados as { propostas: PropostaSolar[]; carregando: boolean; erro: string; usuarios: any[] };
  const [aberta, setAberta] = useState<number | "nova" | null>(null);
  const [preenchido, setPreenchido] = useState<any>(null);
  const [etapa, setEtapa] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (alvo?.propostaId) { setAberta(alvo.propostaId); setPreenchido(null); }
    else if (alvo?.novo) { setAberta("nova"); setPreenchido(alvo.preenchido || null); }
    else if (alvo?.etapa !== undefined) { setEtapa(alvo.etapa); setAberta(null); }
  }, [alvo?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return propostas.filter((p) => (!etapa || (p.status_venda || "LEAD") === etapa)
      && (!q || [p.nome, p.telefone1, p.cidade, sol(p).numero].some((x) => String(x || "").toLowerCase().includes(q))));
  }, [propostas, etapa, busca]);

  if (aberta !== null) {
    const p = aberta === "nova" ? null : propostas.find((x) => x.id === aberta) || null;
    return (
      <Page>
        <PageHeader titulo={p ? `Proposta ${sol(p).numero || p.id} · ${p.nome}` : "Nova proposta solar"} subtitulo={p ? `${etapaSolar(p.status_venda).label} · criada em ${dataBR(p.created_at)}` : "Preencha a conta de luz: o sistema é calculado na hora"} />
        <EditorSolar key={String(aberta)} dados={dados} proposta={p} preenchido={preenchido} onSalvo={(id) => setAberta(id)} onFechar={() => setAberta(null)} />
      </Page>
    );
  }

  const contagem = (k: string) => propostas.filter((p) => (p.status_venda || "LEAD") === k).length;
  const exportar = () => baixarCSV("propostas-solar.csv", [
    ["Número", "Data", "Cliente", "WhatsApp", "Cidade", "UF", "Etapa", "kWp", "Painéis", "Consumo kWh", "Economia/mês", "Valor", "Vendedor"],
    ...lista.map((p) => { const r = sol(p).resultado; return [sol(p).numero || p.id, dataBR(p.created_at), p.nome, p.telefone1 || "", p.cidade || "", p.estado || "", etapaSolar(p.status_venda).label, r?.kwp || "", r?.paineis || "", r?.consumo_kwh || "", r?.economia_mes || "", p.valor_plano || 0, nomeUsuario(usuarios, p.vendedor)]; }),
  ]);

  return (
    <Page>
      <PageHeader titulo="Propostas solares" subtitulo="Do primeiro contato ao sistema ligado"
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={exportar}>Exportar</Btn><Btn onClick={() => { setPreenchido(null); setAberta("nova"); }}>Nova proposta</Btn></div>} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setEtapa("")} style={chip(!etapa)}>Todas ({propostas.length})</button>
        {ETAPAS_SOLAR.map((e) => <button key={e.key} onClick={() => setEtapa(e.key)} style={chip(etapa === e.key)}>{e.curto} ({contagem(e.key)})</button>)}
        <input style={{ ...inputSm, maxWidth: 260, marginLeft: "auto" }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, cidade ou número" />
      </div>
      {erro && <div style={{ color: "#B91C1C", fontSize: 13 }}>{erro}</div>}
      {carregando ? <div style={{ padding: 30, color: "#94A3B8" }}>Carregando…</div> : !lista.length ? (
        <Empty icone="☀️" titulo="Nenhuma proposta aqui" sub="Crie a primeira proposta com a conta de luz do cliente, ou ligue a Vendedora IA para ela criar sozinha no WhatsApp." acao={<Btn onClick={() => setAberta("nova")}>Nova proposta</Btn>} />
      ) : (
        <Table cols={[{ label: "Cliente" }, { label: "Sistema" }, { label: "Economia" }, { label: "Valor", align: "right" }, { label: "Etapa" }, { label: "Link" }]}>
          {lista.map((p) => {
            const d = sol(p), r = d.resultado, e = etapaSolar(p.status_venda);
            return (
              <tr key={p.id} onClick={() => setAberta(p.id)} style={{ cursor: "pointer" }}>
                <td style={tdStyle}><b>{p.nome}</b><div style={{ color: "#94A3B8", fontSize: 12 }}>{[d.numero, p.cidade && `${p.cidade}/${p.estado || ""}`, dataBR(p.created_at), d.canal === "whatsapp_ia" ? "pela IA" : ""].filter(Boolean).join(" · ")}</div></td>
                <td style={tdStyle}>{r ? <>{kwpTxt(r.kwp)}<div style={{ color: "#94A3B8", fontSize: 12 }}>{r.paineis} painéis · {r.consumo_kwh} kWh</div></> : "—"}</td>
                <td style={tdStyle}>{r ? `${brl(r.economia_mes)}/mês` : "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(Number(p.valor_plano) || 0)}</td>
                <td style={tdStyle}><Pill texto={e.curto} cor={e.cor} /></td>
                <td style={{ ...tdStyle, fontSize: 12, color: "#64748B" }}>{d.aceite ? "✅ aceita" : d.recusa ? "recusada" : !d.token ? "—" : expirada(d) ? "expirado" : d.visualizado_em ? "👀 visto" : "enviado"}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </Page>
  );
}

const chip = (sel: boolean): React.CSSProperties => ({ border: 0, borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: sel ? "var(--w-600)" : "#F1F5F4", color: sel ? "#fff" : "#475569" });
