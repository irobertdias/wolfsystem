"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  brl, calcularImovel, calcularVeiculo, formatarDocumento, normalizarImovel, normalizarVeiculo,
  pctBR, validarDados, type TipoRevisional,
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

const IMOVEL_VAZIO = { banco: "", valor_financiado: 0, prazo: "", pagas: "", atrasadas: "0", pausa: false, modalidade: "SAC", taxa_anual: "", data_contrato: "", saldo_devedor: 0, parcela_atual: 0, juros: 0, amortizacao: 0, tarifa_adm: 25, seguros: 0 };
const VEICULO_VAZIO = { banco: "", modelo: "", ano: "", data_contrato: "", valor_financiado: 0, parcela_atual: 0, prazo: "", pagas: "", atrasadas: "0" };

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
export function PainelRevisional({ embutido = false }: { embutido?: boolean }) {
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
  const [bloqueado, setBloqueado] = useState(false);

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
      setBloqueado(e.status === 403);
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

  const abas = (
    <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 text-[13px]">
      {([["nova", "Nova simulação"], ["lista", `Propostas (${propostas.length})`], ...(podeConfigurar ? [["config", "Configurações"]] : [])] as [typeof aba, string][]).map(([k, t]) => (
        <button key={k} onClick={() => setAba(k)} className={`rounded-lg px-3 py-1.5 font-medium ${aba === k ? "bg-white shadow-sm" : "text-slate-500"}`}>{t}</button>
      ))}
    </nav>
  );

  if (bloqueado) {
    return (
      <div className={`flex items-center justify-center p-6 ${embutido ? "min-h-[60vh]" : "min-h-screen bg-slate-50"}`}>
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-3xl">⚖️</div>
          <div className="mt-2 text-lg font-extrabold text-slate-800">Revisional</div>
          <p className="mt-2 text-sm text-slate-500">{erroAcesso}</p>
          <p className="mt-1 text-xs text-slate-400">Fale com o administrador do Wolf System para liberar o acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <main className={embutido ? "text-slate-800" : "min-h-screen bg-slate-50 text-slate-800"}>
      {embutido ? (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-5">
          <div>
            <div className="text-[18px] font-extrabold leading-tight">⚖️ Revisional</div>
            <div className="text-[12px] text-slate-500">Simule a revisão de juros e envie a proposta com link para o cliente</div>
          </div>
          {abas}
        </div>
      ) : (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">W</div>
              <div>
                <div className="text-[15px] font-extrabold leading-tight">Wolf Revisional</div>
                <div className="text-[11px] text-slate-500">Simulação e propostas de revisão de juros</div>
              </div>
            </div>
            {abas}
          </div>
        </header>
      )}

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
type TaxaBacen = { taxa_mensal: number; referencia: string; do_mes_do_contrato: boolean } | null;

function Secao({ n, titulo, sub, children }: { n: number; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-bold text-white">{n}</span>
        <div>
          <div className="text-[14px] font-bold text-slate-800">{titulo}</div>
          {sub && <div className="text-[12px] text-slate-500">{sub}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DinheiroAuto({ valor, auto, onChange }: { valor: number; auto?: number; onChange: (v: number) => void }) {
  const calculado = !valor && !!auto;
  return (
    <div className="relative">
      <input inputMode="numeric" className={`${inputCls} ${calculado ? "border-emerald-200 bg-emerald-50/40 pr-7 placeholder:font-semibold placeholder:text-emerald-700" : ""}`}
        value={valor ? brl(valor) : ""} placeholder={calculado ? brl(auto!) : "R$ 0,00"}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0) / 100)} />
      {calculado && <span title="Calculado automaticamente" className="pointer-events-none absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">⚡</span>}
    </div>
  );
}

function ComparaTaxas({ cobrada, media, ref, vezes }: { cobrada: number | null; media: number | null; ref?: string; vezes: number | null }) {
  if (!cobrada || !media) return null;
  const max = Math.max(cobrada, media) * 1.1;
  const acima = vezes != null && vezes > 1;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Juros do contrato × mercado</span>
        {vezes != null && <span className={`rounded-full px-2 py-0.5 text-[11px] normal-case ${acima ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{vezes.toLocaleString("pt-BR")}× a média</span>}
      </div>
      {[["Cobrada", cobrada, "bg-red-500"], [`Média BACEN${ref ? ` (${ref})` : ""}`, media, "bg-emerald-500"]].map(([k, v, cor]) => (
        <div key={k as string} className="mb-1.5">
          <div className="flex justify-between text-[12px]"><span className="text-slate-600">{k}</span><b>{pctBR(v as number)} a.m.</b></div>
          <div className="mt-0.5 h-2 rounded-full bg-white"><div className={`h-2 rounded-full ${cor}`} style={{ width: `${((v as number) / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function NovaSimulacao({ config, usuarioNome, onCriada }: { config: Config; usuarioNome: string; onCriada: () => void }) {
  const [tipo, setTipo] = useState<TipoRevisional>("imovel");
  const [cliente, setCliente] = useState({ nome: "", documento: "", telefone: "" });
  const [consultor, setConsultor] = useState(usuarioNome);
  const [imovel, setImovel] = useState<Record<string, any>>({ ...IMOVEL_VAZIO, percentual_correcao: config.percentual_imovel });
  const [veiculo, setVeiculo] = useState<Record<string, any>>({ ...VEICULO_VAZIO, metodo: "bacen", percentual_correcao: config.percentual_veiculo, taxa_corrigida: config.taxa_veiculo });
  const [validade, setValidade] = useState(config.validade_horas);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerada, setGerada] = useState<{ link: string; numero: string; expira_em: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [bacen, setBacen] = useState<{ imovel: TaxaBacen; veiculo: TaxaBacen }>({ imovel: null, veiculo: null });
  const [bacenErro, setBacenErro] = useState("");

  useEffect(() => { if (!consultor && usuarioNome) setConsultor(usuarioNome); }, [usuarioNome, consultor]);

  // Taxa média do Banco Central do mês do contrato (ou a última divulgada).
  const mesContrato = tipo === "imovel" ? String(imovel.data_contrato || "") : String(veiculo.data_contrato || "");
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/revisional/taxa-media?tipo=${tipo}${mesContrato ? `&mes=${mesContrato}` : ""}`);
        const d = await r.json();
        if (!ativo) return;
        if (!d.success) throw new Error(d.error);
        setBacenErro("");
        setBacen((b) => ({ ...b, [tipo]: { taxa_mensal: d.taxa_mensal, referencia: d.referencia, do_mes_do_contrato: d.do_mes_do_contrato } }));
        const extra = { taxa_media_mensal: d.taxa_mensal, taxa_media_ref: d.referencia };
        if (tipo === "imovel") setImovel((s) => ({ ...s, ...extra })); else setVeiculo((s) => ({ ...s, ...extra }));
      } catch (e: any) {
        if (ativo) setBacenErro(e.message || "Banco Central indisponível");
      }
    }, 300);
    return () => { ativo = false; clearTimeout(t); };
  }, [tipo, mesContrato]);

  const dadosImovel = useMemo(() => normalizarImovel(imovel), [imovel]);
  const dadosVeiculo = useMemo(() => normalizarVeiculo(veiculo), [veiculo]);
  const dados = tipo === "imovel" ? dadosImovel : dadosVeiculo;
  const pendencias = validarDados(tipo, dados);
  const resultado = useMemo(
    () => (tipo === "imovel" ? calcularImovel(dadosImovel) : calcularVeiculo(dadosVeiculo)),
    [tipo, dadosImovel, dadosVeiculo]
  ) as Record<string, any>;
  const auto = (campo: keyof typeof dadosImovel) => (dadosImovel.estimados.includes(campo as string) ? Number(dadosImovel[campo]) : undefined);

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
    setVeiculo({ ...VEICULO_VAZIO, metodo: "bacen", percentual_correcao: config.percentual_veiculo, taxa_corrigida: config.taxa_veiculo });
  }

  if (gerada) {
    const msg = mensagemCliente(cliente.nome, gerada.link, validade);
    return (
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg shadow-emerald-900/5">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-5 text-white">
          <div className="text-[12px] font-semibold uppercase tracking-wider opacity-80">Proposta nº {gerada.numero}</div>
          <div className="mt-1 text-xl font-extrabold">{cliente.nome}</div>
          <div className="text-[13px] opacity-80">Válida até {new Date(gerada.expira_em).toLocaleString("pt-BR")}</div>
        </div>
        <div className="p-6">
          <div className="flex gap-2">
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
      </div>
    );
  }

  const total = tipo === "imovel" ? resultado.diferenca_total : resultado.economia_total;
  const parcelaAtual = tipo === "imovel" ? dadosImovel.parcela_atual : dadosVeiculo.parcela_atual;
  const reducaoPct = parcelaAtual > 0 ? Math.round((1 - resultado.parcela_corrigida / parcelaAtual) * 100) : 0;
  const taxaInfo = bacen[tipo];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          {(["imovel", "veiculo"] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)} className={`rounded-xl px-4 py-3 text-[14px] font-semibold transition ${tipo === t ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "imovel" ? "🏠 Imobiliário" : "🚗 Veículo"}
            </button>
          ))}
        </div>

        <Secao n={1} titulo="Cliente">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome completo"><Texto valor={cliente.nome} onChange={(v) => setCliente((c) => ({ ...c, nome: v }))} /></Campo>
            <Campo rotulo="CPF/CNPJ"><Texto valor={cliente.documento} onChange={(v) => setCliente((c) => ({ ...c, documento: formatarDocumento(v.replace(/\D/g, "").slice(0, 14)) }))} inputMode="numeric" /></Campo>
            <Campo rotulo="WhatsApp" dica="Para enviar o link direto"><Texto valor={cliente.telefone} onChange={(v) => setCliente((c) => ({ ...c, telefone: v }))} inputMode="tel" placeholder="(62) 99999-9999" /></Campo>
            <Campo rotulo="Consultor"><Texto valor={consultor} onChange={setConsultor} /></Campo>
          </div>
        </Secao>

        {tipo === "imovel" ? (
          <>
            <Secao n={2} titulo="Contrato" sub="Com a taxa de juros, o sistema calcula sozinho saldo, juros, amortização e parcela.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Banco / Financeira"><Texto valor={imovel.banco} onChange={setI("banco")} placeholder="Caixa Econômica Federal" /></Campo>
                <Campo rotulo="Valor financiado"><Dinheiro valor={imovel.valor_financiado} onChange={setI("valor_financiado")} /></Campo>
                <Campo rotulo="Mês do contrato" dica="Busca a taxa média da época"><input type="month" className={inputCls} value={imovel.data_contrato || ""} onChange={(e) => setI("data_contrato")(e.target.value)} /></Campo>
                <Campo rotulo="Taxa de juros (% a.a.)" dica="Está no contrato"><Texto valor={imovel.taxa_anual || ""} onChange={setI("taxa_anual")} inputMode="decimal" placeholder="Ex.: 9,5" /></Campo>
                <Campo rotulo="Total de parcelas"><Texto valor={imovel.prazo} onChange={setI("prazo")} inputMode="numeric" /></Campo>
                <Campo rotulo="Parcelas pagas"><Texto valor={imovel.pagas} onChange={setI("pagas")} inputMode="numeric" /></Campo>
                <Campo rotulo="Modalidade">
                  <select className={inputCls} value={imovel.modalidade} onChange={(e) => setI("modalidade")(e.target.value)}><option>SAC</option><option>PRICE</option></select>
                </Campo>
                <Campo rotulo="Parcelas em atraso"><Texto valor={imovel.atrasadas} onChange={setI("atrasadas")} inputMode="numeric" /></Campo>
                <Campo rotulo="Contrato sofreu pausa?">
                  <select className={inputCls} value={imovel.pausa ? "s" : "n"} onChange={(e) => setI("pausa")(e.target.value === "s")}><option value="n">Não</option><option value="s">Sim</option></select>
                </Campo>
              </div>
            </Secao>
            <Secao n={3} titulo="Boleto e extrato" sub="Campos em verde foram calculados. Digite o valor real do boleto/extrato para substituir — é aí que aparece a cobrança indevida.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Saldo devedor (extrato)"><DinheiroAuto valor={imovel.saldo_devedor} auto={auto("saldo_devedor")} onChange={setI("saldo_devedor")} /></Campo>
                <Campo rotulo="Parcela atual (boleto)"><DinheiroAuto valor={imovel.parcela_atual} auto={auto("parcela_atual")} onChange={setI("parcela_atual")} /></Campo>
                <Campo rotulo="Juros da parcela"><DinheiroAuto valor={imovel.juros} auto={auto("juros")} onChange={setI("juros")} /></Campo>
                <Campo rotulo="Amortização da parcela"><DinheiroAuto valor={imovel.amortizacao} auto={auto("amortizacao")} onChange={setI("amortizacao")} /></Campo>
                <Campo rotulo="Tarifa administrativa"><Dinheiro valor={imovel.tarifa_adm} onChange={setI("tarifa_adm")} /></Campo>
                <Campo rotulo="Seguros (MIP + DFI)"><Dinheiro valor={imovel.seguros} onChange={setI("seguros")} /></Campo>
              </div>
            </Secao>
            <Secao n={4} titulo="Correção">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="% de redução da parcela"><Texto valor={imovel.percentual_correcao} onChange={setI("percentual_correcao")} inputMode="decimal" /></Campo>
              </div>
            </Secao>
          </>
        ) : (
          <>
            <Secao n={2} titulo="Contrato" sub="A taxa cobrada é descoberta sozinha pela parcela; a média vem do Banco Central.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Banco / Financeira"><Texto valor={veiculo.banco} onChange={setV("banco")} placeholder="Aymoré CFI S.A." /></Campo>
                <Campo rotulo="Modelo do veículo"><Texto valor={veiculo.modelo} onChange={setV("modelo")} /></Campo>
                <Campo rotulo="Ano"><Texto valor={veiculo.ano} onChange={setV("ano")} inputMode="numeric" /></Campo>
                <Campo rotulo="Mês do contrato" dica="Busca a taxa média da época"><input type="month" className={inputCls} value={veiculo.data_contrato || ""} onChange={(e) => setV("data_contrato")(e.target.value)} /></Campo>
                <Campo rotulo="Valor financiado"><Dinheiro valor={veiculo.valor_financiado} onChange={setV("valor_financiado")} /></Campo>
                <Campo rotulo="Parcela atual"><Dinheiro valor={veiculo.parcela_atual} onChange={setV("parcela_atual")} /></Campo>
                <Campo rotulo="Total de parcelas"><Texto valor={veiculo.prazo} onChange={setV("prazo")} inputMode="numeric" /></Campo>
                <Campo rotulo="Parcelas pagas"><Texto valor={veiculo.pagas} onChange={setV("pagas")} inputMode="numeric" /></Campo>
                <Campo rotulo="Parcelas em atraso"><Texto valor={veiculo.atrasadas} onChange={setV("atrasadas")} inputMode="numeric" /></Campo>
              </div>
            </Secao>
            <Secao n={3} titulo="Correção">
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="Como corrigir">
                  <select className={inputCls} value={veiculo.metodo} onChange={(e) => setV("metodo")(e.target.value)}>
                    <option value="bacen">Taxa média do Banco Central (automático)</option>
                    <option value="taxa">Taxa que eu informar</option>
                    <option value="percentual">% sobre a parcela</option>
                  </select>
                </Campo>
                {veiculo.metodo === "taxa" && <Campo rotulo="Taxa corrigida (% a.m.)"><Texto valor={veiculo.taxa_corrigida} onChange={setV("taxa_corrigida")} inputMode="decimal" /></Campo>}
                {veiculo.metodo === "percentual" && <Campo rotulo="% de redução da parcela"><Texto valor={veiculo.percentual_correcao} onChange={setV("percentual_correcao")} inputMode="decimal" /></Campo>}
                {veiculo.metodo === "bacen" && (
                  <div className="flex items-end sm:col-span-2">
                    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                      {taxaInfo ? <>Usando <b>{pctBR(taxaInfo.taxa_mensal)} a.m.</b> — média de {taxaInfo.referencia}{!taxaInfo.do_mes_do_contrato && mesContrato ? " (mês do contrato ainda não divulgado)" : ""}</> : bacenErro || "Buscando a taxa média…"}
                    </div>
                  </div>
                )}
              </div>
            </Secao>
          </>
        )}
      </div>

      {/* prévia */}
      <aside className="h-fit space-y-3 lg:sticky lg:top-4">
        <div className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-lg shadow-emerald-900/5">
          <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 px-5 pb-5 pt-4 text-white">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Prévia · {tipo === "imovel" ? "diferença total" : "economia total"}</div>
            <div className="mt-1 text-[34px] font-black leading-none tracking-tight">{brl(total)}</div>
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <span className="rounded-lg bg-white/15 px-2 py-1 line-through decoration-white/60">{brl(parcelaAtual)}</span>
              <span>→</span>
              <span className="rounded-lg bg-white px-2 py-1 font-bold text-emerald-700">{brl(resultado.parcela_corrigida)}</span>
              {reducaoPct > 0 && <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950">−{reducaoPct}%</span>}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <ComparaTaxas
              cobrada={tipo === "imovel" ? resultado.taxa_contratada_mensal : resultado.taxa_contratada}
              media={resultado.taxa_media_mensal}
              ref={taxaInfo?.referencia}
              vezes={resultado.vezes_media}
            />
            <div className="divide-y divide-slate-100 text-[13px]">
              {(tipo === "imovel"
                ? [["Amortizado", resultado.amortizado], ["Amortização corrigida", resultado.amortizacao_corrigida], ["Diferença da amortização", resultado.diferenca_amortizacao], ["Tarifas questionáveis", resultado.tarifas_questionaveis], ["Saldo devedor correto", resultado.saldo_correto], ["Economia no contrato", resultado.economia_total]]
                : [["Redução por parcela", resultado.reducao_parcela], [`Redução nas ${resultado.restantes} restantes`, resultado.reducao_total], ["Estorno das pagas", resultado.estorno]]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5"><span className="text-slate-500">{k}</span><b className="tabular-nums">{brl(v)}</b></div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Campo rotulo="Validade do link (horas)"><Texto valor={validade} onChange={(v) => setValidade(Number(v.replace(/\D/g, "")) || 0)} inputMode="numeric" /></Campo>
          {(pendencias.length > 0 || !cliente.nome.trim()) && (
            <ul className="mt-3 space-y-1 text-[12px] text-amber-700">
              {!cliente.nome.trim() && <li>• Informe o nome do cliente</li>}
              {pendencias.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          )}
          {erro && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{erro}</div>}
          <button disabled={gerando || pendencias.length > 0 || !cliente.nome.trim() || validade < 1} onClick={gerar}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-[14px] font-bold text-white shadow-md shadow-emerald-600/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
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
        <Campo rotulo="% correção padrão — veículo" dica="Usado quando o método escolhido é % sobre a parcela"><Texto valor={c.percentual_veiculo} onChange={set("percentual_veiculo")} inputMode="decimal" /></Campo>
        <Campo rotulo="Taxa corrigida padrão — veículo (% a.m.)"><Texto valor={c.taxa_veiculo} onChange={set("taxa_veiculo")} inputMode="decimal" /></Campo>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={salvar} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[14px] font-semibold text-white">Salvar</button>
        {msg && <span className="text-[13px] text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}
