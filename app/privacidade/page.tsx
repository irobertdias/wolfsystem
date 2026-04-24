"use client";
import Link from "next/link";

export default function PrivacidadePage() {
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
          <Link href="/termos" style={{ color: "#9ca3af", fontSize: 14, textDecoration: "none" }}>Termos de Uso</Link>
        </div>
      </nav>

      {/* CONTEÚDO */}
      <article style={{ maxWidth: 840, margin: "0 auto", padding: "120px 32px 80px", lineHeight: 1.7 }}>

        {/* Título */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "#16a34a22", border: "1px solid #16a34a44", borderRadius: 20, padding: "6px 16px", marginBottom: 16 }}>
            <span style={{ color: "#16a34a", fontSize: 13, fontWeight: "bold" }}>🔒 LGPD</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: "bold", margin: "0 0 12px 0", lineHeight: 1.2 }}>Política de Privacidade</h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Última atualização: 24 de abril de 2026</p>
        </div>

        <Section>
          <p>A <strong>Wolf System</strong> valoriza sua privacidade e está comprometida com a proteção de seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — "LGPD"). Esta Política explica como coletamos, usamos, armazenamos, compartilhamos e protegemos suas informações ao usar a plataforma <strong>Wolf CRM</strong> (acessível em app.wolfgyn.com.br e domínios relacionados).</p>
          <p>Ao criar uma conta ou utilizar nossos serviços, você declara que leu, compreendeu e concorda com os termos desta Política.</p>
        </Section>

        <H2>1. Identificação do Controlador</H2>
        <Section>
          <p><strong>Razão Social:</strong> [PREENCHER: nome do seu CNPJ]<br />
            <strong>CNPJ:</strong> [PREENCHER]<br />
            <strong>Endereço:</strong> [PREENCHER]<br />
            <strong>E-mail do Encarregado (DPO):</strong> <a href="mailto:privacidade@wolfgyn.com.br" style={linkVerde}>privacidade@wolfgyn.com.br</a>
          </p>
          <p>Para exercer qualquer direito previsto nesta Política ou tirar dúvidas sobre proteção de dados, entre em contato pelo e-mail acima.</p>
        </Section>

        <H2>2. Dados que coletamos</H2>

        <H3>2.1 Dados fornecidos por você (titular Cliente)</H3>
        <Section>
          <p>Ao se cadastrar, você nos fornece:</p>
          <ul style={listaStyle}>
            <li>Nome completo, CPF/CNPJ, razão social</li>
            <li>E-mail e telefone de contato</li>
            <li>Dados de pagamento (processados exclusivamente por gateway terceirizado — não armazenamos dados de cartão de crédito em nossos servidores)</li>
            <li>Credenciais de integração (tokens de API do WhatsApp, Twilio, Zenvia) — criptografadas e usadas exclusivamente para viabilizar o serviço</li>
          </ul>
        </Section>

        <H3>2.2 Dados de terceiros (contatos do Cliente)</H3>
        <Section>
          <p>Ao utilizar o Wolf CRM para se comunicar com seus próprios clientes, você nos envia, como Controlador desses dados:</p>
          <ul style={listaStyle}>
            <li>Números de telefone, nomes e mensagens trocadas via WhatsApp</li>
            <li>Histórico de atendimentos, gravações de chamadas de voz (quando habilitado)</li>
            <li>Etiquetas, anotações e informações comerciais que você cadastrar</li>
          </ul>
          <p style={avisoImportante}><strong>Importante:</strong> Em relação a esses dados, <strong>você é o Controlador</strong> e a Wolf System atua como <strong>Operador</strong>, nos termos dos artigos 5º, VI e VII da LGPD. Você é responsável por obter o consentimento dos titulares e por garantir que o uso esteja em conformidade com a legislação.</p>
        </Section>

        <H3>2.3 Dados coletados automaticamente</H3>
        <Section>
          <ul style={listaStyle}>
            <li>Endereço IP, tipo de navegador, sistema operacional</li>
            <li>Logs de acesso e ações realizadas na plataforma</li>
            <li>Cookies essenciais para funcionamento da sessão</li>
          </ul>
        </Section>

        <H2>3. Base legal e finalidades</H2>
        <Section>
          <p>Tratamos seus dados com base nas seguintes hipóteses previstas na LGPD:</p>
          <Table>
            <thead>
              <tr>
                <th style={thStyle}>Finalidade</th>
                <th style={thStyle}>Base Legal</th>
              </tr>
            </thead>
            <tbody>
              <Row>Cadastro e autenticação | Execução de contrato (art. 7º, V)</Row>
              <Row>Cobrança e emissão de nota fiscal | Obrigação legal (art. 7º, II)</Row>
              <Row>Envio de comunicados sobre o serviço | Legítimo interesse (art. 7º, IX)</Row>
              <Row>Marketing e novidades | Consentimento (art. 7º, I) — você pode recusar</Row>
              <Row>Suporte técnico | Execução de contrato</Row>
              <Row>Prevenção a fraudes | Legítimo interesse</Row>
              <Row>Cumprimento de ordem judicial | Obrigação legal</Row>
            </tbody>
          </Table>
        </Section>

        <H2>4. Compartilhamento de dados</H2>
        <Section>
          <p>A Wolf System <strong>não vende</strong> seus dados. Compartilhamos apenas com:</p>
          <p><strong>Operadores estritamente necessários:</strong></p>
          <ul style={listaStyle}>
            <li>Supabase (banco de dados — armazenamento)</li>
            <li>Vercel (hospedagem do frontend)</li>
            <li>Meta/WhatsApp Business (integração de mensagens)</li>
            <li>Twilio / Zenvia (telefonia VOIP — apenas se você habilitar)</li>
            <li>Processadora de pagamentos (quando aplicável)</li>
          </ul>
          <p><strong>Autoridades públicas</strong>, mediante ordem legal, judicial ou requisição administrativa legítima.</p>
          <p>Todos os operadores contratados possuem cláusulas contratuais garantindo padrão equivalente ou superior ao desta Política.</p>
        </Section>

        <H2>5. Armazenamento e segurança</H2>
        <Section>
          <ul style={listaStyle}>
            <li>Dados são armazenados em servidores localizados nos <strong>Estados Unidos</strong> (Supabase, Vercel) e no <strong>Brasil</strong> (servidor VPS)</li>
            <li>Transferências internacionais seguem o disposto no art. 33 da LGPD</li>
            <li>Comunicação entre seu navegador e nossos servidores é protegida por <strong>TLS/HTTPS</strong></li>
            <li>Senhas são armazenadas com <strong>hash criptográfico</strong> (nunca em texto puro)</li>
            <li>Credenciais sensíveis (tokens WABA, Twilio) são criptografadas em repouso</li>
            <li>Backups automáticos diários, com retenção mínima de 30 dias</li>
          </ul>

          <H3>Retenção</H3>
          <Table>
            <thead>
              <tr>
                <th style={thStyle}>Tipo de dado</th>
                <th style={thStyle}>Tempo de retenção</th>
              </tr>
            </thead>
            <tbody>
              <Row>Conta ativa | Enquanto durar a relação contratual</Row>
              <Row>Conta cancelada | 12 meses após o cancelamento, salvo obrigação legal maior</Row>
              <Row>Logs de acesso | 6 meses (art. 15 do Marco Civil da Internet)</Row>
              <Row>Dados financeiros | 5 anos (legislação fiscal)</Row>
            </tbody>
          </Table>
          <p>Após esses prazos, os dados são anonimizados ou eliminados.</p>
        </Section>

        <H2 id="seus-direitos">6. Seus direitos como titular</H2>
        <Section>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ol style={listaStyle}>
            <li><strong>Confirmação</strong> da existência de tratamento</li>
            <li><strong>Acesso</strong> aos seus dados</li>
            <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados</li>
            <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários ou tratados em desconformidade</li>
            <li><strong>Portabilidade</strong> a outro fornecedor</li>
            <li><strong>Eliminação</strong> dos dados tratados com seu consentimento</li>
            <li><strong>Informação</strong> sobre entidades com as quais compartilhamos seus dados</li>
            <li><strong>Revogação do consentimento</strong></li>
          </ol>
          <p>Basta enviar solicitação para <a href="mailto:privacidade@wolfgyn.com.br" style={linkVerde}>privacidade@wolfgyn.com.br</a> com comprovação de identidade. Responderemos em até <strong>15 dias</strong>.</p>
        </Section>

        <H2>7. Cookies</H2>
        <Section>
          <p>Usamos apenas cookies essenciais para:</p>
          <ul style={listaStyle}>
            <li>Manter sua sessão ativa</li>
            <li>Lembrar suas preferências (tema, idioma)</li>
            <li>Prevenir fraude (identificação anti-bot)</li>
          </ul>
          <p>Não utilizamos cookies de rastreamento publicitário de terceiros. Você pode desabilitar cookies no seu navegador, mas a plataforma pode não funcionar corretamente.</p>
        </Section>

        <H2>8. Menores de idade</H2>
        <Section>
          <p>A Wolf System <strong>não é direcionada a menores de 18 anos</strong>. Não coletamos conscientemente dados de menores. Se tomarmos conhecimento de que isso ocorreu, eliminaremos os dados imediatamente.</p>
        </Section>

        <H2>9. Alterações desta Política</H2>
        <Section>
          <p>Podemos atualizar esta Política periodicamente. Alterações materiais serão comunicadas por e-mail e/ou aviso na plataforma com, no mínimo, <strong>30 dias de antecedência</strong>. A data da última atualização está no topo do documento.</p>
        </Section>

        <H2>10. Como nos contatar</H2>
        <Section>
          <ul style={listaStyle}>
            <li><strong>E-mail (LGPD/DPO):</strong> <a href="mailto:privacidade@wolfgyn.com.br" style={linkVerde}>privacidade@wolfgyn.com.br</a></li>
            <li><strong>Suporte geral:</strong> <a href="mailto:suporte@wolfgyn.com.br" style={linkVerde}>suporte@wolfgyn.com.br</a></li>
            <li><strong>Site:</strong> <a href="https://www.wolfgyn.com.br" style={linkVerde}>https://www.wolfgyn.com.br</a></li>
          </ul>
          <p>Para denúncias de violação, você também pode contatar a <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> através do site <a href="https://www.gov.br/anpd" style={linkVerde} target="_blank" rel="noopener noreferrer">gov.br/anpd</a>.</p>
        </Section>

        {/* CTA final */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: "1px solid #1f2937", textAlign: "center" }}>
          <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 16 }}>Dúvidas? Entre em contato com nosso time.</p>
          <Link href="/" style={{ color: "#16a34a", fontSize: 14, textDecoration: "none", fontWeight: "bold" }}>← Voltar para a página inicial</Link>
        </div>

      </article>

      {/* FOOTER */}
      <footer style={{ padding: "32px", textAlign: "center", borderTop: "1px solid #1f2937" }}>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} Wolf System. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

// ─── Helpers de estilo ────────────────────────────────────────────────
const linkVerde: React.CSSProperties = { color: "#16a34a", textDecoration: "none" };
const listaStyle: React.CSSProperties = { color: "#d1d5db", fontSize: 15, paddingLeft: 24, margin: "12px 0" };
const thStyle: React.CSSProperties = { color: "white", fontSize: 13, textAlign: "left", padding: "10px 12px", background: "#111", borderBottom: "2px solid #1f2937" };
const avisoImportante: React.CSSProperties = { background: "#f59e0b11", border: "1px solid #f59e0b44", borderRadius: 8, padding: "14px 16px", color: "#fbbf24", fontSize: 14 };

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#d1d5db", fontSize: 15, marginBottom: 24 }}>{children}</div>;
}
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} style={{ color: "white", fontSize: 24, fontWeight: "bold", margin: "40px 0 16px 0", paddingBottom: 8, borderBottom: "1px solid #1f2937", scrollMarginTop: 80 }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ color: "#16a34a", fontSize: 17, fontWeight: "bold", margin: "24px 0 10px 0" }}>{children}</h3>;
}
function Table({ children }: { children: React.ReactNode }) {
  return <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", background: "#0a0a0a", borderRadius: 8, overflow: "hidden", border: "1px solid #1f2937" }}>{children}</table>;
}
function Row({ children }: { children: string }) {
  // Converte "coluna1 | coluna2" em <tr><td>coluna1</td><td>coluna2</td></tr>
  const [c1, c2] = children.split("|").map(s => s.trim());
  return <tr><td style={{ color: "#d1d5db", fontSize: 14, padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>{c1}</td><td style={{ color: "#9ca3af", fontSize: 14, padding: "10px 12px", borderBottom: "1px solid #1f2937" }}>{c2}</td></tr>;
}