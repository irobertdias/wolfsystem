"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  brl, calcularImovel, calcularVeiculo, formatarDocumento, normalizarImovel, normalizarVeiculo,
  pctBR, validarDados, type TipoRevisional,
} from "../lib/revisional";
import { baixarPdfProposta } from "../lib/revisional-pdf";
import Icone from "../components/a2/Icone";

type Config = {
  empresa_nome: string; empresa_cnpj: string; whatsapp_contato: string; validade_horas: number;
  percentual_imovel: number; percentual_veiculo: number; taxa_veiculo: number; metodo_veiculo: "percentual" | "taxa";
};
type PropostaLista = {
  id: string; numero: string; tipo: TipoRevisional; status: string; cliente_nome: string; cliente_documento: string;
  cliente_telefone: string; consultor_nome: string; resultado: Record<string, number>; dados: Record<string, any>;
  expira_em: string; visualizada_em: string | null; visualizacoes: number; respondida_em: string | null;
  motivo_recusa: string | null; created_at: string; link: string; empresa?: { nome?: string; cnpj?: string };
};

const STATUS: Record<string, { rotulo: string; cls: string; ponto: string }> = {
  enviada: { rotulo: "Enviada", cls: "bg-[#F1F5F9] text-[#334155]", ponto: "#64748B" },
  visualizada: { rotulo: "Visualizada", cls: "bg-[#FFF7ED] text-[#C2410C]", ponto: "#F97316" },
  aceita: { rotulo: "Aceita", cls: "bg-[#ECFDF5] text-[#047857]", ponto: "#10B981" },
  recusada: { rotulo: "Recusada", cls: "bg-[#FEF2F2] text-[#B91C1C]", ponto: "#EF4444" },
  expirada: { rotulo: "Expirada", cls: "bg-[#F3F6F5] text-[#64748B]", ponto: "#94A3B8" },
  cancelada: { rotulo: "Cancelada", cls: "bg-[#F3F6F5] text-[#94A3B8]", ponto: "#CBD5E1" },
};

// A2: cartão branco com sombra suave.
const cartaoCls = "rounded-[20px] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_32px_-18px_rgba(16,24,40,.2)]";
const botaoSec = "inline-flex items-center gap-1.5 rounded-[10px] bg-[#F3F6F5] px-3 py-2 text-[12.5px] font-bold text-[#334155] transition hover:bg-[#E6ECEA] disabled:opacity-50";

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
  return `Olá ${primeiro}! Finalizamos a análise do seu financiamento e identificamos cobranças indevidas. Sua análise contratual está pronta:\n\n${link}\n\n⚠️ Ela é válida por ${horas}h.`;
}

/* ---------- campos ---------- */
function Campo({ rotulo, children, dica }: { rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold text-[#64748B]">{rotulo}</span>
      {children}
      {dica && <span className="text-[11px] text-[#94A3B8]">{dica}</span>}
    </label>
  );
}
const inputCls = "h-11 w-full rounded-xl border border-[#E6ECEA] bg-[#F7FAF9] px-3.5 text-[14px] font-semibold text-[#0F172A] outline-none placeholder:font-medium placeholder:text-[#94A3B8]";

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

  if (sessao === "carregando") return <main className="flex min-h-screen items-center justify-center bg-[#F3F6F5] text-[#64748B]">Carregando…</main>;
  if (sessao === "sem") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3F6F5] p-6">
        <div className={`${cartaoCls} max-w-sm p-7 text-center`}>
          <div className="flex justify-center"><LogoW /></div>
          <div className="mt-3 text-xl font-extrabold text-[#0F172A]">Análise contratual</div>
          <p className="mt-2 text-sm text-[#64748B]">Entre com seu usuário do Wolf System para simular e enviar propostas.</p>
          <a href="/login" className="mt-5 inline-block rounded-xl bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] px-7 py-3 text-sm font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(5,150,105,.8)]">Entrar</a>
        </div>
      </main>
    );
  }

  const contagem = propostas.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});

  const abas = (
    <nav className="ml-auto flex gap-1 rounded-[13px] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,.05),0_6px_16px_-10px_rgba(16,24,40,.2)]">
      {([["nova", "Nova simulação"], ["lista", "Propostas"], ...(podeConfigurar ? [["config", "Configurações"]] : [])] as [typeof aba, string][]).map(([k, t]) => (
        <button key={k} onClick={() => setAba(k)}
          className={`flex items-center gap-1.5 rounded-[9px] px-[15px] py-[9px] text-[13px] transition ${aba === k ? "bg-[#059669] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(5,150,105,.7)]" : "font-semibold text-[#475569] hover:bg-[#F3F6F5]"}`}>
          {t}
          {k === "lista" && <span className={`rounded-full px-1.5 text-[11px] font-extrabold ${aba === k ? "bg-white/20 text-white" : "bg-[#ECFDF5] text-[#047857]"}`}>{propostas.length}</span>}
        </button>
      ))}
    </nav>
  );

  if (bloqueado) {
    return (
      <div className={`flex items-center justify-center p-6 ${embutido ? "min-h-[60vh]" : "min-h-screen bg-[#F3F6F5]"}`}>
        <div className={`${cartaoCls} max-w-md p-7 text-center`}>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#059669]"><Icone nome="balanca" tamanho={22} /></span>
          <div className="mt-3 text-lg font-extrabold text-[#0F172A]">Análise contratual</div>
          <p className="mt-2 text-sm text-[#64748B]">{erroAcesso}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Fale com o administrador do Wolf System para liberar o acesso.</p>
        </div>
      </div>
    );
  }

  return (
    <main className={embutido ? "text-[#0F172A]" : "min-h-screen bg-[#F3F6F5] text-[#0F172A]"}>
      <div className={`mx-auto flex max-w-[1360px] flex-col gap-[22px] px-4 sm:px-7 ${embutido ? "pb-7 pt-5" : "py-5"}`}>
        {!embutido && (
          <header className="flex items-center gap-2.5 rounded-[18px] bg-white px-[18px] py-2.5 shadow-[0_1px_2px_rgba(16,24,40,.05),0_12px_32px_-12px_rgba(16,24,40,.14)]">
            <LogoW />
            <span className="text-[16px] font-extrabold tracking-tight">Wolf System</span>
            {usuarioNome && (
              <div className="ml-auto flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] text-[13px] font-extrabold text-[#065F46]">{iniciais(usuarioNome)}</div>
                <span className="hidden text-[13px] font-bold sm:block">{usuarioNome}</span>
              </div>
            )}
          </header>
        )}

        <section className="flex flex-wrap items-end gap-4 px-1 pt-1">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-[30px] font-extrabold tracking-[-.02em]">Análise contratual</h1>
            <span className="text-[14px] text-[#64748B]">Simule, compare com a taxa do Banco Central e envie a proposta por link</span>
          </div>
          {abas}
        </section>

        {erroAcesso && <div className="rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">{erroAcesso}</div>}
        {aba === "nova" && config && (
          <NovaSimulacao config={config} usuarioNome={usuarioNome} onCriada={() => void carregar()} />
        )}
        {aba === "lista" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {["enviada", "visualizada", "aceita", "recusada", "expirada"].map((s) => (
                <div key={s} className={`${cartaoCls} flex flex-col gap-1 px-[18px] py-4`}>
                  <span className="flex items-center gap-2 text-[12.5px] font-bold text-[#64748B]"><span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].ponto }} />{STATUS[s].rotulo}</span>
                  <span className="text-[26px] font-extrabold tracking-tight">{contagem[s] || 0}</span>
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

function LogoW() {
  return <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#059669] to-[#065F46] text-[16px] font-extrabold text-white shadow-[0_6px_14px_-4px_rgba(5,150,105,.55)]">W</div>;
}
function iniciais(t: string) {
  const p = t.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

function Secao({ n, titulo, sub, extra, children }: { n: number; titulo: string; sub?: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`${cartaoCls} flex flex-col gap-4 p-[22px]`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[#059669] text-[12px] font-extrabold text-white">{n}</span>
        <h2 className="m-0 text-[16px] font-extrabold">{titulo}</h2>
        {extra && <span className="ml-auto">{extra}</span>}
        {sub && <p className="m-0 basis-full text-[12.5px] text-[#64748B]">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function DinheiroAuto({ valor, auto, onChange }: { valor: number; auto?: number; onChange: (v: number) => void }) {
  const calculado = !valor && !!auto;
  return (
    <div className="relative">
      <input inputMode="numeric" className={`${inputCls} ${calculado ? "!border-[#A7F3D0] !bg-[#ECFDF5] pr-9 placeholder:font-bold placeholder:text-[#065F46]" : ""}`}
        value={valor ? brl(valor) : ""} placeholder={calculado ? brl(auto!) : "R$ 0,00"}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0) / 100)} />
      {calculado && <span title="Calculado automaticamente" className="pointer-events-none absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md bg-[#10B981] text-white"><Icone nome="raio" tamanho={12} /></span>}
    </div>
  );
}

function ComparaTaxas({ cobrada, media, ref, vezes }: { cobrada: number | null; media: number | null; ref?: string; vezes: number | null }) {
  if (!cobrada || !media) return null;
  const max = Math.max(cobrada, media) * 1.1;
  const acima = vezes != null && vezes > 1;
  return (
    <div className={`${cartaoCls} flex flex-col gap-3.5 px-[22px] py-5`}>
      <div className="flex items-center">
        <span className="text-[14px] font-extrabold">Juros × mercado</span>
        {vezes != null && <span className={`ml-auto rounded-full px-2.5 py-[3px] text-[12px] font-extrabold ${acima ? "bg-[#FEF2F2] text-[#B91C1C]" : "bg-[#ECFDF5] text-[#047857]"}`}>{vezes.toLocaleString("pt-BR")}× a média</span>}
      </div>
      {([["Cobrada no contrato", cobrada, "from-[#F87171] to-[#DC2626]", "text-[#DC2626]"], [`Média do Banco Central${ref ? ` (${ref})` : ""}`, media, "from-[#34D399] to-[#059669]", "text-[#047857]"]] as const).map(([k, v, cor, txt]) => (
        <div key={k} className="flex flex-col gap-1.5">
          <div className="flex text-[13px]"><span className="text-[#475569]">{k}</span><b className={`ml-auto ${txt}`}>{pctBR(v)} a.m.</b></div>
          <div className="h-2.5 rounded-full bg-[#F1F5F4]"><div className={`h-2.5 rounded-full bg-gradient-to-r ${cor}`} style={{ width: `${(v / max) * 100}%` }} /></div>
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
      <div className={`${cartaoCls} mx-auto w-full max-w-xl overflow-hidden`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#10B981] via-[#059669] to-[#065F46] px-[26px] py-6 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-white/10" />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-bold"><Icone nome="check" tamanho={13} /> Proposta nº {gerada.numero} gerada</span>
          <div className="relative mt-3 text-[24px] font-extrabold tracking-tight">{cliente.nome}</div>
          <div className="relative text-[13px] text-white/80">Válida até {new Date(gerada.expira_em).toLocaleString("pt-BR")}</div>
        </div>
        <div className="flex flex-col gap-3 p-[22px]">
          <div className="flex gap-2">
            <input readOnly value={gerada.link} className={`${inputCls} font-mono !text-[12px]`} onFocus={(e) => e.target.select()} />
            <button onClick={async () => { await navigator.clipboard.writeText(gerada.link); setCopiado(true); }} className={`${botaoSec} shrink-0 !px-4`}><Icone nome={copiado ? "check" : "copiar"} tamanho={14} />{copiado ? "Copiado" : "Copiar"}</button>
          </div>
          <textarea readOnly value={msg} rows={6} className={`${inputCls} !h-auto py-3 !text-[13px] !font-medium leading-relaxed`} />
          <div className="grid grid-cols-2 gap-2">
            <a href={linkWhats(cliente.telefone, msg)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-[14px] bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] py-3.5 text-[14px] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(5,150,105,.8)]"><Icone nome="whatsapp" tamanho={16} />Enviar no WhatsApp</a>
            <a href={gerada.link} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-[14px] bg-[#F3F6F5] py-3.5 text-[14px] font-bold text-[#334155]"><Icone nome="olho" tamanho={16} />Ver como o cliente</a>
          </div>
          <button onClick={novaSimulacao} className="mt-1 text-[13px] font-bold text-[#047857] hover:underline">Fazer nova simulação</button>
        </div>
      </div>
    );
  }

  const total = tipo === "imovel" ? resultado.diferenca_total : resultado.economia_total;
  const parcelaAtual = tipo === "imovel" ? dadosImovel.parcela_atual : dadosVeiculo.parcela_atual;
  const reducaoPct = parcelaAtual > 0 ? Math.round((1 - resultado.parcela_corrigida / parcelaAtual) * 100) : 0;
  const taxaInfo = bacen[tipo];
  const pilulaBacen = taxaInfo
    ? <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[12px] font-bold text-[#047857]">Taxa média BACEN {taxaInfo.referencia}: {pctBR(taxaInfo.taxa_mensal)} a.m.</span>
    : bacenErro ? <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[12px] font-bold text-[#C2410C]">{bacenErro}</span> : null;

  return (
    <div className="grid items-start gap-[22px] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex flex-col gap-[18px]">
        <div role="group" aria-label="Tipo de financiamento" className="grid grid-cols-2 gap-3">
          {(["imovel", "veiculo"] as const).map((t) => {
            const sel = tipo === t;
            return (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex items-center gap-3 rounded-2xl bg-white px-[18px] py-4 text-left transition ${sel ? "shadow-[0_10px_24px_-14px_rgba(5,150,105,.5)] outline outline-2 outline-[#059669]" : "shadow-[0_1px_2px_rgba(16,24,40,.05),0_8px_20px_-14px_rgba(16,24,40,.2)] hover:shadow-[0_1px_2px_rgba(16,24,40,.05),0_12px_24px_-14px_rgba(16,24,40,.3)]"}`}>
                <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl ${sel ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#F3F6F5] text-[#475569]"}`}>
                  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {t === "imovel"
                      ? <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>
                      : <><path d="M5 17h14v-5l-2-5H7l-2 5z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></>}
                  </svg>
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-extrabold">{t === "imovel" ? "Imobiliário" : "Veículo"}</span>
                  <span className="text-[12.5px] text-[#64748B]">{t === "imovel" ? "SAC ou PRICE" : "Taxa média automática"}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Secao n={1} titulo="Cliente">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Nome completo"><Texto valor={cliente.nome} onChange={(v) => setCliente((c) => ({ ...c, nome: v }))} /></Campo>
            <Campo rotulo="CPF/CNPJ"><Texto valor={cliente.documento} onChange={(v) => setCliente((c) => ({ ...c, documento: formatarDocumento(v.replace(/\D/g, "").slice(0, 14)) }))} inputMode="numeric" /></Campo>
            <Campo rotulo="WhatsApp" dica="Para enviar o link direto"><Texto valor={cliente.telefone} onChange={(v) => setCliente((c) => ({ ...c, telefone: v }))} inputMode="tel" placeholder="(62) 99999-9999" /></Campo>
            <Campo rotulo="Consultor"><Texto valor={consultor} onChange={setConsultor} /></Campo>
          </div>
        </Secao>

        {tipo === "imovel" ? (
          <>
            <Secao n={2} titulo="Contrato" extra={pilulaBacen} sub="Com a taxa de juros, o sistema calcula sozinho saldo, juros, amortização e parcela.">
              <div className="grid gap-3.5 sm:grid-cols-3">
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
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Campo rotulo="Saldo devedor (extrato)"><DinheiroAuto valor={imovel.saldo_devedor} auto={auto("saldo_devedor")} onChange={setI("saldo_devedor")} /></Campo>
                <Campo rotulo="Parcela atual (boleto)"><DinheiroAuto valor={imovel.parcela_atual} auto={auto("parcela_atual")} onChange={setI("parcela_atual")} /></Campo>
                <Campo rotulo="Juros da parcela"><DinheiroAuto valor={imovel.juros} auto={auto("juros")} onChange={setI("juros")} /></Campo>
                <Campo rotulo="Amortização da parcela"><DinheiroAuto valor={imovel.amortizacao} auto={auto("amortizacao")} onChange={setI("amortizacao")} /></Campo>
                <Campo rotulo="Tarifa administrativa"><Dinheiro valor={imovel.tarifa_adm} onChange={setI("tarifa_adm")} /></Campo>
                <Campo rotulo="Seguros (MIP + DFI)"><Dinheiro valor={imovel.seguros} onChange={setI("seguros")} /></Campo>
              </div>
            </Secao>
            <Secao n={4} titulo="Correção">
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Campo rotulo="% de redução da parcela"><Texto valor={imovel.percentual_correcao} onChange={setI("percentual_correcao")} inputMode="decimal" /></Campo>
              </div>
            </Secao>
          </>
        ) : (
          <>
            <Secao n={2} titulo="Contrato" extra={pilulaBacen} sub="A taxa cobrada é descoberta sozinha pela parcela; a média vem do Banco Central.">
              <div className="grid gap-3.5 sm:grid-cols-3">
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
              <div className="grid gap-3.5 sm:grid-cols-3">
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
                    <div className="flex min-h-11 w-full items-center rounded-xl bg-[#ECFDF5] px-3.5 py-2 text-[13px] text-[#065F46] shadow-[inset_0_0_0_1px_#A7F3D0]">
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
      <aside aria-label="Prévia do resultado" className="flex h-fit flex-col gap-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#10B981] via-[#059669] to-[#064E3B] p-[26px] text-white shadow-[0_24px_48px_-22px_rgba(6,95,70,.75)]">
          <div aria-hidden className="pointer-events-none absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full bg-white/10" />
          <span className="relative text-[13px] font-bold text-white/80">{tipo === "imovel" ? "Diferença total identificada" : "Economia total identificada"}</span>
          <div className="relative mt-1 text-[38px] font-extrabold leading-tight tracking-[-.02em] sm:text-[42px]">{brl(total)}</div>
          <div className="relative mt-4 flex flex-wrap items-center gap-2.5">
            <span className="rounded-[10px] bg-white/15 px-[11px] py-[7px] text-[14px] font-bold line-through decoration-white/60">{brl(parcelaAtual)}</span>
            <span aria-hidden>→</span>
            <span className="rounded-[10px] bg-white px-[11px] py-[7px] text-[14px] font-extrabold text-[#065F46] shadow-[0_6px_16px_-8px_rgba(0,0,0,.4)]">{brl(resultado.parcela_corrigida)} por mês</span>
            {reducaoPct > 0 && <span className="ml-auto rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-extrabold">−{reducaoPct}%</span>}
          </div>
        </div>

        <ComparaTaxas
          cobrada={tipo === "imovel" ? resultado.taxa_contratada_mensal : resultado.taxa_contratada}
          media={resultado.taxa_media_mensal}
          ref={taxaInfo?.referencia}
          vezes={resultado.vezes_media}
        />

        <div className={`${cartaoCls} px-[22px] py-2 text-[13.5px]`}>
          {(tipo === "imovel"
            ? [["Amortizado", resultado.amortizado, ""], ["Amortização corrigida", resultado.amortizacao_corrigida, ""], ["Diferença na amortização", resultado.diferenca_amortizacao, "text-[#DC2626]"], ["Tarifas e seguros questionáveis", resultado.tarifas_questionaveis, "text-[#C2410C]"], ["Saldo devedor correto", resultado.saldo_correto, ""], ["Economia até o fim do contrato", resultado.economia_total, "text-[#047857]"]]
            : [["Redução por parcela", resultado.reducao_parcela, ""], [`Redução nas ${resultado.restantes} restantes`, resultado.reducao_total, "text-[#047857]"], ["Estorno das pagas", resultado.estorno, "text-[#C2410C]"]]
          ).map(([k, v, cor]) => (
            <div key={k} className="flex border-b border-[#F1F5F4] py-3 last:border-0"><span className="text-[#64748B]">{k}</span><b className={`ml-auto tabular-nums ${cor}`}>{brl(v)}</b></div>
          ))}
        </div>

        <div className={`${cartaoCls} flex flex-col gap-3 p-[22px]`}>
          <Campo rotulo="Validade do link (horas)"><Texto valor={validade} onChange={(v) => setValidade(Number(v.replace(/\D/g, "")) || 0)} inputMode="numeric" /></Campo>
          {(pendencias.length > 0 || !cliente.nome.trim()) && (
            <ul className="m-0 flex list-none flex-col gap-1.5 rounded-xl bg-[#FFFBEB] p-3 text-[12.5px] font-semibold text-[#92400E]">
              {!cliente.nome.trim() && <li className="flex items-start gap-2"><Icone nome="alerta" tamanho={14} />Informe o nome do cliente</li>}
              {pendencias.map((p) => <li key={p} className="flex items-start gap-2"><Icone nome="alerta" tamanho={14} />{p}</li>)}
            </ul>
          )}
          {erro && <div className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] font-semibold text-[#B91C1C]">{erro}</div>}
        </div>

        <button disabled={gerando || pendencias.length > 0 || !cliente.nome.trim() || validade < 1} onClick={gerar}
          className="h-[54px] rounded-2xl bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] text-[15px] font-extrabold text-white shadow-[0_16px_30px_-14px_rgba(5,150,105,.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
          {gerando ? "Gerando…" : "Gerar proposta e enviar link"}
        </button>
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
    <div className={`${cartaoCls} overflow-hidden`}>
      <div className="p-4">
        <label className="flex h-[46px] items-center gap-2.5 rounded-[13px] bg-[#F3F6F5] px-3.5 text-[#64748B]">
          <Icone nome="busca" tamanho={17} />
          <input className="a2-input-limpo h-full flex-1 border-0 bg-transparent text-[14px] font-semibold text-[#0F172A] outline-none placeholder:font-medium placeholder:text-[#94A3B8]" placeholder="Buscar por cliente, CPF ou nº da proposta" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </label>
      </div>
      {lista.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 pb-12 pt-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#059669]"><Icone nome="documento" tamanho={22} /></span>
          <span className="text-[15px] font-extrabold">{filtro ? "Nada encontrado" : "Nenhuma proposta ainda"}</span>
          <span className="text-[13px] text-[#64748B]">{filtro ? "Tente outro nome, CPF ou número." : "As propostas geradas na simulação aparecem aqui."}</span>
        </div>
      )}
      <div>
        {lista.map((p) => {
          const st = STATUS[p.status] || STATUS.enviada;
          const total = p.tipo === "imovel" ? p.resultado.diferenca_total : p.resultado.economia_total;
          const aberta = p.status === "enviada" || p.status === "visualizada";
          return (
            <div key={p.id} className={`flex flex-wrap items-center gap-3.5 border-t border-[#F1F5F4] px-[18px] py-4 transition hover:bg-[#F7FAF9] ${p.status === "aceita" && !p.dados?.contrato_gerado ? "bg-[#FFFBEB]" : ""}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] text-[13px] font-extrabold text-[#065F46]">{iniciais(p.cliente_nome)}</div>
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-extrabold">{p.cliente_nome}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${st.cls}`}>{st.rotulo}</span>
                </div>
                <div className="text-[12.5px] text-[#64748B]">
                  {p.tipo === "imovel" ? "Imóvel" : "Veículo"} · {p.dados?.banco} · nº {p.numero} · {p.consultor_nome} · {new Date(p.created_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-[12px] text-[#94A3B8]">
                  {p.visualizacoes > 0 ? `Aberta ${p.visualizacoes}x (1ª em ${new Date(p.visualizada_em!).toLocaleString("pt-BR")})` : "Ainda não aberta"}
                  {aberta && ` · expira em ${restante(p.expira_em)}`}
                  {p.respondida_em && ` · respondida em ${new Date(p.respondida_em).toLocaleString("pt-BR")}`}
                  {p.motivo_recusa && ` · motivo: ${p.motivo_recusa}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[16px] font-extrabold tracking-tight text-[#047857]">{brl(total)}</div>
                <div className="text-[12px] text-[#94A3B8]">parcela {brl(p.dados?.parcela_atual)} → {brl(p.resultado.parcela_corrigida)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.status === "aceita" && (p.dados?.contrato_gerado
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1.5 text-[12.5px] font-bold text-[#047857]"><Icone nome="check" tamanho={13} />Contrato gerado</span>
                  : <a href={`/crm/contratos?revisional=${p.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] px-3.5 py-2 text-[13px] font-extrabold text-white shadow-[0_10px_20px_-10px_rgba(5,150,105,.8)]"><Icone nome="documento" tamanho={14} />Gerar contrato</a>)}
                <button onClick={() => navigator.clipboard.writeText(p.link)} className={botaoSec}><Icone nome="copiar" tamanho={13} />Copiar link</button>
                <button onClick={() => void baixarPdfProposta({ ...p, cliente_documento: formatarDocumento(p.cliente_documento), empresa: p.empresa || {}, criada_em: p.created_at }).catch(() => alert("Não foi possível gerar o PDF"))} className={botaoSec}><Icone nome="download" tamanho={13} />PDF</button>
                <a href={linkWhats(p.cliente_telefone, mensagemCliente(p.cliente_nome, p.link, Math.max(1, Math.round((new Date(p.expira_em).getTime() - Date.now()) / 3600_000))))} target="_blank" rel="noreferrer" className={`${botaoSec} !bg-[#ECFDF5] !text-[#047857] hover:!bg-[#D1FAE5]`}><Icone nome="whatsapp" tamanho={13} />WhatsApp</a>
                <a href={p.link} target="_blank" rel="noreferrer" className={botaoSec}><Icone nome="olho" tamanho={13} />Abrir</a>
                {(p.status === "expirada" || p.status === "cancelada" || aberta) && (
                  <button disabled={ocupado === p.id} onClick={() => acao(p, "renovar")} className={botaoSec} title={`Mais ${config?.validade_horas || 24}h a partir de agora`}><Icone nome="atualizar" tamanho={13} />Renovar</button>
                )}
                {aberta && <button disabled={ocupado === p.id} onClick={() => acao(p, "cancelar")} className={`${botaoSec} !bg-[#FEF2F2] !text-[#B91C1C] hover:!bg-[#FEE2E2]`}><Icone nome="x" tamanho={13} />Cancelar</button>}
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
    <div className={`${cartaoCls} flex max-w-3xl flex-col gap-4 p-[22px]`}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-[#059669] text-white"><Icone nome="config" tamanho={14} /></span>
        <h2 className="m-0 text-[16px] font-extrabold">Padrões da proposta</h2>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Campo rotulo="Empresa (aparece na proposta)"><Texto valor={c.empresa_nome} onChange={set("empresa_nome")} /></Campo>
        <Campo rotulo="CNPJ"><Texto valor={c.empresa_cnpj} onChange={set("empresa_cnpj")} /></Campo>
        <Campo rotulo="WhatsApp de contato" dica="Botão após o cliente aceitar"><Texto valor={c.whatsapp_contato} onChange={set("whatsapp_contato")} /></Campo>
        <Campo rotulo="Validade padrão do link (horas)"><Texto valor={c.validade_horas} onChange={set("validade_horas")} inputMode="numeric" /></Campo>
        <Campo rotulo="% correção padrão — imóvel"><Texto valor={c.percentual_imovel} onChange={set("percentual_imovel")} inputMode="decimal" /></Campo>
        <Campo rotulo="% correção padrão — veículo" dica="Usado quando o método escolhido é % sobre a parcela"><Texto valor={c.percentual_veiculo} onChange={set("percentual_veiculo")} inputMode="decimal" /></Campo>
        <Campo rotulo="Taxa corrigida padrão — veículo (% a.m.)"><Texto valor={c.taxa_veiculo} onChange={set("taxa_veiculo")} inputMode="decimal" /></Campo>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={salvar} className="rounded-xl bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_12px_24px_-12px_rgba(5,150,105,.8)]">Salvar</button>
        {msg && <span className="text-[13px] font-semibold text-[#64748B]">{msg}</span>}
      </div>
    </div>
  );
}
