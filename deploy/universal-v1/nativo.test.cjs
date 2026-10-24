'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const instalar=require('./nativo.cjs');
function contexto(){
 const inserts=[],salvos=[],mensagens=[];let id=700;
 const db={from(t){const q={select(){return q;},eq(){return q;},single:async()=>({data:t==='workspaces'?{owner_email:'robert.dias@live.com'}:{},error:null}),maybeSingle:async()=>({data:null,error:null}),then(ok,erro){return Promise.resolve({data:[],error:null}).then(ok,erro);}};return q;}};
 const ctx={supabase:db,executarFluxo:async()=>true,persistirVariaveis:async()=>{},salvarSessaoFluxo:async(...args)=>salvos.push(structuredClone(args)),universalOperacoes:{registrar:async(...args)=>{inserts.push(args);return id++;},entregarPendentes:async()=>{}},tratarRetornoBko:async()=>false};
 const instalado=instalar(ctx);return {ctx,inserts,salvos,mensagens,parar:instalado.parar};
}
test('conclusão publica proposta_id e permite executar os blocos nativos seguintes',async()=>{
 const h=contexto(),f={id:99,nos:[],conexoes:[{de:'fim',para:'etiqueta',saidaIndex:0}]};
 const vars={cliente:'Ana',__universal_v2:JSON.stringify({pronto:true,dados:{nome:'Ana'},inicio:'teste',documentos:{},anexos:[],pendencias:[],resumo:'Resumo'})};
 try{const r=await h.ctx.processarUniversalNativo(f,{id:'fim',tipo:'concluir_venda_universal',dados:{crm:true,whatsapp:false,mensagem_sucesso:'Pedido {{proposta_id}} registrado para {{cliente}}'}},vars,'',false,async m=>h.mensagens.push(m),{workspaceId:'grupoprime',canalId:164,numero:'5500000000000'});
 a.equal(r.proximoNoId,'etiqueta');a.equal(vars.proposta_id,'700');a.equal(h.inserts.length,1);a.equal(h.inserts[0][3].variaveisPublicas.cliente,'Ana');a.match(h.mensagens[0],/700 registrado para Ana/);
 a.equal(await h.ctx.processarUniversalNativo(f,{id:'etiqueta',tipo:'etiqueta'},vars,'',false,()=>{},{}),null);
 }finally{h.parar();}
});
test('assistente apenas entra no nicho, sem executar ou substituir blocos CRM',async()=>{
 const h=contexto();try{const f={conexoes:[{de:'a',para:'n',saidaIndex:0}]};const r=await h.ctx.processarUniversalNativo(f,{id:'a',tipo:'assistente_universal'}, {},'',false,()=>{}, {workspaceId:'grupoprime'});a.equal(r.proximoNoId,'n');a.equal(h.inserts.length,0);}finally{h.parar();}
});
test('retornos CRM com proposta e início explícito não entram no agrupamento de mensagens da IA',async()=>{
 const h=contexto();try{a.equal(await h.ctx.executarFluxo('grupoprime',164,'5500000000000','',()=>{},99,{proposta:{id:123},iniciarNoId:'gatilho'}),true);a.equal(h.inserts.length,0);}finally{h.parar();}
});
