"use client";
import { use, useEffect, useMemo, useState } from "react";
import { brl, brl0, anosTxt, telhadoLabel, type ResultadoSolar, type AnoSolar } from "../../../lib/solar";

// Proposta solar em formato de documento (A4) para salvar em PDF ou imprimir.
// Abre pelo mesmo token do link público: /solar/[token]/pdf

type Proposta = {
  numero: string; data: string; validade_ate: string | null; status: string;
  cliente: { nome: string; cidade: string; estado: string; endereco: string };
  resultado: ResultadoSolar | null; entrada: { telhado: string; ligacao: string; tarifa: number | null };
  observacoes: string; condicoes: string; formas_pagamento: string[]; taxa_financiamento: number; parcela_banco?: boolean;
  reajuste_aa?: number; degradacao_aa?: number; distribuidora?: string;
  empresa: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; cidade: string; logo: string; site: string; instagram?: string };
  kit: { painel_marca: string; painel_garantia: string; inversor_marca: string; inversor_garantia: string; instalacao_garantia: string; prazo_instalacao: string; estrutura_garantia?: string };
  aceite: { em: string; pagamento: string; prazo: number | null } | null;
};

const LIG: Record<string, string> = { mono: "Monofásica", bi: "Bifásica", tri: "Trifásica" };
const dataBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
const num = (v: number, d = 0) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const curto = (v: number) => (v >= 1e6 ? `R$ ${num(v / 1e6, 2)} mi` : v >= 1e3 ? `R$ ${num(v / 1e3, 0)} mil` : brl0(v));

/** Propostas antigas não têm a série de 25 anos: refaz com a economia e o reajuste. */
function serie(r: ResultadoSolar, reaj = 5, degr = 0): AnoSolar[] {
  if (r.anos?.length) return r.anos;
  let saldo = -r.preco;
  return Array.from({ length: 25 }, (_, a) => {
    const f = Math.pow(1 + reaj / 100, a);
    const eco = r.economia_ano * f * Math.pow(1 - degr / 100, a);
    const sem = r.conta_antes * 12 * f;
    saldo += eco;
    return { ano: a + 1, sem: Math.round(sem), com: Math.round(sem - eco), economia: Math.round(eco), saldo: Math.round(saldo) };
  });
}

function Sol({ size = 420 }: { size?: number }) {
  const raios = Array.from({ length: 48 });
  return (
    <svg width={size} height={size} viewBox="-210 -210 420 420" aria-hidden>
      <defs>
        <radialGradient id="nucleo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(120)">
          <stop offset="0" stopColor="#FFF7D6" />
          <stop offset=".45" stopColor="#FFD86B" />
          <stop offset=".8" stopColor="#E7A928" />
          <stop offset="1" stopColor="#B8761A" />
        </radialGradient>
        <radialGradient id="halo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(210)">
          <stop offset=".25" stopColor="#FFD86B" stopOpacity=".55" />
          <stop offset=".6" stopColor="#E7A928" stopOpacity=".12" />
          <stop offset="1" stopColor="#E7A928" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="210" fill="url(#halo)" />
      {raios.map((_, i) => {
        const a = (i / raios.length) * Math.PI * 2, longo = i % 2 === 0;
        const r1 = 104, r2 = longo ? 188 : 150;
        return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} stroke="#FFE39A" strokeOpacity={longo ? 0.55 : 0.3} strokeWidth={longo ? 1.6 : 1} strokeLinecap="round" />;
      })}
      <circle r="92" fill="url(#nucleo)" />
      <circle r="92" fill="none" stroke="#FFF3C4" strokeOpacity=".7" strokeWidth="1.2" />
      <circle r="70" fill="none" stroke="#FFFBEA" strokeOpacity=".35" strokeWidth=".8" />
    </svg>
  );
}

/** Campo de módulos em perspectiva (rodapé da capa). */
function CampoSolar() {
  const linhas = 9, colunas = 14;
  const L: React.ReactNode[] = [];
  const W = 794, H = 300, horizonte = 0, base = H;
  const x = (c: number, y: number) => { const t = (y - horizonte) / (base - horizonte); const larg = 300 + t * (W * 1.9 - 300); return W / 2 - larg / 2 + (c / colunas) * larg; };
  const ys = Array.from({ length: linhas + 1 }, (_, i) => horizonte + Math.pow(i / linhas, 1.7) * (base - horizonte));
  for (let i = 0; i < linhas; i++) for (let c = 0; c < colunas; c++) {
    const y0 = ys[i], y1 = ys[i + 1];
    const pts = `${x(c, y0) + 1.5},${y0 + 1} ${x(c + 1, y0) - 1.5},${y0 + 1} ${x(c + 1, y1) - 1.5},${y1 - 1} ${x(c, y1) + 1.5},${y1 - 1}`;
    L.push(<polygon key={`${i}-${c}`} points={pts} fill="url(#celula)" stroke="#E7B54A" strokeOpacity={0.25 + (i / linhas) * 0.45} strokeWidth={0.6 + (i / linhas)} />);
  }
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id="celula" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F3B4F" />
          <stop offset=".55" stopColor="#0A2533" />
          <stop offset="1" stopColor="#06141C" />
        </linearGradient>
        <linearGradient id="reflexo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFD86B" stopOpacity="0" />
          <stop offset=".5" stopColor="#FFE9A8" stopOpacity=".5" />
          <stop offset="1" stopColor="#FFD86B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {L}
      <polygon points={`${W / 2 - 40},0 ${W / 2 + 40},0 ${W / 2 + 260},${H} ${W / 2 - 260},${H}`} fill="url(#reflexo)" opacity=".35" />
    </svg>
  );
}

function Grafico25({ anos, preco, payback }: { anos: AnoSolar[]; preco: number; payback: number }) {
  const W = 640, H = 270, pl = 70, pr = 16, pt = 18, pb = 30;
  const pts = [{ ano: 0, saldo: -preco }, ...anos.map((a) => ({ ano: a.ano, saldo: a.saldo }))];
  const max = Math.max(...pts.map((p) => p.saldo), 1), min = Math.min(...pts.map((p) => p.saldo), 0);
  const X = (a: number) => pl + (a / 25) * (W - pl - pr);
  const Y = (v: number) => pt + ((max - v) / (max - min)) * (H - pt - pb);
  const linha = pts.map((p, i) => `${i ? "L" : "M"}${X(p.ano).toFixed(1)},${Y(p.saldo).toFixed(1)}`).join(" ");
  const area = `${linha} L${X(25)},${Y(0)} L${X(0)},${Y(0)} Z`;
  // rótulos do eixo sem encavalar (o investimento costuma ficar colado no zero)
  const marcas = [0, max / 2, max, min].filter((v, i, a) => a.indexOf(v) === i && a.slice(0, i).every((u) => Math.abs(Y(u) - Y(v)) > 16));
  const pb2 = Math.min(payback, 25);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-label="Saldo acumulado em 25 anos">
      <defs>
        <linearGradient id="g25" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3B547" stopOpacity=".55" />
          <stop offset="1" stopColor="#E3B547" stopOpacity=".02" />
        </linearGradient>
        <clipPath id="acima"><rect x="0" y="0" width={W} height={Y(0)} /></clipPath>
        <clipPath id="abaixo"><rect x="0" y={Y(0)} width={W} height={H} /></clipPath>
      </defs>
      {marcas.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? "#0E4D34" : "#0E4D34"} strokeOpacity={v === 0 ? 0.55 : 0.1} strokeDasharray={v === 0 ? "0" : "3 4"} />
          <text x={pl - 8} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="#5B6B63">{curto(v)}</text>
        </g>
      ))}
      {[0, 5, 10, 15, 20, 25].map((a) => <text key={a} x={X(a)} y={H - 10} textAnchor="middle" fontSize="10" fill="#5B6B63">{a === 0 ? "hoje" : `ano ${a}`}</text>)}
      <path d={area} fill="url(#g25)" clipPath="url(#acima)" />
      <path d={area} fill="#C2410C" fillOpacity=".12" clipPath="url(#abaixo)" />
      <path d={linha} fill="none" stroke="#0E4D34" strokeWidth="2.4" strokeLinejoin="round" />
      {pb2 > 0 && <>
        <line x1={X(pb2)} x2={X(pb2)} y1={pt} y2={H - pb} stroke="#B8862B" strokeDasharray="2 3" />
        <circle cx={X(pb2)} cy={Y(0)} r="5.5" fill="#E3B547" stroke="#fff" strokeWidth="2" />
        <text x={X(pb2) + 9} y={pt + 12} fontSize="11" fontWeight="700" fill="#8A6314">investimento pago em {anosTxt(payback)}</text>
      </>}
      <circle cx={X(25)} cy={Y(pts[pts.length - 1].saldo)} r="4.5" fill="#0E4D34" />
    </svg>
  );
}

export default function PropostaSolarPDF({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Proposta | null>(null);
  const [erro, setErro] = useState("");
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    fetch(`/api/solar/publico/${token}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (!j.success) { setErro(j.error || "Proposta não encontrada"); return; }
      setP(j.proposta);
    }).catch(() => setErro("Não foi possível abrir a proposta agora."));
  }, [token]);

  useEffect(() => {
    const ajustar = () => setEscala(Math.min(1, (window.innerWidth - 24) / 794));
    ajustar(); window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  useEffect(() => { if (p) document.title = `Proposta ${p.numero} · ${p.cliente.nome} · ${p.empresa.nome || "Energia solar"}`; }, [p]);

  const r = p?.resultado || null;
  const anos = useMemo(() => (r && p ? serie(r, p.reajuste_aa ?? 5, p.degradacao_aa ?? 0) : []), [r, p]);

  if (erro) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#04140D", color: "#F5E7C1", fontFamily: "system-ui", padding: 24, textAlign: "center" }}><div><div style={{ fontSize: 44 }}>☀️</div><h1 style={{ fontSize: 20, fontWeight: 800 }}>{erro}</h1><p style={{ opacity: .7 }}>Confira o link ou peça um novo para a empresa.</p></div></main>;
  if (!p || !r) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#04140D", color: "#F5E7C1", fontFamily: "system-ui" }}>Preparando sua proposta…</main>;

  const emp = p.empresa;
  const kit = p.kit;
  const primeiro = p.cliente.nome.trim().split(/\s+/)[0] || p.cliente.nome;
  const rodape = [emp.telefone, emp.email, emp.instagram].filter(Boolean).join("  ·  ");
  const reducao = r.conta_antes > 0 ? Math.round((1 - r.conta_depois / r.conta_antes) * 100) : 0;
  const validade = p.validade_ate ? new Date(p.validade_ate) : null;
  const diasValidade = validade ? Math.max(0, Math.ceil((validade.getTime() - Date.now()) / 86400000)) : 0;
  const local = [p.cliente.cidade, p.cliente.estado].filter(Boolean).join(" - ");
  const temLogo = /^https?:\/\//.test(emp.logo || "") || /^\//.test(emp.logo || "");
  const maxBarra = Math.max(r.consumo_kwh, r.geracao_kwh, 1);
  const totalSem = r.conta_25_sem || anos.reduce((s, a) => s + a.sem, 0);
  const totalCom = r.conta_25_com || anos.reduce((s, a) => s + a.com, 0);
  const cartoes = r.cartoes?.length ? r.cartoes : r.cartao ? [{ meses: r.cartao.meses, valor: r.cartao.valor, total: r.cartao.valor * r.cartao.meses, acrescimo_pct: 0 }] : [];
  const linkAceite = typeof window !== "undefined" ? `${window.location.origin}/solar/${token}` : "";
  const PAGINAS = 7;
  const distrib = (p.distribuidora || "").replace(/\s+(Distribuidora de Energia|S\.?A\.?).*$/i, "").trim() || "distribuidora";
  const taxaMin = Math.round((r.minimo_kwh || 0) * (r.tarifa || 0));
  const cobre = Math.min(r.cobertura_pct || 100, 100);
  const maiorCartao = cartoes.length ? cartoes[cartoes.length - 1] : null;
  const maiorFin = r.parcelas.length ? r.parcelas[r.parcelas.length - 1] : null;
  const qtdInv = r.inversor_tipo === "micro" ? parseInt(r.inversor, 10) || 1 : 1;
  const telhado = telhadoLabel(p.entrada.telhado).split(" /")[0].toLowerCase();
  // "Troque a conta pela parcela": quanto sai por mês em cada caminho
  const cenarios: { t: string; s: string; parcela: number; conta: number; tom: string }[] = [
    { t: "Hoje, sem energia solar", s: "só a conta de luz", parcela: 0, conta: r.conta_antes, tom: "ruim" },
    ...(maiorCartao ? [{ t: `Pagando no cartão em ${maiorCartao.meses}x`, s: `parcela + conta nova, por ${maiorCartao.meses} meses`, parcela: maiorCartao.valor, conta: r.conta_depois, tom: "meio" }] : []),
    ...(maiorFin ? [{ t: `Financiado em ${maiorFin.meses}x`, s: `parcela + conta nova (simulação)`, parcela: maiorFin.valor, conta: r.conta_depois, tom: "meio" }] : []),
    { t: "Depois de quitado", s: "só a conta nova, por mais de 20 anos", parcela: 0, conta: r.conta_depois, tom: "bom" },
  ];
  const maxCen = Math.max(...cenarios.map((c) => c.parcela + c.conta), 1);
  const itensCompra: [string, string, string, string][] = [
    [String(r.paineis), `Placas solares ${kit.painel_marca ? `${kit.painel_marca} ` : ""}de ${r.painel_w} W`, "Captam a luz do sol e transformam em energia elétrica.", kit.painel_garantia],
    [String(qtdInv), r.inversor_tipo === "micro" ? `Microinversores ${kit.inversor_marca || ""}`.trim() : `Inversor ${kit.inversor_marca || ""} de ${num(r.inversor_kw, 1)} kW`.replace("  ", " "), "É o “cérebro”: transforma a energia das placas na energia da sua tomada e mostra a produção no celular.", kit.inversor_garantia],
    ["1", `Estrutura de fixação para ${telhado}`, "Prende as placas no telhado com segurança e vedação, sem goteira.", kit.estrutura_garantia || "—"],
    ["1", "Cabos solares, conectores e proteções elétricas", "Levam a energia com segurança e protegem contra surtos, raios e curto-circuito.", "—"],
    ["1", "Projeto elétrico e ART", "Feito e assinado por engenheiro eletricista responsável.", "—"],
    ["1", `Homologação na ${distrib}`, `Cuidamos de toda a papelada com a ${distrib} até a troca do seu medidor.`, "—"],
    ["1", "Instalação completa", "Equipe especializada, do telhado ao quadro de energia, com tudo funcionando.", kit.instalacao_garantia],
    ["1", "Monitoramento pelo aplicativo", "Você acompanha quanto está gerando, de qualquer lugar, pelo celular.", "—"],
  ];

  const Cabeca = ({ n, titulo, sub }: { n: string; titulo: string; sub?: string }) => (
    <header className="sp-cab">
      <div className="sp-cab-n">{n}</div>
      <div>
        <div className="sp-cab-t">{titulo}</div>
        {sub ? <div className="sp-cab-s">{sub}</div> : null}
      </div>
      <div className="sp-cab-marca">{temLogo ? <img src={emp.logo} alt={emp.nome} /> : emp.nome}</div>
    </header>
  );
  const Rodape = ({ pg }: { pg: number }) => (
    <footer className="sp-rod"><span>{rodape}</span><span>Proposta {p.numero} · {dataBR(p.data)} · {pg}/{PAGINAS}</span></footer>
  );

  return (
    <main className="sp-fundo">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="sp-barra">
        <div className="sp-barra-in">
          <div className="sp-barra-t"><b>{emp.nome || "Proposta solar"}</b><span>Proposta {p.numero} · {p.cliente.nome}</span></div>
          <a className="sp-btn sp-btn-2" href={`/solar/${token}`}>{p.aceite ? "Ver proposta" : "Aprovar online"}</a>
          <button className="sp-btn" onClick={() => window.print()}>Baixar PDF</button>
        </div>
      </div>

      <div className="sp-folhas" style={{ zoom: escala } as React.CSSProperties}>
        {/* ───────────── 1 · CAPA ───────────── */}
        <section className="sp-pg sp-capa">
          {/* Capa clara: pouca tinta na impressão, logo do cliente em destaque. */}
          <div className="sp-capa-topo">
            <div className="sp-capa-tag">Proposta comercial</div>
            <div className="sp-capa-num"><span>Proposta</span><b>{p.numero}</b><span>{dataBR(p.data)}</span></div>
          </div>

          <div className="sp-capa-logo">
            {temLogo ? <img src={emp.logo} alt={emp.nome} /> : <div className="sp-capa-nome"><b>{emp.nome || "Energia Solar"}</b><span>{emp.cidade || "Energia solar"}</span></div>}
          </div>
          <div className="sp-capa-linha" />

          <div className="sp-capa-centro">
            <div className="sp-capa-pre">Proposta comercial · sistema on-grid</div>
            <h1 className="sp-capa-h1">A energia do sol,<br /><em>trabalhando para você.</em></h1>
            <div className="sp-capa-para">Preparada para</div>
            <div className="sp-capa-cliente">{p.cliente.nome}</div>
            {local ? <div className="sp-capa-local">{local}</div> : null}
          </div>

          <div className="sp-capa-kpis">
            <div><b>{r.paineis}</b><span>placas solares no seu telhado</span></div>
            <div><b>{num(r.geracao_kwh)} kWh</b><span>de energia gerada por mês</span></div>
            <div><b>{brl0(r.conta_depois)}</b><span>sua conta de luz depois</span></div>
            <div className="sp-ouro"><b>{brl0(r.economia_mes)}</b><span>que você economiza por mês</span></div>
          </div>

          {r.campanha ? <div className="sp-capa-fita">{r.campanha} · condição especial</div> : null}

          <div className="sp-capa-rod">{rodape}</div>
        </section>

        {/* ───────────── 2 · RESUMO EM 1 MINUTO ───────────── */}
        <section className="sp-pg">
          <Cabeca n="01" titulo={`${primeiro}, sua proposta em 1 minuto`} sub="Tudo o que importa, sem termo técnico" />
          <ol className="sp-res">
            <li><i>1</i><span>Hoje você paga cerca de <b>{brl(r.conta_antes)}</b> de luz por mês, para um consumo de {num(r.consumo_kwh)} kWh.</span></li>
            <li><i>2</i><span>Vamos instalar <b>{r.paineis} placas solares</b> no seu telhado. Elas produzem cerca de <b>{num(r.geracao_kwh)} kWh por mês</b>{cobre >= 95 ? ", praticamente toda a energia que você usa" : `, cerca de ${cobre}% do que você usa`}.</span></li>
            <li><i>3</i><span>Sua conta cai para cerca de <b>{brl(r.conta_depois)}</b> por mês. O que sobra é a taxa mínima da {distrib} e o uso da rede elétrica (explicamos no fim da página).</span></li>
            <li><i>4</i><span>Você deixa de pagar <b>{brl(r.economia_mes)} por mês</b>, ou <b>{brl0(r.economia_ano)}</b> só no primeiro ano.</span></li>
            <li><i>5</i><span>O sistema completo, <b>instalado e aprovado na {distrib}</b>, sai por <b>{brl(r.preco)}</b> à vista{maiorCartao ? <> ou <b>{maiorCartao.meses}x de {brl(maiorCartao.valor)}</b> no cartão</> : null}.</span></li>
            <li><i>6</i><span>Com o que você economiza, o sistema <b>se paga em {anosTxt(r.payback_anos)}</b>. Depois disso, a economia é toda sua por mais de 20 anos.</span></li>
          </ol>

          <div className="sp-troca">
            <div className="sp-bloco-t">Troque a conta de luz pela parcela · quanto sai por mês</div>
            {cenarios.map((c) => (
              <div key={c.t} className={`sp-cen sp-cen-${c.tom}`}>
                <div className="sp-cen-t"><b>{c.t}</b><span>{c.s}</span></div>
                <div className="sp-cen-b">
                  {c.parcela > 0 ? <i className="sp-cen-p" style={{ width: `${(c.parcela / maxCen) * 100}%` }} /> : null}
                  <i className="sp-cen-c" style={{ width: `${Math.max((c.conta / maxCen) * 100, 1.5)}%` }} />
                </div>
                <div className="sp-cen-v">{brl(c.parcela + c.conta)}</div>
              </div>
            ))}
            <div className="sp-cen-leg"><span><i className="sp-cen-c" />conta de luz</span><span><i className="sp-cen-p" />parcela do sistema</span></div>
          </div>

          <div className="sp-zera">
            <b>Por que a conta não chega a zero?</b>
            <span>Todo imóvel ligado à rede paga uma taxa mínima de energia ({LIG[r.ligacao] || "sua ligação"}: {r.minimo_kwh} kWh{taxaMin ? `, cerca de ${brl0(taxaMin)}` : ""}), mais a iluminação pública da prefeitura. Pela lei da energia solar (Lei 14.300), uma pequena parte da energia que você manda para a rede também paga o uso dos fios. Tudo isso <b>já está descontado</b> nos valores desta proposta.</span>
          </div>
          <Rodape pg={2} />
        </section>

        {/* ───────────── 3 · ANÁLISE ───────────── */}
        <section className="sp-pg sp-pg-analise">
          <Cabeca n="02" titulo="Sua economia" sub={`Estimativas com base no seu consumo médio de ${num(r.consumo_kwh)} kWh por mês`} />
          <div className="sp-heroi">
            <div className="sp-heroi-esq">
              <div className="sp-rot">Sua conta de luz</div>
              <div className="sp-antes">{brl(r.conta_antes)}</div>
              <div className="sp-seta">↓</div>
              <div className="sp-depois">{brl(r.conta_depois)}</div>
              <div className="sp-heroi-nota">por mês, em média, com o sistema funcionando</div>
            </div>
            <div className="sp-heroi-dir">
              <svg viewBox="0 0 200 200" width="190" height="190" aria-hidden>
                <circle cx="100" cy="100" r="80" fill="none" stroke="#E8EFEA" strokeWidth="16" />
                <circle cx="100" cy="100" r="80" fill="none" stroke="url(#arco)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(reducao / 100) * 502.6} 502.6`} transform="rotate(-90 100 100)" />
                <defs><linearGradient id="arco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E3B547" /><stop offset="1" stopColor="#0E4D34" /></linearGradient></defs>
                <text className="sp-serif" x="100" y="104" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="46" fontWeight="900" fill="#0B3324">{reducao}%</text>
                <text x="100" y="130" textAnchor="middle" fontSize="12" fill="#5B6B63" fontWeight="700">menos na conta</text>
              </svg>
            </div>
          </div>

          <div className="sp-kpis">
            <div className="sp-kpi sp-kpi-d"><span>Economia por mês</span><b>{brl(r.economia_mes)}</b></div>
            <div className="sp-kpi"><span>Economia no 1º ano</span><b>{brl(r.economia_ano)}</b></div>
            <div className="sp-kpi"><span>O sistema se paga em</span><b>{anosTxt(r.payback_anos)}</b></div>
            <div className="sp-kpi sp-kpi-o"><span>Economia em 25 anos</span><b>{brl0(r.economia_25)}</b></div>
          </div>

          <div className="sp-bloco">
            <div className="sp-bloco-t">O que você gasta × o que as placas produzem</div>
            <div className="sp-barras">
              <div className="sp-barra-l"><span>Seu consumo</span><div><i style={{ width: `${(r.consumo_kwh / maxBarra) * 100}%` }} className="sp-i-c" /></div><b>{num(r.consumo_kwh)} kWh</b></div>
              <div className="sp-barra-l"><span>Geração do sistema</span><div><i style={{ width: `${(r.geracao_kwh / maxBarra) * 100}%` }} className="sp-i-g" /></div><b>{num(r.geracao_kwh)} kWh</b></div>
            </div>
            <p className="sp-p">O sistema foi dimensionado para gerar <b>{num(r.geracao_kwh)} kWh por mês</b>, cobrindo {Math.min(r.cobertura_pct || 100, 999)}% do consumo considerado. O que sobra durante o dia vira crédito na distribuidora e abate a energia que você usa à noite.</p>
          </div>

          <div className="sp-duo">
            <div className="sp-verde">
              <div className="sp-verde-t">Impacto ambiental em 25 anos</div>
              <div className="sp-verde-k"><b>{num(r.co2_ton_25 || (r.geracao_kwh * 12 * 25 * 0.0817) / 1000, 1)} t</b><span>de CO₂ que deixam de ir para a atmosfera</span></div>
              <div className="sp-verde-k"><b>{num(r.arvores || 0)}</b><span>árvores plantadas, em equivalência</span></div>
            </div>
            <div className="sp-claro">
              <div className="sp-bloco-t">Como fizemos a conta</div>
              <ul className="sp-lista">
                <li>Preço da energia hoje: <b>{brl(r.tarifa)} por kWh</b></li>
                <li>Seu consumo médio: <b>{num(r.consumo_kwh)} kWh por mês</b></li>
                <li>Ligação <b>{(LIG[r.ligacao] || r.ligacao).toLowerCase()}</b> · {r.uf}</li>
                <li>A energia sobe em média <b>{num(p.reajuste_aa ?? 5, 1)}% ao ano</b></li>
              </ul>
            </div>
          </div>
          <div className="sp-benef">
            {[
              ["$", "Conta lá embaixo", "Sobra só a taxa mínima e encargos."],
              ["▲", "Protege da inflação", "A energia sobe; a sua geração, não."],
              ["⌂", "Valoriza o imóvel", "Vale mais na hora de vender."],
              ["◷", "25 anos ou mais", "Vida útil longa, pouca manutenção."],
              ["✦", "Energia limpa", "Menos CO₂ todos os dias."],
              ["%", "Parcela que cabe", "Troque a conta pela parcela."],
            ].map(([ic, t, s]) => <div key={t}><i>{ic}</i><span><b>{t}</b>{s}</span></div>)}
          </div>
          <Rodape pg={3} />
        </section>

        {/* ───────────── 4 · SISTEMA ───────────── */}
        <section className="sp-pg">
          <Cabeca n="03" titulo="O que você está comprando" sub="Item por item, e para que serve cada um" />
          <table className="sp-compra">
            <thead><tr><th>Qtd.</th><th>Item</th><th>Para que serve</th><th>Garantia</th></tr></thead>
            <tbody>{itensCompra.map(([q, it, para, gar]) => <tr key={it}><td>{q}</td><td>{it}</td><td>{para}</td><td>{gar || "—"}</td></tr>)}</tbody>
          </table>
          <div className="sp-compra-tot">
            <span>Potência total <b>{num(r.kwp, 2)} kWp</b></span>
            <span>Área no telhado <b>cerca de {num(r.area_m2, 0)} m²</b></span>
            <span>Prazo <b>{kit.prazo_instalacao || "a combinar"}</b></span>
          </div>
          <div className="sp-bloco-t" style={{ marginTop: 26 }}>Como a energia do sol chega até a sua tomada</div>
          <div className="sp-fluxo">
            {[
              ["☀", "As placas captam o sol", "e produzem energia durante o dia."],
              ["⚡", "O inversor transforma", "essa energia na mesma da sua tomada."],
              ["⌂", "Sua casa usa primeiro", "tudo o que está ligado gasta essa energia."],
              ["⟳", "O que sobra vai para a rede", "e o medidor novo registra."],
              ["＋", "Vira crédito na conta", "para usar à noite ou em outro mês."],
            ].map(([ic, t, s], i) => (
              <div key={i} className="sp-passo"><div className="sp-passo-ic">{ic}</div><div className="sp-passo-n">{i + 1}</div><b>{t}</b><span>{s}</span></div>
            ))}
          </div>

          <Rodape pg={4} />
        </section>

        {/* ───────────── 5 · DO SIM ATÉ A CONTA BAIXAR + DÚVIDAS ───────────── */}
        <section className="sp-pg">
          <Cabeca n="04" titulo="Do “sim” até a conta baixar" sub="O caminho completo, e quem cuida de cada parte" />
          <div className="sp-trilha">
            {[
              ["Você aprova", "Pelo link da proposta ou assinando a última página. Combinamos a forma de pagamento.", "você"],
              ["Visita técnica", "Nosso técnico confere o telhado, o quadro de energia e o medidor.", "nós"],
              ["Projeto e pedido", `O engenheiro faz o projeto e damos entrada na ${distrib}. Você só assina a procuração.`, "nós"],
              ["Instalação", "Montamos as placas, o inversor e as proteções. Normalmente em poucos dias de obra.", "nós"],
              ["Vistoria e medidor", `A ${distrib} vistoria e troca seu medidor por um que mede a energia nos dois sentidos.`, distrib],
              ["Sistema ligado", "A partir daí a economia já aparece nas próximas contas de luz.", "pronto!"],
            ].map(([t, s, quem], i) => (
              <div key={t} className="sp-tr"><i>{i + 1}</i><div><b>{t}</b><span>{s}</span></div><em>{quem}</em></div>
            ))}
          </div>
          {kit.prazo_instalacao ? <p className="sp-mini" style={{ marginTop: 8 }}>Prazo informado pela empresa: <b>{kit.prazo_instalacao}</b>.</p> : null}

          <div className="sp-bloco-t" style={{ marginTop: 22 }}>Perguntas que todo cliente faz</div>
          <div className="sp-faq">
            {[
              ["E em dia nublado ou de chuva?", "As placas geram menos, mas continuam gerando. A conta usa a média do ano: os meses de muito sol compensam os de pouco."],
              ["E à noite?", "À noite as placas não geram. Você usa os créditos da energia que sobrou durante o dia."],
              ["Se faltar energia na rua, fico com luz?", "Não. Por segurança, o sistema ligado à rede desliga junto quando falta energia. Para ter luz na queda existe o sistema com bateria (orçamento à parte)."],
              ["Os créditos de energia vencem?", `Valem por 60 meses e podem abater a conta de outro imóvel seu, no mesmo nome e atendido pela ${distrib}.`],
              ["Precisa de manutenção?", "Pouca: limpar as placas de tempos em tempos e acompanhar a produção pelo aplicativo."],
              ["E se eu mudar de casa?", "O sistema pode ser retirado e reinstalado no novo endereço, ou fica como valorização do imóvel na venda."],
            ].map(([q, a]) => <div key={q}><b>{q}</b><span>{a}</span></div>)}
          </div>

          <div className="sp-bloco-t" style={{ marginTop: 20 }}>Palavras que aparecem nesta proposta</div>
          <dl className="sp-gloss">
            <dt>kWh</dt><dd>A “unidade” da energia. É o que vem escrito na sua conta de luz.</dd>
            <dt>kWp</dt><dd>O tamanho do sistema: a força máxima das placas somadas.</dd>
            <dt>Inversor</dt><dd>Aparelho que transforma a energia das placas na energia da tomada.</dd>
            <dt>Homologação</dt><dd>A aprovação do sistema pela {distrib}. Nós cuidamos de tudo.</dd>
            <dt>Crédito de energia</dt><dd>A energia que sobra de dia vai para a rede e volta como desconto.</dd>
            <dt>Se paga em</dt><dd>Quanto tempo a economia leva para devolver o valor investido.</dd>
          </dl>
          <Rodape pg={5} />
        </section>

        {/* ───────────── 6 · 25 ANOS ───────────── */}
        <section className="sp-pg">
          <Cabeca n="05" titulo="Seu dinheiro em 25 anos" sub="Quanto você pagaria sem energia solar e quanto fica no seu bolso" />
          <p className="sp-ler"><b>Como ler o gráfico:</b> a linha começa abaixo de zero porque é o valor que você investe. Cada mês de economia vai subindo a linha. Quando ela passa do zero, o sistema já se pagou{r.payback_anos ? ` (em ${anosTxt(r.payback_anos)})` : ""}. Tudo acima disso é dinheiro que fica com você.</p>
          <div className="sp-g25"><Grafico25 anos={anos} preco={r.preco} payback={r.payback_anos} /></div>
          <div className="sp-comp">
            <div className="sp-comp-c"><span>Sem energia solar</span><b>{brl0(totalSem)}</b><i>pagos à distribuidora em 25 anos</i></div>
            <div className="sp-comp-c sp-comp-v"><span>Com energia solar</span><b>{brl0(totalCom)}</b><i>de taxa mínima e encargos</i></div>
            <div className="sp-comp-c sp-comp-o"><span>Fica no seu bolso</span><b>{brl0(r.economia_25)}</b><i>{r.preco > 0 ? `${num(r.economia_25 / r.preco, 0)}× o valor investido` : ""}</i></div>
          </div>
          <table className="sp-tab">
            <thead><tr><th>Ano</th><th>Sem solar</th><th>Com solar</th><th>Economia</th><th>Saldo acumulado</th><th>Ano</th><th>Sem solar</th><th>Com solar</th><th>Economia</th><th>Saldo acumulado</th></tr></thead>
            <tbody>
              {Array.from({ length: 13 }, (_, i) => {
                const a = anos[i], b = anos[i + 13];
                const cel = (x?: AnoSolar) => x ? <><td>{x.ano}</td><td>{brl0(x.sem)}</td><td>{brl0(x.com)}</td><td>{brl0(x.economia)}</td><td className={x.saldo >= 0 ? "sp-pos" : "sp-neg"}>{brl0(x.saldo)}</td></> : <><td /><td /><td /><td /><td /></>;
                return <tr key={i}>{cel(a)}{cel(b)}</tr>;
              })}
            </tbody>
          </table>
          <p className="sp-mini">Estimativa com reajuste da energia de {num(p.reajuste_aa ?? 5, 1)}% ao ano{(p.degradacao_aa ?? 0) > 0 ? ` e perda de geração de ${num(p.degradacao_aa || 0, 1)}% ao ano` : ""}. O saldo acumulado já desconta o investimento.</p>
          <Rodape pg={6} />
        </section>

        {/* ───────────── 5 · INVESTIMENTO ───────────── */}
        <section className="sp-pg">
          <Cabeca n="06" titulo="Quanto custa e como pagar" sub={validade ? `Proposta válida até ${dataBR(p.validade_ate)}${diasValidade ? ` (${diasValidade} dia${diasValidade > 1 ? "s" : ""})` : ""}` : undefined} />
          <div className="sp-preco">
            {r.campanha ? <div className="sp-preco-fita">{r.campanha}</div> : null}
            <div className="sp-preco-l">
              <span>Investimento total · sistema completo instalado</span>
              {r.preco_de ? <s>de {brl(r.preco_de)}</s> : null}
              <b>{r.preco_de ? <small>por </small> : null}{brl(r.preco)}</b>
              <i>à vista · tudo incluso: equipamentos, instalação e aprovação na {distrib}</i>
            </div>
            {cartoes.length ? (
              <div className="sp-preco-r">
                <span>no cartão</span>
                <b>{cartoes[cartoes.length - 1].meses}x <em>{brl(cartoes[cartoes.length - 1].valor)}</em></b>
              </div>
            ) : null}
          </div>

          <div className="sp-pags">
            <div className="sp-pag">
              <div className="sp-pag-t">À vista</div>
              <div className="sp-pag-v">{brl(r.preco)}</div>
              <div className="sp-pag-s">Dinheiro, PIX ou transferência</div>
              <div className="sp-pag-selo"><b>{anosTxt(r.payback_anos)}</b><span>para o sistema se pagar com a economia na conta</span></div>
              <div className="sp-pag-selo sp-pag-selo2"><b>{brl0(r.economia_mes)}/mês</b><span>que deixam de ir para a distribuidora</span></div>
            </div>
            {cartoes.length ? (
              <div className="sp-pag">
                <div className="sp-pag-t">Cartão de crédito</div>
                {cartoes.map((c) => <div key={c.meses} className="sp-pag-l"><span>{c.meses}x</span><b>{brl(c.valor)}</b></div>)}
                {r.cartao_entrada ? <div className="sp-pag-l sp-pag-ent"><span>{brl0(r.cartao_entrada.entrada)} + {r.cartao_entrada.meses}x</span><b>{brl(r.cartao_entrada.valor)}</b></div> : null}
                {r.cartao_entrada ? <div className="sp-pag-s">entrada de 50% e o restante sem juros</div> : null}
              </div>
            ) : null}
            {r.parcelas.length ? (
              <div className="sp-pag sp-pag-fin">
                <div className="sp-pag-t">Financiamento solar</div>
                {r.parcelas.map((x) => <div key={x.meses} className="sp-pag-l"><span>{x.meses}x</span><b>{brl(x.valor)}</b></div>)}
                <div className="sp-pag-s">{p.parcela_banco ? "Simulação do banco, com tarifa, IOF e seguros. Sujeita à análise de crédito." : <>Simulação a {num(p.taxa_financiamento, 2)}% a.m. Sujeita à aprovação de crédito.</>}</div>
              </div>
            ) : null}
          </div>

          <div className="sp-cond">
            <div><b>Prazos</b><span>{kit.prazo_instalacao}</span></div>
            <div><b>Condições</b><span>{p.condicoes}{p.observacoes ? ` ${p.observacoes}` : ""}</span></div>
          </div>

          <div className="sp-aceite">
            <div className="sp-bloco-t">Aceite da proposta</div>
            {p.aceite ? <div className="sp-aceito">✓ Aprovada por {p.cliente.nome} em {dataBR(p.aceite.em)}{p.aceite.pagamento ? ` · ${p.aceite.pagamento}${p.aceite.prazo ? ` em ${p.aceite.prazo}x` : ""}` : ""}</div> : <p className="sp-mini">Aprove online em <b>{linkAceite.replace(/^https?:\/\//, "")}</b> ou assine abaixo.</p>}
            <div className="sp-ass">
              <div><i /><b>{p.cliente.nome}</b><span>CPF / CNPJ:</span><span>{local}</span></div>
              <div><i /><b>{emp.nome}</b><span>{emp.cnpj ? `CNPJ ${emp.cnpj}` : ""}</span><span>{[emp.endereco, emp.cidade].filter(Boolean).join(" · ")}</span></div>
            </div>
          </div>
          <Rodape pg={7} />
        </section>
      </div>
    </main>
  );
}

const CSS = `
.sp-fundo{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#123a2a 0%,#06150F 55%,#030A07 100%);padding:0 0 40px;font-family:Manrope,system-ui,sans-serif;color:#10241B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sp-barra{position:sticky;top:0;z-index:5;background:rgba(3,12,8,.72);backdrop-filter:blur(10px);border-bottom:1px solid rgba(227,181,71,.18)}
.sp-barra-in{max-width:820px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px 12px}
.sp-barra-t{flex:1;min-width:0;display:flex;flex-direction:column;color:#F5E7C1;font-size:12px;line-height:1.25}
.sp-barra-t b{font-size:14px}.sp-barra-t span{opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-btn{border:0;cursor:pointer;border-radius:12px;padding:10px 16px;font:800 13px Manrope,system-ui;background:linear-gradient(135deg,#F6D77A,#D7A331);color:#2A1C02;text-decoration:none;white-space:nowrap;box-shadow:0 8px 24px -10px rgba(227,181,71,.8)}
.sp-btn-2{background:transparent;color:#F5E7C1;box-shadow:inset 0 0 0 1px rgba(245,231,193,.35)}
.sp-folhas{width:794px;margin:24px auto 0;display:flex;flex-direction:column;gap:22px}
.sp-pg{position:relative;width:794px;height:1123px;overflow:hidden;background:#FBFAF6;box-shadow:0 40px 80px -30px rgba(0,0,0,.7),0 0 0 1px rgba(227,181,71,.12);padding:56px 58px 70px;box-sizing:border-box}
.sp-cab{display:flex;align-items:center;gap:16px;padding-bottom:18px;margin-bottom:26px;border-bottom:1px solid #E6E1D3}
.sp-cab-n{font:900 13px Manrope;letter-spacing:.12em;color:#B8862B;border:1.5px solid #E3B547;border-radius:999px;padding:6px 11px}
.sp-cab-t{font:700 30px/1.05 Fraunces,Georgia,serif;color:#0B3324;letter-spacing:-.01em}
.sp-cab-s{font-size:13px;color:#5B6B63;margin-top:5px}
.sp-cab-marca{margin-left:auto;font:800 11px Manrope;letter-spacing:.16em;text-transform:uppercase;color:#0E4D34;opacity:.55}
.sp-cab-marca img{display:block;height:34px;width:auto;max-width:110px;object-fit:contain}
.sp-cab-marca:has(img){opacity:1}
.sp-capa-marca.sp-com-logo img{height:104px;max-width:250px;filter:drop-shadow(0 6px 18px rgba(0,0,0,.45))}
.sp-rod{position:absolute;left:58px;right:58px;bottom:28px;display:flex;justify-content:space-between;font-size:10.5px;color:#7A867F;border-top:1px solid #E6E1D3;padding-top:10px}
/* capa */
.sp-capa{background:radial-gradient(900px 520px at 50% 34%,#1D5A40 0%,#0A2A1D 42%,#04140D 70%,#020906 100%);color:#F7EED3;padding:0}
.sp-estrelas{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 20px 30px,#fff8 50%,transparent 51%),radial-gradient(1px 1px at 120px 80px,#fff6 50%,transparent 51%),radial-gradient(1.5px 1.5px at 260px 40px,#ffe9a8aa 50%,transparent 51%),radial-gradient(1px 1px at 380px 140px,#fff5 50%,transparent 51%),radial-gradient(1px 1px at 520px 60px,#fff7 50%,transparent 51%),radial-gradient(1.5px 1.5px at 680px 120px,#ffe9a899 50%,transparent 51%),radial-gradient(1px 1px at 740px 30px,#fff6 50%,transparent 51%);background-size:794px 220px;opacity:.7}
.sp-capa-topo{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;padding:44px 52px 0}
.sp-capa-marca{display:flex;align-items:center;gap:12px}
.sp-capa-marca img{height:54px;width:auto;max-width:180px;object-fit:contain}
.sp-capa-selo{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:26px;background:linear-gradient(135deg,#F6D77A,#B8862B);color:#3A2600}
.sp-capa-marca b{display:block;font:700 22px Fraunces,serif;color:#F6D77A;letter-spacing:.01em}
.sp-capa-marca span{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.65;margin-top:2px}
.sp-capa-num{text-align:right;display:flex;flex-direction:column;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#F7EED3aa}
.sp-capa-num b{font:800 15px Manrope;letter-spacing:.06em;color:#F6D77A;margin:3px 0}
.sp-capa-sol{position:absolute;left:50%;top:118px;transform:translateX(-50%);z-index:1;filter:drop-shadow(0 0 60px rgba(255,200,90,.45))}
.sp-capa-centro{position:relative;z-index:2;text-align:center;margin-top:440px;padding:0 60px}
.sp-capa-pre{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#E3B547}
.sp-capa-h1{font:500 50px/1.02 Fraunces,Georgia,serif;margin:14px 0 0;letter-spacing:-.02em;color:#FBF4DF}
.sp-capa-h1 em{font-style:italic;font-weight:700;background:linear-gradient(90deg,#FFE7A0,#E3B547 60%,#C88E22);-webkit-background-clip:text;background-clip:text;color:transparent}
.sp-capa-para{margin-top:26px;font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;opacity:.6}
.sp-capa-cliente{font:700 27px Fraunces,serif;color:#F6D77A;margin-top:6px}
.sp-capa-local{font-size:12.5px;opacity:.7;margin-top:3px}
.sp-capa-kpis{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:26px 52px 0}
.sp-capa-kpis div{border:1px solid rgba(246,215,122,.22);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.015));border-radius:16px;padding:13px 12px;text-align:center}
.sp-capa-kpis b{display:block;font:800 23px Manrope;color:#FBF4DF}
.sp-capa-kpis span{display:block;font-size:10.5px;opacity:.65;margin-top:2px}
.sp-capa-kpis .sp-ouro{background:linear-gradient(135deg,#F6D77A,#C99A2E);border-color:transparent}
.sp-capa-kpis .sp-ouro b,.sp-capa-kpis .sp-ouro span{color:#2A1C02;opacity:1}
.sp-capa-fita{position:absolute;z-index:3;top:118px;right:-58px;transform:rotate(38deg);background:linear-gradient(90deg,#B91C1C,#EF4444);color:#fff;font:800 11px Manrope;letter-spacing:.14em;text-transform:uppercase;padding:8px 70px;box-shadow:0 10px 30px -10px #000}
.sp-capa-campo{position:absolute;left:0;right:0;bottom:0;height:250px;z-index:0;mask-image:linear-gradient(180deg,transparent 0,#000 35%);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 35%)}
.sp-capa-rod{position:absolute;z-index:2;left:0;right:0;bottom:22px;text-align:center;font-size:11px;letter-spacing:.06em;color:#F7EED3cc}
/* análise */
.sp-heroi{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#0B3324,#0E4D34 60%,#155E43);border-radius:26px;padding:30px 34px;color:#F7EED3;position:relative;overflow:hidden}
.sp-heroi:after{content:"";position:absolute;right:-80px;top:-80px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#E3B54755,transparent 70%)}
.sp-rot{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#E3B547}
.sp-antes{font:700 30px Fraunces,serif;text-decoration:line-through;text-decoration-color:#E3B547aa;opacity:.7;margin-top:8px}
.sp-seta{font-size:20px;color:#E3B547;margin:2px 0}
.sp-depois{font:900 54px/1 Fraunces,serif;color:#FFE7A0}
.sp-heroi-nota{font-size:12px;opacity:.7;margin-top:8px}
.sp-heroi-dir{background:#FBFAF6;border-radius:50%;padding:6px;position:relative;z-index:1}
.sp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}
.sp-kpi{background:#fff;border:1px solid #ECE7DA;border-radius:18px;padding:16px 14px}
.sp-kpi span{display:block;font-size:11px;color:#5B6B63;font-weight:700}
.sp-kpi b{display:block;font:800 20px Manrope;color:#0B3324;margin-top:6px}
.sp-kpi-d{background:#EEF6F1;border-color:#CFE5D8}
.sp-kpi-o{background:linear-gradient(135deg,#FFF6DA,#F7E3A6);border-color:#EED593}
.sp-kpi-o b{color:#6B4A0C}
.sp-bloco{margin-top:22px}
.sp-bloco-t{font:800 11px Manrope;letter-spacing:.2em;text-transform:uppercase;color:#B8862B;margin-bottom:12px}
.sp-barras{display:flex;flex-direction:column;gap:10px}
.sp-barra-l{display:grid;grid-template-columns:140px 1fr 90px;align-items:center;gap:12px;font-size:13px;color:#33453C}
.sp-barra-l div{height:16px;background:#EEF0EA;border-radius:999px;overflow:hidden}
.sp-barra-l i{display:block;height:100%;border-radius:999px}
.sp-i-c{background:linear-gradient(90deg,#9AA9A1,#6E7F77)}
.sp-i-g{background:linear-gradient(90deg,#E3B547,#0E4D34)}
.sp-barra-l b{text-align:right;color:#0B3324}
.sp-p{font-size:13px;line-height:1.6;color:#33453C;margin:14px 0 0}
.sp-duo{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-top:22px}
.sp-verde{background:linear-gradient(160deg,#0E4D34,#0B3324);color:#F0F7F2;border-radius:20px;padding:20px 22px}
.sp-verde-t{font:800 11px Manrope;letter-spacing:.2em;text-transform:uppercase;color:#E3B547;margin-bottom:10px}
.sp-verde-k{display:flex;align-items:baseline;gap:10px;margin-top:8px}
.sp-verde-k b{font:900 26px Fraunces,serif;color:#FFE7A0;min-width:92px}
.sp-verde-k span{font-size:12.5px;opacity:.8}
.sp-claro{background:#fff;border:1px solid #ECE7DA;border-radius:20px;padding:20px 22px}
.sp-lista{margin:0;padding:0;list-style:none;font-size:13px;color:#33453C;display:flex;flex-direction:column;gap:7px}
.sp-lista li:before{content:"◆";color:#E3B547;font-size:9px;margin-right:8px;vertical-align:2px}
/* sistema */
.sp-fluxo{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;position:relative}
.sp-fluxo:before{content:"";position:absolute;left:8%;right:8%;top:31px;height:2px;background:linear-gradient(90deg,#E3B547,#0E4D34)}
.sp-passo{position:relative;text-align:center;font-size:11.5px;color:#33453C;line-height:1.4}
.sp-passo-ic{width:62px;height:62px;margin:0 auto 10px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:radial-gradient(circle at 35% 30%,#FFF3C4,#E3B547 70%);color:#3A2600;box-shadow:0 0 0 6px #FBFAF6,0 10px 24px -10px #B8862B;position:relative;z-index:1}
.sp-passo-n{position:absolute;top:-4px;left:calc(50% + 18px);z-index:2;width:20px;height:20px;border-radius:50%;background:#0E4D34;color:#fff;font:800 11px/20px Manrope}
.sp-passo b{display:block;color:#0B3324;font-size:12px}
.sp-equip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:30px}
.sp-eq{background:#fff;border:1px solid #ECE7DA;border-radius:20px;padding:18px}
.sp-eq-ic{width:52px;height:52px;border-radius:14px;background:#F4F1E8;display:grid;place-items:center}
.sp-eq-t{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#B8862B;margin-top:14px}
.sp-eq-big{font:800 22px Fraunces,serif;color:#0B3324;margin:4px 0 10px}
.sp-eq dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:11.5px}
.sp-eq dt{color:#7A867F}.sp-eq dd{margin:0;color:#10241B;font-weight:700;text-align:right}
.sp-garantias{margin-top:22px}
.sp-gar{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sp-gar div{border-radius:16px;padding:14px;background:linear-gradient(160deg,#0E4D34,#0B3324);color:#F0F7F2}
.sp-gar b{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#E3B547}
.sp-gar span{display:block;font:700 13.5px/1.35 Manrope;margin-top:6px}
.sp-inclui{margin-top:22px;background:#fff;border:1px solid #ECE7DA;border-radius:20px;padding:18px 22px}
.sp-inclui ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;font-size:12.5px;color:#33453C}
.sp-inclui li:before{content:"✓";display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#EEF6F1;color:#0E4D34;font-weight:900;font-size:11px;margin-right:8px}
/* 25 anos */
.sp-g25{background:#fff;border:1px solid #ECE7DA;border-radius:22px;padding:16px 14px 6px}
.sp-comp{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.sp-comp-c{border-radius:18px;padding:14px 16px;background:#fff;border:1px solid #ECE7DA}
.sp-comp-c span{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#7A867F}
.sp-comp-c b{display:block;font:900 23px Fraunces,serif;color:#7F1D1D;margin-top:6px}
.sp-comp-c i{display:block;font-style:normal;font-size:11px;color:#7A867F;margin-top:2px}
.sp-comp-v b{color:#0E4D34}
.sp-comp-o{background:linear-gradient(135deg,#0E4D34,#0B3324);border-color:transparent}
.sp-comp-o span,.sp-comp-o i{color:#E3B547}.sp-comp-o b{color:#FFE7A0}
.sp-tab{width:100%;border-collapse:collapse;margin-top:14px;font-size:10px;font-variant-numeric:tabular-nums}
.sp-tab th{background:#0B3324;color:#F6D77A;font-weight:800;padding:6px 4px;text-align:right;font-size:9px;letter-spacing:.04em}
.sp-tab th:nth-child(1),.sp-tab th:nth-child(6){text-align:center}
.sp-tab td{padding:4.3px 4px;text-align:right;border-bottom:1px solid #EEEAE0;color:#33453C}
.sp-tab td:nth-child(1),.sp-tab td:nth-child(6){text-align:center;font-weight:800;color:#B8862B}
.sp-tab td:nth-child(6){border-left:2px solid #E6E1D3}
.sp-tab tr:nth-child(even) td{background:#F7F5EE}
.sp-pos{color:#0E4D34!important;font-weight:800}.sp-neg{color:#B91C1C!important}
.sp-mini{font-size:11px;color:#7A867F;margin:10px 0 0;line-height:1.5}
/* investimento */
.sp-preco{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:18px;border-radius:26px;padding:30px 34px;background:radial-gradient(600px 300px at 90% 0%,#1D5A40,#0B3324 55%,#06150F);color:#F7EED3}
.sp-preco-fita{position:absolute;top:30px;right:-78px;transform:rotate(35deg);background:linear-gradient(90deg,#B91C1C,#EF4444);color:#fff;font:800 10px Manrope;letter-spacing:.12em;text-transform:uppercase;padding:6px 90px;white-space:nowrap}
.sp-preco-l b small{font-size:22px;font-weight:700;margin-right:4px;color:#F6D77A}
.sp-pag-selo{margin-top:14px;border-radius:14px;padding:12px;background:#EEF6F1;border:1px solid #CFE5D8}
.sp-pag-selo b{display:block;font:800 16px Manrope;color:#0E4D34}
.sp-pag-selo span{display:block;font-size:10.5px;color:#5B6B63;margin-top:2px;line-height:1.4}
.sp-pag-selo2{background:linear-gradient(135deg,#FFF6DA,#F7E3A6);border-color:#EED593}
.sp-pag-selo2 b{color:#6B4A0C}
.sp-benef{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
.sp-benef div{display:flex;gap:10px;align-items:flex-start;font-size:11px;line-height:1.4;color:#33453C;background:#fff;border:1px solid #ECE7DA;border-radius:14px;padding:9px 10px}
.sp-pg-analise .sp-heroi{padding:24px 30px}
.sp-pg-analise .sp-heroi-dir svg{width:160px;height:160px}
.sp-pg-analise .sp-kpis{margin-top:14px}
.sp-pg-analise .sp-kpi{padding:13px 14px}
.sp-pg-analise .sp-bloco,.sp-pg-analise .sp-duo{margin-top:16px}
.sp-pg-analise .sp-verde,.sp-pg-analise .sp-claro{padding:16px 20px}
.sp-benef i{flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-style:normal;font-size:15px;background:linear-gradient(135deg,#FFF3C4,#E3B547);color:#3A2600}
.sp-benef b{display:block;color:#0B3324;font-size:12.5px}
.sp-preco-l span{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#E3B547}
.sp-preco-l s{display:block;font-size:16px;opacity:.6;margin-top:10px}
.sp-preco-l b{display:block;font:900 44px/1.05 Fraunces,serif;color:#FFE7A0;margin-top:2px;white-space:nowrap}
.sp-preco-l i{display:block;font-style:normal;font-size:12px;opacity:.7;margin-top:6px}
.sp-preco-r{text-align:right;background:linear-gradient(135deg,#F6D77A,#C99A2E);color:#2A1C02;border-radius:20px;padding:16px 18px;margin-top:22px}
.sp-preco-r span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.sp-preco-r b{display:block;font:800 16px Manrope;margin-top:4px}
.sp-preco-r em{font:900 27px Fraunces,serif;font-style:normal}
.sp-pags{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
.sp-pag{background:#fff;border:1px solid #ECE7DA;border-radius:18px;padding:16px}
.sp-pag-t{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#B8862B;margin-bottom:8px}
.sp-pag-v{font:900 24px Fraunces,serif;color:#0B3324}
.sp-pag-l{display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #ECE7DA;color:#33453C}
.sp-pag-l b{color:#0B3324}
.sp-pag-ent{margin-top:6px;border-top:1px solid #ECE7DA}
.sp-pag-s{font-size:10.5px;color:#7A867F;margin-top:8px;line-height:1.45}
.sp-cond{display:grid;grid-template-columns:1fr 1.4fr;gap:12px;margin-top:14px}
.sp-cond div{background:#F4F1E8;border-radius:16px;padding:14px 16px;font-size:11.5px;line-height:1.5;color:#33453C}
.sp-cond b{display:block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#0E4D34;margin-bottom:4px}
.sp-aceite{margin-top:18px}
.sp-aceito{background:#EEF6F1;border:1px solid #CFE5D8;color:#0E4D34;font-weight:800;border-radius:14px;padding:10px 14px;font-size:13px}
.sp-ass{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:40px}
.sp-ass div{display:flex;flex-direction:column;font-size:11px;color:#5B6B63;gap:2px}
.sp-ass i{display:block;height:1.5px;background:#10241B;margin-bottom:8px}
.sp-ass b{font-size:12.5px;color:#10241B}
/* resumo em 1 minuto */
.sp-res{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
.sp-res li{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #ECE7DA;border-radius:16px;padding:11px 16px;font-size:14px;line-height:1.5;color:#33453C}
.sp-res li i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:900 13px Manrope;font-style:normal;background:linear-gradient(135deg,#F6D77A,#D7A331);color:#2A1C02;margin-top:1px}
.sp-res b{color:#0B3324}
.sp-troca{margin-top:18px;background:#fff;border:1px solid #ECE7DA;border-radius:20px;padding:16px 18px 12px}
.sp-cen{display:grid;grid-template-columns:205px 1fr 96px;align-items:center;gap:12px;padding:6px 0}
.sp-cen-t b{display:block;font-size:12.5px;color:#0B3324}.sp-cen-t span{display:block;font-size:10.5px;color:#7A867F}
.sp-cen-b{display:flex;height:20px;background:#F4F1E8;border-radius:999px;overflow:hidden}
.sp-cen-b i,.sp-cen-leg i{display:block;height:100%}
.sp-cen-p{background:linear-gradient(90deg,#E3B547,#C99A2E)}
.sp-cen-c{background:#9AA9A1}
.sp-cen-ruim .sp-cen-c{background:linear-gradient(90deg,#EF8A6B,#C2410C)}
.sp-cen-bom .sp-cen-c{background:linear-gradient(90deg,#23964B,#0E4D34)}
.sp-cen-v{text-align:right;font:800 15px Manrope;color:#0B3324}
.sp-cen-ruim .sp-cen-v{color:#B4380C}.sp-cen-bom .sp-cen-v{color:#0E4D34}
.sp-cen-leg{display:flex;gap:16px;justify-content:flex-end;font-size:10.5px;color:#7A867F;margin-top:4px}
.sp-cen-leg span{display:flex;align-items:center;gap:6px}.sp-cen-leg i{width:12px;height:12px;border-radius:4px}
.sp-zera{margin-top:14px;border-radius:18px;padding:14px 18px;background:linear-gradient(135deg,#FFF6DA,#F9EBC0);border:1px solid #EED593;font-size:12px;line-height:1.55;color:#5A4415}
.sp-zera b{display:block;font-size:13px;color:#6B4A0C;margin-bottom:3px}
.sp-zera span b{display:inline;font-size:inherit;margin:0}
/* o que você está comprando */
.sp-compra{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;background:#fff;border:1px solid #ECE7DA;border-radius:18px;overflow:hidden}
.sp-compra th{background:#0B3324;color:#F6D77A;text-align:left;font-size:10px;letter-spacing:.14em;text-transform:uppercase;padding:10px 12px}
.sp-compra td{padding:10px 12px;border-top:1px solid #EEEAE0;color:#33453C;vertical-align:top;line-height:1.45}
.sp-compra td:first-child{text-align:center;font:900 17px Manrope;color:#B8862B;width:46px}
.sp-compra td:nth-child(2){font-weight:800;color:#0B3324;width:210px}
.sp-compra td:last-child{width:120px;font-weight:700;color:#0E4D34}
.sp-compra tr:nth-child(even) td{background:#FBFAF6}
.sp-compra-tot{display:flex;gap:10px;margin-top:10px}
.sp-compra-tot span{flex:1;background:#EEF6F1;border:1px solid #CFE5D8;border-radius:14px;padding:9px 12px;font-size:11px;color:#5B6B63}
.sp-compra-tot b{display:block;font-size:13.5px;color:#0B3324;margin-top:2px}
/* do sim até a conta baixar */
.sp-trilha{display:flex;flex-direction:column;gap:0;position:relative}
.sp-trilha:before{content:"";position:absolute;left:17px;top:18px;bottom:18px;width:2px;background:linear-gradient(180deg,#E3B547,#0E4D34)}
.sp-tr{display:grid;grid-template-columns:36px 1fr auto;gap:14px;align-items:center;padding:6px 0;position:relative}
.sp-tr i{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:900 14px Manrope;font-style:normal;background:#0B3324;color:#F6D77A;box-shadow:0 0 0 4px #FBFAF6;z-index:1}
.sp-tr b{display:block;font-size:13.5px;color:#0B3324}.sp-tr span{display:block;font-size:11.5px;color:#5B6B63;line-height:1.4}
.sp-tr em{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8A6314;background:#FFF6DA;border:1px solid #EED593;border-radius:999px;padding:4px 10px;white-space:nowrap}
.sp-faq{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sp-faq div{background:#fff;border:1px solid #ECE7DA;border-radius:14px;padding:10px 13px;font-size:11px;line-height:1.45;color:#33453C}
.sp-faq b{display:block;font-size:12px;color:#0B3324;margin-bottom:2px}
.sp-gloss{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:6px 12px;margin:0;font-size:11px;line-height:1.4;color:#33453C}
.sp-gloss dt{font-weight:900;color:#B8862B;white-space:nowrap}.sp-gloss dd{margin:0}
.sp-ler{font-size:12px;line-height:1.55;color:#33453C;background:#EEF6F1;border:1px solid #CFE5D8;border-radius:14px;padding:10px 14px;margin:0 0 12px}
/* o tema do sistema força a fonte em tudo (body * … !important): aqui a proposta usa a dela */
body .sp-fundo *:not(code):not(pre):not(kbd):not(samp):not(.font-mono){font-family:Manrope,system-ui,sans-serif!important}
/* ═══ VERSÃO CLEAN (pouca tinta): fundo branco, só filetes e textos em verde/dourado ═══ */
.sp-pg{background:#fff}
.sp-capa{background:#fff;color:#10241B;padding:0}
.sp-capa:before{content:"";position:absolute;left:0;right:0;top:0;height:8px;background:linear-gradient(90deg,#0E4D34,#E3B547)}
.sp-capa-topo{padding:44px 58px 0;align-items:center}
.sp-capa-tag{font:800 11px Manrope;letter-spacing:.26em;text-transform:uppercase;color:#0E4D34}
.sp-capa-num{color:#7A867F}
.sp-capa-num b{color:#0B3324}
.sp-capa-logo{position:relative;z-index:2;display:flex;justify-content:center;align-items:center;height:330px;margin-top:40px}
.sp-capa-logo img{max-height:300px;max-width:520px;width:auto;object-fit:contain}
.sp-capa-nome{text-align:center}.sp-capa-nome b{display:block;font:700 52px Fraunces,serif;color:#0B3324}.sp-capa-nome span{display:block;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#B8862B;margin-top:6px}
.sp-capa-linha{width:120px;height:3px;margin:26px auto 0;border-radius:3px;background:linear-gradient(90deg,#0E4D34,#E3B547)}
.sp-capa-centro{margin-top:30px}
.sp-capa-pre{color:#B8862B}
.sp-capa-h1{color:#0B3324;font-size:44px}
.sp-capa-h1 em{background:none;-webkit-background-clip:initial;background-clip:initial;color:#B8862B}
.sp-capa-para{color:#5B6B63;opacity:1}
.sp-capa-cliente{color:#0E4D34}
.sp-capa-local{color:#5B6B63;opacity:1}
.sp-capa-kpis{margin:34px 58px 0}
.sp-capa-kpis div{background:#fff;border:1px solid #DCE7E0}
.sp-capa-kpis b{color:#0B3324}
.sp-capa-kpis span{color:#5B6B63;opacity:1}
.sp-capa-kpis .sp-ouro{background:#FFFBEA;border:1.5px solid #E3B547}
.sp-capa-kpis .sp-ouro b{color:#6B4A0C}.sp-capa-kpis .sp-ouro span{color:#6B4A0C}
.sp-capa-fita{top:96px;right:-62px;padding:6px 70px;font-size:10px;box-shadow:none}
.sp-capa-rod{color:#7A867F;border-top:1px solid #ECE7DA;margin:0 58px;padding-top:12px}
/* blocos que eram verde-escuro viram claros com borda */
.sp-heroi{background:#F3F8F5;border:1.5px solid #CFE5D8;color:#10241B}
.sp-heroi:after{display:none}
.sp-rot{color:#B8862B}
.sp-antes{color:#7A867F;opacity:1}
.sp-depois{color:#0E4D34}
.sp-heroi-nota{color:#5B6B63;opacity:1}
.sp-heroi-dir{background:#fff}
.sp-verde{background:#F3F8F5;border:1.5px solid #CFE5D8;color:#10241B}
.sp-verde-t{color:#B8862B}
.sp-verde-k b{color:#0E4D34}
.sp-verde-k span{color:#33453C;opacity:1}
.sp-gar div{background:#fff;border:1.5px solid #CFE5D8;color:#10241B}
.sp-gar b{color:#B8862B}
.sp-comp-o{background:#F3F8F5;border:1.5px solid #CFE5D8}
.sp-comp-o span,.sp-comp-o i{color:#B8862B}.sp-comp-o b{color:#0E4D34}
.sp-tab th,.sp-compra th{background:#EEF6F1;color:#0B3324;border-bottom:1.5px solid #0E4D34}
.sp-tab tr:nth-child(even) td{background:#FAFAF7}
.sp-preco{background:#fff;border:2px solid #0E4D34;color:#10241B}
.sp-preco-l span{color:#B8862B}
.sp-preco-l b{color:#0B3324}
.sp-preco-l b small{color:#B8862B}
.sp-preco-l i,.sp-preco-l s{opacity:1;color:#5B6B63}
.sp-preco-r{background:#FFFBEA;border:1.5px solid #E3B547;color:#4A3305}
.sp-preco-fita{box-shadow:none}
.sp-tr i{background:#fff;color:#0E4D34;border:2px solid #0E4D34}
.sp-passo-ic{background:#FFFBEA;border:1.5px solid #E3B547;box-shadow:0 0 0 6px #fff}
.sp-benef i{background:#FFFBEA;border:1px solid #EED593}
.sp-res li i{background:#FFFBEA;border:1.5px solid #E3B547}
.sp-kpi-o,.sp-pag-selo2,.sp-zera{background:#FFFBEA}
body .sp-fundo .sp-pg :is(.sp-cab-t,.sp-capa-marca b,.sp-capa-nome b,.sp-capa-h1,.sp-capa-h1 em,.sp-capa-cliente,.sp-antes,.sp-depois,.sp-verde-k b,.sp-eq-big,.sp-comp-c b,.sp-preco-l b,.sp-preco-r em,.sp-pag-v,.sp-serif){font-family:Fraunces,Georgia,"Times New Roman",serif!important}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff!important}
  .sp-fundo{background:none;padding:0}
  .sp-barra{display:none}
  .sp-folhas{zoom:1!important;margin:0;gap:0;width:210mm}
  .sp-pg{box-shadow:none;width:210mm;height:297mm;break-after:page;page-break-after:always}
  .sp-pg:last-child{break-after:auto;page-break-after:auto}
}
`;
