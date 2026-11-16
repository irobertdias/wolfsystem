"use client";
import { useState } from "react";
import { Card, Field, Row, inputSm } from "../crm/financeiro/_sections/_ui";
import { TABELA_SEDEX_PADRAO, type FreteConfig } from "../lib/loja-orcamento";

// Ajustes da loja → frete: fixo (taxa única) ou calculado pelo CEP do cliente
// (Correios com contrato ou tabela padrão Sedex/PAC por faixa de distância).

const n = (v: any) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const v = (x: any) => (x === undefined || x === null ? "" : String(x).replace(".", ","));

export default function ConfigFreteLoja({ valor, onChange, taxaFixa, onTaxaFixa, roupas }: { valor: FreteConfig; onChange: (f: FreteConfig) => void; taxaFixa: string; onTaxaFixa: (s: string) => void; roupas?: boolean }) {
  const fr = valor || {};
  const set = (p: Partial<FreteConfig>) => onChange({ ...fr, ...p });
  const tab = { ...TABELA_SEDEX_PADRAO, ...(fr.tabela || {}) };
  const emb = fr.embalagem || { comprimento: 30, largura: 20, altura: 15 };
  const servicos = fr.servicos?.length ? fr.servicos : ["SEDEX", "PAC"];
  const [verCorreios, setVerCorreios] = useState(!!fr.correios?.usuario);
  const calculado = fr.modo === "calculado";
  const op = (ativo: boolean): any => ({ flex: "1 1 220px", textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: "pointer", border: 0, background: ativo ? "var(--w-50)" : "#F7FAF9", boxShadow: ativo ? "inset 0 0 0 2px var(--w-500)" : "inset 0 0 0 1px #E6ECEA" });

  return (
    <Card titulo="Frete">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" style={op(!calculado)} onClick={() => set({ modo: "fixo" })}><b style={{ display: "block", fontSize: 14 }}>Frete fixo</b><span style={{ fontSize: 12.5, color: "#64748B" }}>Um valor único para qualquer endereço</span></button>
        <button type="button" style={op(calculado)} onClick={() => set({ modo: "calculado" })}><b style={{ display: "block", fontSize: 14 }}>Calculado pelo CEP (Sedex / PAC)</b><span style={{ fontSize: 12.5, color: "#64748B" }}>O cliente digita o CEP e escolhe o envio</span></button>
      </div>
      {!calculado ? (
        <Row>
          <Field label={roupas ? "Taxa de entrega (R$)" : "Frete fixo (R$)"} flex="1 1 180px"><input style={inputSm} inputMode="decimal" value={taxaFixa} onChange={(e) => onTaxaFixa(e.target.value)} /></Field>
          <Field label="Frete grátis acima de (R$) — opcional" flex="1 1 220px"><input style={inputSm} inputMode="decimal" value={v(fr.gratis_acima)} onChange={(e) => set({ gratis_acima: n(e.target.value) || undefined })} /></Field>
        </Row>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row>
            <Field label="CEP de origem (de onde sai)" flex="1 1 160px"><input style={inputSm} inputMode="numeric" value={fr.cep_origem || ""} onChange={(e) => set({ cep_origem: e.target.value })} placeholder="74000-000" /></Field>
            <Field label="Serviços oferecidos" flex="1 1 200px">
              <div style={{ display: "flex", gap: 14, alignItems: "center", height: 40 }}>
                {(["SEDEX", "PAC"] as const).map((s) => (
                  <label key={s} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, fontWeight: 700 }}>
                    <input type="checkbox" checked={servicos.includes(s)} onChange={(e) => { const novo = e.target.checked ? [...new Set([...servicos, s])] : servicos.filter((x) => x !== s); set({ servicos: (novo.length ? novo : [s === "SEDEX" ? "PAC" : "SEDEX"]) as any }); }} />{s}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Peso padrão por item (kg)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" value={v(fr.peso_padrao_kg ?? 0.5)} onChange={(e) => set({ peso_padrao_kg: n(e.target.value) })} /></Field>
          </Row>
          <Row>
            <Field label="Caixa: comprimento (cm)" flex="1 1 120px"><input style={inputSm} inputMode="numeric" value={emb.comprimento} onChange={(e) => set({ embalagem: { ...emb, comprimento: n(e.target.value) } })} /></Field>
            <Field label="Largura (cm)" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={emb.largura} onChange={(e) => set({ embalagem: { ...emb, largura: n(e.target.value) } })} /></Field>
            <Field label="Altura (cm)" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={emb.altura} onChange={(e) => set({ embalagem: { ...emb, altura: n(e.target.value) } })} /></Field>
            <Field label="Embalagem/manuseio (R$)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" value={v(fr.adicional)} onChange={(e) => set({ adicional: n(e.target.value) || undefined })} /></Field>
            <Field label="Grátis acima de (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={v(fr.gratis_acima)} onChange={(e) => set({ gratis_acima: n(e.target.value) || undefined })} /></Field>
          </Row>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--w-800)", marginTop: 4 }}>Tabela padrão Sedex até 1 kg (usada sem contrato dos Correios; o PAC sai por ~68% do valor)</div>
          <Row>
            {([["local", "Mesma cidade"], ["estadual", "Mesmo estado"], ["regional", "Mesma região"], ["nacional", "Outras regiões"], ["kg_adicional", "Cada kg a mais"]] as const).map(([k, l]) => (
              <Field key={k} label={`${l} (R$)`} flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={v((tab as any)[k])} onChange={(e) => set({ tabela: { ...tab, [k]: n(e.target.value) } })} /></Field>
            ))}
          </Row>
          <a onClick={() => setVerCorreios(!verCorreios)} style={{ fontSize: 13, fontWeight: 700, color: "var(--w-700)", cursor: "pointer" }}>{verCorreios ? "▾" : "▸"} Tenho contrato com os Correios (preço e prazo oficiais)</a>
          {verCorreios && (
            <>
              <Row>
                <Field label="Usuário (Meu Correios)" flex="1 1 160px"><input style={inputSm} value={fr.correios?.usuario || ""} onChange={(e) => set({ correios: { ...fr.correios, usuario: e.target.value } })} /></Field>
                <Field label="Código de acesso à API" flex="1 1 200px"><input style={inputSm} type="password" autoComplete="off" value={fr.correios?.codigo_acesso || ""} onChange={(e) => set({ correios: { ...fr.correios, codigo_acesso: e.target.value } })} /></Field>
                <Field label="Cartão de postagem" flex="1 1 150px"><input style={inputSm} value={fr.correios?.cartao || ""} onChange={(e) => set({ correios: { ...fr.correios, cartao: e.target.value } })} /></Field>
                <Field label="Nº do contrato" flex="1 1 130px"><input style={inputSm} value={fr.correios?.contrato || ""} onChange={(e) => set({ correios: { ...fr.correios, contrato: e.target.value } })} /></Field>
                <Field label="DR" flex="0 1 80px"><input style={inputSm} value={fr.correios?.dr || ""} onChange={(e) => set({ correios: { ...fr.correios, dr: e.target.value } })} /></Field>
              </Row>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>O código de acesso é gerado em cws.correios.com.br. Se a API dos Correios falhar, o sistema usa a tabela acima.</span>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
