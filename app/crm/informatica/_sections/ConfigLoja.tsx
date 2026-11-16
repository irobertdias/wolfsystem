"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Card, Btn, Banner, Field, Row, inputSm } from "../../financeiro/_sections/_ui";
import { num, salvarConfig } from "../_dados";
import { reduzirLogo, cnpjFmt, type EmpresaLoja } from "../../../lib/loja-orcamento";
import ChaveIALoja from "../../../components/ChaveIALoja";
import { useModulos } from "../../../hooks/useModulos";
import { nichoLiberado } from "../../../lib/modulos-nicho";

const lista = (s: string) => s.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

export default function ConfigLoja({ dados }: any) {
  const { wsId, modo, cfg, carregar } = dados;
  const { modulos } = useModulos();
  const iaLiberada = nichoLiberado(modulos.nicho_opcoes, "informatica", "ia_cadastro");
  const roupas = modo === "roupas";
  const [f, setF] = useState({ pagamentos: "", categorias: "", tamanhos: "", taxa: "", minimo: "", validade: "", tecnicos: "", garantia: "" });
  const [aviso, setAviso] = useState("");
  const [emp, setEmp] = useState<EmpresaLoja>({});
  useEffect(() => { setEmp(cfg.empresa || {}); }, [cfg]);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setF({ pagamentos: cfg.formas_pagamento.join("\n"), categorias: cfg.categorias.join("\n"), tamanhos: cfg.tamanhos.join(", "), taxa: String(cfg.taxa_entrega).replace(".", ","), minimo: String(cfg.estoque_minimo), validade: String(cfg.validade_orcamento_dias), tecnicos: (cfg.tecnicos || []).join("\n"), garantia: String(cfg.garantia_servico_dias ?? 90) });
  }, [cfg]);

  async function salvar() {
    setSalvando(true); setAviso("");
    const { error } = await salvarConfig(wsId, {
      ...cfg,
      empresa: emp,
      formas_pagamento: lista(f.pagamentos), categorias: lista(f.categorias), tamanhos: lista(f.tamanhos),
      taxa_entrega: num(f.taxa), estoque_minimo: Math.max(0, Math.round(num(f.minimo))), validade_orcamento_dias: Math.max(1, Math.round(num(f.validade)) || 7), tecnicos: lista(f.tecnicos), garantia_servico_dias: Math.max(0, Math.round(num(f.garantia))),
    });
    setSalvando(false);
    setAviso(error ? "Erro ao salvar: " + error.message : "Configurações salvas.");
    if (!error) carregar();
  }

  return (
    <Page>
      <PageHeader titulo="Pagamentos, técnicos e garantia" subtitulo="Regras usadas nos pedidos, no catálogo e no estoque" acao={<Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn>} />
      {aviso && <Banner tipo={aviso.startsWith("Erro") ? "warn" : "ok"}>{aviso}</Banner>}
      <Card titulo="Dados da empresa (saem no orçamento, no PDF e no link)">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <label style={{ width: 130, height: 130, borderRadius: 16, cursor: "pointer", background: emp.logo ? `#fff url(${emp.logo}) center/contain no-repeat` : "var(--w-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--w-700)", fontSize: 12.5, fontWeight: 800, textAlign: "center", boxShadow: "inset 0 0 0 1.5px var(--w-200)", flexShrink: 0 }}>
            {!emp.logo && "＋ Logo da empresa"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => { const a = e.target.files?.[0]; if (!a) return; try { setEmp({ ...emp, logo: await reduzirLogo(a) }); } catch (er: any) { setAviso("Erro: " + er.message); } }} />
          </label>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 10 }}>
            <Row>
              <Field label="Razão social / nome fantasia" flex="2 1 260px"><input style={inputSm} value={emp.nome || ""} onChange={(e) => setEmp({ ...emp, nome: e.target.value })} /></Field>
              <Field label="CNPJ" flex="1 1 170px"><input style={inputSm} value={emp.cnpj || ""} onChange={(e) => setEmp({ ...emp, cnpj: e.target.value })} onBlur={() => setEmp((x) => ({ ...x, cnpj: cnpjFmt(x.cnpj) }))} placeholder="00.000.000/0000-00" /></Field>
              <Field label="Inscrição estadual" flex="1 1 140px"><input style={inputSm} value={emp.ie || ""} onChange={(e) => setEmp({ ...emp, ie: e.target.value })} /></Field>
            </Row>
            <Row>
              <Field label="Endereço" flex="3 1 260px"><input style={inputSm} value={emp.endereco || ""} onChange={(e) => setEmp({ ...emp, endereco: e.target.value })} placeholder="Rua, número, bairro" /></Field>
              <Field label="Cidade/UF" flex="1 1 150px"><input style={inputSm} value={emp.cidade || ""} onChange={(e) => setEmp({ ...emp, cidade: e.target.value })} placeholder="Goiânia/GO" /></Field>
              <Field label="CEP" flex="0 1 120px"><input style={inputSm} value={emp.cep || ""} onChange={(e) => setEmp({ ...emp, cep: e.target.value })} /></Field>
            </Row>
            <Row>
              <Field label="Telefone / WhatsApp" flex="1 1 170px"><input style={inputSm} value={emp.telefone || ""} onChange={(e) => setEmp({ ...emp, telefone: e.target.value })} /></Field>
              <Field label="E-mail" flex="1 1 200px"><input style={inputSm} value={emp.email || ""} onChange={(e) => setEmp({ ...emp, email: e.target.value })} /></Field>
              <Field label="Site / Instagram" flex="1 1 170px"><input style={inputSm} value={emp.site || ""} onChange={(e) => setEmp({ ...emp, site: e.target.value })} /></Field>
            </Row>
            <Field label="Condições impressas no orçamento"><textarea style={{ ...inputSm, minHeight: 64 }} value={emp.condicoes || ""} onChange={(e) => setEmp({ ...emp, condicoes: e.target.value })} placeholder="Ex.: Garantia de 90 dias no serviço. Preços sujeitos a alteração após a validade." /></Field>
            {emp.logo && <a onClick={() => setEmp({ ...emp, logo: undefined })} style={{ fontSize: 12, color: "#94A3B8", cursor: "pointer" }}>remover logo</a>}
          </div>
        </div>
      </Card>
      {iaLiberada && <ChaveIALoja wsId={wsId} />}
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
        {roupas && <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 8 }}>Para calçados ou calças numeradas, use por exemplo: 34, 35, 36, 37, 38, 39, 40, 42, 44.</div>}
      </Card>
      <Card titulo="Assistência técnica">
        <Row>
          <Field label="Técnicos (um por linha)" flex="1 1 260px"><textarea style={{ ...inputSm, minHeight: 110 }} value={f.tecnicos} onChange={(e) => setF({ ...f, tecnicos: e.target.value })} placeholder="Deixe vazio para usar os usuários do workspace" /></Field>
          <Field label="Garantia padrão do serviço (dias)" flex="1 1 200px"><input style={inputSm} inputMode="numeric" value={f.garantia} onChange={(e) => setF({ ...f, garantia: e.target.value })} /></Field>
        </Row>
        <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 8 }}>O Código de Defesa do Consumidor prevê no mínimo 90 dias de garantia para serviços em produtos duráveis.</div>
      </Card>
    </Page>
  );
}
