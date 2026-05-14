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
  placeholder_custom?: string | null;  // 🆕 v3: customiza placeholder
};

export type CampoCustom = {
  id?: number;
  slug: string;
  label: string;
  tipo: "texto" | "textarea" | "numero" | "moeda" | "data" | "dropdown" | "checkbox";
  obrigatorio: boolean;
  ordem: number;
  opcoes?: string[] | null;
  placeholder?: string | null;
  ativo?: boolean;
};

// Estrutura unificada usada na renderização — junta fixos (resolvidos com config)
// e custom numa única lista ordenável.
export type CampoUnificado = {
  origem: "fixo" | "custom";
  slug: string;
  label: string;
  labelPadrao?: string;    // só pra fixos — pra mostrar "Original: X" no editor
  tipo: TipoCampoFixo | "textarea" | "checkbox";
  obrigatorio: boolean;
  visivel: boolean;
  ordem: number;
  opcoes?: string[] | null;
  placeholder?: string | null;
  secao?: string;
  larguraTotal?: boolean;
  idConfig?: number;       // id em proposta_campos_padrao_config (se fixo)
  idCustom?: number;       // id em proposta_campos_customizados (se custom)
};

// Helper: aplica a config do workspace nos campos fixos e devolve a lista unificada
export function montarCamposUnificados(
  configsFixos: ConfigCampoPadrao[],
  customs: CampoCustom[]
): CampoUnificado[] {
  // 1. Indexar config por slug
  const configMap = new Map<string, ConfigCampoPadrao>(configsFixos.map(c => [c.campo_slug, c]));

  // 2. Pra cada fixo, monta versão aplicada com config
  const fixos: CampoUnificado[] = CAMPOS_FIXOS.map(f => {
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
      visivel: cfg?.visivel !== false, // default true
      ordem: cfg?.ordem !== null && cfg?.ordem !== undefined ? cfg.ordem : f.ordemPadrao,
      opcoes: opcoesCustom || f.opcoes,        // 🆕 v3
      placeholder: placeholderCustom || f.placeholderPadrao,  // 🆕 v3
      secao: f.secaoPadrao,
      larguraTotal: f.larguraTotal,
      idConfig: cfg?.id,
    };
  });

  // 3. Custom — mantém como está (mas marca origem)
  const customsUnif: CampoUnificado[] = customs
    .filter(c => c.ativo !== false)
    .map(c => ({
      origem: "custom",
      slug: c.slug,
      label: c.label,
      tipo: c.tipo,
      obrigatorio: c.obrigatorio,
      visivel: true,
      // Custom usa ordem >= 100 por padrão pra ficar após fixos por default
      ordem: c.ordem >= 100 ? c.ordem : 100 + c.ordem,
      opcoes: c.opcoes,
      placeholder: c.placeholder,
      idCustom: c.id,
    }));

  // 4. Junta e ordena pela ordem
  return [...fixos, ...customsUnif].sort((a, b) => a.ordem - b.ordem);
}