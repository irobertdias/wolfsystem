const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in imports))throw Error(n);return imports[n];},URL,Buffer,process});return exports;}
const regras=load('app/lib/documentos-grupoprime.ts');
const cadastro=load('app/lib/cadastro-grupoprime.ts');
const cpf=load('app/lib/recuperacao-cpf-grupoprime.ts');
const validar=load('app/api/crm/grupoprime/_documentos.ts',{'node:crypto':crypto,'../../../lib/recuperacao-cpf-grupoprime':cpf,'../../../lib/documentos-grupoprime':regras}).documentosDaSessaoGrupoPrime;
function fixture(){
 const vars={cpf:'52998224725',nome:'Pessoa Teste',cep:'74480150'};
 const sessao={id:7,canal_id:'canal-teste',numero:'5511999999999',variaveis:vars,updated_at:'2026-10-16T10:00:00Z'};
 const hash=crypto.createHash('sha256').update(`grupoprime:${sessao.canal_id}:${sessao.numero}`).digest('hex').slice(0,24);
 const objetos=new Map();
 for(const regra of regras.REGRAS_DOCUMENTOS_GRUPOPRIME){
  const path=`grupoprime/${hash}/arquivos/${regra.variavel}/teste.jpg`;
  vars[regra.variavel]=JSON.stringify([{url:`/api/documentos-clientes/arquivo?workspaceId=grupoprime&path=${encodeURIComponent(path)}`,privado:true,regra_id:regra.id,tipo:'image/jpeg',tamanho:100,nome:'documento.jpg'}]);
  vars[regra.variavel+'_validado']='SIM';
  vars['__identidade_documento_'+regra.variavel]=JSON.stringify({nome:vars.nome,cpf:vars.cpf,rg:'1234'});
  objetos.set(path,{contentType:'image/jpeg',size:100,etag:regra.variavel});
 }
 const filtros=[];
 const q={select(){return q;},eq(k,v){filtros.push([k,v]);return q;},in(k,v){filtros.push([k,v]);return q;},order(){return q;},limit:async()=>({data:[sessao],error:null})};
 const db={from(t){assert.equal(t,'fluxo_sessoes');return q;},storage:{from(bucket){assert.equal(bucket,'documentos-clientes');return {info:async path=>({data:objetos.get(path)||null,error:objetos.has(path)?null:Error('ausente')})};}}};
 return {db,sessao,vars,objetos,filtros};
}
test('três arquivos reais da sessão liberam a etapa e preservam metadados privados',async()=>{
 const f=fixture(),r=await validar(f.db,f.sessao.numero,f.vars.cpf);
 assert.deepEqual(Object.keys(r.documentos),['rg_frente','rg_verso','comprovante_endereco']);
 assert.ok(r.documentos.rg_frente[0].privado);assert.ok(f.filtros.some(([k,v])=>k==='workspace_id'&&v==='grupoprime'));assert.ok(f.filtros.some(([k,v])=>k==='fluxo_id'&&v===27));
});
test('modo BKO encaminha arquivos existentes e lista CPF/documentos pendentes sem inventar validação',async()=>{const f=fixture();delete f.vars.cpf;delete f.vars.rg_verso;delete f.vars.rg_verso_validado;delete f.vars.comprovante_endereco;delete f.vars.comprovante_endereco_validado;const r=await validar(f.db,f.sessao.numero,'',undefined,false,true);assert.deepEqual(Object.keys(r.documentos),['rg_frente']);assert.ok(r.pendencias.some(p=>p.includes('CPF')));assert.ok(r.pendencias.some(p=>p.includes('verso')));assert.equal(r.documentos.comprovante_endereco,undefined);});
test('modo BKO exclui anexo de outro atendimento e sinaliza a pendência',async()=>{const f=fixture();const d=JSON.parse(f.vars.rg_frente);d[0].url='/api/documentos-clientes/arquivo?workspaceId=outro&path=outro/segredo.jpg';f.vars.rg_frente=JSON.stringify(d);const r=await validar(f.db,f.sessao.numero,f.vars.cpf,undefined,false,true);assert.equal(r.documentos.rg_frente,undefined);assert.ok(r.pendencias.some(p=>p.includes('não pertencer')));});
test('frente e verso dispensam comparação de nome, RG e CPF extraído',async()=>{
 const f=fixture();f.vars.__identidade_documento_rg_frente=JSON.stringify({nome:f.vars.nome,lado:'frente'});f.vars.__identidade_documento_rg_verso=JSON.stringify({lado:'verso'});
 await validar(f.db,f.sessao.numero,f.vars.cpf);
 f.vars.__identidade_documento_rg_frente=JSON.stringify({nome:'Outra Pessoa',lado:'frente'});
 await validar(f.db,f.sessao.numero,f.vars.cpf);
 delete f.vars.__identidade_documento_rg_frente;delete f.vars.__identidade_documento_rg_verso;
 await validar(f.db,f.sessao.numero,f.vars.cpf);
});
test('declaração SIM não substitui upload ou documento ausente',async()=>{
 for(const modo of ['flag','meta','storage']){const f=fixture();if(modo==='flag')delete f.vars.rg_verso_validado;if(modo==='meta')delete f.vars.rg_verso;if(modo==='storage')f.objetos.clear();await assert.rejects(validar(f.db,f.sessao.numero,f.vars.cpf),e=>e.statusCode===422);}
});
test('bloqueia arquivo de outro workspace ou de outro atendimento',async()=>{
 for(const modo of ['workspace','atendimento']){const f=fixture();if(modo==='workspace')f.vars.rg_frente=f.vars.rg_frente.replace('workspaceId=grupoprime','workspaceId=outro');if(modo==='atendimento')f.vars.rg_frente=f.vars.rg_frente.replace('grupoprime%2F','grupoprime%2Foutro');await assert.rejects(validar(f.db,f.sessao.numero,f.vars.cpf),e=>e.statusCode===422);}
});
test('CEP diferente no comprovante não bloqueia CRM nem altera o CEP da instalação',async()=>{
 const f=fixture();f.vars.cep_comprovante='75383126';await validar(f.db,f.sessao.numero,f.vars.cpf);assert.equal(f.vars.cep,'74480150');assert.equal(f.vars.cep_comprovante,'75383126');
});
test('não aceita a mesma foto para frente/verso ou PDF no lugar da foto do RG',async()=>{
 const repetida=fixture();for(const objeto of repetida.objetos.values())objeto.etag='mesma-foto';await assert.rejects(validar(repetida.db,repetida.sessao.numero,repetida.vars.cpf),/fotos diferentes/);
 const pdf=fixture();pdf.objetos.values().next().value.contentType='application/pdf';await assert.rejects(validar(pdf.db,pdf.sessao.numero,pdf.vars.cpf),/Formato/);
});
test('troca de titular limpa imagens antigas e prepara a conferência com o novo CPF',()=>{
 const f=regras.blocosDocumentosGrupoPrime('https://teste','token','chave');
 const script=f.nos.find(n=>n.id==='prime_reversao_documentos_preparar').dados.codigo;
 const vars={cpf:'52998224725',cpf_novo:'11144477735',nome:'Antigo',nome_novo_titular:'Novo Titular',nascimento_novo_titular:'01/01/1990',nome_mae_novo_titular:'Mae Nova',rg_frente:'arquivo antigo',rg_frente_validado:'SIM',__identidade_documento_rg_frente:'antiga'};
 new Function('variaveis','setVariable',script)(vars,(k,v)=>{vars[k]=v;});
 assert.equal(vars.cpf,'11144477735');assert.equal(vars.nome,'Novo Titular');assert.equal(vars.rg_frente,undefined);assert.equal(vars.rg_frente_validado,undefined);assert.equal(vars.__identidade_documento_rg_frente,undefined);
});
test('coleta obrigatória tem três regras e bloqueio HTTP antes de enviar venda',()=>{
 const f=regras.blocosDocumentosGrupoPrime('https://teste','token','chave');
 for(const no of f.nos.filter(n=>n.tipo==='fluxo_ia')){
  assert.equal(no.dados.arquivos_salvar_regras.length,3);assert.equal(no.dados.midia_ia_extensao_ativa,true);
  assert.equal(no.dados.variaveis.filter(v=>v.nome.endsWith('_validado')&&v.obrigatoria).length,3);
 }
 assert.equal(f.conexoes.find(c=>c.de==='prime_documentos_conferir'&&c.saidaIndex===0).para,'prime_documentos_cadastro');
 assert.equal(f.nos.find(n=>n.tipo==='enviar_venda').dados.status_inicial,'AGUARDANDO AUDITORIA');
});
function gate(vars={},erroDocumento=false){
 const dados={cpf:'52998224725',nome:'Pessoa Teste',nome_mae:'Mae Pessoa',data_nascimento:'1990-01-01',email:'teste@example.com',telefone1:'62999990001',telefone2:'6233330002',vencimento:'31',endereco_completo:'Rua Teste 10, Goiânia GO',cep:'74480150',tipo_pessoa:'PF',plano_interesse:'pf-fibra',forma_pagamento:'CARTAO',...vars};
 if(!('cadastro_confirmado' in dados))dados.cadastro_confirmado=JSON.stringify(dados);
 const mod=load('app/api/crm/grupoprime/validar-documentos/route.ts',{
  'node:crypto':crypto,'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},
  '../../../_auth':{autenticarWorkspace:async()=>({workspaceId:'grupoprime'}),exigirPermissao(){},supabaseServer:{},respostaErroAcesso:e=>({status:e.statusCode||500,message:e.message})},
  '../_documentos':{documentosDaSessaoGrupoPrime:async()=>{if(erroDocumento)throw Object.assign(Error('RG verso pendente'),{statusCode:422});return{documentos:{rg_frente:[],rg_verso:[],comprovante_endereco:[]},sessao:{id:7},variaveis:dados};}},
  '../../../../lib/recuperacao-cpf-grupoprime':cpf,
  '../../../../lib/cadastro-grupoprime':cadastro,
  '../../../../lib/viabilidade-grupoprime':{consultarViabilidade:()=>({status:'pre_viavel',cep:'74480150',cidade:'GOIANIA',uf:'GO',planos:{pessoa_fisica:[{id:'pf-fibra',nome:'Nio Fibra',velocidade_mbps:600,mensalidade:110,mensalidade_cartao:95}],pessoa_juridica:[{id:'pj-essencial',nome:'Nio Essencial',velocidade_mbps:700,mensalidade:110,mensalidade_cartao:95}]}})},
 });return()=>mod.POST({headers:new Headers(),text:async()=>JSON.stringify({numero:'5511999999999',valor_plano:1,documentos:'declaração não vale'})});
}
test('conferência usa preço do catálogo e ignora valor enviado pelo chamador',async()=>{
 const cartao=await gate()();assert.equal(cartao.status,200);assert.equal(cartao.body.cadastro.valor_plano,95);
 const outra=await gate({forma_pagamento:'BOLETO'})();assert.equal(outra.body.cadastro.valor_plano,110);assert.equal(outra.body.cadastro.forma_pagamento,'Boleto Bancário');
 const negacao=await gate({forma_pagamento:'não quero cartão'})();assert.equal(negacao.status,422);
 const mistura=await gate({tipo_pessoa:'PJ',plano_interesse:'pf-fibra'})();assert.equal(mistura.status,422);
});
test('CRM recebe e-mail, os dois contatos, vencimento e modalidade confirmados; sem confirmação bloqueia',async()=>{
 const r=await gate()();assert.equal(r.body.cadastro.email,'teste@example.com');assert.equal(r.body.cadastro.telefone1,'5562999990001');assert.equal(r.body.cadastro.telefone2,'556233330002');assert.equal(r.body.cadastro.vencimento,'31');
 assert.equal((await gate({cadastro_confirmado:''})()).status,422);
 assert.equal((await gate({telefone2:'62999990001'})()).status,422);
 assert.equal((await gate({vencimento:'32'})()).status,422);
});
test('a conferência interrompe o envio sem documento real',async()=>{
 const r=await gate({},true)();assert.equal(r.status,422);assert.equal(r.body.success,false);assert.equal(r.body.cadastro,undefined);
});
function downloadApi(usuario){let downloads=0;const db={auth:{getUser:async()=>({data:{user:usuario},error:null})},storage:{from(){return{download:async()=>{downloads++;return{data:new Blob(['arquivo sintético'],{type:'image/jpeg'}),error:null};}}}}};
 class NextResponse{constructor(body,options){this.body=body;this.status=options.status;this.headers=options.headers;}static json(body,o){return{body,status:o?.status||200};}}
 const api=load('app/api/documentos-clientes/arquivo/route.ts',{'@supabase/supabase-js':{createClient:()=>db},'next/server':{NextResponse}});
 return{api,downloads:()=>downloads};}
test('BKO pode abrir arquivo privado autenticado sem publicar link de storage',async()=>{
 const a=downloadApi({id:'admin',email:'robert.dias@live.com'});
 const r=await a.api.GET({headers:new Headers({Authorization:'Bearer teste'}),nextUrl:new URL('https://teste/api?workspaceId=grupoprime&path=grupoprime/cliente/arquivo.jpg&nome=RG.jpg')});
 assert.equal(r.status,200);assert.equal(a.downloads(),1);assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('arquivo não é entregue sem sessão ou com caminho de outra conta',async()=>{
 const a=downloadApi({id:'admin',email:'robert.dias@live.com'});
 const req={headers:new Headers(),nextUrl:new URL('https://teste/api?workspaceId=grupoprime&path=grupoprime/arquivo.jpg')};
 assert.equal((await a.api.GET(req)).status,401);assert.equal(a.downloads(),0);
 req.headers=new Headers({Authorization:'Bearer teste'});req.nextUrl=new URL('https://teste/api?workspaceId=grupoprime&path=outro/arquivo.jpg');
 assert.equal((await a.api.GET(req)).status,403);assert.equal(a.downloads(),0);
});
