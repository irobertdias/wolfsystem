'use strict';
function intencao(texto){
 const t=String(texto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!]+$/,'').trim();
 if(/^(esquece(?: isso)?|deixa (?:pra|para) la|desisto|(?:pode |quero )?encerrar(?: o atendimento)?|(?:pode |quero )?cancelar(?: o atendimento)?|nao (?:quero|tenho interesse)(?: mais)?(?: continuar| contratar)?|pare(?: de mandar mensagens)?|nao me (?:mande|envie|chame)(?: mais)?(?: mensagens)?)$/.test(t))return'encerrar';
 if(/^(agora foi|obrigad[oa]|entendi|valeu)$/.test(t))return'comentario';
 return'';
}
async function tratarIntencao(ctx,ws,canal,n,msg,enviar){
 const tipo=intencao(msg);if(!tipo||typeof ctx.buscarSessaoFluxo!=='function')return false;
 const s=await ctx.buscarSessaoFluxo(ws,canal,n);if(ws!=='grupoprime'||![27,28].includes(Number(s?.fluxo_id)))return false;
 if(tipo==='comentario')return true;
 const pararExplicito=/encerrar|cancelar|pare|nao me|não me/i.test(String(msg));
 if(s.variaveis?.venda_fluida_v1==='SIM'&&!pararExplicito&&s.variaveis?.recuperacao_comercial_tentada!=='SIM'){
  const vars={...(s.variaveis||{}),recuperacao_comercial_tentada:'SIM'};
  const r=await ctx.supabase.from('fluxo_sessoes').update({variaveis:vars,updated_at:new Date().toISOString()}).eq('workspace_id',ws).eq('canal_id',canal).eq('id',s.id);if(r.error)throw r.error;
  await enviar('Entendi. O que pesou para você: o valor, o plano ou alguma dificuldade no atendimento? Posso tentar resolver isso com você.');return true;
 }
 const agora=new Date(),vars={...(s.variaveis||{})};let followup;try{followup=typeof vars.__wolf_followups_v1==='string'?JSON.parse(vars.__wolf_followups_v1):vars.__wolf_followups_v1;}catch{}
 vars.__wolf_followups_v1={...(followup||{}),aguardandoRespostaCliente:false,agendadoPara:null,dispararEm:null,canceladoEm:agora.toISOString(),motivoCancelamento:'pedido_cliente'};
 const r=await ctx.supabase.from('fluxo_sessoes').update({status:'finalizado',aguardando_input:false,tipo_input_aguardado:null,variaveis:vars,updated_at:agora.toISOString()}).eq('workspace_id',ws).eq('canal_id',canal).eq('id',s.id);if(r.error)throw r.error;
 const{data:config,error}=await ctx.supabase.from('workspaces').select('bloqueio_pos_finalizacao_horas').eq('username',ws).maybeSingle();if(error)throw error;
 const valor=config?.bloqueio_pos_finalizacao_horas,horas=valor==null?24:Number(valor);if(!Number.isFinite(horas)||horas<0)throw Error('Período de bloqueio inválido');
 try{await enviar('Tudo bem. Vou encerrar por aqui e cancelar os lembretes.');}finally{
  const digitos=String(n).replace(/\D/g,'');const fim=horas>0?new Date(agora.getTime()+horas*3600000).toISOString():null;
  const a=await ctx.supabase.from('atendimentos').update({status:'resolvido',bloqueado_ia:true,bloqueado_fluxo:true,bloqueado_typebot:true,bloqueado_contato:horas>0,bloqueado_ate:fim,atendente_finalizou:'BOT',updated_at:agora.toISOString()}).eq('workspace_id',ws).eq('canal_id',canal).in('numero',[digitos,'+'+digitos]);if(a.error)throw a.error;
 }
 return true;
}
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
   if(await tratarIntencao(ctx,ws,canal,n,msg,enviar))return true;
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
module.exports=carregar;module.exports.buscarBloqueio=buscarBloqueio;module.exports.intencao=intencao;module.exports.tratarIntencao=tratarIntencao;
