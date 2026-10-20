const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{randomUUID}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const carregar=p=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;};
(async()=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:f,error}=await db.from('fluxos').select('id,nos,conexoes').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const docs=carregar('app/lib/documentos-grupoprime.ts'),rec=carregar('app/lib/recuperacao-cpf-grupoprime.ts');
 const blocos=[docs.blocosDocumentosGrupoPrime('','',''),rec.blocosRecuperacaoGrupoPrime('','','')];
 const ids=['prime_reversao_enviada','prime_documentos_pendencia','prime_reversao_pendencia','prime_reversao_snapshot','prime_documentos_cadastro'];
 const novos=blocos.flatMap(b=>b.nos).filter(n=>ids.includes(n.id));
 const nos=f.nos.map(n=>novos.find(x=>x.id===n.id)||n);for(const n of novos)if(!nos.some(x=>x.id===n.id))nos.push(n);
 for(const n of nos)if(['prime_documentos_ia','prime_reversao_documentos_ia'].includes(n.id))n.dados.prompt=docs.PROMPT_DOCUMENTOS_GRUPOPRIME;
 const edges=blocos.flatMap(b=>b.conexoes).filter(c=>ids.includes(c.de)||(c.de==='prime_reversao_atualizar'&&c.saidaIndex===1)||(c.de==='prime_documentos_conferir'&&c.saidaIndex===1));
 const conexoes=f.conexoes.filter(c=>!edges.some(e=>e.de===c.de&&e.saidaIndex===c.saidaIndex)).concat(edges);
 const i=nos.findIndex(n=>n.id==='prime_documentos_enviar'),version=f.nos[i].dados.bko_versao;nos[i].dados.bko_versao=randomUUID();
 let q=db.from('fluxos').update({nos,conexoes}).eq('workspace_id','grupoprime').eq('id',27);q=version?q.eq(`nos->${i}->dados->>bko_versao`,version):q.is(`nos->${i}->dados->>bko_versao`,null);
 const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Configuração mudou durante atualização');
 console.log('Conclusão sem transferência aplicada; canais, destinos BKO e ativação preservados.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
