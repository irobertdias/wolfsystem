"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Stats, Stat, Card, Btn, Banner, Field, Row, Table, inputSm, tdStyle, C } from "../../financeiro/_sections/_ui";
import { rev, calcular, honorariosPrevistos, salvarContrato, brl, pctBR, num, anual, type Contrato } from "../_dados";

const INICIAL = { valor_financiado: "", prazo: "", parcela: "", taxa_mensal: "", parcelas_pagas: "", taxa_media: "", plano: "veiculo" };
const fmt = (v: any) => (v === undefined || v === null || v === 0 ? "" : String(v).replace(".", ","));

// Tabela Price: saldo, juros e amortização mês a mês.
function tabela(pv: number, i: number, n: number, parcela: number) {
  const linhas: { n: number; juros: number; amort: number; saldo: number }[] = [];
  let saldo = pv;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i;
    const amort = parcela - juros;
    saldo = Math.max(saldo - amort, 0);
    linhas.push({ n: k, juros, amort, saldo });
  }
  return linhas;
}

export default function Calculo({ dados, alvo }: any) {
  const { wsId, contratos, cfg, carregar } = dados;
  const [contratoId, setContratoId] = useState<number | "">("");
  const [f, setF] = useState(INICIAL);
  const [verTabela, setVerTabela] = useState(false);
  const [aviso, setAviso] = useState("");

  const preencher = (c?: Contrato) => {
    if (!c) { setF(INICIAL); return; }
    const d = rev(c);
    setF({ valor_financiado: fmt(d.valor_financiado), prazo: fmt(d.prazo), parcela: fmt(d.parcela), taxa_mensal: fmt(d.taxa_mensal), parcelas_pagas: fmt(d.parcelas_pagas), taxa_media: fmt(d.taxa_media), plano: c.plano || "veiculo" });
  };

  useEffect(() => {
    if (alvo?.contratoId) { setContratoId(alvo.contratoId); preencher(contratos.find((c: Contrato) => c.id === alvo.contratoId)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.t, contratos.length]);

  const set = (k: keyof typeof INICIAL, v: string) => setF((p) => ({ ...p, [k]: v }));
  const d = {
    valor_financiado: num(f.valor_financiado), prazo: Math.round(num(f.prazo)), parcela: num(f.parcela), taxa_mensal: num(f.taxa_mensal),
    parcelas_pagas: Math.round(num(f.parcelas_pagas)), taxa_media: f.taxa_media.trim() ? num(f.taxa_media) : null,
  };
  const calc = calcular(d, f.plano, cfg);
  const contrato = contratos.find((c: Contrato) => c.id === contratoId);
  const hon = honorariosPrevistos(contrato ? rev(contrato) : {}, calc, cfg);

  const salvar = async () => {
    if (!contrato) return;
    const { error } = await salvarContrato(wsId, { plano: f.plano }, { ...rev(contrato), ...d }, contrato.id, contrato.dados_customizados);
    setAviso(error ? "Erro ao salvar: " + error.message : "Cálculo salvo no contrato.");
    if (!error) carregar();
  };

  const linhasC = calc.valido ? tabela(d.valor_financiado, calc.taxaContratada / 100, d.prazo, calc.parcelaContratada) : [];
  const linhasR = calc.valido ? tabela(d.valor_financiado, calc.taxaMedia / 100, d.prazo, calc.parcelaRevisada) : [];

  return (
    <Page>
      <PageHeader icone="🧮" titulo="Cálculo revisional" subtitulo="Compara a taxa do contrato com a taxa média de mercado (Tabela Price)"
        acao={<div style={{ display: "flex", gap: 8 }}>{calc.valido && <Btn variante="ghost" onClick={() => window.print()}>🖨️ Imprimir</Btn>}{contrato && <Btn onClick={salvar}>💾 Salvar no contrato</Btn>}</div>} />

      {aviso && <Banner tipo={aviso.startsWith("Erro") ? "warn" : "ok"}>{aviso}</Banner>}

      <Card titulo="Dados do contrato">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Row>
            <Field label="Contrato do cliente (opcional)" flex="2 1 280px">
              <select style={inputSm} value={contratoId} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : ""; setContratoId(id); setAviso(""); preencher(contratos.find((c: Contrato) => c.id === id)); }}>
                <option value="">— Cálculo avulso —</option>
                {contratos.map((c: Contrato) => <option key={c.id} value={c.id}>{c.nome}{c.operadora ? ` · ${c.operadora}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Modalidade" flex="1 1 200px">
              <select style={inputSm} value={f.plano} onChange={(e) => set("plano", e.target.value)}>{cfg.modalidades.map((m: any) => <option key={m.key} value={m.key}>{m.icone} {m.label}</option>)}</select>
            </Field>
          </Row>
          <Row>
            <Field label="Valor financiado (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={f.valor_financiado} onChange={(e) => set("valor_financiado", e.target.value)} /></Field>
            <Field label="Prazo (meses)" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} /></Field>
            <Field label="Parcela (R$)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={f.parcela} onChange={(e) => set("parcela", e.target.value)} /></Field>
            <Field label="Taxa contratada (% a.m.)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={f.taxa_mensal} onChange={(e) => set("taxa_mensal", e.target.value)} placeholder="ou deixe vazio" /></Field>
            <Field label="Parcelas pagas" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={f.parcelas_pagas} onChange={(e) => set("parcelas_pagas", e.target.value)} /></Field>
            <Field label="Taxa média (% a.m.)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={f.taxa_media} onChange={(e) => set("taxa_media", e.target.value)} placeholder={pctBR(cfg.modalidades.find((m: any) => m.key === f.plano)?.taxaMedia || 0)} /></Field>
          </Row>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Informe a parcela <b>ou</b> a taxa contratada: o sistema calcula a outra. Sem taxa média, usa a da modalidade definida em Configurações.</div>
        </div>
      </Card>

      {!calc.valido ? (
        <Banner tipo="info">Preencha valor financiado, prazo e parcela (ou taxa) para ver o resultado.</Banner>
      ) : (
        <>
          {calc.abusiva
            ? <Banner tipo="warn"><b>Taxa {calc.vezesMedia.toFixed(2)}× a média de mercado.</b> Acima do limite configurado de {cfg.fator_abusividade}×: indício de abusividade para a revisão.</Banner>
            : <Banner tipo="ok">Taxa contratada {calc.vezesMedia.toFixed(2)}× a média de mercado: abaixo do limite configurado de {cfg.fator_abusividade}×.</Banner>}

          <Stats>
            <Stat label="Taxa contratada" valor={pctBR(calc.taxaContratada)} icone="📄" cor={calc.abusiva ? C.red : C.slate} sub={`${pctBR(anual(calc.taxaContratada))} ao ano`} />
            <Stat label="Taxa média" valor={pctBR(calc.taxaMedia)} icone="🏛️" cor={C.blue} sub={`${pctBR(anual(calc.taxaMedia))} ao ano`} />
            <Stat label="Parcela revisada" valor={brl(calc.parcelaRevisada)} icone="🧾" cor={C.purple} sub={`hoje: ${brl(calc.parcelaContratada)}`} />
            <Stat label="Diferença por parcela" valor={brl(calc.diferencaParcela)} icone="➖" cor={C.amber} />
          </Stats>
          <Stats>
            <Stat label={cfg.repeticao_dobro ? "A restituir (em dobro)" : "Pago a maior"} valor={brl(calc.pagoAMaior)} icone="↩️" cor={C.green} sub={`${d.parcelas_pagas || 0} parcela(s) paga(s)`} />
            <Stat label="Economia futura" valor={brl(calc.economiaFutura)} icone="📉" cor={C.green} sub={`${Math.max(d.prazo - (d.parcelas_pagas || 0), 0)} parcela(s) restante(s)`} />
            <Stat label="Benefício total" valor={brl(calc.beneficio)} icone="💎" cor={C.green} sub="para o cliente" />
            <Stat label="Honorários de êxito" valor={brl(hon.exito)} icone="💰" cor={C.amber} sub={`${pctBR(hon.exitoPct, 0)} do benefício`} />
          </Stats>

          <Card titulo="Contrato × revisão">
            <Table cols={[{ label: "" }, { label: "Contratado", align: "right" }, { label: "Revisado", align: "right" }, { label: "Diferença", align: "right" }]}>
              {[
                ["Taxa ao mês", pctBR(calc.taxaContratada), pctBR(calc.taxaMedia), pctBR(calc.taxaContratada - calc.taxaMedia)],
                ["Taxa ao ano", pctBR(anual(calc.taxaContratada)), pctBR(anual(calc.taxaMedia)), pctBR(anual(calc.taxaContratada) - anual(calc.taxaMedia))],
                ["Parcela", brl(calc.parcelaContratada), brl(calc.parcelaRevisada), brl(calc.diferencaParcela)],
                ["Total a pagar", brl(calc.totalContratado), brl(calc.totalRevisado), brl(calc.totalContratado - calc.totalRevisado)],
                ["Total de juros", brl(calc.totalContratado - d.valor_financiado), brl(calc.totalRevisado - d.valor_financiado), brl(calc.totalContratado - calc.totalRevisado)],
              ].map((l) => (
                <tr key={l[0]}><td style={{ ...tdStyle, fontWeight: 700 }}>{l[0]}</td><td style={{ ...tdStyle, textAlign: "right" }}>{l[1]}</td><td style={{ ...tdStyle, textAlign: "right", color: C.blue, fontWeight: 700 }}>{l[2]}</td><td style={{ ...tdStyle, textAlign: "right", color: C.green, fontWeight: 800 }}>{l[3]}</td></tr>
              ))}
            </Table>
          </Card>

          <Card titulo="Evolução mês a mês" acao={<Btn variante="ghost" onClick={() => setVerTabela((v) => !v)}>{verTabela ? "Esconder tabela" : "Mostrar tabela"}</Btn>}>
            {verTabela ? (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <Table cols={[{ label: "Mês" }, { label: "Juros contratado", align: "right" }, { label: "Saldo contratado", align: "right" }, { label: "Juros revisado", align: "right" }, { label: "Saldo revisado", align: "right" }]}>
                  {linhasC.map((l, k) => (
                    <tr key={l.n} style={{ background: l.n <= (d.parcelas_pagas || 0) ? "#f0fdf4" : undefined }}>
                      <td style={tdStyle}>{l.n}{l.n <= (d.parcelas_pagas || 0) ? " ✓" : ""}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{brl(l.juros)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{brl(l.saldo)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: C.blue }}>{brl(linhasR[k]?.juros || 0)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", color: C.blue }}>{brl(linhasR[k]?.saldo || 0)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            ) : <div style={{ fontSize: 13, color: "#6b7280" }}>{d.prazo} parcelas · linhas em verde são as já pagas.</div>}
          </Card>
          <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Cálculo estimativo pela Tabela Price, sem tarifas, seguros e IOF. Confira a taxa média do Banco Central da data e modalidade do contrato antes de usar em petição.</div>
        </>
      )}
    </Page>
  );
}
