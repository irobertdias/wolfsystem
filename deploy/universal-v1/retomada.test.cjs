const {test}=require('node:test'),a=require('node:assert/strict');
const carregar=require('./runtime.cjs');
test('retomada sem mensagem nova não cresce histórico nem envia a mesma pergunta',async()=>{
 let sessao,leituras=0;const envios=[];
 const db={from(){const q={select(){return q;},eq(){return q;},limit(){return q;},then(ok,erro){return Promise.resolve({data:[],error:null}).then(ok,erro);}};return q;}};
 const ctx={supabase:db,executarFluxo:async()=>false,app:{get(){}},verificarBloqueioManualBot:async()=>({bloqueado:false}),buscarSessaoFluxo:async()=>sessao,salvarSessaoFluxo:async(ws,canal,n,f,no,vars)=>{sessao={variaveis:vars};},sessoes:{}};
 carregar(ctx,{teste:true,credencial:{apiKey:'teste'},interprete:{extrair:async()=>{leituras++;return {dados:{}};}}});
 try{
  const item={fluxo:{id:29},no:{id:'a',dados:{}},canal:164,n:'5500000000000',enviar:async m=>envios.push(m),mensagens:['Oi']};
  await ctx.universalTeste.processar(item);const anterior=JSON.parse(sessao.variaveis.__universal_v1);
  await ctx.universalTeste.processar({...item,mensagens:['']});await ctx.universalTeste.processar({...item,mensagens:['']});
  const depois=JSON.parse(sessao.variaveis.__universal_v1);a.equal(envios.length,1);a.equal(leituras,1);a.deepEqual(depois.historico,anterior.historico);a.deepEqual(depois.pendentes,[]);
 }finally{ctx.universalTeste.parar();}
});
test('retry de consulta reusa dados já interpretados sem reexecutar IA nem acrescentar a mesma mensagem',async()=>{
 let sessao,leituras=0,consultas=0;const envios=[];
 const db={from(){const q={select(){return q;},eq(){return q;},limit(){return q;},then(ok,erro){return Promise.resolve({data:[],error:null}).then(ok,erro);}};return q;}};
 const ctx={supabase:db,executarFluxo:async()=>false,app:{get(){}},verificarBloqueioManualBot:async()=>({bloqueado:false}),buscarSessaoFluxo:async()=>sessao,salvarSessaoFluxo:async(ws,canal,n,f,no,vars)=>{sessao={variaveis:vars};},sessoes:{}};
 carregar(ctx,{teste:true,credencial:{apiKey:'teste'},interprete:{extrair:async()=>{leituras++;return {dados:{cidade:'Goiânia',estado:'GO',cep:'74480150',numero:'12'}};}},consulta:async()=>{consultas++;return {status:'consulta_inconclusiva',resultados:[]};}});
 try{const item={fluxo:{id:29},no:{id:'a',dados:{}},canal:164,n:'5500000000000',enviar:async m=>envios.push(m),mensagens:['Goiânia GO 74480150 número 12']};await ctx.universalTeste.processar(item);const h=JSON.parse(sessao.variaveis.__universal_v1).historico;for(let i=0;i<3;i++)await ctx.universalTeste.processar({...item,mensagens:['']});a.equal(leituras,1);a.equal(consultas,4);a.equal(envios.length,1);a.deepEqual(JSON.parse(sessao.variaveis.__universal_v1).historico,h);}finally{ctx.universalTeste.parar();}
});
