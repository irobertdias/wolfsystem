'use strict';
// Recuperação de chave sem serializar o chat inteiro. Usa as mesmas coleções
// e a mesma operação de histórico da biblioteca, limitadas aos aliases do contato.
module.exports=async function recuperarStore(client,remotos,originalId,limiteMs=7000){
 if(!client.pupPage?.evaluate)return null;
 return client.pupPage.evaluate(async({remotos,originalId,limiteMs})=>{
  const fim=Date.now()+Math.min(12000,Math.max(100,limiteMs)),etapas=[];
  const erro=(etapa,e)=>etapas.push({etapa,erro:String(e?.message||e),nome:e?.name,stack:String(e?.stack||'').slice(0,1000)});
  const parse=id=>{const m=String(id||'').match(/^(true|false)_(\d{8,20}@(c\.us|lid))_([^_\s]+)(?:_([^_\s]+))?$/);return m?{autoria:m[1],remoto:m[2],stanza:m[4],participante:m[5]||''}:null;};
  const original=parse(originalId),permitidos=new Set(remotos);if(!original||!permitidos.has(original.remoto))return{erro:'Chave fora dos aliases autorizados'};
  const conferir=msg=>{const id=msg?.id?._serialized,k=parse(id);return k&&k.autoria===original.autoria&&k.stanza===original.stanza&&k.participante===original.participante&&permitidos.has(k.remoto)?{id,destino:k.remoto}:null;};
  const consultar=async(etapa,fn)=>{const restante=fim-Date.now();if(restante<=0)return null;let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),Math.min(2200,restante));})]);}catch(e){erro(etapa,e);return null;}finally{clearTimeout(timer);}};
  let colecao,factory,carregador;
  try{colecao=window.require('WAWebCollections');factory=window.require('WAWebWidFactory');carregador=window.require('WAWebChatLoadMessages');}catch(e){erro('modulos',e);return{etapas};}
  const cache=()=>{for(const m of colecao.Msg.getModelsArray()){const r=conferir(m);if(r)return r;}return null;};
  let encontrada=cache();if(encontrada)return{encontrada,etapas};
  const chats=[],vistos=new Set();
  for(const jid of remotos){
   let wid;const existente=await consultar('Chat.get:'+jid,()=>{wid=factory.createWid(jid);return colecao.Chat.get(wid)||colecao.Chat.get(jid)||colecao.Chat.getModelsArray().find(c=>c.id?._serialized===jid);});let chat=existente;
   if(!chat&&typeof colecao.Chat.find==='function')chat=await consultar('Chat.find:'+jid,()=>colecao.Chat.find(wid));
   if(chat&&!vistos.has(chat.id?._serialized)){vistos.add(chat.id?._serialized);chats.push(chat);}
  }
  etapas.push({etapa:'chats',chats:chats.map(c=>({id:c.id?._serialized,mensagens:c.msgs?.getModelsArray?.().length||0}))});
  for(const chat of chats){
   for(let pagina=0;pagina<5&&Date.now()<fim;pagina++){
    encontrada=(chat.msgs?.getModelsArray?.()||[]).map(conferir).find(Boolean)||cache();if(encontrada)return{encontrada,etapas};
    const carregadas=await consultar('loadEarlierMsgs:'+chat.id?._serialized,()=>carregador.loadEarlierMsgs({chat}));
    encontrada=(Array.isArray(carregadas)?carregadas:[]).map(conferir).find(Boolean)||cache();if(encontrada)return{encontrada,etapas};
    if(!carregadas?.length)break;
   }
  }
  return{etapas,erro:'Mensagem não localizada nas coleções da conversa'};
 },{remotos:[...remotos],originalId,limiteMs});
};
