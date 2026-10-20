export const MENSAGEM_CPF_REPROVADO = `✅ Endereço aprovado para instalação!

Você pode ter internet de altíssima qualidade já AMANHÃ! 🚀

No momento, não conseguimos seguir com o pedido porque o CPF informado não foi aprovado na análise cadastral.

Fique tranquilo(a): isso não significa necessariamente que exista uma dívida. O sistema apenas não informa o motivo detalhado da reprovação.

👉 Para não perder a instalação, você pode nos enviar outro CPF de um amigo ou familiar? A titularidade poderá ser alterada posteriormente.`;

export function normalizarCpf(valor: unknown) { return typeof valor === 'string' ? valor.replace(/\D/g, '') : ''; }
export function cpfValido(valor: unknown) {
  if (typeof valor !== 'string' || !/^[\d.\-\s]+$/.test(valor)) return false;
  const cpf = normalizarCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let pos = 9; pos <= 10; pos++) {
    let soma = 0;
    for (let i = 0; i < pos; i++) soma += Number(cpf[i]) * (pos + 1 - i);
    const digito = (soma * 10) % 11;
    if ((digito === 10 ? 0 : digito) !== Number(cpf[pos])) return false;
  }
  return true;
}

export function normalizarStatus(valor: unknown) { return String(valor || '').trim().toUpperCase().replace(/\s+/g, ' '); }
export function dataNascimentoISO(valor: unknown) {
  if (typeof valor !== 'string') return null;
  const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/) || valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return null;
  const [ano, mes, dia] = partes[1].length === 4 ? partes.slice(1).map(Number) : [Number(partes[3]), Number(partes[2]), Number(partes[1])];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (ano < 1900 || data > new Date() || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function validarRecuperacaoCpf(body: Record<string, unknown>) {
  const falhar = (message: string) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!Number.isSafeInteger(Number(body.proposta_id)) || Number(body.proposta_id) <= 0) falhar('Venda inválida.');
  if (!cpfValido(body.cpf_novo)) falhar('Informe um novo CPF válido.');
  const anterior = normalizarCpf(body.cpf_reprovado);
  if (anterior.length !== 11 || anterior === normalizarCpf(body.cpf_novo)) falhar('O CPF deve ser diferente do CPF reprovado.');
  const nome = typeof body.nome_novo_titular === 'string' ? body.nome_novo_titular.trim() : '';
  const mae = typeof body.nome_mae_novo_titular === 'string' ? body.nome_mae_novo_titular.trim() : '';
  if (nome.length < 5 || nome.length > 200 || !nome.includes(' ')) falhar('Informe o nome completo do novo titular.');
  if (mae.length < 5 || mae.length > 200 || !mae.includes(' ')) falhar('Informe o nome completo da mãe do novo titular.');
  const nascimento = dataNascimentoISO(body.nascimento_novo_titular);
  if (!nascimento) falhar('Informe a data de nascimento válida do novo titular.');
  if (normalizarStatus(body.autorizacao_novo_titular) !== 'SIM') falhar('Confirme a autorização do novo titular para o cadastro.');
  return { propostaId: Number(body.proposta_id), anterior, cpf: normalizarCpf(body.cpf_novo), nome, mae, nascimento };
}

export function blocosRecuperacaoGrupoPrime(origem: string, token: string, apiKey = '') {
  const saidasIA = ['Dados confirmados', 'Erro', 'Limite de recusas atingido', 'Limite de lembretes atingido'];
  const snapshot = `setVariable('cpf_reprovado', String(variaveis.cpf || '').replace(/\\D/g, ''));
for (const campo of ['cpf_novo','nome_novo_titular','nascimento_novo_titular','nome_mae_novo_titular','autorizacao_novo_titular','recuperacao_payload','recuperacao_resposta']) delete variaveis[campo];
delete variaveis.__fluxo_ia_prime_reversao_ia;
delete variaveis.__fluxo_ia_prime_reversao_documentos_ia;
return true;`;
  const payload = `setVariable('recuperacao_payload', JSON.stringify(Object.fromEntries(['numero','proposta_id','cpf_reprovado','cpf_novo','nome_novo_titular','nascimento_novo_titular','nome_mae_novo_titular','autorizacao_novo_titular'].map(campo => [campo, variaveis[campo]])))); return true;`;
  const nos = [
    { id: 'prime_reversao_gatilho', tipo: 'gatilho_crm', x: 650, y: 100, saidas: ['Disparar'], dados: { ativo: true, campo: 'status_venda', operador: 'mudou_para', valor: 'CPF REPROVADO', modo_primeiro_envio: 'texto' } },
    { id: 'prime_reversao_origem', tipo: 'condicao', x: 650, y: 320, saidas: ['Sim', 'Não'], dados: { variavel: 'crm_valor_anterior', operador: 'igual', valor: 'AGUARDANDO AUDITORIA' } },
    { id: 'prime_reversao_snapshot', tipo: 'script', x: 650, y: 540, saidas: ['Próximo'], dados: { codigo: snapshot } },
    { id: 'prime_reversao_validar_anterior', tipo: 'condicao', x: 650, y: 760, saidas: ['Sim', 'Não'], dados: { variavel: 'cpf_reprovado', operador: 'match_regex', valor: '^\\d{11}$' } },
    { id: 'prime_reversao_etiqueta', tipo: 'etiqueta', x: 650, y: 980, saidas: ['Próximo'], dados: { acao: 'aplicar', nome: 'CPF REPROVADO', cor: '#dc2626', icone: '🔎' } },
    { id: 'prime_reversao_ia', tipo: 'fluxo_ia', x: 650, y: 1200, saidas: saidasIA, dados: {
      apiKey, modelo: 'gpt-4o-mini', limite_recusas: 3, agrupamento_ms: 3500, mensagem_inicial_literal: true, mensagem_inicial: MENSAGEM_CPF_REPROVADO,
      followups_extensao_ativa: false, reengajamento_ativo: false, extensoes_ia_ativas: false, consultas: [],
      prompt: `Você é o assistente virtual da Grupo Prime recuperando uma venda cujo CPF foi reprovado pelo BKO. A mensagem inicial configurada deve ser enviada literalmente, uma única vez nesta sessão.
Não recomece a venda, não peça novamente CEP, endereço ou plano; use a mesma proposta_id e os dados comerciais existentes. A rejeição não comprova dívida e o motivo não está disponível: não invente explicações.
Peça outro CPF real e válido, diferente de cpf_reprovado. Nunca invente um CPF, nem aceite o anterior com formatação diferente. O backend também valida essa diferença.
Colete com naturalidade, uma pergunta por vez: CPF, nome completo, data de nascimento e nome completo da mãe do novo titular. Peça confirmação de que o novo titular sabe e autoriza o cadastro; salve autorizacao_novo_titular como SIM apenas com autorização expressa. Se não autorizar, não tente concluir: ofereça atendimento humano. Respeite a recusa.
Não use nome, nascimento ou nome da mãe do titular anterior para preencher os campos novos. Não peça cartão nem pagamento.
Mostre o resumo do novo titular, mascarando o CPF e exibindo apenas os últimos dois dígitos, e aguarde confirmação explícita. Só então conclua a coleta para solicitar nova auditoria.
Não diga que o novo CPF foi aprovado nem que a instalação está agendada: a análise e a agenda serão confirmadas pela equipe. Se perguntarem sobre amanhã ou alteração posterior de titularidade, esclareça que dependem da confirmação da operadora e não são garantidas.`,
      variaveis: [
        { nome: 'cpf_novo', label: 'Outro CPF para análise cadastral', tipo: 'cpf', obrigatoria: true, diferente_de: 'cpf_reprovado' },
        { nome: 'nome_novo_titular', label: 'Nome completo do novo titular', tipo: 'nome', obrigatoria: true },
        { nome: 'nascimento_novo_titular', label: 'Data de nascimento do novo titular', tipo: 'data', obrigatoria: true },
        { nome: 'nome_mae_novo_titular', label: 'Nome completo da mãe do novo titular', tipo: 'nome', obrigatoria: true },
        { nome: 'autorizacao_novo_titular', label: 'Novo titular sabe e autoriza o cadastro (SIM ou NÃO)', tipo: 'texto', obrigatoria: true },
      ],
    } },
    { id: 'prime_reversao_payload', tipo: 'script', x: 650, y: 1420, saidas: ['Próximo'], dados: { codigo: payload } },
    { id: 'prime_reversao_atualizar', tipo: 'http_request', x: 650, y: 1640, saidas: ['Sucesso', 'Erro'], dados: { metodo: 'POST', url: `${origem}/api/crm/grupoprime/recuperar-cpf`, headers: JSON.stringify({ 'x-wolf-recuperacao-token': token }), body: '{{recuperacao_payload}}', variavel_resposta: 'recuperacao_resposta' } },
    { id: 'prime_reversao_limpar_etiqueta', tipo: 'etiqueta', x: 650, y: 1860, saidas: ['Próximo'], dados: { acao: 'remover', nome: 'CPF REPROVADO' } },
    { id: 'prime_reversao_coletado', tipo: 'etiqueta', x: 650, y: 2080, saidas: ['Próximo'], dados: { acao: 'aplicar', nome: 'NOVO CPF COLETADO', cor: '#16a34a', icone: '✅' } },
    { id: 'prime_reversao_enviada', tipo: 'finalizar', x: 650, y: 2300, saidas: [], dados: { mensagem: 'Os dados e documentos do novo titular foram salvos no CRM. O pedido voltou para Aguardando Auditoria e entrou no envio automático ao BKO.' } },
    { id: 'prime_reversao_pendencia', tipo: 'texto', x: 1080, y: 1640, saidas: ['Próximo'], dados: { texto: 'Não consegui concluir o registro no CRM. Seus dados e arquivos estão preservados; vamos corrigir a pendência neste atendimento.' } },
    { id: 'prime_reversao_humano', tipo: 'transferir', x: 1080, y: 1420, saidas: ['Próximo'], dados: { modo: 'equipe', fila: '', mensagem: 'Vou encaminhar seu atendimento à equipe Grupo Prime para ajudar com a revisão cadastral do pedido.' } },
    { id: 'prime_reversao_ignorar', tipo: 'script', x: 1080, y: 320, saidas: [], dados: { codigo: 'return true;' } },
  ];
  const ligar = (de: string, saidaIndex: number, para: string) => ({ id: `${de}_${saidaIndex}`, de, saidaIndex, para });
  return { nos, conexoes: [
    ligar('prime_reversao_gatilho', 0, 'prime_reversao_origem'),
    ligar('prime_reversao_origem', 0, 'prime_reversao_snapshot'), ligar('prime_reversao_origem', 1, 'prime_reversao_ignorar'),
    ligar('prime_reversao_snapshot', 0, 'prime_reversao_validar_anterior'),
    ligar('prime_reversao_validar_anterior', 0, 'prime_reversao_etiqueta'), ligar('prime_reversao_validar_anterior', 1, 'prime_reversao_humano'),
    ligar('prime_reversao_etiqueta', 0, 'prime_reversao_ia'),
    ligar('prime_reversao_ia', 0, 'prime_reversao_payload'),
    ...[1, 2, 3].map(saida => ligar('prime_reversao_ia', saida, 'prime_reversao_humano')),
    ligar('prime_reversao_payload', 0, 'prime_reversao_atualizar'), ligar('prime_reversao_atualizar', 0, 'prime_reversao_limpar_etiqueta'), ligar('prime_reversao_atualizar', 1, 'prime_reversao_pendencia'),
    ligar('prime_reversao_pendencia', 0, 'prime_reversao_documentos_ia'),
    ligar('prime_reversao_limpar_etiqueta', 0, 'prime_reversao_coletado'), ligar('prime_reversao_coletado', 0, 'prime_reversao_enviada'),
  ] };
}

export const MENSAGEM_ANDAMENTO_INSTALACAO = `Olá, {{nome}}! 😊

Seu pedido foi atualizado pelo nosso setor responsável.

📅 Data da instalação: {{data_agendamento}}
🕐 Período da instalação: {{periodo_instalacao}}
📋 Status atual: {{status_venda}}

Agora falta apenas a confirmação da Biometria que foi enviada pelo WhatsApp Oficial da Operadora!!

Seu pedido será enviado para a agenda do técnico após a confirmação da Biometria coletada!`;

export function blocosAvisosInstalacaoGrupoPrime() {
  const ligar = (de: string, saidaIndex: number, para: string) => ({ id: `${de}_${saidaIndex}`, de, saidaIndex, para });
  const nos = [
    ...['AGUARDANDO INSTALAÇÃO', 'GERADA'].map((valor, i) => ({ id: `prime_aviso_gatilho_${i}`, tipo: 'gatilho_crm', x: 1500 + i * 400, y: 100, saidas: ['Disparar'], dados: { ativo: true, campo: 'status_venda', operador: 'mudou_para', valor, modo_primeiro_envio: 'texto' } })),
    { id: 'prime_aviso_origem', tipo: 'condicao', x: 1500, y: 300, saidas: ['Sim', 'Não'], dados: { variavel: 'crm_valor_anterior', operador: 'igual', valor: 'AGUARDANDO AUDITORIA' } },
    { id: 'prime_aviso_origem_aprovada', tipo:'condicao',x:1900,y:480,saidas:['Sim','Não'],dados:{variavel:'crm_valor_anterior',operador:'igual',valor:'APROVADA'} },
    { id: 'prime_aviso_origem_gerada', tipo:'condicao',x:1900,y:660,saidas:['Sim','Não'],dados:{variavel:'crm_valor_anterior',operador:'igual',valor:'GERADA'} },
    { id: 'prime_aviso_preparar', tipo: 'script', x: 1500, y: 480, saidas: ['Próximo'], dados: { codigo: `
const data = String(variaveis.data_agendamento || '').trim();
const iso = data.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
setVariable('data_agendamento', iso ? iso[3] + '/' + iso[2] + '/' + iso[1] : data || 'A confirmar');
setVariable('periodo_instalacao', String(variaveis.periodo_instalacao || '').trim() || 'A confirmar');
setVariable('nome', String(variaveis.nome || '').trim() || 'cliente');
return true;` } },
    { id: 'prime_aviso_mensagem', tipo: 'texto', x: 1500, y: 660, saidas: ['Próximo'], dados: { texto: MENSAGEM_ANDAMENTO_INSTALACAO } },
    { id: 'prime_aviso_fim', tipo: 'finalizar', x: 1500, y: 840, saidas: [], dados: { mensagem: '' } },
    { id: 'prime_aviso_aprovada_gatilho', tipo: 'gatilho_crm', x: 2300, y: 100, saidas: ['Disparar'], dados: { ativo:true,campo:'status_venda',operador:'mudou_para',valor:'APROVADA',modo_primeiro_envio:'texto' } },
    { id: 'prime_aviso_aprovada_mensagem', tipo:'texto', x:2300,y:320,saidas:['Próximo'],dados:{texto:'Olá, {{nome}}! 😊 Seu pedido foi aprovado pelo setor responsável. A equipe seguirá com a preparação da instalação e confirmará os próximos passos e o agendamento por aqui.'} },
    { id: 'prime_aviso_sem_rede_gatilho', tipo:'gatilho_crm',x:2700,y:100,saidas:['Disparar'],dados:{ativo:true,campo:'status_venda',operador:'mudou_para',valor:'SEM DISPONIBILIDADE',modo_primeiro_envio:'texto'} },
    { id: 'prime_aviso_sem_rede_mensagem', tipo:'texto',x:2700,y:320,saidas:['Próximo'],dados:{texto:'No momento, não temos disponibilidade para instalar no endereço informado. Vamos encerrar este atendimento por enquanto. Seu interesse ficará registrado para retornarmos quando houver disponibilidade. Obrigado por procurar a Grupo Prime! 💚'} },
    { id: 'prime_aviso_agenda_revisada_gatilho', tipo:'gatilho_crm',x:3100,y:100,saidas:['Disparar'],dados:{ativo:true,campo:'custom.bko_agenda_revisada',operador:'alterou',modo_primeiro_envio:'texto'} },
  ];
  return { nos, conexoes: [
    ...[0, 1].map(i => ligar(`prime_aviso_gatilho_${i}`, 0, 'prime_aviso_origem')),
    ligar('prime_aviso_origem', 0, 'prime_aviso_preparar'), ligar('prime_aviso_origem', 1, 'prime_aviso_origem_aprovada'),
    ligar('prime_aviso_origem_aprovada',0,'prime_aviso_preparar'),ligar('prime_aviso_origem_aprovada',1,'prime_aviso_origem_gerada'),
    ligar('prime_aviso_origem_gerada',0,'prime_aviso_preparar'),ligar('prime_aviso_origem_gerada',1,'prime_aviso_fim'),
    ligar('prime_aviso_preparar', 0, 'prime_aviso_mensagem'), ligar('prime_aviso_mensagem', 0, 'prime_aviso_fim'),
    ligar('prime_aviso_aprovada_gatilho',0,'prime_aviso_aprovada_mensagem'),ligar('prime_aviso_aprovada_mensagem',0,'prime_aviso_fim'),
    ligar('prime_aviso_sem_rede_gatilho',0,'prime_aviso_sem_rede_mensagem'),ligar('prime_aviso_sem_rede_mensagem',0,'prime_aviso_fim'),
    ligar('prime_aviso_agenda_revisada_gatilho',0,'prime_aviso_preparar'),
  ] };
}
