'use strict';
function retomar(meta,agora=Date.now()){
 if(new Date(meta.lease||0).getTime()>agora)return false;
 let alterado=false;
 for(const destino of Object.values(meta.destinatarios||{}))for(const parte of destino.partes||[]){
  if(parte.estado!=='em_envio')continue;
  parte.estado=parte.id?'enviado':'pendente';
  if(!parte.id)parte.retentativas=Number(parte.retentativas||0)+1;
  alterado=true;
 }
 return alterado;
}
function falha(meta,agora=Date.now()){
 meta.lease=null;
 meta.falhas_consecutivas=Math.min(30,Number(meta.falhas_consecutivas||0)+1);
 const atraso=Math.min(15*60000,30000*2**Math.min(5,meta.falhas_consecutivas-1));
 return new Date(agora+atraso).toISOString();
}
module.exports={retomar,falha};
