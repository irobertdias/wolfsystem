// Cálculos do módulo Revisional (imobiliário e veículo).
// Usado no painel (prévia ao vivo) e no servidor (valor gravado na proposta).
// O servidor sempre recalcula: o cliente nunca recebe um número enviado pelo navegador.

export type TipoRevisional = "imovel" | "veiculo";
export type MetodoCorrecao = "percentual" | "taxa";

export type DadosImovel = {
  banco: string;
  valor_financiado: number;
  prazo: number;
  pagas: number;
  atrasadas: number;
  pausa: boolean;
  modalidade: "SAC" | "PRICE";
  saldo_devedor: number;
  parcela_atual: number;
  juros: number;
  amortizacao: number;
  tarifa_adm: number;
  seguros: number;
  percentual_correcao: number;
};

export type DadosVeiculo = {
  banco: string;
  modelo: string;
  ano: string;
  valor_financiado: number;
  parcela_atual: number;
  prazo: number;
  pagas: number;
  atrasadas: number;
  metodo: MetodoCorrecao;
  percentual_correcao: number;
  taxa_corrigida: number; // % ao mês
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
};

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
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
  return Math.round(((lo + hi) / 2) * 10000) / 10000;
}

export function normalizarImovel(d: Partial<Record<keyof DadosImovel, unknown>>): DadosImovel {
  return {
    banco: String(d.banco ?? "").trim().slice(0, 120),
    valor_financiado: num(d.valor_financiado),
    prazo: inteiro(d.prazo),
    pagas: inteiro(d.pagas),
    atrasadas: inteiro(d.atrasadas),
    pausa: d.pausa === true || d.pausa === "true",
    modalidade: d.modalidade === "PRICE" ? "PRICE" : "SAC",
    saldo_devedor: num(d.saldo_devedor),
    parcela_atual: num(d.parcela_atual),
    juros: num(d.juros),
    amortizacao: num(d.amortizacao),
    tarifa_adm: num(d.tarifa_adm),
    seguros: num(d.seguros),
    percentual_correcao: Math.min(90, Math.max(0, num(d.percentual_correcao))),
  };
}

export function normalizarVeiculo(d: Partial<Record<keyof DadosVeiculo, unknown>>): DadosVeiculo {
  return {
    banco: String(d.banco ?? "").trim().slice(0, 120),
    modelo: String(d.modelo ?? "").trim().slice(0, 120),
    ano: String(d.ano ?? "").trim().slice(0, 10),
    valor_financiado: num(d.valor_financiado),
    parcela_atual: num(d.parcela_atual),
    prazo: inteiro(d.prazo),
    pagas: inteiro(d.pagas),
    atrasadas: inteiro(d.atrasadas),
    metodo: d.metodo === "taxa" ? "taxa" : "percentual",
    percentual_correcao: Math.min(90, Math.max(0, num(d.percentual_correcao))),
    taxa_corrigida: Math.min(20, Math.max(0, num(d.taxa_corrigida))),
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
  return {
    parcela_corrigida, amortizado, amortizacao_corrigida, juros_pagos, media_total,
    diferenca_amortizacao, tarifas_questionaveis, diferenca_total, saldo_correto,
    diferenca_parcela, economia_total, restantes,
  };
}

export function calcularVeiculo(d: DadosVeiculo): ResultadoVeiculo {
  const pagas = Math.min(d.pagas, d.prazo || d.pagas);
  const restantes = Math.max(0, d.prazo - pagas);
  const parcela_corrigida = r2(
    d.metodo === "taxa"
      ? parcelaPrice(d.valor_financiado, d.taxa_corrigida, d.prazo)
      : d.parcela_atual * (1 - d.percentual_correcao / 100)
  );
  const reducao_parcela = r2(Math.max(0, d.parcela_atual - parcela_corrigida));
  const taxa_contratada = taxaImplicita(d.valor_financiado, d.parcela_atual, d.prazo);
  const taxa_aplicada = d.metodo === "taxa"
    ? d.taxa_corrigida
    : taxaImplicita(d.valor_financiado, parcela_corrigida, d.prazo);
  return {
    parcela_corrigida,
    reducao_parcela,
    reducao_total: r2(reducao_parcela * restantes),
    estorno: r2(reducao_parcela * pagas),
    economia_total: r2(reducao_parcela * d.prazo),
    restantes,
    taxa_contratada,
    taxa_aplicada,
  };
}

/** Problemas que impedem gerar a proposta (mensagens para o consultor). */
export function validarDados(tipo: TipoRevisional, d: DadosImovel | DadosVeiculo): string[] {
  const erros: string[] = [];
  if (!d.banco) erros.push("Informe o banco/financeira");
  if (d.valor_financiado <= 0) erros.push("Informe o valor financiado");
  if (d.parcela_atual <= 0) erros.push("Informe o valor da parcela atual");
  if (d.prazo <= 0) erros.push("Informe o total de parcelas");
  if (d.pagas > d.prazo) erros.push("Parcelas pagas maior que o total");
  if (tipo === "imovel") {
    const i = d as DadosImovel;
    if (i.saldo_devedor <= 0) erros.push("Informe o saldo devedor");
    if (i.juros <= 0 && i.amortizacao <= 0) erros.push("Informe juros e amortização da parcela");
  } else {
    const v = d as DadosVeiculo;
    if (v.metodo === "taxa" && v.taxa_corrigida <= 0) erros.push("Informe a taxa corrigida");
  }
  return erros;
}

export const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
