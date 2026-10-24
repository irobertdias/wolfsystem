'use strict';
const { normalizar, ufSigla, interpretarEndereco, parte } = require('./vtal.cjs');
const { createHash } = require('node:crypto');
const { incorporar } = require('./documentos.cjs');
const {dadosDaMidia}=require('./endereco-midia.cjs');
const {localidadeDaBase}=require('./descoberta-vtal.cjs');
const CAMPOS = ['nome', 'cpf', 'data_nascimento', 'nome_mae', 'email', 'telefone1', 'vencimento', 'forma_pagamento'];
const rotulos = { nome: 'seu nome completo', cpf: 'o CPF do titular', data_nascimento: 'sua data de nascimento', nome_mae: 'o nome completo da sua mãe', email: 'seu e-mail', telefone1: 'um telefone para contato. Pode ser este mesmo WhatsApp', vencimento: 'o dia de vencimento que prefere para a fatura', forma_pagamento: 'a forma de pagamento: boleto ou débito em conta' };
const positivo = t => /^(SIM|S|OK|TUDO OK|TUDO CERTO|TUDO CORRETO|ESTA CERTO|TA CERTO|CERTO|CORRETO|BELEZA|BLZ|CONFIRMO|CONFIRMADO|PODE SEGUIR|PODE CONTINUAR|PODE MANDAR|PODE ENVIAR|ISSO|ISSO MESMO|PERFEITO|NAO,? (?:ESTA |TA )?TUDO CERTO)[.!\s]*$/.test(normalizar(t));
const limpo = t => String(t ?? '').replace(/[\u0000-\u001f*_~`]/g, ' ').replace(/\s+/g, ' ').trim();
function cpfValido(v) { const n = String(v || '').replace(/\D/g, ''); if (!/^\d{11}$/.test(n) || /^(\d)\1+$/.test(n))
    return false; for (let i = 9; i < 11; i++) {
    let s = 0;
    for (let j = 0; j < i; j++)
        s += +n[j] * (i + 1 - j);
    let d = (s * 10) % 11;
    if (d === 10)
        d = 0;
    if (d !== +n[i])
        return false;
} return true; }
function dataBR(v, hoje = new Date()) {
    let t = normalizar(v).replace(/\bDE\b/g, ' ').trim();
    const meses = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    meses.forEach((m, i) => { t = t.replace(new RegExp('\\b' + m + '\\b'), String(i + 1)); });
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), a, mes, d;
    if (m) {
        [, a, mes, d] = m;
    }
    else {
        m = t.match(/^(\d{1,2})[ ./-]+(\d{1,2})[ ./-]+(\d{2}|\d{4})$/) || t.match(/^(\d{2})(\d{2})(\d{4}|\d{2})$/);
        if (!m)
            return '';
        [, d, mes, a] = m;
        if (a.length === 2)
            a = String((+a <= hoje.getUTCFullYear() % 100 ? 2000 : 1900) + (+a));
    }
    const dt = new Date(Date.UTC(+a, +mes - 1, +d));
    if (dt.getUTCFullYear() !== +a || dt.getUTCMonth() !== +mes - 1 || dt.getUTCDate() !== +d || dt > hoje || +a < 1900)
        return '';
    return `${String(d).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${a}`;
}
function inicial() { return { versao: 1, dados: {}, documentos: { rg_frente: [], rg_verso: [], comprovante_endereco: [] }, anexos: [], pendencias: [], historico: [], etapa: 'localidade', apresentou: false, confirmado: false, enderecoConfirmado: false, tentativas: {} }; }
function hashResumo(s) { return createHash('sha256').update(JSON.stringify({ dados: s.dados, plano: s.plano })).digest('hex'); }
function listaPlanos(s, catalogo) { if (!s.dados.cidade || !s.dados.estado)
    return []; const c = catalogo(s.dados.estado, s.dados.cidade); return s.dados.tipo_pessoa === 'PJ' ? c.pessoa_juridica : s.dados.tipo_pessoa === 'PF' ? c.pessoa_fisica : [...c.pessoa_fisica, ...c.pessoa_juridica]; }
function escolherPlano(texto, planos) {
    const t = normalizar(texto);
    let candidatos = [];
    if (/(?:MAIS BARATO|MAIS EM CONTA|MENOR PRECO)/.test(t) && /(QUERO|PODE SER|ESCOLHO|VOU)/.test(t)) {
        const min = Math.min(...planos.map(p => p.mensalidade));
        return planos.find(p => p.mensalidade === min) || null;
    }
    const valor = t.match(/(?:R\$\s*)?(\d{2,3})(?:[,.](\d{2}))?\b/);
    if (valor) {
        const preco = Number(valor[1] + '.' + (valor[2] || '0'));
        candidatos = planos.filter(p => p.mensalidade === preco || p.mensalidade_cartao === preco);
        if (candidatos.length === 1) {
            const p = candidatos[0];
            return p.mensalidade === preco ? p : { ...p, mensalidade_padrao: p.mensalidade, mensalidade: preco, condicao_preco: 'Cartão de crédito' };
        }
    }
    const opcao = t.match(/^(?:(?:OPCAO|PLANO|NUMERO|O|QUERO O)\s*)?([1-9])[.!\s]*$/);
    if (opcao)
        return planos[+opcao[1] - 1] || null;
    candidatos = planos.filter(p => t.includes(normalizar(p.nome)));
    if (candidatos.length === 1)
        return candidatos[0];
    const velocidade = t.match(/\b(\d{3,4})\s*(?:MEGA|MBPS)|\b1\s*GIGA/);
    if (velocidade) {
        candidatos = planos.filter(p => p.velocidade_mbps === (velocidade[1] ? +velocidade[1] : 1000));
        if (candidatos.length === 1)
            return candidatos[0];
    }
    return null;
}
function ofertas(s, catalogo) { const planos = listaPlanos(s, catalogo); s.ofertas = planos.map(p => p.id); s.etapa = 'plano'; return `Maravilha! Temos disponibilidade para esse endereço. ✅ A instalação será confirmada tecnicamente pela operadora.\n\n${planos.map((p, i) => `${i + 1}️⃣ *${p.nome} · ${p.velocidade_mbps === 1000 ? '1 Giga' : p.velocidade_mbps + ' Mega'}*\n💰 R$ ${p.mensalidade.toFixed(2).replace('.', ',')}/mês${p.mensalidade_cartao ? '\n💳 R$ ' + p.mensalidade_cartao.toFixed(2).replace('.', ',') + ' no cartão' : ''}`).join('\n\n')}\n\nQual combina mais com você? Pode me dizer pelo nome, velocidade, valor ou número. 😊`; }
function resumo(s) { const d = s.dados; return ['📋 *Confira seu pedido*', '', `📦 *Plano:* ${limpo(s.plano.nome)} · ${s.plano.velocidade_mbps} Mega`, `💰 *Mensalidade:* R$ ${s.plano.mensalidade.toFixed(2).replace('.', ',')}`, `👤 *Nome:* ${limpo(d.nome)}`, `🪪 *CPF:* ${limpo(d.cpf)}`, d.cnpj ? `🏢 *CNPJ:* ${limpo(d.cnpj)}` : '', `🎂 *Nascimento:* ${limpo(d.data_nascimento)}`, `👩 *Nome da mãe:* ${limpo(d.nome_mae)}`, `✉️ *E-mail:* ${limpo(d.email)}`, `📍 *Endereço:* ${limpo(d.endereco)} · ${limpo(d.cidade)}/${limpo(d.estado)} · CEP ${limpo(d.cep)}`, `📱 *Contato:* ${limpo(d.telefone1)}`, `📅 *Vencimento:* dia ${limpo(d.vencimento)}`, `💳 *Pagamento:* ${limpo(d.forma_pagamento)}`, '', 'Está tudo certo? Pode confirmar com suas palavras ou me dizer o que deseja corrigir. 😊'].filter(Boolean).join('\n'); }
async function avancar({ estado, entrada, numero, extrair, consultar, catalogo, anexos = [], config = {} }) {
    const s = structuredClone(estado || inicial()), d = s.dados, texto = String(entrada || '').slice(0, 12000);
    const ponto=/\[Localização enviada: latitude (-?[\d.]+), longitude (-?[\d.]+)\]/.exec(texto);
    if(ponto)s.localizacao={latitude:Number(ponto[1]),longitude:Number(ponto[2])};
    if(/^(?:ESPERA|ESPELA|ESPERE|AGUARDA|AGUARDE|SO UM (?:MINUTO|MOMENTO)|PERA(?: AI)?)[.!\s]*$/.test(normalizar(texto))){
        const mensagem='Claro, vou aguardar você enviar. As informações que já passou estão salvas. 😊';
        s.historico=[...s.historico,{role:'user',content:texto},{role:'assistant',content:mensagem}].slice(-40);
        return {estado:s,mensagem};
    }
    let aviso = '';
    const midia=dadosDaMidia(anexos,d);
    if(midia.enderecos.length)s.enderecosMidia=midia.enderecos;
    const analise = texto.trim() ? await extrair({ estado: s, texto, numero, anexos, config }) : {};
    const novos = {...midia.dados,...analise.dados};
    // Uma correção explícita da fachada vale também depois da pergunta CPF/CNPJ.
    if(d.cep&&/^(?:CASA\s+)?NUMERO\s+\d{1,6}[A-Z]?[.! ]*$/.test(normalizar(texto))){const n=interpretarEndereco(texto).numero;if(n){novos.numero=n;if(novos.casa===n)delete novos.casa;if(d.numero!==n){delete d.endereco;s.enderecoConfirmado=false;}}}
    const {novoEndereco,semDisponibilidade}=require('./disponibilidade-retentativa.cjs');
    const aguardavaOutro=s.etapa==='outro_endereco';
    const recebeuOutro=novoEndereco(s,novos,interpretarEndereco(texto));
    if (s.etapa === 'complemento' && s.consulta?.status === 'confirmar_logradouro') {
        const sugestoes = s.consulta.sugestoes || [];
        const opcao = /^\s*([1-3])\s*$/.exec(texto);
        const escolhida = opcao ? sugestoes[+opcao[1]-1] : (positivo(texto) || analise.confirmacao === true) && sugestoes.length === 1 ? sugestoes[0] : null;
        if (escolhida) novos.logradouro = escolhida.logradouro;
    }
    if (s.etapa === 'complemento' && s.consulta?.status === 'endereco_ambiguo') {
        const opcao = /^\s*(?:op[cç][aã]o\s*)?(\d{1,2})\s*$/i.exec(texto);
        const unidade = opcao && s.consulta.resultados?.[+opcao[1]-1];
        if (unidade) {
            delete s.consultaChave;
            novos.logradouro = unidade.logradouro;
            novos.numero = unidade.numero;
            for (const k of ['quadra','lote','casa','apartamento','bloco']) {
                const valor = parte([unidade.logradouro, unidade.complemento1, unidade.complemento2, unidade.complemento3].join(' '), k);
                if (valor) novos[k] = valor;
            }
        }
    }
    if (['nome', 'nome_mae'].includes(s.etapa) && !analise.pergunta && !analise.objecao && !analise.encerrar) {
        const candidato = texto.trim();
        if (/^[\p{L}][\p{L} .'-]{3,150}$/u.test(candidato) && candidato.split(/\s+/).length >= 2 && !/\b(?:NAO|SIM|QUERO|TENHO|SEI|CANCELAR|DESISTIR|CARO|CERTO|CORRETO|OK|BELEZA)\b/.test(normalizar(candidato))) {
            novos[s.etapa] = candidato;
            const outro = s.etapa === 'nome' ? 'nome_mae' : 'nome';
            if (normalizar(novos[outro]) === normalizar(candidato)) delete novos[outro];
        }
    }
    // Respostas curtas pertencem ao dado pendente. A normalização não depende
    // de o modelo repetir um campo trivial na saída estruturada.
    const t = normalizar(texto), digits = texto.replace(/\D/g, '');
    if (s.etapa === 'cpf' && /^\d{11}$/.test(digits))
        novos.cpf = digits;
    if (s.etapa === 'data_nascimento' && dataBR(texto))
        novos.data_nascimento = dataBR(texto);
    if (s.etapa === 'email') {
        const e = texto.match(/[^\s<>]+@[^\s<>]+\.[^\s<>.,;]+/);
        if (e)
            novos.email = e[0];
    }
    if (s.etapa === 'vencimento') {
        const v = t.match(/^(?:DIA\s*)?(\d{1,2})[.!\s]*$/);
        if (v && +v[1] > 0 && +v[1] <= 31)
            novos.vencimento = String(+v[1]);
    }
    if (s.etapa === 'forma_pagamento') {
        if (/\bBOLETO\b/.test(t))
            novos.forma_pagamento = 'Boleto';
        else if (/\bDEBITO\b/.test(t))
            novos.forma_pagamento = 'Débito em conta';
        else if (/\bCARTAO|CREDITO\b/.test(t))
            novos.forma_pagamento = 'Cartão de crédito';
    }
    if (s.etapa === 'telefone1' && /^\d{10,13}$/.test(digits) && !/[A-Za-z]/.test(texto))
        novos.telefone1 = digits;
    for (const k of ['cidade', 'estado', 'cep', 'logradouro', 'quadra', 'lote', 'casa', 'apartamento', 'bloco', 'numero', 'bairro', 'endereco', ...CAMPOS, 'cnpj']) {
        if (typeof novos[k] !== 'string' || !novos[k].trim() || novos[k].length > 500)
            continue;
        const valor = novos[k].trim();
        if(k==='cep'&&!/^\d{8}$/.test(valor.replace(/\D/g,'')))continue;
        if (['cidade', 'estado', 'cep', 'logradouro', 'quadra', 'lote', 'casa', 'apartamento', 'bloco', 'numero'].includes(k) && valor !== d[k]) {
            delete s.consulta;
            delete s.consultaChave;
        }
        if (normalizar(d[k]) !== normalizar(valor)) {
            d[k] = valor;
            s.confirmado = false;
            if (['endereco', 'bairro', 'cidade', 'estado', 'cep'].includes(k)) s.enderecoConfirmado = false;
        }
    }
    if (['localidade', 'cep', 'complemento', 'endereco'].includes(s.etapa)) {
        const parsed = {};
        for (const linha of texto.split(/\r?\n/)) for (const [k,v] of Object.entries(interpretarEndereco(linha))) if (v) parsed[k]=v;
        for (const [k, v] of Object.entries(parsed))
            if (v && (!d[k] || s.etapa === 'complemento') && !novos[k]) {
                d[k] = v;
                delete s.consultaChave;
            }
        if (parsed.logradouro)
            s.enderecoInformado = true;
    }
    if (novos.tipo_pessoa === 'PF' || novos.tipo_pessoa === 'PJ') {
        if (d.tipo_pessoa !== novos.tipo_pessoa) {
            delete s.plano;
            s.confirmado = false;
        }
        d.tipo_pessoa = novos.tipo_pessoa;
    }
    if (/^(CPF|PESSOA FISICA|FISICA|PF)[.!\s]*$/.test(normalizar(texto)))
        d.tipo_pessoa = 'PF';
    if (/^(CNPJ|PESSOA JURIDICA|JURIDICA|PJ)[.!\s]*$/.test(normalizar(texto)))
        d.tipo_pessoa = 'PJ';
    if (d.cep) {
        d.cep=d.cep.replace(/\D/g,'');
        if(!/^\d{8}$/.test(d.cep)&&d.logradouro){s.cepInvalidoInformado=d.cep;delete d.cep;}
    }
    for(const k of ['casa','apartamento','lote','quadra','bloco'])if(d[k]&&!/^(?:\d+[A-Z]?|[A-Z])$/.test(normalizar(d[k])))delete d[k];
    if(d.cidade&&!d.estado){const l=localidadeDaBase(d.cidade);if(l)d.estado=l.estado;}
    if (d.estado)
        d.estado = ufSigla(d.estado);
    if (d.cpf)
        d.cpf = d.cpf.replace(/\D/g, '');
    if (d.data_nascimento) {
        const n = dataBR(d.data_nascimento);
        if (n)
            d.data_nascimento = n;
        else
            s.pendencias.push('Conferir nascimento informado: ' + d.data_nascimento);
    }
    if ((s.etapa === 'telefone1' && (/\b(?:ESSE|ESTE|MESMO|AQUI)\b/.test(normalizar(texto)) || positivo(texto) || analise.usar_whatsapp === true)) || (analise.usar_whatsapp === true && /\b(?:TELEFONE|CONTATO|WHATSAPP|NUMERO)\b/.test(normalizar(texto))))
        d.telefone1 = String(numero).replace(/\D/g, '');
    if (d.telefone1) {
        d.telefone1 = d.telefone1.replace(/\D/g, '');
        const origem = String(numero).replace(/\D/g, '');
        if (d.telefone1.length >= 8 && d.telefone1.length < 10 && origem.endsWith(d.telefone1))
            d.telefone1 = origem;
        if (d.telefone1.length === 10 || d.telefone1.length === 11)
            d.telefone1 = '55' + d.telefone1;
    }
    s.pendencias = [...new Set(s.pendencias)];
    for (const a of anexos) incorporar(s, a);
    if (analise.sem_comprovante && !analise.recusa_documentos && !require('./objecao-documentos.cjs').recusaDocumento(texto)) {
        s.semComprovante = true;
        s.pendencias.push('Cliente não tem comprovante de endereço.');
    }
    const responder = (mensagem, acao, tipo) => {
        if(!tipo && !acao && s.etapa!=='plano' && !['localidade_divergente','cep_necessario','consulta_inconclusiva','confirmar_logradouro','endereco_ambiguo','logradouro_nao_localizado','endereco_nao_localizado','complemento_necessario'].includes(s.consulta?.status) && s.historico.some(h=>h.role==='assistant'&&normalizar(h.content)===normalizar(mensagem))) {
            const falta=rotulos[s.etapa]||({cep:'o CEP com oito dígitos',localidade:'a cidade e o estado da instalação',tipo_pessoa:'se a contratação será no CPF ou no CNPJ',complemento:'o dado que diferencia seu imóvel: número, quadra/lote ou casa',documentos:!s.documentos.rg_frente.length?'o arquivo da frente do RG':!s.documentos.rg_verso.length?'o verso do RG':'o comprovante ou a informação de que você não possui um',confirmar_endereco:'a confirmação ou correção do endereço apresentado',confirmacao:'a confirmação do resumo ou o dado que precisa corrigir',plano:'qual das ofertas você prefere',endereco:'a rua, o número ou complemento e o bairro'})[s.etapa];
            if(falta) {
                const formas=[`Vamos continuar de onde paramos. Só falta confirmar ${falta}?`,`Para eu não interpretar errado, pode esclarecer ${falta}?`,`Já aproveitei o que você informou. Pode me dizer ${falta}?`,`O próximo passo é confirmar ${falta}. Pode me ajudar com essa informação?`];
                mensagem=formas.find(m=>!s.historico.some(h=>h.role==='assistant'&&normalizar(h.content)===normalizar(m)))||formas[(s.tentativas['resposta_'+s.etapa]||0)%formas.length];
            }
            s.tentativas['resposta_'+s.etapa]=(s.tentativas['resposta_'+s.etapa]||0)+1;
        }
        if(texto.trim())s.historico = [...s.historico, { role: 'user', content: texto }, { role: 'assistant', content: mensagem }].slice(-40); return { estado: s, mensagem, acao, inviavel:s.etapa==='outro_endereco'||s.encerramentoInviavel===true, historicoProposto:!!texto.trim(), tipo: tipo || (s.etapa==='plano' && mensagem.includes('💰 R$')?'ofertas':undefined) };
    };
    // Recusar o envio de documento não significa cancelar a contratação.
    let documentosEncaminhar=false;
    if(s.etapa==='documentos'){
        const contorno=require('./objecao-documentos.cjs').tratar(s,texto,[{variavel:'rg_frente',rotulo:'RG frente'},{variavel:'rg_verso',rotulo:'RG verso'},{variavel:'comprovante_endereco',rotulo:'comprovante de endereço'}],analise.recusa_documentos===true);
        if(contorno?.mensagem)return responder(contorno.mensagem,undefined,contorno.tipo);
        if(contorno?.seguir){documentosEncaminhar=true;analise.encerrar=false;analise.resposta_contextual='';aviso='';}
    }
    if(aguardavaOutro&&!recebeuOutro){
        if(analise.encerrar===true||/^(?:NAO|NAO TENHO|NAO POSSUO|SO ESSE|SOMENTE ESSE|PODE (?:ENCERRAR|FINALIZAR))[.! ]*$/.test(normalizar(texto))){s.etapa='encerrado';s.encerramentoInviavel=true;return responder('Tudo bem. Como não há disponibilidade nesse endereço, vou finalizar o atendimento. Obrigado pelo interesse! 💚','encerrar');}
        return require('./disponibilidade-retentativa.cjs').esclarecerOuEncerrar(s,texto,responder);
    }
    if(!documentosEncaminhar){
        const retencao=require('./retencao-venda.cjs').tratar(s,texto,analise.encerrar===true);
        if(retencao?.mensagem)return responder(retencao.mensagem,undefined,retencao.tipo);
        if(retencao?.encerrar)analise.encerrar=true;
    }
    if (analise.encerrar === true) {
        s.etapa = 'encerrado';
        return responder('Entendido. Vou encerrar o atendimento por aqui. Se precisar, estamos à disposição.', 'encerrar');
    }
    if (s.etapa === 'concluido')
        return responder('Seu pedido já está registrado. A equipe vai acompanhar a análise e a confirmação da instalação.');
    if (analise.objecao || analise.pergunta) {
        aviso = String(analise.resposta_contextual || '').slice(0, 1000);
        // A resposta consultiva não pode fazer perguntas de outra etapa ou
        // oferecer catálogo antes da consulta. O motor decide a próxima ação.
        if (/\?|\b(?:CPF|CNPJ)\b/i.test(aviso) || (!s.plano && s.consulta?.status !== 'disponivel_na_base' && /R\$|\b\d+\s*(?:MBPS|MEGA|GIGA)\b/i.test(aviso))) aviso = '';
        const atual=normalizar(texto).replace(/[^A-Z0-9 ]/g,' ');
        if (/\b(?:VALOR|VALORES|VALO|PRECO|PRECOS|CUSTA)\b/.test(atual)) aviso='';
    }
    const finalizarMensagem = msg => responder([aviso, msg].filter(Boolean).join('\n\n'));
    if (!s.apresentou) {
        s.apresentou = true;
        aviso = (config.apresentacao || `Olá! Seja bem-vindo(a) à *${limpo(config.empresa || 'Grupo Prime')}*! 💚\nSou ${limpo(config.nome || 'a assistente virtual de vendas')}, da equipe parceira Nio. Vou ajudar você a encontrar um plano e acompanhar seu pedido. 😊`) + (aviso ? '\n\n' + aviso : '');
    }
    if (!d.cidade || !d.estado) {
        s.etapa = 'localidade';
        return finalizarMensagem(d.cidade?`Em qual estado fica ${limpo(d.cidade)}?`:d.estado?`Em qual cidade de ${limpo(d.estado)} será a instalação?`:'Para começar, em qual cidade e estado será a instalação?');
    }
    if (!d.cep && !d.logradouro) {
        s.etapa = 'cep';
        if(midia.enderecos.some(e=>e.papel==='emitente'&&e.dados?.cep))return finalizarMensagem('Li a imagem, mas o CEP visível está no endereço da empresa que emitiu o documento. Pode enviar a parte com o endereço do cliente ou da unidade consumidora? Assim consulto o local certo para a instalação.');
        if(anexos.length)return finalizarMensagem('Recebi e salvei o arquivo. Não consegui ler nele o CEP do endereço de instalação. Pode enviar uma foto mais próxima dessa parte ou escrever só o CEP?');
        return finalizarMensagem('Qual é o CEP do endereço de instalação?');
    }
    const chave = JSON.stringify(Object.fromEntries(['cidade', 'estado', 'cep', 'logradouro', 'quadra', 'lote', 'numero', 'casa', 'apartamento', 'bloco'].map(k => [k, d[k] || ''])));
    if (s.consultaChave !== chave) {
        s.consulta = await consultar({ ...d, uf: d.estado });
        s.consultaChave = chave;
    }
    const c = s.consulta;
    if(c.cepCorrigido&&c.cepCorrigido===d.cep&&c.status!=='localidade_divergente'){s.cepDescartadoPorLocalidade=d.cep;delete d.cep;}
    if (c.status === 'complemento_necessario') {
        s.etapa = 'complemento';
        if(c.cep)d.cep=c.cep;
        if(c.cidade)d.cidade=c.cidade;
        if(c.uf)d.estado=c.uf;
        if((c.logradouros||[]).length===1&&!d.logradouro)d.logradouro=c.logradouros[0];
        if(c.bairro&&!d.bairro)d.bairro=c.bairro;
        const falta=d.quadra&&!d.lote?'qual é o lote da quadra '+limpo(d.quadra):'qual é o número do imóvel ou a quadra e o lote';
        const encontrado=d.logradouro?limpo(d.logradouro)+' em '+limpo(d.cidade)+'/'+limpo(d.estado):d.cep?'o CEP '+limpo(d.cep):'a rua na base';
        return finalizarMensagem(`Localizei ${encontrado}. 😊 Para consultar o imóvel, ${falta}? Se houver casa ou apartamento, pode enviar junto.`);
    }
    if (c.status === 'sem_disponibilidade_na_base' || (c.status === 'nao_localizado' && c.cep)) {
        return semDisponibilidade(s,responder);
    }
    if (c.status !== 'disponivel_na_base') {
        s.etapa = 'complemento';
        s.consultaChave = null;
        if (c.status === 'consulta_inconclusiva')
            return finalizarMensagem('A consulta está temporariamente indisponível. Preservei seus dados e vou tentar novamente; você não precisa reenviar o que já informou.');
        if (['cep_necessario', 'cep_incompleto'].includes(c.status) || (c.status === 'nao_localizado' && !d.cep)) {
            s.etapa = 'cep';
            return finalizarMensagem('Pode me informar o CEP completo, com oito dígitos, para localizar esse endereço?');
        }
        if (c.status === 'localidade_divergente') {
            const emitente=(s.enderecosMidia||[]).some(e=>e.papel==='emitente'&&e.dados?.cep===d.cep);
            const salvo=[d.logradouro,d.numero,d.quadra?'quadra '+d.quadra:'',d.bairro].filter(Boolean).map(limpo).join(', ');
            return finalizarMensagem(`${ponto?'Recebi e salvei sua localização. ':''}${emitente?'Li a foto: esse CEP aparece no endereço da empresa que emitiu a conta. ':''}O CEP ${limpo(d.cep)} corresponde a ${(c.localidades||[]).map(limpo).join(', ')||'outra cidade'}, mas a instalação foi informada em ${limpo(d.cidade)}/${limpo(d.estado)}.${salvo?' Já guardei: '+salvo+'.':''} Pode enviar a parte da conta com o endereço da unidade consumidora, ou confirmar o CEP da instalação?`);
        }
        if(c.status==='logradouro_nao_localizado')return finalizarMensagem(`Não encontrei o nome “${limpo(d.logradouro)}” em ${limpo(d.cidade)}/${limpo(d.estado)}. Pode conferir somente o nome da rua? O número e os outros dados que já enviou estão salvos.`);
        if(c.status==='endereco_nao_localizado'){
            const rua=(c.logradouros||[]).length===1?c.logradouros[0]:d.logradouro;
            if(c.bairro&&normalizar(d.logradouro)===normalizar(c.bairro)&&rua){d.bairro=d.bairro||d.logradouro;d.logradouro=rua;}
            const chaveAusente=JSON.stringify(Object.fromEntries(['cidade','estado','cep','logradouro','quadra','lote','numero','casa','apartamento','bloco'].map(k=>[k,d[k]||''])));
            const endereco=[rua,d.numero?'nº '+d.numero:d.casa?'casa '+d.casa:'',d.quadra?'quadra '+d.quadra:'',d.lote?'lote '+d.lote:'',c.bairro||d.bairro].filter(Boolean).map(limpo).join(', ');
            if(s.enderecoAusenteConfirmacao===chaveAusente&&(positivo(texto)||analise.confirmacao===true)){
                return semDisponibilidade(s,responder);
            }
            s.enderecoAusenteConfirmacao=chaveAusente;
            return finalizarMensagem(`Já conferi ${endereco||'os dados enviados'}. Esse imóvel não foi localizado na base de disponibilidade.${c.cep?' O CEP '+limpo(c.cep)+' corresponde a '+limpo(rua||'essa região')+'.':''} Confirma esse endereço ou deseja corrigir algum desses dados?`);
        }
        if (c.status === 'confirmar_logradouro') {
            const recebidos=[d.numero?'nº '+d.numero:'',d.quadra?'quadra '+d.quadra:'',d.lote?'lote '+d.lote:'',d.casa?'casa '+d.casa:''].filter(Boolean).map(limpo).join(', ');
            return finalizarMensagem('Encontrei um nome de rua parecido em '+limpo(d.cidade)+'/'+limpo(d.estado)+'. Seria este endereço?\n'+c.sugestoes.map((r,i)=>(c.sugestoes.length>1?`${i+1}. `:'')+r.logradouro).join('\n')+(recebidos?'\nJá guardei '+recebidos+'.':'')+'\nPode confirmar ou me dizer qual é o correto.');
        }
        const opcoes = c.status === 'endereco_ambiguo' ? (c.resultados || []).map(r => [r.logradouro, r.numero, r.complemento1, r.complemento2, r.complemento3].filter(Boolean).join(' ')).slice(0, 15) : [];
        return finalizarMensagem(opcoes.length ? 'Encontrei mais de uma unidade. Qual destas corresponde ao imóvel?\n' + opcoes.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'Ainda não localizei esse imóvel com segurança. Pode confirmar a rua e o número ou a quadra/lote? Vou aproveitar os outros dados que você já enviou.');
    }
    if (c.cep)
        d.cep = c.cep;
    const local = c.resultados[0];
    if(local.cidade)d.cidade=local.cidade;
    if(local.uf)d.estado=local.uf;
    if(c.operadora){d.operadora=c.operadora;d.rede=c.rede||'';d.classificacao=c.classificacao||'';}
    if(c.alternativa_vero&&c.operadora==='Nio'&&!s.alternativaVeroAvisada){aviso='Não localizei uma oferta VERO para esse endereço, mas encontrei disponibilidade da *Nio* pela rede VTAL. Posso apresentar as opções da Nio para você. 😊';s.alternativaVeroAvisada=true;}
    s.enderecoBase = local;
    if (!d.bairro && local.bairro)
        d.bairro = local.bairro;
    if(local.logradouro)d.logradouro=local.logradouro;
    if(c.enderecoInterpretado){for(const k of ['numero','casa']){if(c.enderecoInterpretado[k])d[k]=c.enderecoInterpretado[k];else if(k==='casa')delete d[k];}}
    if (local.logradouro && (d.numero||d.lote||d.casa||(local.numero&&local.numero!=='SN'))) {
        const complementos = [local.complemento1, local.complemento2, local.complemento3].filter(Boolean);
        if (d.quadra && !parte(local.logradouro, 'quadra') && !complementos.some(v => parte(v, 'quadra')))
            complementos.unshift('Quadra ' + d.quadra);
        if (d.lote && !complementos.some(v => parte(v, 'lote')))
            complementos.push('Lote ' + d.lote);
        for(const [k,rotulo]of [['casa','Casa'],['apartamento','Apartamento'],['bloco','Bloco']])if(d[k]&&!complementos.some(v=>parte(v,k)))complementos.push(rotulo+' '+d[k]);
        d.endereco = [local.logradouro, local.numero && local.numero !== 'SN' ? local.numero : '', ...complementos].filter(Boolean).join(', ');
    }
    if (!d.tipo_pessoa) {
        s.etapa = 'tipo_pessoa';
        if (/\b(?:VALOR|VALORES|VALO|PRECO|PRECOS|CUSTA)\b/.test(normalizar(texto).replace(/[^A-Z0-9 ]/g,' '))) {
            const valores=catalogo(d.estado,d.cidade);
            const pf=Math.min(...valores.pessoa_fisica.map(p=>p.mensalidade)),pj=Math.min(...valores.pessoa_juridica.map(p=>p.mensalidade));
            const precos=[Number.isFinite(pf)?`no CPF a partir de *R$ ${pf.toFixed(2).replace('.',',')}/mês*`:'',Number.isFinite(pj)?`no CNPJ a partir de *R$ ${pj.toFixed(2).replace('.',',')}/mês*`:''].filter(Boolean);
            return responder(precos.length?`Para esse endereço, temos opções ${precos.join(' e ')}.\n\nVocê vai contratar no CPF ou no CNPJ? Assim te mostro as ofertas correspondentes. 😊`:'Preciso confirmar as ofertas cadastradas para essa localidade com a equipe.');
        }
        return finalizarMensagem(config.pergunta_tipo_pessoa||'Maravilha! Temos disponibilidade para esse endereço. ✅\n\nA contratação será no *CPF ou CNPJ*? Pergunto para te enviar os preços corretos, pois as ofertas para pessoa física e jurídica são diferentes.');
    }
    const planos = listaPlanos(s, catalogo);
    if(!planos.length){s.etapa='tipo_pessoa';return finalizarMensagem('Não há ofertas configuradas para essa modalidade na localidade informada. Você gostaria de conferir a outra modalidade?');}
    if (s.plano && !planos.some(p => p.id === s.plano.id)) {
        delete s.plano;
        s.confirmado = false;
    }
    if (s.catalogoPendente || !s.ofertas?.length || !s.ofertas.every(id => planos.some(p => p.id === id)))
        return finalizarMensagem(ofertas(s, catalogo));
    // Pedidos explícitos de catálogo sempre recebem os planos disponíveis.
    if (!s.plano && /\b(?:OFERTA|OFERTAS|PLANO|PLANOS|VALOR|VALORES|PRECO|PRECOS)\b/.test(normalizar(texto)) && (analise.pergunta || /[?]|QUAIS|MOSTR|MANDA|PASSA|VER/.test(normalizar(texto))))
        return responder(ofertas(s,catalogo));
    const mudanca = planos.find(p => p.id === analise.plano_id && s.ofertas.includes(p.id));
    if (s.plano && mudanca && s.plano.id !== mudanca.id) {
        s.plano = mudanca;
        s.confirmado = false;
    }
    if (!s.plano) {
        const escolhido = (!analise.pergunta && escolherPlano(texto, planos)) || mudanca;
        if (escolhido) {
            s.plano = escolhido;
            s.confirmado = false;
        }
        else {
            if (/MAIS BARATO|MAIS EM CONTA/.test(normalizar(texto))) {
                const p = [...planos].sort((a, b) => a.mensalidade - b.mensalidade)[0];
                return finalizarMensagem(`A opção mais econômica para sua localidade é *${p.nome}*, ${p.velocidade_mbps} Mega, por *R$ ${p.mensalidade.toFixed(2).replace('.', ',')}/mês*. Quer seguir com ela?`);
            }
            s.etapa = 'plano';
            return finalizarMensagem(aviso ? 'Qual desses planos você prefere?' : ofertas(s, catalogo));
        }
    }
    if (!d.endereco || !d.bairro) {
        s.etapa = 'endereco';
        const faltas=[];if(!d.logradouro)faltas.push('o nome da rua');if(!d.numero&&!d.lote&&!d.casa)faltas.push(d.quadra?'o lote':'o número do imóvel ou quadra/lote');if(!d.bairro)faltas.push('o bairro');
        return finalizarMensagem(`Você escolheu *${s.plano.nome}*, por *R$ ${s.plano.mensalidade.toFixed(2).replace('.', ',')}/mês*. 😊\nJá tenho ${[d.logradouro,d.numero,d.quadra?'quadra '+d.quadra:'',d.lote?'lote '+d.lote:'',d.cidade+'/'+d.estado,d.cep?'CEP '+d.cep:''].filter(Boolean).map(limpo).join(', ')}. Pode informar somente ${faltas.length?faltas.join(' e '):'o complemento que falta no endereço'}?`);
    }
    if (d.tipo_pessoa === 'PJ' && !d.cnpj) {
        s.etapa = 'cnpj';
        return finalizarMensagem('Vamos iniciar o cadastro. Qual é o CNPJ da contratação? Depois vamos preencher os dados do responsável.');
    }
    for (const campo of CAMPOS) {
        if (campo === 'telefone1' && !s.enderecoConfirmado) {
            if (s.etapa === 'confirmar_endereco' && (positivo(texto) || analise.confirmacao === true) && (!novos.endereco || normalizar(novos.endereco) === normalizar(estado?.dados?.endereco)))
                s.enderecoConfirmado = true;
            else {
                s.etapa = 'confirmar_endereco';
                return finalizarMensagem(`📍 Confere o endereço de instalação?\n*${limpo(d.endereco)}, ${limpo(d.bairro)} · ${limpo(d.cidade)}/${limpo(d.estado)} · CEP ${limpo(d.cep)}*`);
            }
        }
        if (campo === 'cpf' && d.cpf && !cpfValido(d.cpf) && !s.tentativas.cpf) {
            s.tentativas.cpf = 1;
            delete d.cpf;
            s.etapa = 'cpf';
            return finalizarMensagem('O CPF não passou na conferência dos dígitos. Pode conferir o número do titular?');
        }
        if (!d[campo]) {
            s.etapa = campo;
            return finalizarMensagem((campo === 'nome' ? 'Vamos iniciar seu cadastro. ' : '') + `Pode me informar ${rotulos[campo]}?`);
        }
    }
    if (!cpfValido(d.cpf))
        s.pendencias.push('CPF informado não passou no cálculo; conferir no BKO.');
    const basePlano = planos.find(p => p.id === s.plano.id);
    if (basePlano) {
        const cartao = /CARTAO|CREDITO/.test(normalizar(d.forma_pagamento));
        const preco = cartao && basePlano.mensalidade_cartao ? basePlano.mensalidade_cartao : basePlano.mensalidade;
        if (s.plano.mensalidade !== preco) {
            s.plano = { ...basePlano, mensalidade: preco };
            s.confirmado = false;
            aviso = `Para ${limpo(d.forma_pagamento)}, a mensalidade deste plano é R$ ${preco.toFixed(2).replace('.', ',')}. Confira o valor no resumo abaixo.`;
        }
    }
    if (!s.confirmado) {
        if (s.etapa === 'confirmacao' && s.resumoHash === hashResumo(s) && (positivo(texto) || analise.confirmacao === true)) {
            s.confirmado = true;
        }
        else {
            s.etapa = 'confirmacao';
            s.resumoHash = hashResumo(s);
            return finalizarMensagem(resumo(s));
        }
    }
    s.etapa = 'documentos';
    if (!s.documentos.rg_frente.length && !s.documentosDispensados?.includes('rg_frente'))
        return finalizarMensagem('Dados confirmados! ✅ Agora envie a foto da frente do RG. Se estiver com o RG aberto mostrando os dois lados, pode mandar uma foto só.');
    if (!s.documentos.rg_verso.length && !s.documentosDispensados?.includes('rg_verso'))
        return finalizarMensagem('Recebi o arquivo. Agora pode enviar o verso do RG?');
    if (!s.documentos.comprovante_endereco.length && !s.semComprovante && !s.documentosDispensados?.includes('comprovante_endereco'))
        return finalizarMensagem('Agora envie o comprovante de endereço. Pode ser conta, contrato, correspondência, foto ou PDF com o endereço. Se não tiver, me avise que seguimos com essa observação.');
    s.etapa = 'registrar';
    return responder(s.documentosDispensados?.length?'Vou encaminhar seu pedido para análise com a documentação pendente. A equipe continuará a conferência com você. ✅':'Recebi seus dados e documentos. Vou registrar o pedido para análise e confirmação da instalação. ✅', 'registrar');
}
module.exports = { CAMPOS, inicial, avancar, cpfValido, dataBR, positivo, escolherPlano, resumo, hashResumo };
