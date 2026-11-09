// Orçamento comercial do Wolf System: itens padrão e dados de pagamento.

export type ItemOrcamento = { id?: string; nome: string; sub: string; cor: string; linhas: string[] };

/** Catálogo de tudo o que pode entrar num orçamento. "plataforma" é sempre incluída. */
export const CATALOGO: (ItemOrcamento & { id: string })[] = [
  { id: "plataforma", nome: "Plataforma Wolf System", sub: "usuários", cor: "#059669", linhas: [
    "Acesso individual com login e senha para cada usuário",
    "Perfis e grupos de permissão por função",
    "Acesso pelo navegador, no computador e no celular",
  ] },
  { id: "crm", nome: "Módulo CRM", sub: "Gestão comercial", cor: "#2563eb", linhas: [
    "Funil de vendas, contatos e histórico do cliente",
    "Vendas por consultor e por equipe",
    "Dashboard com os números da operação",
  ] },
  { id: "chatbot", nome: "Módulo Chatbot", sub: "Atendimento no WhatsApp", cor: "#0d9488", linhas: [
    "Vários atendentes no mesmo número de WhatsApp",
    "Fluxos automáticos e respostas rápidas",
    "Transferência de conversas e histórico completo",
  ] },
  { id: "revisional", nome: "Módulo Revisional", sub: "Análise contratual", cor: "#8b5cf6", linhas: [
    "Simulação de financiamento imobiliário e de veículo",
    "Comparação automática com a taxa média do Banco Central",
    "Proposta por link com validade, aceite online e PDF",
  ] },
  { id: "contratos", nome: "Contratos e Assinaturas", sub: "Assinatura eletrônica", cor: "#155eef", linhas: [
    "Envio de contratos para assinatura por link",
    "Assinatura com validação do signatário",
    "Contratos assinados guardados e para baixar",
  ] },
  { id: "roleta", nome: "Roleta de Distribuição", sub: "Distribuição de leads", cor: "#3b82f6", linhas: [
    "Distribui os novos contatos entre os atendentes",
    "Divisão equilibrada da fila de atendimento",
  ] },
  { id: "disparos_web", nome: "Disparos Web", sub: "Envio em massa", cor: "#0ea5e9", linhas: [
    "Envio de mensagens em massa pelo WhatsApp",
    "Listas de contatos e acompanhamento dos envios",
  ] },
  { id: "disparos_api", nome: "Disparos API", sub: "API oficial do WhatsApp", cor: "#6366f1", linhas: [
    "Campanhas pela API oficial do WhatsApp (Meta)",
    "Modelos de mensagem aprovados",
  ] },
  { id: "validacao", nome: "Validação de Números", sub: "Higienização de listas", cor: "#0891b2", linhas: [
    "Confere quais números têm WhatsApp",
    "Limpa listas antes das campanhas",
  ] },
  { id: "voip", nome: "Telefonia VoIP", sub: "Ligações pelo sistema", cor: "#7c3aed", linhas: [
    "Ligações direto do navegador",
    "Atendimento por telefone integrado ao cliente",
  ] },
  { id: "instagram", nome: "Instagram Direct", sub: "Atendimento no Instagram", cor: "#ec4899", linhas: [
    "Mensagens do Instagram na mesma tela do WhatsApp",
  ] },
  { id: "meta_ads", nome: "Central Ads", sub: "Mídia paga", cor: "#9333ea", linhas: [
    "Campanhas e resultados de anúncios em um painel",
  ] },
  { id: "equipes", nome: "Equipes Multi-time", sub: "Gestão de equipes", cor: "#2563eb", linhas: [
    "Separação de atendentes e vendas por equipe",
    "Supervisores com visão da própria equipe",
  ] },
  { id: "funil_avancado", nome: "Funil Avançado", sub: "Etapas personalizadas", cor: "#1d4ed8", linhas: [
    "Etapas do funil sob medida para a operação",
  ] },
  { id: "cobranca", nome: "Cobrança Automatizada", sub: "Lembretes de pagamento", cor: "#16a34a", linhas: [
    "Lembretes automáticos de vencimento",
    "Acompanhamento de quem pagou e de quem está em atraso",
  ] },
  { id: "financeiro", nome: "Financeiro", sub: "Gestão financeira", cor: "#d97706", linhas: [
    "Contas a pagar e a receber, caixa e conciliação",
    "DRE e relatórios financeiros",
  ] },
  { id: "rh", nome: "RH", sub: "Gestão de pessoas", cor: "#ea580c", linhas: [
    "Cadastro de colaboradores, folha e férias",
  ] },
  { id: "ponto", nome: "Bater Ponto", sub: "Controle de jornada", cor: "#f59e0b", linhas: [
    "Registro de ponto com selfie e GPS",
  ] },
  { id: "api", nome: "API de Integração", sub: "Integração com outros sistemas", cor: "#475569", linhas: [
    "Conecta o Wolf System a outros sistemas da empresa",
  ] },
];

export const IDS_PADRAO = ["plataforma", "crm", "chatbot", "revisional"];
export const ITENS_PADRAO: ItemOrcamento[] = CATALOGO.filter((i) => IDS_PADRAO.includes(i.id));

const COR_VALIDA = /^#[0-9a-f]{6}$/i;
/** Limpa a lista de itens vinda do painel (catálogo + personalizados). */
export function sanitizarItens(v: unknown): ItemOrcamento[] {
  const lista = Array.isArray(v) ? v : [];
  const itens = lista.slice(0, 25).map((x: Record<string, unknown>) => ({
    id: String(x?.id ?? "").slice(0, 40) || undefined,
    nome: String(x?.nome ?? "").trim().slice(0, 80),
    sub: String(x?.sub ?? "").trim().slice(0, 60),
    cor: COR_VALIDA.test(String(x?.cor)) ? String(x?.cor) : "#475569",
    linhas: (Array.isArray(x?.linhas) ? x.linhas : []).map((l: unknown) => String(l ?? "").trim().slice(0, 140)).filter(Boolean).slice(0, 6),
  })).filter((i) => i.nome);
  // a plataforma sempre vai primeiro
  if (!itens.some((i) => i.id === "plataforma")) itens.unshift(CATALOGO[0]);
  return itens.sort((a, b) => (a.id === "plataforma" ? -1 : b.id === "plataforma" ? 1 : 0));
}
export type DadosPagamento = { tipo: string; chave: string; favorecido: string; banco: string; cnpj: string };

export const PAGAMENTO_PADRAO: DadosPagamento = {
  tipo: "PIX (chave CNPJ)",
  chave: "62007374000196",
  favorecido: "Abc Call e Serviços",
  banco: "Nubank",
  cnpj: "62.007.374/0001-96",
};

export type UsuarioImplantacao = { nome: string; email: string; telefone: string; perfil: string };
export type Implantacao = {
  razao_social: string;
  cnpj: string;
  responsavel: string;
  email: string;
  telefone: string;
  whatsapp_atendimento: string;
  usuarios: UsuarioImplantacao[];
  pagamento_realizado: boolean;
  observacoes: string;
};

export const PERFIS = ["Administrador", "Supervisor", "Atendente"] as const;

const limpar = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);

export function normalizarImplantacao(b: Record<string, any>, maxUsuarios: number): Implantacao {
  const usuarios = (Array.isArray(b.usuarios) ? b.usuarios : [])
    .map((u: Record<string, unknown>) => ({
      nome: limpar(u?.nome, 120),
      email: limpar(u?.email, 160).toLowerCase(),
      telefone: limpar(u?.telefone, 20).replace(/[^\d+]/g, ""),
      perfil: (PERFIS as readonly string[]).includes(String(u?.perfil)) ? String(u?.perfil) : "Atendente",
    }))
    .filter((u: UsuarioImplantacao) => u.nome || u.email)
    .slice(0, Math.max(1, maxUsuarios));
  return {
    razao_social: limpar(b.razao_social),
    cnpj: limpar(b.cnpj, 20).replace(/\D/g, ""),
    responsavel: limpar(b.responsavel, 120),
    email: limpar(b.email, 160).toLowerCase(),
    telefone: limpar(b.telefone, 20).replace(/\D/g, ""),
    whatsapp_atendimento: limpar(b.whatsapp_atendimento, 20).replace(/\D/g, ""),
    usuarios,
    pagamento_realizado: b.pagamento_realizado === true,
    observacoes: limpar(b.observacoes, 1500),
  };
}

export function validarImplantacao(i: Implantacao): string[] {
  const e: string[] = [];
  const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (!i.razao_social) e.push("Informe a razão social ou nome da empresa");
  if (i.cnpj && i.cnpj.length !== 14 && i.cnpj.length !== 11) e.push("CNPJ/CPF inválido");
  if (!i.responsavel) e.push("Informe o responsável");
  if (!emailOk(i.email)) e.push("Informe um e-mail válido do responsável");
  if (i.telefone.length < 10) e.push("Informe o telefone do responsável com DDD");
  if (!i.usuarios.length) e.push("Cadastre pelo menos um usuário");
  i.usuarios.forEach((u, k) => {
    if (!u.nome) e.push(`Usuário ${k + 1}: informe o nome`);
    if (!emailOk(u.email)) e.push(`Usuário ${k + 1}: e-mail inválido`);
  });
  const emails = i.usuarios.map((u) => u.email).filter(Boolean);
  if (new Set(emails).size !== emails.length) e.push("Há e-mails de usuário repetidos");
  return e;
}

export const brlOrc = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
