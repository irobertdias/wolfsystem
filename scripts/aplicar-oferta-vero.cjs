const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),{randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const cache={};function load(p){if(cache[p])return cache[p];const exports={};cache[p]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>load(path.join(path.dirname(p),n)+'.ts')});return exports;}
(async()=>{
 const roteiro=load('app/lib/vendedor-vero.ts').PASSAGEM_OFERTA_VERO;
 const d=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:f,error}=await d.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',28).single();if(error)throw error;
 const i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar');if(i<0)throw Error('Fluxo incompatível');const versao=f.nos[i].dados.bko_versao;
 const n=f.nos.find(n=>n.id==='prime_vendedor');if(n?.dados?.perfil_vendedor!=='vero-v1')throw Error('Fluxo não é Vero');
 if(!n.dados.prompt.includes('TRANSIÇÃO OBRIGATÓRIA CEP → PÚBLICO → CATÁLOGO:'))n.dados.prompt=roteiro+'\n\n'+n.dados.prompt;
 f.nos[i].dados.bko_versao=randomUUID();let q=d.from('fluxos').update({nos:f.nos}).eq('workspace_id','grupoprime').eq('id',28);
 q=versao?q.eq(`nos->${i}->dados->>bko_versao`,versao):q.is(`nos->${i}->dados->>bko_versao`,null);
 const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo mudou; nada sobrescrito');
 console.log('Transição comercial Vero atualizada no fluxo 28; ativação, canal e BKO preservados.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
