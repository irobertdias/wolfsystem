'use strict';
// Corrige somente o status legado incorreto de chats já encerrados pelo motor.
const fs=require('node:fs'),path=require('node:path'),root='/root/wolf-whatsapp';
require(require.resolve('dotenv',{paths:[root]})).config({path:root+'/.env',quiet:true});
const db=require(require.resolve('@supabase/supabase-js',{paths:[root]})).createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY);
const aplicar=process.argv.includes('--aplicar'),parse=v=>typeof v==='string'?JSON.parse(v):v||{};
(async()=>{
 const q=await db.from('atendimentos').select('*').eq('workspace_id','grupoprime').in('canal_id',[164,165]).eq('status','finalizado');if(q.error)throw q.error;
 let total=0;
 for(const at of q.data){
  const sess=await db.from('fluxo_sessoes').select('*').eq('workspace_id',at.workspace_id).eq('canal_id',at.canal_id).eq('numero',at.numero).order('updated_at',{ascending:false}).limit(1);if(sess.error)throw sess.error;
  const row=sess.data?.[0];if(!row)continue;
  const ext=parse(row.variaveis?.__universal_v2||row.variaveis?.__universal_v1),s=ext.nio||ext;
  if(!ext.encerrado&&s.etapa!=='encerrado')continue;
  console.log(JSON.stringify({atendimento:at.id,sessao:row.id,canal:at.canal_id,anterior:at.status,novo:'resolvido',inviavel:!!s.encerramentoInviavel,alvoFoto:/FERNANDO.*FIGUEIRA|26171100/i.test(JSON.stringify(s.dados||{}))}));
  if(!aplicar)continue;
  const backup=path.join(root,'backups',`encerramento-${at.id}-${Date.now()}.json`);fs.writeFileSync(backup,JSON.stringify({atendimento:at,sessao:row}),{mode:0o600});
  const r=await db.from('atendimentos').update({status:'resolvido',bloqueado_ia:true,bloqueado_fluxo:true,bloqueado_typebot:true,updated_at:new Date().toISOString()}).eq('id',at.id).eq('workspace_id',at.workspace_id).eq('canal_id',at.canal_id).eq('status','finalizado').eq('updated_at',at.updated_at).select('id');if(r.error)throw r.error;if(!r.data.length){console.log('ALTERADO_POR_OUTRA_OPERACAO',at.id);continue;}
  if(row.status==='ativo'){const f=await db.from('fluxo_sessoes').update({status:'finalizado',aguardando_input:false,tipo_input_aguardado:null,updated_at:new Date().toISOString()}).eq('id',row.id).eq('workspace_id',at.workspace_id).eq('canal_id',at.canal_id).eq('updated_at',row.updated_at);if(f.error)throw f.error;}
  total++;
 }
 console.log('REGULARIZADOS',total,'APLICAR',aplicar);
})().catch(e=>{console.error(e.message);process.exitCode=1});
