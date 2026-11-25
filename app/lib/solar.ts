// ═══════════════════════════════════════════════════════════════════════
// Energia solar: dimensionamento do sistema fotovoltaico, preço, economia e
// retorno. Usado pelo CRM (/crm/solar), pela página pública da proposta
// (/solar/[token]) e pela Vendedora IA (/api/solar/agente). Nada aqui acessa
// banco: só contas, para dar o mesmo resultado em todos os lugares.
// ═══════════════════════════════════════════════════════════════════════

// Irradiação média (horas de sol pleno por dia) por estado, plano inclinado.
// Referência: médias anuais do Atlas Solarimétrico/CRESESB, arredondadas.
export const HSP_UF: Record<string, number> = {
  AC: 4.6, AL: 5.4, AP: 4.9, AM: 4.5, BA: 5.6, CE: 5.6, DF: 5.5, ES: 5.0, GO: 5.5,
  MA: 5.2, MT: 5.3, MS: 5.2, MG: 5.4, PA: 4.9, PB: 5.6, PR: 4.8, PE: 5.6, PI: 5.7,
  RJ: 5.0, RN: 5.7, RS: 4.6, RO: 4.7, RR: 5.0, SC: 4.5, SP: 4.8, SE: 5.4, TO: 5.4,
};
export const UFS = Object.keys(HSP_UF).sort();

export type Ligacao = "mono" | "bi" | "tri";
// Consumo mínimo cobrado pela concessionária (custo de disponibilidade), em kWh.
export const MINIMO_LIGACAO: Record<Ligacao, number> = { mono: 30, bi: 50, tri: 100 };
export const LIGACOES: { key: Ligacao; label: string }[] = [
  { key: "mono", label: "Monofásica" }, { key: "bi", label: "Bifásica" }, { key: "tri", label: "Trifásica" },
];

export const TELHADOS = [
  { key: "ceramico", label: "Telha cerâmica / colonial" },
  { key: "fibrocimento", label: "Fibrocimento (Eternit)" },
  { key: "metalico", label: "Telhado metálico / sanduíche" },
  { key: "laje", label: "Laje" },
  { key: "solo", label: "Solo (estrutura no chão)" },
];
export const telhadoLabel = (k?: string | null) => TELHADOS.find((t) => t.key === k)?.label || k || "—";

export const INVERSORES_KW = [2, 3, 3.6, 4, 5, 6, 7.5, 8, 10, 12, 15, 20, 25, 30, 36, 40, 50, 60, 75, 100, 125, 150];

export type FaixaPreco = { ate_kwp: number; preco_wp: number }; // R$ por Wp até essa potência

export type ConfigSolar = {
  empresa: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; cidade: string; logo: string; site: string };
  painel_marca: string;
  painel_w: number;              // potência do módulo (W)
  painel_area_m2: number;        // área de cada módulo
  painel_garantia: string;       // texto
  inversor_marca: string;
  inversor_tipo: "string" | "micro";
  micro_paineis: number;         // módulos por microinversor
  inversor_garantia: string;
  instalacao_garantia: string;
  faixas: FaixaPreco[];
  adicional_telhado: Record<string, number>; // % sobre o preço
  min_paineis: number;
  tarifa_padrao: number;         // R$/kWh com impostos
  uf_padrao: string;
  eficiencia: number;            // desempenho do sistema (PR), 0–1
  fio_b_pct: number;             // % da economia que fica com a concessionária (Lei 14.300)
  reajuste_aa: number;           // % ao ano de aumento da tarifa
  degradacao_aa: number;         // % ao ano de perda de geração
  taxa_financiamento: number;    // % a.m.
  prazos_financiamento: number[];// meses
  entrada_pct: number;           // % de entrada sugerida (0 = sem entrada)
  parcelas_cartao: number;       // até N vezes no cartão
  prazo_instalacao: string;      // texto
  validade_minutos: number;      // validade do link da proposta
  formas_pagamento: string[];
  observacoes: string;           // condições que saem na proposta
  dono_whatsapp: string;         // avisos de aceite/visita para a empresa
  canal_id: number | null;       // canal do WhatsApp usado nos avisos
  instrucoes_ia: string;         // regras extras para a vendedora IA
};

export const CONFIG_SOLAR_PADRAO: ConfigSolar = {
  empresa: { nome: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", logo: "", site: "" },
  painel_marca: "Módulo monocristalino",
  painel_w: 610,
  painel_area_m2: 2.7,
  painel_garantia: "12 anos de produto e 30 anos de desempenho",
  inversor_marca: "Inversor on-grid",
  inversor_tipo: "string",
  micro_paineis: 4,
  inversor_garantia: "10 anos",
  instalacao_garantia: "1 ano de instalação",
  faixas: [
    { ate_kwp: 4, preco_wp: 3.4 },
    { ate_kwp: 8, preco_wp: 3.0 },
    { ate_kwp: 15, preco_wp: 2.75 },
    { ate_kwp: 30, preco_wp: 2.55 },
    { ate_kwp: 75, preco_wp: 2.35 },
    { ate_kwp: 9999, preco_wp: 2.2 },
  ],
  adicional_telhado: { ceramico: 0, fibrocimento: 0, metalico: 0, laje: 5, solo: 12 },
  min_paineis: 4,
  tarifa_padrao: 1.0,
  uf_padrao: "GO",
  eficiencia: 0.8,
  fio_b_pct: 10,
  reajuste_aa: 6,
  degradacao_aa: 0.5,
  taxa_financiamento: 1.69,
  prazos_financiamento: [36, 60, 84, 120],
  entrada_pct: 0,
  parcelas_cartao: 18,
  prazo_instalacao: "até 30 dias após a aprovação do projeto na concessionária",
  validade_minutos: 10080,
  formas_pagamento: ["À vista (PIX ou transferência)", "Financiamento solar", "Cartão de crédito"],
  observacoes: "Inclui projeto, homologação na concessionária, estrutura, cabos, proteções, instalação e monitoramento pelo aplicativo. Valores sujeitos à visita técnica.",
  dono_whatsapp: "",
  canal_id: null,
  instrucoes_ia: "",
};

/** Junta a configuração salva com o padrão (campos novos ganham o valor padrão). */
export function configSolar(salvo: any): ConfigSolar {
  const s = salvo && typeof salvo === "object" ? salvo : {};
  return {
    ...CONFIG_SOLAR_PADRAO, ...s,
    empresa: { ...CONFIG_SOLAR_PADRAO.empresa, ...(s.empresa || {}) },
    adicional_telhado: { ...CONFIG_SOLAR_PADRAO.adicional_telhado, ...(s.adicional_telhado || {}) },
    faixas: Array.isArray(s.faixas) && s.faixas.length ? s.faixas : CONFIG_SOLAR_PADRAO.faixas,
    prazos_financiamento: Array.isArray(s.prazos_financiamento) && s.prazos_financiamento.length ? s.prazos_financiamento : CONFIG_SOLAR_PADRAO.prazos_financiamento,
    formas_pagamento: Array.isArray(s.formas_pagamento) && s.formas_pagamento.length ? s.formas_pagamento : CONFIG_SOLAR_PADRAO.formas_pagamento,
  };
}

export type EntradaSolar = {
  consumo_kwh?: number;      // média mensal (kWh)
  conta_valor?: number;      // valor médio da conta (R$), usado se não houver consumo
  tarifa?: number;           // R$/kWh
  uf?: string;
  cidade?: string;
  ligacao?: Ligacao;
  telhado?: string;
  paineis?: number;          // força a quantidade de módulos (ajuste manual)
  aumento_pct?: number;      // previsão de aumento de consumo (ar-condicionado, carro elétrico…)
  desconto?: number;         // R$ de desconto no preço
  preco_manual?: number;     // preço final digitado (substitui a tabela)
};

export type Parcela = { meses: number; valor: number };
export type ResultadoSolar = {
  uf: string; hsp: number; tarifa: number; ligacao: Ligacao;
  consumo_kwh: number; minimo_kwh: number; alvo_kwh: number;
  paineis: number; painel_w: number; kwp: number; geracao_kwh: number; cobertura_pct: number;
  inversor: string; inversor_kw: number; area_m2: number;
  preco_tabela: number; adicional: number; desconto: number; preco: number; preco_wp: number;
  conta_antes: number; conta_depois: number; economia_mes: number; economia_ano: number; economia_25: number;
  payback_anos: number; parcelas: Parcela[]; cartao: Parcela | null; entrada: number;
  itens: string[];
};

export const n = (v: any) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  const x = parseFloat((s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
export const parcelaPrice = (pv: number, i: number, meses: number) => (!pv || !meses ? 0 : !i ? pv / meses : (pv * i) / (1 - Math.pow(1 + i, -meses)));

/** R$/Wp da tabela para a potência do sistema. */
export function precoWp(cfg: ConfigSolar, kwp: number) {
  const faixas = [...cfg.faixas].filter((f) => n(f.preco_wp) > 0).sort((a, b) => n(a.ate_kwp) - n(b.ate_kwp));
  return n((faixas.find((f) => kwp <= n(f.ate_kwp)) || faixas[faixas.length - 1])?.preco_wp);
}

/** Dimensiona o sistema e calcula preço, economia, retorno e parcelas. */
export function calcularSolar(e: EntradaSolar, cfg: ConfigSolar): ResultadoSolar {
  const uf = String(e.uf || cfg.uf_padrao || "GO").toUpperCase();
  const hsp = HSP_UF[uf] || 5;
  const tarifa = n(e.tarifa) > 0 ? n(e.tarifa) : n(cfg.tarifa_padrao) || 1;
  const ligacao: Ligacao = (["mono", "bi", "tri"].includes(String(e.ligacao)) ? e.ligacao : "bi") as Ligacao;
  const minimo = MINIMO_LIGACAO[ligacao];
  let consumo = n(e.consumo_kwh);
  if (!consumo && n(e.conta_valor) > 0) consumo = n(e.conta_valor) / tarifa;
  consumo = Math.max(0, consumo * (1 + n(e.aumento_pct) / 100));
  const alvo = Math.max(0, consumo - minimo);
  const pr = n(cfg.eficiencia) > 0 && n(cfg.eficiencia) <= 1 ? n(cfg.eficiencia) : 0.8;
  const W = n(cfg.painel_w) || 550;
  const kwpNec = alvo / (hsp * 30 * pr);
  const paineis = Math.max(n(e.paineis) > 0 ? Math.round(n(e.paineis)) : Math.max(Math.round(n(cfg.min_paineis)) || 1, Math.ceil((kwpNec * 1000) / W)), 1);
  const kwp = r2((paineis * W) / 1000);
  const geracao = Math.round(kwp * hsp * 30 * pr);

  let inversor = "", inversorKw = 0;
  if (cfg.inversor_tipo === "micro") {
    const porMicro = Math.max(1, Math.round(n(cfg.micro_paineis)) || 4);
    const qtd = Math.ceil(paineis / porMicro);
    inversorKw = kwp; inversor = `${qtd} microinversor${qtd > 1 ? "es" : ""} ${cfg.inversor_marca}`.trim();
  } else {
    const minimoInv = kwp / 1.3; // até 30% de sobrecarga nos módulos
    inversorKw = INVERSORES_KW.find((k) => k >= minimoInv) || Math.ceil(minimoInv);
    inversor = `Inversor ${cfg.inversor_marca} ${String(inversorKw).replace(".", ",")} kW`.replace("Inversor Inversor", "Inversor");
  }

  const wp = precoWp(cfg, kwp);
  const precoTabela = r2(kwp * 1000 * wp);
  const adicional = r2(precoTabela * (n(cfg.adicional_telhado?.[e.telhado || ""]) / 100));
  const desconto = Math.max(0, n(e.desconto));
  const preco = n(e.preco_manual) > 0 ? r2(n(e.preco_manual)) : Math.max(0, r2(precoTabela + adicional - desconto));

  const compensado = Math.min(geracao, alvo);
  const economiaMes = r2(compensado * tarifa * (1 - n(cfg.fio_b_pct) / 100));
  const contaAntes = r2(Math.max(consumo, minimo) * tarifa);
  const contaDepois = r2(Math.max(contaAntes - economiaMes, minimo * tarifa));
  const economiaAno = r2(economiaMes * 12);
  let economia25 = 0;
  for (let a = 0; a < 25; a++) economia25 += economiaAno * Math.pow(1 + n(cfg.reajuste_aa) / 100, a) * Math.pow(1 - n(cfg.degradacao_aa) / 100, a);
  const payback = economiaAno > 0 ? r2(preco / economiaAno) : 0;

  const entrada = r2(preco * (n(cfg.entrada_pct) / 100));
  const financiado = preco - entrada;
  const i = n(cfg.taxa_financiamento) / 100;
  const parcelas = (cfg.prazos_financiamento || []).map((m) => ({ meses: Math.round(n(m)), valor: r2(parcelaPrice(financiado, i, Math.round(n(m)))) })).filter((p) => p.meses > 0);
  const cartao = n(cfg.parcelas_cartao) > 1 ? { meses: Math.round(n(cfg.parcelas_cartao)), valor: r2(preco / Math.round(n(cfg.parcelas_cartao))) } : null;

  const itens = [
    `${paineis} módulos ${cfg.painel_marca} de ${W} W (${String(kwp).replace(".", ",")} kWp)`,
    inversor,
    `Estrutura de fixação para ${telhadoLabel(e.telhado).toLowerCase()}`,
    "Cabos, conectores, string box e proteções elétricas",
    "Projeto, ART e homologação na concessionária",
    "Instalação completa e monitoramento pelo aplicativo",
  ];

  return {
    uf, hsp, tarifa, ligacao, consumo_kwh: Math.round(consumo), minimo_kwh: minimo, alvo_kwh: Math.round(alvo),
    paineis, painel_w: W, kwp, geracao_kwh: geracao, cobertura_pct: alvo > 0 ? Math.round((geracao / alvo) * 100) : 0,
    inversor, inversor_kw: inversorKw, area_m2: r2(paineis * (n(cfg.painel_area_m2) || 2.6)),
    preco_tabela: precoTabela, adicional, desconto: n(e.preco_manual) > 0 ? 0 : desconto, preco, preco_wp: kwp > 0 ? r2(preco / (kwp * 1000)) : 0,
    conta_antes: contaAntes, conta_depois: contaDepois, economia_mes: economiaMes, economia_ano: economiaAno, economia_25: Math.round(economia25),
    payback_anos: payback, parcelas, cartao, entrada, itens,
  };
}

// ─── etapas da proposta (status_venda da tabela proposta) ───
export type EtapaSolar = { key: string; label: string; curto: string; cor: string };
export const ETAPAS_SOLAR: EtapaSolar[] = [
  { key: "LEAD",             label: "Novo contato",            curto: "Contato",     cor: "#64748B" },
  { key: "PROPOSTA ENVIADA", label: "Proposta enviada",        curto: "Enviada",     cor: "#2563EB" },
  { key: "ACEITA",           label: "Aceita pelo cliente",     curto: "Aceita",      cor: "#0891B2" },
  { key: "VISITA TECNICA",   label: "Visita técnica",          curto: "Visita",      cor: "#7C3AED" },
  { key: "CONTRATO",         label: "Contrato fechado",        curto: "Contrato",    cor: "#D97706" },
  { key: "HOMOLOGACAO",      label: "Projeto e homologação",   curto: "Homologação", cor: "#CA8A04" },
  { key: "INSTALACAO",       label: "Instalação",              curto: "Instalação",  cor: "#EA580C" },
  { key: "CONCLUIDA",        label: "Sistema ligado",          curto: "Ligado",      cor: "#16A34A" },
  { key: "PERDIDA",          label: "Perdida",                 curto: "Perdida",     cor: "#DC2626" },
];
export const etapaSolar = (k?: string | null) => ETAPAS_SOLAR.find((e) => e.key === k) || ETAPAS_SOLAR[0];
export const ETAPAS_GANHAS = ["CONTRATO", "HOMOLOGACAO", "INSTALACAO", "CONCLUIDA"];
export const ETAPAS_ABERTAS = ["LEAD", "PROPOSTA ENVIADA"];

export type HistoricoSolar = { em: string; etapa?: string; nota: string; por?: string };
export type DadosSolar = {
  numero?: string;
  entrada?: EntradaSolar;
  resultado?: ResultadoSolar;
  token?: string;
  validade_ate?: string;       // ISO
  enviada_em?: string;
  visualizado_em?: string;
  aceite?: { em: string; pagamento?: string; prazo?: number | null; por?: string; nome?: string; cpf?: string; endereco?: string };
  recusa?: { em: string; motivo: string; por?: string };
  visita?: { pedida_em: string; data?: string; endereco?: string; obs?: string };
  distribuidora?: string;
  observacoes?: string;
  canal?: string;              // "whatsapp_ia" quando a IA criou
  historico?: HistoricoSolar[];
  dono_avisado?: Record<string, string>;
};

// ─── formatação ───
export const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brl0 = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const kwpTxt = (v: number) => `${(Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWp`;
export const anosTxt = (a: number) => {
  if (!a) return "—";
  const anos = Math.floor(a), meses = Math.round((a - anos) * 12);
  return [anos ? `${anos} ano${anos > 1 ? "s" : ""}` : "", meses ? `${meses} ${meses > 1 ? "meses" : "mês"}` : ""].filter(Boolean).join(" e ") || "menos de 1 mês";
};

/** Resumo em texto (WhatsApp) de uma simulação. */
export function resumoSolarTexto(r: ResultadoSolar) {
  return [
    `☀️ Sistema de *${kwpTxt(r.kwp)}* com *${r.paineis} painéis* de ${r.painel_w} W`,
    `⚡ Gera cerca de *${r.geracao_kwh} kWh/mês* (seu consumo: ${r.consumo_kwh} kWh)`,
    `💡 Conta de luz: de ${brl(r.conta_antes)} para cerca de ${brl(r.conta_depois)}`,
    `💰 Economia de *${brl(r.economia_mes)}/mês* (${brl0(r.economia_25)} em 25 anos)`,
    `🏷️ Investimento: *${brl(r.preco)}* · retorno em ${anosTxt(r.payback_anos)}`,
    r.parcelas.length ? `🏦 Financiado: ${r.parcelas.map((p) => `${p.meses}x de ${brl(p.valor)}`).join(" · ")}` : "",
  ].filter(Boolean).join("\n");
}
