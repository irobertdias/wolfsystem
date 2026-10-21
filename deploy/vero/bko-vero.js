'use strict';
const {interpretarRetornoBko}=require('./bko-ia-regras');
module.exports=function registrarVero(ctx){
 const anterior=ctx.tratarRetornoBko;
 const child=Object.create(ctx);child.app={get(){}};
 require('./bko-vero-core.js')(child);
 ctx.veroBkoFluxo=28;
 ctx.tratarRetornoBko=async entrada=>{
  if(entrada.workspaceId!=='grupoprime'||!entrada.verificado)return anterior?anterior(entrada):false;
  try{
   const referencia=interpretarRetornoBko(String(entrada.mensagem||''))?.referencia;
   if(!referencia&&!entrada.quotedId)return anterior?anterior(entrada):false;
   let q=ctx.supabase.from('proposta').select('id,fluxo_id').eq('workspace_id','grupoprime').in('fluxo_id',[27,28]);
   q=referencia?q.eq('dados_customizados->>bko_ref',referencia):q.contains('dados_customizados',{bko_reply_ids:[entrada.quotedId]});
   const {data,error}=await q.limit(2);if(error)throw error;
   if(data?.length===1&&Number(data[0].fluxo_id)===28)return child.tratarRetornoBko(entrada);
   return anterior?anterior(entrada):false;
  }catch(e){console.error('[BKO Vero] '+e.message);return true;}
 };
 return ctx;
};
