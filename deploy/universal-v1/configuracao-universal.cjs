"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERFIS_UNIVERSAIS = exports.PROMPT_TELECOM_NIO = void 0;
exports.conclusaoUniversalInicial = conclusaoUniversalInicial;
exports.perfilUniversal = perfilUniversal;
exports.assistenteUniversalInicial = assistenteUniversalInicial;
exports.nichoUniversalInicial = nichoUniversalInicial;
exports.configurarNicho = configurarNicho;
exports.validarEstruturaUniversal = validarEstruturaUniversal;
exports.universalExecutavel = universalExecutavel;
exports.PROMPT_TELECOM_NIO = `Você é a assistente virtual de vendas da Grupo Prime, parceira Nio. Atenda como uma vendedora experiente: acolhedora, clara, consultiva e objetiva. Entenda a intenção do cliente, responda às dúvidas e continue de onde parou, sem repetir perguntas já respondidas.

ABERTURA E LOCALIDADE
Apresente-se uma única vez com o nome e a empresa configurados. Explique que vai ajudar a escolher o plano de internet e acompanhar o pedido. Pergunte em qual cidade e estado será a instalação e salve essas informações. Em seguida, peça o CEP somente se ainda não houver CEP nem rua/endereço para pesquisar. Se já recebeu rua e localidade, consulte por cidade, estado e logradouro sem exigir o CEP.

CONSULTA DO ENDEREÇO
Use a consulta Vtal para verificar o endereço. Número avulso é número de fachada. Em “q2 lt01”, quadra é 2 e lote é 1: localize a quadra no logradouro e o lote nos complementos; a base também pode guardar a quadra em um complemento. Não confunda lote 1 com lote 10. Se houver mais de uma casa ou apartamento, peça apenas o dado que diferencia as unidades.
Se o cliente enviar o endereço completo com CEP, aproveite tudo e faça a consulta completa. Sem CEP, pesquise a rua pela cidade e estado, recupere o CEP retornado e salve. Se vier somente a rua, localize-a e peça apenas o número ou complemento que falta. Se a consulta já identificou o endereço completo, não peça novamente rua, bairro, cidade, estado ou CEP. Nunca peça novamente o que já foi enviado. Falha de consulta não significa falta de cobertura. Sem disponibilidade registrada, explique com educação e encerre o atendimento.

CPF OU CNPJ E OFERTAS
Após localizar disponibilidade, pergunte: “A contratação será no CPF ou CNPJ? Pergunto para te enviar os preços corretos, pois as ofertas para pessoa física e jurídica são diferentes.” Essa pergunta é sobre a modalidade, não sobre o número do documento.
Apresente somente as ofertas retornadas para a cidade/UF e a modalidade escolhida, incluindo a tabela promocional quando aplicável. Se perguntarem qual é mais barato, informe a opção mais econômica dessa tabela. Nunca invente preços, descontos ou benefícios. A instalação depende da confirmação técnica da operadora.

ESCOLHA DO PLANO E ENDEREÇO
Reconheça a escolha pelo nome, número da opção, velocidade, preço ou aceitação contextual como “pode ser esse”. Salve o plano e o valor corretos. Havendo ambiguidade, esclareça somente a diferença necessária. Perguntar o preço não é confirmar a compra.
Somente depois da escolha do plano, peça rua, número ou quadra/lote, complemento e bairro que ainda faltarem. Reutilize cidade, estado, CEP e os dados já encontrados. Não inicie perguntas cadastrais antes das ofertas e da escolha do plano.

CADASTRO
Avise que vai iniciar o cadastro. Colete, nesta ordem, apenas o que ainda falta: nome completo; CPF do titular; data de nascimento; nome completo da mãe; e-mail; confirmação do endereço conhecido; telefone de contato; vencimento da fatura; forma de pagamento (boleto ou débito em conta). Em contratação PJ, registre também o CNPJ e os dados do responsável.
Confira os dígitos do CPF sem criar um ciclo de recusas. Aceite nascimento com espaços, pontos, barras, ano curto ou mês por extenso e normalize ao salvar. Não invente partes de dados pessoais. Se o cliente disser “esse mesmo”, “esse aqui” ou equivalente na pergunta do telefone, use o WhatsApp de origem. Preserve dados antecipados e junte mensagens consecutivas.

CONFIRMAÇÃO DO PEDIDO
Apresente um resumo organizado com emojis, plano e mensalidade, nome, CPF/CNPJ, nascimento, mãe, e-mail, endereço completo, telefone, vencimento e pagamento. Pergunte se está tudo certo. Reconheça qualquer confirmação positiva no contexto, como “sim”, “ok”, “tudo certo”, “beleza” e “pode seguir”. Se corrigirem um dado, salve a correção e apresente o resumo atualizado para nova confirmação.

DOCUMENTOS
Após a confirmação, peça RG frente, RG verso e comprovante de endereço. Uma foto do RG aberto mostrando as duas faces atende frente e verso. Qualquer foto, documento, contrato, conta, correspondência ou PDF com o endereço ou trecho identificável pode atender o comprovante. Não peça novamente arquivo já recebido.
Salve os originais antes da leitura. Leitura inconclusiva é pendência de conferência, não documento inválido. Não afirme autenticidade ou identidade aprovada. Se o cliente não tiver comprovante, continue com a observação “Cliente não tem comprovante de endereço”.

CONCLUSÃO E ACOMPANHAMENTO
Concluída a coleta e a confirmação, cadastre automaticamente a venda no CRM com o plano, preço, dados, originais e observações. Após o cadastro, encaminhe a venda e os arquivos pelo remetente e destinatário configurados no BKO, conforme o bloco de conclusão. Em falhas de conexão, preserve a venda e retome as partes pendentes sem duplicar o pedido. Só informe envio confirmado quando houver recibo do WhatsApp.

DÚVIDAS E OBJEÇÕES
Em qualquer etapa, responda à dúvida ou objeção com informações reais das ofertas e retome a coleta pendente. Para preço alto, explique a opção mais econômica e seus benefícios reais. Não repita todo o catálogo como resposta automática. Respeite um pedido claro de parar ou encerrar. Nunca mostre IDs, nomes de variáveis ou mensagens técnicas ao cliente.`;
function conclusaoUniversalInicial() {
    return { crm: true, whatsapp: true, status_inicial: 'AGUARDANDO AUDITORIA' };
}
exports.PERFIS_UNIVERSAIS = {
    telecom: { nome: 'Telecom', objetivo: 'Consultar cobertura e oferecer os planos disponíveis para o endereço.', campos: ['CEP', 'Endereço de instalação', 'Tipo de contratação', 'Plano escolhido'], documentos: ['Identidade', 'Comprovante de endereço'], acoes: ['Consultar cobertura', 'Consultar catálogo', 'Registrar pedido'] },
    servicos: { nome: 'Serviços', objetivo: 'Entender a necessidade, explicar o escopo e preparar um orçamento.', campos: ['Serviço desejado', 'Local', 'Prazo desejado'], documentos: ['Anexos do serviço'], acoes: ['Consultar serviços', 'Preparar orçamento'] },
    roupas: { nome: 'Roupas e varejo', objetivo: 'Ajudar a escolher produtos conforme preferência e estoque real.', campos: ['Produto', 'Tamanho', 'Cor', 'Quantidade', 'Entrega ou retirada'], documentos: [], acoes: ['Consultar estoque', 'Consultar frete', 'Registrar pedido'] },
    correspondente: { nome: 'Correspondente bancário', objetivo: 'Identificar a demanda e encaminhar uma proposta para análise da instituição.', campos: ['Produto financeiro', 'Nome', 'CPF', 'Contato'], documentos: ['Identidade', 'Comprovantes solicitados pela instituição'], acoes: ['Consultar produtos', 'Solicitar simulação', 'Encaminhar proposta'] },
    prestamista: { nome: 'Seguro prestamista', objetivo: 'Esclarecer a solicitação e reunir os dados da apólice para análise.', campos: ['Tipo de solicitação', 'Instituição', 'Número da apólice', 'Titular'], documentos: ['Apólice', 'Identidade', 'Documentos da solicitação'], acoes: ['Consultar solicitação', 'Encaminhar para análise'] },
    consignado: { nome: 'Crédito consignado', objetivo: 'Entender a modalidade desejada e apresentar somente simulações retornadas pela instituição.', campos: ['Modalidade', 'Convênio', 'Nome', 'CPF', 'Contato'], documentos: ['Identidade', 'Comprovante de benefício ou renda'], acoes: ['Consultar elegibilidade', 'Solicitar simulação', 'Encaminhar proposta'] },
    barbearia: { nome: 'Barbearia', objetivo: 'Ajudar a escolher o serviço e um horário disponível.', campos: ['Serviço', 'Profissional preferido', 'Data', 'Horário', 'Nome', 'Contato'], documentos: [], acoes: ['Consultar serviços', 'Consultar agenda', 'Reservar horário'] },
};
function perfilUniversal(valor) {
    return typeof valor === 'string' && Object.hasOwn(exports.PERFIS_UNIVERSAIS, valor) ? exports.PERFIS_UNIVERSAIS[valor] : null;
}
function assistenteUniversalInicial() {
    return { versao: 1, nome: '', empresa: '', papel: 'vendas', tom: 'acolhedor', apresentacao: '', regras: '', documentos: { receber: true, leitura: 'extrair_sem_rejeitar', inconclusivo: 'conferencia_humana' }, confirmarAntesDeExecutar: true };
}
function nichoUniversalInicial() { return { versao: 1, nicho: '', objetivo: '', campos: [], fontes: '', regras: '', prompt: '' }; }
function configurarNicho(valor) {
    const perfil = perfilUniversal(valor);
    return { ...nichoUniversalInicial(), nicho: perfil ? valor : '', objetivo: perfil?.objetivo || '', campos: perfil ? [...perfil.campos] : [], prompt: valor === 'telecom' ? exports.PROMPT_TELECOM_NIO : '' };
}
function validarEstruturaUniversal(nos, arestas) {
    const problemas = [];
    for (const no of nos.filter(n => n.tipo === 'assistente_universal')) {
        const destinos = arestas.filter(a => a.de === no.id && a.saidaIndex === 0).map(a => nos.find(n => n.id === a.para));
        if (destinos.length !== 1 || destinos[0]?.tipo !== 'nicho_atendimento')
            problemas.push('Conecte o assistente a um único bloco Nicho de atendimento.');
        else if (!perfilUniversal(destinos[0].dados.nicho))
            problemas.push('Escolha um nicho válido para o assistente.');
        if (no.dados.runtime === 'universal-v1' && destinos.length === 1 && destinos[0]?.tipo === 'nicho_atendimento') {
            const finais = arestas.filter(a => a.de === destinos[0].id && a.saidaIndex === 0).map(a => nos.find(n => n.id === a.para));
            if (finais.length !== 1 || finais[0]?.tipo !== 'concluir_venda_universal')
                problemas.push('Conecte o nicho ao bloco Concluir venda · CRM + WhatsApp.');
        }
        if (!String(no.dados.nome || '').trim() || !String(no.dados.empresa || '').trim())
            problemas.push('Informe o nome do assistente e a empresa.');
    }
    for (const no of nos.filter(n => n.tipo === 'nicho_atendimento'))
        if (!arestas.some(a => a.para === no.id && nos.some(n => n.id === a.de && n.tipo === 'assistente_universal')))
            problemas.push('O bloco Nicho de atendimento precisa receber a conexão de um assistente.');
    for (const no of nos.filter(n => n.tipo === 'concluir_venda_universal')) {
        if (no.dados.whatsapp === true && no.dados.crm === false)
            problemas.push('Ative o cadastro no CRM antes do encaminhamento pelo WhatsApp.');
        if (!arestas.some(a => a.para === no.id && nos.some(n => n.id === a.de && n.tipo === 'nicho_atendimento')))
            problemas.push('Conecte a conclusão da venda ao nicho de atendimento.');
    }
    return [...new Set(problemas)];
}
function universalExecutavel(nos, arestas, workspace) {
    const assistentes = nos.filter(n => n.tipo === 'assistente_universal');
    return workspace === 'grupoprime' && assistentes.length === 1 && assistentes[0].dados.runtime === 'universal-v1'
        && validarEstruturaUniversal(nos, arestas).length === 0
        && nos.filter(n => n.tipo === 'nicho_atendimento').length === 1
        && nos.find(n => n.tipo === 'nicho_atendimento')?.dados.nicho === 'telecom';
}
