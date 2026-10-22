'use strict';
const{createClient}=require('@supabase/supabase-js'),{randomUUID}=require('node:crypto');
(async()=>{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:c,error:ec}=await db.from('conexoes').select('id,workspace_id,modo,fluxo_id,fila,modulos').eq('workspace_id','grupoprime').eq('id',161).single();if(ec)throw ec;if(c.modo!=='fluxo'||Number(c.fluxo_id)!==27||c.fila!=='VENDAS NIO')throw Error('Canal 161 não está vinculado ao vendedor Nio esperado; configuração preservada.');
 const{data:f,error}=await db.from('fluxos').select('id,nos').eq('workspace_id','grupoprime').eq('id',27).single();if(error)throw error;
 const i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar'),n=f.nos[i],cfg=n?.dados?.bko_configuracao;if(!cfg?.ativo||Number(cfg.canal_id)!==161||cfg.modo!=='por_canal')throw Error('BKO não usa o canal 161 esperado');
 const numeros=[...new Set(cfg.contatos.map(c=>String(c.numero)))];if(numeros.length!==1||!numeros[0].endsWith('2373'))throw Error('Destinatário Nio ambíguo; nenhuma alteração aplicada');
 const versao=n.dados.bko_versao;cfg.contatos=[...cfg.contatos.filter(x=>Number(x.canal_trafego_id)!==161),{...cfg.contatos[0],canal_trafego_id:161,fila_nome:c.fila}];n.dados.bko_versao=randomUUID();
 let q=db.from('fluxos').update({nos:f.nos}).eq('workspace_id','grupoprime').eq('id',27);q=versao?q.eq(`nos->${i}->dados->>bko_versao`,versao):q.is(`nos->${i}->dados->>bko_versao`,null);const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo alterado durante atualização');
 if((c.modulos||[]).includes('somente_confirmacoes_bko')){const u=await db.from('conexoes').update({modulos:c.modulos.filter(x=>x!=='somente_confirmacoes_bko')}).eq('workspace_id','grupoprime').eq('id',161).eq('fluxo_id',c.fluxo_id).select('id').maybeSingle();if(u.error||!u.data)throw Error(u.error?.message||'Canal alterado durante atualização');}
 console.log('Canal 161: atendimento Nio + envio BKO; origem 161 roteada ao mesmo destinatário Nio final 2373. Canais 162/163 e destino Vero preservados.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
