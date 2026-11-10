"use client";
import { useState } from "react";
import { Page, PageHeader, Stats, Stat, Table, Card, Btn, Vazio, Pill, inputSm, tdStyle, C } from "../../financeiro/_sections/_ui";
import { ETAPAS, rev, calcular, honorariosPrevistos, brl, pctBR, num, dataBR, hoje, baixarCSV, type Contrato } from "../_dados";

type Agrupar = "etapa" | "banco" | "modalidade" | "mes";

export default function Relatorios({ dados }: any) {
  const { contratos, cfg } = dados;
  const [agrupar, setAgrupar] = useState<Agrupar>("etapa");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const linhas = contratos
    .filter((c: Contrato) => { const dt = (c.data_proposta || c.created_at || "").slice(0, 10); return (!de || dt >= de) && (!ate || dt <= ate); })
    .map((c: Contrato) => { const d = rev(c), calc = calcular(d, c.plano, cfg); return { c, d, calc, hon: honorariosPrevistos(d, calc, cfg) }; });

  const chave = (l: any) => {
    if (agrupar === "etapa") { const e = ETAPAS.find((x) => x.key === (l.c.status_venda || "NOVO")); return e ? `${e.icone} ${e.label}` : l.c.status_venda; }
    if (agrupar === "banco") return (l.c.operadora || "").trim() || "Sem banco";
    if (agrupar === "modalidade") { const m = cfg.modalidades.find((x: any) => x.key === l.c.plano); return m ? `${m.icone} ${m.label}` : "Outro"; }
    return (l.c.data_proposta || l.c.created_at || "").slice(0, 7).split("-").reverse().join("/");
  };

  const grupos: Record<string, any> = {};
  linhas.forEach((l: any) => {
    const k = chave(l);
    const g = (grupos[k] = grupos[k] || { nome: k, qtd: 0, financiado: 0, beneficio: 0, abusivos: 0, honorarios: 0, somaTaxa: 0, comTaxa: 0 });
    g.qtd++; g.financiado += num(l.d.valor_financiado); g.beneficio += l.calc.beneficio; g.honorarios += l.hon.total;
    if (l.calc.abusiva) g.abusivos++;
    if (l.calc.valido) { g.somaTaxa += l.calc.taxaContratada; g.comTaxa++; }
  });
  const ordem = Object.values(grupos).sort((a: any, b: any) => (agrupar === "mes" ? b.nome.split("/").reverse().join("").localeCompare(a.nome.split("/").reverse().join("")) : b.qtd - a.qtd));
  const max = Math.max(...ordem.map((g: any) => g.beneficio), 1);

  const tot = {
    qtd: linhas.length,
    financiado: linhas.reduce((s: number, l: any) => s + num(l.d.valor_financiado), 0),
    beneficio: linhas.reduce((s: number, l: any) => s + l.calc.beneficio, 0),
    honorarios: linhas.reduce((s: number, l: any) => s + l.hon.total, 0),
  };

  const exportar = () => baixarCSV(`contratos-revisional-${hoje()}.csv`, [
    ["Cliente", "CPF", "Telefone", "Banco", "Modalidade", "Nº contrato", "Data contrato", "Valor financiado", "Prazo", "Parcela", "Taxa contratada % a.m.", "Taxa média % a.m.", "Parcela revisada", "Benefício", "Honorários previstos", "Etapa", "Processo", "Cadastrado em"],
    ...linhas.map((l: any) => [
      l.c.nome, l.c.cpf || "", l.c.telefone1 || "", l.c.operadora || "", cfg.modalidades.find((m: any) => m.key === l.c.plano)?.label || "", l.d.numero_contrato || "", dataBR(l.d.data_contrato),
      fmtN(l.d.valor_financiado), l.d.prazo || "", fmtN(l.calc.parcelaContratada), fmtN(l.calc.taxaContratada), fmtN(l.calc.taxaMedia), fmtN(l.calc.parcelaRevisada), fmtN(l.calc.beneficio), fmtN(l.hon.total),
      ETAPAS.find((e) => e.key === (l.c.status_venda || "NOVO"))?.label || l.c.status_venda, l.d.processo_numero || "", dataBR(l.c.data_proposta || l.c.created_at),
    ]),
  ]);

  const chip = (k: Agrupar, l: string) => (
    <button key={k} onClick={() => setAgrupar(k)} style={{ border: `1px solid ${agrupar === k ? C.amber : "#E6ECEA"}`, background: agrupar === k ? `${C.amber}14` : "#fff", color: agrupar === k ? C.amber : "#475569", borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
  );

  return (
    <Page>
      <PageHeader icone="📈" titulo="Relatórios" subtitulo="Carteira de contratos agrupada como você precisar" acao={<Btn variante="ghost" onClick={exportar}>Exportar contratos (CSV)</Btn>} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {chip("etapa", "Por etapa")}{chip("banco", "Por banco")}{chip("modalidade", "Por modalidade")}{chip("mes", "Por mês de cadastro")}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#64748B" }}>Cadastrados de</span>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ ...inputSm, width: 150 }} />
        <span style={{ fontSize: 12, color: "#64748B" }}>até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ ...inputSm, width: 150 }} />
      </div>

      <Stats>
        <Stat label="Contratos" valor={tot.qtd} icone="📑" cor={C.blue} />
        <Stat label="Valor financiado" valor={brl(tot.financiado)} icone="🏦" cor={C.slate} />
        <Stat label="Benefício estimado" valor={brl(tot.beneficio)} icone="💎" cor={C.green} />
        <Stat label="Honorários previstos" valor={brl(tot.honorarios)} icone="💰" cor={C.amber} />
      </Stats>

      <Card titulo="Benefício estimado por grupo">
        {ordem.length === 0 ? <Vazio icone="📈" titulo="Sem dados no período" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ordem.map((g: any) => (
              <div key={g.nome}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", marginBottom: 4 }}><span>{g.nome}</span><b style={{ color: C.green }}>{brl(g.beneficio)}</b></div>
                <div style={{ height: 8, background: "#F1F5F4", borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${(g.beneficio / max) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.green}, #4ade80)`, borderRadius: 6 }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Table cols={[{ label: "Grupo" }, { label: "Contratos", align: "center" }, { label: "Financiado", align: "right" }, { label: "Taxa média contratada", align: "center" }, { label: "Acima da média", align: "center" }, { label: "Benefício", align: "right" }, { label: "Honorários", align: "right" }]}
        empty={ordem.length === 0 ? <Vazio icone="📈" titulo="Sem dados no período" /> : undefined}>
        {ordem.map((g: any) => (
          <tr key={g.nome}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{g.nome}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{g.qtd}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{brl(g.financiado)}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{g.comTaxa ? `${pctBR(g.somaTaxa / g.comTaxa)} a.m.` : "—"}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{g.abusivos ? <Pill texto={`${g.abusivos}`} cor={C.red} /> : "—"}</td>
            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: C.green }}>{brl(g.beneficio)}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{brl(g.honorarios)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

const fmtN = (n: any) => (Number.isFinite(Number(n)) && Number(n) ? Number(n).toFixed(2).replace(".", ",") : "");
