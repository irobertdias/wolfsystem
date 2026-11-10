"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Table, Vazio, Btn, Modal, Field, Row, Pill, IconBtn, Card, Banner, inputSm, tdStyle, C } from "../../financeiro/_sections/_ui";
import {
  ETAPAS, etapa, rev, calcular, honorariosPrevistos, salvarContrato, mudarEtapa, gerarParcelas,
  brl, pctBR, dataBR, hoje, num, anual, type Contrato, type DadosRevisional,
} from "../_dados";

const VAZIO = {
  nome: "", cpf: "", telefone1: "", email: "", cidade: "", estado: "",
  operadora: "", plano: "veiculo", status_venda: "NOVO",
  numero_contrato: "", data_contrato: "", valor_financiado: "", prazo: "", parcela: "", taxa_mensal: "", parcelas_pagas: "", taxa_media: "",
  processo_numero: "", processo_vara: "", processo_data: "",
  honorarios_entrada: "", honorarios_exito: "", observacoes: "",
};
type Form = typeof VAZIO;

const fmt = (v: any) => (v === undefined || v === null || v === 0 ? "" : String(v).replace(".", ","));

export function useUsuarioEmail() {
  const [email, setEmail] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || "")); }, []);
  return email;
}

export default function Contratos({ dados, ir, alvo }: any) {
  const { wsId, contratos, cfg, carregando, carregar } = dados;
  const usuario = useUsuarioEmail();
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [fichaId, setFichaId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (alvo?.novo) abrirNovo();
    else if (alvo?.contratoId) setFichaId(alvo.contratoId);
    if (alvo?.etapa) setFiltroEtapa(alvo.etapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.t]);

  const ficha = contratos.find((c: Contrato) => c.id === fichaId) || null;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contratos.filter((c: Contrato) => {
      if (filtroEtapa && (c.status_venda || "NOVO") !== filtroEtapa) return false;
      if (!q) return true;
      return [c.nome, c.cpf, c.operadora, c.telefone1, rev(c).numero_contrato].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [contratos, busca, filtroEtapa]);

  const set = (k: keyof Form, v: string) => setForm((p) => (p ? { ...p, [k]: v } : p));

  function abrirNovo() {
    setEditando(null);
    setForm({ ...VAZIO, honorarios_entrada: fmt(cfg.honorarios_entrada), honorarios_exito: fmt(cfg.honorarios_exito) });
  }

  function abrirEdicao(c: Contrato) {
    const d = rev(c);
    setEditando(c);
    setForm({
      nome: c.nome || "", cpf: c.cpf || "", telefone1: c.telefone1 || "", email: c.email || "", cidade: c.cidade || "", estado: c.estado || "",
      operadora: c.operadora || "", plano: c.plano || "veiculo", status_venda: c.status_venda || "NOVO",
      numero_contrato: d.numero_contrato || "", data_contrato: d.data_contrato || "",
      valor_financiado: fmt(d.valor_financiado), prazo: fmt(d.prazo), parcela: fmt(d.parcela), taxa_mensal: fmt(d.taxa_mensal),
      parcelas_pagas: fmt(d.parcelas_pagas), taxa_media: fmt(d.taxa_media),
      processo_numero: d.processo_numero || "", processo_vara: d.processo_vara || "", processo_data: d.processo_data || "",
      honorarios_entrada: fmt(d.honorarios_entrada ?? cfg.honorarios_entrada), honorarios_exito: fmt(d.honorarios_exito ?? cfg.honorarios_exito),
      observacoes: d.observacoes || "",
    });
  }

  const dadosDoForm = (f: Form, base: DadosRevisional): DadosRevisional => ({
    ...base,
    numero_contrato: f.numero_contrato.trim(), data_contrato: f.data_contrato,
    valor_financiado: num(f.valor_financiado), prazo: Math.round(num(f.prazo)), parcela: num(f.parcela), taxa_mensal: num(f.taxa_mensal),
    parcelas_pagas: Math.round(num(f.parcelas_pagas)), taxa_media: f.taxa_media.trim() ? num(f.taxa_media) : null,
    processo_numero: f.processo_numero.trim(), processo_vara: f.processo_vara.trim(), processo_data: f.processo_data,
    honorarios_entrada: num(f.honorarios_entrada), honorarios_exito: num(f.honorarios_exito),
    observacoes: f.observacoes,
  });

  async function salvar() {
    if (!form || !wsId) return;
    if (!form.nome.trim()) { setMsg("Informe o nome do cliente."); return; }
    setSalvando(true); setMsg("");
    const base = editando ? rev(editando) : {};
    const d = dadosDoForm(form, base);
    if (!editando) d.historico = [{ em: new Date().toISOString(), etapa: form.status_venda, nota: "Contrato cadastrado", por: usuario }];
    else if ((editando.status_venda || "NOVO") !== form.status_venda) d.historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: form.status_venda, nota: `Etapa: ${etapa(form.status_venda).label}`, por: usuario }];
    const campos: Partial<Contrato> = {
      nome: form.nome.trim().toUpperCase(), cpf: form.cpf.trim(), telefone1: form.telefone1.trim(), email: form.email.trim(),
      cidade: form.cidade.trim(), estado: form.estado.trim().toUpperCase(), operadora: form.operadora.trim(), plano: form.plano,
      status_venda: form.status_venda, ...(editando ? {} : { vendedor: usuario }),
    };
    const { error } = await salvarContrato(wsId, campos, d, editando?.id, editando?.dados_customizados);
    setSalvando(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return; }
    setForm(null); setEditando(null);
    carregar();
  }

  async function excluir(c: Contrato) {
    if (!confirm(`Excluir o contrato de ${c.nome}? Essa ação não pode ser desfeita.`)) return;
    await supabase.from("proposta").delete().eq("workspace_id", wsId).eq("id", c.id);
    setFichaId(null);
    carregar();
  }

  // prévia do cálculo dentro do formulário
  const previa = form ? calcular(dadosDoForm(form, {}), form.plano, cfg) : null;

  const totBeneficio = lista.reduce((s: number, c: Contrato) => s + calcular(rev(c), c.plano, cfg).beneficio, 0);
  const totFinanciado = lista.reduce((s: number, c: Contrato) => s + num(rev(c).valor_financiado), 0);
  const nomeMod = (k?: string | null) => cfg.modalidades.find((m: any) => m.key === k);

  return (
    <Page>
      <PageHeader icone="📑" titulo="Contratos dos clientes" subtitulo="Cadastro, cálculo e acompanhamento de cada contrato revisado" acao={<Btn onClick={abrirNovo}>＋ Novo contrato</Btn>} />

      <Stats>
        <Stat label="Contratos" valor={lista.length} icone="📑" cor={C.blue} sub={filtroEtapa ? etapa(filtroEtapa).label : "todos"} />
        <Stat label="Valor financiado" valor={brl(totFinanciado)} icone="🏦" cor={C.slate} />
        <Stat label="Benefício estimado" valor={brl(totBeneficio)} icone="💎" cor={C.green} />
      </Stats>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, CPF, banco ou nº do contrato" style={{ ...inputSm, flex: "1 1 280px", width: "auto" }} />
        <select value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)} style={{ ...inputSm, width: 220 }}>
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.icone} {e.label}</option>)}
        </select>
      </div>

      <Table
        cols={[{ label: "Cliente" }, { label: "Banco / modalidade" }, { label: "Financiado", align: "right" }, { label: "Taxa contratada × média", align: "center" }, { label: "Benefício", align: "right" }, { label: "Etapa" }, { label: "", align: "right" }]}
        empty={carregando ? <span style={{ color: "#94A3B8" }}>Carregando…</span> : lista.length === 0 ? (
          <Vazio icone="📑" titulo={contratos.length ? "Nenhum contrato encontrado" : "Nenhum contrato cadastrado"} sub={contratos.length ? "Mude a busca ou a etapa." : "Cadastre o contrato do cliente para calcular a revisão de juros."} acao={!contratos.length && <Btn onClick={abrirNovo}>＋ Novo contrato</Btn>} />
        ) : undefined}
      >
        {lista.map((c: Contrato) => {
          const d = rev(c), calc = calcular(d, c.plano, cfg), e = etapa(c.status_venda), m = nomeMod(c.plano);
          return (
            <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setFichaId(c.id)}>
              <td style={tdStyle}><div style={{ fontWeight: 700 }}>{c.nome}</div><div style={{ fontSize: 12, color: "#94A3B8" }}>{c.cpf || "CPF não informado"}{d.numero_contrato ? ` · nº ${d.numero_contrato}` : ""}</div></td>
              <td style={tdStyle}><div>{c.operadora || "—"}</div><div style={{ fontSize: 12, color: "#94A3B8" }}>{m ? `${m.icone} ${m.label}` : "—"}</div></td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{d.valor_financiado ? brl(d.valor_financiado) : "—"}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>
                {calc.valido ? (
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <b style={{ color: calc.abusiva ? C.red : "#0F172A" }}>{pctBR(calc.taxaContratada)}</b>
                    <span style={{ color: "#94A3B8" }}>×</span>
                    <span>{pctBR(calc.taxaMedia)}</span>
                    {calc.abusiva && <Pill texto={`${calc.vezesMedia.toFixed(1)}×`} cor={C.red} />}
                  </span>
                ) : <span style={{ color: "#94A3B8", fontSize: 12 }}>dados incompletos</span>}
              </td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: calc.beneficio ? C.green : "#94A3B8" }}>{calc.valido ? brl(calc.beneficio) : "—"}</td>
              <td style={tdStyle}><Pill texto={`${e.icone} ${e.label}`} cor={e.cor} /></td>
              <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }} onClick={(ev) => ev.stopPropagation()}>
                <IconBtn icone="🧮" title="Abrir no cálculo" onClick={() => ir("calculo", { contratoId: c.id })} />
                <IconBtn icone="✏️" title="Editar" onClick={() => abrirEdicao(c)} />
                <IconBtn icone="🗑️" title="Excluir" onClick={() => excluir(c)} />
              </td>
            </tr>
          );
        })}
      </Table>

      {form && (
        <Modal titulo={editando ? `Editar contrato — ${editando.nome}` : "Novo contrato"} onClose={() => { setForm(null); setEditando(null); }} maxWidth={860}
          footer={<><Btn variante="ghost" onClick={() => { setForm(null); setEditando(null); }}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar contrato"}</Btn></>}>
          {msg && <Banner tipo="warn">{msg}</Banner>}

          <Secao titulo="Cliente">
            <Row><Field label="Nome completo" flex="2 1 260px"><input style={inputSm} value={form.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
              <Field label="CPF / CNPJ" flex="1 1 160px"><input style={inputSm} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} /></Field></Row>
            <Row><Field label="WhatsApp / telefone" flex="1 1 160px"><input style={inputSm} value={form.telefone1} onChange={(e) => set("telefone1", e.target.value)} /></Field>
              <Field label="E-mail" flex="1 1 200px"><input style={inputSm} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Cidade" flex="1 1 140px"><input style={inputSm} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></Field>
              <Field label="UF" flex="0 0 70px"><input style={inputSm} maxLength={2} value={form.estado} onChange={(e) => set("estado", e.target.value)} /></Field></Row>
          </Secao>

          <Secao titulo="Contrato">
            <Row><Field label="Banco / financeira" flex="1 1 200px"><input style={inputSm} value={form.operadora} onChange={(e) => set("operadora", e.target.value)} placeholder="Ex.: Banco Pan" /></Field>
              <Field label="Modalidade" flex="1 1 200px"><select style={inputSm} value={form.plano} onChange={(e) => set("plano", e.target.value)}>{cfg.modalidades.map((m: any) => <option key={m.key} value={m.key}>{m.icone} {m.label}</option>)}</select></Field>
              <Field label="Nº do contrato" flex="1 1 150px"><input style={inputSm} value={form.numero_contrato} onChange={(e) => set("numero_contrato", e.target.value)} /></Field>
              <Field label="Data do contrato" flex="1 1 140px"><input type="date" style={inputSm} value={form.data_contrato} onChange={(e) => set("data_contrato", e.target.value)} /></Field></Row>
            <Row><Field label="Valor financiado (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={form.valor_financiado} onChange={(e) => set("valor_financiado", e.target.value)} /></Field>
              <Field label="Prazo (meses)" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} /></Field>
              <Field label="Valor da parcela (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={form.parcela} onChange={(e) => set("parcela", e.target.value)} /></Field>
              <Field label="Taxa contratada (% a.m.)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={form.taxa_mensal} onChange={(e) => set("taxa_mensal", e.target.value)} placeholder="calcula pela parcela" /></Field>
              <Field label="Parcelas pagas" flex="1 1 100px"><input style={inputSm} inputMode="numeric" value={form.parcelas_pagas} onChange={(e) => set("parcelas_pagas", e.target.value)} /></Field></Row>
            <Row><Field label="Taxa média BACEN (% a.m.)" flex="0 1 220px"><input style={inputSm} inputMode="decimal" value={form.taxa_media} onChange={(e) => set("taxa_media", e.target.value)} placeholder={`padrão da modalidade: ${pctBR(cfg.modalidades.find((m: any) => m.key === form.plano)?.taxaMedia || 0)}`} /></Field></Row>
            {previa && <PreviaCalculo calc={previa} />}
          </Secao>

          <Secao titulo="Processo e andamento">
            <Row><Field label="Etapa" flex="1 1 200px"><select style={inputSm} value={form.status_venda} onChange={(e) => set("status_venda", e.target.value)}>{ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.icone} {e.label}</option>)}</select></Field>
              <Field label="Nº do processo" flex="1 1 200px"><input style={inputSm} value={form.processo_numero} onChange={(e) => set("processo_numero", e.target.value)} /></Field>
              <Field label="Vara / comarca" flex="1 1 180px"><input style={inputSm} value={form.processo_vara} onChange={(e) => set("processo_vara", e.target.value)} /></Field>
              <Field label="Ajuizada em" flex="1 1 140px"><input type="date" style={inputSm} value={form.processo_data} onChange={(e) => set("processo_data", e.target.value)} /></Field></Row>
          </Secao>

          <Secao titulo="Honorários">
            <Row><Field label="Entrada (R$)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={form.honorarios_entrada} onChange={(e) => set("honorarios_entrada", e.target.value)} /></Field>
              <Field label="Êxito (% do benefício)" flex="1 1 140px"><input style={inputSm} inputMode="decimal" value={form.honorarios_exito} onChange={(e) => set("honorarios_exito", e.target.value)} /></Field></Row>
            <Field label="Observações"><textarea style={{ ...inputSm, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></Field>
          </Secao>
        </Modal>
      )}

      {ficha && !form && (
        <FichaContrato c={ficha} cfg={cfg} wsId={wsId} usuario={usuario} onClose={() => setFichaId(null)} onEditar={() => abrirEdicao(ficha)} onExcluir={() => excluir(ficha)} onCalculo={() => ir("calculo", { contratoId: ficha.id })} recarregar={carregar} />
      )}
    </Page>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #F1F5F4", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "#fcfcfd" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</div>
      {children}
    </div>
  );
}

export function PreviaCalculo({ calc }: { calc: ReturnType<typeof calcular> }) {
  if (!calc.valido) return <div style={{ fontSize: 12, color: "#94A3B8" }}>Informe valor financiado, prazo e parcela (ou taxa) para ver o cálculo.</div>;
  const item = (l: string, v: string, cor = "#0F172A") => (
    <div style={{ flex: "1 1 130px", background: "#fff", border: "1px solid #E6ECEA", borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>{l}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: cor }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {item("Taxa contratada", `${pctBR(calc.taxaContratada)} a.m.`, calc.abusiva ? C.red : "#0F172A")}
      {item("Taxa média", `${pctBR(calc.taxaMedia)} a.m.`)}
      {item("Parcela revisada", brl(calc.parcelaRevisada), C.blue)}
      {item("Diferença / parcela", brl(calc.diferencaParcela), C.amber)}
      {item("Benefício", brl(calc.beneficio), C.green)}
    </div>
  );
}

function FichaContrato({ c, cfg, wsId, usuario, onClose, onEditar, onExcluir, onCalculo, recarregar }: any) {
  const d: DadosRevisional = rev(c);
  const calc = calcular(d, c.plano, cfg);
  const hon = honorariosPrevistos(d, calc, cfg);
  const e = etapa(c.status_venda);
  const [nota, setNota] = useState("");
  const [qtdParcelas, setQtdParcelas] = useState(String(cfg.honorarios_parcelas || 1));
  const [primeiro, setPrimeiro] = useState(hoje());
  const [ocupado, setOcupado] = useState(false);
  const parcelas = d.honorarios_parcelas || [];
  const m = cfg.modalidades.find((x: any) => x.key === c.plano);

  const salvarDados = async (novo: DadosRevisional, campos: any = {}) => {
    setOcupado(true);
    await salvarContrato(wsId, campos, novo, c.id, c.dados_customizados);
    setOcupado(false);
    recarregar();
  };

  const trocarEtapa = async (nova: string) => {
    setOcupado(true);
    await mudarEtapa(wsId, c, nova, `Etapa: ${etapa(nova).label}`, usuario);
    setOcupado(false);
    recarregar();
  };

  const anotar = async () => {
    if (!nota.trim()) return;
    await salvarDados({ ...d, historico: [...(d.historico || []), { em: new Date().toISOString(), nota: nota.trim(), por: usuario }] });
    setNota("");
  };

  const gerar = async () => {
    if (!hon.entrada) { alert("Informe o valor de entrada dos honorários no contrato (Editar)."); return; }
    if (parcelas.some((p) => p.pago_em) && !confirm("Já existem parcelas pagas. Gerar de novo substitui todas as parcelas. Continuar?")) return;
    await salvarDados({ ...d, honorarios_parcelas: gerarParcelas(hon.entrada, num(qtdParcelas), primeiro) });
  };

  const alternarPago = async (k: number) => {
    const novas = parcelas.map((p, i) => (i === k ? { ...p, pago_em: p.pago_em ? null : hoje() } : p));
    await salvarDados({ ...d, honorarios_parcelas: novas });
  };

  const info = (l: string, v: any) => (
    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" }}>{l}</div>
      <div style={{ fontSize: 13.5, color: "#0F172A", fontWeight: 600, overflowWrap: "anywhere" }}>{v || "—"}</div>
    </div>
  );

  return (
    <Modal titulo={c.nome} onClose={onClose} maxWidth={900}
      footer={<><Btn variante="danger" onClick={onExcluir}>Excluir</Btn><Btn variante="ghost" onClick={onCalculo}>Cálculo detalhado</Btn><Btn onClick={onEditar}>Editar</Btn></>}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Pill texto={`${e.icone} ${e.label}`} cor={e.cor} />
        {calc.abusiva && <Pill texto={`Taxa ${calc.vezesMedia.toFixed(1)}× a média`} cor={C.red} />}
        <span style={{ flex: 1 }} />
        <select value={c.status_venda || "NOVO"} disabled={ocupado} onChange={(ev) => trocarEtapa(ev.target.value)} style={{ ...inputSm, width: 230 }}>
          {ETAPAS.map((x) => <option key={x.key} value={x.key}>Mover para: {x.icone} {x.label}</option>)}
        </select>
      </div>

      <Secao titulo="Cliente e contrato">
        <Row>{info("CPF / CNPJ", c.cpf)}{info("Telefone", c.telefone1)}{info("E-mail", c.email)}{info("Cidade", [c.cidade, c.estado].filter(Boolean).join(" / "))}</Row>
        <Row>{info("Banco", c.operadora)}{info("Modalidade", m ? `${m.icone} ${m.label}` : "")}{info("Nº do contrato", d.numero_contrato)}{info("Data do contrato", dataBR(d.data_contrato))}</Row>
        <Row>{info("Valor financiado", d.valor_financiado ? brl(d.valor_financiado) : "")}{info("Prazo", d.prazo ? `${d.prazo} meses` : "")}{info("Parcela", d.parcela ? brl(d.parcela) : "")}{info("Parcelas pagas", d.parcelas_pagas ? `${d.parcelas_pagas} de ${d.prazo || "?"}` : "")}</Row>
      </Secao>

      <Secao titulo="Cálculo revisional">
        <PreviaCalculo calc={calc} />
        {calc.valido && (
          <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.6 }}>
            Taxa contratada de <b>{pctBR(calc.taxaContratada)} a.m.</b> ({pctBR(anual(calc.taxaContratada))} a.a.) contra média de mercado de <b>{pctBR(calc.taxaMedia)} a.m.</b> ({pctBR(anual(calc.taxaMedia))} a.a.).
            Pago a maior até agora: <b style={{ color: C.green }}>{brl(calc.pagoAMaior)}</b>{cfg.repeticao_dobro ? " (em dobro)" : ""} · economia nas parcelas restantes: <b style={{ color: C.green }}>{brl(calc.economiaFutura)}</b>.
          </div>
        )}
      </Secao>

      {(d.processo_numero || d.processo_vara || d.processo_data) && (
        <Secao titulo="Processo">
          <Row>{info("Nº do processo", d.processo_numero)}{info("Vara / comarca", d.processo_vara)}{info("Ajuizada em", dataBR(d.processo_data))}</Row>
        </Secao>
      )}

      <Secao titulo="Honorários">
        <Row>{info("Entrada", brl(hon.entrada))}{info(`Êxito (${pctBR(hon.exitoPct, 0)})`, brl(hon.exito))}{info("Total previsto", brl(hon.total))}{info("Recebido", brl(parcelas.filter((p) => p.pago_em).reduce((s, p) => s + p.valor, 0)))}</Row>
        {parcelas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parcelas.map((p, k) => {
              const atraso = !p.pago_em && p.vencimento < hoje();
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fff", border: "1px solid #E6ECEA", borderRadius: 10 }}>
                  <span style={{ fontWeight: 700, color: "#334155", width: 80 }}>Parcela {p.n}</span>
                  <span style={{ color: "#64748B", fontSize: 13, flex: 1 }}>vence {dataBR(p.vencimento)}{p.pago_em ? ` · paga em ${dataBR(p.pago_em)}` : ""}</span>
                  <b>{brl(p.valor)}</b>
                  <Pill texto={p.pago_em ? "Paga" : atraso ? "Atrasada" : "Em aberto"} cor={p.pago_em ? C.green : atraso ? C.red : C.amber} />
                  <Btn variante="ghost" disabled={ocupado} onClick={() => alternarPago(k)}>{p.pago_em ? "Desfazer" : "Dar baixa"}</Btn>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Parcelas da entrada" flex="0 0 140px"><input style={inputSm} inputMode="numeric" value={qtdParcelas} onChange={(ev) => setQtdParcelas(ev.target.value)} /></Field>
          <Field label="1º vencimento" flex="0 0 170px"><input type="date" style={inputSm} value={primeiro} onChange={(ev) => setPrimeiro(ev.target.value)} /></Field>
          <Btn variante="ghost" disabled={ocupado} onClick={gerar}>{parcelas.length ? "Gerar de novo" : "Gerar parcelas"}</Btn>
        </div>
      </Secao>

      <Secao titulo="Histórico">
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inputSm, flex: 1, width: "auto" }} placeholder="Anotar andamento, contato com o cliente, prazo…" value={nota} onChange={(ev) => setNota(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") anotar(); }} />
          <Btn onClick={anotar} disabled={ocupado || !nota.trim()}>Anotar</Btn>
        </div>
        {(d.historico || []).length === 0 ? <div style={{ fontSize: 12.5, color: "#94A3B8" }}>Sem anotações.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...(d.historico || [])].reverse().map((h, k) => (
              <div key={k} style={{ display: "flex", gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: h.etapa ? etapa(h.etapa).cor : "#cbd5e1", marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ color: "#0F172A" }}>{h.nota}</div>
                  <div style={{ color: "#94A3B8", fontSize: 11.5 }}>{new Date(h.em).toLocaleString("pt-BR")}{h.por ? ` · ${h.por}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
      {d.observacoes && <Card titulo="Observações" pad={16}><div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{d.observacoes}</div></Card>}
    </Modal>
  );
}
