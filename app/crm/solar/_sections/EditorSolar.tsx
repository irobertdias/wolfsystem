"use client";
import { useMemo, useState } from "react";
import { Card, Field, Row, Btn, Banner, inputSm } from "../../financeiro/_sections/_ui";
import Icone from "../../../components/a2/Icone";
import { supabase } from "../../../lib/supabase";
import {
  calcularSolar, linhasSolar, LIGACOES, TELHADOS, UFS, ETAPAS_SOLAR, etapaSolar, brl, brl0, kwpTxt, anosTxt, n,
  type EntradaSolar, type Ligacao,
} from "../../../lib/solar";
import {
  sol, salvarPropostaSolar, gerarLinkSolar, mudarEtapaSolar, excluirPropostaSolar, linkProposta, expirada, dataHoraBR,
  type PropostaSolar, type ClienteSolar,
} from "../_dados";

// Formulário da proposta solar com o cálculo ao vivo (usado em Propostas e no Simulador).

const txt = (v: any) => (v === undefined || v === null || v === 0 ? "" : String(v).replace(".", ","));

export default function EditorSolar({ dados, proposta, preenchido, modo = "proposta", onSalvo, onFechar }: {
  dados: any; proposta?: PropostaSolar | null; preenchido?: { cliente?: Partial<ClienteSolar>; entrada?: EntradaSolar };
  modo?: "proposta" | "simulador"; onSalvo?: (id: number) => void; onFechar?: () => void;
}) {
  const { wsId, cfg, carregar } = dados;
  const d = proposta ? sol(proposta) : {};
  const e0: EntradaSolar = { ...(d.entrada || {}), ...(preenchido?.entrada || {}) };
  const [cli, setCli] = useState<ClienteSolar>({
    nome: proposta?.nome || preenchido?.cliente?.nome || "", telefone1: proposta?.telefone1 || preenchido?.cliente?.telefone1 || "",
    email: proposta?.email || "", cpf: proposta?.cpf || "", endereco: proposta?.endereco || "",
    cidade: proposta?.cidade || preenchido?.cliente?.cidade || "", estado: proposta?.estado || preenchido?.cliente?.estado || e0.uf || cfg.uf_padrao,
  });
  const [f, setF] = useState({
    consumo: txt(e0.consumo_kwh), conta: txt(e0.conta_valor), tarifa: txt(e0.tarifa || cfg.tarifa_padrao), ligacao: (e0.ligacao || "bi") as Ligacao,
    telhado: e0.telhado || "ceramico", aumento: txt(e0.aumento_pct), paineis: txt(e0.paineis), desconto: txt(e0.desconto), preco_manual: txt(e0.preco_manual),
    inversor_tipo: (e0.inversor_tipo || cfg.inversor_tipo || "string") as "string" | "micro",
    linha: e0.linha && (cfg.linhas || []).some((l: any) => l.id === e0.linha) ? e0.linha : "",
  });
  const linhas = linhasSolar(cfg);
  const [obs, setObs] = useState(d.observacoes || "");
  const [minutos, setMinutos] = useState(String(cfg.validade_minutos || 10080));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "warn"; texto: string } | null>(null);
  const setC = (k: keyof ClienteSolar, v: string) => setCli((x) => ({ ...x, [k]: v }));
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const entrada: EntradaSolar = {
    consumo_kwh: n(f.consumo) || undefined, conta_valor: n(f.conta) || undefined, tarifa: n(f.tarifa) || undefined,
    uf: cli.estado, cidade: cli.cidade, ligacao: f.ligacao, telhado: f.telhado, aumento_pct: n(f.aumento) || undefined,
    paineis: n(f.paineis) || undefined, desconto: n(f.desconto) || undefined, preco_manual: n(f.preco_manual) || undefined,
    inversor_tipo: f.inversor_tipo,
    linha: f.linha || undefined,
  };
  const r = useMemo(() => calcularSolar(entrada, cfg), [JSON.stringify(entrada), cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const temConsumo = r.consumo_kwh > 0;

  const salvar = async (etapa?: string) => {
    if (!temConsumo) { setMsg({ tipo: "warn", texto: "Informe o consumo médio (kWh) ou o valor da conta de luz." }); return null; }
    if (!cli.nome.trim()) { setMsg({ tipo: "warn", texto: "Informe o nome do cliente." }); return null; }
    setSalvando(true); setMsg(null);
    try {
      const id = await salvarPropostaSolar(wsId, cfg, cli, entrada, proposta, { observacoes: obs }, etapa);
      await carregar();
      setMsg({ tipo: "ok", texto: "Proposta salva." });
      onSalvo?.(id);
      return id;
    } catch (e: any) { setMsg({ tipo: "warn", texto: "Erro ao salvar: " + (e?.message || e) }); return null; }
    finally { setSalvando(false); }
  };

  const gerarLink = async () => {
    if (!proposta) { const id = await salvar(); if (!id) return; setMsg({ tipo: "ok", texto: "Proposta salva. Abra de novo para gerar o link." }); return; }
    setSalvando(true);
    try {
      await salvarPropostaSolar(wsId, cfg, cli, entrada, proposta, { observacoes: obs });
      const { data } = await supabase.from("proposta").select("*").eq("workspace_id", wsId).eq("id", proposta.id).single();
      const token = await gerarLinkSolar(wsId, (data as any) || proposta, cfg, n(minutos));
      await carregar();
      const url = linkProposta(token);
      try { await navigator.clipboard.writeText(url); } catch {}
      setMsg({ tipo: "ok", texto: `Link pronto e copiado: ${url}` });
    } catch (e: any) { setMsg({ tipo: "warn", texto: "Erro ao gerar o link: " + (e?.message || e) }); }
    finally { setSalvando(false); }
  };

  const link = linkProposta(d.token);
  const zap = () => {
    const fone = String(cli.telefone1 || "").replace(/\D/g, "");
    const texto = `Olá, ${cli.nome.split(" ")[0] || ""}! ☀️ Preparei a proposta do seu sistema de energia solar de ${kwpTxt(r.kwp)}.\n\nEconomia estimada: ${brl(r.economia_mes)}/mês.\nInvestimento: ${brl(r.preco)}.\n\nVeja todos os detalhes e aprove por aqui:\n${link}`;
    window.open(`https://wa.me/${fone.length >= 10 ? (fone.startsWith("55") ? fone : "55" + fone) : ""}?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const etapaAtual = proposta?.status_venda || "LEAD";
  const trocarEtapa = async (nova: string) => {
    if (!proposta || nova === etapaAtual) return;
    const { error } = await mudarEtapaSolar(wsId, proposta, nova);
    if (error) setMsg({ tipo: "warn", texto: error.message }); else { await carregar(); setMsg({ tipo: "ok", texto: `Etapa: ${etapaSolar(nova).label}` }); }
  };
  const excluir = async () => {
    if (!proposta || !confirm(`Excluir a proposta de ${proposta.nome}? Não dá para desfazer.`)) return;
    await excluirPropostaSolar(wsId, proposta.id); await carregar(); onFechar?.();
  };

  const Linha = ({ k, v, forte }: { k: string; v: string; forte?: boolean }) => (
    <div style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: "1px solid #F1F5F4", fontSize: 13.5 }}><span style={{ color: "#64748B" }}>{k}</span><b style={{ marginLeft: "auto", textAlign: "right", color: forte ? "var(--w-700)" : "#0F172A" }}>{v}</b></div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card titulo="Cliente">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row>
              <Field label="Nome" flex="2 1 200px"><input style={inputSm} value={cli.nome} onChange={(e) => setC("nome", e.target.value)} placeholder="Nome do cliente" /></Field>
              <Field label="WhatsApp" flex="1 1 150px"><input style={inputSm} value={cli.telefone1} onChange={(e) => setC("telefone1", e.target.value)} placeholder="(62) 99999-9999" /></Field>
            </Row>
            {modo === "proposta" && <Row>
              <Field label="E-mail" flex="1 1 180px"><input style={inputSm} value={cli.email} onChange={(e) => setC("email", e.target.value)} /></Field>
              <Field label="CPF/CNPJ" flex="1 1 150px"><input style={inputSm} value={cli.cpf} onChange={(e) => setC("cpf", e.target.value)} /></Field>
            </Row>}
            {modo === "proposta" && <Field label="Endereço da instalação"><input style={inputSm} value={cli.endereco} onChange={(e) => setC("endereco", e.target.value)} placeholder="Rua, número, bairro" /></Field>}
            <Row>
              <Field label="Cidade" flex="2 1 160px"><input style={inputSm} value={cli.cidade} onChange={(e) => setC("cidade", e.target.value)} /></Field>
              <Field label="UF (define o sol da região)" flex="1 1 110px"><select style={inputSm} value={cli.estado} onChange={(e) => setC("estado", e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Field>
            </Row>
          </div>
        </Card>

        <Card titulo="Conta de luz e telhado">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row>
              <Field label="Consumo médio (kWh/mês)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" value={f.consumo} onChange={(e) => set("consumo", e.target.value)} placeholder="ex.: 450" /></Field>
              <Field label="ou valor da conta (R$)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" value={f.conta} onChange={(e) => set("conta", e.target.value)} placeholder="ex.: 480,00" /></Field>
            </Row>
            <Row>
              <Field label="Tarifa (R$/kWh com impostos)" flex="1 1 150px"><input style={inputSm} inputMode="decimal" value={f.tarifa} onChange={(e) => set("tarifa", e.target.value)} /></Field>
              <Field label="Ligação" flex="1 1 150px"><select style={inputSm} value={f.ligacao} onChange={(e) => set("ligacao", e.target.value)}>{LIGACOES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></Field>
            </Row>
            <Row>
              <Field label="Telhado" flex="2 1 200px"><select style={inputSm} value={f.telhado} onChange={(e) => set("telhado", e.target.value)}>{TELHADOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
              <Field label="Aumento de consumo (%)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={f.aumento} onChange={(e) => set("aumento", e.target.value)} placeholder="0" /></Field>
            </Row>
            {linhas.length > 1 && <Field label="Marca (placa e inversor)"><select style={inputSm} value={f.linha} onChange={(e) => set("linha", e.target.value)}>
              {linhas.map((l) => <option key={l.id || "principal"} value={l.id}>{l.nome}{l.painel_w ? ` · ${l.painel_w} W` : ""}</option>)}
            </select></Field>}
            <Field label="Inversor"><select style={inputSm} value={f.inversor_tipo} onChange={(e) => set("inversor_tipo", e.target.value)}>
              <option value="string">Inversor central (string)</option>
              <option value="micro">Microinversor{cfg.inversor_tipo !== "micro" && n(cfg.adicional_micro_pct) ? ` (+${n(cfg.adicional_micro_pct)}%)` : ""}</option>
            </select></Field>
            <Row>
              <Field label="Painéis (ajuste manual)" flex="1 1 120px"><input style={inputSm} inputMode="numeric" value={f.paineis} onChange={(e) => set("paineis", e.target.value)} placeholder={`auto (${r.paineis})`} /></Field>
              <Field label="Desconto (R$)" flex="1 1 120px"><input style={inputSm} inputMode="decimal" value={f.desconto} onChange={(e) => set("desconto", e.target.value)} placeholder="0,00" /></Field>
              <Field label="Preço final (opcional)" flex="1 1 130px"><input style={inputSm} inputMode="decimal" value={f.preco_manual} onChange={(e) => set("preco_manual", e.target.value)} placeholder="pela tabela" /></Field>
            </Row>
            {modo === "proposta" && <Field label="Observações na proposta"><textarea style={{ ...inputSm, minHeight: 70, resize: "vertical" }} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: inclui limpeza no primeiro ano" /></Field>}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="hero-nicho" style={{ borderRadius: 22, padding: "20px 22px", color: "#fff", background: "linear-gradient(130deg, var(--w-500), var(--w-700))", boxShadow: "0 22px 44px -24px rgba(15,23,42,.55)", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>{temConsumo ? "Economia estimada" : "Informe o consumo ou a conta"}</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em" }}>{brl(r.economia_mes)}<span style={{ fontSize: 15, fontWeight: 700 }}>/mês</span></span>
          {temConsumo && <span style={{ fontSize: 13, color: "rgba(255,255,255,.9)" }}>Conta de {brl(r.conta_antes)} para cerca de {brl(r.conta_depois)} · {brl0(r.economia_25)} em 25 anos</span>}
        </div>

        <Card titulo="Sistema">
          <Linha k="Potência" v={kwpTxt(r.kwp)} forte />
          <Linha k="Módulos" v={`${r.paineis} × ${r.painel_w} W ${r.equip?.painel_marca || cfg.painel_marca}`} />
          <Linha k="Inversor" v={r.inversor} />
          <Linha k="Geração estimada" v={`${r.geracao_kwh} kWh/mês (${r.cobertura_pct}% do consumo compensável)`} />
          <Linha k="Área no telhado" v={`${String(r.area_m2).replace(".", ",")} m²`} />
          <Linha k={`Sol da região (${r.uf})`} v={`${String(r.hsp).replace(".", ",")} h/dia`} />
        </Card>

        <Card titulo="Valores">
          <Linha k={`${cfg.modo_preco === "kits" ? "Tabela de kits" : "Tabela"} (${brl(r.preco_tabela / Math.max(1, r.kwp * 1000))}/Wp)`} v={brl(r.preco_tabela)} />
          {r.preco_de ? <Linha k={`Preço "de"${r.campanha ? ` · ${r.campanha}` : ""}`} v={brl(r.preco_de)} /> : null}
          {r.adicional > 0 && <Linha k="Adicional do telhado" v={brl(r.adicional)} />}
          {r.desconto > 0 && <Linha k="Desconto" v={`- ${brl(r.desconto)}`} />}
          <Linha k="Investimento à vista" v={brl(r.preco)} forte />
          <Linha k="Retorno do investimento" v={anosTxt(r.payback_anos)} />
          {(r.cartoes?.length ? r.cartoes : []).map((c) => <Linha key={`c${c.meses}`} k={`Cartão ${c.meses}x${c.acrescimo_pct ? ` (+${String(c.acrescimo_pct).replace(".", ",")}%)` : ""}`} v={brl(c.valor)} />)}
          {!r.cartoes?.length && r.cartao && <Linha k={`Cartão em até ${r.cartao.meses}x`} v={brl(r.cartao.valor)} />}
          {r.cartao_entrada && <Linha k={`Entrada ${brl0(r.cartao_entrada.entrada)} + ${r.cartao_entrada.meses}x sem juros`} v={brl(r.cartao_entrada.valor)} />}
          {r.parcelas.map((p) => <Linha key={p.meses} k={`Financiamento ${p.meses}x${r.entrada ? " (com entrada)" : ""}`} v={brl(p.valor)} />)}
        </Card>

        {msg && <Banner tipo={msg.tipo}>{msg.texto}</Banner>}

        <Card titulo={modo === "simulador" ? "Gostou da simulação?" : "Ações"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {proposta && <Field label="Etapa"><select style={inputSm} value={etapaAtual} onChange={(e) => trocarEtapa(e.target.value)}>{ETAPAS_SOLAR.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></Field>}
            <Row>
              <Btn onClick={() => salvar(modo === "simulador" ? "LEAD" : undefined)} disabled={salvando}>{salvando ? "Salvando…" : proposta ? "Salvar alterações" : modo === "simulador" ? "Salvar como proposta" : "Criar proposta"}</Btn>
              {onFechar && <Btn variante="ghost" onClick={onFechar}>Voltar</Btn>}
            </Row>
            {proposta && (
              <>
                <div style={{ borderTop: "1px solid #F1F5F4", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>Link para o cliente ver e aprovar</span>
                  {d.token && <span style={{ fontSize: 12.5, color: expirada(d) ? "#B91C1C" : "#64748B", wordBreak: "break-all" }}>{link}<br />{expirada(d) ? "Expirado em " : "Válido até "}{dataHoraBR(d.validade_ate)}{d.visualizado_em ? ` · visto em ${dataHoraBR(d.visualizado_em)}` : " · ainda não aberto"}</span>}
                  <Row>
                    <Field label="Validade (minutos)" flex="0 1 150px"><input style={inputSm} inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></Field>
                  </Row>
                  <Row>
                    <Btn onClick={gerarLink} disabled={salvando}>{d.token ? "Renovar e copiar link" : "Gerar link"}</Btn>
                    {d.token && <Btn variante="ghost" onClick={zap}>Enviar no WhatsApp</Btn>}
                    {d.token && <Btn variante="ghost" onClick={() => window.open(link, "_blank")}>Abrir</Btn>}
                    {d.token && <Btn variante="ghost" onClick={() => window.open(`${link}/pdf`, "_blank")}>Proposta em PDF</Btn>}
                  </Row>
                </div>
                {d.aceite && <Banner tipo="ok">Aceita pelo cliente em {dataHoraBR(d.aceite.em)}{d.aceite.pagamento ? ` · ${d.aceite.pagamento}` : ""}{d.aceite.prazo ? ` em ${d.aceite.prazo}x` : ""}.</Banner>}
                {d.recusa && <Banner tipo="warn">Recusada em {dataHoraBR(d.recusa.em)}: {d.recusa.motivo}</Banner>}
                {d.visita && <Banner tipo="info">Visita técnica pedida{d.visita.data ? ` para ${d.visita.data}` : ""}{d.visita.endereco ? ` · ${d.visita.endereco}` : ""}{d.visita.obs ? ` · ${d.visita.obs}` : ""}</Banner>}
                <button onClick={excluir} style={{ alignSelf: "flex-start", border: 0, background: "none", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: 0 }}><Icone nome="lixeira" tamanho={14} /> Excluir proposta</button>
              </>
            )}
          </div>
        </Card>

        {proposta && (d.historico || []).length > 0 && (
          <Card titulo="Histórico">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...(d.historico || [])].reverse().slice(0, 20).map((h, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "#334155", display: "flex", gap: 8 }}>
                  <span style={{ color: "#94A3B8", whiteSpace: "nowrap" }}>{dataHoraBR(h.em)}</span>
                  <span>{h.nota}{h.por ? <span style={{ color: "#94A3B8" }}> · {h.por}</span> : null}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5 }}>Estimativa com {n(cfg.geracao_kwh_kwp) > 0 ? `${String(cfg.geracao_kwh_kwp).replace(".", ",")} kWh por kWp ao mês` : `a irradiação média do estado e desempenho de ${Math.round(cfg.eficiencia * 100)}%`}{cfg.descontar_minimo === false ? "" : " e o custo mínimo da ligação"}. A economia desconta {cfg.fio_b_pct}% de Fio B. Confirme na visita técnica.</div>
      </div>
    </div>
  );
}
