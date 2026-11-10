"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import SimuladorOrcamento from "./components/SimuladorOrcamento";
import { PLANOS_WOLF, PRECO_USUARIO_EXTRA, PRECO_WHATSAPP_EXTRA, brlCurto } from "./lib/precos-wolf";

import { IconeEmoji } from "./components/a2/Icone";
const WHATSAPP = "https://wa.me/5562981519991?text=";

export default function Site() {
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState<number | null>(null);

  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 820);
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const falar = (texto = "Olá! Quero conhecer o Wolf System.") =>
    window.open(WHATSAPP + encodeURIComponent(texto), "_blank");

  // Preços vêm da tabela única (app/lib/precos-wolf.ts).
  const planos = PLANOS_WOLF.map((p) => ({ nome: p.nome, preco: brlCurto(p.preco), cor: p.cor, destaque: p.destaque, descricao: p.descricao, recursos: p.recursos }));

  const planosContratos = [
    { nome: "Essencial", limite: "Até 20 contratos por mês", comCrm: "R$ 49,90", semCrm: "R$ 69,90", cor: "#047857" },
    { nome: "Profissional", limite: "Até 100 contratos por mês", comCrm: "R$ 69,90", semCrm: "R$ 99,90", cor: "#047857", destaque: true },
    { nome: "Empresarial", limite: "Contratos ilimitados", comCrm: "R$ 99,90", semCrm: "R$ 149,90", cor: "#047857" },
  ];
  const perguntas = [

    ["Quanto custa Contratos e Assinaturas?", "O Essencial custa R$ 49,90 com CRM Wolf ou R$ 69,90 sem CRM (20 contratos/mês); o Profissional custa R$ 69,90 com CRM ou R$ 99,90 sem CRM (100 contratos/mês); e o Empresarial ilimitado custa R$ 99,90 com CRM ou R$ 149,90 sem CRM."],

    ["O sistema permite transcrição de áudio?", "Sim. Quando configurado com uma chave OpenAI compatível, o sistema pode transcrever os áudios recebidos no atendimento."],
    ["Consigo conectar consultas externas?", "Sim. O fluxo pode consultar links, APIs e scripts JavaScript, usar o retorno na conversa e decidir o próximo passo sem expor dados técnicos ao cliente."],
    ["Preciso saber programar?", "Não. O editor é visual. Você define o comportamento, as variáveis, as consultas e o destino de cada dado no CRM."],
    ["Funciona com qualquer segmento?", "Sim. Telecom, crédito, clínicas, imobiliárias, varejo, serviços e qualquer operação que precise conversar, coletar dados e atualizar um processo comercial."],
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff", color: "#0F172A", fontFamily: "var(--font-wolf), ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", overflow: "hidden" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid #E6ECEA" }}>
        <div style={{ ...container, minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href="#inicio" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#0F172A" }}>
            <Logo />
            <div><strong style={{ fontSize: 17 }}>Wolf System</strong><small style={{ display: "block", color: "#64748b", fontSize: 11.5, fontWeight: 700 }}>Negócios em movimento</small></div>
          </a>
          {!mobile && <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Nav href="#plataforma">Plataforma</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav>
          </div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!mobile && <button onClick={() => location.href="https://app.wolfgyn.com.br/login"} style={buttonGhost}>Entrar</button>}
            <button onClick={() => falar()} style={buttonPrimary}>Falar com especialista</button>
            {mobile && <button onClick={() => setMenu(!menu)} style={{ ...buttonGhost, width: 42, padding: 0 }}>☰</button>}
          </div>
        </div>
        {mobile && menu && <div style={{ padding: "8px 20px 18px", display: "grid", gap: 10, background: "white" }}><Nav href="#plataforma">Plataforma</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav></div>}
      </nav>

      <section id="inicio" style={{ position: "relative", padding: mobile ? "64px 20px 56px" : "100px 28px 84px", background: "linear-gradient(145deg,#ffffff 0%,#F3F6F5 48%,#ECFDF5 100%)" }}>
        <Glow color="#34D399" top="-120px" left="-100px" /><Glow color="#34D399" top="40px" right="-120px" />
        <div style={{ ...container, position: "relative", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.04fr .96fr", gap: mobile ? 48 : 70, alignItems: "center" }}>
          <div>
            <Badge>CRM, atendimento e automação em uma só operação</Badge>
            <h1 style={{ fontSize: mobile ? 43 : 70, lineHeight: .98, letterSpacing: -3.3, margin: "24px 0", fontWeight: 900, color: "#0F172A" }}>Sua empresa vende mais quando tudo <span style={gradientText}>conversa.</span></h1>
            <p style={{ fontSize: mobile ? 17 : 20, lineHeight: 1.65, color: "#475569", maxWidth: 690, margin: "0 0 30px" }}>WhatsApp, ChatBot, CRM, campanhas, cobrança e inteligência artificial trabalhando juntos para transformar conversas em receita.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button onClick={() => falar("Olá! Quero uma demonstração do Wolf System.")} style={{ ...buttonPrimary, padding: "16px 24px", fontSize: 15 }}>Quero uma demonstração</button>

            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 30, color: "#475569", fontSize: 12, fontWeight: 700 }}><span>Sem fidelidade</span><span>Dados isolados por workspace</span><span>Suporte brasileiro</span></div>
          </div>
          <HeroDashboard mobile={mobile} />
        </div>
      </section>

      <section style={{ background: "white", borderTop: "1px solid #F1F5F4", borderBottom: "1px solid #F1F5F4" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 1, background: "#F1F5F4" }}>
          {[["24/7","Automação disponível"],["100%","Operação no navegador"],["1 painel","Atendimento + CRM"],["∞","Conversas organizadas"]].map(([n,l]) => <div key={l} style={{ background: "white", padding: mobile ? "24px 12px" : "32px 24px", textAlign: "center" }}><strong style={{ color: "#047857", fontSize: 27 }}>{n}</strong><span style={{ display: "block", color: "#64748b", fontSize: 11, marginTop: 5 }}>{l}</span></div>)}
        </div>
      </section>

      <section id="plataforma" style={sectionStyle}>
        <div style={container}>
          <SectionTitle kicker="PLATAFORMA COMPLETA" title="Uma central para cada parte da sua operação" text="Módulos integrados, dados no mesmo lugar e uma experiência simples para quem atende, vende e gerencia." />
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 18 }}>
            <Feature icon="💬" color="#047857" title="Atendimento unificado" text="WhatsApp, equipes, filas, etiquetas, protocolos e histórico completo em uma tela." />
            <Feature icon="🎯" color="#059669" title="CRM que acompanha a conversa" text="Propostas, funil, vendedores, status personalizados e automações ligadas ao atendimento." />
            <Feature icon="📣" color="#047857" title="Campanhas e Central Ads" text="Disparos, API Oficial, investimento, leads, CPL, CPA e relatórios para decisões claras." />
            <Feature icon="💰" color="#ea580c" title="Cobrança automatizada" text="Faturas, réguas de cobrança, negociações e mensagens personalizadas pelo WhatsApp." />
            <Feature icon="📞" color="#059669" title="Telefonia e multicanal" text="Chamadas VOIP, múltiplas conexões e uma visão central de toda a comunicação." />
            <Feature icon="📊" color="#db2777" title="Gestão em tempo real" text="Dashboards comerciais, financeiro, RH, ponto e indicadores por equipe e atendente." />
          </div>
        </div>
      </section>

      <section style={sectionStyle}><div style={container}><div id="contratos-assinaturas" style={{ marginTop: 20, borderRadius: 28, padding: mobile ? "26px 20px" : "34px 38px", background: "linear-gradient(135deg,#ECFDF5,#ECFDF5)", border: "1px solid #A7F3D0" }}>
            <div style={{ maxWidth: 780, marginBottom: 24 }}><span style={{ color: "#059669", fontSize: 13, fontWeight: 800 }}>Wolf Contratos</span><h3 style={{ color: "#0F172A", fontSize: mobile ? 27 : 34, margin: "9px 0 8px" }}>Contratos e Assinaturas</h3><p style={{ color: "#475569", margin: 0, lineHeight: 1.65 }}>Planos por workspace com criação ligada ao CRM ou avulsa, envio por WhatsApp e e-mail, OTP, selfie de evidência, assinatura legível, hashes e trilha de auditoria.</p></div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
              {planosContratos.map(planoContrato => <div key={planoContrato.nome} style={{ position: "relative", background: "white", border: `2px solid ${planoContrato.destaque ? planoContrato.cor : "#dbe6f4"}`, borderRadius: 20, padding: 20, boxShadow: planoContrato.destaque ? "0 18px 45px rgba(5,150,105,.14)" : "none" }}>
                {planoContrato.destaque && <span style={{ position: "absolute", top: -11, right: 16, background: planoContrato.cor, color: "white", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 900 }}>MELHOR CUSTO-BENEFÍCIO</span>}
                <h4 style={{ color: "#0F172A", fontSize: 20, margin: "3px 0 4px" }}>{planoContrato.nome}</h4>
                <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 16px" }}>{planoContrato.limite}</p>
                <small style={{ color: "#64748b" }}>para quem já possui CRM Wolf</small><strong style={{ color: planoContrato.cor, display: "block", fontSize: 29, margin: "3px 0 12px" }}>{planoContrato.comCrm}<span style={{ fontSize: 12 }}>/mês</span></strong>
                <div style={{ borderTop: "1px solid #E6ECEA", paddingTop: 11 }}><small style={{ color: "#64748b" }}>sem CRM contratado</small><strong style={{ color: "#334155", display: "block", fontSize: 20, marginTop: 3 }}>{planoContrato.semCrm}<span style={{ fontSize: 11 }}>/mês</span></strong></div>
                <button onClick={() => falar(`Olá! Quero contratar o plano ${planoContrato.nome} do Wolf Contratos.`)} style={{ width: "100%", marginTop: 16, border: 0, borderRadius: 11, background: planoContrato.cor, color: "white", padding: "12px 14px", fontWeight: 900, cursor: "pointer" }}>Contratar {planoContrato.nome} →</button>
              </div>)}
            </div>
          </div></div></section>

      <section id="planos" style={sectionStyle}>
        <div style={container}>
          <SectionTitle kicker="PLANOS WOLF" title="Comece com a estrutura certa para crescer" text="Planos claros, sem fidelidade e com módulos que acompanham o tamanho da sua operação." />
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 20, alignItems: "stretch" }}>
            {planos.map(p => <div key={p.nome} style={{ background: "white", border: "2px solid " + (p.destaque ? p.cor : "#E6ECEA"), borderRadius: 24, padding: 28, position: "relative", boxShadow: p.destaque ? "0 24px 70px rgba(5,150,105,.15)" : "0 12px 40px rgba(15,23,42,.05)" }}>
              {p.destaque && <span style={{ position: "absolute", top: -13, left: 26, background: p.cor, color: "white", borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 900 }}>MAIS ESCOLHIDO</span>}
              <h3 style={{ margin: "6px 0", fontSize: 23 }}>{p.nome}</h3><p style={{ color: "#64748b", minHeight: 55, lineHeight: 1.5, fontSize: 13 }}>{p.descricao}</p>
              <div style={{ margin: "22px 0" }}><strong style={{ color: p.cor, fontSize: 40, letterSpacing: -1.5 }}>{p.preco}</strong><span style={{ color: "#94a3b8" }}>/mês</span></div>
              <button onClick={() => falar("Olá! Quero contratar o plano " + p.nome + " da Wolf.")} style={{ width: "100%", border: "2px solid " + p.cor, borderRadius: 12, padding: 13, background: p.destaque ? p.cor : "white", color: p.destaque ? "white" : p.cor, fontWeight: 900, cursor: "pointer" }}>Escolher {p.nome}</button>
              <div style={{ marginTop: 23, display: "grid", gap: 11 }}>{p.recursos.map(r => <div key={r} style={{ display: "flex", gap: 9, color: "#475569", fontSize: 13 }}><span style={{ color: p.cor, fontWeight: 900 }}>✓</span>{r}</div>)}</div>
            </div>)}
          </div>
          <div style={{ marginTop: 22, padding: 22, borderRadius: 18, background: "#F7FAF9", textAlign: "center", color: "#475569", fontSize: 13 }}><strong style={{ color: "#0F172A" }}>Adicionais disponíveis:</strong> usuário extra {brlCurto(PRECO_USUARIO_EXTRA)}/mês, conexão de WhatsApp extra {brlCurto(PRECO_WHATSAPP_EXTRA)}/mês, Módulo Revisional, Central Ads, Financeiro, RH e Wolf Contratos a partir de R$ 49,90/mês para clientes com CRM ou R$ 69,90/mês sem CRM. <strong style={{ color: "#0F172A" }}>Acima de 25 usuários?</strong> Fale com a gente sobre o plano Empresarial.</div>
        </div>
      </section>

      <SimuladorOrcamento />

      <section id="faq" style={{ ...sectionStyle, background: "#F7FAF9", borderTop: "1px solid #F1F5F4" }}>
        <div style={{ ...container, maxWidth: 900 }}>
          <SectionTitle kicker="PERGUNTAS FREQUENTES" title="Tudo claro antes de começar" text="As principais dúvidas sobre a plataforma." />
          <div style={{ display: "grid", gap: 10 }}>{perguntas.map(([p,r],i) => <div key={p} style={{ background: "white", border: "1px solid #E6ECEA", borderRadius: 16, overflow: "hidden" }}><button onClick={() => setFaq(faq===i?null:i)} style={{ width: "100%", background: "white", border: 0, padding: "19px 20px", display: "flex", justifyContent: "space-between", gap: 16, textAlign: "left", color: "#0F172A", fontWeight: 800, cursor: "pointer" }}><span>{p}</span><span style={{ color: "#047857" }}>{faq===i?"−":"+"}</span></button>{faq===i && <p style={{ margin: 0, padding: "0 20px 20px", color: "#64748b", lineHeight: 1.65, fontSize: 14 }}>{r}</p>}</div>)}</div>
        </div>
      </section>

      <section style={{ padding: mobile ? "65px 20px" : "90px 28px", background: "linear-gradient(135deg,#ECFDF5,#ECFDF5)", textAlign: "center" }}>
        <div style={{ ...container, maxWidth: 850 }}><Badge>A PRÓXIMA FASE DA SUA OPERAÇÃO</Badge><h2 style={{ fontSize: mobile ? 37 : 54, lineHeight: 1.08, letterSpacing: -2, margin: "20px 0", color: "#0F172A" }}>Sua equipe merece um sistema que trabalha junto.</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>Veja a Wolf funcionando na prática e descubra onde sua operação pode ganhar velocidade, controle e vendas.</p><button onClick={() => falar("Olá! Quero agendar uma demonstração da Wolf System.")} style={{ ...buttonPrimary, marginTop: 18, padding: "16px 26px" }}>Agendar demonstração</button></div>
      </section>

      <footer style={{ background: "white", borderTop: "1px solid #E6ECEA", padding: "46px 24px 24px" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.4fr 1fr 1fr", gap: 32 }}>
          <div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo /><strong>Wolf System</strong></div><p style={{ color: "#64748b", fontSize: 13, maxWidth: 390, lineHeight: 1.6 }}>CRM, atendimento, automação e inteligência artificial para empresas que querem vender com processo.</p></div>
          <div><strong style={footerTitle}>Navegação</strong><FooterLink href="#plataforma">Plataforma</FooterLink><FooterLink href="#planos">Planos</FooterLink><FooterLink href="#orcamento">Monte seu plano</FooterLink><FooterLink href="https://app.wolfgyn.com.br/login">Acessar sistema</FooterLink></div>
          <div><strong style={footerTitle}>Legal e contato</strong><FooterLink href="/privacidade">Privacidade</FooterLink><FooterLink href="/termos">Termos de uso</FooterLink><FooterLink href="/excluir-dados">Excluir meus dados</FooterLink><span style={{ color: "#64748b", fontSize: 12 }}>comercial@wolfgyn.com.br</span></div>
        </div>
        <div style={{ ...container, borderTop: "1px solid #F1F5F4", marginTop: 34, paddingTop: 20, color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>2026 Wolf System — ABC CALL E SERVIÇOS DIGITAIS LTDA — CNPJ 62.007.374/0001-96. Todos os direitos reservados. Em conformidade com a LGPD.</div>
      </footer>
    </main>
  );
}

function Logo(){return <div style={{ width: 40, height: 40, borderRadius: 13, background: "linear-gradient(135deg, #059669, #065F46)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, boxShadow: "0 8px 22px rgba(5,150,105,.22)" }}>W</div>}
function Nav({href,children}:{href:string;children:ReactNode}){return <a href={href} style={{ color: "#475569", textDecoration: "none", fontSize: 13, fontWeight: 750 }}>{children}</a>}
function FooterLink({href,children}:{href:string;children:ReactNode}){return <a href={href} style={{ display: "block", color: "#64748b", textDecoration: "none", fontSize: 12, margin: "10px 0" }}>{children}</a>}
function Badge({children}:{children:ReactNode}){return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999, background: "#F7FAF9", boxShadow: "0 6px 24px rgba(15,23,42,.05)", color: "#047857", fontSize: 12, letterSpacing: 1, fontWeight: 900 }}>{children}</span>}
function Glow({color,top,left,right}:{color:string;top:string;left?:string;right?:string}){return <div style={{ position: "absolute", top, left, right, width: 420, height: 420, borderRadius: "50%", background: color, opacity: .13, filter: "blur(90px)", pointerEvents: "none" }} />}
function SectionTitle({kicker,title,text}:{kicker:string;title:string;text:string}){return <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 48px" }}><span style={{ color: "#047857", fontSize: 12, letterSpacing: 1.7, fontWeight: 900 }}>{kicker}</span><h2 style={{ color: "#0F172A", fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.08, letterSpacing: -2, margin: "13px 0" }}>{title}</h2><p style={{ color: "#64748b", lineHeight: 1.65, fontSize: 16, margin: 0 }}>{text}</p></div>}
function Feature({icon,color,title,text}:{icon:string;color:string;title:string;text:string}){return <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)" }}><div style={{ width: 48, height: 48, borderRadius: 14, background: color+"12", color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>{<IconeEmoji e={icon} />}</div><h3 style={{ color: "#0F172A", fontSize: 17, margin: "17px 0 8px" }}>{title}</h3><p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{text}</p></div>}

function HeroDashboard({mobile}:{mobile:boolean}){
  const cards=[["Conversas hoje","248","+18%","#047857"],["Vendas no mês","37","+24%","#059669"],["Em atendimento","19","agora","#047857"]];
  return <div style={{ position: "relative", background: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.95)", borderRadius: 27, padding: mobile?15:21, boxShadow: "0 35px 100px rgba(15,23,42,.18)", backdropFilter: "blur(16px)" }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 16px" }}><div><strong style={{fontSize:13}}>Painel da operação</strong><small style={{display:"block",color:"#94a3b8",fontSize: 11,marginTop:3}}>Atualizado agora</small></div><span style={{background:"#D1FAE5",color:"#047857",padding:"5px 9px",borderRadius:999,fontSize: 11,fontWeight:900}}>● ONLINE</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{cards.map(([l,n,v,c])=><div key={l} style={{background:"#F3F6F5",border:"1px solid #E6ECEA",borderRadius:13,padding:12}}><small style={{color:"#94a3b8",fontSize:8}}>{l}</small><strong style={{display:"block",fontSize:mobile?18:23,margin:"5px 0",color:"#0F172A"}}>{n}</strong><span style={{color:c,fontSize:8,fontWeight:900}}>{v}</span></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:9,marginTop:9}}><div style={{background:"#F3F6F5",border:"1px solid #E6ECEA",borderRadius:14,padding:14}}><small style={{color:"#64748b",fontSize: 11,fontWeight:800}}>CONVERSÕES DA SEMANA</small><div style={{display:"flex",alignItems:"end",gap:7,height:105,marginTop:8}}>{[38,55,45,72,62,88,79].map((h,i)=><div key={i} style={{flex:1,height:h+"%",borderRadius:"5px 5px 2px 2px",background:i===5?"linear-gradient(#047857,#047857)":"#D1FAE5"}} />)}</div></div></div><div style={{position:"absolute",right:-15,bottom:-17,background:"white",border:"1px solid #D1FAE5",borderRadius:14,padding:"10px 13px",boxShadow:"0 14px 35px rgba(5,150,105,.15)",fontSize: 12,color:"#065F46",fontWeight:900}}>Venda enviada ao CRM</div></div>
}

const container:CSSProperties={maxWidth:1180,margin:"0 auto",width:"100%",boxSizing:"border-box"};
const sectionStyle:CSSProperties={padding:"clamp(72px,9vw,112px) 24px",background:"#ffffff"};
const gradientText:CSSProperties={backgroundImage:"linear-gradient(135deg, #059669, #065F46)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"};
const buttonPrimary:CSSProperties={border:0,borderRadius:12,background:"linear-gradient(135deg, #059669, #065F46)",color:"white",padding:"13px 18px",fontSize:12,fontWeight:900,cursor:"pointer",boxShadow:"0 10px 25px rgba(5,150,105,.23)"};
const buttonGhost:CSSProperties={height:42,borderRadius:11,border:"1px solid #DCE5E1",background:"white",color:"#334155",padding:"0 16px",fontSize:12,fontWeight:800,cursor:"pointer"};
const footerTitle:CSSProperties={display:"block",color:"#334155",fontSize:11,letterSpacing:1,marginBottom:12};
