// Vendedora IA genérica (integracao "vendedora_ia"): nichos prontos.
// Escolher o nicho preenche objetivo, dados a coletar e dicas do ramo.
// O cliente só ajusta o que quiser — nada de código por cliente.

export type CampoVendedora = { variavel: string; rotulo: string; pergunta: string; tipo: string; obrigatorio: boolean };
type Nicho = { nome: string; grupo: string; objetivo: string; coleta: [string, string, string?, boolean?][]; dicas: string };

const NOME: [string, string, string?] = ["nome", "Nome completo"];
const TEL: [string, string, string?, boolean?] = ["telefone", "Telefone de contato", "telefone", false];
const END: [string, string] = ["endereco", "Endereço de entrega (rua, número, bairro, cidade)"];
const CPF: [string, string, string] = ["cpf", "CPF", "cpf"];
const EMAIL: [string, string, string, boolean] = ["email", "E-mail", "email", false];
const DATA: [string, string] = ["data_desejada", "Data e horário desejados"];

export const NICHOS_VENDEDORA: Record<string, Nicho> = {
  loja: { nome: "Loja / varejo em geral", grupo: "Comércio", objetivo: "Ajudar o cliente a escolher produtos do catálogo, fechar o pedido e enviar o pagamento.", coleta: [NOME, END, ["forma_pagamento", "Forma de pagamento"]], dicas: "Pergunte para que é o produto e o orçamento. Sugira 1 complemento que combine. Informe prazo de entrega e se há retirada." },
  roupas: { nome: "Roupas, calçados e acessórios", grupo: "Comércio", objetivo: "Ajudar a escolher peças por estilo, tamanho e cor, mostrar fotos e fechar o pedido.", coleta: [["produto", "Peça escolhida", "texto", false], ["tamanho", "Tamanho", "texto", false], ["cor", "Cor", "texto", false], NOME, END], dicas: "Pergunte ocasião, estilo e tamanho. Mande fotos (enviar_foto). Explique tabela de medidas e política de troca." },
  informatica: { nome: "Informática e eletrônicos", grupo: "Comércio", objetivo: "Entender a necessidade técnica, indicar o produto compatível e fechar o pedido.", coleta: [NOME, END], dicas: "Traduza termos leigos para o nome técnico. Confira compatibilidade (modelo do equipamento). Sugira acessórios úteis." },
  celulares: { nome: "Celulares e assistência", grupo: "Comércio", objetivo: "Vender aparelhos e acessórios ou agendar conserto.", coleta: [["modelo", "Modelo do aparelho"], ["problema", "Problema ou interesse"], NOME], dicas: "Para conserto, peça modelo e defeito; informe prazo e garantia. Para venda, compare memória, câmera e bateria." },
  moveis: { nome: "Móveis e decoração", grupo: "Comércio", objetivo: "Ajudar a escolher móveis pelas medidas e estilo e fechar o pedido com entrega.", coleta: [["medidas", "Medidas do ambiente"], NOME, END], dicas: "Peça medidas e fotos do ambiente. Informe prazo de entrega e montagem." },
  cosmeticos: { nome: "Cosméticos e perfumaria", grupo: "Comércio", objetivo: "Indicar produtos pelo tipo de pele/cabelo e preferência e fechar o pedido.", coleta: [NOME, END], dicas: "Pergunte tipo de pele/cabelo e o que procura. Monte kits." },
  farmacia: { nome: "Farmácia e drogaria", grupo: "Comércio", objetivo: "Informar disponibilidade e preço de produtos e fechar pedidos com entrega.", coleta: [NOME, END], dicas: "Nunca indique medicamento nem dosagem: oriente procurar o farmacêutico ou médico. Remédio controlado exige receita." },
  pet: { nome: "Pet shop e veterinária", grupo: "Comércio", objetivo: "Vender produtos pet e agendar banho, tosa ou consulta.", coleta: [["pet", "Nome, espécie e porte do pet"], NOME, DATA], dicas: "Pergunte espécie, porte e idade. Para banho e tosa, ofereça horários." },
  delivery: { nome: "Restaurante / delivery", grupo: "Alimentação", objetivo: "Anotar o pedido do cardápio, confirmar entrega e pagamento.", coleta: [["pedido", "Itens do pedido"], NOME, END, ["forma_pagamento", "Forma de pagamento (Pix, cartão, dinheiro e troco)"]], dicas: "Mostre o cardápio por categoria, sugira bebida e sobremesa, informe taxa e tempo de entrega." },
  confeitaria: { nome: "Confeitaria e doces sob encomenda", grupo: "Alimentação", objetivo: "Fechar encomendas de bolos e doces com data, sabor e quantidade.", coleta: [["encomenda", "O que deseja (sabor, tamanho, quantidade)"], DATA, NOME, END], dicas: "Pergunte data do evento e número de pessoas. Informe prazo mínimo e sinal para reservar." },
  imobiliaria: { nome: "Imobiliária", grupo: "Serviços", objetivo: "Entender o perfil, mostrar imóveis do catálogo e agendar visita.", coleta: [["interesse", "Compra ou aluguel, região e faixa de valor"], NOME, DATA], dicas: "Pergunte região, quartos, faixa de valor e forma de pagamento (financiamento, à vista). Mande fotos e agende visita." },
  veiculos: { nome: "Veículos / concessionária", grupo: "Serviços", objetivo: "Apresentar veículos do estoque, simular condições e agendar visita ou test drive.", coleta: [["veiculo", "Veículo de interesse"], ["troca", "Tem carro na troca?", "texto", false], NOME, DATA], dicas: "Pergunte uso, orçamento, entrada e se tem carro na troca. Mande fotos. Financiamento: diga que a simulação final é do banco." },
  energia_solar: { nome: "Energia solar", grupo: "Serviços", objetivo: "Qualificar o cliente pelo consumo e agendar visita técnica para orçamento.", coleta: [["conta_luz", "Valor médio da conta de luz"], ["cidade", "Cidade"], ["tipo_imovel", "Tipo de imóvel (casa, comércio, rural)"], NOME], dicas: "Peça o valor da conta (ou foto). Explique economia e payback de forma simples, sem prometer números exatos." },
  construcao: { nome: "Construção, reforma e material", grupo: "Serviços", objetivo: "Entender a obra, indicar material ou serviço e preparar orçamento.", coleta: [["servico", "O que precisa"], ["local", "Bairro / cidade"], NOME], dicas: "Peça medidas e fotos. Para serviço, agende visita técnica." },
  servicos: { nome: "Prestação de serviços em geral", grupo: "Serviços", objetivo: "Entender a necessidade, explicar o serviço e registrar o pedido de orçamento ou agendamento.", coleta: [["servico", "Serviço desejado"], ["local", "Local"], DATA, NOME], dicas: "Pergunte o que precisa, onde e para quando. Mande o orçamento ou agende." },
  oficina: { nome: "Oficina mecânica / auto center", grupo: "Serviços", objetivo: "Entender o problema do veículo e agendar avaliação ou serviço.", coleta: [["veiculo", "Modelo e ano do veículo"], ["problema", "O que está acontecendo"], DATA, NOME], dicas: "Pergunte modelo, ano e sintomas. Não dê diagnóstico fechado: agende avaliação." },
  limpeza: { nome: "Limpeza, dedetização e manutenção", grupo: "Serviços", objetivo: "Qualificar o serviço e agendar a visita.", coleta: [["servico", "Serviço"], ["tamanho", "Tamanho do local (m² ou cômodos)"], END, DATA, NOME], dicas: "Peça tamanho do local e fotos. Informe preparo necessário antes do serviço." },
  eventos: { nome: "Eventos, buffet e fotografia", grupo: "Serviços", objetivo: "Entender o evento e enviar orçamento ou reservar a data.", coleta: [["evento", "Tipo de evento"], DATA, ["convidados", "Número de convidados", "numero"], NOME], dicas: "Pergunte data, local e número de pessoas primeiro: disponibilidade da data é decisiva." },
  turismo: { nome: "Turismo e viagens", grupo: "Serviços", objetivo: "Montar a viagem pelo destino, datas e pessoas e enviar a proposta.", coleta: [["destino", "Destino"], ["datas", "Datas de ida e volta"], ["pessoas", "Quantas pessoas", "numero"], NOME, EMAIL], dicas: "Pergunte destino, datas, quantas pessoas e orçamento. Valores dependem de disponibilidade: confirme antes de fechar." },
  clinica: { nome: "Clínica médica / saúde", grupo: "Saúde e beleza", objetivo: "Tirar dúvidas sobre especialidades, convênios e agendar consultas.", coleta: [NOME, ["convenio", "Convênio ou particular"], ["especialidade", "Especialidade ou exame"], DATA], dicas: "Nunca dê diagnóstico nem oriente remédio. Em urgência, oriente procurar pronto-socorro." },
  odontologia: { nome: "Odontologia", grupo: "Saúde e beleza", objetivo: "Explicar tratamentos e agendar avaliação.", coleta: [["tratamento", "Tratamento de interesse"], NOME, DATA], dicas: "Ofereça avaliação; valores de tratamento dependem dela. Fale de parcelamento se configurado." },
  estetica: { nome: "Clínica de estética", grupo: "Saúde e beleza", objetivo: "Explicar procedimentos, tirar dúvidas e agendar avaliação ou sessão.", coleta: [["procedimento", "Procedimento de interesse"], NOME, DATA], dicas: "Pergunte objetivo e se já fez antes. Fale de resultados sem promessas exageradas. Pacotes costumam converter melhor." },
  salao: { nome: "Salão de beleza / barbearia", grupo: "Saúde e beleza", objetivo: "Mostrar serviços e preços e agendar horário.", coleta: [["servico", "Serviço"], ["profissional", "Profissional de preferência", "texto", false], DATA, NOME], dicas: "Ofereça 2 opções de horário. Sugira serviço complementar." },
  academia: { nome: "Academia, personal e esportes", grupo: "Saúde e beleza", objetivo: "Entender o objetivo, indicar o plano e fechar a matrícula ou aula experimental.", coleta: [["objetivo_treino", "Objetivo"], NOME, DATA], dicas: "Pergunte objetivo, rotina e experiência. Ofereça aula experimental. Plano anual: mostre a economia." },
  psicologia: { nome: "Psicologia e terapias", grupo: "Saúde e beleza", objetivo: "Acolher, explicar o atendimento e agendar a primeira sessão.", coleta: [NOME, ["modalidade", "Online ou presencial"], DATA], dicas: "Tom acolhedor e discreto. Em risco de vida, oriente CVV 188 e emergência 192." },
  cursos: { nome: "Cursos e educação", grupo: "Educação", objetivo: "Entender o objetivo do aluno, indicar o curso e fechar a matrícula.", coleta: [["curso", "Curso de interesse"], NOME, EMAIL], dicas: "Pergunte objetivo e disponibilidade. Mostre conteúdo, certificado e formas de pagamento." },
  escola: { nome: "Escola e reforço escolar", grupo: "Educação", objetivo: "Informar turmas e valores e agendar visita ou matrícula.", coleta: [["aluno", "Nome e idade/série do aluno"], ["responsavel", "Nome do responsável"], DATA], dicas: "Pergunte série e turno. Agende visita." },
  infoproduto: { nome: "Infoprodutos e mentorias", grupo: "Educação", objetivo: "Qualificar o lead, tirar objeções e enviar o link de compra.", coleta: [NOME, EMAIL], dicas: "Descubra a dor principal, mostre a transformação e as garantias. Use o link de pagamento do produto." },
  advocacia: { nome: "Advocacia", grupo: "Profissionais", objetivo: "Entender o caso de forma geral e agendar consulta com o advogado.", coleta: [["area", "Assunto (trabalhista, família, previdência...)"], ["resumo_caso", "Resumo do caso"], NOME], dicas: "Não dê parecer jurídico: colete o resumo e agende consulta. Sigilo sempre." },
  contabilidade: { nome: "Contabilidade", grupo: "Profissionais", objetivo: "Entender o tipo de empresa e enviar proposta de honorários.", coleta: [["tipo_empresa", "Tipo de empresa (MEI, Simples...)"], ["atividade", "Atividade"], NOME, EMAIL], dicas: "Pergunte regime tributário, faturamento e número de funcionários." },
  consignado: { nome: "Crédito consignado e empréstimos", grupo: "Financeiro", objetivo: "Qualificar (convênio, benefício), coletar dados e encaminhar a simulação.", coleta: [["convenio", "Convênio (INSS, SIAPE, CLT...)"], NOME, CPF, ["data_nascimento", "Data de nascimento"]], dicas: "Nunca prometa aprovação nem taxa: a simulação é do banco. Não peça senha de nada." },
  seguros: { nome: "Seguros", grupo: "Financeiro", objetivo: "Entender o que o cliente quer proteger e encaminhar a cotação.", coleta: [["tipo_seguro", "Tipo de seguro"], NOME, CPF, EMAIL], dicas: "Pergunte o bem/pessoa a proteger e coberturas desejadas. Valor final depende da seguradora." },
  consorcio: { nome: "Consórcio", grupo: "Financeiro", objetivo: "Entender o objetivo e simular cartas de crédito do catálogo.", coleta: [["bem", "O que quer adquirir e valor"], NOME, CPF], dicas: "Explique a diferença para financiamento (sem juros, com taxa de administração) e contemplação." },
  internet: { nome: "Internet e telecom", grupo: "Tecnologia", objetivo: "Verificar o endereço, apresentar os planos e fechar a contratação.", coleta: [["cep", "CEP"], ["endereco", "Endereço completo"], NOME, CPF, ["vencimento", "Dia de vencimento"]], dicas: "Pergunte uso (jogos, home office, streaming) e indique a velocidade. Disponibilidade depende do endereço." },
  software: { nome: "Software / SaaS / sistemas", grupo: "Tecnologia", objetivo: "Entender a operação, indicar o plano e agendar demonstração ou mandar o teste.", coleta: [["empresa", "Empresa"], ["tamanho", "Quantas pessoas vão usar"], NOME, EMAIL], dicas: "Pergunte o processo atual e a dor. Ofereça demonstração ou teste grátis." },
  marketing: { nome: "Agência de marketing / tráfego", grupo: "Tecnologia", objetivo: "Entender o negócio e enviar proposta de serviço.", coleta: [["empresa", "Empresa e o que vende"], ["investimento", "Quanto investe hoje em anúncios", "texto", false], NOME], dicas: "Pergunte canais atuais, ticket médio e meta. Verba de anúncio é à parte." },
  igreja: { nome: "Igreja / ONG", grupo: "Outros", objetivo: "Acolher, informar horários e atividades e registrar interesse ou doação.", coleta: [NOME], dicas: "Tom acolhedor. Informe horários, endereço e como participar." },
  outro: { nome: "Outro ramo", grupo: "Outros", objetivo: "Atender, tirar dúvidas e registrar o pedido ou solicitação.", coleta: [NOME, TEL], dicas: "" },
};

export const GRUPOS_NICHO = [...new Set(Object.values(NICHOS_VENDEDORA).map((n) => n.grupo))];

export function coletaDoNicho(id: string): CampoVendedora[] {
  const n = NICHOS_VENDEDORA[id] || NICHOS_VENDEDORA.outro;
  return n.coleta.map(([variavel, rotulo, tipo, obrigatorio]) => ({ variavel, rotulo, pergunta: "", tipo: tipo || (variavel === "cpf" ? "cpf" : variavel === "email" ? "email" : variavel === "telefone" ? "telefone" : "texto"), obrigatorio: obrigatorio !== false }));
}

/** Dados iniciais do bloco Nicho no modo Vendedora IA. */
export function vendedoraInicial(id = "") {
  const n = NICHOS_VENDEDORA[id];
  return {
    versao: 3, integracao: "vendedora_ia", nicho: id, nicho_nome: n?.nome || "", objetivo: n?.objetivo || "", dicas: n?.dicas || "",
    coleta: id ? coletaDoNicho(id) : [], catalogo_fonte: "manual", catalogo: [], planilha_url: "", api_url: "", api_headers: "",
    empresa_info: "", faq: "", formas_pagamento: "", link_pagamento: "", link_agendamento: "", mensagem_pos_pedido: "",
    aviso_whatsapp: "", webhook_url: "", planilha_registro_url: "", planilha_registro_aba: "", regras: "", prompt: "",
  };
}

/** Problemas que impedem a Vendedora IA de funcionar (mostrados antes de salvar). */
export function problemasVendedora(d: Record<string, any>): string[] {
  const p: string[] = [];
  if (!d.nicho) p.push("Escolha o ramo do negócio no bloco Vendedora IA.");
  if (d.catalogo_fonte === "planilha" && !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(String(d.planilha_url || ""))) p.push("Cole o link da planilha do Google (Vendedora IA → Catálogo).");
  if (d.catalogo_fonte === "api" && !/^https:\/\//.test(String(d.api_url || ""))) p.push("Informe a URL da API do catálogo (começando com https://).");
  if (d.catalogo_fonte === "manual" && (d.catalogo || []).some((i: any) => !String(i.nome || "").trim())) p.push("Há item do catálogo sem nome.");
  for (const c of d.coleta || []) if (c.variavel && !/^[a-zA-Z_][\w]{0,60}$/.test(c.variavel)) p.push(`Nome de variável inválido: "${c.variavel}" (use letras, números e _).`);
  if (d.webhook_url && !/^https:\/\//.test(d.webhook_url)) p.push("O webhook precisa começar com https://.");
  if (d.planilha_registro_url && !/^https:\/\/script\.google\.com\//.test(d.planilha_registro_url)) p.push("A planilha de registro precisa ser a URL do Apps Script (https://script.google.com/...).");
  return p;
}
