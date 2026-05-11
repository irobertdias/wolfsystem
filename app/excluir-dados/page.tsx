"use client";
import Link from "next/link";
import { useState } from "react";

export default function ExcluirDadosPage() {
  const [copiouEmail, setCopiouEmail] = useState(false);

  const copiarEmail = () => {
    navigator.clipboard.writeText("privacidade@wolfgyn.com.br");
    setCopiouEmail(true);
    setTimeout(() => setCopiouEmail(false), 2000);
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "white" }}>

      {/* NAVBAR */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "#0a0a0acc", backdropFilter: "blur(10px)", borderBottom: "1px solid #1f2937", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo1.png" alt="Wolf" style={{ width: 36, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "white", fontWeight: "bold", fontSize: 18 }}>Wolf System</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>← Voltar</Link>
          <Link href="/privacidade" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>Privacidade</Link>
          <Link href="/termos" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>Termos</Link>
        </div>
      </nav>

      {/* CONTEÚDO */}
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "120px 32px 80px", lineHeight: 1.7 }}>

        {/* Título */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-block", background: "#dc262622", border: "1px solid #dc262644", borderRadius: 20, padding: "6px 16px", marginBottom: 16 }}>
            <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: "bold" }}>🗑️ DIREITO À EXCLUSÃO</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: "bold", margin: "0 0 12px 0", lineHeight: 1.2 }}>Excluir Meus Dados</h1>
          <p style={{ color: "#9ca3af", fontSize: 15, margin: 0 }}>
            Conforme Lei Geral de Proteção de Dados (LGPD) e políticas da Meta, você tem o direito de solicitar a exclusão dos seus dados pessoais.
          </p>
        </div>

        {/* Box explicativo */}
        <div style={{ background: "#1f2937", borderRadius: 12, padding: "24px 28px", marginBottom: 32, border: "1px solid #374151" }}>
          <h2 style={{ color: "white", fontSize: 18, fontWeight: "bold", margin: "0 0 12px 0" }}>
            📋 Como solicitar a exclusão
          </h2>
          <p style={{ color: "#d1d5db", fontSize: 14, margin: "0 0 20px 0" }}>
            Envie um e-mail para o endereço abaixo com o assunto <strong style={{ color: "#16a34a" }}>"Exclusão de Dados"</strong> e os seguintes dados:
          </p>
          <ul style={{ color: "#d1d5db", fontSize: 14, paddingLeft: 24, margin: "0 0 24px 0" }}>
            <li>Seu nome completo</li>
            <li>E-mail de cadastro no Wolf System (se aplicável)</li>
            <li>CPF ou CNPJ usado no cadastro (para confirmar identidade)</li>
            <li>Motivo da solicitação (opcional)</li>
          </ul>

          {/* Email + botão de copiar */}
          <div style={{ background: "#0a0a0a", borderRadius: 8, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #1f2937" }}>
            <div>
              <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: 1, fontWeight: "bold" }}>
                E-mail para solicitação
              </p>
              <p style={{ color: "#16a34a", fontSize: 17, fontWeight: "bold", margin: 0, fontFamily: "monospace" }}>
                privacidade@wolfgyn.com.br
              </p>
            </div>
            <button
              onClick={copiarEmail}
              style={{
                background: copiouEmail ? "#16a34a" : "#16a34a22",
                color: copiouEmail ? "white" : "#16a34a",
                border: "1px solid #16a34a44",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s"
              }}
            >
              {copiouEmail ? "✓ Copiado!" : "📋 Copiar"}
            </button>
          </div>
        </div>

        {/* O que será excluído */}
        <H2>O que será excluído</H2>
        <Section>
          <p>Após confirmação da sua identidade, eliminaremos permanentemente:</p>
          <ul style={listaStyle}>
            <li>Sua conta de usuário no Wolf System (e-mail, senha, nome, telefone, CPF/CNPJ)</li>
            <li>Mensagens trocadas via WhatsApp, Facebook Messenger e Instagram Direct armazenadas em seu workspace</li>
            <li>Anexos (imagens, vídeos, áudios, documentos) das conversas</li>
            <li>Tokens de integração com Meta, WhatsApp, Twilio e Zenvia (revogados imediatamente)</li>
            <li>Histórico de atendimentos, etiquetas e anotações comerciais</li>
            <li>Gravações de chamadas VOIP (se aplicável)</li>
            <li>Logs de acesso vinculados à sua conta</li>
          </ul>
        </Section>

        {/* O que NÃO pode ser excluído */}
        <H2>O que NÃO pode ser excluído (obrigações legais)</H2>
        <Section>
          <p>Alguns dados precisam ser mantidos por exigência legal mesmo após a exclusão da conta:</p>
          <ul style={listaStyle}>
            <li><strong>Dados fiscais e financeiros:</strong> mantidos por 5 anos (legislação tributária brasileira)</li>
            <li><strong>Logs de acesso:</strong> mantidos por 6 meses (art. 15 do Marco Civil da Internet — Lei nº 12.965/2014)</li>
            <li><strong>Dados sob ordem judicial</strong> em andamento</li>
          </ul>
          <p>Esses dados ficam restritos ao cumprimento da obrigação legal específica e não são usados para nenhuma outra finalidade.</p>
        </Section>

        {/* Prazo */}
        <H2>Prazo de resposta</H2>
        <Section>
          <p>Nos termos do art. 19 da LGPD, atendemos à sua solicitação em até <strong style={{ color: "#16a34a" }}>15 dias corridos</strong> contados a partir do recebimento do pedido com identidade confirmada.</p>
          <p>Você receberá um e-mail de confirmação assim que a exclusão for concluída.</p>
        </Section>

        {/* Caso conectado via Meta */}
        <H2>Revogar acesso via Meta (Facebook/Instagram)</H2>
        <Section>
          <p>Se você conectou sua conta Facebook ou Instagram ao Wolf System, pode revogar o acesso a qualquer momento diretamente nas configurações da Meta, sem precisar do nosso atendimento:</p>
          <ol style={listaStyle}>
            <li>Acesse <a href="https://www.facebook.com/settings?tab=business_tools" style={linkVerde} target="_blank" rel="noopener noreferrer">facebook.com/settings/business_tools</a></li>
            <li>Localize <strong>"Wolf System"</strong> na lista de aplicativos conectados</li>
            <li>Clique em <strong>"Remover"</strong></li>
          </ol>
          <p>Isso revoga imediatamente o token de acesso. Para também excluir os dados que estão armazenados em nossos servidores, envie a solicitação por e-mail conforme instrução acima.</p>
        </Section>

        {/* Dúvidas */}
        <H2>Dúvidas ou problemas?</H2>
        <Section>
          <p>Se tiver qualquer dificuldade no processo de exclusão, entre em contato:</p>
          <ul style={listaStyle}>
            <li><strong>Encarregado (DPO):</strong> <a href="mailto:privacidade@wolfgyn.com.br" style={linkVerde}>privacidade@wolfgyn.com.br</a></li>
            <li><strong>Suporte geral:</strong> <a href="mailto:suporte@wolfgyn.com.br" style={linkVerde}>suporte@wolfgyn.com.br</a></li>
          </ul>
          <p>Você também pode acionar a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> em <a href="https://www.gov.br/anpd" style={linkVerde} target="_blank" rel="noopener noreferrer">gov.br/anpd</a> caso entenda que houve descumprimento da LGPD.</p>
        </Section>

        {/* CTA final */}
        <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid #1f2937", textAlign: "center" }}>
          <Link href="/privacidade" style={{ color: "#16a34a", fontSize: 14, textDecoration: "none", fontWeight: "bold" }}>← Voltar para a Política de Privacidade</Link>
        </div>

      </article>

      {/* FOOTER */}
      <footer style={{ padding: "32px", textAlign: "center", borderTop: "1px solid #1f2937" }}>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} Wolf System (ABC CALL E SERVICOS DIGITAIS LTDA — CNPJ 62.007.374/0001-96). Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

// ─── Helpers de estilo ────────────────────────────────────────────────
const linkVerde: React.CSSProperties = { color: "#16a34a", textDecoration: "none" };
const listaStyle: React.CSSProperties = { color: "#d1d5db", fontSize: 15, paddingLeft: 24, margin: "12px 0" };

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#d1d5db", fontSize: 15, marginBottom: 24 }}>{children}</div>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ color: "white", fontSize: 22, fontWeight: "bold", margin: "36px 0 14px 0", paddingBottom: 8, borderBottom: "1px solid #1f2937" }}>{children}</h2>;
}