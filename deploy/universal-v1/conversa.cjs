'use strict';
const { normalizar, ufSigla, interpretarEndereco, parte } = require('./vtal.cjs');
const { createHash } = require('node:crypto');
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
function ofertas(s, catalogo) { const planos = listaPlanos(s, catalogo); s.ofertas = planos.map(p => p.id); s.etapa = 'plano'; return `✅ Encontrei disponibilidade na base para o seu endereço. A instalação será confirmada tecnicamente pela operadora.\n\n${planos.map((p, i) => `${i + 1}️⃣ *${p.nome} · ${p.velocidade_mbps === 1000 ? '1 Giga' : p.velocidade_mbps + ' Mega'}*\n💰 R$ ${p.mensalidade.toFixed(2).replace('.', ',')}/mês${p.mensalidade_cartao ? '\n💳 R$ ' + p.mensalidade_cartao.toFixed(2).replace('.', ',') + ' no cartão' : ''}`).join('\n\n')}\n\nQual combina mais com você? Pode me dizer pelo nome, velocidade, valor ou número. 😊`; }
function resumo(s) { const d = s.dados; return ['📋 *Confira seu pedido*', '', `📦 *Plano:* ${limpo(s.plano.nome)} · ${s.plano.velocidade_mbps} Mega`, `💰 *Mensalidade:* R$ ${s.plano.mensalidade.toFixed(2).replace('.', ',')}`, `👤 *Nome:* ${limpo(d.nome)}`, `🪪 *CPF:* ${limpo(d.cpf)}`, d.cnpj ? `🏢 *CNPJ:* ${limpo(d.cnpj)}` : '', `🎂 *Nascimento:* ${limpo(d.data_nascimento)}`, `👩 *Nome da mãe:* ${limpo(d.nome_mae)}`, `✉️ *E-mail:* ${limpo(d.email)}`, `📍 *Endereço:* ${limpo(d.endereco)} · ${limpo(d.cidade)}/${limpo(d.estado)} · CEP ${limpo(d.cep)}`, `📱 *Contato:* ${limpo(d.telefone1)}`, `📅 *Vencimento:* dia ${limpo(d.vencimento)}`, `💳 *Pagamento:* ${limpo(d.forma_pagamento)}`, '', 'Está tudo certo? Pode confirmar com suas palavras ou me dizer o que deseja corrigir. 😊'].filter(Boolean).join('\n'); }
async function avancar({ estado, entrada, numero, extrair, consultar, catalogo, anexos = [], config = {} }) {
    const s = structuredClone(estado || inicial()), d = s.dados, texto = String(entrada || '').slice(0, 12000);
    let aviso = '';
    const analise = await extrair({ estado: s, texto, numero, anexos, config });
    const novos = analise.dados || {};
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
        if (['cidade', 'estado', 'cep', 'logradouro', 'quadra', 'lote', 'casa', 'apartamento', 'bloco', 'numero'].includes(k) && valor !== d[k]) {
            delete s.consulta;
            delete s.consultaChave;
        }
        if (d[k] !== valor) {
            d[k] = valor;
            s.confirmado = false;
        }
    }
    if (['localidade', 'cep', 'complemento', 'endereco'].includes(s.etapa)) {
        const parsed = interpretarEndereco(texto);
        for (const [k, v] of Object.entries(parsed))
            if (v && !d[k])
                d[k] = v;
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
    if (/^(CPF|PESSOA FISICA|PF)[.!\s]*$/.test(normalizar(texto)))
        d.tipo_pessoa = 'PF';
    if (/^(CNPJ|PESSOA JURIDICA|PJ)[.!\s]*$/.test(normalizar(texto)))
        d.tipo_pessoa = 'PJ';
    if (d.cep)
        d.cep = d.cep.replace(/\D/g, '');
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
    if ((s.etapa === 'telefone1' && (/\b(?:ESSE|ESTE|MESMO|AQUI)\b/.test(normalizar(texto)) || positivo(texto))) || analise.usar_whatsapp === true)
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
    for (const a of anexos) {
        if (s.anexos.some(x => x.path === a.path))
            continue;
        s.anexos.push(a);
        const categorias = Array.isArray(a.categorias) ? a.categorias : [];
        const destino = categorias.length ? categorias : [!s.documentos.rg_frente.length ? 'rg_frente' : !s.documentos.rg_verso.length ? 'rg_verso' : 'comprovante_endereco'];
        for (const k of destino)
            if (s.documentos[k] && !s.documentos[k].some(x => x.path === a.path))
                s.documentos[k].push(a);
        if (a.leitura === 'inconclusiva')
            s.pendencias.push('Leitura inconclusiva: ' + a.nome + '; conferir original.');
    }
    if (analise.sem_comprovante) {
        s.semComprovante = true;
        s.pendencias.push('Cliente não tem comprovante de endereço.');
    }
    const responder = (mensagem, acao) => { s.historico = [...s.historico, { role: 'user', content: texto }, { role: 'assistant', content: mensagem }].slice(-40); return { estado: s, mensagem, acao }; };
    if (analise.encerrar === true) {
        s.etapa = 'encerrado';
        return responder('Entendido. Vou encerrar o atendimento por aqui. Se precisar, estamos à disposição.', 'encerrar');
    }
    if (s.etapa === 'concluido')
        return responder('Seu pedido já está registrado. A equipe vai acompanhar a análise e a confirmação da instalação.');
    if (analise.objecao || analise.pergunta) {
        aviso = String(analise.resposta_contextual || '').slice(0, 1000);
    }
    const finalizarMensagem = msg => responder([aviso, msg].filter(Boolean).join('\n\n'));
    if (!s.apresentou) {
        s.apresentou = true;
        aviso = (config.apresentacao || `Olá! Seja bem-vindo(a) à *${limpo(config.empresa || 'Grupo Prime')}*! 💚\nSou ${limpo(config.nome || 'a assistente virtual de vendas')}, da equipe parceira Nio. Vou ajudar você a encontrar um plano e acompanhar seu pedido. 😊`) + (aviso ? '\n\n' + aviso : '');
    }
    if (!d.cidade || !d.estado) {
        s.etapa = 'localidade';
        return finalizarMensagem('Para começar, em qual cidade e estado será a instalação?');
    }
    if (!d.cep && !d.logradouro) {
        s.etapa = 'cep';
        return finalizarMensagem('Qual é o CEP do endereço de instalação?');
    }
    const chave = JSON.stringify(Object.fromEntries(['cidade', 'estado', 'cep', 'logradouro', 'quadra', 'lote', 'numero', 'casa', 'apartamento', 'bloco'].map(k => [k, d[k] || ''])));
    if (s.consultaChave !== chave) {
        s.consulta = await consultar({ ...d, uf: d.estado });
        s.consultaChave = chave;
    }
    const c = s.consulta;
    if (c.status === 'complemento_necessario') {
        s.etapa = 'complemento';
        return finalizarMensagem('Localizei o CEP na base. Qual é o número do imóvel ou a quadra e o lote? Se houver casa, bloco ou apartamento, pode enviar junto.');
    }
    if (c.status === 'sem_disponibilidade_na_base' || (c.status === 'nao_localizado' && c.cep)) {
        s.etapa = 'encerrado';
        return responder('Consultei o endereço e, no momento, não há disponibilidade registrada na base fornecida. Obrigado pelo interesse! 💚', 'encerrar');
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
        if (c.status === 'localidade_divergente')
            return finalizarMensagem(`O CEP retornou uma localidade diferente de ${limpo(d.cidade)}/${limpo(d.estado)}. Pode confirmar qual dado deseja corrigir: CEP ou cidade/estado?`);
        const opcoes = c.status === 'endereco_ambiguo' ? (c.resultados || []).map(r => [r.logradouro, r.numero, r.complemento1, r.complemento2, r.complemento3].filter(Boolean).join(' ')).slice(0, 5) : [];
        return finalizarMensagem(opcoes.length ? 'Encontrei mais de uma unidade. Qual destas corresponde ao imóvel?\n' + opcoes.map((o, i) => `${i + 1}. ${o}`).join('\n') : 'Ainda não localizei esse imóvel com segurança. Pode confirmar a rua e o número ou a quadra/lote? Vou aproveitar os outros dados que você já enviou.');
    }
    if (c.cep)
        d.cep = c.cep;
    const local = c.resultados[0];
    s.enderecoBase = local;
    if (!d.bairro && local.bairro)
        d.bairro = local.bairro;
    if (!d.logradouro)
        d.logradouro = local.logradouro;
    if (!d.endereco && s.enderecoInformado && local.logradouro) {
        const complementos = [local.complemento1, local.complemento2, local.complemento3].filter(Boolean);
        if (d.quadra && !parte(local.logradouro, 'quadra') && !complementos.some(v => parte(v, 'quadra')))
            complementos.unshift('Quadra ' + d.quadra);
        if (d.lote && !complementos.some(v => parte(v, 'lote')))
            complementos.push('Lote ' + d.lote);
        d.endereco = [local.logradouro, local.numero && local.numero !== 'SN' ? local.numero : '', ...complementos].filter(Boolean).join(', ');
    }
    if (!d.tipo_pessoa) {
        s.etapa = 'tipo_pessoa';
        return finalizarMensagem('✅ Encontrei disponibilidade na base para seu endereço.\n\nA contratação será no *CPF ou CNPJ*? Pergunto para te enviar os preços corretos, pois as ofertas para pessoa física e jurídica são diferentes.');
    }
    const planos = listaPlanos(s, catalogo);
    if (s.plano && !planos.some(p => p.id === s.plano.id)) {
        delete s.plano;
        s.confirmado = false;
    }
    if (!s.ofertas || !s.ofertas.every(id => planos.some(p => p.id === id)))
        return finalizarMensagem(ofertas(s, catalogo));
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
        return finalizarMensagem(`Você escolheu *${s.plano.nome}*, por *R$ ${s.plano.mensalidade.toFixed(2).replace('.', ',')}/mês*. 😊\nAgora confirme a rua, número ou quadra/lote e bairro. Já tenho ${d.cidade}/${d.estado} e o CEP ${d.cep}.`);
    }
    if (d.tipo_pessoa === 'PJ' && !d.cnpj) {
        s.etapa = 'cnpj';
        return finalizarMensagem('Vamos iniciar o cadastro. Qual é o CNPJ da contratação? Depois vamos preencher os dados do responsável.');
    }
    for (const campo of CAMPOS) {
        if (campo === 'telefone1' && !s.enderecoConfirmado) {
            if (s.etapa === 'confirmar_endereco' && (positivo(texto) || analise.confirmacao === true) && !novos.endereco)
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
    if (!s.documentos.rg_frente.length)
        return finalizarMensagem('Dados confirmados! ✅ Agora envie a foto da frente do RG. Se estiver com o RG aberto mostrando os dois lados, pode mandar uma foto só.');
    if (!s.documentos.rg_verso.length)
        return finalizarMensagem('Recebi o arquivo. Agora pode enviar o verso do RG?');
    if (!s.documentos.comprovante_endereco.length && !s.semComprovante)
        return finalizarMensagem('Agora envie o comprovante de endereço. Pode ser conta, contrato, correspondência, foto ou PDF com o endereço. Se não tiver, me avise que seguimos com essa observação.');
    s.etapa = 'registrar';
    return responder('Recebi seus dados e documentos. Vou registrar o pedido para análise e confirmação da instalação. ✅', 'registrar');
}
module.exports = { CAMPOS, inicial, avancar, cpfValido, dataBR, positivo, escolherPlano, resumo, hashResumo };
