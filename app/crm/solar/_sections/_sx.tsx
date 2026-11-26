"use client";
// Peças visuais da Central Solar (verde-folha + dourado-sol). Classes .sx-* valem só dentro de .sx-root.

export function SolLogo({ tamanho = 30, cor = "#3A2600" }: { tamanho?: number; cor?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" width={tamanho} height={tamanho} aria-hidden>
      <circle r="5" fill={cor} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * 7.5} y1={Math.sin(a) * 7.5} x2={Math.cos(a) * 10.5} y2={Math.sin(a) * 10.5} stroke={cor} strokeWidth="1.8" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function SxTitulo({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: React.ReactNode }) {
  return (
    <div className="sx-tit">
      <div><h2 className="sx-serif">{titulo}</h2>{sub ? <p>{sub}</p> : null}</div>
      {acao ? <div className="sx-tit-a">{acao}</div> : null}
    </div>
  );
}

export function SxCard({ titulo, acao, children, escuro, className = "", style }: { titulo?: string; acao?: React.ReactNode; children: React.ReactNode; escuro?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`sx-card${escuro ? " sx-card-escuro" : ""} ${className}`} style={style}>
      {titulo || acao ? <div className="sx-card-t"><span>{titulo}</span>{acao}</div> : null}
      {children}
    </section>
  );
}

export function SxKpi({ rotulo, valor, sub, icone, destaque }: { rotulo: string; valor: React.ReactNode; sub?: React.ReactNode; icone?: React.ReactNode; destaque?: "ouro" | "verde" }) {
  return (
    <div className={`sx-kpi${destaque ? ` sx-kpi-${destaque}` : ""}`}>
      <div className="sx-kpi-top"><span>{rotulo}</span>{icone ? <i>{icone}</i> : null}</div>
      <b>{valor}</b>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/** Anel de progresso (meta, cobertura…). */
export function SxAnel({ pct, tamanho = 120, rotulo, valor }: { pct: number; tamanho?: number; rotulo?: string; valor?: string }) {
  const r = 46, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 120 120" width={tamanho} height={tamanho} aria-hidden>
      <defs><linearGradient id="sxAnel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F6D77A" /><stop offset="1" stopColor="#E3B547" /></linearGradient></defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="url(#sxAnel)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y={rotulo ? 60 : 66} textAnchor="middle" fontSize="24" fontWeight="800" fill="#FFF3C4" className="sx-serif">{valor ?? `${Math.round(p)}%`}</text>
      {rotulo ? <text x="60" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,.7)">{rotulo}</text> : null}
    </svg>
  );
}

export const SX_CSS = `
.sx-root{--sx-noite:#0B3324;--sx-folha:#17803C;--sx-folha-claro:#23964B;--sx-ouro:#E3B547;--sx-ouro-claro:#F6D77A;--sx-ouro-escuro:#B8862B;--sx-creme:#FBFAF4;--sx-linha:#E7E9DF;--sx-texto:#10241B;--sx-sub:#5B6B63;
  max-width:1440px;margin:0 auto;width:100%;box-sizing:border-box;padding:6px 4px 32px;display:flex;flex-direction:column;gap:14px;color:var(--sx-texto)}
body .sx-root .sx-serif,body .sx-root svg text.sx-serif{font-family:Fraunces,Georgia,"Times New Roman",serif!important;letter-spacing:-.01em}

/* cabeçalho */
.sx-topo{position:relative;overflow:hidden;border-radius:26px;padding:22px 26px;display:flex;align-items:center;gap:22px;flex-wrap:wrap;color:#F3F7EF;
  background:radial-gradient(520px 260px at 92% 10%,rgba(246,215,122,.35),transparent 60%),linear-gradient(125deg,#0B3324 0%,#0F4A30 45%,#17803C 100%);
  box-shadow:0 30px 60px -34px rgba(11,51,36,.9),inset 0 0 0 1px rgba(246,215,122,.16)}
.sx-topo-grade{position:absolute;inset:0;opacity:.13;background-image:linear-gradient(rgba(246,215,122,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(246,215,122,.9) 1px,transparent 1px);background-size:34px 22px;mask-image:linear-gradient(100deg,transparent 35%,#000 100%);-webkit-mask-image:linear-gradient(100deg,transparent 35%,#000 100%);transform:perspective(500px) rotateX(38deg) scale(1.4);transform-origin:bottom}
.sx-topo-sol{position:absolute;right:-60px;top:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,#FFF3C4 0%,#F6D77A 30%,rgba(227,181,71,.35) 55%,transparent 70%);filter:blur(2px);animation:sxPulso 6s ease-in-out infinite}
@keyframes sxPulso{50%{transform:scale(1.08);opacity:.85}}
.sx-topo>*:not(.sx-topo-grade):not(.sx-topo-sol){position:relative;z-index:1}
.sx-topo-l{display:flex;align-items:center;gap:14px;flex:1 1 260px;min-width:0}
.sx-topo-logo{width:58px;height:58px;flex:none;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,#FFF3C4,#E3B547 60%,#B8862B);box-shadow:0 10px 26px -10px rgba(227,181,71,.9);overflow:hidden}
.sx-topo-logo img{width:100%;height:100%;object-fit:contain;background:#fff}
.sx-topo-pre{display:block;font-size:10.5px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:var(--sx-ouro-claro)}
.sx-topo h1{margin:2px 0 0;font-size:28px;line-height:1.05;font-weight:800;color:#FFFBEB}
.sx-topo-dia{display:block;font-size:12.5px;opacity:.7;margin-top:3px;text-transform:capitalize}
.sx-topo-k{display:flex;gap:10px;flex-wrap:wrap}
.sx-topo-k div{min-width:128px;padding:10px 14px;border-radius:16px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(246,215,122,.18);backdrop-filter:blur(6px)}
.sx-topo-k b{display:block;font-size:18px;font-weight:800;color:#FFF3C4}
.sx-topo-k span{display:block;font-size:11.5px;opacity:.72}
.sx-topo-a{display:flex;gap:8px;flex-wrap:wrap}
.sx-btn{border:0;cursor:pointer;border-radius:14px;padding:11px 16px;font-size:13.5px;font-weight:800;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:transform .15s,box-shadow .15s}
.sx-btn:hover{transform:translateY(-1px)}
.sx-btn-ouro{background:linear-gradient(135deg,#FFF3C4,#F6D77A 35%,#E3B547);color:#2A1C02;box-shadow:0 12px 26px -12px rgba(227,181,71,.95)}
.sx-btn-vidro{background:rgba(255,255,255,.1);color:#FFFBEB;box-shadow:inset 0 0 0 1px rgba(255,251,235,.3)}
.sx-btn-verde{background:linear-gradient(135deg,#23964B,#136633);color:#fff;box-shadow:0 10px 22px -12px rgba(19,102,51,.9)}
.sx-btn-leve{background:#F1F4EC;color:#136633}
.sx-btn:disabled{opacity:.55;cursor:default;transform:none}

/* abas */
.sx-abas{display:flex;gap:6px;overflow-x:auto;padding:6px;border-radius:18px;background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 30px -22px rgba(11,51,36,.35);scrollbar-width:none}
.sx-abas::-webkit-scrollbar{display:none}
.sx-aba{flex:none;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:10px 15px;border-radius:13px;background:transparent;color:#4B5B53;font-size:13.5px;font-weight:700;transition:background .15s,color .15s}
.sx-aba:hover{background:#F3F6EE;color:#136633}
.sx-aba.on{background:linear-gradient(135deg,#0F4A30,#17803C);color:#FFF3C4;box-shadow:0 10px 20px -12px rgba(15,74,48,.9),inset 0 -2px 0 #E3B547}
.sx-main{min-width:0}

/* títulos e cartões */
.sx-tit{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin:6px 2px 14px}
.sx-tit h2{margin:0;font-size:26px;font-weight:800;color:var(--sx-noite)}
.sx-tit p{margin:4px 0 0;font-size:13.5px;color:var(--sx-sub)}
.sx-tit-a{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sx-card{background:#fff;border-radius:22px;padding:18px 18px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -30px rgba(11,51,36,.45);border:1px solid #EEF0E8;min-width:0}
.sx-card-t{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.sx-card-t span{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--sx-ouro-escuro)}
.sx-card-t>*:last-child:not(span){margin-left:auto}
.sx-card-escuro{background:radial-gradient(420px 220px at 100% 0%,rgba(227,181,71,.28),transparent 60%),linear-gradient(150deg,#0B3324,#0F4A30 60%,#136633);color:#EAF3EC;border:0}
.sx-card-escuro .sx-card-t span{color:var(--sx-ouro-claro)}
.sx-grid{display:grid;gap:14px}
.sx-g4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.sx-g2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:start}
.sx-kpi{background:#fff;border-radius:20px;padding:16px 16px 14px;border:1px solid #EEF0E8;box-shadow:0 16px 36px -30px rgba(11,51,36,.5);display:flex;flex-direction:column;gap:4px;min-width:0}
.sx-kpi-top{display:flex;align-items:center;gap:8px}
.sx-kpi-top span{font-size:12px;font-weight:700;color:var(--sx-sub)}
.sx-kpi-top i{margin-left:auto;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-style:normal;background:#F0FAF2;color:#17803C}
.sx-kpi b{font-size:24px;font-weight:800;color:var(--sx-noite);letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-kpi small{font-size:12px;color:var(--sx-sub)}
.sx-kpi-ouro{background:linear-gradient(140deg,#FFF8E1,#F8E7B0);border-color:#EED593}
.sx-kpi-ouro .sx-kpi-top i{background:#E3B547;color:#3A2600}
.sx-kpi-ouro b{color:#6B4A0C}
.sx-kpi-verde{background:linear-gradient(140deg,#0F4A30,#17803C);border:0}
.sx-kpi-verde .sx-kpi-top span,.sx-kpi-verde small{color:rgba(240,250,242,.78)}
.sx-kpi-verde b{color:#FFF3C4}
.sx-kpi-verde .sx-kpi-top i{background:rgba(255,255,255,.14);color:#F6D77A}

/* chips e etiquetas */
.sx-chip{border:0;cursor:pointer;border-radius:999px;padding:8px 13px;font-size:12.5px;font-weight:700;background:#F1F4EC;color:#4B5B53;white-space:nowrap}
.sx-chip.on{background:#0F4A30;color:#FFF3C4}
.sx-tag{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:800;white-space:nowrap}
.sx-input{height:40px;border-radius:12px;border:1px solid #E1E5DA;padding:0 12px;font-size:13.5px;background:#fff;color:var(--sx-texto);outline:none;min-width:0}
.sx-input:focus{border-color:#23964B;box-shadow:0 0 0 3px rgba(35,150,75,.12)}

/* quadro (kanban) */
.sx-quadro{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 12px;align-items:flex-start}
.sx-col{flex:0 0 272px;border-radius:20px;background:linear-gradient(180deg,#F3F6EE,#F8FAF5);border:1px solid #E9EDE2;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:140px;transition:background .15s,box-shadow .15s}
.sx-quadro-obra .sx-col{flex-basis:238px}
@media (max-width:700px){.sx-topo{padding:18px}.sx-topo h1{font-size:23px}.sx-topo-k div{min-width:0;flex:1 1 30%}.sx-topo-a{width:100%}.sx-topo-a .sx-btn{flex:1;justify-content:center}.sx-tit h2{font-size:22px}.sx-col{flex-basis:248px}}
.sx-col.alvo{background:#E6F4E9;box-shadow:inset 0 0 0 2px #23964B}
.sx-col-t{display:flex;align-items:center;gap:8px;padding:4px 6px 6px}
.sx-col-t b{font-size:13px;color:var(--sx-noite)}
.sx-col-t em{margin-left:auto;font-style:normal;font-size:11.5px;font-weight:800;color:#6B7B73}
.sx-col-t i{width:9px;height:9px;border-radius:9px;display:block}
.sx-col-soma{font-size:11.5px;color:#6B7B73;padding:0 6px 4px;margin-top:-6px}
.sx-cartao{background:#fff;border-radius:16px;padding:12px;border:1px solid #ECEFE6;box-shadow:0 1px 2px rgba(16,24,40,.05);cursor:pointer;display:flex;flex-direction:column;gap:6px;transition:transform .12s,box-shadow .12s}
.sx-cartao:hover{transform:translateY(-1px);box-shadow:0 14px 24px -18px rgba(11,51,36,.6)}
.sx-cartao[draggable=true]{cursor:grab}
.sx-cartao b{font-size:13.5px;color:var(--sx-texto)}
.sx-cartao-l{display:flex;gap:6px;align-items:center;font-size:12px;color:#5B6B63;flex-wrap:wrap}
.sx-cartao-v{font-size:15px;font-weight:800;color:#0F4A30}
.sx-barra{height:6px;border-radius:99px;background:#EEF1E8;overflow:hidden}
.sx-barra i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#E3B547,#23964B)}
.sx-mini{border:0;border-radius:9px;background:#F1F4EC;color:#136633;font-size:12px;font-weight:800;padding:6px 10px;cursor:pointer}

/* listas de ação */
.sx-acao{display:flex;gap:12px;align-items:center;padding:11px 0;border-top:1px solid #F0F2EA}
.sx-acao:first-child{border-top:0}
.sx-acao-ic{width:36px;height:36px;flex:none;border-radius:12px;display:grid;place-items:center;font-size:16px}
.sx-acao-txt{flex:1;min-width:0}
.sx-acao-txt b{display:block;font-size:13.5px;color:var(--sx-texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-acao-txt span{display:block;font-size:12px;color:#6B7B73}

/* gaveta lateral */
.sx-veu{position:fixed;inset:0;background:rgba(6,21,15,.45);backdrop-filter:blur(2px);z-index:80;display:flex;justify-content:flex-end}
.sx-gaveta{width:min(560px,100%);height:100%;overflow-y:auto;background:var(--sx-creme);box-shadow:-30px 0 60px -30px rgba(0,0,0,.5);display:flex;flex-direction:column}
.sx-gaveta-topo{padding:20px 22px;color:#F3F7EF;background:radial-gradient(300px 160px at 100% 0%,rgba(246,215,122,.35),transparent 60%),linear-gradient(130deg,#0B3324,#17803C);position:sticky;top:0;z-index:2}
.sx-gaveta-corpo{padding:18px 22px 30px;display:flex;flex-direction:column;gap:14px}
.sx-check{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;cursor:pointer;font-size:13.5px;color:var(--sx-texto);transition:background .12s;border:0;background:none;text-align:left;width:100%}
.sx-check:hover{background:#F1F4EC}
.sx-check i{width:22px;height:22px;flex:none;border-radius:7px;border:2px solid #C9D3C3;display:grid;place-items:center;font-style:normal;font-size:13px;color:#fff;font-weight:900}
.sx-check.ok i{background:linear-gradient(135deg,#23964B,#136633);border-color:#136633}
.sx-check.ok span{color:#5B6B63;text-decoration:line-through;text-decoration-color:#9FB5A6}
.sx-check small{margin-left:auto;font-size:11px;color:#94A39A;white-space:nowrap}
.sx-campo{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#5B6B63;flex:1 1 160px;min-width:0}
`;
