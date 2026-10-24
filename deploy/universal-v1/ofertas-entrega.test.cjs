const {test}=require('node:test'),a=require('node:assert/strict');
const {inicial,avancar}=require('./conversa.cjs');
const {prepararEntrega,confirmarEntrega}=require('./entrega-resposta.cjs');
const {planosDaCidade}=require('./planos-grupoprime.cjs');
const carregar=require('./runtime.cjs');
function estado(){const s=inicial();s.apresentou=true;s.dados={cidade:'Goiânia',estado:'GO',cep:'74480150',numero:'12',tipo_pessoa:'PF'};return s;}
const consultar=async()=>({status:'disponivel_na_base',cep:'74480150',resultados:[{logradouro:'RUA A',numero:'12',bairro:'CENTRO'}]});
const passo=(s,texto)=>avancar({estado:s,entrada:texto,numero:'5500000000000',extrair:async()=>({dados:{},pergunta:/ofertas/.test(texto)}),consultar,catalogo:planosDaCidade});
test('CPF seguido de número e solicitação explícita nunca substituem catálogo por pergunta vazia',async()=>{
 let r=await passo(estado(),'CPF');a.equal(r.tipo,'ofertas');
 for(const texto of ['065.220.716-22','Quais são as ofertas?','quais são as ofertas?']){r=await passo(r.estado,texto);a.match(r.mensagem,/💰 R\$ 110,00/);a.match(r.mensagem,/600 Mega/);a.doesNotMatch(r.mensagem,/Só falta confirmar|pode esclarecer qual/);}
});
test('catálogo vazio salvo em sessão antiga é reconstruído',async()=>{const s=estado();s.ofertas=[];const r=await passo(s,'CPF');a.equal(r.tipo,'ofertas');a.ok(r.estado.ofertas.length);});
test('catálogo proposto não aparece no histórico enviado até o transporte confirmar',async()=>{const r=await passo(estado(),'CPF');prepararEntrega(r.estado,r);a.equal(r.estado.historico.at(-1).role,'user');a.equal(r.estado.catalogoPendente,true);confirmarEntrega(r.estado,r);a.equal(r.estado.historico.at(-1).content,r.mensagem);a.equal(r.estado.catalogoPendente,undefined);const proximo=await passo(r.estado,'110');a.equal(proximo.estado.plano.mensalidade,110);});
for(const falha of [false,true])test(`runtime preserva catálogo quando ${falha?'o envio falha':'chega mensagem durante a interpretação'}`,async()=>{
 let sessao={variaveis:{__universal_v1:JSON.stringify(estado())}},ctx,primeira=true;const envios=[];
 const db={from(){const q={select(){return q},eq(){return q},limit(){return q},then(ok,erro){return Promise.resolve({data:[],error:null}).then(ok,erro)}};return q}};
 ctx={supabase:db,executarFluxo:async()=>false,app:{get(){}},verificarBloqueioManualBot:async()=>({bloqueado:false}),buscarSessaoFluxo:async()=>sessao,salvarSessaoFluxo:async(w,c,n,f,no,vars)=>{sessao={variaveis:vars}},sessoes:{}};
 carregar(ctx,{teste:true,credencial:{apiKey:'teste'},consulta:consultar,interprete:{extrair:async()=>{if(primeira&&!falha)ctx.universalTeste.filas.set('teste',{mensagens:['065.220.716-22']});return {dados:{}}}}});
 try{const item={chave:'teste',fluxo:{id:29},no:{id:'a',dados:{}},canal:164,n:'5500000000000',mensagens:['CPF'],enviar:async m=>{if(primeira&&falha)throw Error('transporte indisponível');envios.push(m)}};
 await ctx.universalTeste.processar(item).catch(e=>{if(!falha)throw e});let s=JSON.parse(sessao.variaveis.__universal_v1);a.ok(!s.historico.some(h=>h.role==='assistant'&&h.content.includes('💰 R$')));a.equal(s.catalogoPendente,true);
 primeira=false;ctx.universalTeste.filas.delete('teste');await ctx.universalTeste.processar({...item,mensagens:['Quais são as ofertas?']});a.ok(envios.some(m=>m.includes('💰 R$ 110,00')));s=JSON.parse(sessao.variaveis.__universal_v1);a.equal(s.catalogoPendente,undefined);
 }finally{ctx.universalTeste.parar()}
});
