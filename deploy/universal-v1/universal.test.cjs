const { test } = require('node:test'), a = require('node:assert/strict');
const { interpretarEndereco, corresponde, criarConsulta } = require('./vtal.cjs');
const { inicial, avancar, dataBR, positivo, escolherPlano, hashResumo } = require('./conversa.cjs');
const { planosDaCidade } = require('./planos-grupoprime.cjs');
const linha = (id, logradouro, numero, c1 = '', c2 = '', c3 = '') => ({ id, uf: 'GO', cidade: 'GOIANIA', logradouro, numero, complemento1: c1, complemento2: c2, complemento3: c3, bairro: 'CENTRO', situacao: 'Viável', comercial: 'Sim' });
test('dúvida de preço antes da consulta não antecipa CPF/PJ nem inventa cobertura',async()=>{
 const s=inicial();s.apresentou=true;s.dados={cidade:'Rio de Janeiro',estado:'RJ'};
 const r=await avancar({estado:s,entrada:'Qual o valor',numero:'5500000000000',extrair:async()=>({dados:{},pergunta:true,resposta_contextual:'Prefere pessoa física ou jurídica? Temos planos por R$ 110.'}),consultar:async()=>{throw Error('Não consultar sem CEP');},catalogo:planosDaCidade});
 a.equal(r.estado.etapa,'cep');a.match(r.mensagem,/CEP/);a.doesNotMatch(r.mensagem,/física|jurídica|R\$/i);
});
test('pergunta atual por valor descarta texto antigo sobre TV e não repete o parágrafo',async()=>{
 let s=inicial();s.apresentou=true;s.dados={cidade:'Sorocaba',estado:'SP',cep:'18000000',numero:'1'};
 const mensagens=[];for(let i=0;i<3;i++){const r=await avancar({estado:s,entrada:'Passa.o.valo',numero:'5500000000000',extrair:async()=>({dados:{},pergunta:true,resposta_contextual:'Não temos informações sobre planos que incluam TV.'}),consultar:async()=>({status:'disponivel_na_base',cep:'18000000',resultados:[{logradouro:'Rua Exemplo',numero:'1'}]}),catalogo:planosDaCidade});s=r.estado;mensagens.push(r.mensagem);a.doesNotMatch(r.mensagem,/TV/);a.equal(s.etapa,'tipo_pessoa');}a.equal(new Set(mensagens).size,3);
});
function mockVtal(rows) { return async (url) => { const p = new URL(url).searchParams, keys = ['logradouro', 'numero', 'complemento1', 'complemento2', 'complemento3']; const selecionadas = rows.filter(r => keys.every(k => !p.get(k) || p.get(k) === r[k])); return { ok: true, json: async () => ({ cep: p.get('cep'), cepTotal: rows.length, total: selecionadas.length, pageSize: 30, results: selecionadas.slice((Number(p.get('page')) - 1) * 30, Number(p.get('page')) * 30), locations: ['GOIANIA / GO'], facets: Object.fromEntries(keys.map(k => [k, [...new Set(rows.map(r => r[k]))]])) }) }; }; }

test('quadra alfabética QU G e fachada 52 localizam unidades; nome parecido exige confirmação', async()=>{
 for(const marca of ['Q','QU','QD','QA','QUADRA']) a.equal(interpretarEndereco(`Número 52 ${marca} G`).quadra,'G');
 const e=interpretarEndereco('Rua conde Aljezur 52 QD G');a.equal(e.logradouro,'RUA CONDE ALJEZUR');a.equal(e.numero,'52');
 const consulta=criarConsulta({fetcher:mockVtal([linha('a','RUA CONDE ALJEZUR','52','QU G','CA 2'),linha('b','RUA CONDE ALJEZUR','52','QU G','CA 3')])});
 const r=await consulta({...e,cep:'26381408'});a.equal(r.status,'endereco_ambiguo');a.equal(r.resultados.length,2);
 const casa=await consulta({...e,cep:'26381408',casa:'2'});a.equal(casa.status,'disponivel_na_base');a.equal(casa.resultados[0].id,'a');
 const parecido=await consulta({cep:'26381408',numero:'52',logradouro:'Rua conde augesur'});a.equal(parecido.status,'confirmar_logradouro');a.equal(parecido.sugestoes[0].logradouro,'RUA CONDE ALJEZUR');
});

test('lote de três arquivos preserva as duas faces e comprovante mesmo com classificação repetida',()=>{
 const {incorporar,pendente}=require('./documentos.cjs'),s=inicial();
 incorporar(s,{path:'frente',nome:'1.jpg',categorias:['rg_frente']});a.equal(pendente(s),'rg_verso');
 incorporar(s,{path:'verso',nome:'2.jpg',categorias:['rg_frente']});a.equal(pendente(s),'comprovante_endereco');
 incorporar(s,{path:'conta',nome:'3.pdf',categorias:['comprovante_endereco']});
 incorporar(s,{path:'verso',nome:'2.jpg',categorias:['rg_frente']});
 a.equal(s.anexos.length,3);for(const k of ['rg_frente','rg_verso','comprovante_endereco'])a.equal(s.documentos[k].length,1);
});

test('confirmação de rua sugerida mantém número e quadra; casa informada resolve ambiguidade',async()=>{
 const consulta=criarConsulta({fetcher:mockVtal([linha('a','RUA CONDE ALJEZUR','52','QU G','CA 2'),linha('b','RUA CONDE ALJEZUR','52','QU G','CA 3')])});
 let s=inicial();s.apresentou=true;s.etapa='complemento';s.dados={cidade:'Goiânia',estado:'GO',cep:'26381408',numero:'52',quadra:'G',logradouro:'RUA CONDE AUGESUR'};
 const run=async texto=>{const r=await avancar({estado:s,entrada:texto,numero:'5562999998888',extrair:async()=>({dados:{}}),consultar:consulta,catalogo:planosDaCidade});s=r.estado;return r;};
 let r=await run('já mandei a rua');a.match(r.mensagem,/Seria este endereço/);
 r=await run('sim');a.match(r.mensagem,/mais de uma unidade/);a.equal(s.dados.numero,'52');a.equal(s.dados.quadra,'G');
 r=await run('casa 2');a.equal(s.etapa,'tipo_pessoa');a.equal(s.consulta.resultados[0].id,'a');a.doesNotMatch(r.mensagem,/confirmar a rua/);
});
test('q2 lt01 vira quadra 2 lote 1; zeros e delimitadores não confundem 1 com 10', () => { const e = interpretarEndereco('q2 lt01'); a.equal(e.quadra, '2'); a.equal(e.lote, '1'); a.ok(corresponde(linha('1', 'QUADRA 2', 'SN', 'LT 01'), e)); a.ok(!corresponde(linha('2', 'QUADRA 20', 'SN', 'LT 1'), e)); a.ok(!corresponde(linha('3', 'QUADRA 2', 'SN', 'LT 10'), e)); });
test('quadra pode estar no logradouro ou em complemento, lote em qualquer coluna', async () => { const consulta = criarConsulta({ fetcher: mockVtal([linha('1', 'RUA VM B Q 2', 'SN', '', 'LT 01'), linha('2', 'RUA VM B', 'SN', 'QU 3', 'LT 1')]) }); const r = await consulta({ cep: '74480150', cidade: 'Goiânia', uf: 'GO', texto: 'q2 lt01' }); a.equal(r.status, 'disponivel_na_base'); a.equal(r.resultados[0].id, '1'); const outro = await consulta({ cep: '74480150', texto: 'qd3 lote01' }); a.equal(outro.resultados[0].id, '2'); });
test('número avulso filtra fachada, não lote', async () => { const consulta = criarConsulta({ fetcher: mockVtal([linha('1', 'RUA A', '12'), linha('2', 'RUA A', 'SN', 'LT 12')]) }); const r = await consulta({ cep: '74480150', texto: '12' }); a.equal(r.resultados[0].id, '1'); });
test('CEP sozinho pede complemento e várias casas não viram disponibilidade inventada', async () => { const consulta = criarConsulta({ fetcher: mockVtal([linha('1', 'QUADRA 2', 'SN', 'LT 1', 'CA 1'), linha('2', 'QUADRA 2', 'SN', 'LT 1', 'CA 2')]) }); a.equal((await consulta({ cep: '74480150' })).status, 'complemento_necessario'); a.equal((await consulta({ cep: '74480150', texto: 'q2 lt1' })).status, 'endereco_ambiguo'); a.equal((await consulta({ cep: '74480150', texto: 'q2 lt1 casa2' })).resultados[0].id, '2'); });
test('falha API é inconclusiva; não vira falta de cobertura', async () => { const consulta = criarConsulta({ fetcher: async () => { throw Error('timeout'); } }); a.equal((await consulta({ cep: '74480150' })).status, 'consulta_inconclusiva'); });
test('consulta não escolhe cidade de outro estado', async () => { const consulta = criarConsulta({ fetcher: mockVtal([linha('1', 'RUA A', '12')]) }); a.equal((await consulta({ cep: '74480150', cidade: 'Goiânia', uf: 'SP', numero: '12' })).status, 'localidade_divergente'); });
test('datas com espaços pontos barras mês escrito e ano curto; data impossível não é inventada', () => { for (const v of ['23 01 2002', '23.01.2002', '23.01.02', '23/01/02', '23/01/2002', '23 janeiro 2002', '23 de janeiro de 2002', '2002-01-23', '23012002'])
    a.equal(dataBR(v), '23/01/2002', v); a.equal(dataBR('31/02/2002'), ''); });
test('aceites positivos e escolha por valor/nome/opção sem pedir ID ao cliente', () => { for (const v of ['ok', 'tudo ok', 'sim', 'beleza', 'tudo correto', 'pode seguir'])
    a.ok(positivo(v)); const planos = planosDaCidade('RJ', 'Belford Roxo').pessoa_fisica; a.equal(escolherPlano('110', planos).id, 'pf-fibra-padrao'); a.equal(escolherPlano('quero Nio Fibra', planos).mensalidade, 110); a.equal(escolherPlano('1', planos).mensalidade, 110); a.equal(escolherPlano('1 giga', planos), null); });
const disponivel = async () => ({ status: 'disponivel_na_base', cep: '74480150', resultados: [linha('1', 'RUA A', '12')] });
async function passo(s, texto, dados = {}, extra = {}, anexos = []) { return avancar({ estado: s, entrada: texto, numero: '5562999998888', extrair: async () => ({ dados, ...extra }), consultar: disponivel, catalogo: planosDaCidade, anexos }); }
test('apresentação, localidade, CPF/PJ, ofertas e plano antes da coleta pessoal', async () => { let r = await passo(null, 'olá'); a.match(r.mensagem, /Sou/); a.equal(r.estado.etapa, 'localidade'); r = await passo(r.estado, 'Goiânia GO', { cidade: 'Goiânia', estado: 'GO' }); a.equal(r.estado.etapa, 'cep'); r = await passo(r.estado, '74480150', { cep: '74480150' }); a.equal(r.estado.etapa, 'tipo_pessoa'); a.match(r.mensagem, /preços corretos/); r = await passo(r.estado, 'CPF', { tipo_pessoa: 'PF' }); a.equal(r.estado.etapa, 'plano'); a.match(r.mensagem, /110,00/); a.doesNotMatch(r.mensagem, /seu nome|seu CPF/); r = await passo(r.estado, '110'); a.equal(r.estado.etapa, 'nome'); a.equal(r.estado.dados.endereco,'RUA A, 12'); a.equal(r.estado.plano.mensalidade, 110); });
test('dados em lote são preservados, telefone de contexto avança e resumo precisa ser confirmado', async () => { let s = inicial(); s.apresentou = true; s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150', tipo_pessoa: 'PF', endereco: 'RUA A 12', bairro: 'Centro', nome: 'Maria Silva', cpf: '52998224725', data_nascimento: '23.01.02', nome_mae: 'Ana Silva', email: 'maria@example.com', vencimento: '20', forma_pagamento: 'Boleto' }; s.plano = planosDaCidade('GO', 'Goiânia').pessoa_fisica[0]; s.ofertas = [s.plano.id]; s.etapa = 'confirmar_endereco'; let r = await passo(s, 'tudo certo', {}, { usar_whatsapp: true }); a.equal(r.estado.etapa, 'telefone1'); r = await passo(r.estado, 'esse mesmo'); a.equal(r.estado.dados.telefone1, '5562999998888'); a.equal(r.estado.etapa, 'confirmacao'); a.match(r.mensagem, /📋/); a.equal(r.acao, undefined); r = await passo(r.estado, 'beleza'); a.equal(r.estado.etapa, 'documentos'); a.match(r.mensagem, /frente do RG/); });
test('RG aberto vale frente e verso, comprovante recebido conclui sem pedir novamente', async () => { let s = inicial(); s.apresentou = true; s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150', tipo_pessoa: 'PF', endereco: 'RUA A 12', bairro: 'Centro', nome: 'Maria Silva', cpf: '52998224725', data_nascimento: '23/01/2002', nome_mae: 'Ana Silva', email: 'maria@example.com', telefone1: '5562999998888', vencimento: '20', forma_pagamento: 'Boleto' }; s.plano = planosDaCidade('GO', 'Goiânia').pessoa_fisica[0]; s.ofertas = [s.plano.id]; s.enderecoConfirmado = true; s.confirmado = true; s.etapa = 'documentos'; let r = await passo(s, 'arquivo', {}, {}, [{ path: 'rg', categorias: ['rg_frente', 'rg_verso'] }]); a.match(r.mensagem, /comprovante/); r = await passo(r.estado, 'arquivo', {}, {}, [{ path: 'contrato.pdf', categorias: ['comprovante_endereco'] }]); a.equal(r.acao, 'registrar'); a.equal(r.estado.documentos.rg_frente[0].path, r.estado.documentos.rg_verso[0].path); });
test('correção depois do resumo exige novo resumo e não confirma silenciosamente', async () => { let s = inicial(); s.apresentou = true; s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150', tipo_pessoa: 'PF', endereco: 'RUA A 12', bairro: 'Centro', nome: 'Maria Silva', cpf: '52998224725', data_nascimento: '23/01/2002', nome_mae: 'Ana Silva', email: 'maria@example.com', telefone1: '5562999998888', vencimento: '20', forma_pagamento: 'Boleto' }; s.plano = planosDaCidade('GO', 'Goiânia').pessoa_fisica[0]; s.ofertas = [s.plano.id]; s.enderecoConfirmado = true; s.etapa = 'confirmacao'; s.resumoHash = hashResumo(s); const r = await passo(s, 'meu email é outro@example.com', { email: 'outro@example.com' }, { confirmacao: true }); a.equal(r.estado.confirmado, false); a.match(r.mensagem, /outro@example.com/); a.equal(r.acao, undefined); });
test('preços promocionais seguem cidade e UF, sem misturar PF com PJ', () => { a.equal(planosDaCidade('GO', 'Trindade').pessoa_fisica[0].mensalidade, 70); a.equal(planosDaCidade('RJ', 'Trindade').pessoa_fisica[0].mensalidade, 110); a.equal(planosDaCidade('GO', 'Trindade').pessoa_juridica[0].velocidade_mbps, 700); });
test('boleto e vencimento avulsos são salvos mesmo se o modelo omitir o campo', async () => { let s = inicial(); s.apresentou = true; s.dados = { cidade: 'Goiânia', estado: 'Goiás', cep: '74480150', tipo_pessoa: 'PF', endereco: 'Rua A 12', bairro: 'Centro', nome: 'Maria Exemplo', cpf: '52998224725', data_nascimento: '23 janeiro 2002', nome_mae: 'Ana Exemplo', email: 'maria@example.com', telefone1: '5562999998888' }; s.enderecoConfirmado = true; s.plano = planosDaCidade('GO', 'Goiânia').pessoa_fisica[0]; s.ofertas = [s.plano.id]; s.etapa = 'vencimento'; let r = await passo(s, 'dia 20'); a.equal(r.estado.dados.estado, 'GO'); a.equal(r.estado.etapa, 'forma_pagamento'); a.equal(r.estado.dados.numero, undefined); r = await passo(r.estado, 'boleto'); a.equal(r.estado.etapa, 'confirmacao'); a.equal(r.estado.dados.forma_pagamento, 'Boleto'); });
test('pergunta de preço não escolhe o plano; preço no cartão mantém a condição', () => { const planos = planosDaCidade('RJ', 'Belford Roxo').pessoa_fisica; const p = escolherPlano('95', planos); a.equal(p.mensalidade, 95); a.equal(p.mensalidade_padrao, 110); a.equal(p.condicao_preco, 'Cartão de crédito'); });
test('rua completa é encontrada sem CEP por cidade/UF no índice de descoberta', async () => { const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-vtal-teste-')); try {
    fs.writeFileSync(path.join(dir, 'GO-GOIANIA.json.gz'), zlib.gzipSync(JSON.stringify([['RUA TESTE', '74480150']])));
    const consulta = criarConsulta({ diretorio: dir, fetcher: mockVtal([linha('1', 'RUA TESTE', '12')]) });
    const r = await consulta({ cidade: 'Goiânia', uf: 'Goiás', texto: 'Rua Teste, 12' });
    a.equal(r.status, 'disponivel_na_base');
    a.equal(r.cep, '74480150');
}
finally {
    a.ok(fs.realpathSync(dir).startsWith(fs.realpathSync(os.tmpdir()) + path.sep + 'wolf-vtal-teste-'));
    fs.rmSync(dir, { recursive: true });
} });

test('CEP ausente da base informa indisponibilidade e encerra imediatamente', async () => {
    const s = inicial();
    s.apresentou = true;
    s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150' };
    const r = await avancar({ estado: s, entrada: '74480150', numero: '5562999998888', extrair: async () => ({ dados: {} }), consultar: async () => ({ status: 'nao_localizado', cep: '74480150', resultados: [] }), catalogo: planosDaCidade });
    a.equal(r.acao, 'encerrar');
    a.equal(r.estado.etapa, 'encerrado');
    a.equal(r.inviavel,true);
    a.match(r.mensagem,/outro endereço/);
});

test('nome da mãe avulso pertence ao campo pendente e não substitui o nome do titular', async () => {
    const s = inicial();
    s.apresentou = true;
    s.dados = { cidade: 'Goiânia', estado: 'GO', cep: '74480150', tipo_pessoa: 'PF', endereco: 'Rua A 12', bairro: 'Centro', nome: 'Maria Exemplo', cpf: '52998224725', data_nascimento: '23/01/2002' };
    s.plano = planosDaCidade('GO', 'Goiânia').pessoa_fisica[0]; s.ofertas = [s.plano.id]; s.etapa = 'nome_mae';
    const r = await passo(s, 'Ana Exemplo', { nome: 'Ana Exemplo' });
    a.equal(r.estado.dados.nome, 'Maria Exemplo');
    a.equal(r.estado.dados.nome_mae, 'Ana Exemplo');
    a.equal(r.estado.etapa, 'email');
});
