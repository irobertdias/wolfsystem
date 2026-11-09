"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brl } from "../../../lib/revisional";

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
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.m.`;

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-slate-500">{rotulo}</span>
      <span className={`font-semibold text-right ${destaque || "text-slate-800"}`}>{valor}</span>
    </div>
  );
}

function Tile({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  const cores: Record<string, string> = {
    azul: "bg-blue-50 border-blue-100 text-blue-700",
    roxo: "bg-purple-50 border-purple-100 text-purple-700",
    laranja: "bg-orange-50 border-orange-100 text-orange-700",
    rosa: "bg-pink-50 border-pink-100 text-pink-700",
    verde: "bg-emerald-50 border-emerald-100 text-emerald-700",
    amarelo: "bg-amber-50 border-amber-100 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${cores[cor]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{rotulo}</div>
      <div className="mt-1 text-[17px] font-bold">{valor}</div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>
    </section>
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
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 print:hidden">
      <span className="flex items-center gap-2 text-[13px] font-medium text-amber-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        Proposta com validade limitada
      </span>
      <span className="font-mono text-lg font-bold tracking-wider text-amber-700">{p(h)}:{p(m)}:{p(s)}</span>
    </div>
  );
}

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

  const aberta = proposta && (proposta.status === "enviada" || proposta.status === "visualizada");
  const onExpirar = useMemo(() => () => setProposta((p) => (p && (p.status === "enviada" || p.status === "visualizada") ? { ...p, status: "expirada" } : p)), []);

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
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Carregando proposta…</main>;
  }
  if (erro || !proposta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-lg font-bold text-slate-800">Proposta indisponível</div>
          <p className="mt-2 text-sm text-slate-500">{erro}</p>
        </div>
      </main>
    );
  }

  const { dados: d, resultado: r, tipo } = proposta;
  const imovel = tipo === "imovel";
  const total = imovel ? r.diferenca_total : r.economia_total;
  const zap = (proposta.empresa?.whatsapp || "").replace(/\D/g, "");
  const msgZap = encodeURIComponent(`Olá! Aceitei a proposta revisional nº ${proposta.numero}.`);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-800 print:bg-white print:py-0">
      <div className="mx-auto max-w-[620px]">
        {proposta.empresa?.nome && (
          <div className="mb-3 text-center text-[11px] text-slate-500">
            {proposta.empresa.nome}{proposta.empresa.cnpj ? ` — CNPJ ${proposta.empresa.cnpj}` : ""}
          </div>
        )}

        {/* Cabeçalho */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {imovel ? "Diferença total identificada" : "Economia total identificada"}
          </div>
          <div className="mt-1 text-[34px] font-extrabold leading-tight text-emerald-600">{brl(total)}</div>
          <div className="text-[13px] text-slate-600">
            Cobrança indevida em {imovel ? "financiamento imobiliário" : "financiamento de veículo"} — <b>{d.banco}</b>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-[12px] sm:grid-cols-4">
            {[["Cliente", proposta.cliente_nome], ["CPF/CNPJ", proposta.cliente_documento || "—"], ["Consultor", proposta.consultor_nome], ["Data", dataBR(proposta.criada_em)]].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{k}</div>
                <div className="truncate font-semibold uppercase">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {aberta && <Contador expiraEm={proposta.expira_em} deslocamento={deslocamento} onExpirar={onExpirar} />}
        {proposta.status === "expirada" && (
          <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-200 px-4 py-3 text-center text-[13px] font-semibold text-slate-600">
            Esta proposta expirou em {new Date(proposta.expira_em).toLocaleString("pt-BR")}. Fale com seu consultor para renovar.
          </div>
        )}

        {/* Dados do contrato */}
        <Secao titulo={imovel ? "Dados do contrato" : "Dados do financiamento"}>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <Linha rotulo="Banco / Financeira" valor={d.banco} />
              {!imovel && <Linha rotulo="Veículo" valor={`${d.modelo || "—"}${d.ano ? ` (${d.ano})` : ""}`} />}
              <Linha rotulo="Valor financiado" valor={brl(d.valor_financiado)} />
              <Linha rotulo="Total de parcelas" valor={String(d.prazo)} />
              <Linha rotulo="Parcelas pagas" valor={String(d.pagas)} />
            </div>
            <div>
              <Linha rotulo="Parcelas em atraso" valor={String(d.atrasadas || 0)} />
              {imovel && <Linha rotulo="Contrato sofreu pausa?" valor={d.pausa ? "SIM" : "NÃO"} />}
              {imovel && <Linha rotulo="Modalidade" valor={d.modalidade} />}
              {imovel && <Linha rotulo="Saldo devedor" valor={brl(d.saldo_devedor)} />}
              {!imovel && <Linha rotulo="Parcela atual" valor={brl(d.parcela_atual)} />}
              {!imovel && r.taxa_contratada != null && <Linha rotulo="Taxa estimada cobrada" valor={pct(r.taxa_contratada)} destaque="text-red-600" />}
            </div>
          </div>
        </Secao>

        {/* Parcela */}
        <Secao titulo="Detalhamento da parcela">
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Valor da parcela atual</div>
            <div className="text-[30px] font-extrabold text-red-500">{brl(d.parcela_atual)}</div>
            <div className="text-[12px] text-slate-500">Parcela corrigida: <b className="text-emerald-600">{brl(r.parcela_corrigida)}</b></div>
          </div>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-[11px]">
            <div>
              <div className="mb-1 flex justify-between"><span className="text-slate-500">Parcela correta</span><span className="font-semibold text-emerald-600">{brl(r.parcela_corrigida)}</span></div>
              <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (r.parcela_corrigida / d.parcela_atual) * 100)}%` }} /></div>
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span className="text-slate-500">Parcela cobrada</span><span className="font-semibold text-red-500">{brl(d.parcela_atual)}</span></div>
              <div className="h-2.5 rounded-full bg-red-400" />
            </div>
          </div>
          {imovel ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Tile rotulo="Juros" valor={brl(d.juros)} cor="azul" />
              <Tile rotulo="Amortização" valor={brl(d.amortizacao)} cor="roxo" />
              <Tile rotulo="Tarifa adm." valor={brl(d.tarifa_adm)} cor="laranja" />
              <Tile rotulo="Seguros" valor={brl(d.seguros)} cor="rosa" />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Tile rotulo="Redução por parcela" valor={brl(r.reducao_parcela)} cor="azul" />
              <Tile rotulo="Juros abusivos/parcela" valor={brl(r.reducao_parcela)} cor="laranja" />
            </div>
          )}
        </Secao>

        {imovel && (
          <Secao titulo="Demonstrativo amortização × juros">
            <div className="grid grid-cols-1 gap-2.5 text-center min-[480px]:grid-cols-3">
              {[["Parc. amortização", r.amortizacao_corrigida], ["Parc. juros", r.juros_pagos], ["Média total", r.media_total]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
                  <div className="mt-1 text-[15px] font-bold">{brl(v as number)}</div>
                </div>
              ))}
            </div>
          </Secao>
        )}

        {/* Resultado */}
        <Secao titulo="Resultado da análise">
          {imovel ? (
            <>
              <Linha rotulo="Amortizado" valor={brl(r.amortizado)} />
              <Linha rotulo="Amortização corrigida" valor={brl(r.amortizacao_corrigida)} />
              <Linha rotulo="Diferença da amortização" valor={brl(r.diferenca_amortizacao)} />
              <Linha rotulo="Tarifas questionáveis" valor={brl(r.tarifas_questionaveis)} destaque="text-orange-600" />
            </>
          ) : (
            <>
              <Linha rotulo="Parcela corrigida" valor={brl(r.parcela_corrigida)} destaque="text-emerald-600" />
              <Linha rotulo={`Redução nas ${r.restantes} parcelas restantes`} valor={brl(r.reducao_total)} />
              <Linha rotulo={`Estorno das ${d.pagas} parcelas pagas`} valor={brl(r.estorno)} destaque="text-amber-600" />
            </>
          )}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <span className="text-[13px] font-bold uppercase text-emerald-700">{imovel ? "Diferença total" : "Economia total"}</span>
            <span className="text-[22px] font-extrabold text-emerald-700">{brl(total)}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
            {(imovel
              ? [["Saldo devedor correto", r.saldo_correto], ["Diferença/parcela", r.diferenca_parcela], ["Economia total contrato", r.economia_total]]
              : [["Parcela corrigida", r.parcela_corrigida], ["Redução/parcela", r.reducao_parcela], ["Redução total", r.reducao_total]]
            ).map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-emerald-600 px-2 py-3 text-center text-white">
                <div className="text-[9px] font-semibold uppercase leading-tight opacity-90">{k}</div>
                <div className="mt-1 text-[17px] font-extrabold min-[480px]:text-[14px] sm:text-[16px]">{brl(v as number)}</div>
              </div>
            ))}
          </div>
        </Secao>

        <div className="mt-4 flex items-start justify-between gap-4 px-1 text-[10px] text-slate-400">
          <span>Arts. 42, 43 e 51 da Lei nº 8.078/1990 (CDC) — Requisição de revisão de parcelas sobre juros e encargos abusivos. Valores estimados, sujeitos à análise do contrato.</span>
          <span className="shrink-0 font-mono">Proposta nº {proposta.numero}</span>
        </div>

        {/* Ações */}
        <div className="mt-5 pb-8 print:hidden">
          {aberta && !confirmarRecusa && (
            <div className="grid grid-cols-2 gap-3">
              <button disabled={enviando} onClick={() => setConfirmarRecusa(true)} className="rounded-xl border border-red-200 bg-white py-3.5 text-[14px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                ✕ Recusar
              </button>
              <button disabled={enviando} onClick={() => responder("aceitar")} className="rounded-xl bg-emerald-600 py-3.5 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {enviando ? "Registrando…" : "✓ Aceitar Proposta"}
              </button>
            </div>
          )}
          {aberta && confirmarRecusa && (
            <div className="rounded-2xl border border-red-200 bg-white p-4">
              <div className="text-[14px] font-semibold">Tem certeza que deseja recusar?</div>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-[13px]" rows={2} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => setConfirmarRecusa(false)} className="rounded-lg border border-slate-200 py-2.5 text-[13px]">Voltar</button>
                <button disabled={enviando} onClick={() => responder("recusar")} className="rounded-lg bg-red-600 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">Confirmar recusa</button>
              </div>
            </div>
          )}
          {proposta.status === "aceita" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <div className="text-[16px] font-bold text-emerald-700">✓ Proposta aceita</div>
              <p className="mt-1 text-[13px] text-emerald-800">Recebemos seu aceite{proposta.respondida_em ? ` em ${new Date(proposta.respondida_em).toLocaleString("pt-BR")}` : ""}. Seu consultor entrará em contato com os próximos passos.</p>
              {zap && (
                <a href={`https://wa.me/${zap.length <= 11 ? "55" + zap : zap}?text=${msgZap}`} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-semibold text-white">
                  Falar no WhatsApp
                </a>
              )}
            </div>
          )}
          {proposta.status === "recusada" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-[13px] text-slate-600">Proposta recusada. Se mudar de ideia, fale com seu consultor.</div>
          )}
          <button onClick={() => window.print()} className="mt-3 w-full text-center text-[12px] text-slate-400 underline">Baixar / imprimir em PDF</button>
        </div>
      </div>
    </main>
  );
}
