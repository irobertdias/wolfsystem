const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const patch=require('./patch.cjs'),root=process.env.WOLF_BACKEND_DIR||(process.platform==='win32'?'D:/GERAL/wolf-whatsapp':'/root/wolf-whatsapp');
const source=patch.fluxos(fs.readFileSync(path.join(root,'src/routes/fluxos.js'),'utf8'));
function fixture(){
 const t={fluxo_sessoes:[],fluxo_variaveis:[],fluxos:[{id:27,workspace_id:'grupoprime',ativo:true,nos:[{id:'inicio',tipo:'inicio',dados:{}},{id:'principal',tipo:'fluxo_ia',dados:{apiKey:'teste',agrupamento_ms:1,variaveis:[{nome:'cep',tipo:'cep'}],mensagem_inicial_literal:true,mensagem_inicial:'Informe o CEP'}},{id:'recuperar',tipo:'fluxo_ia',dados:{apiKey:'teste',agrupamento_ms:1,variaveis:[{nome:'cpf_novo',tipo:'cpf'}],mensagem_inicial_literal:true,mensagem_inicial:'Informe outro CPF'}}],conexoes:[{de:'inicio',saidaIndex:0,para:'principal'}]}],workspaces:[{username:'grupoprime',owner_email:'robert.dias@live.com'}]};
 t.proposta=[];let falhaRead=false,falhaWrite=false,id=1;const enviados=[];
 function query(table){const q={filters:[],payload:null,kind:'select',select(){return this},eq(k,v){this.filters.push(x=>k.split(/->>?/).reduce((o,k)=>o?.[k],x)===v);return this},is(k,v){this.filters.push(x=>x[k]==v);return this},or(){return this},limit(){return this},order(){return this},update(p){this.kind='update';this.payload=p;return this},insert(p){this.kind='insert';this.payload=p;return this},upsert(){return this},single(){return this.maybeSingle()},
  exec(single=false){if(table==='fluxo_sessoes'&&(falhaRead&&this.kind==='select'||falhaWrite&&this.kind!=='select'))return{data:null,error:Error('falha simulada de persistência')};
   const rows=t[table]||[];let encontrados=rows.filter(x=>this.filters.every(f=>f(x)));
   if(this.kind==='insert'){encontrados=(Array.isArray(this.payload)?this.payload:[this.payload]).map(x=>({...JSON.parse(JSON.stringify(x)),id:id++}));rows.push(...encontrados)}
   if(this.kind==='update')for(const x of encontrados)Object.assign(x,JSON.parse(JSON.stringify(this.payload)));
   if(single&&encontrados.length>1)return{data:null,error:Error('mais de uma sessão')};return{data:single?(encontrados[0]?JSON.parse(JSON.stringify(encontrados[0])):null):JSON.parse(JSON.stringify(encontrados)),error:null};},maybeSingle(){return Promise.resolve(this.exec(true))},then(a,b){return Promise.resolve(this.exec()).then(a,b)}};return q;}
 const mod={exports:{}};const app={get(){},post(){},delete(){}};
 const OpenAI=class{constructor(){this.chat={completions:{create:async()=>({choices:[{message:{content:JSON.stringify({mensagem:'Qual o novo CPF?',dados:{},cliente_confirmou:false,cliente_recusou:false})}}]})}}}};
 const codigo=source.replaceAll('await import("openai")','({default: OpenAIMock})');
 vm.runInNewContext(codigo,{module:mod,console:{log(){},warn(){},error(){}},Date,Map,Set,JSON,process:{env:{}},setTimeout,clearTimeout,OpenAIMock:OpenAI});
 const ctx={app,supabase:{from:query},MAX_NOS_POR_EXECUCAO:40,SESSAO_TTL_HORAS:24,crypto:{},express:{},dataHojeSaoPauloISO:()=> '2026-10-20',resolverVendedorVendaPelaRoleta:async()=>({vendedor:'vendedor@teste'})};mod.exports(ctx);
 const enviar=async m=>{enviados.push({m,sessao:t.fluxo_sessoes.find(x=>x.status==='ativo'&&x.canal_id===158)?.no_atual})};
 return{ctx,t,enviados,enviar,falharLeitura:()=>{falhaRead=true},falharEscrita:()=>{falhaWrite=true}};
}
test('gatilho persiste a sessão antes do aviso e sim permanece na recuperação, sem pedir CEP',async()=>{
 const f=fixture();await f.ctx.executarFluxo('grupoprime',158,'5511999999999','',f.enviar,27,{forcarNovaSessao:true,iniciarNoId:'recuperar',variaveisIniciais:{proposta_id:'532'}});
 assert.equal(f.enviados[0].sessao,'recuperar');assert.equal(f.t.fluxo_sessoes.length,1);
 await f.ctx.executarFluxo('grupoprime',158,'5511999999999','sim',f.enviar,27);
 assert.equal(f.t.fluxo_sessoes[0].no_atual,'recuperar');assert.ok(f.enviados.every(x=>!x.m.includes('CEP')));
});
test('erro ao salvar não envia aviso enganoso; erro ao consultar não abre venda nova',async()=>{
 const a=fixture();a.falharEscrita();await assert.rejects(a.ctx.executarFluxo('grupoprime',158,'n','',a.enviar,27,{iniciarNoId:'recuperar'}),/persistência/);assert.equal(a.enviados.length,0);
 const b=fixture();b.falharLeitura();await assert.rejects(b.ctx.executarFluxo('grupoprime',158,'n','sim',b.enviar,27),/persistência/);assert.equal(b.enviados.length,0);
});
test('salvar e finalizar respeitam workspace e canal mesmo com o mesmo telefone',async()=>{
 const f=fixture();for(const canal of [157,158])await f.ctx.salvarSessaoFluxo('grupoprime',canal,'n',27,'recuperar',{},true,'fluxo_ia');
 assert.equal(f.t.fluxo_sessoes.length,2);await f.ctx.finalizarSessaoFluxo('grupoprime','n',158);
 assert.equal(f.t.fluxo_sessoes.find(x=>x.canal_id===157).status,'ativo');assert.equal(f.t.fluxo_sessoes.find(x=>x.canal_id===158).status,'finalizado');
});
test('adota sessão legada no canal correto sem criar outra; patch é idempotente',async()=>{
 const f=fixture();f.t.fluxo_sessoes.push({id:90,workspace_id:'grupoprime',numero:'n',canal_id:null,status:'ativo',no_atual:'recuperar'});
 assert.equal((await f.ctx.buscarSessaoFluxo('grupoprime',158,'n')).canal_id,158);assert.equal(f.t.fluxo_sessoes.length,1);
 assert.equal(patch.fluxos(source),source);
});
test('CRM salva uma vez e segue ao fim mesmo se a confirmação WhatsApp falhar',async()=>{
 const f=fixture(),fluxo={id:27,nos:[{id:'fim'}],conexoes:[{de:'venda',saidaIndex:0,para:'fim'}]},no={id:'venda',tipo:'enviar_venda',dados:{aplicar_etiqueta:false,mensagem_sucesso:'Pedido registrado'}};
 const vars={nome:'Pessoa Teste',cpf:'52998224725',sessao_origem_id:'99',bko_pendente:'SIM'};
 for(let i=0;i<2;i++){
  const r=await f.ctx.processarNo(fluxo,no,vars,'',false,async()=>{throw Error('WhatsApp indisponível')},{workspaceId:'grupoprime',canalId:158,numero:'5511999999999'});
  assert.equal(r.proximoNoId,'fim');
 }
 assert.equal(f.t.proposta.length,1);assert.ok(vars.proposta_id);assert.equal(f.t.proposta[0].dados_customizados.bko_pendente,'SIM');
});
test('retorno a documentos já salvos não pede RG de novo',async()=>{
 const f=fixture(),flow=f.t.fluxos[0],doc={id:'prime_reversao_documentos_ia',tipo:'fluxo_ia',dados:{apiKey:'teste',mensagem_inicial_literal:true,mensagem_inicial:'Envie frente do RG',variaveis:[{nome:'rg_frente_validado',tipo:'texto'}]}};flow.nos.push(doc);
 const vars=Object.fromEntries(['rg_frente','rg_verso','comprovante_endereco'].flatMap(k=>[[k,JSON.stringify([{url:'privado'}])],[k+'_validado','SIM']]));
 await f.ctx.executarFluxo('grupoprime',158,'n','',f.enviar,27,{iniciarNoId:doc.id,variaveisIniciais:vars});
 assert.ok(f.enviados[0].m.includes('Não precisa reenviar'));assert.ok(!f.enviados[0].m.includes('Envie frente'));
});
test('gatilho e resposta simultâneos compartilham fila mesmo com extensão desativada',async()=>{
 const f=fixture(),m={exports:{}};
 vm.runInNewContext(patch.fila(fs.readFileSync(path.join(root,'src/services/fluxo-ia-fila.js'),'utf8')),{module:m,require:()=>class{},console:{log(){},error(){}},Map,Date,Promise});
 f.ctx.extensaoFluxoIAAtiva=async()=>false;f.ctx.CHAVES_EXTENSOES_FLUXO_IA={fila:'fila'};m.exports(f.ctx);
 await Promise.all([
  f.ctx.executarFluxo('grupoprime',158,'n','',f.enviar,27,{forcarNovaSessao:true,iniciarNoId:'recuperar'}),
  f.ctx.executarFluxo('grupoprime',158,'n','sim',f.enviar,27)
 ]);
 assert.equal(f.t.fluxo_sessoes.length,1);assert.equal(f.t.fluxo_sessoes[0].no_atual,'recuperar');assert.ok(!f.enviados.some(x=>x.m.includes('CEP')));
});
test('snapshot CRM usa titular atual e não deixa custom antigo prevalecer',()=>{
 const w=patch.worker(fs.readFileSync(path.join(root,'src/jobs/crm-automacoes-worker.js'),'utf8'));
 const a=w.indexOf('  function variaveisDaProposta('),b=w.indexOf('  async function liberarFluxoBot',a);
 const fn=vm.runInNewContext('(function(){const texto=v=>v==null?"":String(v);'+w.slice(a,b)+';return variaveisDaProposta})()');
 const r=fn({id:532,workspace_id:'grupoprime',cpf:'atual',nome:'Titular Atual',email:null,dados_customizados:{cpf:'antigo',nome:'Titular Antigo',email:'antigo@teste'}},'status_venda','AGUARDANDO AUDITORIA','CPF REPROVADO');
 assert.equal(r.cpf,'atual');assert.equal(r.nome,'Titular Atual');assert.equal(r.email,'');
});
test('sessão ausente retoma CPF reprovado do CRM sem pedir CEP; pedido em auditoria não reabre com obrigado',async()=>{
 for(const status of ['CPF REPROVADO','AGUARDANDO AUDITORIA']){
  const f=fixture();f.t.proposta.push({id:532,workspace_id:'grupoprime',canal_id:158,status_venda:status,cpf:'52998224725',nome:'Titular Atual'});
  f.t.fluxo_variaveis.push({workspace_id:'grupoprime',canal_id:158,numero:'5511999999999',nome:'proposta_id',valor:'532'});
  f.t.fluxos[0].nos.push({...f.t.fluxos[0].nos.find(n=>n.id==='recuperar'),id:'prime_reversao_ia'});
  await f.ctx.executarFluxo('grupoprime',158,'5511999999999',status==='CPF REPROVADO'?'sim':'Obrigado',f.enviar,27);
  assert.ok(!f.enviados.some(x=>x.m.includes('CEP')));
  if(status==='CPF REPROVADO'){assert.equal(f.t.fluxo_sessoes[0].no_atual,'prime_reversao_ia');assert.equal(f.t.fluxo_sessoes[0].variaveis.cpf_reprovado,'52998224725');}
  else{assert.equal(f.t.fluxo_sessoes.length,0);assert.equal(f.enviados.length,0);}
 }
});
