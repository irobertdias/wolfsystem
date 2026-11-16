"use client";
import { useState } from "react";
import { Page, PageHeader, Card, Field, Row, Btn, Banner, inputSm } from "../../financeiro/_sections/_ui";
import { CONVENIOS, brl, pctBR, num, simularMargem, parcelaPrice } from "../_dados";

const f2 = (v: number) => String(v).replace(".", ",");

export default function Simulador({ dados, ir }: any) {
  const { cfg } = dados;
  const [s, setS] = useState({ convenio: "INSS", renda: "", descontos: "", parcelasAtuais: "", taxa: f2(cfg.taxa_teto), prazo: String(cfg.prazo_maximo), valorDesejado: "" });
  const set = (k: string, v: string) => setS((x) => ({ ...x, [k]: v }));

  const r = simularMargem({
    renda: num(s.renda), descontos: num(s.descontos), parcelasAtuais: num(s.parcelasAtuais),
    taxa: num(s.taxa), prazo: Math.round(num(s.prazo)),
    margemPct: cfg.margem_emprestimo, margemCartaoPct: cfg.margem_cartao, margemBeneficioPct: cfg.margem_beneficio,
  });
  const parcelaDesejada = num(s.valorDesejado) ? parcelaPrice(num(s.valorDesejado), num(s.taxa) / 100, Math.round(num(s.prazo))) : 0;
  const cabe = parcelaDesejada > 0 && parcelaDesejada <= r.margemLivre + 0.005;
  const acimaTeto = num(s.taxa) > cfg.taxa_teto && s.convenio === "INSS";

  const criar = (valor: number, parcela: number) => ir("contratos", { novo: true, preenchido: {
    form: { status_venda: "SIMULACAO", plano: "novo" },
    d: { convenio: s.convenio, renda: s.renda, margem_disponivel: f2(Math.round(r.margemLivre * 100) / 100), parcela: f2(Math.round(parcela * 100) / 100), prazo: s.prazo, taxa_mensal: s.taxa, valor_bruto: f2(Math.round(valor * 100) / 100), valor_liberado: f2(Math.round(valor * 100) / 100) },
  } });

  const Linha = ({ k, v, forte }: { k: string; v: string; forte?: boolean }) => (
    <div style={{ display: "flex", padding: "10px 0", borderTop: "1px solid #F1F5F4", fontSize: 13.5 }}><span style={{ color: "#64748B" }}>{k}</span><b style={{ marginLeft: "auto", color: forte ? "var(--w-700)" : "#0F172A" }}>{v}</b></div>
  );

  return (
    <Page>
      <PageHeader titulo="Simulador de margem" subtitulo="Quanto o cliente pode contratar pela margem consignável" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card titulo="Dados do cliente">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Convênio"><select style={inputSm} value={s.convenio} onChange={(e) => set("convenio", e.target.value)}>{CONVENIOS.filter((c) => c !== "FGTS").map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Row>
              <Field label="Renda / benefício bruto (R$)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" value={s.renda} onChange={(e) => set("renda", e.target.value)} placeholder="0,00" /></Field>
              <Field label="Descontos obrigatórios (R$)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" value={s.descontos} onChange={(e) => set("descontos", e.target.value)} placeholder="IR, previdência… (0 no INSS)" /></Field>
            </Row>
            <Field label="Parcelas de consignado que já paga (R$/mês)"><input style={inputSm} inputMode="decimal" value={s.parcelasAtuais} onChange={(e) => set("parcelasAtuais", e.target.value)} placeholder="Soma das parcelas atuais" /></Field>
            <Row>
              <Field label="Taxa (% a.m.)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={s.taxa} onChange={(e) => set("taxa", e.target.value)} /></Field>
              <Field label="Prazo (meses)" flex="1 1 120px"><input style={inputSm} inputMode="numeric" value={s.prazo} onChange={(e) => set("prazo", e.target.value)} /></Field>
            </Row>
            {acimaTeto && <Banner tipo="warn">A taxa está acima do teto de referência configurado para o INSS ({pctBR(cfg.taxa_teto)} a.m.).</Banner>}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, var(--w-500), var(--w-700))", boxShadow: "0 22px 44px -24px rgba(15,23,42,.55)", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>Pode liberar até</span>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{brl(r.liberavel)}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>{r.margemLivre > 0 ? `parcela de ${brl(r.margemLivre)} em ${Math.round(num(s.prazo))}x a ${pctBR(num(s.taxa))} a.m.` : "sem margem livre para empréstimo"}</span>
            {r.liberavel > 0 && <div style={{ marginTop: 8 }}><button onClick={() => criar(r.liberavel, r.margemLivre)} style={{ border: 0, borderRadius: 12, background: "#fff", color: "var(--w-800)", fontWeight: 800, fontSize: 13.5, height: 40, padding: "0 16px", cursor: "pointer" }}>Criar contrato com esse valor</button></div>}
          </div>
          <Card titulo="Margem consignável">
            <Linha k="Base de cálculo" v={brl(r.base)} />
            <Linha k={`Margem de empréstimo (${pctBR(cfg.margem_emprestimo, 0)})`} v={brl(r.margemTotal)} />
            <Linha k="Já comprometido" v={brl(num(s.parcelasAtuais))} />
            <Linha k="Margem livre" v={brl(r.margemLivre)} forte />
            <Linha k={`Cartão consignado (${pctBR(cfg.margem_cartao, 0)})`} v={brl(r.margemCartao)} />
            <Linha k={`Cartão benefício (${pctBR(cfg.margem_beneficio, 0)})`} v={brl(r.margemBeneficio)} />
            <Linha k="Total pago no prazo" v={brl(r.totalPago)} />
          </Card>
          <Card titulo="O cliente pediu um valor?">
            <Field label="Valor desejado (R$)"><input style={inputSm} inputMode="decimal" value={s.valorDesejado} onChange={(e) => set("valorDesejado", e.target.value)} placeholder="0,00" /></Field>
            {parcelaDesejada > 0 && (
              <div style={{ marginTop: 12, fontSize: 13.5, color: "#334155", display: "flex", flexDirection: "column", gap: 8 }}>
                <span>Parcela de <b>{brl(parcelaDesejada)}</b> em {Math.round(num(s.prazo))}x. {cabe ? <b style={{ color: "var(--w-700)" }}>Cabe na margem.</b> : <b style={{ color: "#B91C1C" }}>Passa da margem livre em {brl(parcelaDesejada - r.margemLivre)}.</b>}</span>
                {cabe && <div><Btn onClick={() => criar(num(s.valorDesejado), parcelaDesejada)}>Criar contrato com {brl(num(s.valorDesejado))}</Btn></div>}
              </div>
            )}
          </Card>
          <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>Estimativa pela tabela Price com os percentuais de margem configurados. Confira as regras e a taxa de cada banco e convênio antes de digitar.</div>
        </div>
      </div>
    </Page>
  );
}
