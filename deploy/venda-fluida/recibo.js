'use strict';
async function confirmar(client,id,ackInicial,{timeoutMs=20000,intervaloMs=500,agora=Date.now,esperar=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(typeof id!=='string'||!id)throw Error('BKO_SEM_RECIBO: provedor não retornou ID');
 const fim=agora()+timeoutMs;let ack=ackInicial;
 for(;;){
  if(Number(ack)===-1)throw Error('BKO_ACK_FALHOU: WhatsApp rejeitou o envio');
  if(ack!=null&&Number(ack)>=1)return id;
  if(agora()>=fim)throw Error('BKO_ACK_PENDENTE: WhatsApp ainda não confirmou envio ao servidor');
  let timer;
  try{const msg=await Promise.race([client.getMessageById(id),new Promise((_,rejeitar)=>{timer=setTimeout(()=>rejeitar(Error('Timeout de recibo')),Math.max(1,fim-agora()));})]);if(msg?.ack!=null)ack=msg.ack;}catch{}finally{clearTimeout(timer);}
  if(Number(ack)===-1)throw Error('BKO_ACK_FALHOU: WhatsApp rejeitou o envio');
  if(ack!=null&&Number(ack)>=1)return id;
  await esperar(intervaloMs);
 }
}
module.exports={confirmar};
