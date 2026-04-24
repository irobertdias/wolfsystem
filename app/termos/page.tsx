"use client";
import Link from "next/link";

export default function TermosPage() {
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
        </div>
      </nav>

      {/* CONTEÚDO */}
      <article style={{ maxWidth: 840, margin: "0 auto", padding: "120px 32px 80px", lineHeight: 1.7 }}>

        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "#3b82f622", border: "1px solid #3b82f644", borderRadius: 20, padding: "6px 16px", marginBottom: 16 }}>
            <span style={{ color: "#3b82f6", fontSize: 13, fontWeight: "bold" }}>📄 Termos de Uso</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: "bold", margin: "0 0 12px 0", lineHeight: 1.2 }}>Termos de Uso</h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Última atualização: 24 de abril de 2026</p>
        </div>

        <Section>
          <p>Estes Termos de Uso ("Termos") regulam o uso da plataforma <strong>Wolf CRM</strong>, fornecida pela <strong>Wolf System</strong> ([PREENCHER razão social e CNPJ]), doravante "WOLF", "nós" ou "Plataforma".</p>
          <p>Ao cadastrar-se e usar a Plataforma, você ("USUÁRIO", "CLIENTE") concorda integralmente com estes Termos. Se não concordar, não use a Plataforma.</p>
        </Section>

        <H2>1. Descrição do serviço</H2>
        <Section>
          <p>O Wolf CRM é uma plataforma SaaS de relacionamento com o cliente que oferece, entre outras funcionalidades:</p>
          <ul style={listaStyle}>
            <li>Atendimento via WhatsApp (WebJS e WhatsApp Business API)</li>
            <li>Distribuição automática de leads (roleta)</li>
            <li>Chatbot com Inteligência Artificial e fluxos</li>
            <li>Disparos de mensagens em massa via templates aprovados</li>
            <li>Telefonia VOIP integrada (Twilio/Zenvia — modelo BYOC)</li>
            <li>Gestão de funil de vendas, propostas e relatórios</li>
            <li>Múltiplos usuários com controle granular de permissões</li>
          </ul>
        </Section>

        <H2>2. Cadastro e conta</H2>

        <H3>2.1 Quem pode usar</H3>
        <Section>
          <p>Apenas pessoas físicas maiores de 18 anos ou pessoas jurídicas regularmente constituídas no Brasil.</p>
        </Section>

        <H3>2.2 Dados verdadeiros</H3>
        <Section>
          <p>Você se compromete a fornecer informações precisas, atualizadas e completas. A Wolf pode suspender contas com informações falsas.</p>
        </Section>

        <H3>2.3 Responsabilidade pela conta</H3>
        <Section>
          <p>Você é responsável por:</p>
          <ul style={listaStyle}>
            <li>Manter a segurança de sua senha</li>
            <li>Todas as atividades realizadas em sua conta</li>
            <li>Comunicar imediatamente qualquer uso não autorizado</li>
          </ul>
        </Section>

        <H2>3. Planos, pagamento e cancelamento</H2>

        <H3>3.1 Planos</H3>
        <Section>
          <p>Os planos, preços e limites vigentes estão descritos em <Link href="/#planos" style={linkVerde}>wolfgyn.com.br/#planos</Link>. A Wolf pode alterar preços com <strong>30 dias de antecedência</strong>, comunicando por e-mail.</p>
        </Section>

        <H3>3.2 Forma de pagamento</H3>
        <Section>
          <p>Aceitamos PIX, boleto bancário, cartão de crédito e outros meios divulgados no site. O pagamento é <strong>antecipado</strong> e cobrado mensal ou anualmente conforme o plano.</p>
        </Section>

        <H3>3.3 Inadimplência</H3>
        <Section>
          <p>Se não recebermos o pagamento em até <strong>7 dias corridos</strong> do vencimento, a conta será automaticamente <strong>suspensa</strong>. Após <strong>30 dias</strong> de inadimplência, a conta pode ser <strong>cancelada</strong> e os dados excluídos conforme Política de Privacidade.</p>
        </Section>

        <H3>3.4 Cancelamento pelo Cliente</H3>
        <Section>
          <p>Você pode cancelar a qualquer momento, sem multa, comunicando com 7 dias de antecedência. Valores já pagos pelo período atual <strong>não são reembolsados</strong>, salvo determinação legal.</p>
        </Section>

        <H3>3.5 Cancelamento pela Wolf</H3>
        <Section>
          <p>Podemos cancelar sua conta, com ou sem aviso prévio, nos seguintes casos:</p>
          <ul style={listaStyle}>
            <li>Violação destes Termos</li>
            <li>Uso ilegal, fraudulento ou abusivo</li>
            <li>Inadimplência superior a 30 dias</li>
            <li>Ordem judicial</li>
          </ul>
        </Section>

        <H2>4. Uso permitido e proibido</H2>

        <H3>4.1 Uso permitido</H3>
        <Section>
          <p>Usar o Wolf para comunicação comercial legítima com seus contatos, respeitando a LGPD, o Código de Defesa do Consumidor e as políticas do WhatsApp.</p>
        </Section>

        <H3>4.2 Uso PROIBIDO</H3>
        <Section>
          <p>Você <strong>NÃO pode</strong> utilizar o Wolf para:</p>
          <ul style={listaStyle}>
            <li>Enviar <strong>spam</strong>, mensagens não solicitadas ou campanhas a listas sem opt-in válido</li>
            <li>Golpes, fraudes financeiras, phishing, pirâmides</li>
            <li>Conteúdo ilegal, ofensivo, discriminatório, terrorista ou que viole direitos autorais</li>
            <li>Atendimento de atividades proibidas por lei ou pelas políticas da Meta</li>
            <li>Tentativas de <strong>burlar</strong> a política 24h do WhatsApp ou de fazer <strong>engenharia reversa</strong> do sistema</li>
            <li>Revender o acesso à Plataforma a terceiros sem autorização por escrito</li>
          </ul>
        </Section>

        <H3>4.3 Responsabilidade pelo conteúdo</H3>
        <Section>
          <p>Você é <strong>integralmente responsável</strong> pelo conteúdo das mensagens enviadas e pelas listas de contatos utilizadas. A Wolf apenas fornece a ferramenta.</p>
          <p style={avisoImportante}><strong>Violações podem resultar em:</strong> suspensão imediata da conta, banimento do número WhatsApp Business pela Meta (risco seu), ações judiciais de terceiros contra você, notificações à ANPD.</p>
        </Section>

        <H2>5. Limitações de responsabilidade</H2>

        <H3>5.1 Disponibilidade</H3>
        <Section>
          <p>Buscamos manter a Plataforma disponível 24/7, mas <strong>não garantimos</strong> ausência total de falhas. Podem ocorrer:</p>
          <ul style={listaStyle}>
            <li>Manutenções programadas (comunicadas com antecedência)</li>
            <li>Incidentes de fornecedores terceirizados (Supabase, Vercel, Meta, Twilio)</li>
            <li>Eventos de força maior</li>
          </ul>
          <p><strong>Meta SLA de referência:</strong> 99% de uptime mensal.</p>
        </Section>

        <H3>5.2 Integrações de terceiros</H3>
        <Section>
          <p>Wolf não se responsabiliza por:</p>
          <ul style={listaStyle}>
            <li>Mudanças nas políticas ou APIs do WhatsApp, Meta, Twilio, Zenvia</li>
            <li>Banimentos ou suspensões impostas por esses terceiros</li>
            <li>Qualidade de entrega das mensagens (que depende das plataformas subjacentes)</li>
            <li>Custos cobrados por esses terceiros (você paga Twilio/Zenvia diretamente quando usa BYOC)</li>
          </ul>
        </Section>

        <H3>5.3 Limitação de danos</H3>
        <Section>
          <p>A responsabilidade total da Wolf, em qualquer situação, <strong>fica limitada ao valor pago pelo Cliente nos últimos 3 meses</strong>. Em nenhuma hipótese responderemos por:</p>
          <ul style={listaStyle}>
            <li>Lucros cessantes</li>
            <li>Danos indiretos ou consequenciais</li>
            <li>Perda de oportunidade de negócio</li>
            <li>Perda de dados causada por ações do próprio Cliente</li>
          </ul>
        </Section>

        <H2>6. Propriedade intelectual</H2>

        <H3>6.1 Da Wolf</H3>
        <Section>
          <p>Todo o software, marcas, design, código-fonte, textos e elementos visuais da Plataforma são de propriedade exclusiva da Wolf System. Você recebe <strong>licença de uso limitada, não-exclusiva, intransferível e revogável</strong> pelo período de vigência do contrato.</p>
        </Section>

        <H3>6.2 Do Cliente</H3>
        <Section>
          <p>O Cliente mantém total propriedade sobre:</p>
          <ul style={listaStyle}>
            <li>Dados cadastrados (contatos, histórico, etiquetas)</li>
            <li>Conteúdo das mensagens enviadas</li>
            <li>Integrações e configurações customizadas</li>
          </ul>
          <p>Ao cancelar a conta, pode exportar seus dados em até <strong>30 dias</strong>.</p>
        </Section>

        <H2>7. Proteção de dados (LGPD)</H2>
        <Section>
          <p>O tratamento de dados pessoais pela Plataforma está descrito em nossa <Link href="/privacidade" style={linkVerde}>Política de Privacidade</Link>, que é parte integrante destes Termos.</p>
          <p><strong>Papel das partes:</strong></p>
          <ul style={listaStyle}>
            <li>Wolf é <strong>Controladora</strong> dos dados dos Clientes</li>
            <li>Wolf é <strong>Operadora</strong> dos dados dos contatos que o Cliente cadastra</li>
            <li>O Cliente é <strong>Controlador</strong> dos dados de seus próprios contatos e responsável pela licitude do tratamento</li>
          </ul>
        </Section>

        <H2>8. Alterações destes Termos</H2>
        <Section>
          <p>Podemos modificar estes Termos a qualquer momento. Alterações relevantes serão comunicadas com <strong>30 dias de antecedência</strong> por e-mail e/ou aviso na Plataforma. O uso continuado após esse prazo representa aceite das novas condições.</p>
        </Section>

        <H2>9. Foro e legislação</H2>
        <Section>
          <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da Comarca de <strong>[PREENCHER cidade/UF do seu CNPJ]</strong> para dirimir qualquer controvérsia, renunciando as partes a qualquer outro, por mais privilegiado que seja.</p>
        </Section>

        <H2>10. Contato</H2>
        <Section>
          <ul style={listaStyle}>
            <li><strong>Suporte:</strong> <a href="mailto:suporte@wolfgyn.com.br" style={linkVerde}>suporte@wolfgyn.com.br</a></li>
            <li><strong>Comercial:</strong> <a href="mailto:comercial@wolfgyn.com.br" style={linkVerde}>comercial@wolfgyn.com.br</a></li>
            <li><strong>Privacidade/LGPD:</strong> <a href="mailto:privacidade@wolfgyn.com.br" style={linkVerde}>privacidade@wolfgyn.com.br</a></li>
            <li><strong>Site:</strong> <a href="https://www.wolfgyn.com.br" style={linkVerde}>https://www.wolfgyn.com.br</a></li>
          </ul>
        </Section>

        <div style={{ marginTop: 48, padding: 20, background: "#16a34a11", border: "1px solid #16a34a44", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#d1d5db", fontSize: 14, margin: 0, fontWeight: "bold" }}>
            Ao clicar em "Aceito os Termos" durante o cadastro, você declara ter lido, compreendido e concordado integralmente com este documento.
          </p>
        </div>

        <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid #1f2937", textAlign: "center" }}>
          <Link href="/" style={{ color: "#16a34a", fontSize: 14, textDecoration: "none", fontWeight: "bold" }}>← Voltar para a página inicial</Link>
        </div>

      </article>

      <footer style={{ padding: "32px", textAlign: "center", borderTop: "1px solid #1f2937" }}>
        <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>© {new Date().getFullYear()} Wolf System. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

// ─── Helpers de estilo ────────────────────────────────────────────────
const linkVerde: React.CSSProperties = { color: "#16a34a", textDecoration: "none" };
const listaStyle: React.CSSProperties = { color: "#d1d5db", fontSize: 15, paddingLeft: 24, margin: "12px 0" };
const avisoImportante: React.CSSProperties = { background: "#dc262611", border: "1px solid #dc262644", borderRadius: 8, padding: "14px 16px", color: "#fca5a5", fontSize: 14 };

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#d1d5db", fontSize: 15, marginBottom: 24 }}>{children}</div>;
}
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} style={{ color: "white", fontSize: 24, fontWeight: "bold", margin: "40px 0 16px 0", paddingBottom: 8, borderBottom: "1px solid #1f2937", scrollMarginTop: 80 }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ color: "#16a34a", fontSize: 17, fontWeight: "bold", margin: "24px 0 10px 0" }}>{children}</h3>;
}