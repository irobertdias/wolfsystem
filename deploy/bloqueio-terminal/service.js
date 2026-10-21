'use strict';
async function buscarBloqueio(db,workspaceId,canalId,numero){
 const n=String(numero||'').replace(/\D/g,'');if(!workspaceId||!canalId||!n)return null;
 const{data,error}=await db.from('atendimentos').select('id,bloqueado_ate,status').eq('workspace_id',workspaceId).eq('canal_id',canalId).in('numero',[n,'+'+n]).eq('status','resolvido').gt('bloqueado_ate',new Date().toISOString()).order('bloqueado_ate',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;return data||null;
}
function carregar(ctx){
 const executar=ctx.executarFluxo,verificar=ctx.verificarBloqueioManualBot,filas=new Map();
 if(typeof executar!=='function'||typeof verificar!=='function')throw Error('Carregue o bloqueio terminal após os módulos de fluxo e mensagens');
 ctx.verificarBloqueioManualBot=async function(ws,canal,n){const manual=await verificar(ws,canal,n);if(manual?.bloqueado)return manual;const bloqueio=await buscarBloqueio(ctx.supabase,ws,canal,n);return bloqueio?{bloqueado:true,origem:'encerramento',atendimento:bloqueio}:manual;};
 ctx.executarFluxo=async function(ws,canal,n,msg,enviar,...args){
  const chave=JSON.stringify([ws,String(canal),String(n).replace(/\D/g,'')]),anterior=filas.get(chave)||Promise.resolve();
  const atual=anterior.catch(()=>undefined).then(async()=>{
   if(await buscarBloqueio(ctx.supabase,ws,canal,n))return true;
   const protegido=async(...mensagem)=>{
    if(await buscarBloqueio(ctx.supabase,ws,canal,n)){const e=Error('Envio automático cancelado: atendimento encerrado e bloqueado');e.code='BOT_BLOQUEADO';throw e;}
    return enviar(...mensagem);
   };
   return executar(ws,canal,n,msg,protegido,...args);
  });filas.set(chave,atual);
  try{return await atual;}finally{if(filas.get(chave)===atual)filas.delete(chave);}
 };
 ctx.bloqueioTerminalAtivo=true;
}
module.exports=carregar;module.exports.buscarBloqueio=buscarBloqueio;
