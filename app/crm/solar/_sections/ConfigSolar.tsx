"use client";
import { useEffect, useState } from "react";
import { Page, PageHeader, Card, Field, Row, Btn, Banner, inputSm } from "../../financeiro/_sections/_ui";
import { supabase } from "../../../lib/supabase";
import { TELHADOS, UFS, n, type ConfigSolar } from "../../../lib/solar";
import { salvarConfigSolar } from "../_dados";

// Ajustes do nicho solar: empresa, kit, tabela de preço por potência, tarifa,
// financiamento, validade do link, avisos e regras da Vendedora IA.

const t = (v: any) => (v === undefined || v === null ? "" : String(v).replace(".", ","));

export default function ConfigSolarTela({ dados }: any) {
  const { wsId, cfg: salvo, carregar } = dados;
  const [c, setC] = useState<ConfigSolar>(salvo);
  const [canais, setCanais] = useState<{ id: number; nome: string }[]>([]);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setC(salvo); }, [salvo]);
  useEffect(() => {
    if (!wsId) return;
    supabase.from("conexoes").select("id,nome,tipo").eq("workspace_id", wsId).order("id")
      .then(({ data }) => setCanais(((data as any[]) || []).filter((x) => !["instagram", "messenger"].includes(x.tipo))));
  }, [wsId]);

  const set = (p: Partial<ConfigSolar>) => setC((x) => ({ ...x, ...p }));
  const setEmp = (k: keyof ConfigSolar["empresa"], v: string) => setC((x) => ({ ...x, empresa: { ...x.empresa, [k]: v } }));
  const num = (k: keyof ConfigSolar) => ({ value: t(c[k]), onChange: (e: any) => set({ [k]: e.target.value } as any) });

  const salvar = async () => {
    setSalvando(true); setMsg(null);
    const limpo: ConfigSolar = {
      ...c,
      painel_w: n(c.painel_w), painel_area_m2: n(c.painel_area_m2), micro_paineis: n(c.micro_paineis), min_paineis: n(c.min_paineis),
      tarifa_padrao: n(c.tarifa_padrao), eficiencia: Math.min(1, Math.max(0.5, n(c.eficiencia) > 1 ? n(c.eficiencia) / 100 : n(c.eficiencia))),
      fio_b_pct: n(c.fio_b_pct), reajuste_aa: n(c.reajuste_aa), degradacao_aa: n(c.degradacao_aa),
      taxa_financiamento: n(c.taxa_financiamento), entrada_pct: n(c.entrada_pct), parcelas_cartao: n(c.parcelas_cartao),
      validade_minutos: Math.min(43200, Math.max(1, Math.round(n(c.validade_minutos)) || 10080)),
      faixas: c.faixas.map((f) => ({ ate_kwp: n(f.ate_kwp), preco_wp: n(f.preco_wp) })).filter((f) => f.ate_kwp > 0 && f.preco_wp > 0).sort((a, b) => a.ate_kwp - b.ate_kwp),
      adicional_telhado: Object.fromEntries(Object.entries(c.adicional_telhado).map(([k, v]) => [k, n(v)])),
      prazos_financiamento: (Array.isArray(c.prazos_financiamento) ? c.prazos_financiamento : String(c.prazos_financiamento).split(/[,; ]+/)).map((x) => Math.round(n(x))).filter((x) => x > 0),
    };
    const { error } = await salvarConfigSolar(wsId, limpo);
    setSalvando(false);
    if (error) setMsg({ tipo: "warn", texto: "Erro ao salvar: " + error.message });
    else { setMsg({ tipo: "ok", texto: "Ajustes salvos. As próximas propostas já usam esses valores." }); await carregar(); }
  };

  return (
    <Page>
      <PageHeader titulo="Kit, preços e financiamento" subtitulo="Tudo o que entra no cálculo das propostas e na Vendedora IA" acao={<Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar ajustes"}</Btn>} />
      {msg && <Banner tipo={msg.tipo}>{msg.texto}</Banner>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card titulo="Empresa (sai na proposta)">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row><Field label="Nome" flex="2 1 200px"><input style={inputSm} value={c.empresa.nome} onChange={(e) => setEmp("nome", e.target.value)} /></Field><Field label="CNPJ" flex="1 1 150px"><input style={inputSm} value={c.empresa.cnpj} onChange={(e) => setEmp("cnpj", e.target.value)} /></Field></Row>
            <Row><Field label="WhatsApp / telefone" flex="1 1 150px"><input style={inputSm} value={c.empresa.telefone} onChange={(e) => setEmp("telefone", e.target.value)} /></Field><Field label="E-mail" flex="1 1 180px"><input style={inputSm} value={c.empresa.email} onChange={(e) => setEmp("email", e.target.value)} /></Field></Row>
            <Row><Field label="Endereço" flex="2 1 200px"><input style={inputSm} value={c.empresa.endereco} onChange={(e) => setEmp("endereco", e.target.value)} /></Field><Field label="Cidade/UF" flex="1 1 140px"><input style={inputSm} value={c.empresa.cidade} onChange={(e) => setEmp("cidade", e.target.value)} /></Field></Row>
            <Row><Field label="Link da logo (imagem)" flex="2 1 200px"><input style={inputSm} value={c.empresa.logo} onChange={(e) => setEmp("logo", e.target.value)} placeholder="https://…/logo.png" /></Field><Field label="Site / Instagram" flex="1 1 150px"><input style={inputSm} value={c.empresa.site} onChange={(e) => setEmp("site", e.target.value)} /></Field></Row>
          </div>
        </Card>

        <Card titulo="Kit padrão">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row><Field label="Marca/modelo do módulo" flex="2 1 200px"><input style={inputSm} value={c.painel_marca} onChange={(e) => set({ painel_marca: e.target.value })} /></Field><Field label="Potência (W)" flex="1 1 100px"><input style={inputSm} inputMode="numeric" {...num("painel_w")} /></Field></Row>
            <Row><Field label="Área por módulo (m²)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" {...num("painel_area_m2")} /></Field><Field label="Mínimo de módulos" flex="1 1 120px"><input style={inputSm} inputMode="numeric" {...num("min_paineis")} /></Field></Row>
            <Field label="Garantia do módulo"><input style={inputSm} value={c.painel_garantia} onChange={(e) => set({ painel_garantia: e.target.value })} /></Field>
            <Row><Field label="Marca do inversor" flex="2 1 180px"><input style={inputSm} value={c.inversor_marca} onChange={(e) => set({ inversor_marca: e.target.value })} /></Field>
              <Field label="Tipo" flex="1 1 140px"><select style={inputSm} value={c.inversor_tipo} onChange={(e) => set({ inversor_tipo: e.target.value as any })}><option value="string">Inversor string</option><option value="micro">Microinversor</option></select></Field></Row>
            {c.inversor_tipo === "micro" && <Field label="Módulos por microinversor"><input style={inputSm} inputMode="numeric" {...num("micro_paineis")} /></Field>}
            <Row><Field label="Garantia do inversor" flex="1 1 150px"><input style={inputSm} value={c.inversor_garantia} onChange={(e) => set({ inversor_garantia: e.target.value })} /></Field><Field label="Garantia da instalação" flex="1 1 150px"><input style={inputSm} value={c.instalacao_garantia} onChange={(e) => set({ instalacao_garantia: e.target.value })} /></Field></Row>
            <Field label="Prazo de instalação"><input style={inputSm} value={c.prazo_instalacao} onChange={(e) => set({ prazo_instalacao: e.target.value })} /></Field>
          </div>
        </Card>

        <Card titulo="Tabela de preço (R$ por Wp, sistema instalado)">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {c.faixas.map((f, i) => (
              <Row key={i}>
                <Field label={i === 0 ? "Até (kWp)" : ""} flex="1 1 100px"><input style={inputSm} inputMode="decimal" value={t(f.ate_kwp)} onChange={(e) => set({ faixas: c.faixas.map((x, k) => (k === i ? { ...x, ate_kwp: e.target.value as any } : x)) })} /></Field>
                <Field label={i === 0 ? "R$/Wp" : ""} flex="1 1 100px"><input style={inputSm} inputMode="decimal" value={t(f.preco_wp)} onChange={(e) => set({ faixas: c.faixas.map((x, k) => (k === i ? { ...x, preco_wp: e.target.value as any } : x)) })} /></Field>
                <button onClick={() => set({ faixas: c.faixas.filter((_, k) => k !== i) })} style={{ alignSelf: "flex-end", height: 38, border: 0, background: "none", color: "#B91C1C", cursor: "pointer", fontWeight: 800 }}>×</button>
              </Row>
            ))}
            <div><Btn variante="ghost" onClick={() => set({ faixas: [...c.faixas, { ate_kwp: 9999, preco_wp: 0 }] })}>+ Faixa</Btn></div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Ex.: um sistema de 5,49 kWp na faixa de R$ 3,00/Wp sai por R$ 16.470. A última faixa vale para os sistemas maiores.</span>
            <b style={{ fontSize: 13, marginTop: 6 }}>Adicional por tipo de telhado (%)</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {TELHADOS.map((x) => <Field key={x.key} label={x.label}><input style={inputSm} inputMode="decimal" value={t(c.adicional_telhado[x.key])} onChange={(e) => set({ adicional_telhado: { ...c.adicional_telhado, [x.key]: e.target.value as any } })} /></Field>)}
            </div>
          </div>
        </Card>

        <Card titulo="Energia e economia">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row><Field label="Tarifa padrão (R$/kWh)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" {...num("tarifa_padrao")} /></Field><Field label="Estado padrão" flex="1 1 100px"><select style={inputSm} value={c.uf_padrao} onChange={(e) => set({ uf_padrao: e.target.value })}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Field></Row>
            <Row><Field label="Desempenho do sistema (0,80 = 80%)" flex="1 1 160px"><input style={inputSm} inputMode="decimal" {...num("eficiencia")} /></Field><Field label="Fio B (% da economia)" flex="1 1 130px"><input style={inputSm} inputMode="decimal" {...num("fio_b_pct")} /></Field></Row>
            <Row><Field label="Reajuste da energia (% ao ano)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" {...num("reajuste_aa")} /></Field><Field label="Perda dos módulos (% ao ano)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" {...num("degradacao_aa")} /></Field></Row>
          </div>
        </Card>

        <Card titulo="Pagamento e financiamento">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row><Field label="Juros do financiamento (% a.m.)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" {...num("taxa_financiamento")} /></Field><Field label="Prazos (meses, separados por vírgula)" flex="1 1 180px"><input style={inputSm} value={Array.isArray(c.prazos_financiamento) ? c.prazos_financiamento.join(", ") : String(c.prazos_financiamento)} onChange={(e) => set({ prazos_financiamento: e.target.value as any })} /></Field></Row>
            <Row><Field label="Entrada sugerida (%)" flex="1 1 130px"><input style={inputSm} inputMode="decimal" {...num("entrada_pct")} /></Field><Field label="Cartão em até (vezes)" flex="1 1 130px"><input style={inputSm} inputMode="numeric" {...num("parcelas_cartao")} /></Field></Row>
            <Field label="Formas de pagamento (uma por linha)"><textarea style={{ ...inputSm, minHeight: 80 }} value={c.formas_pagamento.join("\n")} onChange={(e) => set({ formas_pagamento: e.target.value.split("\n") })} onBlur={() => set({ formas_pagamento: c.formas_pagamento.map((x) => x.trim()).filter(Boolean) })} /></Field>
            <Field label="Condições que saem na proposta"><textarea style={{ ...inputSm, minHeight: 80 }} value={c.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></Field>
            <Field label="Validade do link da proposta (minutos)"><input style={inputSm} inputMode="numeric" {...num("validade_minutos")} /></Field>
          </div>
        </Card>

        <Card titulo="Avisos e Vendedora IA">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row><Field label="WhatsApp que recebe os avisos (aceite, visita)" flex="1 1 180px"><input style={inputSm} value={c.dono_whatsapp} onChange={(e) => set({ dono_whatsapp: e.target.value })} placeholder="5562999999999" /></Field>
              <Field label="Canal que envia" flex="1 1 160px"><select style={inputSm} value={c.canal_id || ""} onChange={(e) => set({ canal_id: e.target.value ? Number(e.target.value) : null })}><option value="">Canal do atendimento</option>{canais.map((x) => <option key={x.id} value={x.id}>{x.nome || `Canal ${x.id}`}</option>)}</select></Field></Row>
            <Field label="Regras extras para a Vendedora IA (tom, promoções, cidades atendidas, o que nunca prometer…)"><textarea style={{ ...inputSm, minHeight: 110 }} value={c.instrucoes_ia} onChange={(e) => set({ instrucoes_ia: e.target.value })} placeholder="Ex.: atendemos Goiânia e região até 150 km. Visita técnica grátis. Nunca prometa conta zerada." /></Field>
            <span style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>Para ligar a IA: no construtor de fluxos, use o bloco Nicho com a integração "Energia solar" ligado ao bloco Assistente (com a chave da OpenAI). O módulo Vendedor IA precisa estar liberado para este cliente.</span>
          </div>
        </Card>
      </div>
      <div><Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar ajustes"}</Btn></div>
    </Page>
  );
}
