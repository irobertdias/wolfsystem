'use strict';
const MODULO='somente_confirmacoes_bko';
const numero=v=>String(v||'').replace(/\D/g,'');
const chave=v=>{const n=numero(v);return /^55\d{2}9[6-9]\d{7}$/.test(n)?n.slice(0,4)+n.slice(5):n;};
function carregar(ctx){
 async function verificar(ws,canal,n){
  const cfg=await ctx.getConfigCanal(canal);if(!cfg||cfg.workspaceId!==ws)return{bloqueado:true,origem:'canal_fora_do_workspace'};
  if(cfg.modulos?.includes(MODULO))return{bloqueado:true,origem:'somente_confirmacoes_bko'};
  // Retornos reconhecidos são tratados pelo BKO antes deste controle. Um contato
  // BKO sem referência nunca pode cair no roteiro de venda como se fosse lead.
  if(ws==='grupoprime'&&typeof ctx.tratarRetornoBko==='function'){
   const{data,error}=await ctx.supabase.from('fluxos').select('nos').eq('workspace_id',ws).in('id',[27,28]);if(error)throw error;
   const bko=(data||[]).flatMap(f=>(f.nos||[]).filter(no=>no.dados?.bko_configuracao?.ativo&&Number(no.dados.bko_configuracao.canal_id)===Number(canal)).flatMap(no=>no.dados.bko_configuracao.contatos||[]));
   if(chave(n)&&bko.some(c=>chave(c.numero)===chave(n)))return{bloqueado:true,origem:'contato_bko'};
  }
  return null;
 }
 const manual=ctx.verificarBloqueioManualBot,fluxo=ctx.executarFluxo,ia=ctx.responderComIA,typebot=ctx.responderComTypebot;
 if(typeof manual!=='function'||typeof fluxo!=='function')throw Error('Carregue o uso do canal após mensagens e fluxo');
 ctx.verificarBloqueioManualBot=async(ws,c,n)=>(await verificar(ws,c,n))||manual(ws,c,n);
 ctx.executarFluxo=async(ws,c,n,...args)=>await verificar(ws,c,n)?true:fluxo(ws,c,n,...args);
 if(ia)ctx.responderComIA=async(s,n,m,ws,c)=>await verificar(ws,c,n)?null:ia(s,n,m,ws,c);
 if(typebot)ctx.responderComTypebot=async(s,ws,c,n,m)=>await verificar(ws,c,n)?null:typebot(s,ws,c,n,m);
 ctx.canalCompartilhadoAtivo=true;
}
function modulosEntrada(valor){if(!Array.isArray(valor)||valor.length>30||valor.some(v=>typeof v!=='string'||v.length>80||!v.trim()))throw Error('Módulos do canal inválidos');return[...new Set(valor.map(v=>v.trim()))];}
module.exports=carregar;module.exports.modulosEntrada=modulosEntrada;
