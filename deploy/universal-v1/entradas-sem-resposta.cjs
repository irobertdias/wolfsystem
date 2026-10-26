'use strict';
const {createHash}=require('node:crypto');
const parse=v=>typeof v==='string'?JSON.parse(v):v||{};
function entradaNaoProcessada(estado,mensagens){
 mensagens=mensagens.filter(m=>m.de!=='sistema');
 if(!mensagens.length||mensagens[0].de!=='cliente')return null;
 const lote=[];for(const m of mensagens){if(m.de!=='cliente')break;lote.unshift(m);}
 const ultima=[...(estado.historico||[])].reverse().find(h=>h.role==='user')?.content;
 const texto=lote.map(m=>m.mensagem||'').join('\n');
 if(ultima===texto||createHash('sha256').update(texto).digest('hex')===estado.entradaInterpretadaChave)return null;
 let inicio=0;for(let i=lote.length-1;i>=0;i--)if(lote[i].mensagem===ultima){inicio=i+1;break;}
 const novos=lote.slice(inicio);if(!novos.length)return null;
 return {texto:novos.map(m=>m.mensagem||'').join('\n'),id:novos.at(-1).id};
}
function criar({db,workspace,processar,disponivel=async()=>true,ocupado=()=>false,agora=Date.now}){
 let rodando=false;
 return async function executar(){if(rodando)return [];rodando=true;const feitos=[];
 try{
  const q=await db.from('fluxo_sessoes').select('*').eq('workspace_id',workspace).eq('status','ativo').limit(200);if(q.error)throw q.error;
  for(const row of q.data||[]){
   if(feitos.length>=5)break;
   const key=row.variaveis?.__universal_v2?'__universal_v2':'__universal_v1',ext=parse(row.variaveis?.[key]),s=ext.nio||ext;
   const possuiPedido=!!(s.proposta_id||ext.proposta_id);
   if(!possuiPedido&&!['assistente_universal','nicho_atendimento'].includes(row.tipo_input_aguardado))continue;
   if((!possuiPedido&&(ext.concluido||ext.pronto))||s.etapa==='encerrado'||ext.encerrado||ext.pendentes?.length||s.pendentes?.length||ocupado(row.canal_id,row.numero)||agora()-Date.parse(row.updated_at)<120000)continue;
   const at=await db.from('atendimentos').select('status,atendente,bloqueado_ia,bloqueado_fluxo').eq('workspace_id',workspace).eq('canal_id',row.canal_id).eq('numero',row.numero).order('updated_at',{ascending:false}).limit(1);if(at.error)throw at.error;const a=at.data?.[0];if(!a||a.status==='resolvido'||a.atendente!=='BOT'||a.bloqueado_ia||a.bloqueado_fluxo)continue;
   const m=await db.from('mensagens').select('id,de,mensagem,created_at').eq('workspace_id',workspace).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(30);if(m.error)throw m.error;
   const mensagens=m.data.filter(m=>m.de!=='sistema');if(!mensagens.length||agora()-Date.parse(mensagens[0].created_at)<120000)continue;
   const entrada=entradaNaoProcessada(ext.aberturaConcluida?ext:s,mensagens);if(!entrada?.texto||!await disponivel(row))continue;
   ext.retomadaEntradaPendente={mensagem_id:entrada.id,em:new Date(agora()).toISOString()};
   const claim=await db.from('fluxo_sessoes').update({variaveis:{...row.variaveis,[key]:JSON.stringify(ext)},updated_at:new Date(agora()).toISOString()}).eq('workspace_id',workspace).eq('id',row.id).eq('status','ativo').eq('updated_at',row.updated_at).select('id');if(claim.error)throw claim.error;if(!claim.data?.length)continue;
   const recente=await db.from('mensagens').select('id,de').eq('workspace_id',workspace).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(30);if(recente.error)throw recente.error;if(recente.data.find(m=>m.de!=='sistema')?.id!==entrada.id)continue;
   await processar(row,entrada.texto);feitos.push({sessao:row.id,mensagem:entrada.id});
  }
 }finally{rodando=false;}
 return feitos;
 };
}
module.exports={criar,entradaNaoProcessada};
