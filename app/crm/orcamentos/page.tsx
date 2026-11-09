"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { brlOrc, type Implantacao } from "../../lib/orcamento";

type Orc = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string; usuarios_incluidos: number;
  mensalidade: number; configuracao: number; status: string; expira_em: string; visualizacoes: number;
  visualizado_em: string | null; aceito_em: string | null; implantacao: Implantacao | null; implantacao_em: string | null;
  created_at: string; link: string;
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
  const msg = `Olá ${nome.split(/\s+/)[0]}! Segue o seu orçamento da Wolf System. É só abrir, conferir e aceitar por aqui:\n\n${link}\n\n⚠️ Condição válida por 24 horas.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

export default function OrcamentosPage() {
  const [lista, setLista] = useState<Orc[]>([]);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState({ cliente_nome: "", cliente_telefone: "", usuarios_incluidos: "10", mensalidade: "750", configuracao: "1000", validade_horas: "24" });
  const [criando, setCriando] = useState(false);
  const [aberto, setAberto] = useState<string>("");

  const carregar = useCallback(async () => {
    try { const d = await api("/api/orcamentos"); setLista(d.orcamentos); setErro(""); } catch (e: any) { setErro(e.message); }
  }, []);
  useEffect(() => { void carregar(); const t = setInterval(() => void carregar(), 30_000); return () => clearInterval(t); }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault(); setCriando(true);
    try {
      await api("/api/orcamentos", { method: "POST", body: JSON.stringify({ ...novo, mensalidade: Number(novo.mensalidade.replace(",", ".")), configuracao: Number(novo.configuracao.replace(",", ".")) }) });
      setNovo((n) => ({ ...n, cliente_nome: "", cliente_telefone: "" }));
      await carregar();
    } catch (e: any) { alert(e.message); } finally { setCriando(false); }
  }
  async function acao(id: string, a: "cancelar" | "renovar") {
    if (a === "cancelar" && !confirm("Cancelar este orçamento? O link deixa de funcionar.")) return;
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, acao: a }) }); await carregar(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 text-slate-800">
      <div>
        <div className="text-[20px] font-extrabold">💼 Orçamentos</div>
        <div className="text-[13px] text-slate-500">Envie o link, o cliente aceita, vê os dados de pagamento e manda os dados de implantação.</div>
      </div>
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <form onSubmit={criar} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-[14px] font-bold">Novo orçamento</div>
        <div className="grid gap-3 sm:grid-cols-6">
          <label className="sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Cliente</span><input className={inputCls} value={novo.cliente_nome} onChange={(e) => setNovo({ ...novo, cliente_nome: e.target.value })} /></label>
          <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">WhatsApp</span><input className={inputCls} value={novo.cliente_telefone} onChange={(e) => setNovo({ ...novo, cliente_telefone: e.target.value })} /></label>
          <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Usuários</span><input className={inputCls} value={novo.usuarios_incluidos} onChange={(e) => setNovo({ ...novo, usuarios_incluidos: e.target.value })} /></label>
          <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Mensalidade R$</span><input className={inputCls} value={novo.mensalidade} onChange={(e) => setNovo({ ...novo, mensalidade: e.target.value })} /></label>
          <label><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Configuração R$</span><input className={inputCls} value={novo.configuracao} onChange={(e) => setNovo({ ...novo, configuracao: e.target.value })} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="w-40"><span className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">Validade (horas)</span><input className={inputCls} value={novo.validade_horas} onChange={(e) => setNovo({ ...novo, validade_horas: e.target.value })} /></label>
          <span className="pb-2 text-[12px] text-slate-500">Itens: Plataforma, CRM, Chatbot e Revisional · pagamento PIX Abc Call e Serviços (Nubank)</span>
          <button disabled={criando || !novo.cliente_nome.trim()} className="ml-auto rounded-xl bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">{criando ? "Criando…" : "Gerar link do orçamento"}</button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {lista.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Nenhum orçamento ainda.</div>}
        <div className="divide-y divide-slate-100">
          {lista.map((o) => {
            const [rot, cls] = STATUS[o.status] || STATUS.enviado;
            const imp = o.implantacao;
            return (
              <div key={o.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2"><b>{o.cliente_nome}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cls}`}>{rot}</span>{o.implantacao_em && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Dados recebidos</span>}{imp?.pagamento_realizado && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Diz que pagou</span>}</div>
                    <div className="text-[12px] text-slate-500">{o.numero} · {o.usuarios_incluidos} usuários · {brlOrc(o.configuracao)} agora + {brlOrc(o.mensalidade)}/mês · criado {new Date(o.created_at).toLocaleString("pt-BR")}</div>
                    <div className="text-[11px] text-slate-400">
                      {o.visualizacoes ? `Aberto ${o.visualizacoes}x` : "Ainda não aberto"}
                      {o.aceito_em ? ` · aceito em ${new Date(o.aceito_em).toLocaleString("pt-BR")}` : ` · válido até ${new Date(o.expira_em).toLocaleString("pt-BR")}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[12px]">
                    <button onClick={() => navigator.clipboard.writeText(o.link)} className="rounded-lg border border-slate-200 px-2.5 py-1.5">Copiar link</button>
                    <a href={whats(o.cliente_telefone, o.cliente_nome, o.link)} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-emerald-700">WhatsApp</a>
                    <a href={o.link} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2.5 py-1.5">Abrir</a>
                    {o.status !== "aceito" && <button onClick={() => acao(o.id, "renovar")} className="rounded-lg border border-slate-200 px-2.5 py-1.5">Renovar 24h</button>}
                    {(o.status === "enviado" || o.status === "visualizado") && <button onClick={() => acao(o.id, "cancelar")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-600">Cancelar</button>}
                    {imp && <button onClick={() => setAberto(aberto === o.id ? "" : o.id)} className="rounded-lg bg-slate-800 px-2.5 py-1.5 font-semibold text-white">{aberto === o.id ? "Fechar dados" : "Ver dados"}</button>}
                  </div>
                </div>
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
