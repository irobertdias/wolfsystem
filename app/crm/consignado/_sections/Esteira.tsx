"use client";
import { useState } from "react";
import { Page, PageHeader, Btn, Banner, Dinheiro, inputSm } from "../_ui";
import { etapa, produto, brl, dataBR, valorLiberado, mudarEtapa, nomeUsuario, type Contrato } from "../_dados";
import Icone from "../../../components/a2/Icone";

// Esteira do consignado como trilho de etapas: no topo, o funil da operação
// (quantidade e valor em cada etapa); embaixo, cada contrato com a própria linha
// do tempo. Clicar numa bolinha move o contrato para aquela etapa.
const FLUXO = ["SIMULACAO", "DIGITADA", "AGUARDANDO DOCUMENTOS", "EM ANALISE NO BANCO", "AGUARDANDO AVERBACAO", "PAGO"];

export default function Esteira({ dados, ir }: any) {
  const { wsId, contratos, usuarios, carregar } = dados as { wsId: string; contratos: Contrato[]; usuarios: any[]; carregar: () => void };
  const [filtro, setFiltro] = useState<string>("");
  const [movendo, setMovendo] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [reprovados, setReprovados] = useState(false);

  const st = (c: Contrato) => c.status_venda || "SIMULACAO";
  const daBusca = contratos.filter((c) => !busca || `${c.nome} ${c.cpf} ${c.operadora}`.toLowerCase().includes(busca.toLowerCase()));
  const lista = daBusca
    .filter((c) => (filtro ? st(c) === filtro : reprovados ? true : !["REPROVADA", "CANCELADA"].includes(st(c))))
    .sort((a, b) => FLUXO.indexOf(st(a)) - FLUXO.indexOf(st(b)) || String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)));
  const perdidos = daBusca.filter((c) => ["REPROVADA", "CANCELADA"].includes(st(c)));

  async function mover(c: Contrato, nova: string) {
    if (st(c) === nova) return;
    if (FLUXO.indexOf(nova) >= 0 && FLUXO.indexOf(nova) < FLUXO.indexOf(st(c)) && !confirm(`Voltar o contrato de ${c.nome} para "${etapa(nova).label}"?`)) return;
    setMovendo(c.id); setAviso("");
    const { error } = await mudarEtapa(wsId, c, nova);
    setMovendo(null);
    if (error) setAviso("Não foi possível mover: " + error.message); else carregar();
  }

  return (
    <Page>
      <PageHeader titulo="Esteira de contratos" subtitulo="Da simulação ao dinheiro na conta do cliente"
        acao={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CPF ou banco" style={{ ...inputSm, width: 240 }} />
          <Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn>
        </div>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}

      {/* funil da operação */}
      <div className="cons-funil">
        {FLUXO.map((k, i) => {
          const e = etapa(k), nos = daBusca.filter((c) => st(c) === k);
          return (
            <button key={k} className={filtro === k ? "ativo" : ""} onClick={() => setFiltro(filtro === k ? "" : k)}>
              <span className="passo">{i + 1}</span>
              <span className="nome">{e.label}</span>
              <b>{nos.length}</b>
              <small><Dinheiro v={brl(nos.reduce((s, c) => s + valorLiberado(c), 0))} tam={13} /></small>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: "var(--k-sub)" }}>
        {filtro ? <>Mostrando <b style={{ color: "var(--k-tinta)" }}>{etapa(filtro).label}</b> · <a onClick={() => setFiltro("")} style={{ cursor: "pointer", color: "var(--w-600)", fontWeight: 700 }}>ver todas</a></> : <>{lista.length} contrato(s) na esteira</>}
        {perdidos.length > 0 && <label style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={reprovados} onChange={(e) => setReprovados(e.target.checked)} /> mostrar {perdidos.length} reprovado(s)/cancelado(s)</label>}
      </div>

      {/* linha do tempo de cada contrato */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.length === 0 && <div className="cons-trilho" style={{ justifyContent: "center", color: "var(--k-sub)", padding: 30 }}>Nenhum contrato aqui.</div>}
        {lista.map((c) => {
          const idx = FLUXO.indexOf(st(c)), perdido = idx < 0;
          return (
            <article key={c.id} className="cons-trilho" style={{ opacity: movendo === c.id ? 0.5 : 1 }}>
              <button className="cons-trilho-cliente" onClick={() => ir("contratos", { contratoId: c.id })}>
                <span className="av">{c.nome.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <b>{c.nome}</b>
                  <small>{c.operadora || "Sem banco"} · {produto(c.plano)} · {nomeUsuario(usuarios, c.vendedor)}</small>
                </span>
              </button>
              <div className="cons-trilho-linha">
                {perdido ? (
                  <span className="cons-perdido"><Icone nome="x" tamanho={14} /> {etapa(st(c)).label} em {dataBR(c.updated_at || c.created_at)} · <a onClick={() => mover(c, "DIGITADA")}>reabrir</a></span>
                ) : FLUXO.map((k, i) => (
                  <button key={k} className={`ponto${i < idx ? " feito" : ""}${i === idx ? " atual" : ""}`} title={`Mover para ${etapa(k).label}`} disabled={movendo === c.id} onClick={() => mover(c, k)}>
                    <i>{i < idx ? <Icone nome="check" tamanho={11} /> : null}</i>
                    <span>{etapa(k).curto}</span>
                  </button>
                ))}
              </div>
              <div className="cons-trilho-valor">
                <Dinheiro v={brl(valorLiberado(c))} tam={18} />
                <small>{dataBR(c.updated_at || c.created_at)}</small>
                {!perdido && idx < FLUXO.length - 1 && <button className="reprova" title="Reprovado pelo banco" onClick={() => { if (confirm(`Marcar o contrato de ${c.nome} como reprovado?`)) mover(c, "REPROVADA"); }}>Reprovar</button>}
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
