"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brl, pctBR } from "../../../lib/revisional";
import { baixarPdfProposta } from "../../../lib/revisional-pdf";

type Proposta = {
  numero: string;
  tipo: "imovel" | "veiculo";
  status: string;
  cliente_nome: string;
  cliente_documento: string;
  consultor_nome: string;
  dados: Record<string, any>;
  resultado: Record<string, any>;
  empresa: { nome?: string; cnpj?: string; whatsapp?: string };
  expira_em: string;
  respondida_em: string | null;
  criada_em: string;
  agora: string;
};

const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Número que sobe de 0 até o valor (efeito de contagem). */
function useContagem(alvo: number, duracao = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      setV(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}

/* ---------- peças visuais ---------- */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`break-inside-avoid rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] print:shadow-none ${className}`}>{children}</div>;
}

function Titulo({ icone, children }: { icone: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[16px]">{icone}</span>
      <h2 className="text-[15px] font-bold text-slate-800">{children}</h2>
    </div>
  );
}

function Contador({ expiraEm, deslocamento, onExpirar }: { expiraEm: string; deslocamento: number; onExpirar: () => void }) {
  const [agora, setAgora] = useState(() => Date.now() + deslocamento);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now() + deslocamento), 1000);
    return () => clearInterval(t);
  }, [deslocamento]);
  const resto = Math.max(0, new Date(expiraEm).getTime() - agora);
  useEffect(() => { if (resto === 0) onExpirar(); }, [resto, onExpirar]);
  const h = Math.floor(resto / 3600_000);
  const m = Math.floor((resto % 3600_000) / 60_000);
  const s = Math.floor((resto % 60_000) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 print:hidden">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" /></span>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-amber-900">Condição por tempo limitado</div>
          <div className="text-[11px] text-amber-700">Válida até {new Date(expiraEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>
      <div className="flex items-center gap-1 font-mono">
        {[[p(h), "h"], [p(m), "min"], [p(s), "s"]].map(([v, u], i) => (
          <div key={u} className="flex items-center gap-1">
            {i > 0 && <span className="text-amber-400">:</span>}
            <div className="min-w-[42px] rounded-xl bg-white px-1.5 py-1 text-center shadow-sm ring-1 ring-amber-200">
              <div className="text-[18px] font-bold leading-none text-amber-700 tabular-nums">{v}</div>
              <div className="mt-0.5 font-sans text-[9px] uppercase text-amber-500">{u}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rosca({ partes }: { partes: { rotulo: string; valor: number; cor: string }[] }) {
  const total = partes.reduce((a, p) => a + Math.max(0, p.valor), 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  const fatias = partes.map((p) => (Math.max(0, p.valor) / total) * C);
  const inicios = fatias.map((_, i) => fatias.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {partes.map((p, i) => (
          <circle key={p.rotulo} cx="70" cy="70" r={R} fill="none" stroke={p.cor} strokeWidth="18" strokeDasharray={`${fatias[i]} ${C - fatias[i]}`} strokeDashoffset={-inicios[i]} />
        ))}
      </svg>
      <div className="w-full space-y-2">
        {partes.map((p) => (
          <div key={p.rotulo} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.cor }} />
            <span className="flex-1 text-slate-600">{p.rotulo}</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{Math.round((Math.max(0, p.valor) / total) * 100)}%</span>
            <b className="w-24 text-right tabular-nums text-slate-800">{brl(p.valor)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Linha({ icone, rotulo, valor, destaque }: { icone: string; rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-[14px]">{icone}</span>
      <span className="flex-1 text-[13px] text-slate-600">{rotulo}</span>
      <span className={`text-[14px] font-bold tabular-nums ${destaque || "text-slate-800"}`}>{valor}</span>
    </div>
  );
}

/* ---------- página ---------- */
export default function PropostaRevisionalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");
  const [proposta, setProposta] = useState<Proposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRecusa, setConfirmarRecusa] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [deslocamento, setDeslocamento] = useState(0);
  const [verContrato, setVerContrato] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await fetch(`/api/revisional/publica/${encodeURIComponent(token)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || "Link inválido");
        if (!ativo) return;
        setProposta(d.proposta);
        setDeslocamento(new Date(d.proposta.agora).getTime() - Date.now()); // relógio do servidor
      } catch (e: any) {
        if (ativo) setErro(e.message || "Não foi possível abrir a proposta");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  const aberta = !!proposta && (proposta.status === "enviada" || proposta.status === "visualizada");
  const onExpirar = useMemo(() => () => setProposta((p) => (p && (p.status === "enviada" || p.status === "visualizada") ? { ...p, status: "expirada" } : p)), []);

  const imovel = proposta?.tipo === "imovel";
  const total = proposta ? Number(imovel ? proposta.resultado.diferenca_total : proposta.resultado.economia_total) || 0 : 0;
  const totalAnimado = useContagem(total);

  async function baixarPdf() {
    if (!proposta) return;
    setGerandoPdf(true);
    try {
      await baixarPdfProposta(proposta);
    } catch {
      alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  }

  async function responder(acao: "aceitar" | "recusar") {
    setEnviando(true);
    try {
      const r = await fetch(`/api/revisional/publica/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, motivo }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || "Não foi possível registrar");
      setProposta((p) => (p ? { ...p, status: d.status, respondida_em: d.respondida_em } : p));
      setConfirmarRecusa(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />Carregando sua proposta…</div>
      </main>
    );
  }
  if (erro || !proposta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-sm text-center">
          <div className="text-3xl">🔒</div>
          <div className="mt-2 text-lg font-bold text-slate-800">Proposta indisponível</div>
          <p className="mt-1 text-sm text-slate-500">{erro}</p>
        </Card>
      </main>
    );
  }

  const { dados: d, resultado: r } = proposta;
  const reducaoPct = d.parcela_atual > 0 ? Math.round((1 - r.parcela_corrigida / d.parcela_atual) * 100) : 0;
  const economiaParcela = imovel ? r.diferenca_parcela : r.reducao_parcela;
  const taxaCobrada: number | null = imovel ? r.taxa_contratada_mensal ?? null : r.taxa_contratada ?? null;
  const taxaMedia: number | null = r.taxa_media_mensal ?? null;
  const zap = (proposta.empresa?.whatsapp || "").replace(/\D/g, "");
  const msgZap = encodeURIComponent(`Olá! Aceitei a proposta de análise contratual nº ${proposta.numero}.`);
  const primeiroNome = proposta.cliente_nome.trim().split(/\s+/)[0] || "";

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#d1fae5_0%,_#f8fafc_45%)] text-slate-800 print:bg-white">
      <div className={`mx-auto max-w-[640px] px-4 pt-5 ${aberta ? "pb-36" : "pb-10"} print:pb-4`}>
        {/* topo */}
        <div className="mb-4 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-[15px] text-white shadow-md shadow-emerald-600/30">⚖️</span>
            <div className="leading-tight">
              <div className="font-bold text-slate-800">{proposta.empresa?.nome || "Análise contratual"}</div>
              {proposta.empresa?.cnpj && <div className="text-[10px] text-slate-500">CNPJ {proposta.empresa.cnpj}</div>}
            </div>
          </div>
          <span className="rounded-full bg-white/80 px-2.5 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">nº {proposta.numero}</span>
        </div>

        {/* destaque */}
        <div className="relative break-inside-avoid overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-6 text-white shadow-xl shadow-emerald-900/20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-teal-400/20" />
          <div className="relative">
            <div className="text-[13px] font-medium text-emerald-100">{primeiroNome ? `${primeiroNome}, identificamos` : "Identificamos"}</div>
            <div className="mt-1 text-[40px] font-black leading-none tracking-tight tabular-nums sm:text-[48px]"><span className="print:hidden">{brl(totalAnimado)}</span><span className="hidden print:inline">{brl(total)}</span></div>
            <div className="mt-2 text-[14px] text-emerald-50/90">
              {imovel ? "em cobranças indevidas no seu financiamento imobiliário" : "de economia no seu financiamento de veículo"} · <b className="text-white">{d.banco}</b>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              {[["Cliente", proposta.cliente_nome], ["CPF/CNPJ", proposta.cliente_documento || "—"], ["Consultor", proposta.consultor_nome], ["Data", dataBR(proposta.criada_em)]].map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-2xl bg-white/10 px-3 py-2 backdrop-blur">
                  <div className="text-[9px] uppercase tracking-wider text-emerald-100/80">{k}</div>
                  <div className="truncate font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {aberta && <Contador expiraEm={proposta.expira_em} deslocamento={deslocamento} onExpirar={onExpirar} />}
          {proposta.status === "expirada" && (
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 text-center text-[13px] text-slate-600">
              ⏱️ Esta proposta expirou em {new Date(proposta.expira_em).toLocaleString("pt-BR")}. Fale com seu consultor para renovar.
            </div>
          )}

          {/* parcela antes x depois */}
          <Card>
            <Titulo icone="💳">Sua parcela</Titulo>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
              <div className="min-w-0 rounded-2xl bg-red-50 px-2 py-4 text-center ring-1 ring-red-100 sm:px-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Hoje você paga</div>
                <div className="mt-1 text-[17px] font-extrabold text-red-500 line-through decoration-red-300 decoration-2 tabular-nums min-[400px]:text-[20px] sm:text-[26px]">{brl(d.parcela_atual)}</div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md sm:h-9 sm:w-9">→</div>
              <div className="min-w-0 rounded-2xl bg-emerald-50 px-2 py-4 text-center ring-2 ring-emerald-500 sm:px-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Valor corrigido</div>
                <div className="mt-1 text-[17px] font-extrabold text-emerald-600 tabular-nums min-[400px]:text-[20px] sm:text-[26px]">{brl(r.parcela_corrigida)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13px]">
              <span className="rounded-full bg-emerald-600 px-3 py-1 font-bold text-white">{brl(economiaParcela)} a menos por mês</span>
              {reducaoPct > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">−{reducaoPct}% na parcela</span>}
            </div>
          </Card>

          {/* juros x mercado */}
          {taxaCobrada && taxaMedia && (
            <Card>
              <Titulo icone="📊">Seus juros × média do mercado</Titulo>
              {(() => {
                const max = Math.max(taxaCobrada, taxaMedia) * 1.08;
                const vezes = r.vezes_media as number | null;
                return (
                  <>
                    {[["Juros cobrados no seu contrato", taxaCobrada, "from-red-500 to-rose-500", "text-red-600"], [`Média do mercado (Banco Central${d.taxa_media_ref ? `, ${d.taxa_media_ref}` : ""})`, taxaMedia, "from-emerald-500 to-teal-500", "text-emerald-600"]].map(([k, v, cor, txt]) => (
                      <div key={k as string} className="mb-3">
                        <div className="mb-1 flex justify-between text-[13px]"><span className="text-slate-600">{k}</span><b className={txt as string}>{pctBR(v as number)} a.m.</b></div>
                        <div className="h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full bg-gradient-to-r ${cor}`} style={{ width: `${((v as number) / max) * 100}%` }} /></div>
                      </div>
                    ))}
                    {vezes != null && vezes > 1 && (
                      <div className="mt-2 rounded-2xl bg-red-50 px-4 py-3 text-center text-[13px] text-red-700">
                        Você paga <b className="text-[16px]">{vezes.toLocaleString("pt-BR")}×</b> a taxa média praticada no mercado
                      </div>
                    )}
                  </>
                );
              })()}
            </Card>
          )}

          {/* composição (imóvel) */}
          {imovel && (
            <Card>
              <Titulo icone="🧾">Para onde vai sua parcela</Titulo>
              <Rosca partes={[
                { rotulo: "Juros", valor: Number(d.juros) || 0, cor: "#ef4444" },
                { rotulo: "Amortização", valor: Number(d.amortizacao) || 0, cor: "#10b981" },
                { rotulo: "Tarifa administrativa", valor: Number(d.tarifa_adm) || 0, cor: "#f59e0b" },
                { rotulo: "Seguros", valor: Number(d.seguros) || 0, cor: "#8b5cf6" },
              ]} />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[["Já pago em juros", r.juros_pagos, "text-red-500"], ["Em amortização", r.amortizacao_corrigida, "text-emerald-600"], ["Total pago", r.media_total, "text-slate-800"]].map(([k, v, cor]) => (
                  <div key={k as string} className="rounded-2xl bg-slate-50 px-2 py-3">
                    <div className="text-[10px] font-semibold uppercase leading-tight text-slate-500">{k}</div>
                    <div className={`mt-1 text-[13px] font-extrabold tabular-nums sm:text-[15px] ${cor}`}>{brl(v as number)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* resultado */}
          <Card>
            <Titulo icone="✅">Resultado da análise</Titulo>
            <div className="divide-y divide-slate-100">
              {imovel ? (
                <>
                  <Linha icone="🏦" rotulo="Amortizado pelo banco" valor={brl(r.amortizado)} />
                  <Linha icone="📐" rotulo="Amortização correta" valor={brl(r.amortizacao_corrigida)} />
                  <Linha icone="⚠️" rotulo="Diferença na amortização" valor={brl(r.diferenca_amortizacao)} destaque="text-red-500" />
                  <Linha icone="🧾" rotulo="Tarifas e seguros questionáveis" valor={brl(r.tarifas_questionaveis)} destaque="text-orange-500" />
                </>
              ) : (
                <>
                  <Linha icone="📉" rotulo="Redução por parcela" valor={brl(r.reducao_parcela)} destaque="text-emerald-600" />
                  <Linha icone="📅" rotulo={`Redução nas ${r.restantes} parcelas restantes`} valor={brl(r.reducao_total)} />
                  <Linha icone="💸" rotulo={`Devolução das ${d.pagas} parcelas já pagas`} valor={brl(r.estorno)} destaque="text-amber-600" />
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
              <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">{imovel ? "Diferença total" : "Economia total"}</span>
              <span className="text-[24px] font-black tabular-nums">{brl(total)}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
              {(imovel
                ? [["🏠", "Saldo devedor correto", r.saldo_correto], ["📉", "Economia por parcela", r.diferenca_parcela], ["🎯", "Economia até o fim", r.economia_total]]
                : [["💳", "Parcela corrigida", r.parcela_corrigida], ["📉", "Economia por parcela", r.reducao_parcela], ["🎯", "Redução total", r.reducao_total]]
              ).map(([ic, k, v]) => (
                <div key={k as string} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 text-center">
                  <div className="text-[16px]">{ic}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80">{k}</div>
                  <div className="mt-0.5 text-[17px] font-extrabold text-emerald-700 tabular-nums">{brl(v as number)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* contrato */}
          <Card className="py-0">
            <button onClick={() => setVerContrato((v) => !v)} className="flex w-full items-center justify-between py-4 text-left">
              <span className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">📄</span><b className="text-[15px]">Dados do contrato</b></span>
              <span className={`text-slate-400 transition print:hidden ${verContrato ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {(
              <div className={`${verContrato ? "grid" : "hidden"} gap-x-6 border-t border-slate-100 pb-4 pt-2 text-[13px] sm:grid-cols-2 print:grid print:grid-cols-2`}>
                {([
                  ["Banco / Financeira", d.banco],
                  ...(!imovel ? [["Veículo", `${d.modelo || "—"}${d.ano ? ` (${d.ano})` : ""}`]] : []),
                  ["Valor financiado", brl(d.valor_financiado)],
                  ["Total de parcelas", String(d.prazo)],
                  ["Parcelas pagas", String(d.pagas)],
                  ["Parcelas em atraso", String(d.atrasadas || 0)],
                  ...(imovel ? [["Modalidade", d.modalidade], ["Contrato sofreu pausa?", d.pausa ? "Sim" : "Não"], ["Saldo devedor", brl(d.saldo_devedor)]] : []),
                  ...(imovel && d.taxa_anual ? [["Taxa do contrato", `${pctBR(d.taxa_anual)} a.a.`]] : []),
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-50 py-2"><span className="text-slate-500">{k}</span><b className="text-right">{v}</b></div>
                ))}
              </div>
            )}
          </Card>

          {proposta.status === "aceita" && (
            <div className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-lg shadow-emerald-600/30">✓</div>
              <div className="mt-3 text-[18px] font-extrabold text-emerald-700">Proposta aceita!</div>
              <p className="mt-1 text-[13px] text-slate-600">Recebemos seu aceite{proposta.respondida_em ? ` em ${new Date(proposta.respondida_em).toLocaleString("pt-BR")}` : ""}. Seu consultor vai entrar em contato com os próximos passos.</p>
              {zap && (
                <a href={`https://wa.me/${zap.length <= 11 ? "55" + zap : zap}?text=${msgZap}`} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-2xl bg-emerald-600 px-6 py-3 text-[14px] font-bold text-white shadow-md shadow-emerald-600/30">
                  Falar no WhatsApp
                </a>
              )}
            </div>
          )}
          <button onClick={baixarPdf} disabled={gerandoPdf} className="flex w-full items-center justify-center gap-2.5 rounded-3xl border border-slate-200 bg-white py-4 text-[14px] font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60 print:hidden">
            <span className="flex h-7 w-9 items-center justify-center rounded-lg bg-red-50 text-[10px] font-black tracking-wide text-red-600">PDF</span>
            {gerandoPdf ? "Gerando PDF…" : "Baixar PDF da proposta"}
          </button>

          {proposta.status === "recusada" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center text-[13px] text-slate-600">Proposta recusada. Se mudar de ideia, fale com seu consultor.</div>
          )}

          <div className="space-y-2 px-1 text-center text-[10px] leading-relaxed text-slate-400">
            <p>Arts. 42, 43 e 51 da Lei nº 8.078/1990 (Código de Defesa do Consumidor). Valores estimados com base nos dados informados, sujeitos à análise do contrato.{taxaMedia ? " Taxa média de mercado: Banco Central do Brasil (SGS)." : ""}</p>
          </div>
        </div>
      </div>

      {/* barra de ações fixa */}
      {aberta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur print:hidden">
          <div className="mx-auto max-w-[640px]">
            {!confirmarRecusa ? (
              <div className="grid grid-cols-[1fr_2fr] gap-2.5">
                <button disabled={enviando} onClick={() => setConfirmarRecusa(true)} className="rounded-2xl border border-slate-200 bg-white py-3.5 text-[14px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50">Recusar</button>
                <button disabled={enviando} onClick={() => responder("aceitar")} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-105 disabled:opacity-50">
                  {enviando ? "Registrando…" : "✓ Aceitar proposta"}
                </button>
              </div>
            ) : (
              <div>
                <div className="text-[14px] font-semibold">Tem certeza que deseja recusar?</div>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Conte o motivo (opcional)" className="mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-[13px] outline-none focus:border-emerald-500" rows={2} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirmarRecusa(false)} className="rounded-xl border border-slate-200 py-2.5 text-[13px] font-medium">Voltar</button>
                  <button disabled={enviando} onClick={() => responder("recusar")} className="rounded-xl bg-red-600 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">Confirmar recusa</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
