// Recupera a operação já confirmada pelo cliente; endpoint protege repetição e concorrência.
const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const d=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:s,error}=await d.from('fluxo_sessoes').select('id,variaveis,updated_at').eq('id',3640).eq('workspace_id','grupoprime').single();if(error)throw error;
 const body=s.variaveis.recuperacao_payload;if(!body||JSON.parse(body).proposta_id!=='532')throw Error('Payload não corresponde à recuperação esperada');
 const {data:f}=await d.from('fluxos').select('nos').eq('id',27).eq('workspace_id','grupoprime').single();const n=f.nos.find(n=>n.id==='prime_reversao_atualizar');
 const r=await fetch(n.dados.url,{method:'POST',headers:{...JSON.parse(n.dados.headers),'Content-Type':'application/json'},body});const out=await r.json();
 if(!r.ok||!out.success)throw Error(out.error||'Falha ao retomar');
 const v={...s.variaveis,recuperacao_resposta:JSON.stringify(out)};
 const u=await d.from('fluxo_sessoes').update({variaveis:v,status:'finalizado',no_atual:'prime_reversao_enviada',aguardando_input:false,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',s.id).eq('updated_at',s.updated_at).select('id');if(u.error||!u.data?.length)throw Error('CRM atualizado; sessão mudou durante conclusão');
 console.log(JSON.stringify({venda:out.proposta_id,status:out.status_venda,sessao:'finalizada_sem_transferencia'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
