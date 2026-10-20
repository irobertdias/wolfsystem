const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createClient}=require('@supabase/supabase-js');
(async()=>{
 const arquivo=path.resolve(process.argv[2]);const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:f,error}=await db.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const dados=f.nos.find(n=>n.id==='prime_reversao_documentos_ia').dados;
 const s=require('../deploy/prime-documentos/patch.cjs').visao(fs.readFileSync('D:/GERAL/wolf-whatsapp/src/services/fluxo-ia-multimidia.js','utf8'));
 const mod={exports:{}};vm.runInNewContext(s,{module:mod,require:n=>{if(n==='openai')return class{};throw Error(n)},console:{log(){},error(){}},Buffer});
 const ctx={fs,path,AUDIOS_DIR:path.dirname(arquivo),extensaoFluxoIAAtiva:async()=>true,CHAVES_EXTENSOES_FLUXO_IA:{multimidia:'multimidia'}};mod.exports(ctx);
 const cliente=()=>({responses:{create:async body=>{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+dados.apiKey,'Content-Type':'application/json'},body:JSON.stringify({...body,store:false}),signal:AbortSignal.timeout(60000)});
  const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Falha API');return{output_text:j.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')};
 }}});
 const cfg={...dados,prime_leitura_documental:true,variaveis:[{nome:'nome',tipo:'texto',label:'Nome impresso do titular'},{nome:'endereco_comprovante',tipo:'texto'},{nome:'cep_comprovante',tipo:'texto'}]};
 const r=await ctx.analisarMidiaFluxoIA(cfg,'[img:'+path.basename(arquivo)+']',{workspaceId:'grupoprime',canalId:158,numero:'teste',fluxoId:27,criarCliente:cliente});
 console.log(JSON.stringify({erro:r.erro,lado:r.ladoDocumento,regra:r.regraArquivoId,nome_lido:r.dadosExtraidos?.nome}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
