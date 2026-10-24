'use strict';
const {finalizarConversa}=require('./finalizar-conversa.cjs');
const parse=v=>typeof v==='string'?JSON.parse(v):v||{};
const MENSAGEM='Como não há disponibilidade confirmada para esse imóvel e não recebemos outro endereço para consultar, vou finalizar o atendimento por enquanto. Se tiver outro endereço futuramente, é só chamar. 💚';
function expirou(row,ultima,agora,minutos=15){const data=Math.max(Date.parse(row.updated_at)||0,Date.parse(ultima?.created_at)||0);return data>0&&agora-data>=minutos*60000;}
function criar({db,workspace,enviar,agora=Date.now,ocupado=()=>false}){
 let rodando=false;
 return async function executar(){
  if(rodando)return [];rodando=true;const feitos=[];
  try{
   const r=await db.from('fluxo_sessoes').select('*').eq('workspace_id',workspace).eq('status','ativo').in('tipo_input_aguardado',['assistente_universal','nicho_atendimento']).limit(200);if(r.error)throw r.error;
   for(const row of r.data||[]){
    const key=row.variaveis?.__universal_v2?'__universal_v2':'__universal_v1',ext=parse(row.variaveis?.[key]),s=ext.nio||ext;
    if(s.etapa!=='outro_endereco'||!s.enderecosInviaveis?.length||s.proposta_id||ext.proposta_id||ocupado(row.canal_id,row.numero)||!expirou(row,null,agora()))continue;
    const at=await db.from('atendimentos').select('*').eq('workspace_id',workspace).eq('canal_id',row.canal_id).eq('numero',row.numero).order('updated_at',{ascending:false}).limit(1);if(at.error)throw at.error;
    const a=at.data?.[0];if(!a||a.status==='resolvido'||a.atendente!=='BOT'||a.bloqueado_ia||a.bloqueado_fluxo)continue;
    const m=await db.from('mensagens').select('id,created_at').eq('workspace_id',workspace).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(1);if(m.error)throw m.error;if(!expirou(row,m.data?.[0],agora()))continue;
    s.etapa='encerrado';s.encerramentoInviavel=true;s.encerradoPorInatividadeInviavel=new Date(agora()).toISOString();s.pendentes=[];
    const claim=await db.from('fluxo_sessoes').update({variaveis:{...row.variaveis,[key]:JSON.stringify(ext)},updated_at:new Date(agora()).toISOString()}).eq('workspace_id',workspace).eq('id',row.id).eq('updated_at',row.updated_at).eq('status','ativo').select('id');if(claim.error)throw claim.error;if(!claim.data?.length)continue;
    // O status é encerrado mesmo se o aviso falhar: a indisponibilidade já foi comunicada.
    await finalizarConversa(db,workspace,row.canal_id,row.numero);
    let aviso=true;try{await enviar(row,MENSAGEM);}catch(e){aviso=false;console.error('[Universal aviso encerramento inviável]',row.id,e.message);}
    feitos.push({sessao:row.id,atendimento:a.id,aviso});
   }
  }finally{rodando=false;}
  return feitos;
 };
}
module.exports={criar,expirou,MENSAGEM};
