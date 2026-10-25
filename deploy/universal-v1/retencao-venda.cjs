'use strict';
const {normalizar}=require('./vtal.cjs');
function pararContato(texto){return /\b(?:PARE DE (?:MANDAR|ENVIAR|ME (?:MANDAR|ENVIAR))|NAO ME (?:MANDE|ENVIE)|NAO ENTRE EM CONTATO|NAO (?:QUERO|DESEJO) (?:MAIS )?RECEBER MENSAGE(?:M|NS)|REMOVA MEU (?:NUMERO|CONTATO)|ENCERRE O (?:CHAT|ATENDIMENTO)|FINALIZE O ATENDIMENTO)\b/.test(normalizar(texto));}
function tratar(s,texto,desistiu){
 if(pararContato(texto))return {encerrar:true};
 const t=normalizar(texto).replace(/NAO QUERO CANCELAR/g,'');
 const recusa=desistiu||/\b(?:QUERO CANCELAR|PODE CANCELAR|CANCELE|DESISTI|DESISTO|VOU DESISTIR|NAO QUERO (?:MAIS )?(?:CONTRATAR|O PLANO|O PEDIDO|A INTERNET))\b/.test(t)||(s.retencaoVendaApresentada&&/^(?:NAO|NAO QUERO|NAO OBRIGAD[OA])[.! ]*$/.test(t));
 if(!recusa)return null;
 if(s.retencaoVendaApresentada)return {encerrar:true};
 s.retencaoVendaApresentada=true;
 const valor=/CARO|PRECO|VALOR|ORCAMENTO/.test(t);
 return {tipo:'retencao_venda',mensagem:valor?'Entendo que o valor pesa na decisão. Antes de encerrar, posso ajudar você a comparar as condições das ofertas disponíveis. Qual faixa de valor ficaria melhor para você?':'Entendo. Antes de encerrar, posso saber o que fez você desistir: o valor, a instalação ou alguma dúvida? Quero tentar encontrar uma opção que faça sentido para você, com as condições reais das ofertas. 😊'};
}
module.exports={tratar,pararContato};
