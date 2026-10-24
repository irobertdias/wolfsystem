'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {avancar}=require('./generico.cjs'),{registro}=require('./modelo-vendas.cjs'),{criarIA}=require('./ia-configuravel.cjs');
const nicho={coleta:[{variavel:'cliente',rotulo:'Nome',pergunta:'Qual seu nome?',obrigatorio:true}],catalogo:[{id:'corte',nome:'Corte',preco:50}],exigir_oferta:true,documentos_config:[]};
const assistente={nome:'Ana',empresa:'Barbearia'};
test('outro nicho mostra oferta antes de perguntar dados e aceita escolha por ID resolvido pelo intérprete',async()=>{
 let r=await avancar({texto:'Olá',numero:'5511999999999',nicho,assistente,vars:{},extrair:async()=>({dados:[],plano_id:'corte'})});
 a.equal(r.estado.oferta,undefined);a.match(r.mensagem,/Corte/);a.doesNotMatch(r.mensagem,/Qual seu nome/);
 r=await avancar({estado:r.estado,texto:'esse de 50',numero:'5511999999999',nicho,assistente,vars:{},extrair:async()=>({dados:[],plano_id:'corte'})});a.equal(r.estado.oferta.id,'corte');a.match(r.mensagem,/Qual seu nome/);
 r=await avancar({estado:r.estado,texto:'João',numero:'5511999999999',nicho,assistente,vars:{},extrair:async()=>({dados:[{campo:'cliente',valor:'João',trecho:'João'}]})});a.match(r.mensagem,/Confira/);
 r=await avancar({estado:r.estado,texto:'beleza',numero:'5511999999999',nicho,assistente,vars:{},extrair:async()=>({dados:[],confirmacao:true})});a.equal(r.concluido,true);
});
test('mapeamento permite campos customizados e valores fixos sem alterar workspace/canal/id',()=>{
 const r=registro({cliente:'João',valor:'R$ 1.100,50'},{modo_mapeamento:'manual',mapeamento:[{campo:'nome',variavel:'cliente'},{campo:'valor_plano',variavel:'valor'},{campo:'custom.servico',origem:'valor',valor:'Corte de {{cliente}}'},{campo:'workspace_id',origem:'valor',valor:'outro'}]});
 a.deepEqual(r,{campos:{nome:'João',valor_plano:1100.5},custom:{servico:'Corte de João'}});
});
test('documentos não saem para IA sem consentimento explícito do workspace',async()=>{
 let chamadas=0;const ia=criarIA({apiKey:'teste',fetcher:async()=>{chamadas++;throw Error('não chamar');}});
 for(const autorizado of [false,undefined,'true'])await ia.lerDocumento({buffer:Buffer.from('teste'),mime:'application/pdf',nome:'teste.pdf',documentos:[],autorizado});a.equal(chamadas,0);
});
test('arquivo consentido usa categorias configuradas e não aceita categoria inventada',async()=>{
 let body;const ia=criarIA({apiKey:'teste',fetcher:async(_u,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({categorias:['apolice','intruso'],leitura:'legivel'})}]}]})};}});
 const r=await ia.lerDocumento({buffer:Buffer.from('pdf sintético'),mime:'application/pdf',nome:'teste.pdf',documentos:[{variavel:'apolice',rotulo:'Apólice'}],autorizado:true});a.deepEqual(r.categorias,['apolice']);a.equal(body.store,false);a.equal(body.input[0].content[0].type,'input_file');
});
test('telefone contextual e dados adiantados não são pedidos novamente',async()=>{
 const n={coleta:[{variavel:'telefone1',rotulo:'Contato',tipo:'telefone',obrigatorio:true}],documentos_config:[]};
 const r=await avancar({estado:{versao:2,dados:{},pendente:'telefone1',historico:[],documentos:{},anexos:[],pendencias:[],apresentou:true},texto:'esse mesmo',numero:'5511999999999',nicho:n,assistente,vars:{},extrair:async()=>({dados:[]})});a.equal(r.estado.dados.telefone1,'5511999999999');a.match(r.mensagem,/Confira/);
});
