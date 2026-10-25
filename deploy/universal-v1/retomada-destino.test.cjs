'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),carregar=require('./runtime.cjs');
for(const pendente of [true,false])test('retomada com dados pendentes='+pendente+' usa resolvedor do cliente para LID persistido e salva recibo no canal original',async()=>{
 const row={canal_id:164,numero:'1200000000001',fluxo_id:29,variaveis:{__universal_v1:JSON.stringify({pendentes:pendente?['nome sintético']:[],retryEm:1,erro:'WhatsApp não confirmou o destinatário configurado'})}},envios=[],salvas=[],client={};
 const db={from(){const q={select(){return q},eq(){return q},limit(){return q},then(ok,err){return Promise.resolve({data:[row],error:null}).then(ok,err)}};return q}};
 const ctx={supabase:db,app:{get(){}},sessoes:{164:{client}},getConfigCanal:async()=>({tipo:'webjs',workspaceId:'grupoprime',fila:'VENDAS'}),enviarTextoWebjs:async(c,n,m)=>{a.equal(c,client);envios.push({n,m});return {id:{_serialized:'true_1200000000001@lid_RECIBO'}}},salvarMensagem:async(...args)=>salvas.push(args),executarFluxo:async(_w,_c,_n,_t,enviar)=>enviar('Qual é a data de nascimento?')};
 carregar(ctx,{teste:true,semEnvolver:true,credencial:{apiKey:'TESTE'},interprete:{}});
 try{await ctx.universalTeste.retomarPendentes();a.equal(envios.length,1);a.equal(envios[0].n,row.numero);a.equal(salvas[0][0],'grupoprime');a.equal(salvas[0][1],164);a.equal(salvas[0][3],row.numero);a.equal(salvas[0].at(-1),'true_1200000000001@lid_RECIBO');}finally{ctx.universalTeste.parar()}
});
