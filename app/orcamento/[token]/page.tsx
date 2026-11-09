"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PERFIS, PLANOS, brlOrc, calcularOrcamento, pctOrc, type DadosPagamento, type Implantacao, type ItemOrcamento, type UsuarioImplantacao } from "../../lib/orcamento";

type Orcamento = {
  numero: string;
  cliente_nome: string;
  itens: ItemOrcamento[];
  usuarios_incluidos: number;
  mensalidade: number;
  configuracao: number;
  status: string;
  expira_em: string;
  criado_em: string;
  aceito_em: string | null;
  pagamento: DadosPagamento | null;
  implantacao: Implantacao | null;
  implantacao_enviada: boolean;
  implantacao_em: string | null;
  agora: string;
};

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const usuarioVazio = (): UsuarioImplantacao => ({ nome: "", email: "", telefone: "", perfil: "Atendente" });

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] ${className}`}>{children}</div>;
}
function Titulo({ n, children, sub }: { n: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[12px] font-bold text-white">{n}</span>
      <div>
        <h2 className="text-[16px] font-bold leading-7 text-slate-800">{children}</h2>
        {sub && <p className="text-[12px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
function Campo({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {children}
    </label>
  );
}
function Check({ cor }: { cor: string }) {
  return (
    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: cor }}>✓</span>
  );
}

function Contador({ expiraEm, deslocamento, onExpirar }: { expiraEm: string; deslocamento: number; onExpirar: () => void }) {
  const [agora, setAgora] = useState(() => Date.now() + deslocamento);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now() + deslocamento), 1000); return () => clearInterval(t); }, [deslocamento]);
  const resto = Math.max(0, new Date(expiraEm).getTime() - agora);
  useEffect(() => { if (resto === 0) onExpirar(); }, [resto, onExpirar]);
  const p = (n: number) => String(n).padStart(2, "0");
  const partes: [string, string][] = [[p(Math.floor(resto / 3600_000)), "h"], [p(Math.floor((resto % 3600_000) / 60_000)), "min"], [p(Math.floor((resto % 60_000) / 1000)), "s"]];
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-amber-900">Condição por tempo limitado</div>
          <div className="text-[11px] text-amber-700">Até {new Date(expiraEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 font-mono">
        {partes.map(([v, u], i) => (
          <div key={u} className="flex items-center gap-1">
            {i > 0 && <span className="text-amber-400">:</span>}
            <div className="min-w-[42px] rounded-xl bg-white px-1.5 py-1 text-center shadow-sm ring-1 ring-amber-200">
              <div className="text-[18px] font-bold leading-none tabular-nums text-amber-700">{v}</div>
              <div className="mt-0.5 font-sans text-[9px] uppercase text-amber-500">{u}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Copiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sem permissão */ } }}
      className={`rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${ok ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"}`}>
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}

export default function OrcamentoPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");
  const [orc, setOrc] = useState<Orcamento | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [deslocamento, setDeslocamento] = useState(0);
  const [form, setForm] = useState<Omit<Implantacao, "usuarios" | "whatsapps">>({ razao_social: "", cnpj: "", responsavel: "", email: "", telefone: "", whatsapp_atendimento: "", pagamento_realizado: false, observacoes: "" });
  const [whatsapps, setWhatsapps] = useState<string[]>([""]);
  const [usuarios, setUsuarios] = useState<UsuarioImplantacao[]>([usuarioVazio()]);
  const [erroForm, setErroForm] = useState("");
  const [editando, setEditando] = useState(false);

  function aplicar(o: Orcamento) {
    setOrc(o);
    const conexoes = Math.max(1, calcularOrcamento(o.itens || []).whatsapps);
    if (o.implantacao) {
      const { usuarios: us, whatsapps: ws, ...resto } = o.implantacao;
      setForm(resto);
      setUsuarios(us.length ? us : [usuarioVazio()]);
      const lista = ws?.length ? ws : [resto.whatsapp_atendimento];
      setWhatsapps(Array.from({ length: conexoes }, (_, i) => lista[i] || ""));
    } else {
      setForm((f) => ({ ...f, responsavel: f.responsavel || o.cliente_nome }));
      setWhatsapps(Array.from({ length: conexoes }, () => ""));
    }
  }

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await fetch(`/api/orcamentos/publico/${encodeURIComponent(token)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || "Link inválido");
        if (!ativo) return;
        aplicar(d.orcamento);
        setDeslocamento(new Date(d.orcamento.agora).getTime() - Date.now());
      } catch (e: any) {
        if (ativo) setErro(e.message || "Não foi possível abrir o orçamento");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  const aberto = !!orc && (orc.status === "enviado" || orc.status === "visualizado");
  const onExpirar = useMemo(() => () => setOrc((o) => (o && (o.status === "enviado" || o.status === "visualizado") ? { ...o, status: "expirado" } : o)), []);

  async function aceitar() {
    setEnviando(true);
    try {
      const r = await fetch(`/api/orcamentos/publico/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "aceitar" }) });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Não foi possível registrar o aceite");
      aplicar(d.orcamento);
      setTimeout(() => document.getElementById("pagamento")?.scrollIntoView({ behavior: "smooth" }), 150);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviarImplantacao(e: React.FormEvent) {
    e.preventDefault();
    setErroForm(""); setEnviando(true);
    try {
      const r = await fetch(`/api/orcamentos/publico/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "implantacao", dados: { ...form, usuarios, whatsapps } }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Não foi possível enviar");
      setOrc((o) => (o ? { ...o, implantacao_enviada: true, implantacao_em: d.implantacao_em } : o));
      setEditando(false);
      setTimeout(() => document.getElementById("implantacao")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setErroForm(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50"><div className="flex items-center gap-3 text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />Carregando seu orçamento…</div></main>;
  }
  if (erro || !orc) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-sm text-center"><div className="text-3xl">🔒</div><div className="mt-2 text-lg font-bold text-slate-800">Orçamento indisponível</div><p className="mt-1 text-sm text-slate-500">{erro}</p></Card>
      </main>
    );
  }

  const primeiro = orc.cliente_nome.trim().split(/\s+/)[0] || "";
  const aceito = orc.status === "aceito";
  const mostrarForm = aceito && (!orc.implantacao_enviada || editando);
  const tot = calcularOrcamento(orc.itens || []);
  const comPrecos = (orc.itens || []).some((i) => i.tipo);
  const planoItem = orc.itens.find((i) => i.tipo === "plano");
  const planoDef = PLANOS.find((p) => p.id === planoItem?.id);
  // cartões do "o que está incluso": plataforma + módulos/itens (sem as linhas de quantidade e configuração)
  const cartoes: (ItemOrcamento & { tag?: string })[] = comPrecos
    ? [
        { nome: planoDef ? planoDef.nome : "Plataforma Wolf System", sub: `${tot.usuarios} usuários · ${tot.whatsapps} WhatsApp${tot.whatsapps === 1 ? "" : "s"}`, cor: planoDef?.cor || "#059669",
          linhas: planoDef?.linhas || ["Acesso individual com login e senha para cada usuário", "Perfis e grupos de permissão por função", "Acesso pelo navegador, no computador e no celular"] },
        ...orc.itens.filter((i) => i.tipo === "modulo" || i.tipo === "personalizado").map((i) => ({ ...i, tag: i.incluso ? "incluso no plano" : undefined })),
      ]
    : orc.itens;
  const chips = comPrecos
    ? [`${tot.usuarios} usuários`, `${tot.whatsapps} WhatsApp${tot.whatsapps === 1 ? "" : "s"}`, ...orc.itens.filter((i) => i.tipo === "modulo" || i.tipo === "personalizado").map((i) => i.nome.replace("Módulo ", ""))]
    : [`${orc.usuarios_incluidos} usuários`, ...orc.itens.filter((i) => i.id !== "plataforma" && i.nome !== "Plataforma Wolf System").map((i) => i.nome.replace("Módulo ", ""))];

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_#f8fafc_45%)] text-slate-800">
      <div className={`mx-auto max-w-[760px] px-4 pt-5 ${aberto ? "pb-32" : "pb-12"}`}>
        {/* topo */}
        <div className="mb-4 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-[16px] font-black text-white shadow-md shadow-emerald-600/30">W</span>
            <div className="leading-tight"><div className="text-[14px] font-bold text-slate-800">Wolf System</div><div className="text-[10px] text-slate-500">CRM, atendimento e automação</div></div>
          </div>
          <span className="rounded-full bg-white/80 px-2.5 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">{orc.numero}</span>
        </div>

        {/* destaque */}
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-6 text-white shadow-xl shadow-emerald-900/20 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-teal-400/20" />
          <div className="relative">
            <div className="text-[13px] font-medium text-emerald-100">{primeiro ? `${primeiro}, preparamos sua proposta comercial` : "Sua proposta comercial"}</div>
            <h1 className="mt-2 text-[30px] font-black leading-[1.1] tracking-tight sm:text-[40px]">Plataforma completa<br />para sua operação</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
              {chips.map((t) => (
                <span key={t} className="rounded-full bg-white/15 px-3 py-1 font-semibold backdrop-blur">{t}</span>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:max-w-md">
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><div className="text-[10px] uppercase tracking-wider text-emerald-100">Agora</div><div className="text-[20px] font-black tabular-nums">{brlOrc(orc.configuracao)}</div><div className="text-[11px] text-emerald-100">configuração inicial</div></div>
              <div className="rounded-2xl bg-white px-4 py-3 text-emerald-800"><div className="text-[10px] uppercase tracking-wider text-emerald-600">Mensalidade</div><div className="text-[20px] font-black tabular-nums">{brlOrc(orc.mensalidade)}</div><div className="text-[11px] text-emerald-600">a partir do mês seguinte</div></div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {aberto && <Contador expiraEm={orc.expira_em} deslocamento={deslocamento} onExpirar={onExpirar} />}
          {orc.status === "expirado" && <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-center text-[13px] text-slate-600">⏱️ Este orçamento expirou em {new Date(orc.expira_em).toLocaleString("pt-BR")}. Fale com a Wolf System para renovar.</div>}

          {aceito && (
            <div className="flex items-center gap-3 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xl text-white shadow-lg shadow-emerald-600/30">✓</div>
              <div>
                <div className="text-[16px] font-extrabold text-emerald-700">Orçamento aceito!</div>
                <div className="text-[13px] text-slate-600">Aceito em {orc.aceito_em ? new Date(orc.aceito_em).toLocaleString("pt-BR") : ""}. Agora é só fazer o pagamento e enviar os dados abaixo.</div>
              </div>
            </div>
          )}

          {/* pagamento */}
          {aceito && orc.pagamento && (
            <div id="pagamento">
              <Card>
                <Titulo n="1" sub="Pague a configuração inicial para começarmos a implantação.">Dados para pagamento</Titulo>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
                  <div className="text-[11px] uppercase tracking-wider text-emerald-100">Valor a pagar agora</div>
                  <div className="text-[34px] font-black tabular-nums">{brlOrc(orc.configuracao)}</div>
                  <div className="text-[12px] text-emerald-100">Configuração inicial · pagamento único</div>
                </div>
                <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{orc.pagamento.tipo}</div><div className="font-mono text-[18px] font-bold text-slate-800">{orc.pagamento.cnpj}</div></div>
                    <Copiar valor={orc.pagamento.chave} rotulo="Copiar chave PIX" />
                  </div>
                  {[["Favorecido", orc.pagamento.favorecido], ["Banco", orc.pagamento.banco], ["CNPJ", orc.pagamento.cnpj]].map(([k, v]) => (
                    <div key={k} className="flex justify-between p-4 text-[14px]"><span className="text-slate-500">{k}</span><b>{v}</b></div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-slate-500">A mensalidade de <b>{brlOrc(orc.mensalidade)}</b> começa a ser cobrada a partir do mês seguinte.</p>
              </Card>
            </div>
          )}

          {/* implantação */}
          {aceito && (
            <div id="implantacao">
              <Card>
                <Titulo n="2" sub={`Com esses dados criamos seu ambiente e os acessos dos ${orc.usuarios_incluidos} usuários.`}>Dados para implantação</Titulo>
                {!mostrarForm ? (
                  <div className="rounded-2xl bg-emerald-50 p-5 text-center">
                    <div className="text-[15px] font-bold text-emerald-700">✓ Dados recebidos</div>
                    <p className="mt-1 text-[13px] text-emerald-800">Enviados em {orc.implantacao_em ? new Date(orc.implantacao_em).toLocaleString("pt-BR") : ""}. Nossa equipe vai entrar em contato para concluir a implantação.</p>
                    <button onClick={() => setEditando(true)} className="mt-3 text-[13px] font-semibold text-emerald-700 underline">Corrigir ou completar os dados</button>
                  </div>
                ) : (
                  <form onSubmit={enviarImplantacao} className="space-y-5">
                    <div>
                      <div className="mb-2 text-[13px] font-bold text-slate-700">Empresa</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Campo rotulo="Razão social ou nome da empresa" className="sm:col-span-2"><input className={inputCls} value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></Campo>
                        <Campo rotulo="CNPJ (ou CPF)"><input className={inputCls} inputMode="numeric" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></Campo>
                        <Campo rotulo="Responsável"><input className={inputCls} value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></Campo>
                        <Campo rotulo="E-mail do responsável"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
                        <Campo rotulo="Telefone / WhatsApp do responsável"><input className={inputCls} inputMode="tel" placeholder="(62) 99999-9999" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Campo>
                        {whatsapps.map((w, i) => (
                          <Campo key={i} rotulo={whatsapps.length > 1 ? `WhatsApp do atendimento ${i + 1}` : "Número de WhatsApp do atendimento"} className={whatsapps.length > 1 ? "" : "sm:col-span-2"}>
                            <input className={inputCls} inputMode="tel" placeholder="Número que será conectado" value={w} onChange={(e) => setWhatsapps((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
                          </Campo>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[13px] font-bold text-slate-700">Usuários <span className="font-normal text-slate-400">({usuarios.length} de {orc.usuarios_incluidos})</span></div>
                        {usuarios.length < orc.usuarios_incluidos && (
                          <button type="button" onClick={() => setUsuarios((u) => [...u, usuarioVazio()])} className="rounded-xl bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-200">+ Adicionar usuário</button>
                        )}
                      </div>
                      <div className="space-y-2.5">
                        {usuarios.map((u, i) => (
                          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[12px] font-bold text-slate-500">Usuário {i + 1}</span>
                              {usuarios.length > 1 && <button type="button" onClick={() => setUsuarios((l) => l.filter((_, k) => k !== i))} className="text-[12px] text-red-500">Remover</button>}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[1.2fr_1.4fr_1fr_0.9fr]">
                              <input className={inputCls} placeholder="Nome" value={u.nome} onChange={(e) => setUsuarios((l) => l.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))} />
                              <input className={inputCls} type="email" placeholder="E-mail (login)" value={u.email} onChange={(e) => setUsuarios((l) => l.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))} />
                              <input className={inputCls} inputMode="tel" placeholder="Telefone" value={u.telefone} onChange={(e) => setUsuarios((l) => l.map((x, k) => (k === i ? { ...x, telefone: e.target.value } : x)))} />
                              <select className={inputCls} value={u.perfil} onChange={(e) => setUsuarios((l) => l.map((x, k) => (k === i ? { ...x, perfil: e.target.value } : x)))}>
                                {PERFIS.map((p) => <option key={p}>{p}</option>)}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Campo rotulo="Observações (opcional)"><textarea className={inputCls} rows={3} placeholder="Ex.: horários de atendimento, equipes, dúvidas" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Campo>

                    <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200 p-3 text-[14px]">
                      <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.pagamento_realizado} onChange={(e) => setForm({ ...form, pagamento_realizado: e.target.checked })} />
                      Já fiz o pagamento da configuração inicial
                    </label>

                    {erroForm && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{erroForm}</div>}
                    <button disabled={enviando} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-105 disabled:opacity-50">
                      {enviando ? "Enviando…" : "Enviar dados para implantação"}
                    </button>
                  </form>
                )}
              </Card>
            </div>
          )}

          {/* itens */}
          <Card>
            <Titulo n={aceito ? "3" : "1"}>O que está incluso</Titulo>
            <div className="grid gap-3 sm:grid-cols-2">
              {cartoes.map((it) => (
                <div key={it.nome} className="relative overflow-hidden rounded-2xl border border-slate-200 p-4">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: it.cor }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[15px] font-bold text-slate-800">{it.nome}</div>
                    {"tag" in it && it.tag && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">{it.tag}</span>}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: it.cor }}>{it.sub === "usuários" ? `${orc.usuarios_incluidos} usuários` : it.sub}</div>
                  <ul className="mt-3 space-y-1.5">
                    {it.linhas.map((l) => <li key={l} className="flex gap-2 text-[13px] text-slate-600"><Check cor={it.cor} />{l}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* investimento */}
          <Card>
            <Titulo n={aceito ? "4" : "2"}>Investimento</Titulo>
            {comPrecos && (
              <div className="mb-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-[13px]">
                {tot.linhas.filter((l) => !l.incluso).map((l) => (
                  <div key={`${l.tipo}-${l.id}-${l.nome}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-700">{l.nome}{(l.qtd || 1) > 1 && <span className="font-normal text-slate-400"> × {l.qtd}</span>}</div>
                      <div className="text-[11px] text-slate-400">{l.cobranca === "unico" ? "pagamento único" : "por mês"}{l.desconto ? ` · ${pctOrc(l.desconto)} de desconto` : ""}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {l.desconto ? <div className="text-[11px] text-slate-400 line-through tabular-nums">{brlOrc(l.bruto)}</div> : null}
                      <div className="font-bold tabular-nums text-slate-800">{brlOrc(l.liquido)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {comPrecos && tot.mensalDesconto + tot.unicoDesconto > 0 && (
              <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
                🎁 Você economiza <b>{brlOrc(tot.mensalDesconto)} por mês</b>{tot.unicoDesconto > 0 ? <> e <b>{brlOrc(tot.unicoDesconto)}</b> na configuração</> : null} em relação à tabela.
              </div>
            )}
            <div className="divide-y divide-slate-100 text-[14px]">
              <div className="flex justify-between py-3"><span className="text-slate-600">Configuração inicial <span className="text-slate-400">(pagamento único, na contratação)</span></span><b className="tabular-nums">{brlOrc(orc.configuracao)}</b></div>
              <div className="flex justify-between py-3"><span className="text-slate-600">Mensalidade <span className="text-slate-400">(a partir do mês seguinte)</span></span><b className="tabular-nums">{brlOrc(orc.mensalidade)}/mês</b></div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <span className="text-[13px] font-bold">Pagamento agora (somente a configuração)</span>
              <span className="text-[18px] font-black tabular-nums">{brlOrc(orc.configuracao)}</span>
            </div>
          </Card>

          <p className="px-1 text-center text-[11px] text-slate-400">Orçamento {orc.numero} · emitido em {new Date(orc.criado_em).toLocaleDateString("pt-BR")} · Wolf System</p>
        </div>
      </div>

      {aberto && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-[760px] items-center gap-3">
            <div className="hidden leading-tight sm:block"><div className="text-[11px] text-slate-500">Agora</div><div className="text-[16px] font-black text-slate-800">{brlOrc(orc.configuracao)}</div></div>
            <button disabled={enviando} onClick={aceitar} className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-105 disabled:opacity-50">
              {enviando ? "Registrando…" : "✓ Aceitar orçamento"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
