"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// 🐺 WOLF SYSTEM — Landing Page
// ───────────────────────────────────────────────────────────────────────────
// Estrutura:
//   1. Navbar (sticky, muda no scroll)
//   2. Hero (value prop + mockup visual + CTA duplo)
//   3. Trust bar (números reais)
//   4. Pain points (problemas que resolvemos)
//   5. Como funciona (4 passos)
//   6. Demonstração visual (mockups das telas)
//   7. Pra quem é (3 personas)
//   8. Recursos completos (agrupados)
//   9. Planos + adicionais
//  10. Depoimentos
//  11. FAQ
//  12. CTA final
//  13. Footer (LGPD/contato)
// ═══════════════════════════════════════════════════════════════════════════

export default function Site() {
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const irParaCadastro = () => window.location.href = "https://app.wolfgyn.com.br/login/register";
  const irParaLogin = () => window.location.href = "https://app.wolfgyn.com.br/login";
  const irParaWhatsApp = () => window.open("https://wa.me/5562981519991?text=" + encodeURIComponent("Olá! Quero saber mais sobre o Wolf System."), "_blank");

  // ═══════════════════════════════════════════════════════════════════════
  // DADOS
  // ═══════════════════════════════════════════════════════════════════════

  const painPoints = [
    {
      icon: "😩",
      problema: "Atendentes sobrecarregados respondendo a mesma pergunta 100 vezes por dia",
      solucao: "ChatBot com IA responde automaticamente 24/7, só passa pro humano quando precisa.",
    },
    {
      icon: "📉",
      problema: "Leads esquecidos, esfriando no WhatsApp sem follow-up",
      solucao: "CRM organiza cada conversa no funil de vendas, com etiquetas e lembretes automáticos.",
    },
    {
      icon: "💸",
      problema: "Inadimplência alta, cobrar cliente é um pesadelo manual",
      solucao: "Módulo de Cobrança gera faturas mensais e dispara cobranças via WhatsApp personalizadas.",
    },
    {
      icon: "🤯",
      problema: "Vários atendentes usando o mesmo WhatsApp na bagunça",
      solucao: "Cada atendente tem login próprio, recebe leads na fila, com histórico unificado.",
    },
  ];

  const comoFunciona = [
    { num: "1", titulo: "Conecte seu WhatsApp", desc: "Escaneie o QR Code ou conecte via API oficial da Meta. Em 2 minutos seu canal tá no ar.", icon: "📱" },
    { num: "2", titulo: "Configure o ChatBot", desc: "Monte o fluxo no editor visual, escolha o agente de IA (GPT/Claude/Gemini) ou use respostas fixas.", icon: "🤖" },
    { num: "3", titulo: "Receba e atenda", desc: "Conversas entram no chat, são distribuídas na fila, viram propostas no CRM e seguem no funil.", icon: "💬" },
    { num: "4", titulo: "Venda e cobre", desc: "Feche venda, gere faturas automáticas, cobre via WhatsApp e acompanhe tudo no dashboard.", icon: "📈" },
  ];

  const personas = [
    {
      cor: "#3b82f6",
      icon: "📡",
      titulo: "Provedores de Internet",
      desc: "ISPs e provedores de banda larga que precisam de SAC, vendas, cobrança e suporte técnico tudo unificado.",
      pontos: ["Cobrança mensal automatizada", "Suporte técnico via WhatsApp", "CRM de assinantes", "Gestão de protocolos"],
    },
    {
      cor: "#16a34a",
      icon: "🛒",
      titulo: "E-commerce & Varejo",
      desc: "Lojas que vendem pelo WhatsApp e precisam organizar pedidos, follow-up de carrinhos e pós-venda.",
      pontos: ["Funil de vendas com etiquetas", "Disparos em massa pra promoções", "Catálogo + atendimento", "Recuperação de carrinho"],
    },
    {
      cor: "#a855f7",
      icon: "🎯",
      titulo: "Agências & Equipes Comerciais",
      desc: "Times de vendas que precisam distribuir leads, ranquear atendentes e medir conversão.",
      pontos: ["Roleta de distribuição", "Múltiplas equipes por canal", "Métricas por atendente", "Integração com APIs"],
    },
  ];

  const recursosCategorias = [
    {
      cor: "#3b82f6",
      titulo: "Atendimento",
      items: [
        { icon: "🤖", nome: "ChatBot com IA", desc: "Fluxos visuais + GPT/Claude/Gemini" },
        { icon: "💬", nome: "Chat Humano", desc: "Atendimento em tempo real" },
        { icon: "🏢", nome: "Filas & Departamentos", desc: "Distribua por área" },
        { icon: "👥", nome: "Equipes Multi-time", desc: "Vendas, suporte, cobrança separados" },
        { icon: "📋", nome: "Protocolos", desc: "Rastreamento automático" },
        { icon: "🏷️", nome: "Etiquetas", desc: "Organize conversas" },
      ],
    },
    {
      cor: "#16a34a",
      titulo: "Vendas",
      items: [
        { icon: "📊", nome: "CRM Completo", desc: "Funil visual + propostas" },
        { icon: "🎯", nome: "Roleta", desc: "Distribuição automática de leads" },
        { icon: "📈", nome: "Dashboard", desc: "Métricas em tempo real" },
        { icon: "📊", nome: "Funil Avançado", desc: "Etapas customizáveis + etiquetas" },
        { icon: "🔗", nome: "Integração Chat ↔ CRM", desc: "Abra proposta direto do chat" },
        { icon: "📝", nome: "Histórico Completo", desc: "Tudo registrado por cliente" },
      ],
    },
    {
      cor: "#8b5cf6",
      titulo: "Marketing & Cobrança",
      items: [
        { icon: "📤", nome: "Disparos Web", desc: "Envie pra milhares via QR Code" },
        { icon: "📨", nome: "Disparos API Oficial", desc: "Templates aprovados pela Meta" },
        { icon: "💰", nome: "Cobrança Automatizada", desc: "Faturas + cobrança WhatsApp" },
        { icon: "📞", nome: "Ligações VOIP", desc: "Chamadas direto do CRM" },
        { icon: "🔌", nome: "API REST", desc: "Integre com ERP/Outros sistemas" },
        { icon: "💼", nome: "Multi-conexão", desc: "Vários números no mesmo painel" },
      ],
    },
  ];

  const planos = [
    {
      nome: "Básico",
      preco: "R$ 497",
      periodo: "/mês",
      cor: "#16a34a",
      destaque: false,
      descricao: "Para organizar atendimento e vendas sem depender de planilhas",
      recursos: [
        { destaque: true, texto: "Até 5 usuários" },
        { destaque: true, texto: "1 conexão WhatsApp" },
        { destaque: false, texto: "Chat unificado com atendimento humano e IA" },
        { destaque: false, texto: "CRM de vendas com funil visual" },
        { destaque: false, texto: "ChatBot visual e respostas automáticas" },
        { destaque: false, texto: "Filas, departamentos e distribuição manual" },
        { destaque: false, texto: "Protocolos, histórico e etiquetas" },
        { destaque: false, texto: "Dashboard operacional em tempo real" },
        { destaque: false, texto: "Atendimentos ilimitados" },
        { destaque: false, texto: "Suporte técnico em horário comercial" },
      ],
    },
    {
      nome: "Intermediário",
      preco: "R$ 897",
      periodo: "/mês",
      cor: "#3b82f6",
      destaque: true,
      descricao: "Para equipes comerciais que precisam automatizar e medir resultados",
      recursos: [
        { destaque: true, texto: "Até 15 usuários" },
        { destaque: true, texto: "2 conexões WhatsApp" },
        { destaque: false, texto: "Tudo do Básico, mais:" },
        { destaque: false, texto: "🤖 IA avançada com GPT, Claude e Gemini" },
        { destaque: false, texto: "🎯 Roleta automática de distribuição de leads" },
        { destaque: false, texto: "📤 Campanhas e disparos pelo WhatsApp Web" },
        { destaque: false, texto: "👥 Equipes, filas e permissões separadas" },
        { destaque: false, texto: "🔌 API de integração com outros sistemas" },
        { destaque: false, texto: "📊 Indicadores comerciais por equipe e atendente" },
        { destaque: false, texto: "⚡ Automações comerciais e follow-up" },
      ],
    },
    {
      nome: "Ultra",
      preco: "R$ 1.497",
      periodo: "/mês",
      cor: "#a855f7",
      destaque: false,
      descricao: "Para operações multicanal que querem gestão e automação completa",
      recursos: [
        { destaque: true, texto: "Até 50 usuários" },
        { destaque: true, texto: "5 conexões WhatsApp" },
        { destaque: false, texto: "Tudo do Intermediário, mais:" },
        { destaque: false, texto: "📨 Campanhas pela API Oficial da Meta" },
        { destaque: false, texto: "💰 Cobrança recorrente e régua de inadimplência" },
        { destaque: false, texto: "📞 Ligações VOIP integradas ao CRM" },
        { destaque: false, texto: "📈 Central Ads com métricas e relatórios" },
        { destaque: false, texto: "💼 Módulos Financeiro e RH" },
        { destaque: false, texto: "📸 Instagram e insights, conforme integração Meta" },
        { destaque: false, texto: "⭐ Atendimento prioritário da equipe Wolf" },
      ],
    },
  ];
  const faq = [
    {
      p: "Funciona com WhatsApp comum ou só com o oficial?",
      r: "Você pode conectar pelo QR Code nos planos Básico e Intermediário. A API Oficial da Meta, com templates aprovados e maior estabilidade para campanhas, está incluída no Ultra.",
    },
    {
      p: "Posso cancelar a qualquer momento?",
      r: "Sim. Sem fidelidade, sem multa. Você cancela quando quiser direto pelo painel ou falando com nosso comercial.",
    },
    {
      p: "Tenho que instalar alguma coisa?",
      r: "Não. O sistema é 100% web, roda no navegador. Você acessa de qualquer computador, celular ou tablet. Sem download, sem instalação.",
    },
    {
      p: "Os dados ficam seguros?",
      r: "Sim. Hospedamos na Supabase (banco PostgreSQL com criptografia em repouso e em trânsito), Vercel para o frontend, e aplicamos isolamento por workspace. Estamos em conformidade com a LGPD.",
    },
    {
      p: "Preciso saber programar pra configurar o ChatBot?",
      r: "Não. O editor de fluxos é visual, vc arrasta blocos (mensagem, pergunta, condição, transferir pra humano, etc) e conecta. Pra IA é só ligar o switch e colocar a chave da OpenAI/Claude/Gemini.",
    },
    {
      p: "Quantos atendentes podem usar simultaneamente?",
      r: "Depende do plano: Básico 5, Intermediário 15 e Ultra 50. Se a operação crescer, você pode adicionar usuários por R$ 49,90/mês e conexões por R$ 149,90/mês.",
    },
    {
      p: "O sistema é multi-tenant? Posso revender pros meus clientes?",
      r: "Sim! Cada workspace é isolado, com usuários e dados separados. Temos planos especiais pra parceiros que querem revender. Fale com nosso comercial.",
    },
    {
      p: "Posso conectar mais de um número de WhatsApp?",
      r: "Sim. O Básico inclui 1 conexão, o Intermediário 2 e o Ultra 5. Cada conexão adicional custa R$ 149,90/mês.",
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "white", overflow: "hidden" }}>

      {/* ════════════ NAVBAR ════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: navScrolled ? "rgba(10,10,10,0.92)" : "rgba(10,10,10,0.6)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${navScrolled ? "#1f2937" : "transparent"}`,
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 36, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>Wolf System</span>
        </div>
        <div style={{ display: "flex", gap: isMobile ? 8 : 24, alignItems: "center" }}>
          {!isMobile && (
            <>
              <a href="#recursos" style={navLink}>Recursos</a>
              <a href="#como-funciona" style={navLink}>Como funciona</a>
              <a href="#planos" style={navLink}>Planos</a>
              <a href="#faq" style={navLink}>FAQ</a>
            </>
          )}
          <button onClick={irParaLogin} style={{ ...btnNav, padding: isMobile ? "7px 14px" : "8px 20px", fontSize: isMobile ? 12 : 14 }}>
            Acessar →
          </button>
        </div>
      </nav>

      {/* ════════════ HERO ════════════ */}
      <section style={{
        position: "relative",
        padding: isMobile ? "120px 20px 60px" : "140px 32px 100px",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Glow effect de fundo */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.15) 0%, rgba(22,163,74,0) 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto" }}>
          {/* Badge */}
          <div style={{ display: "inline-block", background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
            <span style={{ color: "#22d36b", fontSize: 13, fontWeight: 700 }}>🐺 Atendimento, vendas e cobrança no mesmo lugar</span>
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: isMobile ? 36 : 62,
            fontWeight: 800, lineHeight: 1.05, margin: "0 0 24px",
            letterSpacing: isMobile ? -1 : -2,
          }}>
            Pare de perder cliente <br />
            <span style={{ background: "linear-gradient(135deg, #16a34a 0%, #22d36b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              no WhatsApp.
            </span>
          </h1>

          {/* Subtítulo */}
          <p style={{ color: "#9ca3af", fontSize: isMobile ? 16 : 19, maxWidth: 700, margin: "0 auto 40px", lineHeight: 1.6 }}>
            CRM + ChatBot com IA + Cobrança automatizada. Centralize atendimento, organize vendas e cobre seus clientes — tudo num só painel, integrado com WhatsApp.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            <button onClick={irParaCadastro} style={btnPrimario}>
              Começar Teste Grátis <span style={{ marginLeft: 6 }}>→</span>
            </button>
            <button onClick={irParaWhatsApp} style={btnSecundario}>
              💬 Falar com Comercial
            </button>
          </div>

          {/* Trust mini */}
          <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
            ✓ Sem cartão de crédito · ✓ Cancele quando quiser · ✓ Suporte em português
          </p>
        </div>

        {/* Mockup visual abaixo do hero */}
        <div style={{ maxWidth: 980, margin: "60px auto 0", padding: isMobile ? "0 8px" : 0, position: "relative", zIndex: 1 }}>
          <MockupDashboard isMobile={isMobile} />
        </div>
      </section>

      {/* ════════════ TRUST BAR ════════════ */}
      <section style={{ padding: "40px 32px", borderTop: "1px solid #1f2937", borderBottom: "1px solid #1f2937", background: "#0d0d0d" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 24, justifyContent: "space-around", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { valor: "100%", label: "Em nuvem" },
            { valor: "24/7", label: "ChatBot ativo" },
            { valor: "∞", label: "Mensagens" },
            { valor: "0", label: "Setup grátis" },
            { valor: "🇧🇷", label: "Suporte BR" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "8px 16px" }}>
              <div style={{ color: "#22d36b", fontSize: 28, fontWeight: 800, marginBottom: 4, lineHeight: 1 }}>{s.valor}</div>
              <div style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ PAIN POINTS ════════════ */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>O problema</p>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
            Cansado de fazer no <span style={{ color: "#dc2626" }}>manual</span>?
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 16 }}>Vc reconhece esses problemas?</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 20 }}>
          {painPoints.map((p, i) => (
            <div key={i} style={{ background: "#0f0f0f", border: "1px solid #1f2937", borderRadius: 14, padding: 28, transition: "all 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{p.icon}</div>
              <p style={{ color: "#fca5a5", fontSize: 15, fontWeight: 600, margin: "0 0 12px", lineHeight: 1.5 }}>{p.problema}</p>
              <div style={{ borderTop: "1px solid #1f2937", paddingTop: 12, marginTop: 12 }}>
                <p style={{ color: "#22d36b", fontSize: 11, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>✓ Como o Wolf resolve</p>
                <p style={{ color: "#d1d5db", fontSize: 13, margin: 0, lineHeight: 1.55 }}>{p.solucao}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ COMO FUNCIONA ════════════ */}
      <section id="como-funciona" style={{ padding: isMobile ? "60px 20px" : "100px 32px", background: "#0d0d0d", borderTop: "1px solid #1f2937", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p style={{ color: "#3b82f6", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Como funciona</p>
            <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
              Em <span style={{ color: "#3b82f6" }}>4 passos</span> seu atendimento muda
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 16 }}>De zero a operacional em menos de 1 hora</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 20, position: "relative" }}>
            {comoFunciona.map((p, i) => (
              <div key={i} style={{ position: "relative", padding: "32px 24px 24px", background: "#111", border: "1px solid #1f2937", borderRadius: 14 }}>
                <div style={{ position: "absolute", top: -16, left: 24, width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, boxShadow: "0 4px 12px rgba(59,130,246,0.4)" }}>
                  {p.num}
                </div>
                <div style={{ fontSize: 32, marginBottom: 12, marginTop: 8 }}>{p.icon}</div>
                <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{p.titulo}</h3>
                <p style={{ color: "#9ca3af", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ DEMO VISUAL ════════════ */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ color: "#a855f7", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Plataforma completa</p>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
            Tudo num <span style={{ background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>painel só</span>
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 16, maxWidth: 700, margin: "16px auto 0" }}>
            Atendimento, vendas, cobrança, equipes, métricas. Você não precisa de 5 ferramentas — só do Wolf.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
          <MockupChat isMobile={isMobile} />
          <MockupFunil isMobile={isMobile} />
          <MockupCobranca isMobile={isMobile} />
          <MockupDashboardMini isMobile={isMobile} />
        </div>
      </section>

      {/* ════════════ PRA QUEM É ════════════ */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 32px", background: "#0d0d0d", borderTop: "1px solid #1f2937", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Pra quem é</p>
            <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
              Feito sob medida pro <span style={{ color: "#22d36b" }}>seu negócio</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            {personas.map((p, i) => (
              <div key={i} style={{
                background: "#111",
                border: `1px solid ${p.cor}33`,
                borderRadius: 16, padding: 32,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${p.cor}22 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${p.cor}22`, border: `1px solid ${p.cor}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
                  {p.icon}
                </div>
                <h3 style={{ color: "white", fontSize: 19, fontWeight: 700, margin: "0 0 10px" }}>{p.titulo}</h3>
                <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>{p.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.pontos.map((pt, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: p.cor, fontSize: 14 }}>✓</span>
                      <span style={{ color: "#d1d5db", fontSize: 13 }}>{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ RECURSOS COMPLETOS ════════════ */}
      <section id="recursos" style={{ padding: isMobile ? "60px 20px" : "100px 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ color: "#ec4899", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Recursos</p>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
            Tudo que vc precisa em <span style={{ color: "#22d36b" }}>um lugar</span>
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 16, maxWidth: 700, margin: "16px auto 0" }}>
            Do primeiro "oi" até a cobrança da fatura. Sem precisar contratar 5 sistemas diferentes.
          </p>
        </div>

        {recursosCategorias.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${cat.cor}22` }}>
              <div style={{ width: 4, height: 24, borderRadius: 2, background: cat.cor }} />
              <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>{cat.titulo}</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
              {cat.items.map((r, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, padding: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cat.cor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {r.icon}
                  </div>
                  <div>
                    <h4 style={{ color: "white", fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>{r.nome}</h4>
                    <p style={{ color: "#6b7280", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ════════════ PLANOS ════════════ */}
      <section id="planos" style={{ padding: isMobile ? "60px 20px" : "100px 32px", background: "#0d0d0d", borderTop: "1px solid #1f2937", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p style={{ color: "#22d36b", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Investimento</p>
            <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
              Escolha seu <span style={{ color: "#22d36b" }}>plano</span>
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 16 }}>Planos para cada estágio da operação. Sem fidelidade e com evolução simples.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20, marginBottom: 40 }}>
            {planos.map((plano) => (
              <div key={plano.nome} style={{
                background: plano.destaque ? "linear-gradient(135deg, #0f1729 0%, #111 100%)" : "#111",
                borderRadius: 18, padding: 36,
                border: `2px solid ${plano.destaque ? plano.cor : "#1f2937"}`,
                position: "relative",
                boxShadow: plano.destaque ? `0 8px 40px ${plano.cor}33` : "none",
                transform: plano.destaque && !isMobile ? "scale(1.04)" : "none",
              }}>
                {plano.destaque && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg, ${plano.cor} 0%, ${plano.cor}cc 100%)`, color: "white", borderRadius: 20, padding: "5px 18px", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", letterSpacing: 0.5, textTransform: "uppercase", boxShadow: `0 4px 12px ${plano.cor}66` }}>
                    ⭐ Melhor custo-benefício
                  </div>
                )}

                <h3 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{plano.nome}</h3>
                <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 20px" }}>{plano.descricao}</p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                  <span style={{ color: plano.cor, fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>{plano.preco}</span>
                  <span style={{ color: "#6b7280", fontSize: 14 }}>{plano.periodo}</span>
                </div>

                <button onClick={irParaCadastro} style={{
                  width: "100%",
                  background: plano.destaque ? `linear-gradient(135deg, ${plano.cor} 0%, ${plano.cor}cc 100%)` : "transparent",
                  color: plano.destaque ? "white" : plano.cor,
                  border: `2px solid ${plano.cor}`,
                  borderRadius: 10, padding: "13px",
                  fontSize: 14, cursor: "pointer", fontWeight: 700,
                  marginBottom: 28,
                  transition: "all 0.2s",
                  boxShadow: plano.destaque ? `0 4px 14px ${plano.cor}55` : "none",
                }}>
                  Começar Agora →
                </button>

                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {plano.recursos.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ color: plano.cor, fontSize: 14, marginTop: 1, flexShrink: 0 }}>{r.destaque ? "🔹" : "✓"}</span>
                      <span style={{ color: r.destaque ? "white" : "#d1d5db", fontSize: 13, fontWeight: r.destaque ? 700 : 400 }}>{r.texto}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Extras */}
          <div style={{ background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 14, padding: "28px 32px", maxWidth: 800, margin: "0 auto" }}>
            <h3 style={{ color: "white", fontSize: 15, fontWeight: 700, margin: "0 0 18px", textAlign: "center" }}>
              ➕ Adicionais — escale a qualquer plano
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
              {[
                { icon: "👤", titulo: "Usuário extra", preco: "R$ 49,90", cor: "#22d36b" },
                { icon: "🔗", titulo: "Conexão extra", preco: "R$ 149,90", cor: "#3b82f6" },
                { icon: "💰", titulo: "Módulo Cobrança", preco: "R$ 199,90", cor: "#dc2626" },
              ].map((e, i) => (
                <div key={i} style={{ background: "#0f0f0f", borderRadius: 10, padding: "14px 18px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{e.icon}</div>
                  <div>
                    <p style={{ color: "#9ca3af", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>{e.titulo}</p>
                    <p style={{ color: e.cor, fontSize: 16, margin: 0, fontWeight: 800 }}>{e.preco}<span style={{ color: "#6b7280", fontSize: 11, fontWeight: 400 }}> /mês</span></p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ color: "#6b7280", fontSize: 11, margin: "16px 0 0", textAlign: "center", fontStyle: "italic" }}>
              Contrate adicionais falando com o comercial
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ DEPOIMENTOS ════════════ */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Quem usa</p>
          <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
            Empresas <span style={{ color: "#f59e0b" }}>crescendo</span> com a gente
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
          {[
            { texto: "Reduzimos 70% do tempo de atendimento. O chatbot resolve as dúvidas comuns e nossos atendentes focam só nas vendas.", autor: "Marketing", empresa: "RM Telecom", inicial: "RM", cor: "#3b82f6" },
            { texto: "A cobrança via WhatsApp transformou nosso financeiro. Inadimplência caiu de 8% pra 2% em 3 meses.", autor: "Financeiro", empresa: "Rocha Financeira", inicial: "RF", cor: "#dc2626" },
            { texto: "Conseguimos centralizar 5 atendentes em um único WhatsApp sem confusão. O CRM nunca perde uma proposta.", autor: "Operações", empresa: "Azimuth", inicial: "AZ", cor: "#a855f7" },
          ].map((d, i) => (
            <div key={i} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 28 }}>
              <div style={{ color: "#f59e0b", fontSize: 18, marginBottom: 12 }}>★★★★★</div>
              <p style={{ color: "#d1d5db", fontSize: 14, lineHeight: 1.65, margin: "0 0 20px", fontStyle: "italic" }}>"{d.texto}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #1f2937" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${d.cor} 0%, ${d.cor}aa 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>
                  {d.inicial}
                </div>
                <div>
                  <p style={{ color: "white", fontSize: 13, margin: 0, fontWeight: 700 }}>{d.empresa}</p>
                  <p style={{ color: "#6b7280", fontSize: 11, margin: 0 }}>{d.autor}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ FAQ ════════════ */}
      <section id="faq" style={{ padding: isMobile ? "60px 20px" : "100px 32px", background: "#0d0d0d", borderTop: "1px solid #1f2937", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ color: "#3b82f6", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>Dúvidas</p>
            <h2 style={{ fontSize: isMobile ? 28 : 42, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
              Perguntas <span style={{ color: "#3b82f6" }}>frequentes</span>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {faq.map((f, i) => (
              <div key={i} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" }}>
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  style={{
                    width: "100%", background: "none", border: "none",
                    padding: "18px 24px", color: "white", fontSize: 15, fontWeight: 600,
                    textAlign: "left", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  }}>
                  <span>{f.p}</span>
                  <span style={{ color: "#3b82f6", fontSize: 18, transition: "transform 0.2s", transform: faqAberto === i ? "rotate(45deg)" : "rotate(0)" }}>+</span>
                </button>
                {faqAberto === i && (
                  <div style={{ padding: "0 24px 20px", borderTop: "1px solid #1f2937" }}>
                    <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.7, margin: "16px 0 0" }}>{f.r}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ CTA FINAL ════════════ */}
      <section style={{ padding: isMobile ? "80px 20px" : "120px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.15) 0%, rgba(22,163,74,0) 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontSize: isMobile ? 30 : 48, fontWeight: 800, margin: "0 0 20px", letterSpacing: -1.5, lineHeight: 1.1 }}>
            Pronto pra <span style={{ background: "linear-gradient(135deg, #16a34a 0%, #22d36b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>parar de perder</span> dinheiro no WhatsApp?
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 17, marginBottom: 40, lineHeight: 1.6 }}>
            Crie sua conta agora. Sem burocracia, sem cartão de crédito.<br />
            Em 5 minutos seu primeiro WhatsApp tá conectado.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={irParaCadastro} style={{ ...btnPrimario, padding: "16px 36px", fontSize: 16 }}>
              Criar Conta Grátis 🐺
            </button>
            <button onClick={irParaWhatsApp} style={{ ...btnSecundario, padding: "16px 36px", fontSize: 16 }}>
              💬 Falar com vendas
            </button>
          </div>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "24px 0 0" }}>
            +50 empresas já estão usando · Suporte em horário comercial · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer style={{ padding: "48px 32px 24px", borderTop: "1px solid #1f2937", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <img src="/logo1.png" alt="Wolf" style={{ width: 32, filter: "brightness(0) invert(1)" }} />
                <span style={{ color: "white", fontWeight: 800, fontSize: 16 }}>Wolf System</span>
              </div>
              <p style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                CRM + ChatBot com WhatsApp &amp; IA. Atendimento, vendas e cobrança no mesmo lugar.
              </p>
            </div>

            <div>
              <h4 style={footerHeader}>Navegação</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="#recursos" style={footerLink}>Recursos</a>
                <a href="#planos" style={footerLink}>Planos</a>
                <a href="#faq" style={footerLink}>FAQ</a>
                <a href="https://app.wolfgyn.com.br/login" style={footerLink}>Acessar sistema</a>
                <a href="https://app.wolfgyn.com.br/login/register" style={footerLink}>Criar conta grátis</a>
              </div>
            </div>

            <div>
              <h4 style={footerHeader}>Legal</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/privacidade" style={footerLink}>🔒 Política de Privacidade</a>
                <a href="/termos" style={footerLink}>📄 Termos de Uso</a>
                <a href="/excluir-dados" style={footerLink}>🗑️ Excluir Meus Dados</a>
                <a href="/privacidade#seus-direitos" style={footerLink}>⚖️ LGPD — Seus Direitos</a>
              </div>
            </div>

            <div>
              <h4 style={footerHeader}>Contato</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="mailto:suporte@wolfgyn.com.br" style={footerLink}>suporte@wolfgyn.com.br</a>
                <a href="mailto:comercial@wolfgyn.com.br" style={footerLink}>comercial@wolfgyn.com.br</a>
                <a href="mailto:privacidade@wolfgyn.com.br" style={footerLink}>privacidade@wolfgyn.com.br</a>
                <a href="https://wa.me/5562981519991" target="_blank" rel="noopener noreferrer" style={footerLink}>💬 WhatsApp comercial</a>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1f2937", paddingTop: 20, display: "flex", flexDirection: "column", gap: 8, textAlign: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
              © {new Date().getFullYear()} Wolf System (ABC CALL E SERVICOS DIGITAIS LTDA — CNPJ 62.007.374/0001-96). Todos os direitos reservados.
            </p>
            <p style={{ color: "#4b5563", fontSize: 11, margin: 0 }}>
              Em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCKUPS (componentes visuais que simulam telas do sistema)
// ═══════════════════════════════════════════════════════════════════════════

function MockupDashboard({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f1729 0%, #111 100%)",
      border: "1px solid #1f2937",
      borderRadius: 14,
      padding: 6,
      boxShadow: "0 30px 60px rgba(0,0,0,0.5), 0 0 80px rgba(22,163,74,0.15)",
    }}>
      <div style={{ display: "flex", gap: 6, padding: "6px 10px 8px" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22d36b" }} />
      </div>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: isMobile ? 12 : 20, color: "#1f2937" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>📊 Dashboard</h4>
            <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>Hoje · Atualizado agora</p>
          </div>
          <div style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>Online</div>
        </div>
        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { l: "Atendimentos", v: "127", c: "#3b82f6", i: "💬" },
            { l: "Conversões", v: "23", c: "#16a34a", i: "✅" },
            { l: "Receita", v: "R$ 8.4k", c: "#a855f7", i: "💰" },
            { l: "Pendentes", v: "12", c: "#f59e0b", i: "⏳" },
          ].map((k, i) => (
            <div key={i} style={{ background: "#ffffff", borderRadius: 8, padding: 10, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{k.i}</div>
              <p style={{ fontSize: 9, color: "#6b7280", margin: 0, textTransform: "uppercase", letterSpacing: 0.3, fontWeight: 600 }}>{k.l}</p>
              <p style={{ fontSize: 16, fontWeight: 800, margin: "2px 0 0", color: k.c }}>{k.v}</p>
            </div>
          ))}
        </div>
        {/* Lista mock */}
        <div style={{ background: "#ffffff", borderRadius: 8, padding: 10, border: "1px solid #e5e7eb" }}>
          {[
            { n: "Ester Silva", m: "Sim, quero contratar!", t: "agora", c: "#22d36b" },
            { n: "João Pereira", m: "Vou pagar amanhã 💰", t: "5min", c: "#f59e0b" },
            { n: "Maria Santos", m: "Recebi o boleto", t: "12min", c: "#3b82f6" },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: i > 0 ? "1px solid #f3f4f6" : "none" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: c.c, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 700 }}>
                {c.n.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: "#1f2937" }}>{c.n}</p>
                <p style={{ fontSize: 10, color: "#6b7280", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.m}</p>
              </div>
              <span style={{ fontSize: 9, color: "#9ca3af" }}>{c.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockupChat({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(22,163,74,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <h3 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 6px", position: "relative" }}>💬 Chat unificado</h3>
      <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5, position: "relative" }}>Várias conversas, vários atendentes, um só painel. Histórico completo, etiquetas e respostas rápidas.</p>
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 12, border: "1px solid #1f2937" }}>
        {/* Cabeçalho chat */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid #1f2937", marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#22d36b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>E</div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "white", fontSize: 12, fontWeight: 700, margin: 0 }}>Ester Silva</p>
            <p style={{ color: "#22d36b", fontSize: 10, margin: 0 }}>● online</p>
          </div>
          <div style={{ background: "#3b82f622", color: "#3b82f6", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>🏷️ Lead Quente</div>
        </div>
        {/* Mensagens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ alignSelf: "flex-start", background: "#1f2937", borderRadius: "8px 8px 8px 2px", padding: "6px 10px", maxWidth: "75%" }}>
            <p style={{ color: "#d1d5db", fontSize: 11, margin: 0 }}>Olá! Tenho interesse no plano de 500MB</p>
          </div>
          <div style={{ alignSelf: "flex-end", background: "#16a34a", borderRadius: "8px 8px 2px 8px", padding: "6px 10px", maxWidth: "75%" }}>
            <p style={{ color: "white", fontSize: 11, margin: 0 }}>Oi Ester! Custa R$ 99/mês. Quer agendar a instalação?</p>
          </div>
          <div style={{ alignSelf: "flex-start", background: "#1f2937", borderRadius: "8px 8px 8px 2px", padding: "6px 10px", maxWidth: "75%" }}>
            <p style={{ color: "#22d36b", fontSize: 11, margin: 0, fontWeight: 700 }}>Sim, quero contratar! 🎉</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupFunil({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <h3 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 6px", position: "relative" }}>🎯 Funil visual</h3>
      <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5, position: "relative" }}>Kanban com etapas customizáveis. Arraste leads, acompanhe conversão, nunca perca uma venda.</p>
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 10, border: "1px solid #1f2937", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {[
          { t: "Novos", c: "#3b82f6", n: 8 },
          { t: "Negociando", c: "#f59e0b", n: 5 },
          { t: "Fechados", c: "#22d36b", n: 12 },
        ].map((col) => (
          <div key={col.t}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 6px", borderBottom: `2px solid ${col.c}66` }}>
              <span style={{ color: "#d1d5db", fontSize: 10, fontWeight: 700 }}>{col.t}</span>
              <span style={{ color: col.c, fontSize: 10, fontWeight: 800 }}>{col.n}</span>
            </div>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {[1,2].map(i => (
                <div key={i} style={{ background: "#1f2937", borderRadius: 4, padding: "5px 6px", borderLeft: `2px solid ${col.c}` }}>
                  <p style={{ color: "white", fontSize: 9, margin: 0, fontWeight: 600 }}>Cliente {i}</p>
                  <p style={{ color: "#6b7280", fontSize: 8, margin: 0 }}>R$ 99,90</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupCobranca({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,38,38,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <h3 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 6px", position: "relative" }}>💰 Cobrança automatizada</h3>
      <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5, position: "relative" }}>Faturas mensais geradas automaticamente. Cobrança via WhatsApp personalizada. Reduza inadimplência em 70%.</p>
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 10, border: "1px solid #1f2937" }}>
        {[
          { n: "Cliente A", v: "R$ 99,90", s: "Paga", c: "#22d36b", icon: "✓" },
          { n: "Cliente B", v: "R$ 149,90", s: "A pagar", c: "#f59e0b", icon: "⏳" },
          { n: "Cliente C", v: "R$ 99,90", s: "Atrasada", c: "#dc2626", icon: "🔴" },
          { n: "Cliente D", v: "R$ 199,90", s: "Promessa", c: "#3b82f6", icon: "🤝" },
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 4px", borderTop: i > 0 ? "1px solid #1f2937" : "none" }}>
            <span style={{ color: "white", fontSize: 11, flex: 1, fontWeight: 600 }}>{f.n}</span>
            <span style={{ color: "#22d36b", fontSize: 11, fontWeight: 700, marginRight: 8 }}>{f.v}</span>
            <span style={{ background: `${f.c}22`, color: f.c, fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${f.c}44`, fontWeight: 700 }}>{f.icon} {f.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupDashboardMini({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 14, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      <h3 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 6px", position: "relative" }}>📊 Dashboard em tempo real</h3>
      <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px", lineHeight: 1.5, position: "relative" }}>Métricas atualizadas instantaneamente. Por atendente, por equipe, por período. Sem planilha, sem retrabalho.</p>
      <div style={{ background: "#0a0a0a", borderRadius: 10, padding: 12, border: "1px solid #1f2937" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ color: "#9ca3af", fontSize: 10 }}>Atendimentos esta semana</span>
          <span style={{ color: "#22d36b", fontSize: 10, fontWeight: 700 }}>↗ +24%</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {[40, 65, 50, 75, 90, 55, 85].map((h, i) => (
            <div key={i} style={{ flex: 1, background: "linear-gradient(180deg, #a855f7 0%, #7c3aed 100%)", borderRadius: "3px 3px 0 0", height: `${h}%`, opacity: i === 6 ? 1 : 0.7 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {["S","T","Q","Q","S","S","D"].map((d, i) => (
            <span key={i} style={{ color: "#6b7280", fontSize: 9, flex: 1, textAlign: "center" }}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTILOS REUTILIZÁVEIS
// ═══════════════════════════════════════════════════════════════════════════

const navLink: React.CSSProperties = {
  color: "#9ca3af", fontSize: 14, textDecoration: "none", fontWeight: 500,
};

const btnNav: React.CSSProperties = {
  background: "linear-gradient(135deg, #16a34a 0%, #22d36b 100%)",
  color: "white", border: "none", borderRadius: 8,
  cursor: "pointer", fontWeight: 700,
  boxShadow: "0 2px 8px rgba(22,163,74,0.3)",
};

const btnPrimario: React.CSSProperties = {
  background: "linear-gradient(135deg, #16a34a 0%, #22d36b 100%)",
  color: "white", border: "none", borderRadius: 10,
  padding: "14px 28px", fontSize: 15, cursor: "pointer", fontWeight: 700,
  display: "inline-flex", alignItems: "center",
  boxShadow: "0 4px 16px rgba(22,163,74,0.4)",
  transition: "all 0.2s",
};

const btnSecundario: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10,
  padding: "14px 28px", fontSize: 15, cursor: "pointer", fontWeight: 600,
  transition: "all 0.2s",
};

const footerHeader: React.CSSProperties = {
  color: "white", fontSize: 13, fontWeight: 800, margin: "0 0 12px 0",
  textTransform: "uppercase", letterSpacing: 0.5,
};

const footerLink: React.CSSProperties = {
  color: "#9ca3af", fontSize: 13, textDecoration: "none",
};
