const fs=require('node:fs'),path=require('node:path'),{configurar:configurarBase}=require('./config.cjs'),{configurarComercial}=require('./config-comercial.cjs');
const configurar=f=>configurarComercial(configurarBase(f));
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');require(require.resolve('dotenv',{paths:[root]})).config({path:path.join(root,'.env'),quiet:true});
const{createClient}=require(require.resolve('@supabase/supabase-js',{paths:[root]}));
(async()=>{
 const pronto=await fetch('https://app.wolfgyn.com.br/api/crm/grupoprime/preparar-bko',{signal:AbortSignal.timeout(15000)});const api=await pronto.json();if(!pronto.ok||api.versao!=='venda-fluida-v1'||api.roteiro_comercial!==3)throw Error('API nova ainda não publicada; fluxos preservados. Reexecute após publicação.');
 const headers={'x-wolf-internal-secret':process.env.WOLF_INTERNAL_API_SECRET||process.env.WOLF_SIGNATURE_PROXY_SECRET||''};let backend=false;
 for(let i=0;i<15;i++){try{const r=await fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/bko/health',{headers,signal:AbortSignal.timeout(2000)});const h=await r.json();if(h.venda_fluida===true&&h.roteiro_comercial===3){backend=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!backend)throw Error('Backend não confirmou suporte ao fluxo fluido; configurações preservadas.');
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY),planos=[];
 for(const id of [27,28]){const{data:f,error}=await db.from('fluxos').select('id,workspace_id,nos,conexoes,ativo').eq('workspace_id','grupoprime').eq('id',id).single();if(error)throw error;const i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar');if(i<0)throw Error('Fluxo incompatível');planos.push({f,i,versao:f.nos[i].dados.bko_versao,novo:configurar(f)});}
 const backup=path.join(root,'backups','venda-fluida-config-'+Date.now()+'.json');fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,JSON.stringify(planos.map(p=>p.f)),{mode:0o600});const aplicados=[];
 try{for(const p of planos){let q=db.from('fluxos').update({nos:p.novo.nos,conexoes:p.novo.conexoes}).eq('workspace_id','grupoprime').eq('id',p.f.id);q=p.versao?q.eq(`nos->${p.i}->dados->>bko_versao`,p.versao):q.is(`nos->${p.i}->dados->>bko_versao`,null);const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo mudou durante a atualização');aplicados.push(p);}}
 catch(e){for(const p of aplicados){const r=await db.from('fluxos').update({nos:p.f.nos,conexoes:p.f.conexoes}).eq('workspace_id','grupoprime').eq('id',p.f.id).eq(`nos->${p.i}->dados->>bko_versao`,p.novo.nos[p.i].dados.bko_versao).select('id').maybeSingle();if(r.error||!r.data)console.error('Não foi possível restaurar automaticamente fluxo '+p.f.id+'; use backup '+backup);}throw e;}
 console.log('VENDA_FLUIDA_ATIVA: Nio 27 e Vero 28; canais, filas e contatos BKO preservados. Backup: '+backup);
})().catch(e=>{console.error(e.message);process.exitCode=1});
