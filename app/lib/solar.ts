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
/** Kit da tabela da empresa: preço fechado por quantidade de módulos. */
export type KitSolar = { paineis: number; inversor_kw: number; preco: number; preco_de?: number };
/** Outra marca/linha de equipamento, com a própria placa, inversor e tabela de kits.
 *  A linha principal continua nos campos de cima da configuração (painel_marca, kits…). */
export type LinhaKit = {
  id: string; nome: string;
  painel_marca: string; painel_w: number; painel_area_m2: number; painel_garantia: string;
  inversor_marca: string; inversor_garantia: string;
  kits: KitSolar[];
};
/** Parcelamento no cartão: acréscimo total (%) sobre o preço à vista. */
export type OpcaoCartao = { parcelas: number; acrescimo_pct: number };

export type ConfigSolar = {
  empresa: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; cidade: string; logo: string; site: string; instagram?: string };
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
  modo_preco: "faixas" | "kits"; // R$/Wp por faixa ou tabela de kits por quantidade de módulos
  kits: KitSolar[];
  linha_nome: string;            // nome da linha principal (ex.: "NPLUS + DEYE")
  linhas: LinhaKit[];            // outras marcas/linhas (opcional, quantas quiser)
  arredondar_97: boolean;       // preço termina em 97 (ex.: 16.997)
  adicional_micro_pct: number;   // % a mais quando o sistema usa microinversor
  sobrecarga_inversor: number;   // kWp dos módulos ÷ kW do inversor aceito (1,3 = 30%)
  campanha: { nome: string; ate: string }; // oferta exibida na proposta (ate = AAAA-MM-DD)
  geracao_kwh_kwp: number;       // kWh por kWp ao mês (0 = calcular pela irradiação do estado)
  descontar_minimo: boolean;     // dimensiona descontando a taxa mínima da ligação
  estrutura_garantia: string;
  cartao_opcoes: OpcaoCartao[];
  cartao_entrada_pct: number;    // entrada (%) para parcelar o restante sem juros
  cartao_sem_juros: number;      // até N vezes sem juros após a entrada
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
  procurador: { titulo: string; nome: string; cpf: string }; // quem assina a ART e protocola na distribuidora
  distribuidora: string;         // distribuidora padrão da região (vai na procuração)
  meta_mes: number;              // meta de vendas do mês (R$)
  dono_whatsapp: string;         // avisos de aceite/visita para a empresa
  canal_id: number | null;       // canal do WhatsApp usado nos avisos
  instrucoes_ia: string;         // regras extras para a vendedora IA
};

export const CONFIG_SOLAR_PADRAO: ConfigSolar = {
  empresa: { nome: "", cnpj: "", telefone: "", email: "", endereco: "", cidade: "", logo: "", site: "", instagram: "" },
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
  modo_preco: "faixas",
  kits: [],
  linha_nome: "",
  linhas: [],
  arredondar_97: false,
  adicional_micro_pct: 20,
  sobrecarga_inversor: 1.3,
  campanha: { nome: "", ate: "" },
  geracao_kwh_kwp: 0,
  descontar_minimo: true,
  estrutura_garantia: "5 anos",
  cartao_opcoes: [],
  cartao_entrada_pct: 0,
  cartao_sem_juros: 0,
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
  procurador: { titulo: "Engenheiro eletricista", nome: "", cpf: "" },
  distribuidora: "",
  meta_mes: 0,
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
    kits: Array.isArray(s.kits) ? s.kits : [],
    linhas: Array.isArray(s.linhas) ? s.linhas.filter((l: any) => l && typeof l === "object").map((l: any) => ({ ...l, kits: Array.isArray(l.kits) ? l.kits : [] })) : [],
    cartao_opcoes: Array.isArray(s.cartao_opcoes) ? s.cartao_opcoes : [],
    campanha: { ...CONFIG_SOLAR_PADRAO.campanha, ...(s.campanha || {}) },
    procurador: { ...CONFIG_SOLAR_PADRAO.procurador, ...(s.procurador || {}) },
    prazos_financiamento: Array.isArray(s.prazos_financiamento) && s.prazos_financiamento.length ? s.prazos_financiamento : CONFIG_SOLAR_PADRAO.prazos_financiamento,
    formas_pagamento: Array.isArray(s.formas_pagamento) && s.formas_pagamento.length ? s.formas_pagamento : CONFIG_SOLAR_PADRAO.formas_pagamento,
  };
}

/** Todas as linhas de equipamento (a principal primeiro, id ""). */
export function linhasSolar(cfg: ConfigSolar): { id: string; nome: string; painel_marca: string; painel_w: number; inversor_marca: string; kits: number }[] {
  const principal = { id: "", nome: cfg.linha_nome || [cfg.painel_marca, cfg.inversor_marca].filter(Boolean).join(" + ") || "Principal", painel_marca: cfg.painel_marca, painel_w: n(cfg.painel_w), inversor_marca: cfg.inversor_marca, kits: (cfg.kits || []).length };
  return [principal, ...(cfg.linhas || []).map((l) => ({ id: l.id, nome: l.nome || [l.painel_marca, l.inversor_marca].filter(Boolean).join(" + ") || "Linha", painel_marca: l.painel_marca || cfg.painel_marca, painel_w: n(l.painel_w) || n(cfg.painel_w), inversor_marca: l.inversor_marca || cfg.inversor_marca, kits: (l.kits || []).length }))];
}

/** Configuração com a linha escolhida no lugar da principal (placa, inversor, garantias e kits).
 *  Campo vazio na linha = usa o da principal. Linha que não existe = principal. */
export function cfgDaLinha(cfg: ConfigSolar, linhaId?: string | null): ConfigSolar {
  const l = linhaId ? (cfg.linhas || []).find((x) => x.id === linhaId) : null;
  if (!l) return cfg;
  const txt = (v: any, pad: string) => (String(v ?? "").trim() ? String(v).trim() : pad);
  return {
    ...cfg,
    linha_nome: l.nome || [l.painel_marca, l.inversor_marca].filter(Boolean).join(" + "),
    painel_marca: txt(l.painel_marca, cfg.painel_marca),
    painel_w: n(l.painel_w) || cfg.painel_w,
    painel_area_m2: n(l.painel_area_m2) || cfg.painel_area_m2,
    painel_garantia: txt(l.painel_garantia, cfg.painel_garantia),
    inversor_marca: txt(l.inversor_marca, cfg.inversor_marca),
    inversor_garantia: txt(l.inversor_garantia, cfg.inversor_garantia),
    kits: (l.kits || []).length ? l.kits : cfg.kits,
  };
}

export type EntradaSolar = {
  linha?: string;            // id da linha de equipamento ("" ou ausente = principal)
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
  inversor_tipo?: "string" | "micro"; // escolha da proposta (padrão: o dos ajustes)
};

export type Parcela = { meses: number; valor: number };
export type ParcelaCartao = { meses: number; valor: number; total: number; acrescimo_pct: number };
export type AnoSolar = { ano: number; sem: number; com: number; economia: number; saldo: number };
export type ResultadoSolar = {
  uf: string; hsp: number; tarifa: number; ligacao: Ligacao;
  consumo_kwh: number; minimo_kwh: number; alvo_kwh: number;
  paineis: number; painel_w: number; kwp: number; geracao_kwh: number; cobertura_pct: number;
  inversor: string; inversor_kw: number; area_m2: number;
  preco_tabela: number; adicional: number; desconto: number; preco: number; preco_wp: number;
  conta_antes: number; conta_depois: number; economia_mes: number; economia_ano: number; economia_25: number;
  payback_anos: number; parcelas: Parcela[]; cartao: Parcela | null; entrada: number;
  itens: string[];
  // campos novos (propostas antigas podem não ter)
  inversor_tipo?: "string" | "micro";
  preco_de?: number;                 // preço "de" da campanha (riscado)
  campanha?: string;                 // nome da oferta, se ativa
  cartoes?: ParcelaCartao[];
  cartao_entrada?: { entrada: number; meses: number; valor: number } | null;
  anos?: AnoSolar[];                 // 25 anos: conta sem e com solar, economia e saldo acumulado
  conta_25_sem?: number;
  conta_25_com?: number;
  co2_ton_25?: number;               // CO₂ evitado em 25 anos
  arvores?: number;                  // árvores equivalentes
  linha?: string;                    // id da linha de equipamento usada ("" = principal)
  linha_nome?: string;
  equip?: { painel_marca: string; painel_garantia: string; inversor_marca: string; inversor_garantia: string; painel_area_m2: number };
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

const final97 = (v: number) => (v <= 0 ? 0 : Math.max(97, Math.round((v + 3) / 100) * 100 - 3));

/** Preço pela tabela de kits: exato se houver kit com essa quantidade; senão, R$/módulo interpolado entre os vizinhos. */
export function precoKit(cfg: ConfigSolar, paineis: number) {
  const kits = (cfg.kits || []).filter((k) => n(k.paineis) > 0 && n(k.preco) > 0).sort((a, b) => n(a.paineis) - n(b.paineis));
  if (!kits.length || paineis <= 0) return null;
  const exato = kits.find((k) => n(k.paineis) === paineis);
  if (exato) return { preco: n(exato.preco), preco_de: n(exato.preco_de) || 0, inversor_kw: n(exato.inversor_kw) || 0, exato: true };
  const porMod = (k: KitSolar, campo: "preco" | "preco_de") => n(k[campo]) / n(k.paineis);
  const abaixo = [...kits].reverse().find((k) => n(k.paineis) < paineis);
  const acima = kits.find((k) => n(k.paineis) > paineis);
  const interp = (campo: "preco" | "preco_de") => {
    if (abaixo && acima) {
      if (!n(abaixo[campo]) || !n(acima[campo])) return 0;
      const t = (paineis - n(abaixo.paineis)) / (n(acima.paineis) - n(abaixo.paineis));
      return paineis * (porMod(abaixo, campo) + (porMod(acima, campo) - porMod(abaixo, campo)) * t);
    }
    const k = (abaixo || acima)!;
    return n(k[campo]) ? paineis * porMod(k, campo) : 0;
  };
  return { preco: interp("preco"), preco_de: interp("preco_de"), inversor_kw: 0, exato: false };
}

/** Dimensiona o sistema e calcula preço, economia, retorno e parcelas. */
export function calcularSolar(e: EntradaSolar, cfgBase: ConfigSolar): ResultadoSolar {
  const cfg = cfgDaLinha(cfgBase, e.linha);
  const linhaOk = !!e.linha && cfg !== cfgBase;
  const uf = String(e.uf || cfg.uf_padrao || "GO").toUpperCase();
  const hsp = HSP_UF[uf] || 5;
  const tarifa = n(e.tarifa) > 0 ? n(e.tarifa) : n(cfg.tarifa_padrao) || 1;
  const ligacao: Ligacao = (["mono", "bi", "tri"].includes(String(e.ligacao)) ? e.ligacao : "bi") as Ligacao;
  const minimo = MINIMO_LIGACAO[ligacao];
  let consumo = n(e.consumo_kwh);
  if (!consumo && n(e.conta_valor) > 0) consumo = n(e.conta_valor) / tarifa;
  consumo = Math.max(0, consumo * (1 + n(e.aumento_pct) / 100));
  const alvo = Math.max(0, cfg.descontar_minimo === false ? consumo : consumo - minimo);
  const pr = n(cfg.eficiencia) > 0 && n(cfg.eficiencia) <= 1 ? n(cfg.eficiencia) : 0.8;
  // kWh gerados por kWp instalado ao mês: valor da empresa (medido nas obras) ou irradiação × desempenho.
  const kwhPorKwp = n(cfg.geracao_kwh_kwp) > 0 ? n(cfg.geracao_kwh_kwp) : hsp * 30 * pr;
  const W = n(cfg.painel_w) || 550;
  const kwpNec = alvo / kwhPorKwp;
  const paineis = Math.max(n(e.paineis) > 0 ? Math.round(n(e.paineis)) : Math.max(Math.round(n(cfg.min_paineis)) || 1, Math.ceil((kwpNec * 1000) / W - 1e-9)), 1);
  const kwp = r2((paineis * W) / 1000);
  const geracao = Math.round(kwp * kwhPorKwp);

  const tipoInv: "string" | "micro" = e.inversor_tipo === "micro" || e.inversor_tipo === "string" ? e.inversor_tipo : cfg.inversor_tipo === "micro" ? "micro" : "string";
  const usarKits = cfg.modo_preco === "kits" && (cfg.kits || []).some((k) => n(k.paineis) > 0 && n(k.preco) > 0);
  const kit = usarKits ? precoKit(cfg, paineis) : null;

  let inversor = "", inversorKw = 0;
  if (tipoInv === "micro") {
    const porMicro = Math.max(1, Math.round(n(cfg.micro_paineis)) || 4);
    const qtd = Math.ceil(paineis / porMicro);
    inversorKw = kwp; inversor = `${qtd} microinversor${qtd > 1 ? "es" : ""} ${cfg.inversor_marca}`.trim();
  } else {
    // Potência de módulos acima da do inversor (sobrecarga): 30% por padrão; a empresa pode usar mais.
    const sobre = n(cfg.sobrecarga_inversor) >= 1 ? n(cfg.sobrecarga_inversor) : 1.3;
    const minimoInv = kwp / sobre;
    const pelaRegra = INVERSORES_KW.find((k) => k >= minimoInv - 1e-9) || Math.ceil(minimoInv);
    const kitAbaixo = usarKits ? [...cfg.kits].filter((k) => n(k.paineis) > 0 && n(k.paineis) < paineis && n(k.inversor_kw) > 0).sort((a, b) => n(b.paineis) - n(a.paineis))[0] : null;
    inversorKw = kit?.inversor_kw || Math.max(pelaRegra, n(kitAbaixo?.inversor_kw));
    inversor = `Inversor ${cfg.inversor_marca} ${String(inversorKw).replace(".", ",")} kW`.replace("Inversor Inversor", "Inversor");
  }

  const wp = precoWp(cfg, kwp);
  let precoTabela = kit ? kit.preco : kwp * 1000 * wp;
  let precoDe = kit?.preco_de || 0;
  const pctMicro = tipoInv === "micro" && cfg.inversor_tipo !== "micro" ? n(cfg.adicional_micro_pct) / 100 : 0;
  precoTabela *= 1 + pctMicro;
  precoDe *= 1 + pctMicro;
  const ajustado = !kit?.exato || pctMicro > 0;
  if (cfg.arredondar_97 && ajustado) precoTabela = final97(precoTabela);
  if (cfg.arredondar_97 && precoDe && ajustado) precoDe = Math.round(precoDe / 500) * 500 - 1;
  precoTabela = r2(precoTabela);
  const adicional = r2(precoTabela * (n(cfg.adicional_telhado?.[e.telhado || ""]) / 100));
  const desconto = Math.max(0, n(e.desconto));
  const preco = n(e.preco_manual) > 0 ? r2(n(e.preco_manual)) : Math.max(0, r2(precoTabela + adicional - desconto));
  if (precoDe && precoDe <= preco) precoDe = 0;
  const campanhaAtiva = !!cfg.campanha?.nome && (!cfg.campanha.ate || new Date(`${cfg.campanha.ate}T23:59:59-03:00`).getTime() >= Date.now());

  const compensado = Math.min(geracao, alvo);
  const economiaMes = r2(compensado * tarifa * (1 - n(cfg.fio_b_pct) / 100));
  const contaAntes = r2(Math.max(consumo, minimo) * tarifa);
  const contaDepois = r2(Math.max(contaAntes - economiaMes, minimo * tarifa));
  const economiaAno = r2(economiaMes * 12);
  const reaj = n(cfg.reajuste_aa) / 100, degr = n(cfg.degradacao_aa) / 100;
  let economia25 = 0, sem25 = 0, com25 = 0, saldo = -preco;
  const anos: AnoSolar[] = [];
  for (let a = 0; a < 25; a++) {
    const fator = Math.pow(1 + reaj, a);
    const eco = economiaAno * fator * Math.pow(1 - degr, a);
    const sem = contaAntes * 12 * fator;
    economia25 += eco; sem25 += sem; com25 += sem - eco; saldo += eco;
    anos.push({ ano: a + 1, sem: Math.round(sem), com: Math.round(sem - eco), economia: Math.round(eco), saldo: Math.round(saldo) });
  }
  const payback = economiaAno > 0 ? r2(preco / economiaAno) : 0;

  const entrada = r2(preco * (n(cfg.entrada_pct) / 100));
  const financiado = preco - entrada;
  const i = n(cfg.taxa_financiamento) / 100;
  const parcelas = (cfg.prazos_financiamento || []).map((m) => ({ meses: Math.round(n(m)), valor: r2(parcelaPrice(financiado, i, Math.round(n(m)))) })).filter((p) => p.meses > 0);
  const cartoes: ParcelaCartao[] = (cfg.cartao_opcoes || [])
    .filter((o) => n(o.parcelas) > 0)
    .map((o) => { const total = r2(preco * (1 + n(o.acrescimo_pct) / 100)); return { meses: Math.round(n(o.parcelas)), total, valor: r2(total / Math.round(n(o.parcelas))), acrescimo_pct: n(o.acrescimo_pct) }; })
    .sort((a, b) => a.meses - b.meses);
  const maior = cartoes[cartoes.length - 1];
  const cartao = maior ? { meses: maior.meses, valor: maior.valor } : n(cfg.parcelas_cartao) > 1 ? { meses: Math.round(n(cfg.parcelas_cartao)), valor: r2(preco / Math.round(n(cfg.parcelas_cartao))) } : null;
  const entCartao = n(cfg.cartao_entrada_pct) > 0 && n(cfg.cartao_sem_juros) > 0
    ? { entrada: r2(preco * n(cfg.cartao_entrada_pct) / 100), meses: Math.round(n(cfg.cartao_sem_juros)), valor: r2((preco * (1 - n(cfg.cartao_entrada_pct) / 100)) / Math.round(n(cfg.cartao_sem_juros))) }
    : null;

  const itens = [
    `${paineis} × ${cfg.painel_marca || "módulo fotovoltaico"} de ${W} W (${String(kwp).replace(".", ",")} kWp)`,
    inversor,
    `Estrutura de fixação para ${telhadoLabel(e.telhado).toLowerCase()}`,
    "Cabos, conectores, string box e proteções elétricas",
    "Projeto, ART e homologação na concessionária",
    "Instalação completa e monitoramento pelo aplicativo",
  ];
  // Fator médio da rede brasileira (~0,0817 tCO₂/MWh) e ~7 árvores por tonelada.
  const co2 = r2((geracao * 12 * 25 * 0.0817) / 1000);

  return {
    uf, hsp, tarifa, ligacao, consumo_kwh: Math.round(consumo), minimo_kwh: minimo, alvo_kwh: Math.round(alvo),
    paineis, painel_w: W, kwp, geracao_kwh: geracao, cobertura_pct: alvo > 0 ? Math.round((geracao / alvo) * 100) : 0,
    inversor, inversor_kw: inversorKw, area_m2: r2(paineis * (n(cfg.painel_area_m2) || 2.6)),
    preco_tabela: precoTabela, adicional, desconto: n(e.preco_manual) > 0 ? 0 : desconto, preco, preco_wp: kwp > 0 ? r2(preco / (kwp * 1000)) : 0,
    conta_antes: contaAntes, conta_depois: contaDepois, economia_mes: economiaMes, economia_ano: economiaAno, economia_25: Math.round(economia25),
    payback_anos: payback, parcelas, cartao, entrada, itens,
    inversor_tipo: tipoInv, preco_de: precoDe ? r2(precoDe) : 0, campanha: campanhaAtiva ? cfg.campanha.nome : "",
    cartoes, cartao_entrada: entCartao, anos, conta_25_sem: Math.round(sem25), conta_25_com: Math.round(com25),
    co2_ton_25: co2, arvores: Math.round(co2 * 7),
    linha: linhaOk ? e.linha : "", linha_nome: cfg.linha_nome || "",
    equip: { painel_marca: cfg.painel_marca, painel_garantia: cfg.painel_garantia, inversor_marca: cfg.inversor_marca, inversor_garantia: cfg.inversor_garantia, painel_area_m2: n(cfg.painel_area_m2) },
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

// ─── projeto e homologação (depois do aceite) ───
export type ObraSolar = {
  checks?: Record<string, string>;  // chave do passo → data/hora em que foi marcado
  cpf_titular?: string;
  uc?: string;                      // unidade consumidora (nº da conta)
  distribuidora?: string;
  protocolo?: string;               // nº da solicitação de acesso
  instalacao_data?: string;         // AAAA-MM-DD
  equipe?: string;
  obs?: string;
};
export const PASSOS_OBRA: { grupo: string; itens: { k: string; label: string }[] }[] = [
  { grupo: "Documentos", itens: [
    { k: "doc_conta", label: "Conta de luz recente" },
    { k: "doc_identidade", label: "RG/CNH do titular" },
    { k: "doc_procuracao", label: "Procuração assinada" },
    { k: "doc_contrato", label: "Contrato assinado / pagamento" },
  ]},
  { grupo: "Projeto e distribuidora", itens: [
    { k: "visita", label: "Visita técnica feita" },
    { k: "art", label: "ART emitida" },
    { k: "projeto", label: "Projeto e diagrama unifilar" },
    { k: "protocolo", label: "Solicitação de acesso protocolada" },
    { k: "parecer", label: "Parecer de acesso aprovado" },
  ]},
  { grupo: "Instalação e ligação", itens: [
    { k: "material", label: "Material entregue no local" },
    { k: "instalado", label: "Sistema instalado" },
    { k: "vistoria", label: "Vistoria da distribuidora" },
    { k: "medidor", label: "Medidor bidirecional trocado" },
    { k: "monitoramento", label: "Monitoramento no app do cliente" },
  ]},
];
export const TOTAL_PASSOS = PASSOS_OBRA.reduce((s, g) => s + g.itens.length, 0);
export const progressoObra = (o?: ObraSolar) => Math.round((Object.keys(o?.checks || {}).filter((k) => PASSOS_OBRA.some((g) => g.itens.some((i) => i.k === k))).length / TOTAL_PASSOS) * 100);

export type HistoricoSolar ={ em: string; etapa?: string; nota: string; por?: string };
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
  obra?: ObraSolar;
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
    `🏷️ Investimento: ${r.preco_de ? `~de ${brl(r.preco_de)}~ por ` : ""}*${brl(r.preco)}* à vista · retorno em ${anosTxt(r.payback_anos)}`,
    r.cartao ? `💳 Cartão: ${r.cartao.meses}x de ${brl(r.cartao.valor)}` : "",
    r.parcelas.length ? `🏦 Financiamento (simulação): ${r.parcelas.slice(-3).map((p) => `${p.meses}x de ${brl(p.valor)}`).join(" · ")}` : "",
  ].filter(Boolean).join("\n");
}
