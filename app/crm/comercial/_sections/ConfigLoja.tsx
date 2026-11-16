"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Card, Btn, Banner, Field, Row, inputSm } from "../_ui";
import { num, salvarConfig } from "../_dados";

const lista = (s: string) => s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

export default function ConfigLoja({ dados }: any) {
  const { wsId, modo, cfg, carregar } = dados;
  const roupas = modo === "roupas";
  const [f, setF] = useState({ pagamentos: "", categorias: "", tamanhos: "", taxa: "", minimo: "", validade: "" });
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setF({ pagamentos: cfg.formas_pagamento.join("\n"), categorias: cfg.categorias.join("\n"), tamanhos: cfg.tamanhos.join(", "), taxa: String(cfg.taxa_entrega).replace(".", ","), minimo: String(cfg.estoque_minimo), validade: String(cfg.validade_orcamento_dias) });
  }, [cfg]);

  async function salvar() {
    setSalvando(true); setAviso("");
    const { error } = await salvarConfig(wsId, {
      ...cfg,
      formas_pagamento: lista(f.pagamentos), categorias: lista(f.categorias), tamanhos: lista(f.tamanhos),
      taxa_entrega: num(f.taxa), estoque_minimo: Math.max(0, Math.round(num(f.minimo))), validade_orcamento_dias: Math.max(1, Math.round(num(f.validade)) || 7),
    });
    setSalvando(false);
    setAviso(error ? "Erro ao salvar: " + error.message : "Configurações salvas.");
    if (!error) carregar();
  }

  return (
    <Page>
      <PageHeader titulo={roupas ? "Pagamentos, entrega e tamanhos" : "Pagamentos e regras"} subtitulo="Regras usadas nos pedidos, no catálogo e no estoque" acao={<Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn>} />
      {aviso && <Banner tipo={aviso.startsWith("Erro") ? "warn" : "ok"}>{aviso}</Banner>}
      <Card titulo="Vendas">
        <Row>
          <Field label="Formas de pagamento (uma por linha)" flex="1 1 260px"><textarea style={{ ...inputSm, minHeight: 130 }} value={f.pagamentos} onChange={(e) => setF({ ...f, pagamentos: e.target.value })} /></Field>
          <Field label="Categorias (uma por linha)" flex="1 1 260px"><textarea style={{ ...inputSm, minHeight: 130 }} value={f.categorias} onChange={(e) => setF({ ...f, categorias: e.target.value })} /></Field>
        </Row>
      </Card>
      <Card titulo={roupas ? "Entrega, estoque e grade" : "Entrega, estoque e orçamentos"}>
        <Row>
          <Field label={roupas ? "Taxa de entrega padrão (R$)" : "Frete padrão (R$)"} flex="1 1 180px"><input style={inputSm} inputMode="decimal" value={f.taxa} onChange={(e) => setF({ ...f, taxa: e.target.value })} /></Field>
          <Field label="Avisar estoque baixo com até (un.)" flex="1 1 180px"><input style={inputSm} inputMode="numeric" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} /></Field>
          {roupas
            ? <Field label="Tamanhos da grade (separados por vírgula)" flex="2 1 280px"><input style={inputSm} value={f.tamanhos} onChange={(e) => setF({ ...f, tamanhos: e.target.value })} placeholder="PP, P, M, G, GG ou 34, 36, 38…" /></Field>
            : <Field label="Validade do orçamento (dias)" flex="1 1 180px"><input style={inputSm} inputMode="numeric" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} /></Field>}
        </Row>
        {roupas && <div style={{ fontSize: 12.5, color: "var(--c-mut)", marginTop: 8 }}>Para calçados ou calças numeradas, use por exemplo: 34, 35, 36, 37, 38, 39, 40, 42, 44.</div>}
      </Card>
    </Page>
  );
}
