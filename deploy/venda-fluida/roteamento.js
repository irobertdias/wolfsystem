'use strict';
function rota(cfg,v,fluxo){
 if(!cfg||v.workspace_id!=='grupoprime'||Number(v.fluxo_id)!==fluxo)return null;
 if(cfg.modo!=='por_canal')return cfg;
 const exato=cfg.contatos.find(c=>Number(c.canal_trafego_id)===Number(v.canal_id));
 if(exato)return{...cfg,contatos:[exato],canal_trafego_id:Number(v.canal_id),fila_nome:exato.fila_nome};
 // Cada módulo já carrega somente a configuração de sua operadora.
 // Canal antigo não altera origem, anexos ou remetente; usa o único destino atual da operadora.
 const destinos=[...new Set(cfg.contatos.map(c=>c.numero))];
 if(destinos.length!==1)return null;
 const contato=cfg.contatos[0];
 return{...cfg,contatos:[contato],canal_trafego_id:Number(v.canal_id),fila_nome:contato.fila_nome,historico_operadora:true};
}
async function enviar(client,numero,conteudo,opcoes={}){
 let timer;
 try{return await Promise.race([(async()=>{
  const destino=await client.getNumberId(numero);
  if(!destino?._serialized)throw Error('WhatsApp não confirmou o destinatário configurado');
  return client.sendMessage(destino._serialized,conteudo,{...opcoes,sendSeen:false,waitUntilMsgSent:true});
 })(),new Promise((_,rejeitar)=>{timer=setTimeout(()=>rejeitar(Error('Resultado do envio WhatsApp excedeu 45 segundos; aguardando retentativa')),45000);})]);}
 finally{clearTimeout(timer);}
}
module.exports={rota,enviar};
