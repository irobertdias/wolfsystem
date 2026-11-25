"use client";
import { useState } from "react";
import { Page, PageHeader, Empty, Banner } from "../../financeiro/_sections/_ui";
import { ETAPAS_SOLAR, brl, kwpTxt } from "../../../lib/solar";
import { sol, mudarEtapaSolar, dataBR, type PropostaSolar } from "../_dados";

// Quadro da obra: do aceite ao sistema ligado. Um toque leva o cartão para a próxima etapa.
const COLUNAS = ["ACEITA", "VISITA TECNICA", "CONTRATO", "HOMOLOGACAO", "INSTALACAO", "CONCLUIDA"];

export default function Obras({ dados, ir }: any) {
  const { propostas, wsId, carregar } = dados as { propostas: PropostaSolar[]; wsId: string; carregar: () => Promise<void> };
  const [erro, setErro] = useState("");
  const [movendo, setMovendo] = useState<number | null>(null);
  const etapas = ETAPAS_SOLAR.filter((e) => COLUNAS.includes(e.key));
  const naObra = propostas.filter((p) => COLUNAS.includes(p.status_venda || ""));

  const avancar = async (p: PropostaSolar, dir: 1 | -1) => {
    const i = COLUNAS.indexOf(p.status_venda || "");
    const nova = COLUNAS[i + dir];
    if (!nova) return;
    setMovendo(p.id); setErro("");
    const { error } = await mudarEtapaSolar(wsId, p, nova);
    if (error) setErro(error.message); else await carregar();
    setMovendo(null);
  };

  return (
    <Page>
      <PageHeader titulo="Visitas e instalações" subtitulo="Acompanhe cada sistema do aceite até ligar" />
      {erro && <Banner tipo="warn">{erro}</Banner>}
      {!naObra.length ? <Empty icone="🛠️" titulo="Nenhuma obra em andamento" sub="Quando o cliente aceitar a proposta, ela aparece aqui para agendar a visita técnica." /> : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {etapas.map((e) => {
            const l = naObra.filter((p) => p.status_venda === e.key);
            return (
              <div key={e.key} style={{ flex: "0 0 250px", background: "#F7FAF9", borderRadius: 18, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}><span style={{ width: 9, height: 9, borderRadius: 9, background: e.cor }} /><b style={{ fontSize: 13 }}>{e.label}</b><span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8" }}>{l.length}</span></div>
                {l.map((p) => {
                  const d = sol(p), r = d.resultado;
                  return (
                    <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: 12, boxShadow: "0 1px 2px rgba(16,24,40,.06)", display: "flex", flexDirection: "column", gap: 6, opacity: movendo === p.id ? 0.5 : 1 }}>
                      <button onClick={() => ir("propostas", { propostaId: p.id })} style={{ border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                        <b style={{ fontSize: 13.5, color: "#0F172A" }}>{p.nome}</b>
                        <div style={{ fontSize: 12, color: "#64748B" }}>{r ? `${kwpTxt(r.kwp)} · ${r.paineis} painéis` : ""} · {brl(Number(p.valor_plano) || 0)}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{[p.cidade, p.telefone1, d.aceite ? `aceita ${dataBR(d.aceite.em)}` : ""].filter(Boolean).join(" · ")}</div>
                        {d.visita && <div style={{ fontSize: 12, color: "var(--w-700)" }}>Visita: {d.visita.data || "a combinar"}</div>}
                      </button>
                      <div style={{ display: "flex", gap: 6 }}>
                        {COLUNAS.indexOf(e.key) > 0 && <button onClick={() => avancar(p, -1)} style={mini}>←</button>}
                        {COLUNAS.indexOf(e.key) < COLUNAS.length - 1 && <button onClick={() => avancar(p, 1)} style={{ ...mini, flex: 1, background: "var(--w-50)", color: "var(--w-800)" }}>Avançar →</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
const mini: React.CSSProperties = { border: 0, borderRadius: 9, background: "#F1F5F4", color: "#475569", fontSize: 12, fontWeight: 800, padding: "6px 10px", cursor: "pointer" };
