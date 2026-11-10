// Proposta revisional aceita -> cliente no CRM financeiro e contrato pronto para assinar.
// O texto do contrato vem do modelo do workspace (Configurações do CRM financeiro)
// ou do MODELO_PADRAO abaixo; os marcadores {assim} são trocados pelos dados.

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
export const docFmt = (d = "") => {
  const s = d.replace(/\D/g, "");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
};
const telFmt = (t = "") => {
  const s = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return s.length === 11 ? s.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : s.length === 10 ? s.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3") : t;
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

// ─── Modelo do contrato ───────────────────────────────────────────────

export const CAMPOS_MODELO: { chave: string; desc: string; grupo: "Empresa" | "Cliente" | "Contrato" | "Honorários" | "Outros" }[] = [
  { chave: "empresa_nome", desc: "Razão social da empresa", grupo: "Empresa" },
  { chave: "empresa_cnpj", desc: "CNPJ da empresa", grupo: "Empresa" },
  { chave: "empresa_endereco", desc: "Endereço da empresa", grupo: "Empresa" },
  { chave: "cliente_nome", desc: "Nome do cliente", grupo: "Cliente" },
  { chave: "cliente_cpf", desc: "CPF/CNPJ do cliente", grupo: "Cliente" },
  { chave: "cliente_telefone", desc: "Telefone do cliente", grupo: "Cliente" },
  { chave: "cliente_email", desc: "E-mail do cliente", grupo: "Cliente" },
  { chave: "banco", desc: "Banco ou financeira", grupo: "Contrato" },
  { chave: "tipo_financiamento", desc: "Ex.: financiamento de veículo (Onix, 2021)", grupo: "Contrato" },
  { chave: "valor_financiado", desc: "Valor financiado", grupo: "Contrato" },
  { chave: "prazo", desc: "Número de parcelas", grupo: "Contrato" },
  { chave: "parcelas_pagas", desc: "Parcelas já pagas", grupo: "Contrato" },
  { chave: "parcela_atual", desc: "Parcela que o cliente paga hoje", grupo: "Contrato" },
  { chave: "parcela_corrigida", desc: "Parcela corrigida pela análise", grupo: "Contrato" },
  { chave: "beneficio_estimado", desc: "Benefício estimado na análise", grupo: "Contrato" },
  { chave: "numero_proposta", desc: "Nº da proposta aceita", grupo: "Contrato" },
  { chave: "honorarios_percentual", desc: "% de êxito (Configurações)", grupo: "Honorários" },
  { chave: "honorarios_entrada", desc: "Entrada em R$ (Configurações)", grupo: "Honorários" },
  { chave: "consultor", desc: "Consultor que enviou a proposta", grupo: "Outros" },
  { chave: "data_hoje", desc: "Data de hoje por extenso", grupo: "Outros" },
];

export const MODELO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA EM REVISÃO CONTRATUAL

CONTRATADA: {empresa_nome}, inscrita no CNPJ sob o nº {empresa_cnpj}, com sede em {empresa_endereco}.
CONTRATANTE: {cliente_nome}, inscrito(a) no CPF/CNPJ sob o nº {cliente_cpf}, telefone {cliente_telefone}, e-mail {cliente_email}.

CLÁUSULA 1ª — DO OBJETO
1.1. A CONTRATADA prestará ao CONTRATANTE serviços de consultoria para análise técnica e cálculo revisional do contrato de {tipo_financiamento} firmado com {banco}, no valor financiado de {valor_financiado}, em {prazo} parcelas, das quais {parcelas_pagas} já foram pagas.
1.2. Os serviços incluem: análise do contrato e dos encargos cobrados, comparação com a taxa média de mercado divulgada pelo Banco Central, elaboração de laudo de cálculo e tentativa de negociação administrativa com a instituição financeira.
1.3. Havendo necessidade de medida judicial, ela será proposta por advogado regularmente inscrito na OAB, indicado pela CONTRATADA e contratado diretamente pelo CONTRATANTE, mediante procuração e contrato de honorários próprios, nos termos da Lei nº 8.906/1994.

CLÁUSULA 2ª — DA ANÁLISE PRÉVIA
2.1. A análise prévia (proposta nº {numero_proposta}) estimou benefício de {beneficio_estimado} e parcela corrigida de {parcela_corrigida}, frente à parcela atual de {parcela_atual}.
2.2. Os valores são estimativas baseadas nos dados informados pelo CONTRATANTE e dependem da análise completa do contrato e da decisão da instituição financeira ou do juízo.
2.3. A obrigação da CONTRATADA é de meio, e não de resultado: ela não garante a obtenção de qualquer valor ou redução.

CLÁUSULA 3ª — DOS HONORÁRIOS
3.1. Pelos serviços, o CONTRATANTE pagará à CONTRATADA:
a) entrada de {honorarios_entrada}, na assinatura deste contrato (quando houver); e
b) {honorarios_percentual} sobre o benefício econômico efetivamente obtido, entendido como a soma dos valores restituídos, da redução do saldo devedor e da economia nas parcelas vincendas.
3.2. Os honorários de êxito são devidos à medida que o benefício for obtido, no prazo de 5 (cinco) dias do recebimento ou da formalização do acordo.
3.3. Se o CONTRATANTE fizer acordo diretamente com a instituição financeira após o início dos trabalhos, os honorários de êxito continuam devidos sobre o benefício obtido.
3.4. Em caso de atraso, incidirão multa de 2% (dois por cento), juros de 1% (um por cento) ao mês e correção monetária pelo IPCA.

CLÁUSULA 4ª — DAS DESPESAS
4.1. Custas, taxas, perícias, emolumentos e demais despesas necessárias correm por conta do CONTRATANTE, mediante prévia comunicação.
4.2. Os honorários de sucumbência eventualmente fixados em processo judicial pertencem ao advogado, nos termos da lei.

CLÁUSULA 5ª — DAS OBRIGAÇÕES DO CONTRATANTE
5.1. Fornecer contrato, extratos, boletos, documentos pessoais e demais informações solicitadas, responsabilizando-se por sua veracidade.
5.2. Manter seus dados de contato atualizados e comunicar qualquer contato ou proposta recebida da instituição financeira.
5.3. Não suspender o pagamento das parcelas sem orientação expressa, ciente de que o inadimplemento pode gerar negativação, cobrança e, no caso de veículo, busca e apreensão do bem.

CLÁUSULA 6ª — DOS RISCOS
O CONTRATANTE declara estar ciente de que a revisão pode não ser aceita pela instituição financeira e que, em eventual ação judicial, poderá ser condenado ao pagamento de custas e honorários de sucumbência, salvo concessão de gratuidade de justiça.

CLÁUSULA 7ª — DO DIREITO DE ARREPENDIMENTO
Por se tratar de contratação fora do estabelecimento, o CONTRATANTE poderá desistir deste contrato em até 7 (sete) dias da assinatura, sem custo, nos termos do art. 49 do Código de Defesa do Consumidor.

CLÁUSULA 8ª — DA RESCISÃO
8.1. Após o prazo de arrependimento, qualquer das partes poderá rescindir este contrato mediante aviso por escrito.
8.2. Na rescisão pelo CONTRATANTE após o início dos trabalhos, a entrada não será devolvida e serão devidos os honorários de êxito sobre o benefício já obtido ou que venha a decorrer do trabalho realizado.

CLÁUSULA 9ª — DA PROTEÇÃO DE DADOS
O CONTRATANTE autoriza o tratamento de seus dados pessoais e documentos exclusivamente para a execução deste contrato, nos termos da Lei nº 13.709/2018 (LGPD), inclusive o compartilhamento com o advogado indicado e com a instituição financeira, quando necessário.

CLÁUSULA 10ª — DO FORO
Fica eleito o foro do domicílio do CONTRATANTE para dirimir quaisquer dúvidas deste contrato.

E, por estarem de acordo, as partes assinam eletronicamente este instrumento em {data_hoje}.`;

/** Valores dos marcadores a partir da proposta aceita. Os que faltarem continuam como {marcador}. */
export function variaveisDaProposta(
  p: PropostaRev,
  extra: { honorarios_exito?: number; honorarios_entrada?: number; empresa_nome?: string; empresa_cnpj?: string; empresa_endereco?: string; cliente_email?: string } = {},
): Record<string, string> {
  const d = p.dados || {};
  const bem = p.tipo === "imovel" ? "financiamento imobiliário" : `financiamento de veículo${d.modelo ? ` (${d.modelo}${d.ano ? `, ${d.ano}` : ""})` : ""}`;
  const pct = n(extra.honorarios_exito);
  return {
    empresa_nome: extra.empresa_nome || p.empresa?.nome || "",
    empresa_cnpj: docFmt(extra.empresa_cnpj || p.empresa?.cnpj || ""),
    empresa_endereco: extra.empresa_endereco || "",
    cliente_nome: p.cliente_nome || "",
    cliente_cpf: docFmt(p.cliente_documento || ""),
    cliente_telefone: telFmt(p.cliente_telefone || ""),
    cliente_email: extra.cliente_email || "",
    banco: String(d.banco || ""),
    tipo_financiamento: bem,
    valor_financiado: n(d.valor_financiado) ? brl(d.valor_financiado) : "",
    prazo: n(d.prazo) ? String(n(d.prazo)) : "",
    parcelas_pagas: d.pagas !== undefined && d.pagas !== null ? String(n(d.pagas)) : "",
    parcela_atual: n(d.parcela_atual) ? brl(d.parcela_atual) : "",
    parcela_corrigida: n(p.resultado?.parcela_corrigida) ? brl(p.resultado?.parcela_corrigida) : "",
    beneficio_estimado: brl(beneficioDaProposta(p)),
    numero_proposta: p.numero || "",
    honorarios_percentual: pct ? `${pct.toLocaleString("pt-BR")}% (por cento)` : "",
    honorarios_entrada: extra.honorarios_entrada !== undefined ? (n(extra.honorarios_entrada) > 0 ? brl(n(extra.honorarios_entrada)) : "R$ 0,00 (sem entrada)") : "",
    consultor: p.consultor_nome || "",
    data_hoje: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

/** Troca {marcadores} pelos valores; marcador sem valor fica no texto para o vendedor completar. */
export function aplicarModelo(modelo: string, vars: Record<string, string>) {
  return modelo.replace(/\{([a-z_]+)\}/g, (m, k) => (vars[k] ? vars[k] : m));
}

/** Texto do contrato: modelo do workspace (ou o padrão) com os dados da proposta. */
export function textoContratoRevisional(p: PropostaRev, opts: Parameters<typeof variaveisDaProposta>[1] & { modelo?: string } = {}) {
  const modelo = (opts.modelo || "").trim() || MODELO_PADRAO;
  return aplicarModelo(modelo, variaveisDaProposta(p, opts));
}
