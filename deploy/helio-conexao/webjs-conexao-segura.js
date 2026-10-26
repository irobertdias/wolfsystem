'use strict';
const MARCA=Symbol.for('wolf.webjs.conexaoSegura');
function motivoAutomatico(motivo){return /^(?:auto-|evento disconnected|heartbeat:|falha do navegador)/i.test(String(motivo||''));}
function impedirReconexao(sessao,atual,motivo,esperada){
 if(esperada&&esperada!==atual)return 'tentativa pertence a uma sessão substituída';
 if(!sessao||!motivoAutomatico(motivo))return '';
 if(sessao.substituida||sessao.encerrando)return 'sessão já está sendo encerrada';
 if(sessao.status==='aguardando_qr')return 'autenticação já está em andamento';
 if(sessao.status==='inicializando'&&Date.now()-(sessao.inicializacaoEm||Date.now())<(sessao.authenticatedProcessado?300000:180000))return 'autenticação já está em andamento';
 if(sessao.status==='conectado'&&/^(?:evento disconnected|auto-)/i.test(motivo))return 'a conexão já foi recuperada';
 return '';
}
function instalar(ctx,{processo=process,encerrar,temporizador=setTimeout}={}){
 const original=ctx.reconectarCanalSilencioso;
 if(typeof original==='function'&&!original[MARCA]){
  const protegido=async(canal,motivo='auto-recuperação',esperada)=>{
   const atual=ctx.sessoes[String(canal)],razao=impedirReconexao(atual,atual,motivo,esperada);
   if(razao){console.log('[WebJS proteção] Canal '+canal+': '+razao);return {ok:true,ignorada:true,mensagem:razao};}
   return original(canal,motivo);
  };
  protegido[MARCA]=true;ctx.reconectarCanalSilencioso=protegido;
 }
 if(ctx[MARCA])return;ctx[MARCA]=true;
 let encerrando=false;
 const fechar=encerrar||require('./webjs-encerramento').encerrarClienteWebjs;
 async function parar(sinal){
  if(encerrando)return;encerrando=true;
  console.log('[WebJS proteção] '+sinal+': fechando navegadores e preservando autenticação');
  const limite=temporizador(()=>processo.exit(1),20000);limite.unref?.();
  const lista=Object.values(ctx.sessoes||{}).filter(s=>s.tipo==='webjs'&&s.client);
  for(const s of lista){s.substituida=true;s.encerrando=true;}
  const resultados=await Promise.allSettled(lista.map(s=>fechar(s.client)));
  clearTimeout(limite);
  processo.exit(resultados.some(r=>r.status==='rejected')?1:0);
 }
 processo.once('SIGINT',()=>void parar('SIGINT'));processo.once('SIGTERM',()=>void parar('SIGTERM'));
}
module.exports={instalar,impedirReconexao};
