const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{createHmac}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const cache={};function load(p){if(cache[p])return cache[p];const exports={};cache[p]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>load(require('node:path').join(require('node:path').dirname(p),n)+'.ts')});return exports;}
(async()=>{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY),lib=load('app/lib/vendedor-vero.ts');
 const {data:f,error}=await db.from('fluxos').select('nos,conexoes').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const secret=process.env.WOLF_VIABILIDADE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw Error('Segredo ausente');
 const token=t=>createHmac('sha256',secret).update(`wolf:${t}:grupoprime:vero:v1`).digest('hex');
 const novo=lib.criarFluxoVero(f,'https://app.wolfgyn.com.br',{consulta:token('viabilidade'),documentos:token('documentos'),recuperacao:token('recuperacao-cpf')});
 const {data:existente,error:e}=await db.from('fluxos').select('id').eq('workspace_id','grupoprime').eq('nome',novo.nome).maybeSingle();if(e)throw e;if(existente){console.log(JSON.stringify({id:existente.id,criado:false}));return;}
 const {data,error:erro}=await db.from('fluxos').insert(novo).select('id,nome,ativo').single();if(erro)throw erro;console.log(JSON.stringify({...data,criado:true,nos:novo.nos.length,conexoes:novo.conexoes.length}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
