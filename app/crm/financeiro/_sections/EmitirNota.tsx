"use client";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { supabase } from "../../../lib/supabase";
import { Page, PageHeader, Stats, Stat, Table, Card, Banner, Modal, Btn, Field, Row, Vazio, brl, hoje, mesAtual, dataBR, C, inputStyle, tdStyle } from "./_ui";

// 🧾 Emitir NF-e — registro de notas emitidas (+ slot do provedor)
export default function EmitirNota() {
  const { wsId } = useWorkspace();
  const [lista, setLista] = useState<any[]>([]);
  const [contatos, setContatos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [provedor, setProvedor] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<any>({ destinatario_nome: "", numero: "", valor_total: "", emissao: hoje(), gerarReceber: true });

  const carregar = useCallback(async () => {
    if (!wsId) return;
    setCarregando(true);
    const [n, c, cfg] = await Promise.all([
      supabase.from("fin_notas").select("*").eq("workspace_id", wsId).eq("tipo", "nfe").eq("direcao", "emitida").order("emissao", { ascending: false }),
      supabase.from("fin_contatos").select("*").eq("workspace_id", wsId).eq("ativo", true).order("nome"),
      supabase.from("fin_config").select("config").eq("workspace_id", wsId).maybeSingle(),
    ]);
    setLista((n.data as any[]) || []); setContatos((c.data as any[]) || []);
    setProvedor((cfg.data?.config?.nfe_provedor) || "");
    setCarregando(false);
  }, [wsId]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrir() { setForm({ destinatario_nome: "", numero: "", valor_total: "", emissao: hoje(), gerarReceber: true }); setModal(true); }
  async function salvar() {
    if (!wsId || !form.destinatario_nome.trim()) return;
    setSalvando(true);
    const valor = parseFloat(String(form.valor_total).replace(",", ".")) || 0;
    let lancamento_id: string | null = null;
    if (form.gerarReceber) {
      const { data } = await supabase.from("fin_lancamentos").insert({ workspace_id: wsId, tipo: "receita", descricao: `NF-e ${form.numero || ""} ${form.destinatario_nome}`.trim(), valor, vencimento: form.emissao, status: "pendente" }).select("id").maybeSingle();
      lancamento_id = data?.id || null;
    }
    await supabase.from("fin_notas").insert({ workspace_id: wsId, tipo: "nfe", direcao: "emitida", status: "emitida", destinatario_nome: form.destinatario_nome.trim(), numero: form.numero.trim() || null, valor_total: valor, emissao: form.emissao, lancamento_id });
    setSalvando(false); setModal(false); carregar();
  }
  async function remover(n: any) {
    if (!wsId || !confirm("Excluir esta nota?")) return;
    await supabase.from("fin_notas").delete().eq("id", n.id).eq("workspace_id", wsId);
    carregar();
  }

  const mes = mesAtual();
  const totalEmitido = lista.reduce((s, n) => s + (n.valor_total || 0), 0);
  const noMes = lista.filter((n) => (n.emissao || "").slice(0, 7) === mes);
  const totalMes = noMes.reduce((s, n) => s + (n.valor_total || 0), 0);

  return (
    <Page>
      <PageHeader icone="🧾" titulo="Emitir NF-e" subtitulo="Notas fiscais emitidas e geração de contas a receber"
        acao={<Btn onClick={abrir}>+ Nova nota</Btn>} />

      <Banner tipo={provedor ? "ok" : "warn"}>
        {provedor
          ? <>Provedor configurado: <b>{provedor}</b>. A emissão ao-vivo na SEFAZ entra quando ligarmos a integração.</>
          : <>Sem provedor de NF-e. Aqui você <b>registra</b> as notas e gera o "a receber"; a <b>emissão automática na SEFAZ</b> precisa de um provedor (PlugNotas, Focus, eNotas) — configure em <b>Configurações</b>.</>}
      </Banner>

      <Stats>
        <Stat label="Notas emitidas" valor={lista.length} cor={C.amber} icone="🧾" />
        <Stat label="Total emitido" valor={brl(totalEmitido)} cor={C.green} icone="💰" />
        <Stat label="Emitido no mês" valor={brl(totalMes)} cor={C.blue} icone="📅" sub={`${noMes.length} nota(s)`} />
      </Stats>

      <Card titulo="Notas emitidas" pad={0} cor={C.amber}>
        <Table cols={[{ label: "Destinatário" }, { label: "NF", width: 90 }, { label: "Emissão", width: 120 }, { label: "Valor", align: "right" }, { label: "", align: "right", width: 60 }]}
          empty={carregando ? <span style={{ color: "#9ca3af" }}>Carregando…</span> : lista.length === 0 ? <Vazio icone="🧾" titulo="Nenhuma nota emitida" sub="Registre uma nota emitida e, se quiser, gere a conta a receber automaticamente." acao={<Btn onClick={abrir}>+ Nova nota</Btn>} /> : null}>
          {lista.map((n) => (
            <tr key={n.id}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{n.destinatario_nome}</td>
              <td style={{ ...tdStyle, color: "#6b7280" }}>{n.numero || "—"}</td>
              <td style={{ ...tdStyle, color: "#6b7280" }}>{dataBR(n.emissao)}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, color: C.green }}>{brl(n.valor_total)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}><button onClick={() => remover(n)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>🗑️</button></td>
            </tr>
          ))}
        </Table>
      </Card>

      {modal && (
        <Modal titulo="Nova nota emitida" onClose={() => setModal(false)} maxWidth={480}
          footer={<><Btn variante="ghost" cor="#6b7280" onClick={() => setModal(false)}>Cancelar</Btn><Btn onClick={salvar} disabled={salvando || !form.destinatario_nome.trim()}>{salvando ? "Salvando…" : "Registrar"}</Btn></>}>
          <Field label="Destinatário *">
            <input list="fin-clientes-emit" value={form.destinatario_nome} onChange={(e) => setForm({ ...form, destinatario_nome: e.target.value })} style={inputStyle} />
            <datalist id="fin-clientes-emit">{contatos.map((c) => <option key={c.id} value={c.nome} />)}</datalist>
          </Field>
          <Row>
            <Field label="Nº" flex="0 0 110px"><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} style={inputStyle} /></Field>
            <Field label="Valor" flex="0 0 140px"><input value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} style={inputStyle} placeholder="0,00" /></Field>
            <Field label="Emissão" flex="1 1 130px"><input type="date" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} style={inputStyle} /></Field>
          </Row>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#374151" }}>
            <input type="checkbox" checked={form.gerarReceber} onChange={(e) => setForm({ ...form, gerarReceber: e.target.checked })} /> Gerar conta a receber automaticamente
          </label>
        </Modal>
      )}
    </Page>
  );
}