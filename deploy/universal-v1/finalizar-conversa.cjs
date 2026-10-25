'use strict';
// Atendimento usa "resolvido"; a sessão do fluxo usa "finalizado".
async function finalizarConversa(db,workspace,canal,numero){
 const cfg=await db.from('workspaces').select('bloqueio_pos_finalizacao_horas').eq('username',workspace).limit(1);
 if(cfg.error)throw cfg.error;
 const horas=cfg.data?.[0]?.bloqueio_pos_finalizacao_horas??24;
 if(!Number.isFinite(Number(horas))||Number(horas)<0)throw Error('Período de bloqueio inválido');
 const agora=new Date(),ate=Number(horas)>0?new Date(agora.getTime()+Number(horas)*3600000).toISOString():null;
 const at=await db.from('atendimentos').update({status:'resolvido',bloqueado_ia:true,bloqueado_fluxo:true,bloqueado_typebot:true,bloqueado_contato:Number(horas)>0,bloqueado_ate:ate,atendente_finalizou:'BOT',updated_at:agora.toISOString()}).eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero);
 if(at.error)throw at.error;
 const sessao=await db.from('fluxo_sessoes').update({status:'finalizado',aguardando_input:false,tipo_input_aguardado:null,updated_at:new Date().toISOString()}).eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).eq('status','ativo');
 if(sessao.error)throw sessao.error;
}
module.exports={finalizarConversa};
