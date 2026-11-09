"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CATALOGO, IDS_PADRAO, brlOrc, type Implantacao, type ItemOrcamento } from "../../lib/orcamento";

type Orc = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string; usuarios_incluidos: number;
  mensalidade: number; configuracao: number; status: string; expira_em: string; visualizacoes: number;
  visualizado_em: string | null; aceito_em: string | null; implantacao: Implantacao | null; implantacao_em: string | null;
  itens: ItemOrcamento[]; created_at: string; link: string;
};
type Personalizado = { nome: string; sub: string; linhas: string };
type Rascunho = {
  cliente_nome: string; cliente_telefone: string; usuarios_incluidos: string; mensalidade: string; configuracao: string; validade_horas: string;
  selecionados: string[]; personalizados: Personalizado[];
};

const STATUS: Record<string, [string, string]> = {
  enviado: ["Enviado", "bg-blue-50 text-blue-700 ring-blue-200"],
  visualizado: ["Visualizado", "bg-indigo-50 text-indigo-700 ring-indigo-200"],
  aceito: ["Aceito", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  expirado: ["Expirado", "bg-slate-100 text-slate-600 ring-slate-200"],
  cancelado: ["Cancelado", "bg-slate-100 text-slate-500 ring-slate-200"],
  recusado: ["Recusado", "bg-red-50 text-red-700 ring-red-200"],
};
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const VAZIO: Rascunho = { cliente_nome: "", cliente_telefone: "", usuarios_incluidos: "10", mensalidade: "750", configuracao: "1000", validade_horas: "24", selecionados: IDS_PADRAO, personalizados: [] };

async function api(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
  const d = await r.json().catch(() => ({ success: false, error: "Resposta inválida" }));
  if (!r.ok || !d.success) throw new Error(d.error || "Erro");
  return d;
}

function whats(tel: string, nome: string, link: string) {
  const t = tel.replace(/\D/g, "");
  const n = t ? (t.length <= 11 ? `55${t}` : t) : "";
  const msg = `Olá ${nome.split(/\s+/)[0]}! Segue o seu orçamento da Wolf System. É só abrir, conferir e aceitar por aqui:\n\n${link}\n\n⚠️ Condição por tempo limitado.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", "."));

/** Converte o rascunho do formulário na lista de itens do orçamento. */
function montarItens(r: Rascunho): ItemOrcamento[] {
  const doCatalogo = CATALOGO.filter((c) => c.id === "plataforma" || r.selecionados.includes(c.id));
  const extras = r.personalizados
    .filter((p) => p.nome.trim())
    .map((p) => ({ nome: p.nome.trim(), sub: p.sub.trim() || "Item adicional", cor: "#475569", linhas: p.linhas.split("\n").map((l) => l.trim()).filter(Boolean) }));
  return [...doCatalogo, ...extras];
}

/** Abre um orçamento existente no formulário (itens antigos sem id são reconhecidos pelo nome). */
function rascunhoDe(o: Orc): Rascunho {
  const selecionados: string[] = [];
  const personalizados: Personalizado[] = [];
  (o.itens || []).forEach((it) => {
    const c = CATALOGO.find((x) => (it.id && x.id === it.id) || x.nome === it.nome);
    if (c) selecionados.push(c.id);
    else personalizados.push({ nome: it.nome, sub: it.sub, linhas: (it.linhas || []).join("\n") });
  });
  return {
    cliente_nome: o.cliente_nome, cliente_telefone: o.cliente_telefone || "", usuarios_incluidos: String(o.usuarios_incluidos),
    mensalidade: String(o.mensalidade).replace(".", ","), configuracao: String(o.configuracao).replace(".", ","), validade_horas: "24",
    selecionados, personalizados,
  };
}

function Editor({ inicial, editando, onSalvar, onCancelar }: { inicial: Rascunho; editando: boolean; onSalvar: (r: Rascunho) => Promise<void>; onCancelar?: () => void }) {
  const [r, setR] = useState<Rascunho>(inicial);
  const [salvando, setSalvando] = useState(false);
  const alternar = (id: string) => setR((s) => ({ ...s, selecionados: s.selecionados.includes(id) ? s.selecionados.filter((x) => x !== id) : [...s.selecionados, id] }));
  const itensCount = montarItens(r).length;

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true);
    try { await onSalvar(r); if (!editando) setR({ ...VAZIO, selecionados: r.selecionados }); } finally { setSalvando(false); }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Cliente</span><input className={inputCls} value={r.cliente_nome} onChange={(e) => setR({ ...r, cliente_nome: e.target.value })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">WhatsApp</span><input className={inputCls} value={r.cliente_telefone} onChange={(e) => setR({ ...r, cliente_telefone: e.target.value })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Usuários</span><input className={inputCls} value={r.usuarios_incluidos} onChange={(e) => setR({ ...r, usuarios_incluidos: e.target.value })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Mensalidade R$</span><input className={inputCls} value={r.mensalidade} onChange={(e) => setR({ ...r, mensalidade: e.target.value })} /></label>
        <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Configuração R$</span><input className={inputCls} value={r.configuracao} onChange={(e) => setR({ ...r, configuracao: e.target.value })} /></label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-bold text-slate-700">O que entra no orçamento</span>
          <span className="text-[12px] text-slate-500">{itensCount} itens</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGO.map((c) => {
            const fixo = c.id === "plataforma";
            const marcado = fixo || r.selecionados.includes(c.id);
            return (
              <button type="button" key={c.id} disabled={fixo} onClick={() => alternar(c.id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${marcado ? "border-emerald-400 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-slate-300"} ${fixo ? "cursor-default" : ""}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${marcado ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800">{c.nome}{fixo && <span className="ml-1 text-[10px] font-normal text-slate-400">(sempre incluso)</span>}</span>
                  <span className="block text-[11px]" style={{ color: c.cor }}>{c.sub === "usuários" ? `${r.usuarios_incluidos || "?"} usuários` : c.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-bold text-slate-700">Itens personalizados</span>
          <button type="button" onClick={() => setR((s) => ({ ...s, personalizados: [...s.personalizados, { nome: "", sub: "", linhas: "" }] }))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">+ Adicionar item</button>
        </div>
        {r.personalizados.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[12px] text-slate-400">Ex.: treinamento da equipe, número extra de WhatsApp, integração específica.</div>}
        <div className="space-y-2">
          {r.personalizados.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1.6fr_auto]">
              <input className={inputCls} placeholder="Nome do item" value={p.nome} onChange={(e) => setR((s) => ({ ...s, personalizados: s.personalizados.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)) }))} />
              <input className={inputCls} placeholder="Subtítulo (opcional)" value={p.sub} onChange={(e) => setR((s) => ({ ...s, personalizados: s.personalizados.map((x, k) => (k === i ? { ...x, sub: e.target.value } : x)) }))} />
              <textarea className={inputCls} rows={2} placeholder="Detalhes, um por linha" value={p.linhas} onChange={(e) => setR((s) => ({ ...s, personalizados: s.personalizados.map((x, k) => (k === i ? { ...x, linhas: e.target.value } : x)) }))} />
              <button type="button" onClick={() => setR((s) => ({ ...s, personalizados: s.personalizados.filter((_, k) => k !== i) }))} className="self-start rounded-lg px-2 py-2 text-[12px] text-red-500">Remover</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {!editando && <label className="w-40"><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Validade (horas)</span><input className={inputCls} value={r.validade_horas} onChange={(e) => setR({ ...r, validade_horas: e.target.value })} /></label>}
        <span className="pb-2 text-[12px] text-slate-500">Pagamento: PIX Abc Call e Serviços (Nubank)</span>
        <div className="ml-auto flex gap-2">
          {onCancelar && <button type="button" onClick={onCancelar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]">Cancelar</button>}
          <button disabled={salvando || !r.cliente_nome.trim()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Gerar link do orçamento"}</button>
        </div>
      </div>
    </form>
  );
}

export default function OrcamentosPage() {
  const [lista, setLista] = useState<Orc[]>([]);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState<string>("");
  const [editando, setEditando] = useState<string>("");
  const [chaveNovo, setChaveNovo] = useState(0);

  const carregar = useCallback(async () => {
    try { const d = await api("/api/orcamentos"); setLista(d.orcamentos); setErro(""); } catch (e: any) { setErro(e.message); }
  }, []);
  useEffect(() => {
    const primeiro = setTimeout(() => void carregar(), 0);
    const t = setInterval(() => void carregar(), 30_000);
    return () => { clearTimeout(primeiro); clearInterval(t); };
  }, [carregar]);

  const corpo = (r: Rascunho) => ({
    cliente_nome: r.cliente_nome, cliente_telefone: r.cliente_telefone, usuarios_incluidos: r.usuarios_incluidos,
    mensalidade: num(r.mensalidade), configuracao: num(r.configuracao), validade_horas: r.validade_horas, itens: montarItens(r),
  });
  async function criar(r: Rascunho) {
    try { await api("/api/orcamentos", { method: "POST", body: JSON.stringify(corpo(r)) }); setChaveNovo((k) => k + 1); await carregar(); } catch (e: any) { alert(e.message); throw e; }
  }
  async function salvarEdicao(id: string, r: Rascunho) {
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, acao: "editar", ...corpo(r) }) }); setEditando(""); await carregar(); } catch (e: any) { alert(e.message); throw e; }
  }
  async function acao(id: string, a: "cancelar" | "renovar") {
    if (a === "cancelar" && !confirm("Cancelar este orçamento? O link deixa de funcionar.")) return;
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, acao: a }) }); await carregar(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 text-slate-800">
      <div>
        <div className="text-[20px] font-extrabold">💼 Orçamentos</div>
        <div className="text-[13px] text-slate-500">Monte o orçamento, envie o link, o cliente aceita, vê os dados de pagamento e manda os dados de implantação.</div>
      </div>
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-[15px] font-bold">Novo orçamento</div>
        <Editor key={chaveNovo} inicial={VAZIO} editando={false} onSalvar={criar} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {lista.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Nenhum orçamento ainda.</div>}
        <div className="divide-y divide-slate-100">
          {lista.map((o) => {
            const [rot, cls] = STATUS[o.status] || STATUS.enviado;
            const imp = o.implantacao;
            const podeEditar = ["enviado", "visualizado", "expirado", "cancelado"].includes(o.status);
            return (
              <div key={o.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2"><b>{o.cliente_nome}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cls}`}>{rot}</span>{o.implantacao_em && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Dados recebidos</span>}{imp?.pagamento_realizado && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Diz que pagou</span>}</div>
                    <div className="text-[12px] text-slate-500">{o.numero} · {o.usuarios_incluidos} usuários · {brlOrc(o.configuracao)} agora + {brlOrc(o.mensalidade)}/mês · criado {new Date(o.created_at).toLocaleString("pt-BR")}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(o.itens || []).map((it) => <span key={it.nome} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{it.nome.replace("Módulo ", "")}</span>)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {o.visualizacoes ? `Aberto ${o.visualizacoes}x` : "Ainda não aberto"}
                      {o.aceito_em ? ` · aceito em ${new Date(o.aceito_em).toLocaleString("pt-BR")}` : ` · válido até ${new Date(o.expira_em).toLocaleString("pt-BR")}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[12px]">
                    <button onClick={() => navigator.clipboard.writeText(o.link)} className="rounded-lg border border-slate-200 px-2.5 py-1.5">Copiar link</button>
                    <a href={whats(o.cliente_telefone, o.cliente_nome, o.link)} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-emerald-700">WhatsApp</a>
                    <a href={o.link} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2.5 py-1.5">Abrir</a>
                    {podeEditar && <button onClick={() => setEditando(editando === o.id ? "" : o.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold">{editando === o.id ? "Fechar edição" : "Editar"}</button>}
                    {o.status !== "aceito" && <button onClick={() => acao(o.id, "renovar")} className="rounded-lg border border-slate-200 px-2.5 py-1.5">Renovar 24h</button>}
                    {(o.status === "enviado" || o.status === "visualizado") && <button onClick={() => acao(o.id, "cancelar")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-600">Cancelar</button>}
                    {imp && <button onClick={() => setAberto(aberto === o.id ? "" : o.id)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 font-semibold text-white">{aberto === o.id ? "Fechar dados" : "Ver dados"}</button>}
                  </div>
                </div>
                {editando === o.id && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                    <div className="mb-3 text-[13px] font-bold text-emerald-800">Editando {o.numero} — o link continua o mesmo</div>
                    <Editor inicial={rascunhoDe(o)} editando onSalvar={(r) => salvarEdicao(o.id, r)} onCancelar={() => setEditando("")} />
                  </div>
                )}
                {imp && aberto === o.id && (
                  <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-4 text-[13px] lg:grid-cols-[1fr_1.6fr]">
                    <div className="space-y-1">
                      <div className="mb-1 text-[12px] font-bold uppercase text-slate-500">Empresa</div>
                      {[["Razão social", imp.razao_social], ["CNPJ/CPF", imp.cnpj], ["Responsável", imp.responsavel], ["E-mail", imp.email], ["Telefone", imp.telefone], ["WhatsApp do atendimento", imp.whatsapp_atendimento], ["Pagamento", imp.pagamento_realizado ? "Cliente informou que pagou" : "Ainda não informado"]].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><b className="text-right">{v || "-"}</b></div>
                      ))}
                      {imp.observacoes && <div className="pt-2 text-slate-600"><span className="text-slate-500">Observações:</span> {imp.observacoes}</div>}
                    </div>
                    <div>
                      <div className="mb-1 text-[12px] font-bold uppercase text-slate-500">Usuários ({imp.usuarios.length})</div>
                      <table className="w-full text-left text-[12px]">
                        <thead className="text-slate-500"><tr><th className="py-1">Nome</th><th>E-mail</th><th>Telefone</th><th>Perfil</th></tr></thead>
                        <tbody>{imp.usuarios.map((u) => <tr key={u.email} className="border-t border-slate-200"><td className="py-1.5 font-semibold">{u.nome}</td><td>{u.email}</td><td>{u.telefone || "-"}</td><td>{u.perfil}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
