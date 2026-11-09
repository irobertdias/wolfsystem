// Tabela de preços do Wolf System — fonte única para o site (cards de planos),
// o "Monte seu plano" (SimuladorOrcamento) e a tela de Orçamentos.
// Mudou preço? Mude só aqui.

export const PRECO_USUARIO_EXTRA = 49;
export const PRECO_WHATSAPP_EXTRA = 149;
export const CONFIGURACAO_PADRAO = 1000;

export type PlanoWolf = {
  id: "basico" | "intermediario" | "ultra";
  nome: string;
  preco: number;
  usuarios: number;
  whatsapps: number;
  inclui: string[];        // ids de módulos (ver PRECO_MODULO) que já vêm no plano
  cor: string;
  descricao: string;
  recursos: string[];      // lista dos cards do site
  resumo: string[];        // 3 linhas para orçamento e simulador
  destaque?: boolean;
};

export const PLANOS_WOLF: PlanoWolf[] = [
  {
    id: "basico", nome: "Básico", preco: 597, usuarios: 5, whatsapps: 1, cor: "#16a34a",
    inclui: ["crm", "chatbot"],
    descricao: "Para organizar atendimento e vendas com uma operação profissional.",
    recursos: ["Até 5 usuários", "1 conexão WhatsApp", "Chat unificado", "CRM de vendas", "ChatBot visual", "Filas e departamentos", "Protocolos e etiquetas", "Dashboard operacional"],
    resumo: ["5 usuários e 1 conexão de WhatsApp", "CRM de vendas e Chatbot visual", "Filas, etiquetas e dashboard"],
  },
  {
    id: "intermediario", nome: "Intermediário", preco: 1097, usuarios: 12, whatsapps: 2, cor: "#2563eb", destaque: true,
    inclui: ["crm", "chatbot", "roleta", "disparos_web", "equipes", "api"],
    descricao: "Para equipes comerciais que precisam automatizar, distribuir e medir.",
    recursos: ["Até 12 usuários", "2 conexões WhatsApp", "Tudo do Básico", "Roleta de distribuição", "Disparos via WhatsApp Web", "Equipes e permissões", "API de integração", "Indicadores comerciais"],
    resumo: ["12 usuários e 2 conexões de WhatsApp", "Tudo do Básico", "Roleta, disparos, equipes e API de integração"],
  },
  {
    id: "ultra", nome: "Ultra", preco: 1997, usuarios: 25, whatsapps: 3, cor: "#7c3aed",
    inclui: ["crm", "chatbot", "roleta", "disparos_web", "equipes", "api", "disparos_api", "cobranca", "voip", "automacao_crm", "instagram"],
    descricao: "Para operações multicanal que querem automação completa e escala.",
    recursos: ["Até 25 usuários", "3 conexões WhatsApp", "Tudo do Intermediário", "API Oficial da Meta", "Cobrança automatizada", "Ligações VoIP", "Automação de CRM", "Instagram Direct"],
    resumo: ["25 usuários e 3 conexões de WhatsApp", "Tudo do Intermediário", "API oficial da Meta, cobrança, VoIP, automação e Instagram"],
  },
];

/** Preço mensal de cada módulo vendido à parte. */
export const PRECO_MODULO: Record<string, number> = {
  crm: 197,
  chatbot: 197,
  revisional: 297,
  contratos: 69.9,
  automacao_crm: 197,
  roleta: 97,
  disparos_web: 147,
  disparos_api: 197,
  validacao: 97,
  voip: 197,
  instagram: 97,
  meta_ads: 297,
  equipes: 97,
  funil_avancado: 97,
  cobranca: 197,
  financeiro: 247,
  rh: 197,
  ponto: 97,
  api: 197,
};

export const brlWolf = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
/** "R$ 1.997" (sem centavos quando inteiro), para os cards do site. */
export const brlCurto = (v: number) => (Number.isInteger(v) ? `R$ ${v.toLocaleString("pt-BR")}` : brlWolf(v));
