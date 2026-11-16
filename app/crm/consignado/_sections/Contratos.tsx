"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Btn, Banner, Card, Field, Row, Table, Vazio, Pill, inputSm, tdStyle, Modal } from "../../financeiro/_sections/_ui";
import {
  ETAPAS, PRODUTOS, CONVENIOS, etapa, produto, brl, pctBR, dataBR, num, cpfFmt, hoje, cons, valorLiberado,
  valorPresente, comissaoPct, comissaoValor, salvarContrato, nomeUsuario, baixarCSV, type Contrato, type DadosConsignado,
} from "../_dados";

type Form = {
  nome: string; cpf: string; telefone1: string; email: string; cidade: string; estado: string;
  operadora: string; plano: string; status_venda: string; vendedor: string;
  d: Record<keyof DadosConsignado, any>;
};
const VAZIO: Form = { nome: "", cpf: "", telefone1: "", email: "", cidade: "", estado: "", operadora: "", plano: "novo", status_venda: "SIMULACAO", vendedor: "", d: {} as any };
const f2 = (v: any) => (v === undefined || v === null || v === "" ? "" : String(v).replace(".", ","));

export default function Contratos({ dados, alvo, gestor }: any) {
  const { wsId, contratos, cfg, usuarios, carregar } = dados as { wsId: string; contratos: Contrato[]; cfg: any; usuarios: any[]; carregar: () => void };
  const [busca, setBusca] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroBanco, setFiltroBanco] = useState("");
  const [editando, setEditando] = useState<Contrato | null>(null);
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const abrir = (c?: Contrato | null, pre?: Record<string, any>) => {
    setErro("");
    if (c) {
      const d = cons(c);
      setEditando(c);
      setF({ nome: c.nome || "", cpf: cpfFmt(c.cpf), telefone1: c.telefone1 || "", email: c.email || "", cidade: c.cidade || "", estado: c.estado || "",
        operadora: c.operadora || "", plano: c.plano || "novo", status_venda: c.status_venda || "SIMULACAO", vendedor: c.vendedor || "",
        d: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "number" ? f2(v) : v])) as any });
    } else {
      setEditando(null);
      setF({ ...VAZIO, ...(pre?.form || {}), d: { convenio: "INSS", taxa_mensal: f2(cfg.taxa_teto), ...(pre?.d || {}) } });
    }
    setAberto(true);
  };

  useEffect(() => {
    if (!alvo?.t) return;
    if (alvo.novo) abrir(null, alvo.preenchido);
    else if (alvo.contratoId) { const c = contratos.find((x) => x.id === alvo.contratoId); if (c) abrir(c); }
    else if (alvo.cpf) setBusca(alvo.cpf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.t, contratos.length]);

  const lista = useMemo(() => contratos.filter((c) => {
    const q = busca.trim().toLowerCase(), digitos = busca.replace(/\D/g, "");
    const casa = !q || `${c.nome} ${c.operadora || ""} ${cons(c).proposta_banco || ""} ${cons(c).beneficio || ""}`.toLowerCase().includes(q) || (digitos.length >= 3 && String(c.cpf || "").includes(digitos));
    return casa;
  }).filter((c) => (!filtroEtapa || (c.status_venda || "SIMULACAO") === filtroEtapa)
    && (!filtroBanco || (c.operadora || "") === filtroBanco)), [contratos, busca, filtroEtapa, filtroBanco]);
  const bancosUsados = [...new Set(contratos.map((c) => c.operadora).filter(Boolean))] as string[];

  const setD = (k: string, v: any) => setF((x) => ({ ...x, d: { ...x.d, [k]: v } }));
  const pv = valorPresente(num(f.d.parcela), num(f.d.taxa_mensal) / 100, Math.round(num(f.d.prazo)));
  const portabilidade = ["portabilidade", "port_refin", "refinanciamento"].includes(f.plano);
  const calcularValores = () => {
    if (!pv) { setErro("Informe parcela, prazo e taxa para calcular."); return; }
    const bruto = Math.round(pv * 100) / 100;
    const liberado = Math.max(0, Math.round((bruto - (portabilidade ? num(f.d.saldo_quitado) : 0)) * 100) / 100);
    setF((x) => ({ ...x, d: { ...x.d, valor_bruto: f2(bruto), valor_liberado: f2(liberado) } }));
    setErro("");
  };

  const previa: Contrato = { id: 0, created_at: "", nome: f.nome, operadora: f.operadora, plano: f.plano, valor_plano: num(f.d.valor_liberado), dados_customizados: { consignado: { ...f.d, valor_bruto: num(f.d.valor_bruto), valor_liberado: num(f.d.valor_liberado), comissao_pct: f.d.comissao_pct === "" || f.d.comissao_pct === undefined ? null : num(f.d.comissao_pct) } } };

  async function salvar() {
    if (!f.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    const cpf = f.cpf.replace(/\D/g, "");
    if (cpf && cpf.length !== 11) { setErro("CPF precisa ter 11 números."); return; }
    setSalvando(true); setErro("");
    const numeros = ["renda", "margem_disponivel", "parcela", "prazo", "taxa_mensal", "valor_bruto", "valor_liberado", "saldo_quitado"];
    const d: DadosConsignado = { ...cons(editando || ({} as any)), ...f.d };
    for (const k of numeros) (d as any)[k] = f.d[k as keyof DadosConsignado] === "" || f.d[k as keyof DadosConsignado] === undefined ? undefined : num(f.d[k as keyof DadosConsignado]);
    d.comissao_pct = f.d.comissao_pct === "" || f.d.comissao_pct === undefined || f.d.comissao_pct === null ? null : num(f.d.comissao_pct);
    const { data: { user } } = await supabase.auth.getUser();
    const mudouEtapa = !editando || (editando.status_venda || "SIMULACAO") !== f.status_venda;
    if (mudouEtapa) {
      d.historico = [...(d.historico || []), { em: new Date().toISOString(), etapa: f.status_venda, nota: editando ? `Etapa: ${etapa(f.status_venda).label}` : "Contrato cadastrado", por: user?.email || "" }];
      if (f.status_venda === "PAGO" && !d.data_pagamento) d.data_pagamento = hoje();
      if (f.status_venda === "DIGITADA" && !d.data_digitacao) d.data_digitacao = hoje();
    }
    const campos: Partial<Contrato> = { nome: f.nome.trim(), cpf: cpf || null, telefone1: f.telefone1.replace(/\D/g, "") || null, email: f.email.trim() || null, cidade: f.cidade.trim() || null, estado: f.estado.trim().toUpperCase() || null, operadora: f.operadora.trim() || null, plano: f.plano, status_venda: f.status_venda, vendedor: f.vendedor || editando?.vendedor || null };
    const { error } = await salvarContrato(wsId, campos, d, editando?.id, editando?.dados_customizados);
    setSalvando(false);
    if (error) { setErro("Erro ao salvar: " + error.message); return; }
    setAberto(false); carregar();
  }

  async function excluir() {
    if (!editando || !confirm(`Excluir de vez o contrato de ${editando.nome}? Não dá para desfazer.`)) return;
    const { error } = await supabase.from("proposta").delete().eq("workspace_id", wsId).eq("id", editando.id);
    if (error) { setErro("Erro ao excluir: " + error.message); return; }
    setAberto(false); carregar();
  }

  const exportar = () => baixarCSV(`contratos-consignado-${hoje()}.csv`, [
    ["Cliente", "CPF", "Convênio", "Benefício/matrícula", "Banco", "Produto", "Etapa", "Parcela", "Prazo", "Taxa a.m.", "Valor do contrato", "Valor liberado", "Comissão %", "Comissão R$", "Nº proposta banco", "Digitação", "Pagamento", "Vendedor"],
    ...lista.map((c) => { const d = cons(c); return [c.nome, cpfFmt(c.cpf), d.convenio || "", d.beneficio || "", c.operadora || "", produto(c.plano), etapa(c.status_venda).label, num(d.parcela).toFixed(2).replace(".", ","), d.prazo || "", f2(d.taxa_mensal), num(d.valor_bruto).toFixed(2).replace(".", ","), valorLiberado(c).toFixed(2).replace(".", ","), f2(comissaoPct(c, cfg)), comissaoValor(c, cfg).toFixed(2).replace(".", ","), d.proposta_banco || "", dataBR(d.data_digitacao), dataBR(d.data_pagamento), nomeUsuario(usuarios, c.vendedor)]; }),
  ]);

  const inp = (k: keyof Form, ph?: string, extra?: any) => <input style={inputSm} value={(f as any)[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />;
  const inpD = (k: string, ph?: string, extra?: any) => <input style={inputSm} value={f.d[k as keyof DadosConsignado] ?? ""} placeholder={ph} onChange={(e) => setD(k, e.target.value)} {...extra} />;
  const titulo = (t: string) => <div style={{ fontSize: 12, fontWeight: 800, color: "var(--w-700)", letterSpacing: ".04em", textTransform: "uppercase", marginTop: 4 }}>{t}</div>;

  return (
    <Page>
      <PageHeader titulo="Contratos" subtitulo={`${lista.length} de ${contratos.length} contrato(s)`}
        acao={<div style={{ display: "flex", gap: 8 }}><Btn variante="ghost" onClick={exportar}>Exportar CSV</Btn><Btn onClick={() => abrir(null)}>＋ Novo contrato</Btn></div>} />
      <Row>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, CPF, banco, benefício ou nº da proposta" style={{ ...inputSm, flex: "2 1 280px", width: "auto" }} />
        <select value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)} style={{ ...inputSm, flex: "1 1 180px", width: "auto" }}>
          <option value="">Todas as etapas</option>{ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
        <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={{ ...inputSm, flex: "1 1 160px", width: "auto" }}>
          <option value="">Todos os bancos</option>{bancosUsados.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Row>

      <Table cols={[{ label: "Cliente" }, { label: "Banco / produto" }, { label: "Parcela" }, { label: "Liberado", align: "right" }, { label: "Comissão", align: "right" }, { label: "Etapa" }]}
        empty={lista.length === 0 ? <Vazio icone="📄" titulo={contratos.length ? "Nada encontrado" : "Nenhum contrato ainda"} sub={contratos.length ? "Mude a busca ou os filtros." : "Cadastre o primeiro contrato ou comece pelo simulador de margem."} acao={!contratos.length ? <Btn onClick={() => abrir(null)}>＋ Novo contrato</Btn> : undefined} /> : undefined}>
        {lista.map((c) => {
          const d = cons(c), e = etapa(c.status_venda);
          return (
            <tr key={c.id} onClick={() => abrir(c)} style={{ cursor: "pointer" }}>
              <td style={tdStyle}><b>{c.nome}</b><div style={{ fontSize: 12, color: "#94A3B8" }}>{cpfFmt(c.cpf) || "sem CPF"} · {d.convenio || "—"}{d.beneficio ? ` · ${d.beneficio}` : ""}</div></td>
              <td style={tdStyle}>{c.operadora || "—"}<div style={{ fontSize: 12, color: "#94A3B8" }}>{produto(c.plano)}{d.proposta_banco ? ` · nº ${d.proposta_banco}` : ""}</div></td>
              <td style={tdStyle}>{d.parcela ? `${brl(num(d.parcela))} × ${d.prazo || "?"}` : "—"}<div style={{ fontSize: 12, color: "#94A3B8" }}>{d.taxa_mensal ? `${pctBR(num(d.taxa_mensal))} a.m.` : ""}</div></td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>{brl(valorLiberado(c))}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{brl(comissaoValor(c, cfg))}<div style={{ fontSize: 12, color: "#94A3B8" }}>{pctBR(comissaoPct(c, cfg))}</div></td>
              <td style={tdStyle}><Pill texto={e.label} cor={e.cor} /></td>
            </tr>
          );
        })}
      </Table>

      {aberto && (
        <Modal titulo={editando ? `Contrato · ${editando.nome}` : "Novo contrato"} onClose={() => setAberto(false)} maxWidth={860}
          footer={<>
            {editando && gestor && <Btn variante="danger" onClick={excluir}>Excluir</Btn>}
            <Btn variante="ghost" onClick={() => setAberto(false)}>Cancelar</Btn>
            <Btn onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar contrato"}</Btn>
          </>}>
          {erro && <Banner tipo="warn">{erro}</Banner>}
          {titulo("Cliente")}
          <Row>
            <Field label="Nome completo" flex="2 1 260px">{inp("nome")}</Field>
            <Field label="CPF" flex="1 1 150px">{inp("cpf", "000.000.000-00", { onChange: (e: any) => setF({ ...f, cpf: cpfFmt(e.target.value.replace(/\D/g, "").slice(0, 11)) }) })}</Field>
            <Field label="WhatsApp" flex="1 1 150px">{inp("telefone1", "(00) 00000-0000")}</Field>
          </Row>
          <Row>
            <Field label="E-mail" flex="2 1 220px">{inp("email")}</Field>
            <Field label="Cidade" flex="1 1 150px">{inp("cidade")}</Field>
            <Field label="UF" flex="0 1 80px">{inp("estado", "UF", { maxLength: 2 })}</Field>
          </Row>
          {titulo("Convênio e margem")}
          <Row>
            <Field label="Convênio" flex="1 1 200px"><select style={inputSm} value={f.d.convenio || ""} onChange={(e) => setD("convenio", e.target.value)}><option value="">—</option>{CONVENIOS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Nº do benefício / matrícula" flex="1 1 180px">{inpD("beneficio")}</Field>
            <Field label="Espécie / órgão" flex="1 1 160px">{inpD("especie", "Ex.: 41 aposentadoria por idade")}</Field>
          </Row>
          <Row>
            <Field label="Renda bruta (R$)" flex="1 1 150px">{inpD("renda", "0,00", { inputMode: "decimal" })}</Field>
            <Field label="Margem disponível (R$)" flex="1 1 170px">{inpD("margem_disponivel", "0,00", { inputMode: "decimal" })}</Field>
          </Row>
          {titulo("Operação")}
          <Row>
            <Field label="Banco" flex="1 1 200px">
              <input style={inputSm} list="bancos-consignado" value={f.operadora} onChange={(e) => setF({ ...f, operadora: e.target.value })} />
              <datalist id="bancos-consignado">{cfg.bancos.map((b: any) => <option key={b.nome} value={b.nome} />)}</datalist>
            </Field>
            <Field label="Produto" flex="1 1 220px"><select style={inputSm} value={f.plano} onChange={(e) => setF({ ...f, plano: e.target.value })}>{PRODUTOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Field>
            <Field label="Etapa" flex="1 1 200px"><select style={inputSm} value={f.status_venda} onChange={(e) => setF({ ...f, status_venda: e.target.value })}>{ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></Field>
          </Row>
          {portabilidade && (
            <Row>
              <Field label="Banco de origem" flex="1 1 200px">{inpD("banco_origem")}</Field>
              <Field label="Saldo quitado (R$)" flex="1 1 160px">{inpD("saldo_quitado", "0,00", { inputMode: "decimal" })}</Field>
            </Row>
          )}
          <Row>
            <Field label="Parcela (R$)" flex="1 1 130px">{inpD("parcela", "0,00", { inputMode: "decimal" })}</Field>
            <Field label="Prazo (meses)" flex="1 1 110px">{inpD("prazo", String(cfg.prazo_maximo), { inputMode: "numeric" })}</Field>
            <Field label="Taxa (% a.m.)" flex="1 1 110px">{inpD("taxa_mensal", "1,85", { inputMode: "decimal" })}</Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}><Btn variante="ghost" onClick={calcularValores}>Calcular valores</Btn></div>
          </Row>
          {pv > 0 && <div style={{ fontSize: 12.5, color: "#64748B" }}>Pela parcela, prazo e taxa, o contrato vale <b>{brl(pv)}</b>{portabilidade && num(f.d.saldo_quitado) ? <> e libera <b>{brl(Math.max(0, pv - num(f.d.saldo_quitado)))}</b> depois de quitar o saldo</> : null}.</div>}
          <Row>
            <Field label="Valor do contrato (R$)" flex="1 1 160px">{inpD("valor_bruto", "0,00", { inputMode: "decimal" })}</Field>
            <Field label="Valor liberado ao cliente (R$)" flex="1 1 180px">{inpD("valor_liberado", "0,00", { inputMode: "decimal" })}</Field>
            <Field label="Nº da proposta no banco / ADE" flex="1 1 180px">{inpD("proposta_banco")}</Field>
          </Row>
          <Row>
            <Field label="Data da digitação" flex="1 1 150px"><input type="date" style={inputSm} value={f.d.data_digitacao || ""} onChange={(e) => setD("data_digitacao", e.target.value)} /></Field>
            <Field label="Data do pagamento" flex="1 1 150px"><input type="date" style={inputSm} value={f.d.data_pagamento || ""} onChange={(e) => setD("data_pagamento", e.target.value)} /></Field>
            <Field label="Vendedor" flex="1 1 200px"><select style={inputSm} value={f.vendedor} onChange={(e) => setF({ ...f, vendedor: e.target.value })}><option value="">(quem cadastrar)</option>{usuarios.map((u: any) => <option key={u.email} value={u.email}>{u.nome}</option>)}</select></Field>
          </Row>
          {titulo("Comissão")}
          <Row>
            <Field label="Comissão (%)" flex="1 1 140px">{inpD("comissao_pct", `${pctBR(comissaoPct({ ...previa, dados_customizados: { consignado: { ...previa.dados_customizados.consignado, comissao_pct: null } } }, cfg))} (regra do banco)`, { inputMode: "decimal" })}</Field>
            <div style={{ flex: "2 1 260px", display: "flex", alignItems: "flex-end", fontSize: 13.5, color: "#334155", paddingBottom: 10 }}>
              Comissão prevista: <b style={{ marginLeft: 6, color: "var(--w-700)" }}>{brl(comissaoValor(previa, cfg))}</b>
              <span style={{ color: "#94A3B8", marginLeft: 6 }}>sobre o valor {cfg.base_comissao === "liberado" ? "liberado" : "do contrato"}</span>
            </div>
          </Row>
          <Field label="Observações"><textarea style={{ ...inputSm, minHeight: 70, resize: "vertical" }} value={f.d.observacoes || ""} onChange={(e) => setD("observacoes", e.target.value)} /></Field>
          {editando && (cons(editando).historico || []).length > 0 && (
            <Card titulo="Histórico" pad={14}>
              {[...(cons(editando).historico || [])].reverse().map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "6px 0", borderTop: i ? "1px solid #F1F5F4" : 0 }}>
                  <span style={{ color: "#94A3B8", minWidth: 120 }}>{new Date(h.em).toLocaleString("pt-BR")}</span>
                  <span style={{ color: "#334155" }}>{h.nota}{h.por ? <span style={{ color: "#94A3B8" }}> · {nomeUsuario(usuarios, h.por)}</span> : null}</span>
                </div>
              ))}
            </Card>
          )}
        </Modal>
      )}
    </Page>
  );
}
