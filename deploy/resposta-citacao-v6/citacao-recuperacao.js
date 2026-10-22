'use strict';
const chave=id=>{const m=String(id||'').match(/^(true|false)_(\d{8,20}@(c\.us|lid))_([^_\s]+)(?:_([^_\s]+))?$/);return m?{autoria:m[1],remoto:m[2],stanza:m[4],participante:m[5]||''}:null;};
module.exports=async function recuperar(client,numero,originalId,destino,recarregar=false,limiteExterno=Infinity){
 originalId=String(originalId||'').replace(/^webjs:\d+:/,'');
 if(typeof client.getMessageById!=='function')return{id:originalId,destino};
 const original=chave(originalId);if(!original)throw Error('Identificador da mensagem original invalido para citar');
 const limite=Math.min(Date.now()+28000,limiteExterno),remotos=new Set([original.remoto,destino].filter(Boolean));
 const consultar=async(fn,ms)=>{let timer;const restante=limite-Date.now();if(restante<=0)return null;try{return await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),Math.min(ms,restante));})]);}catch{return null;}finally{clearTimeout(timer);}};
 const validar=m=>{const id=m?.id?._serialized,k=chave(id);return k&&k.autoria===original.autoria&&k.stanza===original.stanza&&k.participante===original.participante&&remotos.has(k.remoto)?{id,destino:k.remoto}:null;};
 let encontrada=validar(await consultar(()=>client.getMessageById(originalId),1500));if(encontrada&&!recarregar)return encontrada;
 const telefone=String(numero||'').replace(/\D/g,'')+'@c.us';
 if(typeof client.getContactLidAndPhone==='function'){
  // Uma consulta de telefone antigo pode falhar. Resolver o LID de origem
  // separadamente evita que isso descarte também o mapeamento válido do LID.
  const mapas=await Promise.all([...new Set([original.remoto,destino,telefone].filter(Boolean))].map(jid=>consultar(()=>client.getContactLidAndPhone([jid]),3000)));
  for(const lista of mapas)for(const item of lista||[])for(const jid of[item.pn,item.lid])if(/^\d{8,20}@(c\.us|lid)$/.test(jid||''))remotos.add(jid);
 }
 const ids=()=>[...remotos].map(r=>original.autoria+'_'+r+'_'+original.stanza+(original.participante?'_'+original.participante:''));
 const cache=async()=>{const resultados=await Promise.all(ids().map(id=>consultar(()=>client.getMessageById(id),1800)));return resultados.map(validar).find(Boolean);};
 encontrada=await cache();if(encontrada&&!recarregar)return encontrada;
 const chats=[];
 if(typeof client.getChatById==='function'){
  const remotosOrdenados=[...new Set([destino,original.remoto,...remotos].filter(Boolean))];
  const resultados=await Promise.all(remotosOrdenados.slice(0,4).map(async jid=>({jid,chat:await consultar(()=>client.getChatById(jid),1800)})));
  for(const r of resultados)if(typeof r.chat?.fetchMessages==='function')chats.push(r);
 }
 const procurar=async(limit,timeout)=>{
  const listas=await Promise.all(chats.map(({chat})=>consultar(()=>chat.fetchMessages({limit}),timeout)));
  return listas.flatMap(v=>Array.isArray(v)?v:[]).map(validar).find(Boolean);
 };
 encontrada=await procurar(100,4500);if(encontrada)return encontrada;
 // Só sincroniza a conversa solicitada, quando o cache não contém a mensagem.
 // Não reinicia Chromium, não muda sessão e não envia nenhuma mensagem.
 const sincronizar=chats.find(x=>typeof x.chat.syncHistory==='function')||chats[0];
 if(sincronizar){
  if(typeof sincronizar.chat.syncHistory==='function')await consultar(()=>sincronizar.chat.syncHistory(),3500);
  else if(typeof client.syncHistory==='function')await consultar(()=>client.syncHistory(sincronizar.jid),3500);
 }
 encontrada=await procurar(500,7500)||await cache();if(encontrada)return encontrada;
 throw Object.assign(Error('A mensagem original nao esta disponivel no WhatsApp conectado. Selecione uma mensagem mais recente para responder, ou cancele a resposta e envie um texto comum.'),{statusCode:409,code:'WEBJS_QUOTE_NOT_AVAILABLE'});
};
