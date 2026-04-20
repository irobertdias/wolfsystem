"use client";
import { useRouter } from "next/navigation";

export default function Site() {
  const router = useRouter();

  const planos = [
    {
      nome: "Básico",
      preco: "R$ 544,34",
      periodo: "/mês",
      cor: "#16a34a",
      destaque: false,
      recursos: [
        "Até 7 usuários",
        "ChatBot com IA",
        "Atendimentos ilimitados",
        "Mensagens ilimitadas",
        "Filas / Departamentos",
        "Geração de protocolo",
        "Chat para atendimento humano",
        "Dashboard de atendimentos",
        "CRM de Vendas",
        "Integração ChatBot + CRM",
        "Chat Interno",
      ],
    },
    {
      nome: "Intermediário",
      preco: "R$ 844,34",
      periodo: "/mês",
      cor: "#3b82f6",
      destaque: true,
      recursos: [
        "Até 15 usuários",
        "ChatBot com IA",
        "Agente de IA",
        "Atendimentos ilimitados",
        "Mensagens ilimitadas",
        "Filas / Departamentos",
        "Geração de protocolo",
        "Chat para atendimento humano",
        "Dashboard de atendimentos",
        "CRM de Vendas",
        "Integração ChatBot + CRM",
        "Chat Interno",
        "API de Integração",
      ],
    },
    {
      nome: "Ultra",
      preco: "R$ 1.099,99",
      periodo: "/mês",
      cor: "#8b5cf6",
      destaque: false,
      recursos: [
        "Até 50 usuários",
        "ChatBot com IA",
        "Agente de IA",
        "Atendimentos ilimitados",
        "Mensagens ilimitadas",
        "Filas / Departamentos",
        "Geração de protocolo",
        "Chat para atendimento humano",
        "Dashboard de atendimentos",
        "CRM de Vendas",
        "Integração ChatBot + CRM",
        "Chat Interno",
        "API de Integração",
        "Instagram Direct",
      ],
    },
  ];

  const irParaCadastro = () => window.location.href = "https://app.wolfgyn.com.br/login/register";
  const irParaLogin = () => window.location.href = "https://app.wolfgyn.com.br/login";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "white" }}>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "#0a0a0acc", backdropFilter: "blur(10px)", borderBottom: "1px solid #1f2937", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 36, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>Wolf System</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="#planos" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>Planos</a>
          <a href="#recursos" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>Recursos</a>
          <button onClick={irParaLogin} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 14, cursor: "pointer", fontWeight: "bold" }}>
            Acessar Sistema
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 140, paddingBottom: 80, textAlign: "center", padding: "140px 32px 80px" }}>
        <div style={{ display: "inline-block", background: "#16a34a22", border: "1px solid #16a34a44", borderRadius: 20, padding: "6px 16px", marginBottom: 24 }}>
          <span style={{ color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>🐺 O sistema que seu negócio precisa</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: "bold", margin: "0 0 24px 0", lineHeight: 1.2 }}>
          CRM + ChatBot com<br />
          <span style={{ color: "#16a34a" }}>WhatsApp & IA</span>
        </h1>
        <p style={{ color: "#9ca3af", fontSize: 18, maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.6 }}>
          Automatize seu atendimento, gerencie seus leads e aumente suas vendas com o poder da Inteligência Artificial.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={irParaCadastro} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 16, cursor: "pointer", fontWeight: "bold" }}>
            Começar Teste Grátis →
          </button>
          <a href="#planos" style={{ background: "none", color: "white", border: "1px solid #374151", borderRadius: 10, padding: "14px 32px", fontSize: 16, cursor: "pointer", fontWeight: "bold", textDecoration: "none", display: "inline-block" }}>
            Ver Planos
          </a>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "0 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { valor: "100%", label: "Atendimentos automatizados" },
            { valor: "24/7", label: "Disponibilidade do chatbot" },
            { valor: "∞", label: "Mensagens e atendimentos" },
            { valor: "🤖", label: "IA integrada ao CRM" },
          ].map((stat) => (
            <div key={stat.label} style={{ flex: "1 1 200px", background: "#111", borderRadius: 12, padding: "24px 32px", border: "1px solid #1f2937", textAlign: "center" }}>
              <p style={{ color: "#16a34a", fontSize: 36, fontWeight: "bold", margin: "0 0 8px 0" }}>{stat.valor}</p>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" style={{ padding: "80px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: "bold", margin: "0 0 16px 0" }}>Tudo que você precisa em <span style={{ color: "#16a34a" }}>um só lugar</span></h2>
          <p style={{ color: "#9ca3af", fontSize: 16 }}>Do atendimento automatizado até o fechamento da venda</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {[
            { icon: "🤖", titulo: "ChatBot com IA", desc: "Respostas automáticas inteligentes 24 horas por dia com GPT, Claude ou Gemini." },
            { icon: "💬", titulo: "Atendimento Humano", desc: "Assuma conversas quando necessário com chat em tempo real integrado ao WhatsApp." },
            { icon: "📊", titulo: "CRM de Vendas", desc: "Gerencie todo seu funil de vendas, propostas e clientes em um painel completo." },
            { icon: "🏢", titulo: "Filas e Departamentos", desc: "Organize seu time com filas de atendimento e distribuição automática por roleta." },
            { icon: "📋", titulo: "Geração de Protocolo", desc: "Cada atendimento gera um protocolo automático para rastreabilidade total." },
            { icon: "🔗", titulo: "Integração ChatBot + CRM", desc: "Abra uma proposta de venda direto do chat com nome e número já preenchidos." },
          ].map((r) => (
            <div key={r.titulo} style={{ background: "#111", borderRadius: 12, padding: 28, border: "1px solid #1f2937" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{r.icon}</div>
              <h3 style={{ color: "white", fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>{r.titulo}</h3>
              <p style={{ color: "#9ca3af", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" style={{ padding: "80px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontSize: 36, fontWeight: "bold", margin: "0 0 16px 0" }}>Escolha seu <span style={{ color: "#16a34a" }}>plano</span></h2>
          <p style={{ color: "#9ca3af", fontSize: 16 }}>Sem fidelidade. Cancele quando quiser.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {planos.map((plano) => (
            <div key={plano.nome} style={{ background: "#111", borderRadius: 16, padding: 32, border: `2px solid ${plano.destaque ? plano.cor : "#1f2937"}`, position: "relative" }}>
              {plano.destaque && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: plano.cor, color: "white", borderRadius: 20, padding: "4px 16px", fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>
                  ⭐ MAIS POPULAR
                </div>
              )}
              <h3 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: "0 0 8px 0" }}>Plano {plano.nome}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                <span style={{ color: plano.cor, fontSize: 36, fontWeight: "bold" }}>{plano.preco}</span>
                <span style={{ color: "#6b7280", fontSize: 14 }}>{plano.periodo}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {plano.recursos.map((r) => (
                  <div key={r} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: plano.cor, fontSize: 16 }}>✓</span>
                    <span style={{ color: "#d1d5db", fontSize: 14 }}>{r}</span>
                  </div>
                ))}
              </div>
              <button onClick={irParaCadastro} style={{ width: "100%", background: plano.destaque ? plano.cor : "none", color: plano.destaque ? "white" : plano.cor, border: `2px solid ${plano.cor}`, borderRadius: 10, padding: "12px", fontSize: 15, cursor: "pointer", fontWeight: "bold" }}>
                Começar Agora →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 32px", textAlign: "center", background: "#111", borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 36, fontWeight: "bold", margin: "0 0 16px 0" }}>Pronto para <span style={{ color: "#16a34a" }}>transformar</span> seu atendimento?</h2>
        <p style={{ color: "#9ca3af", fontSize: 16, marginBottom: 32 }}>Comece hoje mesmo. Sem burocracia, sem fidelidade.</p>
        <button onClick={irParaCadastro} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 10, padding: "16px 40px", fontSize: 18, cursor: "pointer", fontWeight: "bold" }}>
          Criar Conta Grátis 🐺
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "32px", textAlign: "center", borderTop: "1px solid #1f2937" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 28, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold" }}>Wolf System</span>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>© 2025 Wolf System. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}