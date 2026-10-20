export const REGRAS_DOCUMENTOS_GRUPOPRIME = [
  { id: 'prime_rg_frente', nome: 'RG — frente', descricao: 'Foto da face da identidade com retrato. Conferir apenas se o nome legível corresponde ao cadastro, considerando a rotação da imagem. Não exigir número do RG.', variavel: 'rg_frente', obrigatoria: true, multiplos: false },
  { id: 'prime_rg_verso', nome: 'RG — verso', descricao: 'Identificar visualmente o verso da identidade, sem retrato, com dados de registro ou impressão digital. Não exigir leitura de nome, CPF ou número do RG nesta face.', variavel: 'rg_verso', obrigatoria: true, multiplos: false },
  { id: 'prime_comprovante', nome: 'Comprovante de endereço de instalação', descricao: 'Qualquer documento legível que mostre o endereço da instalação: boleto ou fatura (inclusive Claro, internet, telefone, banco), conta de água/luz/gás, correspondência, contrato, declaração, carnê, print ou PDF. O tipo e a empresa não são motivo de recusa. Não exigir nome do titular no comprovante. Conferir o endereço, sem inventar dados ilegíveis.', variavel: 'comprovante_endereco', obrigatoria: true, multiplos: false },
];
export const PROMPT_DOCUMENTOS_GRUPOPRIME = `Você é o assistente da Grupo Prime coletando os documentos obrigatórios para o BKO. O plano e o endereço de instalação já foram escolhidos. Não refaça a oferta.
Solicite RG frente, RG verso e comprovante de endereço da casa de instalação, um arquivo por vez. Identifique a face pelo conteúdo da imagem, nunca pela ordem de envio. Uma foto do lado com dados de registro/filiação sem retrato é o verso neste atendimento. Consulte os arquivos realmente salvos: se frente e verso já estiverem validados, peça o comprovante, não solicite RG novamente. Não afirme que salvou sem CAPTURA_SEGURA_ARQUIVO=SIM. Não diga “vou verificar”, “um momento” ou prometa processamento em segundo plano; responda com o resultado disponível e peça somente o arquivo ainda ausente. Texto como “esse foi o verso” não valida nem salva um arquivo. As imagens precisam ser legíveis, completas e do titular correto. O RG frente e verso devem ser fotos (não links nem dados digitados). O comprovante pode ser foto, print ou PDF de qualquer tipo de documento (boleto, fatura de internet/telefone, água/luz/gás, correspondência, contrato, declaração ou carnê) e deve mostrar o endereço informado. Não recuse por ser boleto bancário, por ser de outra operadora ou por estar no nome de outra pessoa. Se o endereço está legível e corresponde à instalação, aceite e salve como comprovante_endereco. Só peça outro documento quando não houver endereço legível ou quando for de outro local. Não exija comprovante de pagamento. O CEP do comprovante pode ser diferente do cadastro: ignore essa diferença e conclua a venda. Preserve o CEP de instalação informado pelo cliente; não o substitua pela leitura do comprovante.
O cadastro completo já foi coletado, corrigido e confirmado antes desta fase. Não antecipe documentos antes dessa confirmação. Use a leitura de mídia para conferir o cadastro confirmado, sem substituir silenciosamente nome, CPF, nascimento, nome da mãe, endereço, contatos ou pagamento. Se houver divergência, encaminhe para correção e nova confirmação. Na recuperação de CPF, confira os dados do novo titular e não reutilize os documentos antigos. Não invente dados nem peça número, senha ou foto do cartão.
As variáveis rg_frente_validado, rg_verso_validado e comprovante_endereco_validado são exclusivas da captura privada do servidor. Não pergunte essas variáveis e nunca marque SIM por declaração do cliente, texto, promessa de envio, link ou arquivo ilegível. Só o recebimento e armazenamento real do arquivo liberam a etapa.
Explique que sem os três documentos não é possível enviar a venda para auditoria. Não afirme aprovação de cadastro, contrato concluído ou instalação agendada. Após os arquivos, mostre o resumo com CPF mascarado e peça confirmação para enviar ao BKO.`;

export function configuracaoDocumentosGrupoPrime(apiKey: string, recuperacao = false) {
  return {
    apiKey, modelo: 'gpt-4o-mini', limite_recusas: 3, agrupamento_ms: 3500,
    mensagem_inicial_literal: true,
    mensagem_inicial: recuperacao
      ? 'Para reenviar o pedido à auditoria, preciso das fotos do RG frente e verso do novo titular e do comprovante de endereço da casa de instalação. Pode enviar primeiro a frente do RG?'
      : 'Cadastro confirmado! 😊 Agora preciso dos documentos para encaminhar seu pedido à auditoria: RG frente, RG verso e comprovante do endereço da instalação. Pode enviar primeiro uma foto legível da frente do RG?',
    prompt: PROMPT_DOCUMENTOS_GRUPOPRIME,
    extensoes_ia_ativas: true, ext_multimidia_ativa: true, midia_ia_extensao_ativa: true,
    midia_ia_imagens_ativa: true, midia_ia_arquivos_ativa: true, midia_ia_tamanho_max_mb: 15,
    midia_ia_mensagem_falha: 'Não consegui ler ou salvar o documento com segurança. Envie novamente uma foto legível e completa. Os documentos são obrigatórios para enviar ao BKO.',
    followups_extensao_ativa: false, reengajamento_ativo: false, consultas: [],
    arquivos_salvar_regras: REGRAS_DOCUMENTOS_GRUPOPRIME,
    variaveis: [
      ...[
        { nome: 'nome', label: 'Nome completo do titular', tipo: 'nome', obrigatoria: recuperacao },
        { nome: 'cpf', label: 'CPF do titular ou representante legal', tipo: 'cpf', obrigatoria: recuperacao, ...(recuperacao ? { diferente_de: 'cpf_reprovado' } : {}) },
        { nome: 'data_nascimento', label: 'Data de nascimento do titular', tipo: 'data', obrigatoria: recuperacao },
        { nome: 'nome_mae', label: 'Nome completo da mãe do titular', tipo: 'nome', obrigatoria: recuperacao },
        { nome: 'rg', label: 'Número do RG lido no documento', tipo: 'texto', obrigatoria: false },
      ],
      { nome: 'endereco_comprovante', label: 'Endereço lido no comprovante (não pedir digitação)', tipo: 'texto', obrigatoria: false },
      { nome: 'cep_comprovante', label: 'CEP lido no comprovante de endereço (não pedir digitação)', tipo: 'texto', obrigatoria: false },
      ...REGRAS_DOCUMENTOS_GRUPOPRIME.map(r => ({ nome: `${r.variavel}_validado`, label: r.nome, tipo: 'texto', obrigatoria: true })),
    ],
  };
}

export function limparDocumentosGrupoPrime() {
  return `for (const chave of Object.keys(variaveis)) {
  if (['rg','rg_numero','rg_frente','rg_verso','comprovante_endereco','rg_frente_validado','rg_verso_validado','comprovante_endereco_validado','rg_validado','documentos_privados','documentos_verificados','cep_comprovante','endereco_comprovante'].includes(chave) || chave.startsWith('__identidade_documento_') || chave.startsWith('__fluxo_ia_prime_documentos') || chave.startsWith('__fluxo_ia_prime_reversao_documentos')) delete variaveis[chave];
}
return true;`;
}

export function blocosDocumentosGrupoPrime(origem: string, token: string, apiKey: string) {
  const saidas = ['Dados confirmados', 'Erro', 'Limite de recusas atingido', 'Limite de lembretes atingido'];
  const ligar = (de: string, saidaIndex: number, para: string) => ({ id: `${de}_${saidaIndex}`, de, saidaIndex, para });
  return {
    nos: [
      { id: 'prime_documentos_entrada', tipo: 'condicao', x: 200, y: 540, saidas: ['Sim', 'Não'], dados: { variavel: 'plano_interesse', operador: 'diferente', valor: 'ANALISE_HUMANA' } },
      { id: 'prime_documentos_preparar', tipo: 'script', x: 200, y: 760, saidas: ['Próximo'], dados: { codigo: limparDocumentosGrupoPrime() } },
      { id: 'prime_documentos_ia', tipo: 'fluxo_ia', x: 200, y: 980, saidas, dados: configuracaoDocumentosGrupoPrime(apiKey) },
      { id: 'prime_documentos_conferir', tipo: 'http_request', x: 200, y: 1200, saidas: ['Sucesso', 'Erro'], dados: {
        url: `${origem}/api/crm/grupoprime/validar-documentos`, metodo: 'POST', headers: JSON.stringify({ 'x-wolf-documentos-token': token }),
        body: '{"numero":"{{numero}}"}', variavel_resposta: 'documentos_verificados',
      } },
      { id: 'prime_documentos_cadastro', tipo: 'script', x: 200, y: 1420, saidas: ['Próximo'], dados: { codigo: `
const resposta = JSON.parse(variaveis.documentos_verificados || '{}');
if (!resposta.success) throw new Error('Documentos não conferidos');
for (const [campo, valor] of Object.entries(resposta.cadastro)) setVariable(campo, String(valor ?? ''));
for (const [campo, valor] of Object.entries(resposta.documentos)) setVariable(campo, JSON.stringify(valor));
setVariable('bko_pendente', 'SIM');
return true;` } },
      { id: 'prime_documentos_enviar', tipo: 'enviar_venda', x: 200, y: 1640, saidas: ['Sucesso', 'Erro'], dados: {
        modo_mapeamento: 'manual', mapeamento: Object.fromEntries(['nome','cpf','data_nascimento','nome_mae','email','telefone1','telefone2','vencimento','rg','cep','cidade','estado','endereco','plano','valor_plano','operadora','forma_pagamento'].map(campo => [campo, campo])),
        status_inicial: 'AGUARDANDO AUDITORIA', usar_vendedor_atendimento: true, roleta_vendas_ativa: true,
        aplicar_etiqueta: true, etiqueta: 'DOCUMENTAÇÃO COMPLETA',
        mensagem_sucesso: 'Seu pedido e os três documentos foram registrados no CRM e enviados para auditoria do BKO. A equipe vai conferir o cadastro e confirmar os próximos passos.',
        mensagem_erro: 'Não consegui registrar o pedido agora. Os documentos continuam preservados e a equipe vai ajudar a concluir.',
      } },
      { id: 'prime_documentos_fim', tipo: 'finalizar', x: 200, y: 1860, saidas: [], dados: { mensagem: '' } },
      { id: 'prime_documentos_pendencia', tipo: 'texto', x: 1080, y: 1200, saidas: ['Próximo'], dados: { texto: 'Não consegui concluir o registro no CRM. Seus dados e documentos continuam salvos neste atendimento; vamos corrigir a pendência para prosseguir.' } },
      { id: 'prime_reversao_documentos_preparar', tipo: 'script', x: 650, y: 1420, saidas: ['Próximo'], dados: { codigo: limparDocumentosGrupoPrime().replace(/return true;\s*$/, '') + `
setVariable('cpf', variaveis.cpf_novo);
setVariable('nome', variaveis.nome_novo_titular);
setVariable('data_nascimento', variaveis.nascimento_novo_titular);
setVariable('nome_mae', variaveis.nome_mae_novo_titular);
delete variaveis.rg;
return true;`.replace(/^/, '\n') } },
      { id: 'prime_reversao_documentos_ia', tipo: 'fluxo_ia', x: 650, y: 1640, saidas, dados: configuracaoDocumentosGrupoPrime(apiKey, true) },
    ],
    conexoes: [
      ligar('prime_documentos_entrada', 0, 'prime_documentos_preparar'), ligar('prime_documentos_entrada', 1, 'prime_humano'),
      ligar('prime_documentos_preparar', 0, 'prime_documentos_ia'), ligar('prime_documentos_ia', 0, 'prime_documentos_conferir'),
      ...[1, 2, 3].map(i => ligar('prime_documentos_ia', i, 'prime_humano')),
      ligar('prime_documentos_conferir', 0, 'prime_documentos_cadastro'), ligar('prime_documentos_conferir', 1, 'prime_documentos_pendencia'),
      ligar('prime_documentos_pendencia', 0, 'prime_documentos_ia'),
      ligar('prime_documentos_cadastro', 0, 'prime_documentos_enviar'), ligar('prime_documentos_enviar', 0, 'prime_documentos_fim'), ligar('prime_documentos_enviar', 1, 'prime_humano'),
      ligar('prime_reversao_documentos_preparar', 0, 'prime_reversao_documentos_ia'), ligar('prime_reversao_documentos_ia', 0, 'prime_reversao_payload'),
      ...[1, 2, 3].map(i => ligar('prime_reversao_documentos_ia', i, 'prime_reversao_humano')),
    ],
  };
}
