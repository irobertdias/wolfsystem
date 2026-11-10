"use client";
import { useEffect, useRef, useState } from "react";
import { Page, PageHeader, Card, Btn, Banner, Field, Row, Table, IconBtn, inputSm, tdStyle } from "../../financeiro/_sections/_ui";
import { salvarConfig, MODALIDADES_PADRAO, num, type ConfigRevisional, type Modalidade } from "../_dados";
import { CAMPOS_MODELO, MODELO_PADRAO, textoContratoRevisional } from "../../../lib/revisional-contrato";

const fmt = (v: any) => String(v ?? "").replace(".", ",");

export default function ConfigRevisionalSection({ dados }: any) {
  const { wsId, cfg, carregar } = dados;
  const [mods, setMods] = useState<(Modalidade & { taxaTxt: string })[]>([]);
  const [geral, setGeral] = useState({ fator: "", entrada: "", exito: "", parcelas: "", dobro: false });
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modelo, setModelo] = useState("");
  const [previa, setPrevia] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMods(cfg.modalidades.map((m: Modalidade) => ({ ...m, taxaTxt: fmt(m.taxaMedia) })));
    setGeral({ fator: fmt(cfg.fator_abusividade), entrada: fmt(cfg.honorarios_entrada), exito: fmt(cfg.honorarios_exito), parcelas: String(cfg.honorarios_parcelas), dobro: !!cfg.repeticao_dobro });
    setModelo(cfg.modelo_contrato || MODELO_PADRAO);
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
      // guarda só se for diferente do padrão (assim melhorias no padrão chegam a quem não personalizou)
      modelo_contrato: modelo.trim() && modelo.trim() !== MODELO_PADRAO.trim() ? modelo : "",
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

      <Card titulo="Modelo do contrato de prestação de serviços"
        acao={<div style={{ display: "flex", gap: 8 }}>
          <Btn variante="ghost" onClick={() => setPrevia((v) => !v)}>{previa ? "Editar texto" : "Ver com dados de exemplo"}</Btn>
          <Btn variante="ghost" onClick={() => { if (confirm("Trocar o texto atual pelo modelo padrão do sistema?")) setModelo(MODELO_PADRAO); }}>Restaurar modelo padrão</Btn>
        </div>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
            Este texto é usado quando o vendedor clica em <b>Gerar contrato</b> numa proposta aceita. Os marcadores entre chaves são trocados pelos dados da empresa, do cliente e da proposta. Clique num marcador para inserir onde está o cursor. Depois de editar, clique em <b>Salvar</b> lá em cima.
          </div>
          <div style={{ background: "#FFF7ED", boxShadow: "inset 0 0 0 1.5px #FED7AA", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#7C2D12" }}>
            O modelo padrão é um ponto de partida. Peça ao jurídico da empresa para revisar e ajustar as cláusulas antes de usar com clientes.
          </div>
          {!previa && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(["Empresa", "Cliente", "Contrato", "Honorários", "Outros"] as const).map((g) => (
                <div key={g} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", width: 80 }}>{g}</span>
                  {CAMPOS_MODELO.filter((c) => c.grupo === g).map((c) => (
                    <button key={c.chave} type="button" title={c.desc}
                      onClick={() => {
                        const el = areaRef.current; const marca = `{${c.chave}}`;
                        if (!el) { setModelo((m) => m + marca); return; }
                        const ini = el.selectionStart ?? modelo.length, fim = el.selectionEnd ?? modelo.length;
                        const novo = modelo.slice(0, ini) + marca + modelo.slice(fim);
                        setModelo(novo);
                        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + marca.length, ini + marca.length); });
                      }}
                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "4px 10px", background: "#ECFDF5", color: "#047857", fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                      {`{${c.chave}}`}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {previa ? (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.65, color: "#0F172A", background: "#F7FAF9", borderRadius: 14, padding: 18, maxHeight: 520, overflowY: "auto" }}>
              {textoContratoRevisional({
                id: "exemplo", numero: "A1B2C-3D4E", tipo: "veiculo", cliente_nome: "Maria da Silva", cliente_documento: "12345678909", cliente_telefone: "62999998888", consultor_nome: "Consultor",
                dados: { banco: "Banco Exemplo S.A.", modelo: "Onix", ano: "2021", valor_financiado: 58000, prazo: 48, pagas: 14, parcela_atual: 1890.5 },
                resultado: { economia_total: 21450.33, parcela_corrigida: 1415.2 },
              }, { modelo, honorarios_exito: num(geral.exito), honorarios_entrada: num(geral.entrada), empresa_nome: "Sua Empresa Ltda", empresa_cnpj: "12345678000190", empresa_endereco: "Rua Exemplo, 100 — Goiânia/GO", cliente_email: "maria@email.com" })}
            </pre>
          ) : (
            <textarea ref={areaRef} value={modelo} onChange={(e) => setModelo(e.target.value)} rows={22} spellCheck
              style={{ ...inputSm, width: "100%", boxSizing: "border-box", fontSize: 13.5, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical", minHeight: 360 }} />
          )}
        </div>
      </Card>
    </Page>
  );
}
