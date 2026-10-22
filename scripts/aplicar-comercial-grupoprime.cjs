'use strict';
const{createClient}=require('@supabase/supabase-js'),{randomUUID}=require('node:crypto');
const{configurarComercial}=require('../deploy/venda-fluida/config-comercial.cjs');
(async()=>{
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 for(const id of [27,28]){
  const{data:f,error}=await db.from('fluxos').select('id,workspace_id,nos,conexoes,ativo').eq('workspace_id','grupoprime').eq('id',id).single();if(error)throw error;
  const novo=configurarComercial(f),indice=novo.nos.findIndex(n=>n.id==='prime_documentos_enviar'),versao=f.nos[indice].dados.bko_versao;
  const cfg=novo.nos[indice].dados.bko_configuracao;
  const{data:canais,error:ec}=await db.from('conexoes').select('id,nome,fluxo_id,fila').eq('workspace_id','grupoprime').eq('fluxo_id',String(id));if(ec)throw ec;
  const referencia=cfg.contatos.find(c=>String(c.numero).endsWith(id===27?'2373':'0082'));if(!referencia)throw Error('BKO da operadora não encontrado');
  for(const canal of canais||[])if(!cfg.contatos.some(c=>Number(c.canal_trafego_id)===canal.id))cfg.contatos.push({...referencia,canal_trafego_id:canal.id,fila_nome:canal.fila});
  novo.nos[indice].dados.bko_versao=randomUUID();
  let q=db.from('fluxos').update({nos:novo.nos}).eq('workspace_id','grupoprime').eq('id',id);
  q=versao?q.eq(`nos->${indice}->dados->>bko_versao`,versao):q.is(`nos->${indice}->dados->>bko_versao`,null);
  const r=await q.select('id').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Fluxo alterado durante atualização');
  console.log('Fluxo '+id+': ordem e consulta de cidade atualizadas; dez mensagens diferentes por etapa; intervalos preservados; encerramento após décima; canal de envio BKO '+cfg.canal_id+' preservado.');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
