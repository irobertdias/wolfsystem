// Proposta revisional aceita -> cliente no CRM financeiro e contrato pronto para assinar.
// Usado no servidor (aceite público) e na tela de Contratos (texto do contrato).

type PropostaRev = {
  id: string;
  numero: string;
  tipo: "imovel" | "veiculo" | string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_telefone?: string;
  consultor_nome?: string;
  dados?: Record<string, any>;
  resultado?: Record<string, any>;
  empresa?: { nome?: string; cnpj?: string; whatsapp?: string };
  respondida_em?: string | null;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const brl = (v: number) => n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const docFmt = (d = "") => {
  const s = d.replace(/\D/g, "");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
};

/** Benefício total estimado na proposta (diferença a recuperar + economia). */
export function beneficioDaProposta(p: PropostaRev) {
  const r = p.resultado || {};
  return p.tipo === "imovel" ? n(r.diferenca_total) || n(r.economia_total) : n(r.economia_total);
}

/** Linha da tabela `proposta` (contrato do cliente no CRM financeiro) criada no aceite. */
export function linhaCrmDaProposta(p: PropostaRev, workspaceId: string) {
  const d = p.dados || {};
  const agora = new Date().toISOString();
  return {
    workspace_id: workspaceId,
    data_proposta: agora.slice(0, 10),
    nome: p.cliente_nome,
    cpf: (p.cliente_documento || "").replace(/\D/g, "") || null,
    telefone1: (p.cliente_telefone || "").replace(/\D/g, "") || null,
    operadora: String(d.banco || "").trim() || null,
    plano: p.tipo === "imovel" ? "imobiliario" : "veiculo",
    status_venda: "DOCUMENTACAO",
    vendedor: p.consultor_nome || null,
    dados_customizados: {
      revisional: {
        data_contrato: d.data_contrato ? `${d.data_contrato}-01` : undefined,
        valor_financiado: n(d.valor_financiado) || undefined,
        prazo: n(d.prazo) || undefined,
        parcelas_pagas: n(d.pagas) || undefined,
        // Parcela e taxa ficam de fora de propósito: o benefício vem da análise da
        // proposta (abaixo) até o vendedor completar o cálculo do contrato.
        observacoes: `Criado automaticamente pelo aceite da proposta nº ${p.numero}. Parcela atual informada: R$ ${n(d.parcela_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        historico: [{ em: agora, etapa: "DOCUMENTACAO", nota: `Cliente aceitou a proposta nº ${p.numero}. Próximo passo: contrato de prestação de serviços.` }],
      },
      revisional_proposta: { id: p.id, numero: p.numero, beneficio: beneficioDaProposta(p) },
    },
  };
}

/** Texto do contrato de prestação de serviços de revisão contratual. */
export function textoContratoRevisional(p: PropostaRev, cfg: { percentual_imovel?: number; percentual_veiculo?: number; empresa_nome?: string; empresa_cnpj?: string }) {
  const d = p.dados || {};
  const empresa = p.empresa?.nome || cfg.empresa_nome || "[NOME DA EMPRESA]";
  const cnpj = p.empresa?.cnpj || cfg.empresa_cnpj || "[CNPJ]";
  const pct = p.tipo === "imovel" ? n(cfg.percentual_imovel) : n(cfg.percentual_veiculo);
  const beneficio = beneficioDaProposta(p);
  const bem = p.tipo === "imovel" ? "financiamento imobiliário" : `financiamento de veículo${d.modelo ? ` (${d.modelo}${d.ano ? `, ${d.ano}` : ""})` : ""}`;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return [
    "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE REVISÃO CONTRATUAL",
    "",
    `CONTRATADA: ${empresa}, inscrita no CNPJ sob o nº ${cnpj}.`,
    `CONTRATANTE: ${p.cliente_nome}, inscrito(a) no CPF/CNPJ sob o nº ${docFmt(p.cliente_documento) || "[CPF]"}.`,
    "",
    "CLÁUSULA 1ª — DO OBJETO",
    `A CONTRATADA prestará ao CONTRATANTE serviços de análise e revisão do contrato de ${bem} firmado com ${d.banco || "[BANCO/FINANCEIRA]"}` +
      `${n(d.valor_financiado) ? `, no valor financiado de ${brl(d.valor_financiado)}` : ""}${n(d.prazo) ? `, em ${n(d.prazo)} parcelas` : ""}` +
      `, buscando a correção de juros, tarifas e encargos cobrados acima do devido, pela via administrativa ou judicial.`,
    "",
    "CLÁUSULA 2ª — DA ANÁLISE PRÉVIA",
    `A análise prévia (proposta nº ${p.numero}) estimou ${p.tipo === "imovel" ? "diferença a recuperar" : "economia total"} de ${brl(beneficio)}` +
      `${n(p.resultado?.parcela_corrigida) ? ` e parcela corrigida de ${brl(p.resultado?.parcela_corrigida)}` : ""}. ` +
      "Os valores são estimativas e dependem da análise completa do contrato e da decisão do banco ou do juízo.",
    "",
    "CLÁUSULA 3ª — DOS HONORÁRIOS",
    `Pelos serviços, o CONTRATANTE pagará à CONTRATADA ${pct ? `${pct.toLocaleString("pt-BR")}% (por cento)` : "[__]% (por cento)"} sobre o benefício econômico efetivamente obtido ` +
      "(valores restituídos, reduzidos ou deixados de pagar), devidos à medida que o benefício for alcançado.",
    "",
    "CLÁUSULA 4ª — DAS OBRIGAÇÕES DO CONTRATANTE",
    "O CONTRATANTE fornecerá os documentos necessários (contrato, extratos, boletos e documentos pessoais) e manterá seus dados de contato atualizados.",
    "",
    "CLÁUSULA 5ª — DA VIGÊNCIA E RESCISÃO",
    "Este contrato vigora até a conclusão dos serviços. Em caso de desistência após o início dos trabalhos, serão devidos os honorários proporcionais ao benefício já obtido.",
    "",
    "CLÁUSULA 6ª — DO FORO",
    "Fica eleito o foro do domicílio do CONTRATANTE para dirimir quaisquer dúvidas deste contrato.",
    "",
    `E, por estarem de acordo, as partes assinam eletronicamente este instrumento em ${hoje}.`,
  ].join("\n");
}
