'use strict';
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
function ponto(row,fluxo){
 if(!row||row.status!=='ativo'||!row.aguardando_input||row.tipo_input_aguardado!=='nicho_atendimento'||Number(row.fluxo_id)!==Number(fluxo?.id))return null;
 const s=parse(row.variaveis?.__universal_v2),n=s.nio||s;
 if(s.versao!==2||s.proposta_id||s.concluido||s.pronto||s.encerrado||n.proposta_id||n.etapa==='encerrado')return null;
 if(fluxo.nos?.some(n=>n.id===row.no_atual))return null;
 const candidatos=(fluxo.nos||[]).filter(n=>n.tipo==='nicho_atendimento'&&Array.isArray(n.dados?.coleta));
 return candidatos.find(n=>n.id===row.ultimo_no_executado)?.id||(candidatos.length===1?candidatos[0].id:null);
}
async function restaurar({db,ctx,workspace,canal,numero,fluxo}){
 if(typeof ctx.buscarSessaoFluxo!=='function')return false;
 const row=await ctx.buscarSessaoFluxo(workspace,canal,numero),no=ponto(row,fluxo);if(!no)return false;
 if((await ctx.verificarBloqueioManualBot(workspace,canal,numero))?.bloqueado)return false;
 const at=await db.from('atendimentos').select('status,atendente,bloqueado_ia,bloqueado_fluxo,bloqueado_typebot').eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).order('updated_at',{ascending:false}).limit(1);if(at.error)throw at.error;const a=at.data?.[0];
 if(!a||a.status==='resolvido'||a.atendente!=='BOT'||a.bloqueado_ia||a.bloqueado_fluxo||a.bloqueado_typebot)return false;
 const variaveis={...row.variaveis};delete variaveis.__fluxo_terminal;
 const r=await db.from('fluxo_sessoes').update({no_atual:no,ultimo_no_executado:no,variaveis,updated_at:new Date().toISOString()}).eq('workspace_id',workspace).eq('canal_id',canal).eq('id',row.id).eq('status','ativo').eq('updated_at',row.updated_at).select('id');if(r.error)throw r.error;return !!r.data?.length;
}
module.exports={ponto,restaurar};
