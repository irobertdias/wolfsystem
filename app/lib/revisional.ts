// Cálculos do módulo Revisional (imobiliário e veículo).
// Usado no painel (prévia ao vivo) e no servidor (valor gravado na proposta).
// O servidor sempre recalcula: o cliente nunca recebe um número enviado pelo navegador.
//
// Cálculo automático: com valor financiado, prazo, parcelas pagas e a taxa do
// contrato, o sistema estima sozinho juros, amortização, saldo devedor e parcela
// (SAC ou PRICE). O que o consultor digitar do boleto/extrato tem prioridade.
// A taxa média de mercado vem do Banco Central (séries SGS, ver /api/revisional/taxa-media).

export type TipoRevisional = "imovel" | "veiculo";
export type MetodoCorrecao = "percentual" | "taxa" | "bacen";

export type DadosImovel = {
  banco: string;
  valor_financiado: number;
  prazo: number;
  pagas: number;
  atrasadas: number;
  pausa: boolean;
  modalidade: "SAC" | "PRICE";
  taxa_anual: number;          // % a.a. do contrato (opcional; habilita o cálculo automático)
  data_contrato: string;       // AAAA-MM
  saldo_devedor: number;
  parcela_atual: number;
  juros: number;
  amortizacao: number;
  tarifa_adm: number;
  seguros: number;
  percentual_correcao: number;
  taxa_media_mensal: number;   // BACEN, % a.m. (informativo)
  taxa_media_ref: string;      // ex.: "09/2026"
  estimados: string[];         // campos calculados automaticamente
};

export type DadosVeiculo = {
  banco: string;
  modelo: string;
  ano: string;
  data_contrato: string;
  valor_financiado: number;
  parcela_atual: number;
  prazo: number;
  pagas: number;
  atrasadas: number;
  metodo: MetodoCorrecao;
  percentual_correcao: number;
  taxa_corrigida: number;      // % ao mês (método "taxa")
  taxa_media_mensal: number;   // BACEN, % a.m. (método "bacen" usa esta)
  taxa_media_ref: string;
};

export type ResultadoImovel = {
  parcela_corrigida: number;
  amortizado: number;
  amortizacao_corrigida: number;
  juros_pagos: number;
  media_total: number;
  diferenca_amortizacao: number;
  tarifas_questionaveis: number;
  diferenca_total: number;
  saldo_correto: number;
  diferenca_parcela: number;
  economia_total: number;
  restantes: number;
  taxa_contratada_mensal: number | null;
  taxa_media_mensal: number | null;
  vezes_media: number | null;
};

export type ResultadoVeiculo = {
  parcela_corrigida: number;
  reducao_parcela: number;
  reducao_total: number;
  estorno: number;
  economia_total: number;
  restantes: number;
  taxa_contratada: number | null; // % ao mês, estimada pela parcela
  taxa_aplicada: number | null;
  taxa_media_mensal: number | null;
  vezes_media: number | null;
};

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  // aceita "1.234,56" e "1234.56"
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normal.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const inteiro = (v: unknown) => Math.max(0, Math.round(num(v)));
const mesValido = (v: unknown) => (/^\d{4}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");

export function parcelaPrice(valor: number, taxaMensalPct: number, prazo: number) {
  if (prazo <= 0) return 0;
  const i = taxaMensalPct / 100;
  if (i <= 0) return valor / prazo;
  return (valor * i) / (1 - Math.pow(1 + i, -prazo));
}

/** Taxa mensal (%) implícita numa parcela PRICE, por bisseção. */
export function taxaImplicita(valor: number, parcela: number, prazo: number): number | null {
  if (valor <= 0 || parcela <= 0 || prazo <= 0 || parcela * prazo <= valor) return null;
  let lo = 0, hi = 100;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (parcelaPrice(valor, mid, prazo) > parcela) hi = mid; else lo = mid;
  }
  return r4((lo + hi) / 2);
}

export const anualParaMensal = (aa: number) => (aa > 0 ? (Math.pow(1 + aa / 100, 1 / 12) - 1) * 100 : 0);
export const mensalParaAnual = (am: number) => (am > 0 ? (Math.pow(1 + am / 100, 12) - 1) * 100 : 0);

/**
 * Estimativa da próxima parcela pelo sistema de amortização, sem extrato:
 * saldo após `pagas` parcelas, juros e amortização da parcela atual.
 */
export function estimarParcelaImovel(valor: number, prazo: number, pagas: number, taxaAnual: number, modalidade: "SAC" | "PRICE") {
  const i = anualParaMensal(taxaAnual) / 100;
  const k = Math.min(pagas, prazo);
  if (valor <= 0 || prazo <= 0 || i <= 0) return null;
  if (modalidade === "SAC") {
    const amortizacao = valor / prazo;
    const saldo = Math.max(0, valor - amortizacao * k);
    return { saldo: r2(saldo), amortizacao: r2(amortizacao), juros: r2(saldo * i) };
  }
  const pmt = parcelaPrice(valor, i * 100, prazo);
  const fator = Math.pow(1 + i, k);
  const saldo = Math.max(0, valor * fator - (pmt * (fator - 1)) / i);
  const juros = saldo * i;
  return { saldo: r2(saldo), amortizacao: r2(pmt - juros), juros: r2(juros) };
}

export function normalizarImovel(d: Partial<Record<keyof DadosImovel, unknown>>): DadosImovel {
  const base = {
    banco: String(d.banco ?? "").trim().slice(0, 120),
    valor_financiado: num(d.valor_financiado),
    prazo: inteiro(d.prazo),
    pagas: inteiro(d.pagas),
    atrasadas: inteiro(d.atrasadas),
    pausa: d.pausa === true || d.pausa === "true",
    modalidade: (d.modalidade === "PRICE" ? "PRICE" : "SAC") as "SAC" | "PRICE",
    taxa_anual: Math.min(100, Math.max(0, num(d.taxa_anual))),
    data_contrato: mesValido(d.data_contrato),
    saldo_devedor: num(d.saldo_devedor),
    parcela_atual: num(d.parcela_atual),
    juros: num(d.juros),
    amortizacao: num(d.amortizacao),
    tarifa_adm: num(d.tarifa_adm),
    seguros: num(d.seguros),
    percentual_correcao: Math.min(90, Math.max(0, num(d.percentual_correcao))),
    taxa_media_mensal: Math.min(20, Math.max(0, num(d.taxa_media_mensal))),
    taxa_media_ref: String(d.taxa_media_ref ?? "").slice(0, 20),
    estimados: [] as string[],
  };
  // Preenche sozinho o que não veio do boleto/extrato.
  const est = estimarParcelaImovel(base.valor_financiado, base.prazo, base.pagas, base.taxa_anual, base.modalidade);
  if (est) {
    if (base.saldo_devedor <= 0) { base.saldo_devedor = est.saldo; base.estimados.push("saldo_devedor"); }
    if (base.juros <= 0) { base.juros = est.juros; base.estimados.push("juros"); }
    if (base.amortizacao <= 0) { base.amortizacao = est.amortizacao; base.estimados.push("amortizacao"); }
    if (base.parcela_atual <= 0) {
      base.parcela_atual = r2(base.juros + base.amortizacao + base.tarifa_adm + base.seguros);
      base.estimados.push("parcela_atual");
    }
  }
  return base;
}

export function normalizarVeiculo(d: Partial<Record<keyof DadosVeiculo, unknown>>): DadosVeiculo {
  const metodo = d.metodo === "taxa" ? "taxa" : d.metodo === "bacen" ? "bacen" : "percentual";
  return {
    banco: String(d.banco ?? "").trim().slice(0, 120),
    modelo: String(d.modelo ?? "").trim().slice(0, 120),
    ano: String(d.ano ?? "").trim().slice(0, 10),
    data_contrato: mesValido(d.data_contrato),
    valor_financiado: num(d.valor_financiado),
    parcela_atual: num(d.parcela_atual),
    prazo: inteiro(d.prazo),
    pagas: inteiro(d.pagas),
    atrasadas: inteiro(d.atrasadas),
    metodo,
    percentual_correcao: Math.min(90, Math.max(0, num(d.percentual_correcao))),
    taxa_corrigida: Math.min(20, Math.max(0, num(d.taxa_corrigida))),
    taxa_media_mensal: Math.min(20, Math.max(0, num(d.taxa_media_mensal))),
    taxa_media_ref: String(d.taxa_media_ref ?? "").slice(0, 20),
  };
}

export function calcularImovel(d: DadosImovel): ResultadoImovel {
  const pagas = Math.min(d.pagas, d.prazo || d.pagas);
  const parcela_corrigida = r2(d.parcela_atual * (1 - d.percentual_correcao / 100));
  const amortizado = r2(d.valor_financiado - d.saldo_devedor);
  const amortizacao_corrigida = r2(d.amortizacao * pagas);
  const juros_pagos = r2(d.juros * pagas);
  const media_total = r2(amortizacao_corrigida + juros_pagos);
  const diferenca_amortizacao = r2(amortizacao_corrigida - amortizado);
  const tarifas_questionaveis = r2((d.tarifa_adm + d.seguros) * pagas);
  const diferenca_total = r2(diferenca_amortizacao + tarifas_questionaveis);
  const saldo_correto = r2(d.saldo_devedor - diferenca_total);
  const diferenca_parcela = r2(d.parcela_atual - parcela_corrigida);
  const restantes = Math.max(0, d.prazo - pagas);
  const economia_total = r2(diferenca_parcela * restantes);
  const taxa_contratada_mensal = d.taxa_anual > 0 ? r4(anualParaMensal(d.taxa_anual)) : null;
  const taxa_media_mensal = d.taxa_media_mensal > 0 ? d.taxa_media_mensal : null;
  const vezes_media = taxa_contratada_mensal && taxa_media_mensal ? Math.round((taxa_contratada_mensal / taxa_media_mensal) * 100) / 100 : null;
  return {
    parcela_corrigida, amortizado, amortizacao_corrigida, juros_pagos, media_total,
    diferenca_amortizacao, tarifas_questionaveis, diferenca_total, saldo_correto,
    diferenca_parcela, economia_total, restantes,
    taxa_contratada_mensal, taxa_media_mensal, vezes_media,
  };
}

export function calcularVeiculo(d: DadosVeiculo): ResultadoVeiculo {
  const pagas = Math.min(d.pagas, d.prazo || d.pagas);
  const restantes = Math.max(0, d.prazo - pagas);
  const taxaRecalculo = d.metodo === "bacen" ? d.taxa_media_mensal : d.taxa_corrigida;
  const parcela_corrigida = r2(
    d.metodo === "percentual"
      ? d.parcela_atual * (1 - d.percentual_correcao / 100)
      : parcelaPrice(d.valor_financiado, taxaRecalculo, d.prazo)
  );
  const reducao_parcela = r2(Math.max(0, d.parcela_atual - parcela_corrigida));
  const taxa_contratada = taxaImplicita(d.valor_financiado, d.parcela_atual, d.prazo);
  const taxa_aplicada = d.metodo === "percentual"
    ? taxaImplicita(d.valor_financiado, parcela_corrigida, d.prazo)
    : taxaRecalculo;
  const taxa_media_mensal = d.taxa_media_mensal > 0 ? d.taxa_media_mensal : null;
  const vezes_media = taxa_contratada && taxa_media_mensal ? Math.round((taxa_contratada / taxa_media_mensal) * 100) / 100 : null;
  return {
    parcela_corrigida,
    reducao_parcela,
    reducao_total: r2(reducao_parcela * restantes),
    estorno: r2(reducao_parcela * pagas),
    economia_total: r2(reducao_parcela * d.prazo),
    restantes,
    taxa_contratada,
    taxa_aplicada,
    taxa_media_mensal,
    vezes_media,
  };
}

/** Problemas que impedem gerar a proposta (mensagens para o consultor). */
export function validarDados(tipo: TipoRevisional, d: DadosImovel | DadosVeiculo): string[] {
  const erros: string[] = [];
  if (!d.banco) erros.push("Informe o banco/financeira");
  if (d.valor_financiado <= 0) erros.push("Informe o valor financiado");
  if (d.prazo <= 0) erros.push("Informe o total de parcelas");
  if (d.pagas > d.prazo) erros.push("Parcelas pagas maior que o total");
  if (tipo === "imovel") {
    const i = d as DadosImovel;
    const auto = i.taxa_anual > 0;
    if (i.parcela_atual <= 0) erros.push(auto ? "Informe a parcela atual" : "Informe a parcela atual ou a taxa de juros do contrato");
    if (i.saldo_devedor <= 0 && !auto) erros.push("Informe o saldo devedor ou a taxa de juros do contrato");
    if (i.juros <= 0 && i.amortizacao <= 0 && !auto) erros.push("Informe juros e amortização ou a taxa de juros do contrato");
  } else {
    const v = d as DadosVeiculo;
    if (v.parcela_atual <= 0) erros.push("Informe o valor da parcela atual");
    if (v.metodo === "taxa" && v.taxa_corrigida <= 0) erros.push("Informe a taxa corrigida");
    if (v.metodo === "bacen" && v.taxa_media_mensal <= 0) erros.push("Aguardando a taxa média do Banco Central");
  }
  return erros;
}

export const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const pctBR = (v: number | null | undefined, casas = 2) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export function formatarDocumento(doc: string) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

/** Mascara o documento para a página pública (link pode ser repassado). */
export function mascararDocumento(doc: string) {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`;
  return d ? "***" : "";
}
