"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Card, Btn, Banner, Field, Row, Table, IconBtn, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import { salvarConfig, MODALIDADES_PADRAO, num, type ConfigRevisional, type Modalidade } from "../_dados";

const fmt = (v: any) => String(v ?? "").replace(".", ",");

export default function ConfigRevisionalSection({ dados }: any) {
  const { wsId, cfg, carregar } = dados;
  const [mods, setMods] = useState<(Modalidade & { taxaTxt: string })[]>([]);
  const [geral, setGeral] = useState({ fator: "", entrada: "", exito: "", parcelas: "", dobro: false });
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setMods(cfg.modalidades.map((m: Modalidade) => ({ ...m, taxaTxt: fmt(m.taxaMedia) })));
    setGeral({ fator: fmt(cfg.fator_abusividade), entrada: fmt(cfg.honorarios_entrada), exito: fmt(cfg.honorarios_exito), parcelas: String(cfg.honorarios_parcelas), dobro: !!cfg.repeticao_dobro });
  }, [cfg]);

  const setMod = (i: number, k: "label" | "icone" | "taxaTxt", v: string) => setMods((p) => p.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  const salvar = async () => {
    setSalvando(true); setAviso("");
    const novo: ConfigRevisional = {
      modalidades: mods.filter((m) => m.label.trim()).map(({ taxaTxt, ...m }) => ({ ...m, label: m.label.trim(), taxaMedia: num(taxaTxt) })),
      fator_abusividade: num(geral.fator) || 1.5,
      honorarios_entrada: num(geral.entrada),
      honorarios_exito: num(geral.exito),
      honorarios_parcelas: Math.max(1, Math.round(num(geral.parcelas)) || 1),
      repeticao_dobro: geral.dobro,
    };
    const { error } = await salvarConfig(wsId, novo);
    setSalvando(false);
    setAviso(error ? "Erro ao salvar: " + error.message : "Configurações salvas.");
    if (!error) carregar();
  };

  return (
    <Page>
      <PageHeader icone="⚙️" titulo="Taxas e honorários" subtitulo="Parâmetros usados nos cálculos de todos os contratos" acao={<Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Btn>} />
      {aviso && <Banner tipo={aviso.startsWith("Erro") ? "warn" : "ok"}>{aviso}</Banner>}

      <Card titulo="Critérios do cálculo">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Row>
            <Field label="Taxa abusiva a partir de (× a média)" flex="1 1 220px"><input style={inputSm} inputMode="decimal" value={geral.fator} onChange={(e) => setGeral({ ...geral, fator: e.target.value })} /></Field>
            <Field label="Restituição do pago a maior" flex="1 1 220px">
              <select style={inputSm} value={geral.dobro ? "1" : "0"} onChange={(e) => setGeral({ ...geral, dobro: e.target.value === "1" })}>
                <option value="0">Simples</option>
                <option value="1">Em dobro</option>
              </select>
            </Field>
          </Row>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>Contratos com taxa igual ou acima desse múltiplo da taxa média ficam marcados com 🚩 no sistema.</div>
        </div>
      </Card>

      <Card titulo="Honorários padrão (novos contratos)">
        <Row>
          <Field label="Entrada (R$)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" value={geral.entrada} onChange={(e) => setGeral({ ...geral, entrada: e.target.value })} /></Field>
          <Field label="Parcelas da entrada" flex="1 1 160px"><input style={inputSm} inputMode="numeric" value={geral.parcelas} onChange={(e) => setGeral({ ...geral, parcelas: e.target.value })} /></Field>
          <Field label="Êxito (% do benefício)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" value={geral.exito} onChange={(e) => setGeral({ ...geral, exito: e.target.value })} /></Field>
        </Row>
      </Card>

      <Banner tipo="info">As taxas abaixo são referências iniciais. Atualize com a taxa média do Banco Central (Sistema Gerenciador de Séries) para a modalidade e o mês de cada contrato. No contrato você também pode informar a taxa média específica.</Banner>

      <Table cols={[{ label: "Ícone", width: 70 }, { label: "Modalidade" }, { label: "Taxa média (% a.m.)", width: 200 }, { label: "", align: "right", width: 60 }]}>
        {mods.map((m, i) => (
          <tr key={m.key}>
            <td style={tdStyle}><input style={{ ...inputSm, width: 52, textAlign: "center" }} value={m.icone} onChange={(e) => setMod(i, "icone", e.target.value)} /></td>
            <td style={tdStyle}><input style={inputSm} value={m.label} onChange={(e) => setMod(i, "label", e.target.value)} /></td>
            <td style={tdStyle}><input style={inputSm} inputMode="decimal" value={m.taxaTxt} onChange={(e) => setMod(i, "taxaTxt", e.target.value)} /></td>
            <td style={{ ...tdStyle, textAlign: "right" }}><IconBtn icone="🗑️" title="Remover" onClick={() => setMods((p) => p.filter((_, j) => j !== i))} /></td>
          </tr>
        ))}
      </Table>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variante="ghost" onClick={() => setMods((p) => [...p, { key: `mod_${Date.now()}`, label: "", icone: "📄", taxaMedia: 0, taxaTxt: "" }])}>＋ Adicionar modalidade</Btn>
        <Btn variante="ghost" onClick={() => setMods(MODALIDADES_PADRAO.map((m) => ({ ...m, taxaTxt: fmt(m.taxaMedia) })))}>Restaurar padrão</Btn>
      </div>
    </Page>
  );
}
