"use client";
import { Fragment, useMemo, useState } from "react";
import { Page, PageHeader, Table, Vazio, Pill, Btn, inputSm, tdStyle } from "../_ui";
import { etapa, produto, brl, dataBR, cpfFmt, cons, valorLiberado, type Contrato } from "../_dados";

type Cliente = { chave: string; nome: string; cpf: string; telefone: string; convenio: string; beneficio: string; contratos: Contrato[]; liberado: number; ultimo: string };

export default function Clientes({ dados, ir }: any) {
  const { contratos } = dados as { contratos: Contrato[] };
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string>("");

  const clientes = useMemo(() => {
    const g: Record<string, Cliente> = {};
    for (const c of contratos) {
      const chave = String(c.cpf || "").replace(/\D/g, "") || `nome:${c.nome.trim().toLowerCase()}`;
      const d = cons(c);
      const x = g[chave] ||= { chave, nome: c.nome, cpf: cpfFmt(c.cpf), telefone: c.telefone1 || "", convenio: d.convenio || "", beneficio: d.beneficio || "", contratos: [], liberado: 0, ultimo: "" };
      x.contratos.push(c);
      if (c.status_venda === "PAGO") x.liberado += valorLiberado(c);
      const quando = String(c.updated_at || c.created_at);
      if (quando > x.ultimo) { x.ultimo = quando; x.telefone = c.telefone1 || x.telefone; x.convenio = d.convenio || x.convenio; x.beneficio = d.beneficio || x.beneficio; }
    }
    const q = busca.trim().toLowerCase(), dig = busca.replace(/\D/g, "");
    return Object.values(g)
      .filter((x) => !q || x.nome.toLowerCase().includes(q) || (dig.length >= 3 && x.cpf.replace(/\D/g, "").includes(dig)) || x.beneficio.includes(q))
      .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
  }, [contratos, busca]);

  return (
    <Page>
      <PageHeader titulo="Clientes" subtitulo={`${clientes.length} cliente(s) · contratos agrupados por CPF`} acao={<Btn onClick={() => ir("contratos", { novo: true })}>＋ Novo contrato</Btn>} />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou benefício" style={{ ...inputSm, maxWidth: 420 }} />
      <Table cols={[{ label: "Cliente" }, { label: "Convênio" }, { label: "Contratos", align: "center" }, { label: "Total liberado", align: "right" }, { label: "Última movimentação" }]}
        empty={clientes.length === 0 ? <Vazio icone="👥" titulo="Nenhum cliente" sub="Os clientes aparecem aqui quando você cadastra contratos." /> : undefined}>
        {clientes.map((x) => (
          <Fragment key={x.chave}>
            <tr key={x.chave} onClick={() => setAberto(aberto === x.chave ? "" : x.chave)} style={{ cursor: "pointer" }}>
              <td style={tdStyle}><b>{x.nome}</b><div style={{ fontSize: 12, color: "var(--k-mut)" }}>{x.cpf || "sem CPF"}{x.telefone ? ` · ${x.telefone}` : ""}</div></td>
              <td style={tdStyle}>{x.convenio || "—"}<div style={{ fontSize: 12, color: "var(--k-mut)" }}>{x.beneficio}</div></td>
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800 }}>{x.contratos.length}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(x.liberado)}</td>
              <td style={tdStyle}>{dataBR(x.ultimo)}</td>
            </tr>
            {aberto === x.chave && (
              <tr key={x.chave + "-c"}>
                <td colSpan={5} style={{ ...tdStyle, background: "var(--k-campo)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {x.contratos.map((c) => {
                      const e = etapa(c.status_venda);
                      return (
                        <button key={c.id} onClick={() => ir("contratos", { contratoId: c.id })} style={{ display: "flex", alignItems: "center", gap: 10, border: 0, background: "#fff", borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ flex: 1 }}>{c.operadora || "—"} · {produto(c.plano)}<span style={{ color: "var(--k-mut)" }}> · {dataBR(c.data_proposta || c.created_at)}</span></span>
                          <b>{brl(valorLiberado(c))}</b>
                          <Pill texto={e.curto} cor={e.cor} />
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Table>
    </Page>
  );
}
