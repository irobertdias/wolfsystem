"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  brl, calcularImovel, calcularVeiculo, formatarDocumento, normalizarImovel, normalizarVeiculo,
  validarDados, type TipoRevisional,
} from "../lib/revisional";

type Config = {
  empresa_nome: string; empresa_cnpj: string; whatsapp_contato: string; validade_horas: number;
  percentual_imovel: number; percentual_veiculo: number; taxa_veiculo: number; metodo_veiculo: "percentual" | "taxa";
};
type PropostaLista = {
  id: string; numero: string; tipo: TipoRevisional; status: string; cliente_nome: string; cliente_documento: string;
  cliente_telefone: string; consultor_nome: string; resultado: Record<string, number>; dados: Record<string, any>;
  expira_em: string; visualizada_em: string | null; visualizacoes: number; respondida_em: string | null;
  motivo_recusa: string | null; created_at: string; link: string;
};

const STATUS: Record<string, { rotulo: string; cls: string }> = {
  enviada: { rotulo: "Enviada", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  visualizada: { rotulo: "Visualizada", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  aceita: { rotulo: "Aceita", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  recusada: { rotulo: "Recusada", cls: "bg-red-50 text-red-700 border-red-200" },
  expirada: { rotulo: "Expirada", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelada: { rotulo: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const IMOVEL_VAZIO = { banco: "", valor_financiado: 0, prazo: "", pagas: "", atrasadas: "0", pausa: false, modalidade: "SAC", saldo_devedor: 0, parcela_atual: 0, juros: 0, amortizacao: 0, tarifa_adm: 25, seguros: 0 };
const VEICULO_VAZIO = { banco: "", modelo: "", ano: "", valor_financiado: 0, parcela_atual: 0, prazo: "", pagas: "", atrasadas: "0" };

async function api(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers || {}) },
  });
  const d = await r.json().catch(() => ({ success: false, error: "Resposta inválida" }));
  if (!r.ok || !d.success) throw Object.assign(new Error(d.error || "Erro"), { status: r.status });
  return d;
}

function restante(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirada";
  const h = Math.floor(ms / 3600_000), m = Math.floor((ms % 3600_000) / 60_000);
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h${String(m).padStart(2, "0")}`;
}

function linkWhats(telefone: string, texto: string) {
  const t = telefone.replace(/\D/g, "");
  const n = t ? (t.length <= 11 ? `55${t}` : t) : "";
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

function mensagemCliente(nome: string, link: string, horas: number) {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  return `Olá ${primeiro}! Finalizamos a análise do seu financiamento e identificamos cobranças indevidas. Sua proposta de revisão está pronta:\n\n${link}\n\n⚠️ Ela é válida por ${horas}h.`;
}

/* ---------- campos ---------- */
function Campo({ rotulo, children, dica }: { rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</span>
      {children}
      {dica && <span className="mt-0.5 block text-[10px] text-slate-400">{dica}</span>}
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function Dinheiro({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <input inputMode="numeric" className={inputCls} value={valor ? brl(valor) : ""} placeholder="R$ 0,00"
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0) / 100)} />
  );
}
function Texto({ valor, onChange, ...rest }: { valor: string | number; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return <input className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

/* ---------- página ---------- */
export default function RevisionalPainel() {
  const [sessao, setSessao] = useState<"carregando" | "sem" | "ok">("carregando");
  const [erroAcesso, setErroAcesso] = useState("");
  const [aba, setAba] = useState<"nova" | "lista" | "config">("nova");
  const [config, setConfig] = useState<Config | null>({
    empresa_nome: "", empresa_cnpj: "", whatsapp_contato: "", validade_horas: 24,
    percentual_imovel: 35, percentual_veiculo: 35, taxa_veiculo: 1.5, metodo_veiculo: "percentual",
  });
  const [podeConfigurar, setPodeConfigurar] = useState(false);
  const [propostas, setPropostas] = useState<PropostaLista[]>([]);
  const [usuarioNome, setUsuarioNome] = useState("");
  const [, setTique] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const d = await api("/api/revisional/propostas");
      setPropostas(d.propostas);
      setConfig(d.config);
      setPodeConfigurar(d.podeConfigurar);
      setUsuarioNome((n) => n || d.usuario?.nome || "");
      setErroAcesso("");
    } catch (e: any) {
      setErroAcesso(e.message);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessao(session ? "ok" : "sem");
      if (session) void carregar();
    });
  }, [carregar]);

  useEffect(() => {
    if (sessao !== "ok") return;
    const t = setInterval(() => { void carregar(); }, 30_000);
    const u = setInterval(() => setTique((x) => x + 1), 30_000);
    return () => { clearInterval(t); clearInterval(u); };
  }, [sessao, carregar]);

  if (sessao === "carregando") return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Carregando…</main>;
  if (sessao === "sem") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-xl font-extrabold text-slate-800">Wolf Revisional</div>
          <p className="mt-2 text-sm text-slate-500">Entre com seu usuário do Wolf System para simular e enviar propostas.</p>
          <a href="/login" className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white">Entrar</a>
        </div>
      </main>
    );
  }

  const contagem = propostas.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">W</div>
            <div>
              <div className="text-[15px] font-extrabold leading-tight">Wolf Revisional</div>
              <div className="text-[11px] text-slate-500">Simulação e propostas de revisão de juros</div>
            </div>
          </div>
          <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 text-[13px]">
            {([["nova", "Nova simulação"], ["lista", `Propostas (${propostas.length})`], ...(podeConfigurar ? [["config", "Configurações"]] : [])] as [typeof aba, string][]).map(([k, t]) => (
              <button key={k} onClick={() => setAba(k)} className={`rounded-lg px-3 py-1.5 font-medium ${aba === k ? "bg-white shadow-sm" : "text-slate-500"}`}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        {erroAcesso && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erroAcesso}</div>}
        {aba === "nova" && config && (
          <NovaSimulacao config={config} usuarioNome={usuarioNome} onCriada={() => void carregar()} />
        )}
        {aba === "lista" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {["enviada", "visualizada", "aceita", "recusada", "expirada"].map((s) => (
                <div key={s} className={`rounded-xl border px-3 py-2 ${STATUS[s].cls}`}>
                  <div className="text-[10px] font-semibold uppercase">{STATUS[s].rotulo}</div>
                  <div className="text-xl font-bold">{contagem[s] || 0}</div>
                </div>
              ))}
            </div>
            <ListaPropostas propostas={propostas} config={config} onMudou={() => void carregar()} />
          </>
        )}
        {aba === "config" && config && <Configuracoes config={config} onSalvo={(c) => setConfig(c)} />}
      </div>
    </main>
  );
}

/* ---------- nova simulação ---------- */
function NovaSimulacao({ config, usuarioNome, onCriada }: { config: Config; usuarioNome: string; onCriada: () => void }) {
  const [tipo, setTipo] = useState<TipoRevisional>("imovel");
  const [cliente, setCliente] = useState({ nome: "", documento: "", telefone: "" });
  const [consultor, setConsultor] = useState(usuarioNome);
  const [imovel, setImovel] = useState<Record<string, any>>({ ...IMOVEL_VAZIO, percentual_correcao: config.percentual_imovel });
  const [veiculo, setVeiculo] = useState<Record<string, any>>({ ...VEICULO_VAZIO, metodo: config.metodo_veiculo, percentual_correcao: config.percentual_veiculo, taxa_corrigida: config.taxa_veiculo });
  const [validade, setValidade] = useState(config.validade_horas);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerada, setGerada] = useState<{ link: string; numero: string; expira_em: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { if (!consultor && usuarioNome) setConsultor(usuarioNome); }, [usuarioNome, consultor]);

  const dados = tipo === "imovel" ? normalizarImovel(imovel) : normalizarVeiculo(veiculo);
  const pendencias = validarDados(tipo, dados);
  const resultado = useMemo(
    () => (tipo === "imovel" ? calcularImovel(normalizarImovel(imovel)) : calcularVeiculo(normalizarVeiculo(veiculo))),
    [tipo, imovel, veiculo]
  ) as Record<string, any>;

  const setI = (k: string) => (v: any) => setImovel((s) => ({ ...s, [k]: v }));
  const setV = (k: string) => (v: any) => setVeiculo((s) => ({ ...s, [k]: v }));

  async function gerar() {
    setErro(""); setGerando(true);
    try {
      const d = await api("/api/revisional/propostas", {
        method: "POST",
        body: JSON.stringify({
          tipo, cliente_nome: cliente.nome, cliente_documento: cliente.documento, cliente_telefone: cliente.telefone,
          consultor_nome: consultor, dados: tipo === "imovel" ? imovel : veiculo, validade_horas: validade,
        }),
      });
      setGerada(d.proposta);
      onCriada();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  function novaSimulacao() {
    setGerada(null); setCopiado(false);
    setCliente({ nome: "", documento: "", telefone: "" });
    setImovel({ ...IMOVEL_VAZIO, percentual_correcao: config.percentual_imovel });
    setVeiculo({ ...VEICULO_VAZIO, metodo: config.metodo_veiculo, percentual_correcao: config.percentual_veiculo, taxa_corrigida: config.taxa_veiculo });
  }

  if (gerada) {
    const msg = mensagemCliente(cliente.nome, gerada.link, validade);
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="text-[13px] font-semibold uppercase text-emerald-600">Proposta nº {gerada.numero} gerada</div>
        <div className="mt-1 text-lg font-bold">{cliente.nome}</div>
        <div className="text-[13px] text-slate-500">Válida até {new Date(gerada.expira_em).toLocaleString("pt-BR")}</div>
        <div className="mt-4 flex gap-2">
          <input readOnly value={gerada.link} className={`${inputCls} font-mono text-[12px]`} onFocus={(e) => e.target.select()} />
          <button onClick={async () => { await navigator.clipboard.writeText(gerada.link); setCopiado(true); }} className="shrink-0 rounded-lg border border-slate-200 px-3 text-[13px] font-medium">{copiado ? "Copiado ✓" : "Copiar"}</button>
        </div>
        <textarea readOnly value={msg} rows={6} className={`${inputCls} mt-3 text-[13px]`} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={linkWhats(cliente.telefone, msg)} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 py-3 text-center text-[14px] font-semibold text-white">Enviar no WhatsApp</a>
          <a href={gerada.link} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 py-3 text-center text-[14px] font-semibold">Ver como o cliente</a>
        </div>
        <button onClick={novaSimulacao} className="mt-4 w-full text-[13px] text-slate-500 underline">Fazer nova simulação</button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["imovel", "veiculo"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-xl border px-4 py-3 text-[14px] font-semibold ${tipo === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {t === "imovel" ? "🏠 Financiamento imobiliário" : "🚗 Financiamento de veículo"}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">Cliente</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome completo"><Texto valor={cliente.nome} onChange={(v) => setCliente((c) => ({ ...c, nome: v }))} /></Campo>
            <Campo rotulo="CPF/CNPJ"><Texto valor={cliente.documento} onChange={(v) => setCliente((c) => ({ ...c, documento: formatarDocumento(v.replace(/\D/g, "").slice(0, 14)) }))} inputMode="numeric" /></Campo>
            <Campo rotulo="WhatsApp" dica="Para enviar o link direto"><Texto valor={cliente.telefone} onChange={(v) => setCliente((c) => ({ ...c, telefone: v }))} inputMode="tel" placeholder="(62) 99999-9999" /></Campo>
            <Campo rotulo="Consultor"><Texto valor={consultor} onChange={setConsultor} /></Campo>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">Dados do contrato</div>
          {tipo === "imovel" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Banco / Financeira"><Texto valor={imovel.banco} onChange={setI("banco")} placeholder="Caixa Econômica Federal" /></Campo>
              <Campo rotulo="Valor financiado"><Dinheiro valor={imovel.valor_financiado} onChange={setI("valor_financiado")} /></Campo>
              <Campo rotulo="Saldo devedor"><Dinheiro valor={imovel.saldo_devedor} onChange={setI("saldo_devedor")} /></Campo>
              <Campo rotulo="Total de parcelas"><Texto valor={imovel.prazo} onChange={setI("prazo")} inputMode="numeric" /></Campo>
              <Campo rotulo="Parcelas pagas"><Texto valor={imovel.pagas} onChange={setI("pagas")} inputMode="numeric" /></Campo>
              <Campo rotulo="Parcelas em atraso"><Texto valor={imovel.atrasadas} onChange={setI("atrasadas")} inputMode="numeric" /></Campo>
              <Campo rotulo="Modalidade">
                <select className={inputCls} value={imovel.modalidade} onChange={(e) => setI("modalidade")(e.target.value)}><option>SAC</option><option>PRICE</option></select>
              </Campo>
              <Campo rotulo="Contrato sofreu pausa?">
                <select className={inputCls} value={imovel.pausa ? "s" : "n"} onChange={(e) => setI("pausa")(e.target.value === "s")}><option value="n">Não</option><option value="s">Sim</option></select>
              </Campo>
              <Campo rotulo="Parcela atual"><Dinheiro valor={imovel.parcela_atual} onChange={setI("parcela_atual")} /></Campo>
              <Campo rotulo="Juros (da parcela)"><Dinheiro valor={imovel.juros} onChange={setI("juros")} /></Campo>
              <Campo rotulo="Amortização (da parcela)"><Dinheiro valor={imovel.amortizacao} onChange={setI("amortizacao")} /></Campo>
              <Campo rotulo="Tarifa administrativa"><Dinheiro valor={imovel.tarifa_adm} onChange={setI("tarifa_adm")} /></Campo>
              <Campo rotulo="Seguros"><Dinheiro valor={imovel.seguros} onChange={setI("seguros")} /></Campo>
              <Campo rotulo="% de correção da parcela" dica="Redução aplicada à parcela atual"><Texto valor={imovel.percentual_correcao} onChange={setI("percentual_correcao")} inputMode="decimal" /></Campo>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Banco / Financeira"><Texto valor={veiculo.banco} onChange={setV("banco")} placeholder="Aymoré CFI S.A." /></Campo>
              <Campo rotulo="Modelo do veículo"><Texto valor={veiculo.modelo} onChange={setV("modelo")} /></Campo>
              <Campo rotulo="Ano"><Texto valor={veiculo.ano} onChange={setV("ano")} inputMode="numeric" /></Campo>
              <Campo rotulo="Valor financiado"><Dinheiro valor={veiculo.valor_financiado} onChange={setV("valor_financiado")} /></Campo>
              <Campo rotulo="Parcela atual"><Dinheiro valor={veiculo.parcela_atual} onChange={setV("parcela_atual")} /></Campo>
              <Campo rotulo="Total de parcelas"><Texto valor={veiculo.prazo} onChange={setV("prazo")} inputMode="numeric" /></Campo>
              <Campo rotulo="Parcelas pagas"><Texto valor={veiculo.pagas} onChange={setV("pagas")} inputMode="numeric" /></Campo>
              <Campo rotulo="Parcelas em atraso"><Texto valor={veiculo.atrasadas} onChange={setV("atrasadas")} inputMode="numeric" /></Campo>
              <Campo rotulo="Método de correção">
                <select className={inputCls} value={veiculo.metodo} onChange={(e) => setV("metodo")(e.target.value)}>
                  <option value="percentual">% sobre a parcela</option>
                  <option value="taxa">Recalcular pela taxa (PRICE)</option>
                </select>
              </Campo>
              {veiculo.metodo === "taxa"
                ? <Campo rotulo="Taxa corrigida (% a.m.)" dica="Ex.: taxa média de mercado"><Texto valor={veiculo.taxa_corrigida} onChange={setV("taxa_corrigida")} inputMode="decimal" /></Campo>
                : <Campo rotulo="% de correção da parcela"><Texto valor={veiculo.percentual_correcao} onChange={setV("percentual_correcao")} inputMode="decimal" /></Campo>}
            </div>
          )}
        </div>
      </div>

      {/* prévia */}
      <aside className="h-fit space-y-3 lg:sticky lg:top-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prévia do resultado</div>
          <div className="mt-2 text-[11px] uppercase text-slate-400">{tipo === "imovel" ? "Diferença total" : "Economia total"}</div>
          <div className="text-[30px] font-extrabold text-emerald-600">{brl(tipo === "imovel" ? resultado.diferenca_total : resultado.economia_total)}</div>
          <div className="mt-2 divide-y divide-slate-100 text-[13px]">
            {(tipo === "imovel"
              ? [["Parcela corrigida", resultado.parcela_corrigida], ["Amortizado", resultado.amortizado], ["Amortização corrigida", resultado.amortizacao_corrigida], ["Diferença amortização", resultado.diferenca_amortizacao], ["Tarifas questionáveis", resultado.tarifas_questionaveis], ["Saldo devedor correto", resultado.saldo_correto], ["Diferença/parcela", resultado.diferenca_parcela], ["Economia total contrato", resultado.economia_total]]
              : [["Parcela corrigida", resultado.parcela_corrigida], ["Redução por parcela", resultado.reducao_parcela], ["Redução total", resultado.reducao_total], ["Estorno", resultado.estorno]]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5"><span className="text-slate-500">{k}</span><b>{brl(v)}</b></div>
            ))}
            {tipo === "veiculo" && resultado.taxa_contratada != null && (
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Taxa cobrada (estim.)</span><b className="text-red-600">{resultado.taxa_contratada.toLocaleString("pt-BR")}% a.m.</b></div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Campo rotulo="Validade do link (horas)"><Texto valor={validade} onChange={(v) => setValidade(Number(v.replace(/\D/g, "")) || 0)} inputMode="numeric" /></Campo>
          {(pendencias.length > 0 || !cliente.nome.trim()) && (
            <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[12px] text-amber-700">
              {!cliente.nome.trim() && <li>Informe o nome do cliente</li>}
              {pendencias.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {erro && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{erro}</div>}
          <button disabled={gerando || pendencias.length > 0 || !cliente.nome.trim() || validade < 1} onClick={gerar}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            {gerando ? "Gerando…" : "Gerar proposta e link"}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ---------- lista ---------- */
function ListaPropostas({ propostas, config, onMudou }: { propostas: PropostaLista[]; config: Config | null; onMudou: () => void }) {
  const [filtro, setFiltro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const lista = propostas.filter((p) => !filtro || `${p.cliente_nome} ${p.cliente_documento} ${p.numero}`.toLowerCase().includes(filtro.toLowerCase()));

  async function acao(p: PropostaLista, a: "cancelar" | "renovar") {
    if (a === "cancelar" && !confirm(`Cancelar a proposta de ${p.cliente_nome}? O link deixa de funcionar.`)) return;
    setOcupado(p.id);
    try {
      await api(`/api/revisional/propostas/${p.id}`, { method: "PATCH", body: JSON.stringify({ acao: a }) });
      onMudou();
    } catch (e: any) { alert(e.message); } finally { setOcupado(""); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <input className={inputCls} placeholder="Buscar por cliente, CPF ou nº da proposta" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      {lista.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Nenhuma proposta ainda.</div>}
      <div className="divide-y divide-slate-100">
        {lista.map((p) => {
          const st = STATUS[p.status] || STATUS.enviada;
          const total = p.tipo === "imovel" ? p.resultado.diferenca_total : p.resultado.economia_total;
          const aberta = p.status === "enviada" || p.status === "visualizada";
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.cliente_nome}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${st.cls}`}>{st.rotulo}</span>
                </div>
                <div className="text-[12px] text-slate-500">
                  {p.tipo === "imovel" ? "Imóvel" : "Veículo"} · {p.dados?.banco} · nº {p.numero} · {p.consultor_nome} · {new Date(p.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-[11px] text-slate-400">
                  {p.visualizacoes > 0 ? `Aberta ${p.visualizacoes}x (1ª em ${new Date(p.visualizada_em!).toLocaleString("pt-BR")})` : "Ainda não aberta"}
                  {aberta && ` · expira em ${restante(p.expira_em)}`}
                  {p.respondida_em && ` · respondida em ${new Date(p.respondida_em).toLocaleString("pt-BR")}`}
                  {p.motivo_recusa && ` · motivo: ${p.motivo_recusa}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold text-emerald-600">{brl(total)}</div>
                <div className="text-[11px] text-slate-400">parcela {brl(p.dados?.parcela_atual)} → {brl(p.resultado.parcela_corrigida)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                <button onClick={() => navigator.clipboard.writeText(p.link)} className="rounded-lg border border-slate-200 px-2.5 py-1.5">Copiar link</button>
                <a href={linkWhats(p.cliente_telefone, mensagemCliente(p.cliente_nome, p.link, Math.max(1, Math.round((new Date(p.expira_em).getTime() - Date.now()) / 3600_000))))} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-emerald-700">WhatsApp</a>
                <a href={p.link} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2.5 py-1.5">Abrir</a>
                {(p.status === "expirada" || p.status === "cancelada" || aberta) && (
                  <button disabled={ocupado === p.id} onClick={() => acao(p, "renovar")} className="rounded-lg border border-slate-200 px-2.5 py-1.5" title={`Mais ${config?.validade_horas || 24}h a partir de agora`}>Renovar</button>
                )}
                {aberta && <button disabled={ocupado === p.id} onClick={() => acao(p, "cancelar")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-600">Cancelar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- configurações ---------- */
function Configuracoes({ config, onSalvo }: { config: Config; onSalvo: (c: Config) => void }) {
  const [c, setC] = useState<Record<string, any>>({ ...config });
  const [msg, setMsg] = useState("");
  const set = (k: string) => (v: any) => setC((s) => ({ ...s, [k]: v }));
  async function salvar() {
    setMsg("");
    try {
      const d = await api("/api/revisional/config", { method: "PUT", body: JSON.stringify(c) });
      onSalvo(d.config); setMsg("Salvo ✓");
    } catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Empresa (aparece na proposta)"><Texto valor={c.empresa_nome} onChange={set("empresa_nome")} /></Campo>
        <Campo rotulo="CNPJ"><Texto valor={c.empresa_cnpj} onChange={set("empresa_cnpj")} /></Campo>
        <Campo rotulo="WhatsApp de contato" dica="Botão após o cliente aceitar"><Texto valor={c.whatsapp_contato} onChange={set("whatsapp_contato")} /></Campo>
        <Campo rotulo="Validade padrão do link (horas)"><Texto valor={c.validade_horas} onChange={set("validade_horas")} inputMode="numeric" /></Campo>
        <Campo rotulo="% correção padrão — imóvel"><Texto valor={c.percentual_imovel} onChange={set("percentual_imovel")} inputMode="decimal" /></Campo>
        <Campo rotulo="Método padrão — veículo">
          <select className={inputCls} value={c.metodo_veiculo} onChange={(e) => set("metodo_veiculo")(e.target.value)}>
            <option value="percentual">% sobre a parcela</option><option value="taxa">Recalcular pela taxa</option>
          </select>
        </Campo>
        <Campo rotulo="% correção padrão — veículo"><Texto valor={c.percentual_veiculo} onChange={set("percentual_veiculo")} inputMode="decimal" /></Campo>
        <Campo rotulo="Taxa corrigida padrão — veículo (% a.m.)"><Texto valor={c.taxa_veiculo} onChange={set("taxa_veiculo")} inputMode="decimal" /></Campo>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={salvar} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[14px] font-semibold text-white">Salvar</button>
        {msg && <span className="text-[13px] text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
