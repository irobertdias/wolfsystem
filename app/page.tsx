"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import SimuladorOrcamento from "./components/SimuladorOrcamento";
import { conversaoLead } from "./lib/conversoes";
import { PLANOS_WOLF, PRECO_USUARIO_EXTRA, PRECO_WHATSAPP_EXTRA, brlCurto } from "./lib/precos-wolf";

import { IconeEmoji } from "./components/a2/Icone";
const WHATSAPP = "https://wa.me/5562981519991?text=";
const CADASTRO = "https://app.wolfgyn.com.br/login/register";

// Telas reais do sistema (workspace de demonstração, dados fictícios).
const TELAS = [
  { id: "atendimento", rotulo: "Atendimento", titulo: "Todas as conversas numa tela só", texto: "Vários atendentes no mesmo WhatsApp, com etiquetas, respostas rápidas, transferência e histórico de cada cliente.", src: "/site/atendimento.webp" },
  { id: "funil", rotulo: "Funil de vendas", titulo: "Cada venda na sua etapa", texto: "Arraste os cartões entre as etapas e veja quanto está em negociação, por vendedor e por período.", src: "/site/funil.webp" },
  { id: "dashboard", rotulo: "Painel", titulo: "Metas e resultados na hora", texto: "Vendas, instalações, ticket médio e ranking da equipe atualizados em tempo real.", src: "/site/dashboard.webp" },
  { id: "simulacao", rotulo: "Revisional", titulo: "Simulação de revisão em segundos", texto: "Para escritórios de revisão de contratos: compara com a taxa do Banco Central e calcula a economia do cliente.", src: "/site/simulacao.webp" },
  { id: "proposta", rotulo: "Proposta por link", titulo: "O cliente aceita pelo celular", texto: "A proposta chega por link, com a marca da sua empresa, e o cliente aceita com um toque.", src: "/site/proposta.webp" },
  { id: "financeiro", rotulo: "Financeiro", titulo: "A gestão no mesmo lugar", texto: "Contas a pagar e a receber, fluxo de caixa e DRE, sem planilha.", src: "/site/financeiro.webp" },
];

const SEGMENTOS = [
  { icone: "📶", titulo: "Telecom e vendas de planos", texto: "Funil por status da venda, auditoria, agendamento de instalação e controle por vendedor e equipe." },
  { icone: "⚖️", titulo: "Revisão de contratos e financeiras", texto: "Simulação revisional, proposta por link, contrato gerado sozinho e controle de honorários." },
  { icone: "🧾", titulo: "Crédito e consignado", texto: "Atendimento em massa pelo WhatsApp, roleta de leads e acompanhamento de cada proposta." },
  { icone: "🛍️", titulo: "Varejo, clínicas e serviços", texto: "Chatbot, agenda de retorno, disparos para a base de clientes e cobrança automática." },
];

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

  const falar = (texto = "Olá! Quero conhecer o Wolf System.") => {
    conversaoLead("whatsapp"); // Google Ads: lead (clique para falar com especialista)
    window.open(WHATSAPP + encodeURIComponent(texto), "_blank");
  };

  // Preços vêm da tabela única (app/lib/precos-wolf.ts).
  const planos = PLANOS_WOLF.map((p) => ({ nome: p.nome, preco: brlCurto(p.preco), cor: p.cor, destaque: p.destaque, descricao: p.descricao, recursos: p.recursos }));

  const planosContratos = [
    { nome: "Essencial", limite: "Até 20 contratos por mês", comCrm: "R$ 49,90", semCrm: "R$ 69,90", cor: "#047857" },
    { nome: "Profissional", limite: "Até 100 contratos por mês", comCrm: "R$ 69,90", semCrm: "R$ 99,90", cor: "#047857", destaque: true },
    { nome: "Empresarial", limite: "Contratos ilimitados", comCrm: "R$ 99,90", semCrm: "R$ 149,90", cor: "#047857" },
  ];
  const perguntas = [
    ["Tem teste grátis?", "Tem. Você cria a sua conta em poucos minutos, sem cartão de crédito, e a nossa equipe libera o seu acesso de teste para você conhecer o sistema com a sua operação."],
    ["Tem fidelidade ou multa para cancelar?", "Não. Os planos são mensais e sem fidelidade."],
    ["Como conecto o meu WhatsApp?", "Lendo um QR Code, do mesmo jeito que no WhatsApp Web. No plano Ultra você também pode usar a API Oficial da Meta."],
    ["Vários atendentes podem usar o mesmo número?", "Sim. Todos atendem pelo mesmo WhatsApp, cada um no seu login, com filas, etiquetas, transferência e a roleta que divide as conversas novas entre a equipe."],
    ["Preciso saber programar?", "Não. O chatbot é montado num editor visual, e a nossa equipe ajuda na implantação."],
    ["Funciona para o meu segmento?", "Sim. Telecom, revisão de contratos, crédito e consignado, clínicas, imobiliárias, varejo e serviços: qualquer operação que precise conversar, organizar os clientes e vender com processo."],
    ["O sistema transcreve áudio?", "Sim. Com uma chave OpenAI compatível configurada, os áudios recebidos no atendimento são transcritos."],
    ["Consigo conectar consultas externas?", "Sim. O fluxo pode consultar links, APIs e scripts, usar o retorno na conversa e decidir o próximo passo sem expor dados técnicos ao cliente."],
    ["Quanto custa o Wolf Contratos?", "O Essencial custa R$ 49,90 com CRM Wolf ou R$ 69,90 sem CRM (20 contratos/mês); o Profissional custa R$ 69,90 com CRM ou R$ 99,90 sem CRM (100 contratos/mês); e o Empresarial ilimitado custa R$ 99,90 com CRM ou R$ 149,90 sem CRM."],
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
            <Nav href="#plataforma">Plataforma</Nav><Nav href="#sistema">Por dentro</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav>
          </div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!mobile && <button onClick={() => location.href="https://app.wolfgyn.com.br/login"} style={buttonGhost}>Entrar</button>}
            {mobile
              ? <a href={CADASTRO} style={{ ...buttonPrimary, textDecoration: "none" }}>Teste grátis</a>
              : <><button onClick={() => falar()} style={buttonGhost}>Falar com especialista</button><a href={CADASTRO} style={{ ...buttonPrimary, textDecoration: "none", display: "inline-flex", alignItems: "center", height: 42, boxSizing: "border-box" }}>Teste grátis</a></>}
            {mobile && <button onClick={() => setMenu(!menu)} style={{ ...buttonGhost, width: 42, padding: 0 }}>☰</button>}
          </div>
        </div>
        {mobile && menu && <div style={{ padding: "8px 20px 18px", display: "grid", gap: 12, background: "white" }}><Nav href="#plataforma">Plataforma</Nav><Nav href="#sistema">Por dentro</Nav><Nav href="#planos">Planos</Nav><Nav href="#orcamento">Monte seu plano</Nav><Nav href="#faq">Dúvidas</Nav><Nav href="https://app.wolfgyn.com.br/login">Entrar no sistema</Nav></div>}
      </nav>

      <section id="inicio" style={{ position: "relative", padding: mobile ? "64px 20px 56px" : "100px 28px 84px", background: "linear-gradient(145deg,#ffffff 0%,#F3F6F5 48%,#ECFDF5 100%)" }}>
        <Glow color="#34D399" top="-120px" left="-100px" /><Glow color="#34D399" top="40px" right="-120px" />
        <div style={{ ...container, position: "relative", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.04fr .96fr", gap: mobile ? 48 : 70, alignItems: "center" }}>
          <div>
            <Badge>CRM + WHATSAPP + AUTOMAÇÃO</Badge>
            <h1 style={{ fontSize: mobile ? 40 : 64, lineHeight: 1.02, letterSpacing: mobile ? -2 : -3, margin: "22px 0", fontWeight: 900, color: "#0F172A" }}>CRM e atendimento no WhatsApp para sua equipe <span style={gradientText}>vender mais.</span></h1>
            <p style={{ fontSize: mobile ? 17 : 19, lineHeight: 1.65, color: "#475569", maxWidth: 640, margin: "0 0 28px" }}>Todos os WhatsApps da empresa numa tela só, com chatbot, funil de vendas, propostas, contratos e cobrança no mesmo sistema. Sua equipe atende rápido e nenhum cliente se perde.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href={CADASTRO} style={{ ...buttonPrimary, padding: "16px 24px", fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Criar meu teste grátis</a>
              <button onClick={() => falar("Olá! Quero uma demonstração do Wolf System.")} style={{ ...buttonGhost, height: "auto", padding: "15px 22px", fontSize: 15, display: "inline-flex", alignItems: "center", gap: 8 }}><IconeEmoji e="💬" /> Falar com especialista</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 12 : 20, marginTop: 24, color: "#475569", fontSize: 12.5, fontWeight: 700 }}>
              {["Sem cartão de crédito", "Sem fidelidade", "Implantação assistida", "Suporte em português"].map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ color: "#059669", fontWeight: 900 }}>✓</span>{t}</span>)}
            </div>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "10px 0 0" }}>Você cria a conta e a nossa equipe libera o seu acesso de teste.</p>
          </div>
          <TelaReal src="/site/dashboard.webp" alt="Painel de vendas do Wolf System" selo="Telas reais do sistema" />
        </div>
      </section>

      <section style={{ background: "white", borderTop: "1px solid #F1F5F4", borderBottom: "1px solid #F1F5F4" }}>
        <div style={{ ...container, display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 1, background: "#F1F5F4" }}>
          {[["1", "Crie sua conta", "Cadastro em 2 minutos, sem cartão de crédito."], ["2", "Conecte seu WhatsApp", "Lendo um QR Code, como no WhatsApp Web."], ["3", "Sua equipe começa a vender", "Conversas, funil e propostas organizados desde o primeiro dia."]].map(([n, t, d]) => (
            <div key={n} style={{ background: "white", padding: mobile ? "20px 20px" : "28px 26px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, background: "linear-gradient(135deg,#059669,#065F46)", color: "white", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
              <div><strong style={{ color: "#0F172A", fontSize: 15 }}>{t}</strong><span style={{ display: "block", color: "#64748b", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{d}</span></div>
            </div>
          ))}
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

      {/* ═══ O SISTEMA POR DENTRO (telas reais) ═══ */}
      <section id="sistema" style={{ ...sectionStyle, background: "#F7FAF9", borderTop: "1px solid #F1F5F4", borderBottom: "1px solid #F1F5F4" }}>
        <div style={container}>
          <SectionTitle kicker="VEJA POR DENTRO" title="Assim é o Wolf System no dia a dia" text="Telas reais do sistema, com dados de demonstração." />
          <Galeria mobile={mobile} />
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <a href={CADASTRO} style={{ ...buttonPrimary, padding: "15px 24px", fontSize: 14, textDecoration: "none", display: "inline-block" }}>Quero testar grátis</a>
          </div>
        </div>
      </section>

      {/* ═══ SEGMENTOS ═══ */}
      <section id="segmentos" style={sectionStyle}>
        <div style={container}>
          <SectionTitle kicker="FEITO PARA A SUA OPERAÇÃO" title="Um sistema que se adapta ao seu negócio" text="Cada workspace já começa configurado para o tipo da sua empresa." />
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(4,1fr)", gap: 16 }}>
            {SEGMENTOS.map((s) => (
              <button key={s.titulo} onClick={() => falar(`Olá! Tenho uma empresa de ${s.titulo.toLowerCase()} e quero conhecer o Wolf System.`)}
                style={{ textAlign: "left", cursor: "pointer", border: 0, background: "white", borderRadius: 20, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 14px 32px -18px rgba(16,24,40,.2)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, background: "#ECFDF5", color: "#047857", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><IconeEmoji e={s.icone} /></span>
                <strong style={{ color: "#0F172A", fontSize: 16 }}>{s.titulo}</strong>
                <span style={{ color: "#64748b", fontSize: 13, lineHeight: 1.55 }}>{s.texto}</span>
                <span style={{ color: "#047857", fontSize: 13, fontWeight: 800, marginTop: "auto" }}>Falar sobre o meu caso →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" style={{ ...sectionStyle, background: "#F7FAF9", borderTop: "1px solid #F1F5F4" }}>
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

          {/* Wolf Contratos: produto adicional, depois dos planos principais */}
          <div id="contratos-assinaturas" style={{ marginTop: 34, borderRadius: 24, padding: mobile ? "22px 18px" : "28px 32px", background: "white", border: "1px solid #A7F3D0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ maxWidth: 680 }}><span style={{ color: "#059669", fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>ADICIONAL · WOLF CONTRATOS</span><h3 style={{ color: "#0F172A", fontSize: mobile ? 24 : 28, margin: "8px 0 6px" }}>Contratos com assinatura digital</h3><p style={{ color: "#475569", margin: 0, lineHeight: 1.6, fontSize: 14 }}>Gere o contrato a partir do CRM e o cliente assina pelo celular, com envio por WhatsApp e e-mail, código de confirmação, selfie de evidência e trilha de auditoria.</p></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
              {planosContratos.map((pc) => (
                <div key={pc.nome} style={{ position: "relative", background: "#F7FAF9", border: `1.5px solid ${pc.destaque ? pc.cor : "#E6ECEA"}`, borderRadius: 16, padding: 16 }}>
                  {pc.destaque && <span style={{ position: "absolute", top: -10, right: 14, background: pc.cor, color: "white", borderRadius: 999, padding: "4px 9px", fontSize: 10.5, fontWeight: 900 }}>MELHOR CUSTO-BENEFÍCIO</span>}
                  <strong style={{ color: "#0F172A", fontSize: 16 }}>{pc.nome}</strong>
                  <span style={{ display: "block", color: "#64748b", fontSize: 12, margin: "2px 0 10px" }}>{pc.limite}</span>
                  <strong style={{ color: pc.cor, fontSize: 22 }}>{pc.comCrm}<span style={{ fontSize: 11 }}>/mês</span></strong>
                  <span style={{ display: "block", color: "#64748b", fontSize: 11.5 }}>com CRM Wolf · {pc.semCrm}/mês sem CRM</span>
                  <button onClick={() => falar(`Olá! Quero contratar o plano ${pc.nome} do Wolf Contratos.`)} style={{ width: "100%", marginTop: 12, border: `1.5px solid ${pc.cor}`, borderRadius: 10, background: "white", color: pc.cor, padding: "9px 12px", fontWeight: 900, cursor: "pointer", fontSize: 13 }}>Contratar {pc.nome}</button>
                </div>
              ))}
            </div>
          </div>
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
        <div style={{ ...container, maxWidth: 850 }}><Badge>A PRÓXIMA FASE DA SUA OPERAÇÃO</Badge><h2 style={{ fontSize: mobile ? 37 : 54, lineHeight: 1.08, letterSpacing: -2, margin: "20px 0", color: "#0F172A" }}>Sua equipe merece um sistema que trabalha junto.</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>Veja a Wolf funcionando na prática e descubra onde sua operação pode ganhar velocidade, controle e vendas.</p><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 18 }}><a href={CADASTRO} style={{ ...buttonPrimary, padding: "16px 26px", fontSize: 14, textDecoration: "none" }}>Criar meu teste grátis</a><button onClick={() => falar("Olá! Quero agendar uma demonstração da Wolf System.")} style={{ ...buttonGhost, height: "auto", padding: "15px 24px", fontSize: 14 }}>Agendar demonstração</button></div></div>
      </section>

      {/* WhatsApp flutuante */}
      <button onClick={() => falar("Olá! Vim pelo site e quero conhecer o Wolf System.")} aria-label="Falar no WhatsApp"
        style={{ position: "fixed", right: mobile ? 16 : 24, bottom: mobile ? 16 : 24, zIndex: 60, border: 0, cursor: "pointer", height: 56, minWidth: 56, padding: mobile ? 0 : "0 20px 0 16px", borderRadius: 999, background: "#25D366", color: "white", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 12px 30px -8px rgba(37,211,102,.7)" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.06c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.93-4.67-4.11-.14-.18-1.11-1.48-1.11-2.83s.71-2 .96-2.28a1 1 0 0 1 .73-.34l.52.01c.17.01.39-.06.61.47.24.56.79 1.93.86 2.07.07.14.12.31.02.49-.1.18-.14.29-.28.45l-.42.49c-.14.14-.29.3-.12.58.16.28.73 1.2 1.57 1.95 1.08.96 1.99 1.26 2.27 1.4.28.14.45.12.61-.07.17-.19.7-.82.89-1.1.18-.28.37-.23.62-.14.26.09 1.62.76 1.9.9.28.14.46.21.53.32.07.12.07.68-.17 1.36Z"/></svg>
        {!mobile && "Fale com a gente"}
      </button>

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

// Tela real do sistema numa moldura de navegador.
function TelaReal({ src, alt, selo }: { src: string; alt: string; selo?: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ background: "white", borderRadius: 18, boxShadow: "0 35px 90px -20px rgba(15,23,42,.35), 0 0 0 1px rgba(15,23,42,.06)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#F3F6F5", borderBottom: "1px solid #E6ECEA" }}>
          {["#F87171", "#FBBF24", "#34D399"].map((c) => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
          <span style={{ marginLeft: 10, flex: 1, background: "white", borderRadius: 7, padding: "4px 10px", color: "#94a3b8", fontSize: 11 }}>app.wolfgyn.com.br</span>
        </div>
        <img src={src} alt={alt} loading="lazy" width={1280} height={720} style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
      {selo && <div style={{ position: "absolute", left: -12, bottom: -16, background: "white", border: "1px solid #D1FAE5", borderRadius: 14, padding: "9px 13px", boxShadow: "0 14px 35px rgba(5,150,105,.18)", fontSize: 12, color: "#065F46", fontWeight: 900 }}>● {selo}</div>}
    </div>
  );
}

// Galeria com abas das telas reais.
function Galeria({ mobile }: { mobile: boolean }) {
  const [ativa, setAtiva] = useState(0);
  const t = TELAS[ativa];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 22, justifyContent: mobile ? "flex-start" : "center" }}>
        {TELAS.map((x, i) => (
          <button key={x.id} onClick={() => setAtiva(i)}
            style={{ flexShrink: 0, border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 800, background: i === ativa ? "linear-gradient(135deg,#059669,#065F46)" : "white", color: i === ativa ? "white" : "#475569", boxShadow: i === ativa ? "0 10px 22px -10px rgba(5,150,105,.8)" : "0 1px 2px rgba(16,24,40,.06), inset 0 0 0 1px #E6ECEA" }}>
            {x.rotulo}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 2.2fr", gap: mobile ? 20 : 36, alignItems: "center" }}>
        <div>
          <h3 style={{ color: "#0F172A", fontSize: mobile ? 22 : 28, lineHeight: 1.15, margin: "0 0 10px", letterSpacing: -0.8 }}>{t.titulo}</h3>
          <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.65, margin: 0 }}>{t.texto}</p>
        </div>
        <TelaReal src={t.src} alt={t.titulo} />
      </div>
    </div>
  );
}

function HeroDashboard({mobile}:{mobile:boolean}){
  const cards=[["Conversas hoje","248","+18%","#047857"],["Vendas no mês","37","+24%","#059669"],["Em atendimento","19","agora","#047857"]];
  return <div style={{ position: "relative", background: "rgba(255,255,255,.82)", border: "1px solid rgba(255,255,255,.95)", borderRadius: 27, padding: mobile?15:21, boxShadow: "0 35px 100px rgba(15,23,42,.18)", backdropFilter: "blur(16px)" }}><div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 4px 16px" }}><div><strong style={{fontSize:13}}>Painel da operação</strong><small style={{display:"block",color:"#94a3b8",fontSize: 11,marginTop:3}}>Atualizado agora</small></div><span style={{background:"#D1FAE5",color:"#047857",padding:"5px 9px",borderRadius:999,fontSize: 11,fontWeight:900}}>● ONLINE</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{cards.map(([l,n,v,c])=><div key={l} style={{background:"#F3F6F5",border:"1px solid #E6ECEA",borderRadius:13,padding:12}}><small style={{color:"#94a3b8",fontSize:8}}>{l}</small><strong style={{display:"block",fontSize:mobile?18:23,margin:"5px 0",color:"#0F172A"}}>{n}</strong><span style={{color:c,fontSize:8,fontWeight:900}}>{v}</span></div>)}</div><div style={{display:"grid",gridTemplateColumns:"1fr",gap:9,marginTop:9}}><div style={{background:"#F3F6F5",border:"1px solid #E6ECEA",borderRadius:14,padding:14}}><small style={{color:"#64748b",fontSize: 11,fontWeight:800}}>CONVERSÕES DA SEMANA</small><div style={{display:"flex",alignItems:"end",gap:7,height:105,marginTop:8}}>{[38,55,45,72,62,88,79].map((h,i)=><div key={i} style={{flex:1,height:h+"%",borderRadius:"5px 5px 2px 2px",background:i===5?"linear-gradient(#047857,#047857)":"#D1FAE5"}} />)}</div></div></div><div style={{position:"absolute",right:-15,bottom:-17,background:"white",border:"1px solid #D1FAE5",borderRadius:14,padding:"10px 13px",boxShadow:"0 14px 35px rgba(5,150,105,.15)",fontSize: 12,color:"#065F46",fontWeight:900}}>Venda enviada ao CRM</div></div>
}

const container:CSSProperties={maxWidth:1180,margin:"0 auto",width:"100%",boxSizing:"border-box"};
const sectionStyle:CSSProperties={padding:"clamp(56px,7vw,88px) 20px",background:"#ffffff"};
const gradientText:CSSProperties={backgroundImage:"linear-gradient(135deg, #059669, #065F46)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"};
const buttonPrimary:CSSProperties={border:0,borderRadius:12,background:"linear-gradient(135deg, #059669, #065F46)",color:"white",padding:"13px 18px",fontSize:12,fontWeight:900,cursor:"pointer",boxShadow:"0 10px 25px rgba(5,150,105,.23)"};
const buttonGhost:CSSProperties={height:42,borderRadius:11,border:"1px solid #DCE5E1",background:"white",color:"#334155",padding:"0 16px",fontSize:12,fontWeight:800,cursor:"pointer"};
const footerTitle:CSSProperties={display:"block",color:"#334155",fontSize:11,letterSpacing:1,marginBottom:12};
