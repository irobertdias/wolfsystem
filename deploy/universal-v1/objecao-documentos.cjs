'use strict';
const {normalizar}=require('./vtal.cjs');
const EXPLICACAO='O documento é solicitado como uma medida de segurança para ajudar a confirmar que é você quem está contratando e proteger seu pedido contra uso indevido dos seus dados. Você consegue enviar a foto por aqui? Se preferir não enviar, posso encaminhar o pedido à equipe para continuar a conferência.';
function pararPedido(texto){
 const t=normalizar(texto).replace(/NAO (?:QUERO|E PARA) CANCELAR/g,'');
 return /\b(?:QUERO CANCELAR|PODE CANCELAR|CANCELE|ENCERRE|FINALIZE O ATENDIMENTO|NAO QUERO (?:MAIS )?(?:CONTRATAR|O PLANO|O PEDIDO)|PARE DE (?:MANDAR|ENVIAR)|NAO ME (?:MANDE|ENVIE)|NAO ENTRE EM CONTATO)\b/.test(t);
}
function recusaDocumento(texto){
 const t=normalizar(texto);
 return /\bNAO (?:ENVIAR|MANDAR|ENVIO|ENVIAREI|MANDO|MANDAREI|VOU (?:ENVIAR|MANDAR)|QUERO (?:ENVIAR|MANDAR)|POSSO (?:ENVIAR|MANDAR|FAZER)|TENHO (?:O |A |MEU |MINHA )?(?:RG|IDENTIDADE|DOCUMENTO))\b/.test(t)||/\b(?:RECUSO|ME RECUSO|SEM DOCUMENTO[S]? (?:PODE |QUERO )?SEGUIR|PREFIRO NAO (?:ENVIAR|MANDAR))\b/.test(t)||/^(?:NAO|NAO QUERO|NAO POSSO|PREFIRO NAO|NEM PENSAR)[.! ]*$/.test(t);
}
function tratar(s,texto,docs,recusaInterpretada=false){
 if(!s.confirmado||pararPedido(texto))return null;
 const faltantes=docs.filter(d=>!(d.variavel==='comprovante_endereco'&&s.semComprovante)&&!s.documentos?.[d.variavel]?.length&&!s.documentosDispensados?.includes(d.variavel));
 if(!faltantes.length)return null;
 const recusa=recusaInterpretada||recusaDocumento(texto),duvida=/\b(?:POR QUE|PORQUE|PRA QUE|PARA QUE|SEGURO|SEGURANCA|MEDO)\b/.test(normalizar(texto));
 if(!recusa&&!duvida)return null;
 if(!s.contornoDocumentosExplicado||!recusa){s.contornoDocumentosExplicado=true;return {tipo:'contorno_documentos',mensagem:EXPLICACAO};}
 s.documentosDispensados=[...new Set([...(s.documentosDispensados||[]),...faltantes.map(d=>d.variavel)])];
 const nota='Documentação pendente: cliente manteve a recusa de enviar após explicação de segurança. BKO deve continuar a conferência: '+faltantes.map(d=>d.rotulo||d.variavel).join(', ')+'.';
 s.observacaoDocumentos='FALTA PEGAR DOCUMENTO';s.observacaoBkoDocumentos='CLIENTE NÃO ACEITOU ENVIAR DOCUMENTAÇÃO';
 s.pendencias=[...new Set([...(s.pendencias||[]),s.observacaoDocumentos,nota])];
 return {seguir:true};
}
module.exports={tratar,recusaDocumento,pararPedido,EXPLICACAO};
