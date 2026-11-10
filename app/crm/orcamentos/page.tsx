"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Icone from "../../components/a2/Icone";
import {
  CONFIGURACAO_PADRAO, MODULOS, PLANOS, PRECO_USUARIO, PRECO_WHATSAPP, brlOrc, calcularOrcamento, pctOrc,
  type Cobranca, type Implantacao, type ItemOrcamento,
} from "../../lib/orcamento";

type Orc = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string; usuarios_incluidos: number;
  mensalidade: number; configuracao: number; status: string; expira_em: string; visualizacoes: number;
  visualizado_em: string | null; aceito_em: string | null; implantacao: Implantacao | null; implantacao_em: string | null;
  itens: ItemOrcamento[]; created_at: string; link: string; criado_por?: string;
};
type Personalizado = { nome: string; sub: string; linhas: string; preco: string; cobranca: Cobranca };
type Rascunho = {
  cliente_nome: string; cliente_telefone: string; validade_horas: string;
  base: string;                       // "avulso" ou id do plano
  usuarios: string; whatsapps: string;
  modulos: string[];                  // módulos marcados (fora os do plano)
  personalizados: Personalizado[];
  configuracao: string;
  descontos: Record<string, number>;  // % por linha
};

const STATUS: Record<string, [string, string]> = {
  enviado: ["Enviado", "bg-[#F1F5F9] text-[#475569]"],
  visualizado: ["Visualizado", "bg-[#ECFDF5] text-[#047857]"],
  aceito: ["Aceito", "bg-[#059669] text-white"],
  expirado: ["Expirado", "bg-[#F3F6F5] text-[#64748B]"],
  cancelado: ["Cancelado", "bg-[#F3F6F5] text-[#94A3B8]"],
  recusado: ["Recusado", "bg-[#FEF2F2] text-[#B91C1C]"],
};
const inputCls = "h-11 w-full rounded-xl border border-[#E6ECEA] bg-[#F7FAF9] px-3.5 text-[14px] font-semibold text-[#0F172A] outline-none placeholder:font-medium placeholder:text-[#94A3B8]";
const rot = "mb-1.5 block text-[12px] font-bold text-[#64748B]";
// A2: cartões, pílulas e botões.
const cartaoCls = "rounded-[20px] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_32px_-18px_rgba(16,24,40,.2)]";
const pilula = "rounded-full px-[9px] py-0.5 text-[11px] font-bold";
const botaoClaro = "inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#F3F6F5] px-3.5 text-[13px] font-bold text-[#334155] transition hover:bg-[#E6ECEA]";
const botaoIcone = "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F6F5] text-[#475569] transition hover:bg-[#E6ECEA] hover:text-[#0F172A]";
const botaoVerde = "inline-flex items-center justify-center gap-1.5 rounded-[14px] bg-gradient-to-br from-[#10B981] to-[#059669] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(5,150,105,.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none";
const CORES_AVATAR = [
  ["linear-gradient(140deg, #D1FAE5, #A7F3D0)", "#065F46"], ["#FFF7ED", "#C2410C"], ["#F1F5F9", "#334155"],
  ["#FEF3C7", "#92400E"], ["#E0F2F1", "#0F766E"], ["#ECFDF5", "#047857"],
];
function avatar(nome: string) {
  let h = 0; for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const p = nome.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  const [bg, fg] = CORES_AVATAR[h % CORES_AVATAR.length];
  return { ini: ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase(), bg, fg };
}
function Etapa({ n, titulo, extra }: { n: number; titulo: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#059669] text-[12px] font-extrabold text-white">{n}</span>
      <span className="text-[15px] font-extrabold text-[#0F172A]">{titulo}</span>
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}
const VAZIO: Rascunho = {
  cliente_nome: "", cliente_telefone: "", validade_horas: "24", base: "avulso", usuarios: "10", whatsapps: "1",
  modulos: ["crm", "chatbot", "revisional"], personalizados: [], configuracao: String(CONFIGURACAO_PADRAO), descontos: {},
};

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

const num = (s: string) => { const n = Number(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const inteiro = (s: string) => Math.max(0, Math.round(num(s)));

/** Chave da linha para guardar o desconto. */
function chave(it: ItemOrcamento) {
  if (it.tipo === "plano") return "plano";
  if (it.tipo === "usuarios") return "usuarios";
  if (it.tipo === "whatsapp") return "whatsapp";
  if (it.tipo === "configuracao") return "config";
  if (it.tipo === "modulo") return `mod:${it.id}`;
  return `pers:${it.id}`;
}

/** Converte o formulário na lista de linhas do orçamento. */
function montarItens(r: Rascunho): ItemOrcamento[] {
  const plano = PLANOS.find((p) => p.id === r.base);
  const d = (k: string) => r.descontos[k] || 0;
  const itens: ItemOrcamento[] = [];
  if (plano) itens.push({ tipo: "plano", id: plano.id, nome: plano.nome, sub: "", cor: plano.cor, linhas: plano.linhas, desconto: d("plano") });
  const usuariosExtra = Math.max(0, inteiro(r.usuarios) - (plano?.usuarios || 0));
  if (usuariosExtra) itens.push({ tipo: "usuarios", id: "usuarios", nome: plano ? "Usuários adicionais" : "Usuários", sub: "Acesso individual ao sistema", cor: "#059669", linhas: [], preco: PRECO_USUARIO, qtd: usuariosExtra, desconto: d("usuarios") });
  const whatsExtra = Math.max(0, inteiro(r.whatsapps) - (plano?.whatsapps || 0));
  if (whatsExtra) itens.push({ tipo: "whatsapp", id: "whatsapp", nome: plano ? "Conexões de WhatsApp adicionais" : "Conexões de WhatsApp", sub: "Números conectados ao atendimento", cor: "#059669", linhas: [], preco: PRECO_WHATSAPP, qtd: whatsExtra, desconto: d("whatsapp") });
  MODULOS.forEach((m) => {
    const noPlano = !!plano?.inclui.includes(m.id);
    if (noPlano || r.modulos.includes(m.id)) itens.push({ tipo: "modulo", id: m.id, nome: m.nome, sub: m.sub, cor: m.cor, linhas: m.linhas, preco: m.preco, qtd: 1, incluso: noPlano, desconto: noPlano ? 0 : d(`mod:${m.id}`) });
  });
  r.personalizados.forEach((p, i) => {
    if (!p.nome.trim()) return;
    const id = `p${i}`;
    itens.push({ tipo: "personalizado", id, nome: p.nome.trim(), sub: p.sub.trim() || "Item adicional", cor: "#475569", linhas: p.linhas.split("\n").map((l) => l.trim()).filter(Boolean), preco: num(p.preco), qtd: 1, cobranca: p.cobranca, desconto: d(`pers:${id}`) });
  });
  if (num(r.configuracao) > 0) itens.push({ tipo: "configuracao", id: "configuracao", nome: "Configuração inicial", sub: "Implantação e configuração do ambiente", cor: "#0f766e", linhas: [], preco: num(r.configuracao), qtd: 1, cobranca: "unico", desconto: d("config") });
  return itens;
}

/** Abre um orçamento existente no formulário (orçamentos antigos, sem preço por item, viram montagem avulsa). */
function rascunhoDe(o: Orc): Rascunho {
  const itens = o.itens || [];
  const base: Rascunho = { ...VAZIO, cliente_nome: o.cliente_nome, cliente_telefone: o.cliente_telefone || "", modulos: [], descontos: {}, personalizados: [] };
  if (!itens.some((i) => i.tipo)) {
    itens.forEach((it) => {
      const m = MODULOS.find((x) => (it.id && x.id === it.id) || x.nome === it.nome);
      if (m) base.modulos.push(m.id);
      else if (it.nome !== "Plataforma Wolf System") base.personalizados.push({ nome: it.nome, sub: it.sub, linhas: (it.linhas || []).join("\n"), preco: "0", cobranca: "mensal" });
    });
    return { ...base, usuarios: String(o.usuarios_incluidos), whatsapps: "1", configuracao: String(o.configuracao) };
  }
  const plano = itens.find((i) => i.tipo === "plano");
  const pl = PLANOS.find((p) => p.id === plano?.id);
  let usuarios = pl?.usuarios || 0, whatsapps = pl?.whatsapps || 0, configuracao = "0";
  itens.forEach((it) => {
    if (it.desconto) base.descontos[chave(it)] = it.desconto;
    if (it.tipo === "usuarios") usuarios += it.qtd || 0;
    if (it.tipo === "whatsapp") whatsapps += it.qtd || 0;
    if (it.tipo === "modulo" && !it.incluso && it.id) base.modulos.push(it.id);
    if (it.tipo === "configuracao") configuracao = String(it.preco || 0);
  });
  // personalizados ganham ids novos (p0, p1…) na ordem: refaz as chaves de desconto
  itens.filter((it) => it.tipo === "personalizado").forEach((it, i) => {
    base.personalizados.push({ nome: it.nome, sub: it.sub, linhas: (it.linhas || []).join("\n"), preco: String(it.preco || 0), cobranca: it.cobranca || "mensal" });
    if (it.desconto) base.descontos[`pers:p${i}`] = it.desconto;
  });
  return { ...base, base: pl?.id || "avulso", usuarios: String(usuarios), whatsapps: String(Math.max(1, whatsapps)), configuracao };
}

function Editor({ inicial, editando, onSalvar, onCancelar }: { inicial: Rascunho; editando: boolean; onSalvar: (itens: ItemOrcamento[], r: Rascunho) => Promise<void>; onCancelar?: () => void }) {
  const [r, setR] = useState<Rascunho>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [descGeral, setDescGeral] = useState("");
  const [alvo, setAlvo] = useState("");
  const itens = useMemo(() => montarItens(r), [r]);
  const t = useMemo(() => calcularOrcamento(itens), [itens]);
  const plano = PLANOS.find((p) => p.id === r.base);
  const cobraveis = t.linhas.filter((l) => !l.incluso);

  const setDesc = (k: string, v: string) => setR((s) => ({ ...s, descontos: { ...s.descontos, [k]: Math.min(100, Math.max(0, num(v))) } }));
  const aplicarEmTodos = (pct: number, soMensal = false) => setR((s) => {
    const descontos = { ...s.descontos };
    montarItens(s).forEach((it) => { if (!it.incluso && !(soMensal && it.cobranca === "unico")) descontos[chave(it)] = Math.round(pct * 100) / 100; });
    return { ...s, descontos };
  });
  // Fecha a mensalidade num valor exato: mesmo % em todas as linhas mensais e
  // o centavo que sobrar do arredondamento vai para a linha de maior valor.
  const fecharEm = () => {
    const v = num(alvo);
    if (!(v > 0) || !t.mensalTabela || v > t.mensalTabela) return;
    const r4 = (x: number) => Math.round(x * 10000) / 10000;
    setR((s) => {
      const pct = r4(Math.max(0, Math.min(100, (1 - v / t.mensalTabela) * 100)));
      const descontos = { ...s.descontos };
      const mensais = montarItens(s).filter((it) => !it.incluso && it.cobranca !== "unico");
      mensais.forEach((it) => { descontos[chave(it)] = pct; });
      const calc = calcularOrcamento(montarItens({ ...s, descontos }));
      const sobra = Math.round((v - calc.mensal) * 100) / 100;
      const maior = calc.linhas.filter((l) => !l.incluso && l.cobranca !== "unico").sort((a, b) => b.bruto - a.bruto)[0];
      if (sobra && maior?.bruto) descontos[chave(maior)] = r4((1 - (maior.liquido + sobra) / maior.bruto) * 100);
      return { ...s, descontos };
    });
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true);
    try { await onSalvar(itens, r); } finally { setSalvando(false); }
  }

  return (
    <form onSubmit={enviar} className="space-y-7">
      <div className="grid gap-3.5 sm:grid-cols-4">
        <label className="sm:col-span-2"><span className={rot}>Cliente</span><input className={inputCls} value={r.cliente_nome} onChange={(e) => setR({ ...r, cliente_nome: e.target.value })} /></label>
        <label><span className={rot}>WhatsApp do cliente</span><input className={inputCls} value={r.cliente_telefone} onChange={(e) => setR({ ...r, cliente_telefone: e.target.value })} /></label>
        {!editando && <label><span className={rot}>Validade (horas)</span><input className={inputCls} value={r.validade_horas} onChange={(e) => setR({ ...r, validade_horas: e.target.value })} /></label>}
      </div>

      {/* base */}
      <div>
        <Etapa n={1} titulo="Base do orçamento" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[{ id: "avulso", nome: "Montar avulso", preco: 0, info: `Usuário ${brlOrc(PRECO_USUARIO)} · WhatsApp ${brlOrc(PRECO_WHATSAPP)}` }, ...PLANOS.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco, info: `${p.usuarios} usuários · ${p.whatsapps} WhatsApp${p.whatsapps > 1 ? "s" : ""}` }))].map((b) => (
            <button type="button" key={b.id} onClick={() => setR((s) => {
              const p = PLANOS.find((x) => x.id === b.id);
              return { ...s, base: b.id, usuarios: p ? String(Math.max(inteiro(s.usuarios), p.usuarios)) : s.usuarios, whatsapps: p ? String(Math.max(inteiro(s.whatsapps), p.whatsapps)) : s.whatsapps };
            })}
              className={`rounded-2xl p-4 text-left transition ${r.base === b.id ? "bg-white shadow-[0_10px_24px_-14px_rgba(5,150,105,.5)] outline outline-2 outline-[#059669]" : "bg-[#F7FAF9] shadow-[inset_0_0_0_1px_#E6ECEA] hover:bg-white hover:shadow-[0_1px_2px_rgba(16,24,40,.05),0_8px_20px_-14px_rgba(16,24,40,.25)]"}`}>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-[#0F172A]">{b.nome}</span>
                {r.base === b.id && <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-md bg-[#059669] text-white"><Icone nome="check" tamanho={12} espessura={2.6} /></span>}
              </div>
              {b.preco > 0 && <div className="mt-1 text-[18px] font-extrabold tracking-tight text-[#047857]">{brlOrc(b.preco)}<span className="text-[12px] font-semibold text-[#64748B]">/mês</span></div>}
              <div className="mt-0.5 text-[12px] text-[#64748B]">{b.info}</div>
            </button>
          ))}
        </div>
      </div>

      {/* quantidades */}
      <div>
        <Etapa n={2} titulo="Usuários e conexões" />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="block"><span className={rot}>Total de usuários</span><input className={inputCls} inputMode="numeric" value={r.usuarios} onChange={(e) => setR({ ...r, usuarios: e.target.value })} />
            <span className="mt-1.5 block text-[12px] text-[#94A3B8]">{plano ? `${plano.usuarios} no plano · ` : ""}{brlOrc(PRECO_USUARIO)} por usuário {plano ? "adicional" : ""}</span></label>
          <label className="block"><span className={rot}>Conexões de WhatsApp</span><input className={inputCls} inputMode="numeric" value={r.whatsapps} onChange={(e) => setR({ ...r, whatsapps: e.target.value })} />
            <span className="mt-1.5 block text-[12px] text-[#94A3B8]">{plano ? `${plano.whatsapps} no plano · ` : ""}{brlOrc(PRECO_WHATSAPP)} por conexão {plano ? "adicional" : ""}</span></label>
        </div>
      </div>

      {/* módulos */}
      <div>
        <Etapa n={3} titulo="Módulos" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => {
            const noPlano = !!plano?.inclui.includes(m.id);
            const marcado = noPlano || r.modulos.includes(m.id);
            return (
              <button type="button" key={m.id} disabled={noPlano} onClick={() => setR((s) => ({ ...s, modulos: s.modulos.includes(m.id) ? s.modulos.filter((x) => x !== m.id) : [...s.modulos, m.id] }))}
                className={`flex items-start gap-3 rounded-[14px] p-3.5 text-left transition ${marcado ? "bg-[#F7FFFB] shadow-[inset_0_0_0_1.5px_#A7F3D0]" : "bg-[#F7FAF9] shadow-[inset_0_0_0_1px_#E6ECEA] hover:bg-white"} ${noPlano ? "cursor-default" : ""}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${marcado ? "bg-[#059669] text-white" : "bg-white text-transparent shadow-[inset_0_0_0_1.5px_#CBD5E1]"}`}><Icone nome="check" tamanho={12} espessura={2.6} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-[#0F172A]">{m.nome}</span>
                  <span className="block text-[12px]" style={{ color: m.cor }}>{m.sub}</span>
                </span>
                <span className={`shrink-0 text-[12.5px] font-extrabold ${noPlano ? "text-[#059669]" : "text-[#334155]"}`}>{noPlano ? "no plano" : brlOrc(m.preco)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* personalizados + configuração */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Etapa n={4} titulo="Itens personalizados" extra={
            <button type="button" onClick={() => setR((s) => ({ ...s, personalizados: [...s.personalizados, { nome: "", sub: "", linhas: "", preco: "0", cobranca: "mensal" }] }))} className={`${botaoClaro} !h-9 !text-[12.5px]`}><Icone nome="mais" tamanho={14} />Adicionar item</button>
          } />
          {r.personalizados.length === 0 && <div className="rounded-[14px] bg-[#F7FAF9] p-4 text-center text-[12.5px] text-[#94A3B8] shadow-[inset_0_0_0_1px_#E6ECEA]">Ex.: treinamento da equipe, integração específica.</div>}
          <div className="space-y-2.5">
            {r.personalizados.map((p, i) => {
              const up = (campo: Partial<Personalizado>) => setR((s) => ({ ...s, personalizados: s.personalizados.map((x, k) => (k === i ? { ...x, ...campo } : x)) }));
              return (
                <div key={i} className="grid gap-2 rounded-[14px] bg-[#F7FAF9] p-3 shadow-[inset_0_0_0_1px_#E6ECEA] sm:grid-cols-[1fr_1fr_0.7fr_0.8fr_auto]">
                  <input className={`${inputCls} !bg-white`} placeholder="Nome do item" value={p.nome} onChange={(e) => up({ nome: e.target.value })} />
                  <input className={`${inputCls} !bg-white`} placeholder="Subtítulo" value={p.sub} onChange={(e) => up({ sub: e.target.value })} />
                  <input className={`${inputCls} !bg-white`} placeholder="Preço R$" value={p.preco} onChange={(e) => up({ preco: e.target.value })} />
                  <select className={`${inputCls} !bg-white`} value={p.cobranca} onChange={(e) => up({ cobranca: e.target.value as Cobranca })}><option value="mensal">Mensal</option><option value="unico">Único</option></select>
                  <button type="button" title="Remover item" onClick={() => setR((s) => ({ ...s, personalizados: s.personalizados.filter((_, k) => k !== i) }))} className={`${botaoIcone} !h-11 !w-11 !bg-[#FEF2F2] !text-[#B91C1C]`}><Icone nome="lixeira" tamanho={16} /></button>
                  <textarea className={`${inputCls} !h-auto !bg-white py-2.5 sm:col-span-5`} rows={2} placeholder="Detalhes, um por linha (opcional)" value={p.linhas} onChange={(e) => up({ linhas: e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <Etapa n={5} titulo="Configuração inicial" />
          <label className="block"><span className={rot}>Valor de tabela (pagamento único)</span><input className={inputCls} value={r.configuracao} onChange={(e) => setR({ ...r, configuracao: e.target.value })} /></label>
        </div>
      </div>

      {/* resumo com descontos */}
      <div>
        <Etapa n={6} titulo="Resumo e descontos" />
        <div className="overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_#E6ECEA]">
          <div className="flex flex-wrap items-center gap-2 bg-[#F7FAF9] px-4 py-3 text-[12.5px]">
            <span className="font-semibold text-[#64748B]">Desconto em tudo</span>
            <input className="h-9 w-16 rounded-[10px] border border-[#E6ECEA] bg-white px-2 text-right font-semibold" placeholder="%" value={descGeral} onChange={(e) => setDescGeral(e.target.value)} />
            <button type="button" onClick={() => aplicarEmTodos(Math.min(100, Math.max(0, num(descGeral))))} className="h-9 rounded-[10px] bg-[#0F172A] px-3 font-bold text-white">Aplicar</button>
            <span className="ml-auto font-semibold text-[#64748B]">Fechar mensalidade em</span>
            <input className="h-9 w-24 rounded-[10px] border border-[#E6ECEA] bg-white px-2 text-right font-semibold" placeholder="R$" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
            <button type="button" onClick={fecharEm} className="h-9 rounded-[10px] bg-[#059669] px-3 font-bold text-white">Ajustar</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead className="text-[12px] text-[#64748B]"><tr className="border-b border-[#F1F5F4]"><th className="px-4 py-2.5 text-left font-bold">Item</th><th className="px-2 text-right font-bold">Qtd</th><th className="px-2 text-right font-bold">Tabela</th><th className="px-2 text-center font-bold">Desconto</th><th className="px-4 text-right font-bold">Total</th></tr></thead>
              <tbody>
                {cobraveis.map((l) => {
                  const k = chave(l);
                  return (
                    <tr key={k} className="border-b border-[#F1F5F4]">
                      <td className="px-4 py-2.5"><b className="text-[#0F172A]">{l.nome}</b>{l.cobranca === "unico" && <span className={`${pilula} ml-1.5 bg-[#FEF3C7] text-[#92400E]`}>único</span>}</td>
                      <td className="px-2 text-right tabular-nums">{l.qtd}</td>
                      <td className="px-2 text-right tabular-nums text-[#64748B]">{brlOrc(l.bruto)}</td>
                      <td className="px-2 text-center">
                        <span className="inline-flex items-center gap-1"><input className="h-8 w-16 rounded-[9px] border border-[#E6ECEA] bg-[#F7FAF9] px-2 text-right font-semibold" inputMode="decimal" value={r.descontos[k] ?? 0} onChange={(e) => setDesc(k, e.target.value)} /><span className="text-[#94A3B8]">%</span></span>
                      </td>
                      <td className="px-4 text-right font-extrabold tabular-nums">{brlOrc(l.liquido)}</td>
                    </tr>
                  );
                })}
                {t.linhas.filter((l) => l.incluso).length > 0 && (
                  <tr><td colSpan={5} className="px-4 py-2.5 text-[12.5px] text-[#64748B]">Inclusos no plano: {t.linhas.filter((l) => l.incluso).map((l) => l.nome.replace("Módulo ", "")).join(", ")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#059669] to-[#065F46] px-[22px] py-5 text-white shadow-[0_16px_32px_-16px_rgba(6,95,70,.7)]">
            <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-[120px] w-[120px] rounded-full bg-white/10" />
            <div className="relative text-[13px] font-semibold text-white/85">Mensalidade</div>
            <div className="relative text-[30px] font-extrabold tracking-tight tabular-nums">{brlOrc(t.mensal)}</div>
            <div className="relative text-[12.5px] text-white/85">Tabela {brlOrc(t.mensalTabela)}{t.mensalDesconto > 0 && ` · desconto ${brlOrc(t.mensalDesconto)} (${pctOrc((t.mensalDesconto / (t.mensalTabela || 1)) * 100)})`}</div>
          </div>
          <div className="rounded-[18px] bg-[#F7FAF9] px-[22px] py-5 shadow-[inset_0_0_0_1px_#E6ECEA]">
            <div className="text-[13px] font-semibold text-[#64748B]">Pagamento único (configuração)</div>
            <div className="text-[30px] font-extrabold tracking-tight tabular-nums text-[#0F172A]">{brlOrc(t.unico)}</div>
            <div className="text-[12.5px] text-[#64748B]">Tabela {brlOrc(t.unicoTabela)}{t.unicoDesconto > 0 && ` · desconto ${brlOrc(t.unicoDesconto)}`} · {t.usuarios} usuários · {t.whatsapps} WhatsApp{t.whatsapps === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] text-[#64748B]">Pagamento: PIX Abc Call e Serviços (Nubank)</span>
        <div className="ml-auto flex gap-2">
          {onCancelar && <button type="button" onClick={onCancelar} className={`${botaoClaro} !h-[46px] !px-5 !text-[14px]`}>Cancelar</button>}
          <button disabled={salvando || !r.cliente_nome.trim() || t.usuarios < 1} className={`${botaoVerde} h-[46px] px-6 text-[14px]`}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Gerar link do orçamento"}</button>
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
  const [novoAberto, setNovoAberto] = useState(false);
  const [filtro, setFiltro] = useState<"todos" | "aguardando" | "aceitos" | "expirados" | "cancelados">("todos");

  const carregar = useCallback(async () => {
    try { const d = await api("/api/orcamentos"); setLista(d.orcamentos); setErro(""); } catch (e: any) { setErro(e.message); }
  }, []);
  useEffect(() => {
    const primeiro = setTimeout(() => void carregar(), 0);
    const t = setInterval(() => void carregar(), 30_000);
    return () => { clearTimeout(primeiro); clearInterval(t); };
  }, [carregar]);

  async function criar(itens: ItemOrcamento[], r: Rascunho) {
    try {
      await api("/api/orcamentos", { method: "POST", body: JSON.stringify({ cliente_nome: r.cliente_nome, cliente_telefone: r.cliente_telefone, validade_horas: r.validade_horas, itens }) });
      setChaveNovo((k) => k + 1); setNovoAberto(false); setFiltro("todos"); await carregar();
    } catch (e: any) { alert(e.message); throw e; }
  }
  async function salvarEdicao(id: string, itens: ItemOrcamento[], r: Rascunho) {
    try {
      await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, acao: "editar", cliente_nome: r.cliente_nome, cliente_telefone: r.cliente_telefone, itens }) });
      setEditando(""); await carregar();
    } catch (e: any) { alert(e.message); throw e; }
  }
  async function acao(id: string, a: "cancelar" | "renovar") {
    if (a === "cancelar" && !confirm("Cancelar este orçamento? O link deixa de funcionar.")) return;
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, acao: a }) }); await carregar(); } catch (e: any) { alert(e.message); }
  }

  // Resumo do mês corrente.
  const agora = new Date();
  const doMes = (iso?: string | null) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear(); };
  const mesLista = lista.filter((o) => doMes(o.created_at));
  const pelSite = mesLista.filter((o) => o.criado_por === "site").length;
  const aceitosMes = lista.filter((o) => o.status === "aceito" && doMes(o.aceito_em || o.created_at));
  const taxaAceite = mesLista.length ? Math.round((mesLista.filter((o) => o.status === "aceito").length / mesLista.length) * 100) : 0;
  const mensalFechada = aceitosMes.reduce((s, o) => s + (Number(o.mensalidade) || 0), 0);
  const configFechada = aceitosMes.reduce((s, o) => s + (Number(o.configuracao) || 0), 0);
  const ehAguardando = (o: Orc) => o.status === "enviado" || o.status === "visualizado";
  const aguardando = lista.filter(ehAguardando);
  const expiramHoje = aguardando.filter((o) => new Date(o.expira_em).toDateString() === agora.toDateString()).length;

  const grupos = {
    todos: lista,
    aguardando,
    aceitos: lista.filter((o) => o.status === "aceito"),
    expirados: lista.filter((o) => o.status === "expirado"),
    cancelados: lista.filter((o) => o.status === "cancelado" || o.status === "recusado"),
  };
  const filtros = ([["todos", "Todos"], ["aguardando", "Aguardando"], ["aceitos", "Aceitos"], ["expirados", "Expirados"], ["cancelados", "Cancelados"]] as const)
    .filter(([k]) => k === "todos" || grupos[k].length > 0 || filtro === k);
  const visiveis = grupos[filtro];

  const kpi = `${cartaoCls} flex flex-col gap-1.5 !rounded-[18px] px-[22px] py-5`;

  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-[22px] px-4 pb-8 pt-5 text-[#0F172A] sm:px-7">
      <section className="flex flex-wrap items-end gap-4 px-1 pt-1">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] font-extrabold tracking-[-.02em]">Orçamentos</h1>
          <span className="text-[14px] text-[#64748B]">Envie o link, o cliente aceita, paga a configuração e manda os dados de implantação</span>
        </div>
        <button onClick={() => setNovoAberto((v) => !v)} className={`${botaoVerde} ml-auto h-[46px] px-5 text-[14px]`}>
          <Icone nome={novoAberto ? "x" : "mais"} tamanho={16} espessura={2.4} />{novoAberto ? "Fechar" : "Novo orçamento"}
        </button>
      </section>
      {erro && <div className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{erro}</div>}

      {novoAberto && (
        <section className={`${cartaoCls} !rounded-[22px] p-[22px] sm:p-7`}>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669]"><Icone nome="documento" tamanho={19} /></span>
            <div className="flex flex-col">
              <span className="text-[17px] font-extrabold">Novo orçamento</span>
              <span className="text-[12.5px] text-[#64748B]">Monte com a tabela de preços, dê desconto por item e gere o link</span>
            </div>
          </div>
          <Editor key={chaveNovo} inicial={VAZIO} editando={false} onSalvar={criar} />
        </section>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        <div className={kpi}><span className="text-[13px] font-semibold text-[#64748B]">Enviados no mês</span><span className="text-[28px] font-extrabold tracking-tight">{mesLista.length}</span><span className="text-[12.5px] text-[#64748B]">{pelSite ? `${pelSite} vie${pelSite === 1 ? "io" : "ram"} pelo site` : "nenhum pelo site"}</span></div>
        <div className={kpi}><span className="text-[13px] font-semibold text-[#64748B]">Aceitos</span><span className="text-[28px] font-extrabold tracking-tight">{aceitosMes.length}</span><span className="self-start rounded-full bg-[#ECFDF5] px-[9px] py-0.5 text-[12px] font-bold text-[#047857]">{taxaAceite}% de aceite</span></div>
        <div className={kpi}><span className="text-[13px] font-semibold text-[#64748B]">Mensalidade fechada</span><span className="text-[28px] font-extrabold tracking-tight">{brlOrc(mensalFechada)}</span><span className="text-[12.5px] text-[#64748B]">+ {brlOrc(configFechada)} em configurações</span></div>
        <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#059669] to-[#065F46] px-[22px] py-5 text-white shadow-[0_16px_32px_-16px_rgba(6,95,70,.7)]">
          <div aria-hidden className="pointer-events-none absolute -right-[30px] -top-[30px] h-[120px] w-[120px] rounded-full bg-white/10" />
          <span className="relative text-[13px] font-semibold text-white/85">Aguardando resposta</span>
          <span className="relative text-[28px] font-extrabold tracking-tight">{aguardando.length}</span>
          <span className="relative text-[12.5px] text-white/85">{expiramHoje ? `${expiramHoje} expira${expiramHoje === 1 ? "" : "m"} hoje` : "nenhum expira hoje"}</span>
        </div>
      </section>

      <section aria-label="Lista de orçamentos" className="rounded-[22px] bg-white p-2 shadow-[0_2px_4px_rgba(16,24,40,.04),0_24px_48px_-24px_rgba(16,24,40,.2)]">
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
          {filtros.map(([k, t]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`h-[38px] rounded-[11px] px-3.5 text-[13px] transition ${filtro === k ? "bg-[#ECFDF5] font-extrabold text-[#047857]" : "bg-[#F3F6F5] font-semibold text-[#475569] hover:bg-[#E6ECEA]"}`}>
              {t} {grupos[k].length}
            </button>
          ))}
        </div>

        {visiveis.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 pb-12 pt-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#059669]"><Icone nome="documento" tamanho={22} /></span>
            <span className="text-[15px] font-extrabold">{lista.length ? "Nenhum orçamento neste filtro" : "Nenhum orçamento ainda"}</span>
            <span className="text-[13px] text-[#64748B]">{lista.length ? "Escolha outro filtro acima." : "Clique em Novo orçamento para montar o primeiro."}</span>
          </div>
        )}

        {visiveis.map((o) => {
          const [rotulo, cls] = STATUS[o.status] || STATUS.enviado;
          const imp = o.implantacao;
          const tot = calcularOrcamento(o.itens || []);
          const podeEditar = ["enviado", "visualizado", "expirado", "cancelado"].includes(o.status);
          const nomes = (o.itens || []).filter((it) => it.tipo !== "configuracao" && it.tipo !== "usuarios" && it.tipo !== "whatsapp" && it.nome !== "Plataforma Wolf System").map((it) => it.nome.replace("Módulo ", ""));
          const av = avatar(o.cliente_nome);
          const destaque = o.status === "aceito" && !!imp;
          const expira = new Date(o.expira_em);
          const expiraHoje = ehAguardando(o) && expira.toDateString() === agora.toDateString();
          const descPct = tot.mensalTabela > 0 && tot.mensalDesconto > 0 ? Math.round((tot.mensalDesconto / tot.mensalTabela) * 100) : 0;
          const detalhe = [
            nomes.length > 3 ? `${nomes.slice(0, 3).join(" + ")} + ${nomes.length - 3} módulos` : nomes.join(" + ") || "Montagem avulsa",
            `${o.usuarios_incluidos} usuários`,
            tot.whatsapps ? `${tot.whatsapps} WhatsApp${tot.whatsapps > 1 ? "s" : ""}` : "",
            o.numero,
            o.aceito_em ? `aceito em ${new Date(o.aceito_em).toLocaleDateString("pt-BR")}` : ehAguardando(o) ? `válido até ${expira.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "",
            ehAguardando(o) && !o.visualizacoes ? "ainda não aberto" : "",
          ].filter(Boolean).join(" · ");
          return (
            <div key={o.id} className={`mx-1.5 my-1 rounded-2xl px-[18px] py-4 transition ${destaque ? "bg-[#F7FFFB] shadow-[inset_0_0_0_1.5px_#A7F3D0]" : "hover:bg-[#F7FAF9]"}`}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] text-[14px] font-extrabold" style={{ background: av.bg, color: av.fg }}>{av.ini}</span>
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-extrabold">{o.cliente_nome}</span>
                    {expiraHoje
                      ? <span className={`${pilula} bg-[#FFF7ED] text-[#C2410C]`}>Expira hoje às {expira.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      : <span className={`${pilula} ${cls} ${o.status === "aceito" ? "!font-extrabold" : ""}`}>{rotulo}{o.status === "visualizado" && o.visualizacoes ? ` ${o.visualizacoes}x` : ""}</span>}
                    {o.criado_por === "site" && <span className={`${pilula} bg-[#E0F2F1] text-[#0F766E]`}>Site</span>}
                    {o.implantacao_em && <span className={`${pilula} bg-[#FEF3C7] text-[#92400E]`}>Dados recebidos</span>}
                    {imp?.pagamento_realizado && <span className={`${pilula} bg-[#ECFDF5] text-[#047857]`}>Diz que pagou</span>}
                  </div>
                  <span className="text-[13px] text-[#64748B]">{detalhe}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[17px] font-extrabold tracking-tight">{brlOrc(o.mensalidade)}<span className="text-[12px] font-semibold text-[#64748B]">/mês</span></span>
                  {descPct > 0
                    ? <span className="text-[12px] font-bold text-[#047857]">{descPct}% de desconto</span>
                    : <span className="text-[12px] text-[#64748B]">+ {brlOrc(o.configuracao)} configuração</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button title="Copiar link" onClick={() => navigator.clipboard.writeText(o.link)} className={botaoIcone}><Icone nome="copiar" tamanho={16} /></button>
                  <a title="Abrir como o cliente" href={o.link} target="_blank" rel="noreferrer" className={botaoIcone}><Icone nome="olho" tamanho={16} /></a>
                  {o.status !== "aceito" && <button onClick={() => acao(o.id, "renovar")} className={botaoClaro}><Icone nome="atualizar" tamanho={14} />Renovar 24h</button>}
                  {podeEditar && <button onClick={() => setEditando(editando === o.id ? "" : o.id)} className={botaoClaro}><Icone nome="editar" tamanho={14} />{editando === o.id ? "Fechar edição" : "Editar"}</button>}
                  {ehAguardando(o) && <button title="Cancelar orçamento" onClick={() => acao(o.id, "cancelar")} className={`${botaoIcone} hover:!bg-[#FEF2F2] hover:!text-[#B91C1C]`}><Icone nome="x" tamanho={16} /></button>}
                  {imp
                    ? <button onClick={() => setAberto(aberto === o.id ? "" : o.id)} className="inline-flex h-10 items-center rounded-xl bg-[#0F172A] px-4 text-[13px] font-extrabold text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,.6)]">{aberto === o.id ? "Fechar dados" : "Ver dados"}</button>
                    : <a href={whats(o.cliente_telefone, o.cliente_nome, o.link)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ECFDF5] px-3.5 text-[13px] font-extrabold text-[#047857] transition hover:bg-[#D1FAE5]"><Icone nome="whatsapp" tamanho={15} />WhatsApp</a>}
                </div>
              </div>
              {editando === o.id && (
                <div className="mt-4 rounded-[18px] bg-white p-5 shadow-[inset_0_0_0_1.5px_#A7F3D0]">
                  <div className="mb-4 flex items-center gap-2 text-[13.5px] font-extrabold text-[#065F46]"><Icone nome="editar" tamanho={15} />Editando {o.numero} · o link continua o mesmo</div>
                  <Editor inicial={rascunhoDe(o)} editando onSalvar={(itens, r) => salvarEdicao(o.id, itens, r)} onCancelar={() => setEditando("")} />
                </div>
              )}
              {imp && aberto === o.id && (
                <div className="mt-4 grid gap-5 rounded-[18px] bg-white p-5 text-[13px] shadow-[inset_0_0_0_1px_#E6ECEA] lg:grid-cols-[1fr_1.6fr]">
                  <div>
                    <div className="mb-2 text-[13px] font-extrabold">Empresa</div>
                    {[["Razão social", imp.razao_social], ["CNPJ/CPF", imp.cnpj], ["Responsável", imp.responsavel], ["E-mail", imp.email], ["Telefone", imp.telefone], ["WhatsApps do atendimento", (imp.whatsapps?.length ? imp.whatsapps : [imp.whatsapp_atendimento]).filter(Boolean).join(", ")], ["Pagamento", imp.pagamento_realizado ? "Cliente informou que pagou" : "Ainda não informado"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-[#F1F5F4] py-2 last:border-0"><span className="text-[#64748B]">{k}</span><b className="text-right">{v || "-"}</b></div>
                    ))}
                    {imp.observacoes && <div className="mt-2 rounded-xl bg-[#F7FAF9] p-3 text-[#475569]"><b className="text-[#64748B]">Observações:</b> {imp.observacoes}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 text-[13px] font-extrabold">Usuários <span className="ml-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] text-[#047857]">{imp.usuarios.length}</span></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12.5px]">
                        <thead className="text-[#64748B]"><tr><th className="py-1.5 font-bold">Nome</th><th className="font-bold">E-mail</th><th className="font-bold">Telefone</th><th className="font-bold">Perfil</th></tr></thead>
                        <tbody>{imp.usuarios.map((u) => <tr key={u.email} className="border-t border-[#F1F5F4]"><td className="py-2 font-bold">{u.nome}</td><td>{u.email}</td><td>{u.telefone || "-"}</td><td>{u.perfil}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
