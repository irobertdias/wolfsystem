"use client";
import { useEffect, useRef, useState } from "react";
import { Page, PageHeader, Btn, C } from "../../financeiro/_sections/_ui";
import { ETAPAS, rev, calcular, mudarEtapa, brl, type Contrato } from "../_dados";
import { useUsuarioEmail } from "./Contratos";

export default function Andamento({ dados, ir, alvo }: any) {
  const { wsId, contratos, cfg, carregando, carregar } = dados;
  const usuario = useUsuarioEmail();
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);
  const colunas = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (alvo?.etapa) colunas.current[alvo.etapa]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [alvo?.t, alvo?.etapa]);

  const mover = async (id: number, nova: string) => {
    const c = contratos.find((x: Contrato) => x.id === id);
    if (!c || (c.status_venda || "NOVO") === nova) return;
    setMovendo(true);
    await mudarEtapa(wsId, c, nova, "", usuario);
    await carregar();
    setMovendo(false);
  };

  return (
    <Page>
      <PageHeader icone="🗂️" titulo="Andamento dos contratos" subtitulo="Arraste o cartão para mudar a etapa · clique para abrir a ficha"
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={carregar}>🔄 Atualizar</Btn><Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn></div>} />

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12, opacity: movendo ? 0.6 : 1, transition: "opacity .15s" }}>
        {ETAPAS.map((e) => {
          const itens = contratos.filter((c: Contrato) => (c.status_venda || "NOVO") === e.key);
          const soma = itens.reduce((s: number, c: Contrato) => s + calcular(rev(c), c.plano, cfg).beneficio, 0);
          const destaque = sobre === e.key || alvo?.etapa === e.key;
          return (
            <div
              key={e.key}
              ref={(el) => { colunas.current[e.key] = el; }}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(e.key); }}
              onDragLeave={() => setSobre((s) => (s === e.key ? null : s))}
              onDrop={(ev) => { ev.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, e.key); setArrastando(null); }}
              style={{ flex: "0 0 270px", background: destaque ? `${e.cor}0d` : "#f1f5f9", border: `1px solid ${destaque ? e.cor + "66" : "#e5e7eb"}`, borderRadius: 14, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 230px)", transition: "all .15s" }}
            >
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", borderTop: `3px solid ${e.cor}`, borderRadius: "14px 14px 0 0", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontSize: 13, color: "#1f2937" }}>{e.icone} {e.label}</b>
                  <span style={{ fontSize: 12, fontWeight: 800, color: e.cor, background: `${e.cor}14`, borderRadius: 20, padding: "2px 9px" }}>{itens.length}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{brl(soma)} em benefício</div>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 80 }}>
                {carregando && <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 10 }}>Carregando…</div>}
                {!carregando && itens.length === 0 && <div style={{ color: "#cbd5e1", fontSize: 12, textAlign: "center", padding: "18px 6px", border: "1px dashed #cbd5e1", borderRadius: 10 }}>Solte um cartão aqui</div>}
                {itens.map((c: Contrato) => {
                  const calc = calcular(rev(c), c.plano, cfg);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setArrastando(c.id)}
                      onDragEnd={() => { setArrastando(null); setSobre(null); }}
                      onClick={() => ir("contratos", { contratoId: c.id })}
                      style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: `3px solid ${e.cor}`, borderRadius: 10, padding: "10px 12px", cursor: "grab", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", opacity: arrastando === c.id ? 0.5 : 1 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1f2937", marginBottom: 2 }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>🏦 {c.operadora || "Sem banco"}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                        <span style={{ color: calc.abusiva ? C.red : "#9ca3af", fontWeight: calc.abusiva ? 700 : 400 }}>{calc.valido ? `${calc.taxaContratada.toFixed(2)}% a.m.${calc.abusiva ? " 🚩" : ""}` : "sem cálculo"}</span>
                        <b style={{ color: C.green }}>{calc.valido ? brl(calc.beneficio) : ""}</b>
                      </div>
                      <select
                        value={c.status_venda || "NOVO"}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => mover(c.id, ev.target.value)}
                        style={{ marginTop: 8, width: "100%", fontSize: 11.5, border: "1px solid #e5e7eb", borderRadius: 7, padding: "4px 6px", color: "#475569", background: "#f9fafb" }}
                        title="Mover para outra etapa"
                      >
                        {ETAPAS.map((x) => <option key={x.key} value={x.key}>{x.icone} {x.label}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
