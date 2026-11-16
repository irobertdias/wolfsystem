"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Stats, Stat, Table, Vazio, Pill, Btn, Banner, Row, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import { produto, brl, pctBR, dataBR, hoje, cons, valorLiberado, comissaoPct, comissaoValor, mesDe, salvarContrato, nomeUsuario, baixarCSV, type Contrato } from "../_dados";

export default function Comissoes({ dados, gestor }: any) {
  const { wsId, contratos, cfg, usuarios, carregar } = dados as { wsId: string; contratos: Contrato[]; cfg: any; usuarios: any[]; carregar: () => void };
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [situacao, setSituacao] = useState<"todas" | "receber" | "recebidas">("todas");
  const [aviso, setAviso] = useState("");

  const pagos = contratos.filter((c) => c.status_venda === "PAGO");
  const doMes = pagos.filter((c) => !mes || mesDe(c) === mes);
  const lista = useMemo(() => doMes.filter((c) => situacao === "todas" || (situacao === "receber" ? !cons(c).comissao_recebida_em : !!cons(c).comissao_recebida_em)), [doMes, situacao]);
  const total = doMes.reduce((s, c) => s + comissaoValor(c, cfg), 0);
  const recebida = doMes.filter((c) => cons(c).comissao_recebida_em).reduce((s, c) => s + comissaoValor(c, cfg), 0);
  const aReceberGeral = pagos.filter((c) => !cons(c).comissao_recebida_em).reduce((s, c) => s + comissaoValor(c, cfg), 0);

  const porVendedor: Record<string, number> = {};
  doMes.forEach((c) => { const n = nomeUsuario(usuarios, c.vendedor); porVendedor[n] = (porVendedor[n] || 0) + comissaoValor(c, cfg); });

  async function baixa(c: Contrato, recebido: boolean) {
    setAviso("");
    const d = { ...cons(c), comissao_recebida_em: recebido ? hoje() : null };
    const { error } = await salvarContrato(wsId, {}, d, c.id, c.dados_customizados);
    if (error) setAviso("Erro: " + error.message); else carregar();
  }

  return (
    <Page>
      <PageHeader titulo="Comissões" subtitulo="Comissão dos contratos pagos, por banco e produto"
        acao={<Btn variante="ghost" onClick={() => baixarCSV(`comissoes-${mes || "todas"}.csv`, [["Cliente", "Banco", "Produto", "Pagamento", "Liberado", "Comissão %", "Comissão R$", "Recebida em", "Vendedor"], ...lista.map((c) => [c.nome, c.operadora || "", produto(c.plano), dataBR(cons(c).data_pagamento), valorLiberado(c).toFixed(2).replace(".", ","), String(comissaoPct(c, cfg)).replace(".", ","), comissaoValor(c, cfg).toFixed(2).replace(".", ","), dataBR(cons(c).comissao_recebida_em), nomeUsuario(usuarios, c.vendedor)])])}>Exportar CSV</Btn>} />
      {aviso && <Banner tipo="warn">{aviso}</Banner>}
      {cfg.comissao_padrao === 0 && cfg.bancos.every((b: any) => !Object.keys(b.comissoes || {}).length) && (
        <Banner tipo="info">Nenhuma regra de comissão cadastrada ainda. {gestor ? "Configure os percentuais por banco e produto em Configurações." : "Peça ao administrador para configurar os percentuais."}</Banner>
      )}
      <Row>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputSm, width: 180 }} />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as any)} style={{ ...inputSm, width: 200 }}>
          <option value="todas">Todas</option><option value="receber">A receber</option><option value="recebidas">Recebidas</option>
        </select>
        <Btn variante="ghost" onClick={() => setMes("")}>Todos os meses</Btn>
      </Row>
      <Stats>
        <Stat label="Comissão do período" icone="💰" valor={brl(total)} sub={`${doMes.length} contrato(s) pago(s)`} />
        <Stat label="Recebida" icone="✅" valor={brl(recebida)} />
        <Stat label="A receber no período" icone="⏳" valor={brl(total - recebida)} cor="#C2410C" />
        <Stat label="A receber (geral)" icone="🧾" valor={brl(aReceberGeral)} cor="#C2410C" sub="todos os meses" />
      </Stats>
      {Object.keys(porVendedor).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(porVendedor).sort((a, b) => b[1] - a[1]).map(([n, v]) => <span key={n} style={{ background: "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, boxShadow: "0 1px 2px rgba(16,24,40,.06)" }}><b>{n}</b> · {brl(v)}</span>)}
        </div>
      )}
      <Table cols={[{ label: "Cliente" }, { label: "Banco / produto" }, { label: "Pagamento" }, { label: "Liberado", align: "right" }, { label: "Comissão", align: "right" }, { label: "Situação" }]}
        empty={lista.length === 0 ? <Vazio icone="💰" titulo="Sem comissões no período" sub="Os contratos aparecem aqui quando chegam na etapa Pago." /> : undefined}>
        {lista.map((c) => {
          const rec = cons(c).comissao_recebida_em;
          return (
            <tr key={c.id}>
              <td style={tdStyle}><b>{c.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{nomeUsuario(usuarios, c.vendedor)}</div></td>
              <td style={tdStyle}>{c.operadora || "—"}<div style={{ fontSize: 12, color: "#94A3B8" }}>{produto(c.plano)}</div></td>
              <td style={tdStyle}>{dataBR(cons(c).data_pagamento) || "—"}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{brl(valorLiberado(c))}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(comissaoValor(c, cfg))}<div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{pctBR(comissaoPct(c, cfg))}</div></td>
              <td style={tdStyle}>
                {rec ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Pill texto={`Recebida ${dataBR(rec)}`} cor="var(--w-600)" />{gestor && <a onClick={() => baixa(c, false)} style={{ fontSize: 12, color: "#94A3B8", cursor: "pointer" }}>desfazer</a>}</span>
                  : gestor ? <Btn variante="ghost" onClick={() => baixa(c, true)}>Marcar recebida</Btn> : <Pill texto="A receber" cor="#C2410C" />}
              </td>
            </tr>
          );
        })}
      </Table>
    </Page>
  );
}
