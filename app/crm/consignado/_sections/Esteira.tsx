"use client";
import { useState } from "react";
import { Page, PageHeader, Btn, Banner } from "../../financeiro/_sections/_ui";
import { ETAPAS, etapa, produto, brl, dataBR, valorLiberado, mudarEtapa, nomeUsuario, type Contrato } from "../_dados";
import Icone from "../../../components/a2/Icone";

const SOMBRA = "0 1px 2px rgba(16,24,40,.04), 0 10px 24px -16px rgba(16,24,40,.25)";
const FLUXO = ["SIMULACAO", "DIGITADA", "AGUARDANDO DOCUMENTOS", "EM ANALISE NO BANCO", "AGUARDANDO AVERBACAO", "PAGO"];

export default function Esteira({ dados, ir }: any) {
  const { wsId, contratos, usuarios, carregar } = dados as { wsId: string; contratos: Contrato[]; usuarios: any[]; carregar: () => void };
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [movendo, setMovendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");

  const colunas = ETAPAS.filter((e) => mostrarFinalizados || !["REPROVADA", "CANCELADA"].includes(e.key));
  const filtrados = contratos.filter((c) => !busca || `${c.nome} ${c.cpf} ${c.operadora}`.toLowerCase().includes(busca.toLowerCase()));

  async function mover(c: Contrato, nova: string) {
    setMovendo(c.id); setAviso("");
    const { error } = await mudarEtapa(wsId, c, nova);
    setMovendo(null);
    if (error) setAviso("Não foi possível mover: " + error.message); else carregar();
  }

  return (
    <Page>
      <PageHeader titulo="Esteira de contratos" subtitulo="Acompanhe cada contrato da simulação até o pagamento ao cliente"
        acao={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CPF ou banco" style={{ height: 42, borderRadius: 12, border: "1px solid #E6ECEA", background: "#F7FAF9", padding: "0 12px", fontSize: 13.5, fontWeight: 600, minWidth: 220 }} />
          <Btn variante="ghost" onClick={() => setMostrarFinalizados((v) => !v)}>{mostrarFinalizados ? "Ocultar reprovados" : "Mostrar reprovados"}</Btn>
          <Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn>
        </div>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, alignItems: "flex-start" }}>
        {colunas.map((e) => {
          const lista = filtrados.filter((c) => (c.status_venda || "SIMULACAO") === e.key);
          const total = lista.reduce((s, c) => s + valorLiberado(c), 0);
          const idx = FLUXO.indexOf(e.key);
          return (
            <section key={e.key} style={{ flex: "0 0 270px", background: "#F3F6F5", borderRadius: 18, padding: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: "75vh" }}>
              <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: e.cor }} />
                <b style={{ fontSize: 13.5, color: "#0F172A" }}>{e.label}</b>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#475569", background: "#fff", borderRadius: 99, padding: "2px 9px" }}>{lista.length}</span>
              </header>
              <div style={{ fontSize: 12, color: "#64748B", padding: "0 6px", fontWeight: 700 }}>{brl(total)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {lista.length === 0 && <div style={{ fontSize: 12.5, color: "#94A3B8", textAlign: "center", padding: "18px 6px" }}>Nenhum contrato</div>}
                {lista.map((c) => (
                  <article key={c.id} style={{ background: "#fff", borderRadius: 14, boxShadow: SOMBRA, padding: 12, display: "flex", flexDirection: "column", gap: 6, opacity: movendo === c.id ? 0.5 : 1 }}>
                    <button onClick={() => ir("contratos", { contratoId: c.id })} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}>
                      <b style={{ fontSize: 13.5, color: "#0F172A" }}>{c.nome}</b>
                      <span style={{ display: "block", fontSize: 12, color: "#64748B" }}>{c.operadora || "Sem banco"} · {produto(c.plano)}</span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ fontSize: 15, color: "var(--w-700)" }}>{brl(valorLiberado(c))}</b>
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#94A3B8" }}>{dataBR(c.updated_at || c.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{nomeUsuario(usuarios, c.vendedor)}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {idx > 0 && <button title={`Voltar para ${etapa(FLUXO[idx - 1]).label}`} disabled={movendo === c.id} onClick={() => mover(c, FLUXO[idx - 1])} style={{ border: 0, borderRadius: 9, background: "#F3F6F5", color: "#475569", width: 32, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="voltar" tamanho={14} /></button>}
                      {idx >= 0 && idx < FLUXO.length - 1 && (
                        <button disabled={movendo === c.id} onClick={() => mover(c, FLUXO[idx + 1])} style={{ flex: 1, border: 0, borderRadius: 9, background: "var(--w-50)", color: "var(--w-700)", height: 30, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                          {etapa(FLUXO[idx + 1]).curto} →
                        </button>
                      )}
                      {idx >= 0 && idx < FLUXO.length - 1 && (
                        <button title="Reprovada" disabled={movendo === c.id} onClick={() => { if (confirm(`Marcar o contrato de ${c.nome} como reprovado?`)) mover(c, "REPROVADA"); }} style={{ border: 0, borderRadius: 9, background: "#FEF2F2", color: "#B91C1C", width: 32, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icone nome="x" tamanho={14} /></button>
                      )}
                      {idx < 0 && <button disabled={movendo === c.id} onClick={() => mover(c, "DIGITADA")} style={{ flex: 1, border: 0, borderRadius: 9, background: "#F3F6F5", color: "#475569", height: 30, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Reabrir</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Page>
  );
}
