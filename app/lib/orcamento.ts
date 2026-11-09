// Orçamento comercial do Wolf System: itens padrão e dados de pagamento.

export type ItemOrcamento = { nome: string; sub: string; cor: string; linhas: string[] };

export const ITENS_PADRAO: ItemOrcamento[] = [
  { nome: "Plataforma Wolf System", sub: "usuários", cor: "#059669", linhas: [
    "Acesso individual com login e senha para cada usuário",
    "Perfis e grupos de permissão por função",
    "Acesso pelo navegador, no computador e no celular",
  ] },
  { nome: "Módulo CRM", sub: "Gestão comercial", cor: "#2563eb", linhas: [
    "Funil de vendas, contatos e histórico do cliente",
    "Vendas por consultor e por equipe",
    "Dashboard com os números da operação",
  ] },
  { nome: "Módulo Chatbot", sub: "Atendimento no WhatsApp", cor: "#0d9488", linhas: [
    "Vários atendentes no mesmo número de WhatsApp",
    "Fluxos automáticos e respostas rápidas",
    "Transferência de conversas e histórico completo",
  ] },
  { nome: "Módulo Revisional", sub: "Análise contratual", cor: "#8b5cf6", linhas: [
    "Simulação de financiamento imobiliário e de veículo",
    "Comparação automática com a taxa média do Banco Central",
    "Proposta por link com validade, aceite online e PDF",
  ] },
];

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
