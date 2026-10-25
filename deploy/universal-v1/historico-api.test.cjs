'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const historico=[{role:'user',content:'Olá'},{role:'assistant',content:'Como posso ajudar?',tipo:'lembrete',em:'2026-10-25T00:00:00Z',interno:'não enviar'},{role:'sistema',content:'evento interno'}];
test('Responses recebe somente role/content; nome após lembrete continua coleta com configuração universal',async()=>{
 let request;
 const ia=require('./ia-configuravel.cjs').criarIA({apiKey:'TESTE',fetcher:async(_u,o)=>{request=JSON.parse(o.body);for(const m of request.input)a.deepEqual(Object.keys(m).sort(),['content','role']);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({dados:[],resposta:''})}]}]})};}});
 const r=await require('./generico.cjs').avancar({estado:{dados:{},historico:structuredClone(historico),documentos:{},anexos:[],pendencias:[],apresentou:true,pendente:'titular_nome'},texto:'Ana Exemplo da Silva',numero:'5500000000000',nicho:{coleta:[{variavel:'titular_nome',tipo:'texto',obrigatorio:true},{variavel:'documento_titular',tipo:'cpf',obrigatorio:true}],documentos_config:[]},assistente:{},vars:{},extrair:ia.extrair});
 a.equal(r.estado.dados.titular_nome,'Ana Exemplo da Silva');a.equal(r.estado.pendente,'documento_titular');a.ok(!JSON.stringify(request.input).includes('não enviar'));a.equal(historico[1].tipo,'lembrete');
});
test('Chat Completions filtra metadados internos e preserva texto dos lembretes',async()=>{
 let request;const i=require('./interpretacao.cjs').criarInterpretador({apiKey:'TESTE',catalogo:()=>({}),fetcher:async(_u,o)=>{request=JSON.parse(o.body);for(const m of request.messages)a.deepEqual(Object.keys(m).sort(),['content','role']);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({dados:[]})}}]})};}});
 await i.extrair({estado:{dados:{},historico,etapa:'nome'},texto:'Ana Exemplo da Silva',numero:'5500000000000'});a.ok(request.messages.some(m=>m.content==='Como posso ajudar?'));a.ok(!request.messages.some(m=>m.role==='sistema'));
});
