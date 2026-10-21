const{createClient}=require('@supabase/supabase-js'),{randomUUID}=require('node:crypto');
(async()=>{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY),fluxos=[];
for(const id of [27,28]){const{data:f,error}=await db.from('fluxos').select('id,nos').eq('workspace_id','grupoprime').eq('id',id).single();if(error)throw error;fluxos.push(f);}
const contatos=fluxos.flatMap(f=>f.nos.find(n=>n.id==='prime_documentos_enviar')?.dados?.bko_configuracao?.contatos||[]);
for(const[id,canal,final,marca]of [[27,158,'2373','NIO'],[28,162,'0082','VERO']]){
 const candidatos=contatos.filter(c=>String(c.numero).replace(/\D/g,'').endsWith(final));const numeros=[...new Set(candidatos.map(c=>String(c.numero).replace(/\D/g,'')))];if(numeros.length!==1||!/^55\d{10,11}$/.test(numeros[0]))throw Error('Número BKO ambíguo ou inválido; nada adivinhado.');
 const{data:c,error}=await db.from('conexoes').select('id,nome,fila,fluxo_id').eq('workspace_id','grupoprime').eq('id',canal).single();if(error)throw error;if(Number(c.fluxo_id)!==id||!String(c.nome).toUpperCase().includes(marca))throw Error('Vínculo de canal alterado; configuração preservada.');
 const f=fluxos.find(f=>f.id===id),i=f.nos.findIndex(n=>n.id==='prime_documentos_enviar'),n=f.nos[i],versao=n.dados.bko_versao,cfg=n.dados.bko_configuracao;
 const atual=cfg.contatos.find(x=>Number(x.canal_trafego_id)===canal)||candidatos[0];
 const novo={...atual,numero:numeros[0],canal_trafego_id:canal,fila_nome:c.fila};
 cfg.modo='por_canal';cfg.canal_trafego_id=canal;cfg.fila_nome=c.fila;cfg.contatos=[...cfg.contatos.filter(x=>Number(x.canal_trafego_id)!==canal),novo];n.dados.bko_versao=randomUUID();
 let q=db.from('fluxos').update({nos:f.nos}).eq('workspace_id','grupoprime').eq('id',id);q=versao?q.eq(`nos->${i}->dados->>bko_versao`,versao):q.is(`nos->${i}->dados->>bko_versao`,null);const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Configuração alterada durante a atualização');
 console.log(marca+': canal '+canal+', fila '+c.fila+', BKO final '+final+'. Canal de envio preservado.');
}})().catch(e=>{console.error(e.message);process.exitCode=1});
