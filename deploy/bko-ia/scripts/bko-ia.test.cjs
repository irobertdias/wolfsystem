const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),{createHash,createHmac}=require('node:crypto');
const caminho=require('node:path').resolve(__dirname,'../src/services/bko-ia.js');
const regras=require('../src/services/bko-ia-regras');
const helpers=require(caminho)._test;
test('máximo de cinco BKOs, números normalizados sem duplicatas e canal obrigatório',()=>{
 const c={ativo:true,canal_id:157,contatos:[{nome:'BKO',numero:'(62) 99999-0001'}]};
 assert.equal(regras.validarConfigBko(c).contatos[0].numero,'5562999990001');
 for(const p of [{...c,contatos:Array(6).fill(c.contatos[0])},{...c,contatos:[...c.contatos,{nome:'Outro',numero:'5562999990001'}]},{...c,canal_id:null},{...c,contatos:[{nome:'BKO',numero:'123'}]}])assert.throws(()=>regras.validarConfigBko(p));
});
test('status inequívoco, referência única e datas reais; negações não viram aprovação',()=>{
 assert.equal(regras.interpretarRetornoBko('APROVADO').status,'APROVADA');
 assert.equal(regras.interpretarRetornoBko('CPF reprovado').status,'CPF REPROVADO');
 for(const x of ['não aprovado','aprovado mas CPF reprovado','APROVADO\nCANCELADA','GERADA\nDATA: 31/02/2026','APROVADO\nBKO-1-1234567890ABCDEF\nBKO-2-1234567890ABCDEF'])assert.equal(regras.interpretarRetornoBko(x),null);
 assert.equal(regras.interpretarRetornoBko('GERADA\nDATA: 25/10/2026\nPERIODO: MANHÃ').data_agendamento,'25/10/2026');
 assert.equal(regras.transicaoBkoPermitida('INSTALADA','CPF REPROVADO'),false);
});
test('assinatura usa corpo original e segredo Meta; adulteração é recusada',()=>{
 const raw=Buffer.from('{"ok":true}'),sig='sha256='+createHmac('sha256','segredo-teste').update(raw).digest('hex');
 assert.ok(helpers.assinaturaValida(raw,sig,'segredo-teste'));
 assert.equal(helpers.assinaturaValida(Buffer.from('{}'),sig,'segredo-teste'),false);
 assert.equal(helpers.assinaturaValida(raw,sig,''),false);
});
function fixture({ativo=true,contatos=1,waba=false}={}){
 const copia=x=>JSON.parse(JSON.stringify(x));
 const fluxo={id:27,workspace_id:'grupoprime',ativo,nos:[{id:'prime_documentos_enviar',dados:{bko_configuracao:{ativo:true,canal_id:157,contatos:Array.from({length:contatos},(_,i)=>({nome:'BKO '+i,numero:'556299999000'+(i+1)}))}}}]};
 const venda={id:1,workspace_id:'grupoprime',fluxo_id:27,canal_id:157,status_venda:'AGUARDANDO AUDITORIA',cpf:'52998224725',nome:'Pessoa Teste',telefone1:'5562988881111',telefone2:'556233332222',updated_at:'2026-10-20T12:00:00Z',dados_customizados:{bko_pendente:'SIM',numero_origem_whatsapp:'5562988881111'}};
 const hash=createHash('sha256').update('grupoprime:157:5562988881111').digest('hex').slice(0,24);
 const arquivos=new Set();
 for(const tipo of ['rg_frente','rg_verso','comprovante_endereco']){const path=`grupoprime/${hash}/arquivos/${tipo}/teste.jpg`;arquivos.add(path);venda.dados_customizados[tipo]=JSON.stringify([{privado:true,regra_id:'prime_'+(tipo==='comprovante_endereco'?'comprovante':tipo),tipo:'image/jpeg',url:'/api/documentos-clientes/arquivo?workspaceId=grupoprime&path='+encodeURIComponent(path)}]);}
 const tabelas={fluxos:[fluxo],proposta:[venda],crm_automacao_estado:[]},envios=[];
 let conflito=false,falharEnvio=false;
 const valor=(r,k)=>k.split(/->>?/).reduce((v,c)=>v?.[c],r);
 function query(t){const q={filtros:[],payload:null,tipo:'read',max:Infinity,
  select(){return this;},eq(k,v){this.filtros.push(r=>{const x=valor(r,k);return (typeof x==='object'?JSON.stringify(x):x)===v;});return this;},
  in(k,v){this.filtros.push(r=>v.includes(valor(r,k)));return this;},contains(k,v){this.filtros.push(r=>Object.entries(v).every(([key,arr])=>arr.every(x=>r[k]?.[key]?.includes(x))));return this;},
  not(k,_op,v){this.filtros.push(r=>valor(r,k)!=v);return this;},single(){return this.maybeSingle();},
  is(k,v){this.filtros.push(r=>valor(r,k)==v);return this;},
  order(){return this;},limit(n){this.max=n;return this;},update(p){this.payload=p;this.tipo='update';return this;},upsert(p){this.payload=p;this.tipo='upsert';return this;},
  exec(){if(this.tipo==='upsert'){if(!tabelas[t].some(x=>x.proposta_id===this.payload.proposta_id))tabelas[t].push(copia(this.payload));return {data:null,error:null};}
   let lista=tabelas[t].filter(r=>this.filtros.every(f=>f(r))).slice(0,this.max);
   if(this.payload){if(conflito&&t==='proposta'){conflito=false;return {data:[],error:null};}for(const r of lista)Object.assign(r,copia(this.payload));}
   return {data:copia(lista),error:null};},
  maybeSingle(){const r=this.exec();return Promise.resolve({...r,data:r.data?.[0]||null});},then(ok,no){return Promise.resolve(this.exec()).then(ok,no);}};return q;}
 const db={from:query,storage:{from:()=>({download:async p=>arquivos.has(p)?{data:new Blob(['imagem'],{type:'image/jpeg'})}:{data:null,error:Error('ausente')}})}};
 const ctx={supabase:db,app:{get(){}},sessoes:{157:{status:'conectado',conectadoEm:Date.now()-60000,client:{}}},getConfigCanal:async()=>({canalId:157,workspaceId:'grupoprime',tipo:waba?'waba':'webjs',numero:'556233334444',phone_number_id:'id-teste',token:'token-falso'}),
  enviarTextoWebjs:async(_c,n,m)=>{if(falharEnvio)throw Error('timeout');envios.push({numero:n,texto:m});return {success:true,messageId:'msg-'+envios.length};},
  enviarMidiaWebjs:async(_c,n,m,o)=>{envios.push({numero:n,arquivo:m,caption:o.caption});return {id:{_serialized:'msg-'+envios.length}};},MessageMedia:class{constructor(tipo,data,nome){this.tipo=tipo;this.nome=nome;}}};
 const mock={exports:{}};
 vm.runInNewContext(fs.readFileSync(caminho,'utf8'),{module:mock,require:createRequire(caminho),Buffer,URL,Blob,FormData,AbortSignal,Date,process:{env:waba?{META_APP_SECRET:'segredo-teste',META_GRAPH_VERSION:'v25.0'}:{}},fetch:async(url,op)=>{if(url.endsWith('/media'))return{ok:true,json:async()=>({id:'media-teste'})};const body=JSON.parse(op.body);envios.push({numero:body.to,texto:body.text?.body,arquivo:body.document||body.image});return{ok:true,json:async()=>({messages:[{id:'msg-'+envios.length}]})};},console:{log(){},error(){}},setInterval:()=>({}),setTimeout:fn=>{fn();return {};}});
 mock.exports(ctx);
 const retorno=extra=>ctx.tratarRetornoBko({workspaceId:'grupoprime',canalId:157,numero:'5562999990001',mensagem:'APROVADO',messageId:'retorno-1',quotedId:'msg-1',verificado:true,...extra});
 return {ctx,tabelas,envios,venda,fluxo,arquivos,retorno,setConflito:()=>{conflito=true;},setFalha:()=>{falharEnvio=true;}};
}
test('envia resumo e três documentos privados para até cinco destinos, sem reenviar os concluídos',async()=>{
 const f=fixture({contatos:5});await f.ctx.verificarVendasBko();assert.equal(f.envios.length,20);assert.equal(f.venda.dados_customizados.bko_pendente,'ENVIADO');
 assert.ok(f.envios[0].texto.includes('CPF: 52998224725'));assert.ok(!f.envios[0].texto.includes('apiKey'));
 await f.ctx.verificarVendasBko();assert.equal(f.envios.length,20);
});
test('retorno por citação atualiza só a venda correta, registra auditoria e não repete evento',async()=>{
 const f=fixture();await f.ctx.verificarVendasBko();await f.retorno();assert.equal(f.venda.status_venda,'APROVADA');assert.equal(f.venda.dados_customizados.bko_retornos.length,1);assert.equal(f.tabelas.crm_automacao_estado[0].snapshot.status_venda,'AGUARDANDO AUDITORIA');
 const total=f.envios.length;await f.retorno();assert.equal(f.envios.length,total);
});
test('origem não autorizada, outro workspace, outro canal ou webhook sem assinatura não atualizam',async()=>{
 for(const extra of [{numero:'5562999999999'},{workspaceId:'outro'},{canalId:999},{verificado:false}]){const f=fixture();await f.ctx.verificarVendasBko();await f.retorno(extra);assert.equal(f.venda.status_venda,'AGUARDANDO AUDITORIA');}
});
test('sem referência ou com citação de outra venda pede identificação e não adivinha',async()=>{
 const f=fixture();await f.ctx.verificarVendasBko();await f.retorno({quotedId:null});assert.equal(f.venda.status_venda,'AGUARDANDO AUDITORIA');
 await f.retorno({quotedId:'inexistente',mensagem:'APROVADO\n#'+f.venda.dados_customizados.bko_ref});assert.equal(f.venda.status_venda,'AGUARDANDO AUDITORIA');
});
test('conflito concorrente não sobrescreve a alteração de outra pessoa',async()=>{
 const f=fixture();await f.ctx.verificarVendasBko();f.setConflito();await f.retorno();assert.equal(f.venda.status_venda,'AGUARDANDO AUDITORIA');
});
test('fluxo pausado não envia nem processa retornos; documentos de outra venda são recusados',async()=>{
 const f=fixture({ativo:false});await f.ctx.verificarVendasBko();await f.retorno();assert.equal(f.envios.length,0);assert.equal(f.venda.status_venda,'AGUARDANDO AUDITORIA');
 const g=fixture();g.venda.dados_customizados.rg_frente=g.venda.dados_customizados.rg_frente.replace('grupoprime%2F','grupoprime%2Foutro');assert.throws(()=>helpers.documentosVenda(g.venda));
 await g.ctx.verificarVendasBko();assert.equal(g.venda.dados_customizados.bko_pendente,'REVISAR');assert.equal(g.envios.length,0);
});
test('timeout fica para revisão e não reenvia automaticamente mensagem de entrega incerta',async()=>{
 const f=fixture();f.setFalha();await f.ctx.verificarVendasBko();assert.equal(f.venda.dados_customizados.bko_pendente,'REVISAR');await f.ctx.verificarVendasBko();assert.equal(f.envios.length,0);
});
test('BKO agenda e corrige a agenda da venda sem perder os dados nem mudar outra venda',async()=>{
 const f=fixture();await f.ctx.verificarVendasBko();
 await f.retorno({mensagem:'GERADA\nDATA: 25/10/2026\nPERIODO: MANHÃ'});assert.equal(f.venda.status_venda,'GERADA');assert.equal(f.venda.data_agendamento,'25/10/2026');assert.equal(f.venda.periodo_instalacao,'Manhã');
 await f.retorno({messageId:'retorno-2',mensagem:'GERADA\nDATA: 26/10/2026\nPERIODO: TARDE'});assert.equal(f.venda.dados_customizados.bko_agenda_revisada,'retorno-2');assert.equal(f.venda.nome,'Pessoa Teste');
});
test('API oficial aguarda conversa iniciada pelo BKO; webhook não autenticado não abre janela',async()=>{
 const f=fixture({waba:true});await f.ctx.verificarVendasBko();assert.equal(f.venda.dados_customizados.bko_pendente,'JANELA');assert.equal(f.envios.length,0);
 await f.retorno({mensagem:'INICIAR',quotedId:null,verificado:false});assert.equal(f.envios.length,0);assert.equal(f.fluxo.nos[0].dados.bko_janelas,undefined);
 await f.retorno({mensagem:'INICIAR',quotedId:null});await f.ctx.verificarVendasBko();assert.equal(f.venda.dados_customizados.bko_pendente,'ENVIADO');assert.equal(f.envios.filter(e=>e.arquivo).length,3);
});
