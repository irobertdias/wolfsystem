"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import SimuladorOrcamento from "./components/SimuladorOrcamento";

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

  const planos = [
    {
      nome: "Básico",
      preco: "R$ 497",
      cor: "#16a34a",
      descricao: "Para organizar atendimento e vendas com uma operação profissional.",
      recursos: ["Até 5 usuários", "1 conexão WhatsApp", "Chat unificado", "CRM de vendas", "ChatBot visual", "Filas e departamentos", "Protocolos e etiquetas", "Dashboard operacional"],
    },
    {
      nome: "Intermediário",
      preco: "R$ 897",
      cor: "#2563eb",
      destaque: true,
      descricao: "Para equipes comerciais que precisam automatizar, distribuir e medir.",
      recursos: ["Até 15 usuários", "2 conexões WhatsApp", "Tudo do Básico", "Roleta de distribuição", "Disparos via WhatsApp Web", "Equipes e permissões", "API de integração", "Indicadores comerciais"],
    },
    {
      nome: "Ultra",
      preco: "R$ 1.497",
      cor: "#7c3aed",
      descricao: "Para operações multicanal que querem gestão completa e escala.",
      recursos: ["Até 50 usuários", "5 conexões WhatsApp", "Tudo do Intermediário", "API Oficial da Meta", "Cobrança automatizada", "Ligações VOIP", "Central Ads", "Financeiro, RH e Instagram"],
    },
  ];

  const perguntas = [
    ["O Vendedor IA está incluído nos planos?", "Não. Ele é um módulo premium avulso de R$ 2.500,00 por workspace. Você pode contratar em qualquer plano compatível."],
    ["Quanto custa Contratos e Assinaturas?", "O módulo custa R$ 297,00 por mês, por workspace. Ele inclui criação ligada ao CRM ou avulsa, OTP, selfie de evidência, assinatura legível, hashes e trilha de auditoria."],
    ["Qual a diferença entre ChatBot e Vendedor IA?", "O ChatBot executa automações e fluxos. O Vendedor IA conversa de forma natural, interpreta objeções, valida cada dado, consulta APIs e conduz a venda até o CRM."],
    ["Ele entende áudio?", "Sim. Quando configurado com uma chave OpenAI compatível, o sistema transcreve o áudio e a IA continua exatamente da etapa em que parou."],
    ["Consigo conectar consultas externas?", "Sim. O fluxo pode consultar links, APIs e scripts JavaScript, usar o retorno na conversa e decidir o próximo passo sem expor dados técnicos ao cliente."],
    ["Preciso saber programar?", "Não. O editor é visual. Você define o comportamento, as variáveis, as consultas e o destino de cada dado no CRM."],
    ["Funciona com qualquer segmento?", "Sim. Telecom, crédito, clínicas, imobiliárias, varejo, serviços e qualquer operação que precise conversar, coletar dados e atualizar um processo comercial."],
  ];

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff", color: "#10213d", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif", overflow: "hidden" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.92)", backdropFilter: "blur(18px)", borderBottom: "1px solid #e8eef7" }}>
        <div style={{ ...container, minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href="#inicio" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#10213d" }}>
            <Logo />
            <div><strong style={{ fontSize: 17 }}>Wolf System</strong><small style={{ display: "block", color: "#64748b", fontSize: 9, letterSpacing: 1.4, fontWeight: 800 }}>NEGÓCIOS EM MOVIMENTO</small></div>
          </a>
          {!mobile && <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Nav href="#plataforma">Plataforma</Nav><Nav href="#vendedor-ia">Vendedor IA</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav>
          </div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!mobile && <button onClick={() => location.href="https://app.wolfgyn.com.br/login"} style={buttonGhost}>Entrar</button>}
            <button onClick={() => falar()} style={buttonPrimary}>Falar com especialista</button>
            {mobile && <button onClick={() => setMenu(!menu)} style={{ ...buttonGhost, width: 42, padding: 0 }}>☰</button>}
          </div>
        </div>
        {mobile && menu && <div style={{ padding: "8px 20px 18px", display: "grid", gap: 10, background: "white" }}><Nav href="#plataforma">Plataforma</Nav><Nav href="#vendedor-ia">Vendedor IA</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav></div>}
      </nav>

      <section id="inicio" style={{ position: "relative", padding: mobile ? "64px 20px 56px" : "100px 28px 84px", background: "linear-gradient(145deg,#ffffff 0%,#f4f8ff 48%,#f5f0ff 100%)" }}>
        <Glow color="#60a5fa" top="-120px" left="-100px" /><Glow color="#c084fc" top="40px" right="-120px" />
        <div style={{ ...container, position: "relative", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.04fr .96fr", gap: mobile ? 48 : 70, alignItems: "center" }}>
          <div>
            <Badge>⚡ CRM, atendimento e automação em uma só operação</Badge>
            <h1 style={{ fontSize: mobile ? 43 : 70, lineHeight: .98, letterSpacing: -3.3, margin: "24px 0", fontWeight: 900, color: "#10213d" }}>Sua empresa vende mais quando tudo <span style={gradientText}>conversa.</span></h1>
            <p style={{ fontSize: mobile ? 17 : 20, lineHeight: 1.65, color: "#52627a", maxWidth: 690, margin: "0 0 30px" }}>WhatsApp, ChatBot, CRM, campanhas, cobrança e inteligência artificial trabalhando juntos para transformar conversas em receita.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button onClick={() => falar("Olá! Quero uma demonstração do Wolf System.")} style={{ ...buttonPrimary, padding: "16px 24px", fontSize: 15 }}>Quero uma demonstração →</button>
              <a href="#vendedor-ia" style={{ ...buttonGhost, padding: "15px 22px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Conhecer o Vendedor IA</a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 30, color: "#52627a", fontSize: 12, fontWeight: 700 }}><span>✓ Sem fidelidade</span><span>✓ Dados isolados por workspace</span><span>✓ Suporte brasileiro</span></div>
          </div>
          <HeroDashboard mobile={mobile} />
        </div>
      </section>

      <section style={{ background: "white", borderTop: "1px solid #edf2f8", borderBottom: "1px solid #edf2f8" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 1, background: "#edf2f8" }}>
          {[["24/7","Automação disponível"],["100%","Operação no navegador"],["1 painel","Atendimento + CRM"],["∞","Conversas organizadas"]].map(([n,l]) => <div key={l} style={{ background: "white", padding: mobile ? "24px 12px" : "32px 24px", textAlign: "center" }}><strong style={{ color: "#2563eb", fontSize: 27 }}>{n}</strong><span style={{ display: "block", color: "#64748b", fontSize: 11, marginTop: 5 }}>{l}</span></div>)}
        </div>
      </section>

      <section id="plataforma" style={sectionStyle}>
        <div style={container}>
          <SectionTitle kicker="PLATAFORMA COMPLETA" title="Uma central para cada parte da sua operação" text="Módulos integrados, dados no mesmo lugar e uma experiência simples para quem atende, vende e gerencia." />
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 18 }}>
            <Feature icon="💬" color="#2563eb" title="Atendimento unificado" text="WhatsApp, equipes, filas, etiquetas, protocolos e histórico completo em uma tela." />
            <Feature icon="🎯" color="#16a34a" title="CRM que acompanha a conversa" text="Propostas, funil, vendedores, status personalizados e automações ligadas ao atendimento." />
            <Feature icon="📣" color="#7c3aed" title="Campanhas e Central Ads" text="Disparos, API Oficial, investimento, leads, CPL, CPA e relatórios para decisões claras." />
            <Feature icon="💰" color="#ea580c" title="Cobrança automatizada" text="Faturas, réguas de cobrança, negociações e mensagens personalizadas pelo WhatsApp." />
            <Feature icon="📞" color="#0891b2" title="Telefonia e multicanal" text="Chamadas VOIP, múltiplas conexões e uma visão central de toda a comunicação." />
            <Feature icon="📊" color="#db2777" title="Gestão em tempo real" text="Dashboards comerciais, financeiro, RH, ponto e indicadores por equipe e atendente." />
          </div>
        </div>
      </section>

      <section id="vendedor-ia" style={{ padding: mobile ? "72px 20px" : "118px 28px", background: "linear-gradient(145deg,#f7f4ff 0%,#ffffff 45%,#eef7ff 100%)", borderTop: "1px solid #e9e4ff", borderBottom: "1px solid #e9e4ff", position: "relative" }}>
        <Glow color="#a78bfa" top="-100px" left="50%" />
        <div style={{ ...container, position: "relative" }}>
          <div style={{ textAlign: "center", maxWidth: 900, margin: "0 auto 60px" }}>
            <Badge>🤖 MÓDULO PREMIUM AVULSO</Badge>
            <h2 style={{ fontSize: mobile ? 42 : 72, lineHeight: 1.02, letterSpacing: -3, margin: "22px 0", color: "#241246", fontWeight: 950 }}>Conheça o vendedor que não esquece, não pula etapas e <span style={{ ...gradientText, backgroundImage: "linear-gradient(135deg,#7c3aed,#2563eb)" }}>não para de vender.</span></h2>
            <p style={{ color: "#615575", fontSize: mobile ? 17 : 21, lineHeight: 1.65, margin: 0 }}>O Vendedor IA conduz a conversa como gente, coleta dados com validação real, contorna objeções, consulta sistemas e entrega a venda pronta no CRM.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.05fr .95fr", gap: 24, alignItems: "stretch" }}>
            <div style={{ background: "white", border: "1px solid #ded7ff", borderRadius: 28, padding: mobile ? 22 : 34, boxShadow: "0 24px 80px rgba(76,29,149,.10)" }}>
              <ConversationDemo />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
              <MiniFeature icon="🧠" title="Conversa natural" text="Responde dúvidas e depois retorna exatamente à validação que estava pendente." />
              <MiniFeature icon="✅" title="Dados validados" text="Nome, CPF, data, CEP, e-mail e campos personalizados com regras reais." />
              <MiniFeature icon="🔗" title="Consulta APIs" text="Executa link, API ou JavaScript e usa o retorno para continuar a conversa." />
              <MiniFeature icon="🎙️" title="Entende áudio" text="Transcreve a mensagem de voz e mantém o contexto do atendimento." />
              <MiniFeature icon="🛡️" title="Contorna objeções" text="Tenta recuperar o cliente sem encerrar a conversa na primeira recusa." />
              <MiniFeature icon="📥" title="Atualiza o CRM" text="Cria ou altera a venda, muda status e registra observações automaticamente." />
            </div>
          </div>

          <div style={{ marginTop: 26, background: "white", border: "1px solid #dfe7f5", borderRadius: 28, padding: mobile ? 24 : 38, boxShadow: "0 18px 60px rgba(37,99,235,.08)" }}>
            <p style={{ color: "#7c3aed", fontSize: 11, fontWeight: 900, letterSpacing: 1.6, textAlign: "center", margin: "0 0 24px" }}>DA PRIMEIRA MENSAGEM ATÉ A VENDA</p>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(5,1fr)", gap: 12 }}>
              {[["01","Conversa","Entende a intenção e inicia o atendimento"],["02","Coleta","Pede um dado por vez e valida"],["03","Consulta","Confere cobertura, cadastro ou disponibilidade"],["04","Confirma","Apresenta um resumo e corrige o necessário"],["05","Fecha","Envia a venda e continua o pós-venda"]].map(([n,t,d]) => <div key={n} style={{ padding: 18, borderRadius: 18, background: "#f7f9fe", border: "1px solid #e8edf7" }}><span style={{ color: "#7c3aed", fontWeight: 900, fontSize: 12 }}>{n}</span><strong style={{ display: "block", color: "#17233b", fontSize: 15, margin: "8px 0 5px" }}>{t}</strong><small style={{ color: "#64748b", lineHeight: 1.5 }}>{d}</small></div>)}
            </div>
          </div>

          <div style={{ marginTop: 28, borderRadius: 30, padding: mobile ? "30px 24px" : "42px 48px", background: "linear-gradient(135deg,#6d28d9,#2563eb)", color: "white", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr auto", gap: 30, alignItems: "center", boxShadow: "0 24px 70px rgba(79,70,229,.25)" }}>
            <div><span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.5, opacity: .78 }}>CONTRATAÇÃO POR WORKSPACE</span><h3 style={{ fontSize: mobile ? 30 : 40, margin: "10px 0 8px", letterSpacing: -1.2 }}>Vendedor IA completo</h3><p style={{ margin: 0, opacity: .86, lineHeight: 1.6 }}>Módulo separado dos planos. Implantação orientada para transformar seu processo em um vendedor autônomo.</p></div>
            <div style={{ textAlign: mobile ? "left" : "right" }}><span style={{ fontSize: 13, opacity: .8 }}>investimento avulso</span><strong style={{ display: "block", fontSize: mobile ? 42 : 56, letterSpacing: -2 }}>R$ 2.500,00</strong><button onClick={() => falar("Olá! Quero contratar o módulo Vendedor IA por R$ 2.500,00.")} style={{ marginTop: 12, border: 0, borderRadius: 12, background: "white", color: "#5b21b6", padding: "14px 20px", fontWeight: 900, cursor: "pointer" }}>Quero meu Vendedor IA →</button></div>
          </div>
          <div id="contratos-assinaturas" style={{ marginTop: 20, borderRadius: 26, padding: mobile ? "26px 22px" : "32px 38px", background: "linear-gradient(135deg,#eff6ff,#eef2ff)", border: "1px solid #bfdbfe", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr auto", gap: 24, alignItems: "center" }}>
            <div><span style={{ color: "#155eef", fontSize: 11, fontWeight: 900, letterSpacing: 1.4 }}>MÓDULO POR WORKSPACE</span><h3 style={{ color: "#17233b", fontSize: mobile ? 27 : 34, margin: "9px 0 8px" }}>Contratos e Assinaturas</h3><p style={{ color: "#52627a", margin: 0, lineHeight: 1.65 }}>Crie contratos ligados aos clientes do CRM ou avulsos. Envie para assinatura com OTP, selfie de evidência, assinatura legível, hashes e trilha de auditoria.</p></div>
            <div style={{ textAlign: mobile ? "left" : "right" }}><span style={{ color: "#64748b", fontSize: 12 }}>por workspace</span><strong style={{ display: "block", color: "#155eef", fontSize: mobile ? 38 : 48, letterSpacing: -1.5 }}>R$ 297,00<span style={{ fontSize: 15, letterSpacing: 0 }}>/mês</span></strong><button onClick={() => falar("Olá! Quero contratar o módulo Contratos e Assinaturas por R$ 297,00/mês.")} style={{ marginTop: 10, border: 0, borderRadius: 12, background: "#155eef", color: "white", padding: "13px 18px", fontWeight: 900, cursor: "pointer" }}>Quero contratar →</button></div>
          </div>        </div>
      </section>

      <section id="planos" style={sectionStyle}>
        <div style={container}>
          <SectionTitle kicker="PLANOS WOLF" title="Comece com a estrutura certa para crescer" text="Planos claros, sem fidelidade e com módulos que acompanham o tamanho da sua operação." />
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 20, alignItems: "stretch" }}>
            {planos.map(p => <div key={p.nome} style={{ background: "white", border: "2px solid " + (p.destaque ? p.cor : "#e5ebf5"), borderRadius: 24, padding: 28, position: "relative", boxShadow: p.destaque ? "0 24px 70px rgba(37,99,235,.15)" : "0 12px 40px rgba(15,23,42,.05)" }}>
              {p.destaque && <span style={{ position: "absolute", top: -13, left: 26, background: p.cor, color: "white", borderRadius: 999, padding: "6px 13px", fontSize: 10, fontWeight: 900 }}>MAIS ESCOLHIDO</span>}
              <h3 style={{ margin: "6px 0", fontSize: 23 }}>{p.nome}</h3><p style={{ color: "#64748b", minHeight: 55, lineHeight: 1.5, fontSize: 13 }}>{p.descricao}</p>
              <div style={{ margin: "22px 0" }}><strong style={{ color: p.cor, fontSize: 40, letterSpacing: -1.5 }}>{p.preco}</strong><span style={{ color: "#94a3b8" }}>/mês</span></div>
              <button onClick={() => falar("Olá! Quero contratar o plano " + p.nome + " da Wolf.")} style={{ width: "100%", border: "2px solid " + p.cor, borderRadius: 12, padding: 13, background: p.destaque ? p.cor : "white", color: p.destaque ? "white" : p.cor, fontWeight: 900, cursor: "pointer" }}>Escolher {p.nome}</button>
              <div style={{ marginTop: 23, display: "grid", gap: 11 }}>{p.recursos.map(r => <div key={r} style={{ display: "flex", gap: 9, color: "#475569", fontSize: 13 }}><span style={{ color: p.cor, fontWeight: 900 }}>✓</span>{r}</div>)}</div>
            </div>)}
          </div>
          <div style={{ marginTop: 22, padding: 22, borderRadius: 18, background: "#f7f9fd", border: "1px solid #e5ebf5", textAlign: "center", color: "#52627a", fontSize: 13 }}><strong style={{ color: "#17233b" }}>Adicionais disponíveis:</strong> usuários, conexões, Central Ads, Instagram, Financeiro, RH, Vendedor IA e Contratos e Assinaturas por R$ 297/mês.</div>
        </div>
      </section>

      <SimuladorOrcamento />

      <section id="faq" style={{ ...sectionStyle, background: "#f7f9fd", borderTop: "1px solid #edf1f7" }}>
        <div style={{ ...container, maxWidth: 900 }}>
          <SectionTitle kicker="PERGUNTAS FREQUENTES" title="Tudo claro antes de começar" text="As principais dúvidas sobre a plataforma e o Vendedor IA." />
          <div style={{ display: "grid", gap: 10 }}>{perguntas.map(([p,r],i) => <div key={p} style={{ background: "white", border: "1px solid #e3e9f3", borderRadius: 16, overflow: "hidden" }}><button onClick={() => setFaq(faq===i?null:i)} style={{ width: "100%", background: "white", border: 0, padding: "19px 20px", display: "flex", justifyContent: "space-between", gap: 16, textAlign: "left", color: "#17233b", fontWeight: 800, cursor: "pointer" }}><span>{p}</span><span style={{ color: "#7c3aed" }}>{faq===i?"−":"+"}</span></button>{faq===i && <p style={{ margin: 0, padding: "0 20px 20px", color: "#64748b", lineHeight: 1.65, fontSize: 14 }}>{r}</p>}</div>)}</div>
        </div>
      </section>

      <section style={{ padding: mobile ? "65px 20px" : "90px 28px", background: "linear-gradient(135deg,#eff6ff,#faf5ff)", textAlign: "center" }}>
        <div style={{ ...container, maxWidth: 850 }}><Badge>🐺 A PRÓXIMA FASE DA SUA OPERAÇÃO</Badge><h2 style={{ fontSize: mobile ? 37 : 54, lineHeight: 1.08, letterSpacing: -2, margin: "20px 0", color: "#17233b" }}>Sua equipe merece um sistema que trabalha junto.</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>Veja a Wolf funcionando na prática e descubra onde sua operação pode ganhar velocidade, controle e vendas.</p><button onClick={() => falar("Olá! Quero agendar uma demonstração da Wolf System.")} style={{ ...buttonPrimary, marginTop: 18, padding: "16px 26px" }}>Agendar demonstração →</button></div>
      </section>

      <footer style={{ background: "white", borderTop: "1px solid #e5ebf5", padding: "46px 24px 24px" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.4fr 1fr 1fr", gap: 32 }}>
          <div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo /><strong>Wolf System</strong></div><p style={{ color: "#64748b", fontSize: 13, maxWidth: 390, lineHeight: 1.6 }}>CRM, atendimento, automação e inteligência artificial para empresas que querem vender com processo.</p></div>
          <div><strong style={footerTitle}>Navegação</strong><FooterLink href="#plataforma">Plataforma</FooterLink><FooterLink href="#vendedor-ia">Vendedor IA</FooterLink><FooterLink href="#planos">Planos</FooterLink><FooterLink href="#orcamento">Monte seu plano</FooterLink><FooterLink href="https://app.wolfgyn.com.br/login">Acessar sistema</FooterLink></div>
          <div><strong style={footerTitle}>Legal e contato</strong><FooterLink href="/privacidade">Privacidade</FooterLink><FooterLink href="/termos">Termos de uso</FooterLink><FooterLink href="/excluir-dados">Excluir meus dados</FooterLink><span style={{ color: "#64748b", fontSize: 12 }}>comercial@wolfgyn.com.br</span></div>
        </div>
        <div style={{ ...container, borderTop: "1px solid #edf1f7", marginTop: 34, paddingTop: 20, color: "#94a3b8", fontSize: 10, lineHeight: 1.6 }}>© 2026 Wolf System — ABC CALL E SERVIÇOS DIGITAIS LTDA — CNPJ 62.007.374/0001-96. Todos os direitos reservados. Em conformidade com a LGPD.</div>
      </footer>
    </main>
  );
}

function Logo(){return <div style={{ width: 40, height: 40, borderRadius: 13, background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, boxShadow: "0 8px 22px rgba(79,70,229,.22)" }}>W</div>}
function Nav({href,children}:{href:string;children:ReactNode}){return <a href={href} style={{ color: "#52627a", textDecoration: "none", fontSize: 13, fontWeight: 750 }}>{children}</a>}
function FooterLink({href,children}:{href:string;children:ReactNode}){return <a href={href} style={{ display: "block", color: "#64748b", textDecoration: "none", fontSize: 12, margin: "10px 0" }}>{children}</a>}
function Badge({children}:{children:ReactNode}){return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999, background: "white", border: "1px solid #dbe4f2", boxShadow: "0 6px 24px rgba(15,23,42,.05)", color: "#4f46e5", fontSize: 10, letterSpacing: 1, fontWeight: 900 }}>{children}</span>}
function Glow({color,top,left,right}:{color:string;top:string;left?:string;right?:string}){return <div style={{ position: "absolute", top, left, right, width: 420, height: 420, borderRadius: "50%", background: color, opacity: .13, filter: "blur(90px)", pointerEvents: "none" }} />}
function SectionTitle({kicker,title,text}:{kicker:string;title:string;text:string}){return <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 48px" }}><span style={{ color: "#4f46e5", fontSize: 10, letterSpacing: 1.7, fontWeight: 900 }}>{kicker}</span><h2 style={{ color: "#17233b", fontSize: "clamp(34px,5vw,52px)", lineHeight: 1.08, letterSpacing: -2, margin: "13px 0" }}>{title}</h2><p style={{ color: "#64748b", lineHeight: 1.65, fontSize: 16, margin: 0 }}>{text}</p></div>}
function Feature({icon,color,title,text}:{icon:string;color:string;title:string;text:string}){return <div style={{ background: "white", border: "1px solid #e5ebf5", borderRadius: 20, padding: 24, boxShadow: "0 10px 35px rgba(15,23,42,.045)" }}><div style={{ width: 48, height: 48, borderRadius: 14, background: color+"12", color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>{icon}</div><h3 style={{ color: "#17233b", fontSize: 17, margin: "17px 0 8px" }}>{title}</h3><p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{text}</p></div>}
function MiniFeature({icon,title,text}:{icon:string;title:string;text:string}){return <div style={{ background: "rgba(255,255,255,.88)", border: "1px solid #e3def8", borderRadius: 19, padding: 20 }}><span style={{ fontSize: 25 }}>{icon}</span><strong style={{ display: "block", color: "#28184a", margin: "12px 0 6px", fontSize: 14 }}>{title}</strong><p style={{ color: "#706581", fontSize: 11, lineHeight: 1.55, margin: 0 }}>{text}</p></div>}

function HeroDashboard({mobile}:{mobile:boolean}){
  const cards=[["Conversas hoje","248","+18%","#2563eb"],["Vendas no mês","37","+24%","#16a34a"],["Em atendimento","19","agora","#7c3aed"]];
  return <div style={{ position: "relative", background: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.95)", borderRadius: 27, padding: mobile?15:21, boxShadow: "0 35px 100px rgba(48,75,130,.18)", backdropFilter: "blur(16px)" }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 16px" }}><div><strong style={{fontSize:13}}>Painel da operação</strong><small style={{display:"block",color:"#94a3b8",fontSize:9,marginTop:3}}>Atualizado agora</small></div><span style={{background:"#dcfce7",color:"#15803d",padding:"5px 9px",borderRadius:999,fontSize:9,fontWeight:900}}>● ONLINE</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{cards.map(([l,n,v,c])=><div key={l} style={{background:"#f8fafc",border:"1px solid #e8edf5",borderRadius:13,padding:12}}><small style={{color:"#94a3b8",fontSize:8}}>{l}</small><strong style={{display:"block",fontSize:mobile?18:23,margin:"5px 0",color:"#17233b"}}>{n}</strong><span style={{color:c,fontSize:8,fontWeight:900}}>{v}</span></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1.25fr .75fr",gap:9,marginTop:9}}><div style={{background:"#f8fafc",border:"1px solid #e8edf5",borderRadius:14,padding:14}}><small style={{color:"#64748b",fontSize:9,fontWeight:800}}>CONVERSÕES DA SEMANA</small><div style={{display:"flex",alignItems:"end",gap:7,height:105,marginTop:8}}>{[38,55,45,72,62,88,79].map((h,i)=><div key={i} style={{flex:1,height:h+"%",borderRadius:"5px 5px 2px 2px",background:i===5?"linear-gradient(#7c3aed,#2563eb)":"#dbeafe"}} />)}</div></div><div style={{background:"linear-gradient(145deg,#eef2ff,#faf5ff)",border:"1px solid #ddd6fe",borderRadius:14,padding:14}}><span style={{fontSize:22}}>🤖</span><strong style={{display:"block",fontSize:12,margin:"9px 0 4px",color:"#39256b"}}>Vendedor IA</strong><small style={{color:"#776a91",fontSize:9,lineHeight:1.5}}>Coletando dados e atualizando o CRM.</small><div style={{marginTop:12,height:6,borderRadius:9,background:"#ddd6fe",overflow:"hidden"}}><div style={{width:"74%",height:"100%",background:"#7c3aed"}} /></div></div></div><div style={{position:"absolute",right:-15,bottom:-17,background:"white",border:"1px solid #dcfce7",borderRadius:14,padding:"10px 13px",boxShadow:"0 14px 35px rgba(22,163,74,.15)",fontSize:10,color:"#166534",fontWeight:900}}>✓ Venda enviada ao CRM</div></div>
}

function ConversationDemo(){
  return <div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #edf1f7",paddingBottom:17}}><div style={{display:"flex",gap:10,alignItems:"center"}}><div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#7c3aed,#2563eb)",color:"white",display:"flex",alignItems:"center",justifyContent:"center"}}>IA</div><div><strong style={{fontSize:13}}>Mel · Vendedor IA</strong><small style={{display:"block",color:"#16a34a",fontSize:9}}>● atendendo agora</small></div></div><span style={{color:"#94a3b8",fontSize:9}}>Fluxo de vendas</span></div><div style={{display:"grid",gap:12,padding:"22px 0 4px"}}><Bubble>Oi! Para verificar a disponibilidade, me envia seu CEP e o número da casa 😊</Bubble><Bubble user>08452-431, número 118</Bubble><Bubble><span style={{display:"block",fontSize:9,color:"#7c3aed",fontWeight:900,marginBottom:5}}>✓ CONSULTA REALIZADA</span>Temos disponibilidade no seu endereço! Agora me conta: você prefere mais velocidade ou economia?</Bubble><Bubble user>Mas a instalação demora?</Bubble><Bubble>Normalmente conseguimos instalar bem rápido. A confirmação certinha acontece após o pedido 😊 Para continuar, qual plano você prefere?</Bubble></div></div>
}
function Bubble({children,user=false}:{children:ReactNode;user?:boolean}){return <div style={{justifySelf:user?"end":"start",maxWidth:"84%",background:user?"linear-gradient(135deg,#2563eb,#4f46e5)":"#f4f6fb",color:user?"white":"#45536a",borderRadius:user?"15px 15px 3px 15px":"15px 15px 15px 3px",padding:"11px 13px",fontSize:11,lineHeight:1.5}}>{children}</div>}

const container:CSSProperties={maxWidth:1180,margin:"0 auto",width:"100%",boxSizing:"border-box"};
const sectionStyle:CSSProperties={padding:"clamp(72px,9vw,112px) 24px",background:"#ffffff"};
const gradientText:CSSProperties={backgroundImage:"linear-gradient(135deg,#2563eb,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"};
const buttonPrimary:CSSProperties={border:0,borderRadius:12,background:"linear-gradient(135deg,#2563eb,#7c3aed)",color:"white",padding:"13px 18px",fontSize:12,fontWeight:900,cursor:"pointer",boxShadow:"0 10px 25px rgba(79,70,229,.23)"};
const buttonGhost:CSSProperties={height:42,borderRadius:11,border:"1px solid #dbe3ef",background:"white",color:"#334155",padding:"0 16px",fontSize:12,fontWeight:800,cursor:"pointer"};
const footerTitle:CSSProperties={display:"block",color:"#334155",fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:12};
