// ═══════════════════════════════════════════════════════════════════════
// 📋 DEFINIÇÃO DOS CAMPOS PADRÃO (FIXOS) DA PROPOSTA
// ═══════════════════════════════════════════════════════════════════════
// Esses são os campos que sempre existem em toda proposta (colunas da
// tabela `proposta` no Supabase). NÃO podem ser removidos — só ocultados
// via config do workspace (tabela proposta_campos_padrao_config).
//
// O label, obrigatoriedade, visibilidade e ordem podem ser customizados
// por workspace pelo Editor de Vendas. Mas o TIPO é fixo (Nome sempre
// é texto, Valor sempre é número, etc) — senão quebra dashboard/funil.
//
// Usado em 3 lugares: editor-proposta, proposta (nova), vendas (modal).

import { verticalAtual, type Vertical } from "./vertical-workspace";

export type TipoCampoFixo =
  | "texto"           // input simples
  | "email"           // input type=email
  | "data"            // input type=date
  | "numero"          // input type=number step=1
  | "moeda"           // input type=number step=0.01
  | "telefone"        // input com placeholder de telefone
  | "dropdown"        // <select> com opções fixas
  | "vendedor";       // caso especial: dropdown de usuários do workspace

export type CampoFixoDef = {
  slug: string;                // nome da coluna na tabela proposta
  labelPadrao: string;         // label default (pode ser sobrescrito por workspace)
  tipo: TipoCampoFixo;
  secaoPadrao: "proposta" | "pessoais" | "endereco" | "contato" | "plano" | "agendamento";
  obrigatorioPadrao: boolean;  // alguns campos são obrigatórios por design (nome, cpf, telefone1, vendedor)
  ordemPadrao: number;
  placeholderPadrao?: string;
  opcoes?: string[];           // só pra tipo="dropdown"
  larguraTotal?: boolean;      // ocupa toda a linha do grid (3 colunas)
};

// Status disponíveis (usado tanto no editor quanto na proposta)
export const STATUS_OPCOES = ["PENDENTE", "AGUARDANDO AUDITORIA", "CANCELADA", "INSTALADA", "GERADA", "REPROVADA"];

export const CAMPOS_FIXOS: CampoFixoDef[] = [
  // 📋 Dados da Proposta
  { slug: "data_proposta",      labelPadrao: "Data da Proposta",      tipo: "data",     secaoPadrao: "proposta",     obrigatorioPadrao: false, ordemPadrao: 1 },
  { slug: "operadora",          labelPadrao: "Operadora",             tipo: "texto",    secaoPadrao: "proposta",     obrigatorioPadrao: false, ordemPadrao: 2, placeholderPadrao: "Ex: Claro, Vivo, Tim..." },
  { slug: "vendedor",           labelPadrao: "Vendedor",              tipo: "vendedor", secaoPadrao: "proposta",     obrigatorioPadrao: true,  ordemPadrao: 3 },

  // 👤 Dados Pessoais
  { slug: "nome",               labelPadrao: "Nome Completo",         tipo: "texto",    secaoPadrao: "pessoais",     obrigatorioPadrao: true,  ordemPadrao: 10, placeholderPadrao: "Nome completo do cliente" },
  { slug: "cpf",                labelPadrao: "CPF",                   tipo: "texto",    secaoPadrao: "pessoais",     obrigatorioPadrao: true,  ordemPadrao: 11, placeholderPadrao: "000.000.000-00" },
  { slug: "rg",                 labelPadrao: "RG",                    tipo: "texto",    secaoPadrao: "pessoais",     obrigatorioPadrao: false, ordemPadrao: 12, placeholderPadrao: "00.000.000-0" },
  { slug: "data_nascimento",    labelPadrao: "Data de Nascimento",    tipo: "data",     secaoPadrao: "pessoais",     obrigatorioPadrao: false, ordemPadrao: 13 },
  { slug: "nome_mae",           labelPadrao: "Nome da Mãe",           tipo: "texto",    secaoPadrao: "pessoais",     obrigatorioPadrao: false, ordemPadrao: 14, placeholderPadrao: "Nome completo da mãe" },
  { slug: "email",              labelPadrao: "E-mail",                tipo: "email",    secaoPadrao: "pessoais",     obrigatorioPadrao: false, ordemPadrao: 15, placeholderPadrao: "email@exemplo.com" },

  // 📍 Endereço
  { slug: "cep",                labelPadrao: "CEP",                   tipo: "texto",    secaoPadrao: "endereco",     obrigatorioPadrao: false, ordemPadrao: 20, placeholderPadrao: "00000-000" },
  { slug: "cidade",             labelPadrao: "Cidade",                tipo: "texto",    secaoPadrao: "endereco",     obrigatorioPadrao: false, ordemPadrao: 21, placeholderPadrao: "Cidade" },
  { slug: "estado",             labelPadrao: "Estado",                tipo: "texto",    secaoPadrao: "endereco",     obrigatorioPadrao: false, ordemPadrao: 22, placeholderPadrao: "UF" },
  { slug: "endereco",           labelPadrao: "Endereço Completo",     tipo: "texto",    secaoPadrao: "endereco",     obrigatorioPadrao: false, ordemPadrao: 23, placeholderPadrao: "Rua, número, bairro, complemento", larguraTotal: true },

  // 📱 Contato
  { slug: "telefone1",          labelPadrao: "Telefone 1",            tipo: "telefone", secaoPadrao: "contato",      obrigatorioPadrao: true,  ordemPadrao: 30, placeholderPadrao: "(62) 99999-9999" },
  { slug: "telefone2",          labelPadrao: "Telefone 2",            tipo: "telefone", secaoPadrao: "contato",      obrigatorioPadrao: false, ordemPadrao: 31, placeholderPadrao: "(62) 99999-9999" },
  { slug: "telefone3",          labelPadrao: "Telefone 3",            tipo: "telefone", secaoPadrao: "contato",      obrigatorioPadrao: false, ordemPadrao: 32, placeholderPadrao: "(62) 99999-9999" },

  // 💳 Plano e Pagamento
  { slug: "plano",              labelPadrao: "Plano Escolhido",       tipo: "texto",    secaoPadrao: "plano",        obrigatorioPadrao: false, ordemPadrao: 40, placeholderPadrao: "Ex: Plano 300MB, Plano 1GB..." },
  { slug: "valor_plano",        labelPadrao: "Valor do Plano (R$)",   tipo: "moeda",    secaoPadrao: "plano",        obrigatorioPadrao: false, ordemPadrao: 41, placeholderPadrao: "99.90" },
  { slug: "vencimento",         labelPadrao: "Vencimento da Fatura",  tipo: "dropdown", secaoPadrao: "plano",        obrigatorioPadrao: false, ordemPadrao: 42, opcoes: ["1", "5", "7", "10", "15"] },
  { slug: "forma_pagamento",    labelPadrao: "Forma de Pagamento",    tipo: "dropdown", secaoPadrao: "plano",        obrigatorioPadrao: false, ordemPadrao: 43, opcoes: ["Boleto Bancário", "PIX", "Cartão de Crédito"] },

  // 📅 Agendamento e Status
  { slug: "data_agendamento",   labelPadrao: "Data de Agendamento",   tipo: "data",     secaoPadrao: "agendamento",  obrigatorioPadrao: false, ordemPadrao: 50 },
  { slug: "periodo_instalacao", labelPadrao: "Período da Instalação", tipo: "dropdown", secaoPadrao: "agendamento",  obrigatorioPadrao: false, ordemPadrao: 51, opcoes: ["Manhã", "Tarde"] },
  { slug: "status_venda",       labelPadrao: "Status da Venda",       tipo: "dropdown", secaoPadrao: "agendamento",  obrigatorioPadrao: false, ordemPadrao: 52, opcoes: STATUS_OPCOES },
  { slug: "data_instalacao",    labelPadrao: "Data de Instalação",    tipo: "data",     secaoPadrao: "agendamento",  obrigatorioPadrao: false, ordemPadrao: 53 },
  { slug: "data_cancelamento",  labelPadrao: "Data de Cancelamento",  tipo: "data",     secaoPadrao: "agendamento",  obrigatorioPadrao: false, ordemPadrao: 54 },
];

// ═══════════════════════════════════════════════════════════════════════
// Perfil do ramo do workspace (Tipo de workspace no cadastro do cliente).
// O padrão acima é telecom. Os outros ramos trocam nomes, exemplos, opções
// e escondem o que não faz sentido. O que o workspace personalizar no
// Editor de Vendas continua valendo por cima disso.
// ═══════════════════════════════════════════════════════════════════════
type AjusteCampo = { label?: string; placeholder?: string; opcoes?: string[]; oculto?: boolean };

export const STATUS_POR_VERTICAL: Partial<Record<Vertical, string[]>> = {
  consignado: ["DIGITADA", "AGUARDANDO DOCUMENTOS", "EM ANALISE NO BANCO", "AGUARDANDO AVERBACAO", "PAGO", "REPROVADA", "CANCELADA"],
  vendas: ["PENDENTE", "EM NEGOCIACAO", "AGUARDANDO PAGAMENTO", "FECHADA", "PERDIDA", "CANCELADA"],
  roupas: ["PENDENTE", "AGUARDANDO PAGAMENTO", "EM SEPARACAO", "AGUARDANDO ENTREGA", "ENTREGUE", "CANCELADA"],
};

const AJUSTES_POR_VERTICAL: Partial<Record<Vertical, Record<string, AjusteCampo>>> = {
  consignado: {
    operadora: { label: "Banco", placeholder: "Ex: Banco do Brasil, Caixa, Pan, BMG..." },
    plano: { label: "Produto", placeholder: "Ex: Consignado INSS, Cartão benefício, Portabilidade..." },
    valor_plano: { label: "Valor Liberado (R$)", placeholder: "5000.00" },
    vencimento: { oculto: true },
    forma_pagamento: { label: "Recebimento", opcoes: ["Conta corrente", "Conta poupança", "PIX"] },
    data_agendamento: { label: "Data da Digitação" },
    periodo_instalacao: { oculto: true },
    status_venda: { label: "Status do Contrato", opcoes: STATUS_POR_VERTICAL.consignado },
    data_instalacao: { label: "Data do Pagamento" },
  },
  vendas: {
    operadora: { label: "Produto", placeholder: "Ex: nome do produto ou serviço" },
    plano: { label: "Detalhes do Pedido", placeholder: "Ex: quantidade, modelo, cor..." },
    valor_plano: { label: "Valor da Venda (R$)", placeholder: "199.90" },
    vencimento: { label: "Dia de Vencimento" },
    forma_pagamento: { opcoes: ["PIX", "Cartão de Crédito", "Cartão de Débito", "Boleto Bancário", "Dinheiro"] },
    data_agendamento: { label: "Data Prevista" },
    periodo_instalacao: { oculto: true },
    status_venda: { opcoes: STATUS_POR_VERTICAL.vendas },
    data_instalacao: { label: "Data do Fechamento" },
  },
  roupas: {
    operadora: { label: "Marca", placeholder: "Ex: marca ou coleção" },
    plano: { label: "Peças do Pedido", placeholder: "Ex: 2 camisetas M, 1 calça 40..." },
    valor_plano: { label: "Valor do Pedido (R$)", placeholder: "249.90" },
    vencimento: { oculto: true },
    forma_pagamento: { opcoes: ["PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Boleto Bancário"] },
    data_agendamento: { label: "Data da Entrega" },
    periodo_instalacao: { label: "Período da Entrega" },
    status_venda: { label: "Status do Pedido", opcoes: STATUS_POR_VERTICAL.roupas },
    data_instalacao: { label: "Entregue em" },
    endereco: { label: "Endereço de Entrega" },
  },
};

const SECOES_POR_VERTICAL: Partial<Record<Vertical, Partial<Record<string, string>>>> = {
  consignado: { plano: "💳 Produto e Valores", agendamento: "📅 Andamento e Status" },
  vendas: { plano: "💳 Produto e Pagamento", agendamento: "📅 Andamento e Status" },
  roupas: { plano: "🛍️ Pedido e Pagamento", agendamento: "🚚 Entrega e Status", endereco: "📍 Endereço de Entrega" },
};

/** Títulos das seções da proposta para o ramo (padrão: o do workspace aberto). */
export function secoesLabel(vertical: Vertical = verticalAtual()): Record<string, { titulo: string; cor: string }> {
  const ajuste = SECOES_POR_VERTICAL[vertical] || {};
  return Object.fromEntries(Object.entries(SECOES_LABEL).map(([k, v]) => [k, { ...v, titulo: ajuste[k] || v.titulo }]));
}

/** Opções de status do ramo (padrão: o do workspace aberto). */
export function statusOpcoes(vertical: Vertical = verticalAtual()): string[] {
  return STATUS_POR_VERTICAL[vertical] || STATUS_OPCOES;
}

/** Campos fixos com os nomes/opções do ramo. */
export function camposFixosDoRamo(vertical: Vertical = verticalAtual()): (CampoFixoDef & { oculto?: boolean })[] {
  const ajustes = AJUSTES_POR_VERTICAL[vertical] || {};
  return CAMPOS_FIXOS.map((f) => {
    const a = ajustes[f.slug];
    if (!a) return f;
    return { ...f, labelPadrao: a.label || f.labelPadrao, placeholderPadrao: a.placeholder ?? f.placeholderPadrao, opcoes: a.opcoes || f.opcoes, oculto: a.oculto };
  });
}

// Mapeia o slug do campo pro campo (busca rápida)
export const CAMPOS_FIXOS_MAP: Record<string, CampoFixoDef> = Object.fromEntries(
  CAMPOS_FIXOS.map(c => [c.slug, c])
);

// Labels das seções (pra agrupar visualmente no editor e na proposta)
export const SECOES_LABEL: Record<string, { titulo: string; cor: string }> = {
  proposta:    { titulo: "📋 Dados da Proposta",     cor: "#16a34a" },
  pessoais:    { titulo: "👤 Dados Pessoais",        cor: "#3b82f6" },
  endereco:    { titulo: "📍 Endereço",              cor: "#f59e0b" },
  contato:     { titulo: "📱 Contato",               cor: "#8b5cf6" },
  plano:       { titulo: "💳 Plano e Pagamento",     cor: "#16a34a" },
  agendamento: { titulo: "📅 Agendamento e Status",  cor: "#dc2626" },
};

// ═══════════════════════════════════════════════════════════════════════
// Tipo unificado — usado no Editor e nas telas dinâmicas (proposta + vendas)
// ═══════════════════════════════════════════════════════════════════════

export type ConfigCampoPadrao = {
  id?: number;            // id em proposta_campos_padrao_config (se já tem config salva)
  campo_slug: string;
  label_custom?: string | null;
  obrigatorio?: boolean | null;
  visivel: boolean;
  ordem?: number | null;
  opcoes?: string[] | null;            // 🆕 v3: customiza lista de dropdowns
  placeholder_custom?: string | null;
  secao_customizada?: string | null;  // 🆕 v3: customiza placeholder
};

export type CampoCustom = {
  id?: number;
  slug: string;
  label: string;
  tipo: "texto" | "textarea" | "numero" | "moeda" | "data" | "dropdown" | "checkbox" | "arquivo";
  obrigatorio: boolean;
  ordem: number;
  opcoes?: string[] | null;
  placeholder?: string | null;
  ativo?: boolean;
  secao_customizada?: string | null;
  secao_cor?: string | null;
};

// Estrutura unificada usada na renderização — junta fixos (resolvidos com config)
// e custom numa única lista ordenável.
export type CampoUnificado = {
  origem: "fixo" | "custom";
  slug: string;
  label: string;
  labelPadrao?: string;    // só pra fixos — pra mostrar "Original: X" no editor
  tipo: TipoCampoFixo | "textarea" | "checkbox" | "arquivo";
  obrigatorio: boolean;
  visivel: boolean;
  ordem: number;
  opcoes?: string[] | null;
  placeholder?: string | null;
  secao?: string;
  secao_customizada?: string | null;
  secao_cor?: string | null;
  larguraTotal?: boolean;
  idConfig?: number;       // id em proposta_campos_padrao_config (se fixo)
  idCustom?: number;       // id em proposta_campos_customizados (se custom)
};

// Mantem todos os campos de uma mesma secao juntos, preservando a ordem das
// secoes e a ordem interna. Tambem corrige configuracoes antigas divididas.
export function agruparCamposPorSecao(campos: CampoUnificado[]): CampoUnificado[] {
  const ordenados = [...campos].sort((a, b) => a.ordem - b.ordem);

  const chaveExplicita = (campo: CampoUnificado): string => {
    const escolhida = String(campo.secao_customizada || "").trim();
    if (escolhida.startsWith("@")) return `padrao:${escolhida.slice(1)}`;
    if (escolhida) return `custom:${escolhida.toLocaleLowerCase("pt-BR")}`;
    if (campo.origem === "fixo" && campo.secao) return `padrao:${campo.secao}`;
    return "";
  };

  const chaves = ordenados.map(chaveExplicita);
  for (let i = 0; i < chaves.length; i++) {
    if (chaves[i]) continue;
    for (let anterior = i - 1; anterior >= 0; anterior--) {
      if (chaves[anterior]) { chaves[i] = chaves[anterior]; break; }
    }
    if (chaves[i]) continue;
    for (let proximo = i + 1; proximo < chaves.length; proximo++) {
      if (chaves[proximo]) { chaves[i] = chaves[proximo]; break; }
    }
    if (!chaves[i]) chaves[i] = "personalizado";
  }

  const ordemSecoes: string[] = [];
  const grupos = new Map<string, CampoUnificado[]>();
  ordenados.forEach((campo, indice) => {
    const chave = chaves[indice];
    if (!grupos.has(chave)) {
      ordemSecoes.push(chave);
      grupos.set(chave, []);
    }
    grupos.get(chave)!.push(campo);
  });

  return ordemSecoes
    .flatMap(chave => grupos.get(chave) || [])
    .map((campo, indice) => ({ ...campo, ordem: indice + 1 }));
}

// Helper: aplica a config do workspace nos campos fixos e devolve a lista unificada
export function montarCamposUnificados(
  configsFixos: ConfigCampoPadrao[],
  customs: CampoCustom[],
  vertical: Vertical = verticalAtual()
): CampoUnificado[] {
  // 1. Indexar config por slug
  const configMap = new Map<string, ConfigCampoPadrao>(configsFixos.map(c => [c.campo_slug, c]));

  // 2. Pra cada fixo (já com os nomes do ramo), monta versão aplicada com config
  const fixos: CampoUnificado[] = camposFixosDoRamo(vertical).map(f => {
    const cfg = configMap.get(f.slug);
    // 🆕 v3: opções customizadas — se cfg.opcoes existe e tem itens, usa elas; senão padrão
    const opcoesCustom = Array.isArray(cfg?.opcoes) && cfg.opcoes.length > 0 ? cfg.opcoes : null;
    // 🆕 v3: placeholder customizado — se trim > 0, usa; senão padrão
    const placeholderCustom = (cfg?.placeholder_custom && cfg.placeholder_custom.trim()) ? cfg.placeholder_custom : null;
    return {
      origem: "fixo",
      slug: f.slug,
      label: cfg?.label_custom?.trim() || f.labelPadrao,
      labelPadrao: f.labelPadrao,
      tipo: f.tipo,
      obrigatorio: cfg?.obrigatorio !== null && cfg?.obrigatorio !== undefined ? !!cfg.obrigatorio : f.obrigatorioPadrao,
      // default: visível, menos o que o ramo esconde (ex.: período de instalação fora de telecom)
      visivel: cfg?.visivel === undefined || cfg?.visivel === null ? !f.oculto : cfg.visivel !== false,
      ordem: cfg?.ordem !== null && cfg?.ordem !== undefined ? cfg.ordem : f.ordemPadrao,
      opcoes: opcoesCustom || f.opcoes,        // 🆕 v3
      placeholder: placeholderCustom || f.placeholderPadrao,  // 🆕 v3
      secao: f.secaoPadrao,
      secao_customizada: cfg?.secao_customizada || null,
      larguraTotal: f.larguraTotal,
      idConfig: cfg?.id,
    };
  });

  // 3. Custom — mantém como está (mas marca origem)
  // 🆕 v3.1: usa ordem DIRETO do banco. Não força +100 (isso bloqueava
  // customs de serem movidos pra cima dos fixos).
  const customsUnif: CampoUnificado[] = customs
    .filter(c => c.ativo !== false)
    .map(c => ({
      origem: "custom",
      slug: c.slug,
      label: c.label,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      visivel: true,
      ordem: typeof c.ordem === "number" ? c.ordem : 999,
      opcoes: c.opcoes,
      placeholder: c.placeholder,
      secao_customizada: c.secao_customizada || null,
      secao_cor: c.secao_cor || null,
      secao: c.secao_customizada?.trim() || undefined,
      idCustom: c.id,
    }));

  // 4. Junta e ordena pela ordem
  return agruparCamposPorSecao([...fixos, ...customsUnif]);
}