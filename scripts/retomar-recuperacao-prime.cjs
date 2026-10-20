const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const id=Number(process.argv[2]),vendaId=Number(process.argv[3]);if(!Number.isSafeInteger(id)||!Number.isSafeInteger(vendaId))throw Error('Informe sessão e venda');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const {data:s,error}=await db.from('fluxo_sessoes').select('*').eq('workspace_id','grupoprime').eq('id',id).single();if(error)throw error;
 const {data:v}=await db.from('proposta').select('*').eq('workspace_id','grupoprime').eq('id',vendaId).single();
 const vars={...s.variaveis},body=JSON.parse(vars.recuperacao_payload||'{}');
 if(Number(body.proposta_id)!==vendaId||String(vars.proposta_id)!==String(vendaId)||body.cpf_novo!==vars.cpf)throw Error('Sessão não corresponde à recuperação');
 if(v.status_venda!=='CPF REPROVADO')throw Error('Status atual não permite recuperação');
 if(body.cpf_reprovado!==v.cpf){
  const h=v.dados_customizados?.recuperacao_cpf_historico||[],ultimo=h.at(-1);
  if(ultimo?.cpf_novo!==v.cpf||!h.some(x=>x.cpf_anterior===body.cpf_reprovado))throw Error('Referência antiga não corresponde ao histórico da venda');
  vars.recuperacao_referencia_corrigida=JSON.stringify({anterior:body.cpf_reprovado,atual:v.cpf,em:new Date().toISOString(),motivo:'Titular vigente no CRM após recuperação anterior'});
  body.cpf_reprovado=v.cpf;vars.cpf_reprovado=v.cpf;vars.recuperacao_payload=JSON.stringify(body);
 }
 let r=await db.from('fluxo_sessoes').update({variaveis:vars,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',id).eq('updated_at',s.updated_at).select('updated_at').single();if(r.error)throw r.error;
 const versao=r.data.updated_at;
 const {data:f}=await db.from('fluxos').select('nos').eq('workspace_id','grupoprime').eq('id',27).single();const n=f.nos.find(x=>x.id==='prime_reversao_atualizar');
 const resp=await fetch(n.dados.url,{method:'POST',headers:{...JSON.parse(n.dados.headers),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const out=await resp.json();if(!resp.ok||!out.success)throw Error(out.error||'Falha no CRM');
 // Compatibilidade durante a publicação: alinhar o snapshot com o titular canônico salvo.
 for(let i=0;i<3;i++){
  const {data:atual}=await db.from('proposta').select('*').eq('workspace_id','grupoprime').eq('id',vendaId).single();
  if(atual.cpf!==body.cpf_novo)throw Error('Titular mudou durante a retomada');
  const c={...atual.dados_customizados,...Object.fromEntries(['cpf','nome','data_nascimento','nome_mae','rg','email'].map(k=>[k,atual[k]??'']))};
  const fix=await db.from('proposta').update({dados_customizados:c,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',vendaId).eq('updated_at',atual.updated_at).select('id');if(fix.error)throw fix.error;if(fix.data.length)break;if(i===2)throw Error('CRM salvo; snapshot concorreu com outra alteração');
 }
 vars.recuperacao_resposta=JSON.stringify(out);
 r=await db.from('fluxo_sessoes').update({variaveis:vars,status:'finalizado',no_atual:'prime_reversao_enviada',aguardando_input:false,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',id).eq('updated_at',versao).select('id');if(r.error||!r.data.length)throw Error('CRM salvo; sessão mudou antes da finalização');
 console.log(JSON.stringify({venda:vendaId,status:out.status_venda,sessao_finalizada:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
