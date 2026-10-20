const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/vendedor-grupoprime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
 const cadastro={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/cadastro-grupoprime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:cadastro});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:f,error}=await db.from('fluxos').select('id,nos').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const indice=f.nos.findIndex(n=>n.id==='prime_documentos_enviar');if(indice<0)throw Error('Fluxo incompatível');
 const versao=f.nos[indice].dados.bko_versao;
 const principal=exports.criarVendedorGrupoPrime('','').nos.find(n=>n.id==='prime_vendedor').dados.prompt;
 let total=0;
 const nos=f.nos.map(n=>{
  if(n.tipo!=='fluxo_ia')return n;
  let prompt=n.dados.prompt||'';
  if(n.id==='prime_vendedor')prompt=principal;
  else if(n.id==='prime_endereco_ia')prompt=exports.etapaEnderecoGrupoPrime('').dados.prompt;
  else if(n.id==='prime_cadastro_ia')prompt=cadastro.blocosCadastroGrupoPrime('').nos.find(x=>x.id===n.id).dados.prompt+'\n\n'+exports.CONDUCAO_COMERCIAL_GRUPOPRIME;
  else if(!prompt.includes('CONDUÇÃO COMERCIAL ATIVA V2:'))prompt+='\n\n'+exports.CONDUCAO_COMERCIAL_GRUPOPRIME;
  total++;return {...n,dados:{...n.dados,prompt}};
 });
 nos[indice]={...nos[indice],dados:{...nos[indice].dados,bko_versao:randomUUID()}};
 let q=db.from('fluxos').update({nos}).eq('workspace_id','grupoprime').eq('id',27);
 q=versao?q.eq(`nos->${indice}->dados->>bko_versao`,versao):q.is(`nos->${indice}->dados->>bko_versao`,null);
 const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo mudou; atualização recusada');
 const {data:verificado,error:erroVerificacao}=await db.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',27).single();if(erroVerificacao)throw erroVerificacao;
 if(verificado.nos.filter(n=>n.tipo==='fluxo_ia').some(n=>!n.dados.prompt.includes('CONDUÇÃO COMERCIAL ATIVA V2:')))throw Error('Verificação incompleta');
 console.log(JSON.stringify({fluxo:27,etapasAtualizadas:total,verificado:true,canaisEDestinosPreservados:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
