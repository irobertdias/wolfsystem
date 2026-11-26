"use client";
import { use, useEffect, useState } from "react";
import TelaExpirada from "../../components/TelaExpirada";
import { brl, brl0, kwpTxt, anosTxt, telhadoLabel, type ResultadoSolar } from "../../lib/solar";

// Proposta de energia solar que o cliente abre pelo link (sem login).

type Proposta = {
  numero: string; data: string; validade_ate: string | null; status: "aberta" | "aceita" | "recusada" | "expirada";
  cliente: { nome: string; cidade: string; estado: string; endereco: string };
  resultado: ResultadoSolar | null; entrada: { telhado: string; ligacao: string; tarifa: number | null };
  observacoes: string; condicoes: string; formas_pagamento: string[]; taxa_financiamento: number;
  empresa: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; cidade: string; logo: string; site: string };
  kit: { painel_marca: string; painel_garantia: string; inversor_marca: string; inversor_garantia: string; instalacao_garantia: string; prazo_instalacao: string };
  aceite: { em: string; pagamento: string; prazo: number | null } | null;
  recusa: { em: string; motivo: string } | null;
  visita: { data: string } | null;
};

const MOTIVOS = ["Achei caro", "Vou esperar mais um pouco", "Fechei com outra empresa", "Não tenho onde instalar", "Outro motivo"];

function Contador({ ate }: { ate: string }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(ate).getTime() - agora);
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const txt = d ? `${d}d ${h}h ${m}min` : h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}:${String(s).padStart(2, "0")}`;
  return <span className="font-mono">{txt}</span>;
}

export default function PropostaSolarPublica({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Proposta | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"" | "aceitar" | "recusar" | "visita">("");
  const [form, setForm] = useState({ pagamento: "", prazo: "", nome: "", cpf: "", endereco: "", obs: "", motivo: MOTIVOS[0], data: "" });
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    fetch(`/api/solar/publico/${token}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.success) { setErro(j.error || "Proposta não encontrada"); return; }
      setP(j.proposta);
      setForm((f) => ({ ...f, pagamento: j.proposta.formas_pagamento?.[0] || "", nome: j.proposta.cliente?.nome || "", endereco: j.proposta.cliente?.endereco || "", prazo: String(j.proposta.resultado?.parcelas?.[1]?.meses || j.proposta.resultado?.parcelas?.[0]?.meses || "") }));
    }).catch(() => setErro("Não foi possível abrir a proposta agora. Tente de novo em instantes."));
  }, [token]);

  const enviar = async (acao: string, extra: Record<string, any>) => {
    setEnviando(true); setAviso("");
    try {
      const r = await fetch(`/api/solar/publico/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, ...extra }) });
      const j = await r.json();
      if (!j.success) { setAviso(j.error || "Não deu certo. Tente de novo."); return; }
      setP(j.proposta); setAba("");
      setAviso(acao === "aceitar" ? "Proposta aprovada! A equipe vai falar com você para agendar a visita técnica." : acao === "visita" ? "Pedido de visita enviado. A equipe confirma o horário com você." : "Tudo bem, registramos sua resposta. Obrigado!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setAviso("Sem conexão. Tente de novo."); }
    finally { setEnviando(false); }
  };

  if (erro) return <main className="flex min-h-screen items-center justify-center bg-amber-50 p-6 text-center"><div><div className="text-5xl">☀️</div><h1 className="mt-4 text-xl font-extrabold text-slate-900">{erro}</h1><p className="mt-2 text-sm text-slate-500">Confira o link ou peça um novo para a empresa.</p></div></main>;
  if (!p) return <main className="flex min-h-screen items-center justify-center bg-amber-50 text-slate-500">Carregando sua proposta…</main>;
  if (p.status === "expirada") return <TelaExpirada titulo="Proposta expirada" numero={p.numero} expiraEm={p.validade_ate || p.data} contato={p.empresa.nome || "a empresa"} whatsapp={p.empresa.telefone} cor="#D97706" />;

  const r = p.resultado;
  const emp = p.empresa;
  const zapEmpresa = String(emp.telefone || "").replace(/\D/g, "");
  const linkZap = zapEmpresa ? `https://wa.me/${zapEmpresa.length <= 11 ? "55" + zapEmpresa : zapEmpresa}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre a proposta solar ${p.numero}.`)}` : "";
  const financiamento = /financ/i.test(form.pagamento);
  const cartao = /cart/i.test(form.pagamento);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const input = "w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-amber-500";

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white pb-16 text-slate-900 print:bg-white">
      <header className="mx-auto flex max-w-4xl items-center gap-3 px-5 pt-6">
        {/^https?:\/\//.test(emp.logo) ? <img src={emp.logo} alt={emp.nome} className="h-12 w-auto max-w-[160px] object-contain" /> : <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-2xl">☀️</span>}
        <div className="min-w-0">
          <div className="truncate text-[17px] font-extrabold">{emp.nome || "Energia solar"}</div>
          <div className="text-[12.5px] text-slate-500">{[emp.cnpj && `CNPJ ${emp.cnpj}`, emp.cidade].filter(Boolean).join(" · ")}</div>
        </div>
        <a href={`/solar/${token}/pdf`} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-[13px] font-extrabold text-white shadow-sm print:hidden">⬇ Baixar PDF</a>
      </header>

      <section className="mx-auto mt-6 max-w-4xl px-5">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 p-6 text-white shadow-[0_30px_60px_-30px_rgba(234,88,12,.8)] sm:p-9">
          <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-yellow-200/30 blur-2xl" />
          <div className="relative">
            <div className="text-[13px] font-bold uppercase tracking-wider text-white/85">Proposta {p.numero} · para {p.cliente.nome.split(" ")[0]}</div>
            {r ? <>
              <h1 className="mt-3 text-[28px] font-black leading-tight sm:text-[40px]">Sua conta de luz de {brl0(r.conta_antes)} vai para cerca de {brl0(r.conta_depois)}</h1>
              <p className="mt-3 text-[15px] text-white/90">Economia estimada de <b>{brl(r.economia_mes)} por mês</b>, cerca de <b>{brl0(r.economia_25)}</b> em 25 anos.</p>
            </> : <h1 className="mt-3 text-[28px] font-black">Sua proposta de energia solar</h1>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {p.status === "aberta" && p.validade_ate && <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[13px] font-bold">Condição válida por <Contador ate={p.validade_ate} /></div>}
              <a href={`/solar/${token}/pdf`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-extrabold text-orange-700 shadow-md print:hidden">⬇ Baixar a proposta completa em PDF</a>
            </div>
          </div>
        </div>
      </section>

      {(aviso || p.status !== "aberta") && (
        <section className="mx-auto mt-4 max-w-4xl px-5">
          <div className={`rounded-2xl p-4 text-[14px] font-semibold ${p.status === "recusada" ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"}`}>
            {aviso || (p.status === "aceita" ? `✅ Proposta aprovada em ${new Date(p.aceite!.em).toLocaleDateString("pt-BR")}${p.aceite?.pagamento ? ` · ${p.aceite.pagamento}${p.aceite.prazo ? ` em ${p.aceite.prazo}x` : ""}` : ""}. A equipe vai agendar a visita técnica.` : "Esta proposta foi recusada. Se mudar de ideia, fale com a gente.")}
          </div>
        </section>
      )}

      {r && (
        <section className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-3 px-5 sm:grid-cols-3">
          {[
            ["Potência", kwpTxt(r.kwp)], ["Painéis", `${r.paineis} × ${r.painel_w} W`], ["Geração", `${r.geracao_kwh} kWh/mês`],
            ["Economia anual", brl0(r.economia_ano)], ["Retorno", anosTxt(r.payback_anos)], ["Área no telhado", `${String(r.area_m2).replace(".", ",")} m²`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_12px_28px_-18px_rgba(180,83,9,.35)] ring-1 ring-amber-100">
              <div className="text-[12px] font-bold text-slate-500">{k}</div>
              <div className="mt-1 text-[19px] font-black text-slate-900">{v}</div>
            </div>
          ))}
        </section>
      )}

      {r && (
        <section className="mx-auto mt-6 max-w-4xl px-5">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-amber-100">
            <h2 className="text-[17px] font-extrabold">Sua conta de luz, antes e depois</h2>
            <div className="mt-5 space-y-4">
              {[["Hoje", r.conta_antes, "bg-slate-400"], ["Com energia solar", r.conta_depois, "bg-gradient-to-r from-amber-400 to-orange-500"]].map(([k, v, c]) => (
                <div key={String(k)}>
                  <div className="flex text-[13.5px]"><span className="text-slate-600">{k}</span><b className="ml-auto">{brl(Number(v))}/mês</b></div>
                  <div className="mt-1.5 h-4 rounded-full bg-slate-100"><div className={`h-full rounded-full ${c}`} style={{ width: `${Math.max(4, (Number(v) / Math.max(1, r.conta_antes)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] text-slate-500">Consumo considerado: {r.consumo_kwh} kWh/mês · tarifa {brl(r.tarifa)}/kWh · sol médio de {String(r.hsp).replace(".", ",")} h/dia em {r.uf}. A conta continua com a taxa mínima da distribuidora ({r.minimo_kwh} kWh) e a iluminação pública.</p>
          </div>
        </section>
      )}

      {r && (
        <section className="mx-auto mt-6 grid max-w-4xl gap-4 px-5 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-amber-100">
            <h2 className="text-[17px] font-extrabold">O que está incluso</h2>
            <ul className="mt-4 space-y-2.5">
              {r.itens.map((x) => <li key={x} className="flex gap-2 text-[14px] text-slate-700"><span className="text-amber-500">✓</span>{x}</li>)}
            </ul>
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900">
              <b>Garantias:</b> módulos {p.kit.painel_garantia}; inversor {p.kit.inversor_garantia}; {p.kit.instalacao_garantia}.<br />
              <b>Prazo:</b> {p.kit.prazo_instalacao}.<br />
              <b>Telhado:</b> {telhadoLabel(p.entrada.telhado)}.
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6 ring-1 ring-amber-100">
            <h2 className="text-[17px] font-extrabold">Investimento</h2>
            <div className="mt-3 text-[34px] font-black text-slate-900">{brl(r.preco)}</div>
            {r.desconto > 0 && <div className="text-[13px] font-bold text-emerald-700">Já com {brl(r.desconto)} de desconto</div>}
            <div className="mt-4 space-y-2">
              {r.parcelas.map((x) => (
                <div key={x.meses} className="flex items-center rounded-xl bg-slate-50 px-3 py-2.5 text-[14px]">
                  <span className="text-slate-600">Financiado em {x.meses}x</span>
                  <b className="ml-auto">{brl(x.valor)}</b>
                  {x.valor <= r.conta_antes && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">menor que a conta</span>}
                </div>
              ))}
              {r.cartao && <div className="flex rounded-xl bg-slate-50 px-3 py-2.5 text-[14px]"><span className="text-slate-600">Cartão em até {r.cartao.meses}x</span><b className="ml-auto">{brl(r.cartao.valor)}</b></div>}
            </div>
            {r.entrada > 0 && <p className="mt-2 text-[12px] text-slate-500">Financiamento com entrada de {brl(r.entrada)}.</p>}
            <p className="mt-3 text-[12px] text-slate-500">Parcelas estimadas com juros de {String(p.taxa_financiamento).replace(".", ",")}% a.m., sujeitas à aprovação de crédito.</p>
          </div>
        </section>
      )}

      {(p.observacoes || p.condicoes) && (
        <section className="mx-auto mt-6 max-w-4xl px-5">
          <div className="rounded-3xl bg-white p-6 text-[13.5px] leading-relaxed text-slate-600 ring-1 ring-amber-100">
            {p.observacoes && <p><b className="text-slate-800">Observações:</b> {p.observacoes}</p>}
            {p.condicoes && <p className={p.observacoes ? "mt-2" : ""}><b className="text-slate-800">Condições:</b> {p.condicoes}</p>}
          </div>
        </section>
      )}

      {p.status === "aberta" && (
        <section className="mx-auto mt-6 max-w-4xl px-5 print:hidden">
          <div className="rounded-3xl bg-white p-6 shadow-[0_20px_50px_-30px_rgba(180,83,9,.5)] ring-1 ring-amber-200">
            <h2 className="text-[19px] font-extrabold">Vamos colocar o sol para trabalhar para você?</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setAba("aceitar")} className={`rounded-2xl px-5 py-3 text-[15px] font-extrabold ${aba === "aceitar" ? "bg-orange-600 text-white" : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"}`}>Aprovar proposta</button>
              <button onClick={() => setAba("visita")} className={`rounded-2xl px-5 py-3 text-[15px] font-bold ring-1 ring-amber-300 ${aba === "visita" ? "bg-amber-100" : "bg-white"} text-amber-900`}>Agendar visita técnica</button>
              <button onClick={() => setAba("recusar")} className="rounded-2xl bg-white px-4 py-3 text-[14px] font-bold text-slate-500 ring-1 ring-slate-200">Não tenho interesse</button>
            </div>
            {aviso && <p className="mt-3 text-[13.5px] font-semibold text-red-700">{aviso}</p>}

            {aba === "aceitar" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-[12.5px] font-bold text-slate-600">Forma de pagamento<select className={input} value={form.pagamento} onChange={(e) => set("pagamento", e.target.value)}>{p.formas_pagamento.map((x) => <option key={x}>{x}</option>)}</select></label>
                {financiamento && r && <label className="text-[12.5px] font-bold text-slate-600">Prazo do financiamento<select className={input} value={form.prazo} onChange={(e) => set("prazo", e.target.value)}>{r.parcelas.map((x) => <option key={x.meses} value={x.meses}>{x.meses}x de {brl(x.valor)}</option>)}</select></label>}
                {cartao && r?.cartao && <label className="text-[12.5px] font-bold text-slate-600">Parcelas no cartão<select className={input} value={form.prazo} onChange={(e) => set("prazo", e.target.value)}>{Array.from({ length: r.cartao.meses }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}x de {brl(r.preco / m)}</option>)}</select></label>}
                <label className="text-[12.5px] font-bold text-slate-600">Nome completo<input className={input} value={form.nome} onChange={(e) => set("nome", e.target.value)} /></label>
                <label className="text-[12.5px] font-bold text-slate-600">CPF ou CNPJ<input className={input} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} /></label>
                <label className="text-[12.5px] font-bold text-slate-600 sm:col-span-2">Endereço da instalação<input className={input} value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número, bairro, cidade" /></label>
                <label className="text-[12.5px] font-bold text-slate-600 sm:col-span-2">Alguma observação?<input className={input} value={form.obs} onChange={(e) => set("obs", e.target.value)} /></label>
                <button disabled={enviando || !form.nome.trim()} onClick={() => enviar("aceitar", { pagamento: form.pagamento, prazo: financiamento || cartao ? form.prazo : null, nome: form.nome, cpf: form.cpf, endereco: form.endereco, obs: form.obs })} className="rounded-2xl bg-orange-600 px-5 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-50 sm:col-span-2">{enviando ? "Enviando…" : "Confirmar aprovação"}</button>
                <p className="text-[12px] text-slate-500 sm:col-span-2">Ao aprovar, a equipe agenda a visita técnica para conferir o telhado e a parte elétrica. O valor final é confirmado nessa visita.</p>
              </div>
            )}
            {aba === "visita" && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-[12.5px] font-bold text-slate-600">Melhor dia e horário<input className={input} value={form.data} onChange={(e) => set("data", e.target.value)} placeholder="Ex.: sábado de manhã" /></label>
                <label className="text-[12.5px] font-bold text-slate-600">Endereço<input className={input} value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></label>
                <button disabled={enviando} onClick={() => enviar("visita", { data: form.data, endereco: form.endereco, obs: form.obs })} className="rounded-2xl bg-amber-500 px-5 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-50 sm:col-span-2">{enviando ? "Enviando…" : "Pedir visita técnica"}</button>
              </div>
            )}
            {aba === "recusar" && (
              <div className="mt-5 grid gap-3">
                <label className="text-[12.5px] font-bold text-slate-600">Pode contar o motivo?<select className={input} value={form.motivo} onChange={(e) => set("motivo", e.target.value)}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <input className={input} value={form.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Comentário (opcional)" />
                <button disabled={enviando} onClick={() => enviar("recusar", { motivo: [form.motivo, form.obs].filter(Boolean).join(" — ") })} className="rounded-2xl bg-slate-700 px-5 py-3 text-[14px] font-bold text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar resposta"}</button>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="mx-auto mt-8 max-w-4xl px-5 text-center text-[12px] text-slate-400">
        {linkZap && <a href={linkZap} target="_blank" rel="noreferrer" className="mb-4 inline-flex rounded-2xl bg-[#25D366] px-5 py-3 text-[14px] font-bold text-white print:hidden">Tirar dúvidas no WhatsApp</a>}
        <div>{[emp.nome, emp.telefone, emp.email, emp.site].filter(Boolean).join(" · ")}</div>
        <div className="mt-1">Valores estimados com a irradiação média da região. Confirmados na visita técnica.</div>
      </footer>
    </main>
  );
}
