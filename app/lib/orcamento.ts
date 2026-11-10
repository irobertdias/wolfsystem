// Orçamento comercial do Wolf System: tabela de preços, planos, cálculo com
// desconto por linha, dados de pagamento e dados de implantação.
// Os preços de planos, usuário extra, canal extra e alguns módulos seguem a
// tabela pública do site (SimuladorOrcamento); os demais módulos foram
// precificados na mesma faixa.

export type TipoLinha = "plano" | "usuarios" | "whatsapp" | "modulo" | "personalizado" | "configuracao";
export type Cobranca = "mensal" | "unico";

export type ItemOrcamento = {
  id?: string;
  tipo?: TipoLinha;           // ausente = orçamento antigo (sem preço por item)
  nome: string;
  sub: string;
  cor: string;
  linhas: string[];
  preco?: number;             // preço de tabela por unidade
  qtd?: number;
  desconto?: number;          // % de desconto da linha (0 a 100)
  cobranca?: Cobranca;
  incluso?: boolean;          // módulo que já vem no plano (não cobra)
  usuarios?: number;          // só no plano
  whatsapps?: number;         // só no plano
};

import { CONFIGURACAO_PADRAO as CONFIG_TABELA, PLANOS_WOLF, PRECO_MODULO, PRECO_USUARIO_EXTRA, PRECO_WHATSAPP_EXTRA } from "./precos-wolf";

export const PRECO_USUARIO = PRECO_USUARIO_EXTRA;
export const PRECO_WHATSAPP = PRECO_WHATSAPP_EXTRA;
export const CONFIGURACAO_PADRAO = CONFIG_TABELA;

type Modulo = { id: string; nome: string; sub: string; cor: string; preco: number; linhas: string[] };

/** Módulos vendidos à parte (preço mensal de tabela). */
const MODULOS_BASE: Modulo[] = [
  { id: "crm", nome: "Módulo CRM", sub: "Gestão comercial", cor: "#047857", preco: 197, linhas: [
    "Funil de vendas, contatos e histórico do cliente", "Vendas por consultor e por equipe", "Dashboard com os números da operação",
  ] },
  { id: "chatbot", nome: "Módulo Chatbot", sub: "Atendimento no WhatsApp", cor: "#059669", preco: 197, linhas: [
    "Vários atendentes no mesmo número de WhatsApp", "Fluxos automáticos e respostas rápidas", "Transferência de conversas e histórico completo",
  ] },
  { id: "revisional", nome: "Módulo Revisional", sub: "Análise contratual", cor: "#059669", preco: 297, linhas: [
    "Simulação de financiamento imobiliário e de veículo", "Comparação automática com a taxa média do Banco Central", "Proposta por link com validade, aceite online e PDF",
  ] },
  { id: "contratos", nome: "Contratos e Assinaturas", sub: "Assinatura eletrônica (até 100/mês)", cor: "#047857", preco: 69.9, linhas: [
    "Envio de contratos para assinatura por link", "Assinatura com validação do signatário", "Contratos assinados guardados e para baixar",
  ] },
  { id: "automacao_crm", nome: "Automação de CRM", sub: "Ações automáticas", cor: "#065F46", preco: 197, linhas: [
    "Ações automáticas quando o status de uma venda muda",
  ] },
  { id: "roleta", nome: "Roleta de Distribuição", sub: "Distribuição de leads", cor: "#059669", preco: 97, linhas: [
    "Distribui os novos contatos entre os atendentes", "Divisão equilibrada da fila de atendimento",
  ] },
  { id: "disparos_web", nome: "Disparos Web", sub: "Envio em massa", cor: "#059669", preco: 147, linhas: [
    "Envio de mensagens em massa pelo WhatsApp", "Listas de contatos e acompanhamento dos envios",
  ] },
  { id: "disparos_api", nome: "Disparos API", sub: "API oficial do WhatsApp", cor: "#059669", preco: 197, linhas: [
    "Campanhas pela API oficial do WhatsApp (Meta)", "Modelos de mensagem aprovados",
  ] },
  { id: "validacao", nome: "Validação de Números", sub: "Higienização de listas", cor: "#059669", preco: 97, linhas: [
    "Confere quais números têm WhatsApp", "Limpa listas antes das campanhas",
  ] },
  { id: "voip", nome: "Telefonia VoIP", sub: "Ligações pelo sistema", cor: "#047857", preco: 197, linhas: [
    "Ligações direto do navegador", "Chamadas e histórico integrados ao cliente",
  ] },
  { id: "instagram", nome: "Instagram Direct", sub: "Atendimento no Instagram", cor: "#059669", preco: 97, linhas: [
    "Mensagens do Instagram na mesma tela do WhatsApp",
  ] },
  { id: "meta_ads", nome: "Central Ads", sub: "Mídia paga", cor: "#047857", preco: 297, linhas: [
    "Indicadores e relatórios das campanhas em um só lugar",
  ] },
  { id: "equipes", nome: "Equipes Multi-time", sub: "Gestão de equipes", cor: "#047857", preco: 97, linhas: [
    "Separação de atendentes e vendas por equipe", "Supervisores com visão da própria equipe",
  ] },
  { id: "funil_avancado", nome: "Funil Avançado", sub: "Etapas personalizadas", cor: "#065F46", preco: 97, linhas: [
    "Etapas do funil sob medida para a operação",
  ] },
  { id: "cobranca", nome: "Cobrança Automatizada", sub: "Lembretes de pagamento", cor: "#059669", preco: 197, linhas: [
    "Lembretes automáticos de vencimento", "Acompanhamento de quem pagou e de quem está em atraso",
  ] },
  { id: "financeiro", nome: "Financeiro", sub: "Gestão financeira", cor: "#d97706", preco: 197, linhas: [
    "Contas a pagar e a receber, caixa e conciliação", "DRE e relatórios financeiros",
  ] },
  { id: "rh", nome: "RH", sub: "Gestão de pessoas", cor: "#ea580c", preco: 147, linhas: [
    "Cadastro de colaboradores, folha e férias",
  ] },
  { id: "ponto", nome: "Bater Ponto", sub: "Controle de jornada", cor: "#f59e0b", preco: 97, linhas: [
    "Registro de ponto com selfie e GPS",
  ] },
  { id: "api", nome: "API de Integração", sub: "Integração com outros sistemas", cor: "#475569", preco: 197, linhas: [
    "Conecta o Wolf System a outros sistemas da empresa",
  ] },
];

/** Módulos com o preço da tabela única (precos-wolf.ts). */
export const MODULOS: Modulo[] = MODULOS_BASE.map((m) => ({ ...m, preco: PRECO_MODULO[m.id] ?? m.preco }));

export type Plano = { id: string; nome: string; preco: number; usuarios: number; whatsapps: number; inclui: string[]; linhas: string[]; cor: string };

/** Planos do site: já trazem usuários, conexões de WhatsApp e módulos. */
/** Planos do site (fonte: precos-wolf.ts). */
export const PLANOS: Plano[] = PLANOS_WOLF.map((p) => ({
  id: p.id, nome: `Plano ${p.nome}`, preco: p.preco, usuarios: p.usuarios, whatsapps: p.whatsapps, inclui: p.inclui, linhas: p.resumo,
  cor: p.id === "basico" ? "#059669" : p.id === "intermediario" ? "#047857" : "#065f46",
}));

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const limitar = (v: unknown, min: number, max: number, padrao = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

export type LinhaCalculada = ItemOrcamento & { bruto: number; liquido: number };
export type Totais = {
  linhas: LinhaCalculada[];
  mensalTabela: number; mensal: number; mensalDesconto: number;
  unicoTabela: number; unico: number; unicoDesconto: number;
  usuarios: number; whatsapps: number;
};

/** Soma o orçamento linha a linha (preço × quantidade − desconto %). */
export function calcularOrcamento(itens: ItemOrcamento[]): Totais {
  let mensalTabela = 0, mensal = 0, unicoTabela = 0, unico = 0, usuarios = 0, whatsapps = 0;
  const linhas = itens.map((it) => {
    const qtd = it.tipo ? limitar(it.qtd ?? 1, 0, 100000, 1) : 0;
    const bruto = it.tipo && !it.incluso ? r2(limitar(it.preco, 0, 1e7) * qtd) : 0;
    const liquido = r2(bruto * (1 - limitar(it.desconto, 0, 100) / 100));
    if (it.cobranca === "unico") { unicoTabela += bruto; unico += liquido; } else { mensalTabela += bruto; mensal += liquido; }
    if (it.tipo === "plano") { usuarios += limitar(it.usuarios, 0, 100000); whatsapps += limitar(it.whatsapps, 0, 1000); }
    if (it.tipo === "usuarios") usuarios += qtd;
    if (it.tipo === "whatsapp") whatsapps += qtd;
    return { ...it, bruto, liquido };
  });
  return {
    linhas,
    mensalTabela: r2(mensalTabela), mensal: r2(mensal), mensalDesconto: r2(mensalTabela - mensal),
    unicoTabela: r2(unicoTabela), unico: r2(unico), unicoDesconto: r2(unicoTabela - unico),
    usuarios, whatsapps,
  };
}

const COR_VALIDA = /^#[0-9a-f]{6}$/i;
const TIPOS: TipoLinha[] = ["plano", "usuarios", "whatsapp", "modulo", "personalizado", "configuracao"];

/** Limpa a lista de itens vinda do painel. Preços de plano e módulo vêm sempre da tabela. */
export function sanitizarItens(v: unknown): ItemOrcamento[] {
  const lista = Array.isArray(v) ? v : [];
  return lista.slice(0, 40).map((x: Record<string, unknown>) => {
    const tipo = TIPOS.includes(x?.tipo as TipoLinha) ? (x.tipo as TipoLinha) : undefined;
    const base: ItemOrcamento = {
      id: String(x?.id ?? "").slice(0, 40) || undefined,
      tipo,
      nome: String(x?.nome ?? "").trim().slice(0, 80),
      sub: String(x?.sub ?? "").trim().slice(0, 80),
      cor: COR_VALIDA.test(String(x?.cor)) ? String(x?.cor) : "#475569",
      linhas: (Array.isArray(x?.linhas) ? x.linhas : []).map((l: unknown) => String(l ?? "").trim().slice(0, 140)).filter(Boolean).slice(0, 6),
      preco: r2(limitar(x?.preco, 0, 1e7)),
      qtd: Math.round(limitar(x?.qtd ?? 1, 0, 100000, 1)),
      desconto: r2(limitar(x?.desconto, 0, 100)),
      cobranca: x?.cobranca === "unico" ? "unico" : "mensal",
      incluso: x?.incluso === true,
    };
    if (tipo === "plano") {
      const p = PLANOS.find((pl) => pl.id === base.id);
      if (p) Object.assign(base, { nome: p.nome, preco: p.preco, qtd: 1, usuarios: p.usuarios, whatsapps: p.whatsapps, linhas: p.linhas, cor: p.cor });
    }
    if (tipo === "modulo") {
      const m = MODULOS.find((mo) => mo.id === base.id);
      if (m) Object.assign(base, { nome: m.nome, sub: m.sub, cor: m.cor, linhas: m.linhas, preco: m.preco, qtd: 1 });
    }
    if (tipo === "usuarios") Object.assign(base, { preco: PRECO_USUARIO, cobranca: "mensal" });
    if (tipo === "whatsapp") Object.assign(base, { preco: PRECO_WHATSAPP, cobranca: "mensal" });
    if (tipo === "configuracao") Object.assign(base, { cobranca: "unico", qtd: 1 });
    return base;
  }).filter((i) => i.nome);
}

/* ---------- orçamento montado pelo próprio cliente no site ---------- */
/** Faixas do Wolf Contratos vendidas no site (preço especial para quem tem CRM). */
export const CONTRATOS_SITE: Record<string, { nome: string; sub: string; preco: number }> = {
  "contratos-essencial": { nome: "Wolf Contratos Essencial", sub: "Até 20 contratos por mês", preco: 49.9 },
  "contratos-profissional": { nome: "Wolf Contratos Profissional", sub: "Até 100 contratos por mês", preco: 69.9 },
  "contratos-empresarial": { nome: "Wolf Contratos Empresarial", sub: "Contratos ilimitados", preco: 99.9 },
};

/**
 * Monta as linhas do orçamento a partir das escolhas do site, sempre com preço de tabela
 * (o visitante só escolhe plano, quantidades e módulos; nunca o preço).
 */
export function itensDoSite(e: { plano: string; usuarios: number; whatsapps: number; modulos: string[] }): ItemOrcamento[] {
  const plano = PLANOS.find((p) => p.id === e.plano) || PLANOS[1];
  const usuarios = Math.max(1, Math.min(500, Math.round(Number(e.usuarios) || plano.usuarios)));
  const whatsapps = Math.max(1, Math.min(50, Math.round(Number(e.whatsapps) || plano.whatsapps)));
  const escolhidos = new Set((Array.isArray(e.modulos) ? e.modulos : []).map(String));
  const itens: ItemOrcamento[] = [{ tipo: "plano", id: plano.id, nome: plano.nome, sub: "", cor: plano.cor, linhas: plano.linhas, preco: plano.preco, qtd: 1, usuarios: plano.usuarios, whatsapps: plano.whatsapps }];
  if (usuarios > plano.usuarios) itens.push({ tipo: "usuarios", id: "usuarios", nome: "Usuários adicionais", sub: "Acesso individual ao sistema", cor: "#059669", linhas: [], preco: PRECO_USUARIO, qtd: usuarios - plano.usuarios });
  if (whatsapps > plano.whatsapps) itens.push({ tipo: "whatsapp", id: "whatsapp", nome: "Conexões de WhatsApp adicionais", sub: "Números conectados ao atendimento", cor: "#059669", linhas: [], preco: PRECO_WHATSAPP, qtd: whatsapps - plano.whatsapps });
  MODULOS.forEach((m) => {
    const noPlano = plano.inclui.includes(m.id);
    if (noPlano || escolhidos.has(m.id)) itens.push({ tipo: "modulo", id: m.id, nome: m.nome, sub: m.sub, cor: m.cor, linhas: m.linhas, preco: m.preco, qtd: 1, incluso: noPlano });
  });
  const contrato = Object.keys(CONTRATOS_SITE).find((k) => escolhidos.has(k));
  if (contrato) {
    const c = CONTRATOS_SITE[contrato];
    itens.push({ tipo: "personalizado", id: contrato, nome: c.nome, sub: c.sub, cor: "#047857", linhas: ["Envio de contratos para assinatura por link", "Contratos assinados guardados e para baixar"], preco: c.preco, qtd: 1, cobranca: "mensal" });
  }
  itens.push({ tipo: "configuracao", id: "configuracao", nome: "Configuração inicial", sub: "Implantação e configuração do ambiente", cor: "#047857", linhas: [], preco: CONFIGURACAO_PADRAO, qtd: 1, cobranca: "unico" });
  return itens;
}

/* ---------- compatibilidade: orçamentos antigos (sem preço por item) ---------- */
export const ITENS_PADRAO: ItemOrcamento[] = [
  { nome: "Plataforma Wolf System", sub: "usuários", cor: "#059669", linhas: ["Acesso individual com login e senha para cada usuário", "Perfis e grupos de permissão por função", "Acesso pelo navegador, no computador e no celular"] },
  ...MODULOS.filter((m) => ["crm", "chatbot", "revisional"].includes(m.id)).map(({ id, nome, sub, cor, linhas }) => ({ id, nome, sub, cor, linhas })),
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
  whatsapps?: string[];
  usuarios: UsuarioImplantacao[];
  pagamento_realizado: boolean;
  observacoes: string;
};

export const PERFIS = ["Administrador", "Supervisor", "Atendente"] as const;

const limpar = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);

export function normalizarImplantacao(b: Record<string, any>, maxUsuarios: number, maxWhatsapps = 1): Implantacao {
  const usuarios = (Array.isArray(b.usuarios) ? b.usuarios : [])
    .map((u: Record<string, unknown>) => ({
      nome: limpar(u?.nome, 120),
      email: limpar(u?.email, 160).toLowerCase(),
      telefone: limpar(u?.telefone, 20).replace(/[^\d+]/g, ""),
      perfil: (PERFIS as readonly string[]).includes(String(u?.perfil)) ? String(u?.perfil) : "Atendente",
    }))
    .filter((u: UsuarioImplantacao) => u.nome || u.email)
    .slice(0, Math.max(1, maxUsuarios));
  const whatsapps = (Array.isArray(b.whatsapps) ? b.whatsapps : [b.whatsapp_atendimento])
    .map((w: unknown) => limpar(w, 20).replace(/\D/g, ""))
    .filter(Boolean)
    .slice(0, Math.max(1, maxWhatsapps));
  return {
    razao_social: limpar(b.razao_social),
    cnpj: limpar(b.cnpj, 20).replace(/\D/g, ""),
    responsavel: limpar(b.responsavel, 120),
    email: limpar(b.email, 160).toLowerCase(),
    telefone: limpar(b.telefone, 20).replace(/\D/g, ""),
    whatsapp_atendimento: whatsapps[0] || "",
    whatsapps,
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
export const pctOrc = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString("pt-BR")}%`;
