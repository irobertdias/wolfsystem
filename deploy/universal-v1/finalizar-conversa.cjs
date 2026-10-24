'use strict';
// Atendimento usa "resolvido"; a sessão do fluxo usa "finalizado".
async function finalizarConversa(db,workspace,canal,numero){
 const at=await db.from('atendimentos').update({status:'resolvido',bloqueado_ia:true,bloqueado_fluxo:true,bloqueado_typebot:true,updated_at:new Date().toISOString()}).eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero);
 if(at.error)throw at.error;
 const sessao=await db.from('fluxo_sessoes').update({status:'finalizado',aguardando_input:false,tipo_input_aguardado:null,updated_at:new Date().toISOString()}).eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).eq('status','ativo');
 if(sessao.error)throw sessao.error;
}
module.exports={finalizarConversa};
