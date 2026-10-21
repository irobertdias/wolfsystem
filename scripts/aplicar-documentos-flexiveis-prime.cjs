const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const carregar=p=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports};
(async()=>{
 const docs=carregar('app/lib/documentos-grupoprime.ts'),vendedor=carregar('app/lib/vendedor-grupoprime.ts');
 const d=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:f,error}=await d.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar');if(i<0)throw Error('Fluxo incompatível');const versao=f.nos[i].dados.bko_versao;
 const nos=f.nos.map(n=>['prime_documentos_ia','prime_reversao_documentos_ia'].includes(n.id)?{...n,dados:{...n.dados,prompt:docs.PROMPT_DOCUMENTOS_GRUPOPRIME+'\n\n'+vendedor.CONDUCAO_COMERCIAL_GRUPOPRIME,arquivos_salvar_regras:docs.REGRAS_DOCUMENTOS_GRUPOPRIME}}:n);
 nos[i]={...nos[i],dados:{...nos[i].dados,bko_versao:randomUUID()}};
 let q=d.from('fluxos').update({nos}).eq('workspace_id','grupoprime').eq('id',27);q=versao?q.eq(`nos->${i}->dados->>bko_versao`,versao):q.is(`nos->${i}->dados->>bko_versao`,null);
 const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo mudou; atualização não aplicada');console.log('Documentos sem comparação de nome: instruções e regras atualizadas nas duas etapas; destinos e grafo preservados.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
