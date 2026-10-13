const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in imports))throw Error(n);return imports[n];},Date});return exports;}
const helper=load('app/lib/contratos-empresas.ts');
const empresas=[{id:'a',workspace_id:'ws',ativa:true,razao_social:'Alpha',cnpj:'11111111000111'},{id:'b',workspace_id:'ws',ativa:true,razao_social:'Beta',cnpj:'22222222000122'},{id:'x',workspace_id:'outro',ativa:true,razao_social:'Outra'}];
const reps=[{id:'ra',empresa_id:'a',workspace_id:'ws',ativo:true,nome:'Pessoa',email:'igual@example.com',padrao:true},{id:'rb',empresa_id:'b',workspace_id:'ws',ativo:true,nome:'Pessoa',email:'igual@example.com',padrao:true},{id:'rx',empresa_id:'x',workspace_id:'outro',ativo:true,nome:'Pessoa'}];
function banco() {
 const calls=[];return {calls,from(table){const filtros=[];calls.push([table,filtros]);const rows=()=> (table==='assinatura_wolf_empresas'?empresas:reps).filter(r=>filtros.every(([k,v,op])=>op==='in'?v.includes(r[k]):r[k]===v));
 const q={select(){return q;},eq(k,v){filtros.push([k,v]);return q;},in(k,v){filtros.push([k,v,'in']);return q;},order(){return q;},maybeSingle:async()=>({data:rows()[0]||null,error:null}),then(resolve,reject){return Promise.resolve({data:rows(),error:null}).then(resolve,reject);}};return q;}};
}
function api() {const db=banco();let rpcCalls=[];db.rpc=async(name,args)=>{rpcCalls.push([name,args]);return {data:{empresa:{id:'nova'},representantes:[]},error:null};};const auth={autenticarContratos:async()=>({workspaceId:'ws'}),exigirPermissaoContratos(){},respostaErroContratos:e=>({status:e.statusCode||500,message:e.message}),supabaseContratos:db};
 const NextResponse={json:(body,options)=>({body,status:options?.status||200})};
 return {...load('app/api/contratos/empresa/route.ts',{'next/server':{NextResponse},'../_auth':auth,'../../../lib/contratos-empresas':helper}),db,rpcCalls};
}
test('GET lista empresas do workspace e separa representantes por empresa',async()=>{
 const a=api(),r=await a.GET({nextUrl:new URL('https://teste/empresa?workspaceId=ws')});
 assert.equal(r.status,200);assert.deepEqual(Array.from(r.body.empresas,e=>e.id),['a','b']);
 assert.deepEqual(Array.from(r.body.empresas[0].representantes,r=>r.id),['ra']);assert.deepEqual(Array.from(r.body.empresas[1].representantes,r=>r.id),['rb']);
 assert.equal(r.body.empresa.id,'a');assert.equal(r.body.representantes[0].id,'ra');
});
test('GET não seleciona empresa de outro workspace',async()=>{
 const a=api(),r=await a.GET({nextUrl:new URL('https://teste/empresa?workspaceId=ws&empresaId=x')});assert.equal(r.status,404);
});
test('validacao de cadastro acontece antes de qualquer gravacao',async()=>{
 const a=api(),r=await a.PUT({json:async()=>({workspaceId:'ws',empresa:{razao_social:'A'},representantes:[]})});
 assert.equal(r.status,400);assert.equal(a.rpcCalls.length,0);
});
test('salvamento usa RPC transacional com workspace autenticado',async()=>{
 const a=api(),r=await a.PUT({json:async()=>({workspaceId:'forjado',empresa:{razao_social:'Empresa',cnpj:'12345678000190',endereco_completo:'Rua Completa 123',email:'empresa@example.com'},representantes:[{nome:'Pessoa Completa',cpf:'12345678901',cargo:'Diretor',numero:'11999999999',email:'rep@example.com'}]})});
 assert.equal(r.status,200);assert.equal(a.rpcCalls[0][0],'assinatura_wolf_salvar_empresa');assert.equal(a.rpcCalls[0][1].p_workspace_id,'ws');assert.equal(a.rpcCalls[0][1].p_empresa_id,null);
});
test('criacao rejeita representante da empresa errada ou de outro workspace',async()=>{
 const db=banco();const api=load('app/api/contratos/_empresa.ts',{'./_auth':{supabaseContratos:db}});
 assert.equal(await api.validarEmpresaRepresentante('ws','b','rb'),'b');
 await assert.rejects(api.validarEmpresaRepresentante('ws','a','rb'),/representante/i);
 await assert.rejects(api.validarEmpresaRepresentante('ws','x','rx'),/representante/i);
 assert.equal(await api.validarEmpresaRepresentante('ws','','rb'),'b','cliente antigo deriva empresa a partir do representante');
});
test('edicao recupera empresa por ID do snapshot, mesmo com representantes homonimos',()=>{
 const lista=[{...empresas[0],representantes:[reps[0]]},{...empresas[1],representantes:[reps[1]]}];
 const e=helper.empresaDoContrato(lista,{empresa_id:'b',representante_id:'rb'});assert.equal(e.id,'b');assert.equal(helper.representantePadrao(e).id,'rb');
 assert.equal(helper.formatarCnpj('12345678000190'),'12.345.678/0001-90');
});
