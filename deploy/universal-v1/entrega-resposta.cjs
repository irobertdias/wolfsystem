'use strict';
// O interpretador produz uma proposta de resposta. Só o transporte confirma o envio.
function prepararEntrega(s,r){
 if(r.historicoProposto!==false&&s.historico?.at(-1)?.role==='assistant'&&s.historico.at(-1).content===r.mensagem)s.historico.pop();
 if(r.tipo==='ofertas'){s.catalogoPendente=true;delete s.ofertasMostradas;}
}
function confirmarEntrega(s,r){
 if(!r.mensagem)return;
 s.historico=[...(s.historico||[]),{role:'assistant',content:r.mensagem}].slice(-40);
 if(r.tipo==='ofertas'){
  delete s.catalogoPendente;
  s.ofertasEnviadasEm=new Date().toISOString();
  // O catálogo será recalculado a cada solicitação; a confirmação serve à seleção genérica.
  s.ofertasMostradas=true;
 }
}
module.exports={prepararEntrega,confirmarEntrega};
