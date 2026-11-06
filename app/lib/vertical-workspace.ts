// Vocabulário do ramo de cada workspace. O padrão do sistema é venda de planos
// de internet (instalação, operadora). Workspaces de outro ramo recebem os textos
// próprios aqui, sem mudar nada para os demais.

export type Vertical = "telecom" | "consignado";

const VERTICAL_POR_WORKSPACE: Record<string, Vertical> = {
  blennerjuridico: "consignado",
};

export function verticalDoWorkspace(workspaceId?: string | number | null): Vertical {
  return VERTICAL_POR_WORKSPACE[String(workspaceId ?? "").trim().toLowerCase()] || "telecom";
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

export function vocabularioDoWorkspace(workspaceId?: string | number | null): Vocabulario {
  return verticalDoWorkspace(workspaceId) === "consignado" ? CONSIGNADO : TELECOM;
}
