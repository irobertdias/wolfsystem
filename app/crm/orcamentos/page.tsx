"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  CONFIGURACAO_PADRAO, MODULOS, PLANOS, PRECO_USUARIO, PRECO_WHATSAPP, brlOrc, calcularOrcamento, pctOrc,
  type Cobranca, type Implantacao, type ItemOrcamento,
} from "../../lib/orcamento";

type Orc = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string; usuarios_incluidos: number;
  mensalidade: number; configuracao: number; status: string; expira_em: string; visualizacoes: number;
  visualizado_em: string | null; aceito_em: string | null; implantacao: Implantacao | null; implantacao_em: string | null;
  itens: ItemOrcamento[]; created_at: string; link: string;
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
  enviado: ["Enviado", "bg-blue-50 text-blue-700 ring-blue-200"],
  visualizado: ["Visualizado", "bg-indigo-50 text-indigo-700 ring-indigo-200"],
  aceito: ["Aceito", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  expirado: ["Expirado", "bg-slate-100 text-slate-600 ring-slate-200"],
  cancelado: ["Cancelado", "bg-slate-100 text-slate-500 ring-slate-200"],
  recusado: ["Recusado", "bg-red-50 text-red-700 ring-red-200"],
};
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const rot = "mb-1 block text-[11px] font-semibold uppercase text-slate-500";
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
  if (whatsExtra) itens.push({ tipo: "whatsapp", id: "whatsapp", nome: plano ? "Conexões de WhatsApp adicionais" : "Conexões de WhatsApp", sub: "Números conectados ao atendimento", cor: "#16a34a", linhas: [], preco: PRECO_WHATSAPP, qtd: whatsExtra, desconto: d("whatsapp") });
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
    <form onSubmit={enviar} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="sm:col-span-2"><span className={rot}>Cliente</span><input className={inputCls} value={r.cliente_nome} onChange={(e) => setR({ ...r, cliente_nome: e.target.value })} /></label>
        <label><span className={rot}>WhatsApp do cliente</span><input className={inputCls} value={r.cliente_telefone} onChange={(e) => setR({ ...r, cliente_telefone: e.target.value })} /></label>
        {!editando && <label><span className={rot}>Validade (horas)</span><input className={inputCls} value={r.validade_horas} onChange={(e) => setR({ ...r, validade_horas: e.target.value })} /></label>}
      </div>

      {/* base */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">1. Base do orçamento</div>
        <div className="grid gap-2 sm:grid-cols-4">
          {[{ id: "avulso", nome: "Montar avulso", preco: 0, info: `Usuário ${brlOrc(PRECO_USUARIO)} · WhatsApp ${brlOrc(PRECO_WHATSAPP)}` }, ...PLANOS.map((p) => ({ id: p.id, nome: p.nome, preco: p.preco, info: `${p.usuarios} usuários · ${p.whatsapps} WhatsApp${p.whatsapps > 1 ? "s" : ""}` }))].map((b) => (
            <button type="button" key={b.id} onClick={() => setR((s) => {
              const p = PLANOS.find((x) => x.id === b.id);
              return { ...s, base: b.id, usuarios: p ? String(Math.max(inteiro(s.usuarios), p.usuarios)) : s.usuarios, whatsapps: p ? String(Math.max(inteiro(s.whatsapps), p.whatsapps)) : s.whatsapps };
            })}
              className={`rounded-xl border p-3 text-left transition ${r.base === b.id ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <div className="text-[13px] font-bold text-slate-800">{b.nome}</div>
              {b.preco > 0 && <div className="text-[15px] font-extrabold text-emerald-700">{brlOrc(b.preco)}<span className="text-[11px] font-normal text-slate-500">/mês</span></div>}
              <div className="text-[11px] text-slate-500">{b.info}</div>
            </button>
          ))}
        </div>
      </div>

      {/* quantidades */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">2. Usuários e conexões</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-xl border border-slate-200 p-3"><span className={rot}>Total de usuários</span><input className={inputCls} inputMode="numeric" value={r.usuarios} onChange={(e) => setR({ ...r, usuarios: e.target.value })} />
            <span className="mt-1 block text-[11px] text-slate-500">{plano ? `${plano.usuarios} no plano · ` : ""}{brlOrc(PRECO_USUARIO)} por usuário {plano ? "adicional" : ""}</span></label>
          <label className="rounded-xl border border-slate-200 p-3"><span className={rot}>Conexões de WhatsApp</span><input className={inputCls} inputMode="numeric" value={r.whatsapps} onChange={(e) => setR({ ...r, whatsapps: e.target.value })} />
            <span className="mt-1 block text-[11px] text-slate-500">{plano ? `${plano.whatsapps} no plano · ` : ""}{brlOrc(PRECO_WHATSAPP)} por conexão {plano ? "adicional" : ""}</span></label>
        </div>
      </div>

      {/* módulos */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">3. Módulos</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => {
            const noPlano = !!plano?.inclui.includes(m.id);
            const marcado = noPlano || r.modulos.includes(m.id);
            return (
              <button type="button" key={m.id} disabled={noPlano} onClick={() => setR((s) => ({ ...s, modulos: s.modulos.includes(m.id) ? s.modulos.filter((x) => x !== m.id) : [...s.modulos, m.id] }))}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${marcado ? "border-emerald-400 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-slate-300"} ${noPlano ? "cursor-default" : ""}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${marcado ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-slate-800">{m.nome}</span>
                  <span className="block text-[11px]" style={{ color: m.cor }}>{m.sub}</span>
                </span>
                <span className={`shrink-0 text-[12px] font-bold ${noPlano ? "text-emerald-600" : "text-slate-700"}`}>{noPlano ? "no plano" : brlOrc(m.preco)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* personalizados + configuração */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-700">4. Itens personalizados</span>
            <button type="button" onClick={() => setR((s) => ({ ...s, personalizados: [...s.personalizados, { nome: "", sub: "", linhas: "", preco: "0", cobranca: "mensal" }] }))} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">+ Adicionar item</button>
          </div>
          {r.personalizados.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-[12px] text-slate-400">Ex.: treinamento da equipe, integração específica.</div>}
          <div className="space-y-2">
            {r.personalizados.map((p, i) => {
              const up = (campo: Partial<Personalizado>) => setR((s) => ({ ...s, personalizados: s.personalizados.map((x, k) => (k === i ? { ...x, ...campo } : x)) }));
              return (
                <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_0.7fr_0.8fr_auto]">
                  <input className={inputCls} placeholder="Nome do item" value={p.nome} onChange={(e) => up({ nome: e.target.value })} />
                  <input className={inputCls} placeholder="Subtítulo" value={p.sub} onChange={(e) => up({ sub: e.target.value })} />
                  <input className={inputCls} placeholder="Preço R$" value={p.preco} onChange={(e) => up({ preco: e.target.value })} />
                  <select className={inputCls} value={p.cobranca} onChange={(e) => up({ cobranca: e.target.value as Cobranca })}><option value="mensal">Mensal</option><option value="unico">Único</option></select>
                  <button type="button" onClick={() => setR((s) => ({ ...s, personalizados: s.personalizados.filter((_, k) => k !== i) }))} className="text-[12px] text-red-500">Remover</button>
                  <textarea className={`${inputCls} sm:col-span-5`} rows={2} placeholder="Detalhes, um por linha (opcional)" value={p.linhas} onChange={(e) => up({ linhas: e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-bold text-slate-700">5. Configuração inicial</div>
          <label className="block rounded-xl border border-slate-200 p-3"><span className={rot}>Valor de tabela (pagamento único)</span><input className={inputCls} value={r.configuracao} onChange={(e) => setR({ ...r, configuracao: e.target.value })} /></label>
        </div>
      </div>

      {/* resumo com descontos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
          <span className="text-[13px] font-bold text-slate-700">6. Resumo e descontos</span>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-slate-500">Desconto em tudo</span>
            <input className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-right" placeholder="%" value={descGeral} onChange={(e) => setDescGeral(e.target.value)} />
            <button type="button" onClick={() => aplicarEmTodos(Math.min(100, Math.max(0, num(descGeral))))} className="rounded-lg bg-slate-800 px-2.5 py-1.5 font-semibold text-white">Aplicar</button>
            <span className="ml-2 text-slate-500">Fechar mensalidade em</span>
            <input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right" placeholder="R$" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
            <button type="button" onClick={fecharEm} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white">Ajustar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead className="text-[11px] uppercase text-slate-500"><tr className="border-b border-slate-100"><th className="px-4 py-2 text-left">Item</th><th className="px-2 text-right">Qtd</th><th className="px-2 text-right">Tabela</th><th className="px-2 text-center">Desconto</th><th className="px-4 text-right">Total</th></tr></thead>
            <tbody>
              {cobraveis.map((l) => {
                const k = chave(l);
                return (
                  <tr key={k} className="border-b border-slate-50">
                    <td className="px-4 py-2"><b className="text-slate-800">{l.nome}</b>{l.cobranca === "unico" && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">único</span>}</td>
                    <td className="px-2 text-right tabular-nums">{l.qtd}</td>
                    <td className="px-2 text-right tabular-nums text-slate-500">{brlOrc(l.bruto)}</td>
                    <td className="px-2 text-center">
                      <span className="inline-flex items-center gap-1"><input className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right" inputMode="decimal" value={r.descontos[k] ?? 0} onChange={(e) => setDesc(k, e.target.value)} /><span className="text-slate-400">%</span></span>
                    </td>
                    <td className="px-4 text-right font-bold tabular-nums">{brlOrc(l.liquido)}</td>
                  </tr>
                );
              })}
              {t.linhas.filter((l) => l.incluso).length > 0 && (
                <tr><td colSpan={5} className="px-4 py-2 text-[12px] text-slate-500">Inclusos no plano: {t.linhas.filter((l) => l.incluso).map((l) => l.nome.replace("Módulo ", "")).join(", ")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t border-slate-100 bg-white p-4 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-600 p-4 text-white">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Mensalidade</div>
            <div className="text-[26px] font-black tabular-nums">{brlOrc(t.mensal)}</div>
            <div className="text-[12px] opacity-90">Tabela {brlOrc(t.mensalTabela)}{t.mensalDesconto > 0 && ` · desconto ${brlOrc(t.mensalDesconto)} (${pctOrc((t.mensalDesconto / (t.mensalTabela || 1)) * 100)})`}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Pagamento único (configuração)</div>
            <div className="text-[26px] font-black tabular-nums text-slate-800">{brlOrc(t.unico)}</div>
            <div className="text-[12px] text-slate-500">Tabela {brlOrc(t.unicoTabela)}{t.unicoDesconto > 0 && ` · desconto ${brlOrc(t.unicoDesconto)}`} · {t.usuarios} usuários · {t.whatsapps} WhatsApp{t.whatsapps === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-slate-500">Pagamento: PIX Abc Call e Serviços (Nubank)</span>
        <div className="ml-auto flex gap-2">
          {onCancelar && <button type="button" onClick={onCancelar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[14px]">Cancelar</button>}
          <button disabled={salvando || !r.cliente_nome.trim() || t.usuarios < 1} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Gerar link do orçamento"}</button>
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

  async function criar(itens: ItemOrcamento[], r: Rascunho) {
    try {
      await api("/api/orcamentos", { method: "POST", body: JSON.stringify({ cliente_nome: r.cliente_nome, cliente_telefone: r.cliente_telefone, validade_horas: r.validade_horas, itens }) });
      setChaveNovo((k) => k + 1); await carregar();
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 text-slate-800">
      <div>
        <div className="text-[20px] font-extrabold">💼 Orçamentos</div>
        <div className="text-[13px] text-slate-500">Monte o orçamento com a tabela de preços, dê desconto por item, envie o link e acompanhe o aceite.</div>
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
            const [rotulo, cls] = STATUS[o.status] || STATUS.enviado;
            const imp = o.implantacao;
            const tot = calcularOrcamento(o.itens || []);
            const podeEditar = ["enviado", "visualizado", "expirado", "cancelado"].includes(o.status);
            const nomes = (o.itens || []).filter((it) => it.tipo !== "configuracao" && it.tipo !== "usuarios" && it.tipo !== "whatsapp" && it.nome !== "Plataforma Wolf System").map((it) => it.nome.replace("Módulo ", ""));
            return (
              <div key={o.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2"><b>{o.cliente_nome}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cls}`}>{rotulo}</span>{o.implantacao_em && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Dados recebidos</span>}{imp?.pagamento_realizado && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Diz que pagou</span>}</div>
                    <div className="text-[12px] text-slate-500">{o.numero} · {o.usuarios_incluidos} usuários{tot.whatsapps ? ` · ${tot.whatsapps} WhatsApp${tot.whatsapps > 1 ? "s" : ""}` : ""} · {brlOrc(o.configuracao)} agora + {brlOrc(o.mensalidade)}/mês{tot.mensalDesconto > 0 ? ` (tabela ${brlOrc(tot.mensalTabela)})` : ""}</div>
                    <div className="mt-1 flex flex-wrap gap-1">{nomes.map((n) => <span key={n} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{n}</span>)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {o.visualizacoes ? `Aberto ${o.visualizacoes}x` : "Ainda não aberto"}
                      {o.aceito_em ? ` · aceito em ${new Date(o.aceito_em).toLocaleString("pt-BR")}` : ` · válido até ${new Date(o.expira_em).toLocaleString("pt-BR")}`} · criado {new Date(o.created_at).toLocaleString("pt-BR")}
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
                    <Editor inicial={rascunhoDe(o)} editando onSalvar={(itens, r) => salvarEdicao(o.id, itens, r)} onCancelar={() => setEditando("")} />
                  </div>
                )}
                {imp && aberto === o.id && (
                  <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-4 text-[13px] lg:grid-cols-[1fr_1.6fr]">
                    <div className="space-y-1">
                      <div className="mb-1 text-[12px] font-bold uppercase text-slate-500">Empresa</div>
                      {[["Razão social", imp.razao_social], ["CNPJ/CPF", imp.cnpj], ["Responsável", imp.responsavel], ["E-mail", imp.email], ["Telefone", imp.telefone], ["WhatsApps do atendimento", (imp.whatsapps?.length ? imp.whatsapps : [imp.whatsapp_atendimento]).filter(Boolean).join(", ")], ["Pagamento", imp.pagamento_realizado ? "Cliente informou que pagou" : "Ainda não informado"]].map(([k, v]) => (
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
