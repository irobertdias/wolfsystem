"use client";
import { useMemo, useState } from "react";
import { Page, PageHeader, Stats, Stat, Table, Vazio, Btn, Pill, Card, inputSm, tdStyle, C } from "../../financeiro/_sections/_ui";
import { rev, calcular, honorariosPrevistos, salvarContrato, etapa, brl, dataBR, hoje, baixarCSV, type Contrato } from "../_dados";

type Filtro = "aberto" | "atrasado" | "pago" | "todos";

export default function Honorarios({ dados, ir }: any) {
  const { wsId, contratos, cfg, carregando, carregar } = dados;
  const [filtro, setFiltro] = useState<Filtro>("aberto");
  const [mes, setMes] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const parcelas = useMemo(() => contratos.flatMap((c: Contrato) => (rev(c).honorarios_parcelas || []).map((p, idx) => ({ ...p, idx, contrato: c }))), [contratos]);
  const atrasada = (p: any) => !p.pago_em && p.vencimento < hoje();

  const lista = parcelas
    .filter((p: any) => filtro === "todos" || (filtro === "pago" ? !!p.pago_em : filtro === "atrasado" ? atrasada(p) : !p.pago_em))
    .filter((p: any) => !mes || (p.pago_em || p.vencimento).slice(0, 7) === mes)
    .sort((a: any, b: any) => a.vencimento.localeCompare(b.vencimento));

  const soma = (arr: any[]) => arr.reduce((s, p) => s + (p.valor || 0), 0);
  const mesAtual = hoje().slice(0, 7);
  const recebidoMes = soma(parcelas.filter((p: any) => (p.pago_em || "").slice(0, 7) === mesAtual));
  const aReceber = soma(parcelas.filter((p: any) => !p.pago_em));
  const emAtraso = soma(parcelas.filter(atrasada));
  const recebidoTotal = soma(parcelas.filter((p: any) => p.pago_em));

  const exitos = contratos
    .map((c: Contrato) => { const d = rev(c), calc = calcular(d, c.plano, cfg); return { c, calc, hon: honorariosPrevistos(d, calc, cfg) }; })
    .filter((l: any) => l.calc.valido && l.hon.exito > 0 && l.c.status_venda !== "PERDIDO")
    .sort((a: any, b: any) => b.hon.exito - a.hon.exito);

  const alternar = async (p: any) => {
    const c: Contrato = p.contrato, d = rev(c);
    setOcupado(`${c.id}-${p.idx}`);
    const novas = (d.honorarios_parcelas || []).map((x, i) => (i === p.idx ? { ...x, pago_em: x.pago_em ? null : hoje() } : x));
    await salvarContrato(wsId, {}, { ...d, honorarios_parcelas: novas }, c.id, c.dados_customizados);
    await carregar();
    setOcupado(null);
  };

  const exportar = () => baixarCSV(`honorarios-${hoje()}.csv`, [
    ["Cliente", "CPF", "Banco", "Parcela", "Vencimento", "Valor", "Situação", "Pago em"],
    ...lista.map((p: any) => [p.contrato.nome, p.contrato.cpf || "", p.contrato.operadora || "", p.n, dataBR(p.vencimento), String(p.valor).replace(".", ","), p.pago_em ? "Paga" : atrasada(p) ? "Atrasada" : "Em aberto", dataBR(p.pago_em)]),
  ]);

  const chip = (k: Filtro, l: string) => (
    <button key={k} onClick={() => setFiltro(k)} style={{ border: `1px solid ${filtro === k ? C.amber : "#E6ECEA"}`, background: filtro === k ? `${C.amber}14` : "#fff", color: filtro === k ? C.amber : "#475569", borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>
  );

  return (
    <Page>
      <PageHeader icone="💰" titulo="Honorários" subtitulo="Entradas parceladas e êxito previsto de cada contrato" acao={<Btn variante="ghost" onClick={exportar}>Exportar CSV</Btn>} />

      <Stats>
        <Stat label="Recebido no mês" valor={brl(recebidoMes)} icone="✅" cor={C.green} />
        <Stat label="A receber" valor={brl(aReceber)} icone="📥" cor={C.blue} />
        <Stat label="Em atraso" valor={brl(emAtraso)} icone="⏰" cor={C.red} />
        <Stat label="Recebido no total" valor={brl(recebidoTotal)} icone="🏦" cor={C.slate} />
      </Stats>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {chip("aberto", "Em aberto")}{chip("atrasado", "Atrasadas")}{chip("pago", "Pagas")}{chip("todos", "Todas")}
        <span style={{ flex: 1 }} />
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...inputSm, width: 170 }} title="Filtrar por mês" />
        {mes && <Btn variante="ghost" onClick={() => setMes("")}>Limpar mês</Btn>}
      </div>

      <Table
        cols={[{ label: "Cliente" }, { label: "Parcela", align: "center" }, { label: "Vencimento" }, { label: "Valor", align: "right" }, { label: "Situação" }, { label: "", align: "right" }]}
        empty={carregando ? <span style={{ color: "#94A3B8" }}>Carregando…</span> : lista.length === 0 ? <Vazio icone="💰" titulo="Nenhuma parcela aqui" sub="Gere as parcelas da entrada na ficha do contrato (Contratos → abrir → Honorários)." acao={<Btn onClick={() => ir("contratos")}>Ir para contratos</Btn>} /> : undefined}
      >
        {lista.map((p: any) => {
          const at = atrasada(p);
          return (
            <tr key={`${p.contrato.id}-${p.idx}`}>
              <td style={tdStyle}><a onClick={() => ir("contratos", { contratoId: p.contrato.id })} style={{ fontWeight: 700, cursor: "pointer", color: "#0F172A" }}>{p.contrato.nome}</a><div style={{ fontSize: 12, color: "#94A3B8" }}>{p.contrato.operadora || "—"}</div></td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{p.n}</td>
              <td style={tdStyle}>{dataBR(p.vencimento)}{p.pago_em && <div style={{ fontSize: 12, color: "#94A3B8" }}>paga em {dataBR(p.pago_em)}</div>}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(p.valor)}</td>
              <td style={tdStyle}><Pill texto={p.pago_em ? "Paga" : at ? "Atrasada" : "Em aberto"} cor={p.pago_em ? C.green : at ? C.red : C.amber} /></td>
              <td style={{ ...tdStyle, textAlign: "right" }}><Btn variante="ghost" disabled={ocupado === `${p.contrato.id}-${p.idx}`} onClick={() => alternar(p)}>{p.pago_em ? "Desfazer" : "Dar baixa"}</Btn></td>
            </tr>
          );
        })}
      </Table>

      <Card titulo="Êxito previsto por contrato" pad={0}>
        <Table cols={[{ label: "Cliente" }, { label: "Etapa" }, { label: "Benefício", align: "right" }, { label: "% êxito", align: "center" }, { label: "Honorários de êxito", align: "right" }]}
          empty={exitos.length === 0 ? <Vazio icone="🎯" titulo="Sem êxito previsto" sub="Aparece quando o contrato tem cálculo e percentual de êxito." /> : undefined}>
          {exitos.map((l: any) => {
            const e = etapa(l.c.status_venda);
            return (
              <tr key={l.c.id}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{l.c.nome}</td>
                <td style={tdStyle}><Pill texto={`${e.icone} ${e.label}`} cor={e.cor} /></td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{brl(l.calc.beneficio)}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{l.hon.exitoPct}%</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: l.c.status_venda === "GANHO" ? C.green : C.purple }}>{brl(l.hon.exito)}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </Page>
  );
}
