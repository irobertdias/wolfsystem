// Vocabulário do ramo de cada workspace. O padrão do sistema é venda de planos
// de internet (instalação, operadora). Workspaces de outro ramo recebem os textos
// próprios aqui, sem mudar nada para os demais.

export type Vertical = "telecom" | "consignado" | "revisional" | "vendas" | "roupas";

// Tipos oferecidos no cadastro do cliente (o "revisional" aparece como Financeiro).
export const VERTICAIS: { id: Vertical; nome: string; desc: string; icone: string }[] = [
  { id: "telecom", nome: "Telecom", desc: "Venda de planos de internet e telefonia", icone: "telefone" },
  { id: "revisional", nome: "Financeiro", desc: "Revisão de contratos e financiamentos", icone: "balanca" },
  { id: "consignado", nome: "Consignado", desc: "Crédito consignado e averbação", icone: "predio" },
  { id: "vendas", nome: "Vendas", desc: "Vendas em geral, produtos e serviços", icone: "dinheiro" },
  { id: "roupas", nome: "Roupas", desc: "Loja de roupas e moda", icone: "tag" },
];

export function normalizarVertical(v: unknown): Vertical | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "financeiro") return "revisional";
  return (VERTICAIS.some((x) => x.id === s) ? s : null) as Vertical | null;
}

// Usado só enquanto a coluna workspaces.vertical não existir no banco.
const VERTICAL_POR_WORKSPACE: Record<string, Vertical> = {
  blennerjuridico: "consignado",
  teste1: "revisional",
  aproveconsultoria: "revisional", // Aprove Consultoria: escritório de revisão de contratos financeiros
};

// Tipo lido do banco (workspaces.vertical), preenchido pelo useWorkspace.
const REGISTRO: Record<string, Vertical> = {};
export function registrarVertical(workspaceId: string | null | undefined, v: unknown) {
  const ws = String(workspaceId ?? "").trim().toLowerCase();
  const n = normalizarVertical(v);
  if (ws && n) REGISTRO[ws] = n;
}

export function verticalDoWorkspace(workspaceId?: string | number | null): Vertical {
  const ws = String(workspaceId ?? "").trim().toLowerCase();
  return REGISTRO[ws] || VERTICAL_POR_WORKSPACE[ws] || "telecom";
}

// Workspaces de revisão de contratos financeiros: sem telas de vendas, com o
// módulo Revisional (/crm/revisional) no lugar do CRM comercial.
export function ehRevisional(workspaceId?: string | number | null): boolean {
  return verticalDoWorkspace(workspaceId) === "revisional";
}

export type Vocabulario = {
  concluidas: string;          // "Instaladas"
  concluidasMin: string;       // "instaladas"
  concluidaSing: string;       // "instalada"
  abrev: string;               // "inst."
  aguardando: string;          // "Aguardando instalação"
  aguardandoCurto: string;     // "aguardando instalar"
  aguardandoParaConcluida: string; // "Aguardando → instalada"
  taxa: string;                // "taxa de instalação"
  taxaTitulo: string;          // "Taxa de instalação"
  fornecedores: string;        // "Operadoras"
  fornecedorSing: string;      // "operadora"
  iconeFornecedor: string;
  semFornecedor: string;       // "sem operadora"
  receitaConcluida: string;    // "Receita instalada"
  ticketDetalhe: string;       // "media instalada"
  porDia: string;              // "Instaladas e aguardando instalação por dia"
  somenteConcluidas: string;   // "Somente vendas instaladas"
  secaoEndereco: string;       // "Onde será a instalação"
  secaoAgendamento: string;    // "Quando instalar"
  secaoPlano: string;          // descrição da seção de plano/pagamento
};

const TELECOM: Vocabulario = {
  concluidas: "Instaladas",
  concluidasMin: "instaladas",
  concluidaSing: "instalada",
  abrev: "inst.",
  aguardando: "Aguardando instalação",
  aguardandoCurto: "aguardando instalar",
  aguardandoParaConcluida: "Aguardando → instalada",
  taxa: "taxa de instalação",
  taxaTitulo: "Taxa de instalação",
  fornecedores: "Operadoras",
  fornecedorSing: "operadora",
  iconeFornecedor: "📡",
  semFornecedor: "sem operadora",
  receitaConcluida: "Receita instalada",
  ticketDetalhe: "media instalada",
  porDia: "Instaladas e aguardando instalação por dia",
  somenteConcluidas: "Somente vendas instaladas",
  secaoEndereco: "Onde será a instalação",
  secaoAgendamento: "Quando instalar",
  secaoPlano: "",
};

const CONSIGNADO: Vocabulario = {
  concluidas: "Contratos pagos",
  concluidasMin: "pagos",
  concluidaSing: "paga",
  abrev: "pagos",
  aguardando: "Aguardando averbação",
  aguardandoCurto: "aguardando averbação",
  aguardandoParaConcluida: "Averbação → pago",
  taxa: "taxa de contratos pagos",
  taxaTitulo: "Taxa de contratos pagos",
  fornecedores: "Bancos",
  fornecedorSing: "banco",
  iconeFornecedor: "🏦",
  semFornecedor: "sem banco",
  receitaConcluida: "Valor liberado",
  ticketDetalhe: "media por contrato pago",
  porDia: "Contratos pagos e aguardando averbação por dia",
  somenteConcluidas: "Somente contratos pagos",
  secaoEndereco: "Endereço residencial do cliente",
  secaoAgendamento: "Andamento do contrato",
  secaoPlano: "Produto, banco e valores da operação",
};

const VENDAS: Vocabulario = {
  concluidas: "Vendas fechadas",
  concluidasMin: "fechadas",
  concluidaSing: "fechada",
  abrev: "fech.",
  aguardando: "Aguardando pagamento",
  aguardandoCurto: "aguardando pagamento",
  aguardandoParaConcluida: "Aguardando → fechada",
  taxa: "taxa de fechamento",
  taxaTitulo: "Taxa de fechamento",
  fornecedores: "Produtos",
  fornecedorSing: "produto",
  iconeFornecedor: "🏷️",
  semFornecedor: "sem produto",
  receitaConcluida: "Receita fechada",
  ticketDetalhe: "média por venda fechada",
  porDia: "Vendas fechadas e aguardando pagamento por dia",
  somenteConcluidas: "Somente vendas fechadas",
  secaoEndereco: "Endereço do cliente",
  secaoAgendamento: "Andamento da venda",
  secaoPlano: "Produto, condições e valores",
};

const ROUPAS: Vocabulario = {
  concluidas: "Pedidos entregues",
  concluidasMin: "entregues",
  concluidaSing: "entregue",
  abrev: "entr.",
  aguardando: "Aguardando entrega",
  aguardandoCurto: "aguardando entrega",
  aguardandoParaConcluida: "Aguardando → entregue",
  taxa: "taxa de entrega",
  taxaTitulo: "Taxa de entrega",
  fornecedores: "Marcas",
  fornecedorSing: "marca",
  iconeFornecedor: "🏷️",
  semFornecedor: "sem marca",
  receitaConcluida: "Faturamento entregue",
  ticketDetalhe: "média por pedido entregue",
  porDia: "Pedidos entregues e aguardando entrega por dia",
  somenteConcluidas: "Somente pedidos entregues",
  secaoEndereco: "Endereço de entrega",
  secaoAgendamento: "Entrega do pedido",
  secaoPlano: "Peças, tamanhos e valores",
};

export function vocabularioDoWorkspace(workspaceId?: string | number | null): Vocabulario {
  const v = verticalDoWorkspace(workspaceId);
  if (v === "consignado") return CONSIGNADO;
  if (v === "vendas") return VENDAS;
  if (v === "roupas") return ROUPAS;
  return TELECOM;
}
