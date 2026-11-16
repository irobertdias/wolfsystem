"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Card, Btn, Banner, Field, Row, IconBtn, inputSm, thStyle, tdStyle } from "../_ui";
import { PRODUTOS, CONFIG_PADRAO, num, salvarConfig, type ConfigConsignado, type Banco } from "../_dados";

const f2 = (v: any) => (v === undefined || v === null || v === "" ? "" : String(v).replace(".", ","));

export default function ConfigConsignadoSection({ dados }: any) {
  const { wsId, cfg, carregar } = dados;
  const [geral, setGeral] = useState<Record<string, string>>({});
  const [base, setBase] = useState<"bruto" | "liberado">("bruto");
  const [bancos, setBancos] = useState<{ nome: string; comissoes: Record<string, string> }[]>([]);
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setGeral({
      comissao_padrao: f2(cfg.comissao_padrao), taxa_teto: f2(cfg.taxa_teto), taxa_teto_cartao: f2(cfg.taxa_teto_cartao),
      margem_emprestimo: f2(cfg.margem_emprestimo), margem_cartao: f2(cfg.margem_cartao), margem_beneficio: f2(cfg.margem_beneficio), prazo_maximo: String(cfg.prazo_maximo),
    });
    setBase(cfg.base_comissao || "bruto");
    setBancos(cfg.bancos.map((b: Banco) => ({ nome: b.nome, comissoes: Object.fromEntries(Object.entries(b.comissoes || {}).map(([k, v]) => [k, f2(v)])) })));
  }, [cfg]);

  const setG = (k: string, v: string) => setGeral((g) => ({ ...g, [k]: v }));
  const setCom = (i: number, prod: string, v: string) => setBancos((l) => l.map((b, j) => (j === i ? { ...b, comissoes: { ...b.comissoes, [prod]: v } } : b)));

  async function salvar() {
    setSalvando(true); setAviso("");
    const novo: ConfigConsignado = {
      comissao_padrao: num(geral.comissao_padrao), base_comissao: base,
      taxa_teto: num(geral.taxa_teto) || CONFIG_PADRAO.taxa_teto, taxa_teto_cartao: num(geral.taxa_teto_cartao) || CONFIG_PADRAO.taxa_teto_cartao,
      margem_emprestimo: num(geral.margem_emprestimo) || CONFIG_PADRAO.margem_emprestimo, margem_cartao: num(geral.margem_cartao), margem_beneficio: num(geral.margem_beneficio),
      prazo_maximo: Math.round(num(geral.prazo_maximo)) || CONFIG_PADRAO.prazo_maximo,
      bancos: bancos.filter((b) => b.nome.trim()).map((b) => ({ nome: b.nome.trim(), comissoes: Object.fromEntries(Object.entries(b.comissoes).filter(([, v]) => String(v).trim() !== "").map(([k, v]) => [k, num(v)])) })),
    };
    const { error } = await salvarConfig(wsId, novo);
    setSalvando(false);
    setAviso(error ? "Erro ao salvar: " + error.message : "Configurações salvas.");
    if (!error) carregar();
  }

  return (
    <Page>
      <PageHeader titulo="Bancos, comissões e taxas" subtitulo="Regras usadas no cálculo de comissão e no simulador" acao={<Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn>} />
      {aviso && <Banner tipo={aviso.startsWith("Erro") ? "warn" : "ok"}>{aviso}</Banner>}
      <Card titulo="Comissão">
        <Row>
          <Field label="Comissão padrão (%)" flex="1 1 180px"><input style={inputSm} inputMode="decimal" value={geral.comissao_padrao || ""} onChange={(e) => setG("comissao_padrao", e.target.value)} /></Field>
          <Field label="Calcular sobre" flex="1 1 220px">
            <select style={inputSm} value={base} onChange={(e) => setBase(e.target.value as any)}><option value="bruto">Valor do contrato (produção bruta)</option><option value="liberado">Valor liberado ao cliente</option></select>
          </Field>
        </Row>
        <div style={{ fontSize: 12.5, color: "var(--k-mut)", marginTop: 8 }}>A comissão do banco/produto na tabela abaixo tem prioridade; o percentual digitado no próprio contrato tem prioridade sobre os dois.</div>
      </Card>
      <Card titulo="Taxas, margem e prazo de referência">
        <Row>
          <Field label="Teto de juros empréstimo (% a.m.)" flex="1 1 200px"><input style={inputSm} inputMode="decimal" value={geral.taxa_teto || ""} onChange={(e) => setG("taxa_teto", e.target.value)} /></Field>
          <Field label="Teto de juros cartão (% a.m.)" flex="1 1 200px"><input style={inputSm} inputMode="decimal" value={geral.taxa_teto_cartao || ""} onChange={(e) => setG("taxa_teto_cartao", e.target.value)} /></Field>
          <Field label="Prazo máximo (meses)" flex="1 1 160px"><input style={inputSm} inputMode="numeric" value={geral.prazo_maximo || ""} onChange={(e) => setG("prazo_maximo", e.target.value)} /></Field>
        </Row>
        <div style={{ height: 12 }} />
        <Row>
          <Field label="Margem empréstimo (% da renda)" flex="1 1 200px"><input style={inputSm} inputMode="decimal" value={geral.margem_emprestimo || ""} onChange={(e) => setG("margem_emprestimo", e.target.value)} /></Field>
          <Field label="Margem cartão consignado (%)" flex="1 1 200px"><input style={inputSm} inputMode="decimal" value={geral.margem_cartao || ""} onChange={(e) => setG("margem_cartao", e.target.value)} /></Field>
          <Field label="Margem cartão benefício (%)" flex="1 1 200px"><input style={inputSm} inputMode="decimal" value={geral.margem_beneficio || ""} onChange={(e) => setG("margem_beneficio", e.target.value)} /></Field>
        </Row>
        <div style={{ fontSize: 12.5, color: "var(--k-mut)", marginTop: 8 }}>Os tetos e margens mudam por norma do INSS e de cada convênio: confira e atualize quando houver mudança.</div>
      </Card>
      <Card titulo="Comissão por banco e produto (%)" pad={0}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={thStyle}>Banco</th>{PRODUTOS.map((p) => <th key={p.key} style={{ ...thStyle, whiteSpace: "normal", minWidth: 96 }}>{p.label}</th>)}<th style={thStyle} /></tr></thead>
            <tbody>
              {bancos.map((b, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={{ ...inputSm, minWidth: 150 }} value={b.nome} onChange={(e) => setBancos((l) => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} /></td>
                  {PRODUTOS.map((p) => <td key={p.key} style={tdStyle}><input style={{ ...inputSm, width: 80 }} inputMode="decimal" placeholder="—" value={b.comissoes[p.key] || ""} onChange={(e) => setCom(i, p.key, e.target.value)} /></td>)}
                  <td style={{ ...tdStyle, textAlign: "right" }}><IconBtn icone="🗑️" title="Remover banco" onClick={() => setBancos((l) => l.filter((_, j) => j !== i))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 14 }}><Btn variante="ghost" onClick={() => setBancos((l) => [...l, { nome: "", comissoes: {} }])}>＋ Adicionar banco</Btn></div>
      </Card>
    </Page>
  );
}
