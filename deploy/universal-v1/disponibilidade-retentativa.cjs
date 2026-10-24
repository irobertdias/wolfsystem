'use strict';
const campos=['cep','logradouro','quadra','lote','numero','casa','apartamento','bloco','bairro','endereco'];
function novoEndereco(s,novos,parsed){
 if(s.etapa!=='outro_endereco')return false;
 if(!novos.cep&&!novos.logradouro&&!parsed.cep&&!parsed.logradouro)return false;
 for(const k of campos)delete s.dados[k];
 for(const k of ['consulta','consultaChave','enderecoAusenteConfirmacao','enderecoConfirmado','plano','ofertas','catalogoPendente'])delete s[k];
 s.etapa='cep';s.confirmado=false;return true;
}
function semDisponibilidade(s,responder){
 const chave=JSON.stringify(Object.fromEntries(['cidade','estado',...campos].map(k=>[k,s.dados[k]||''])));
 s.enderecosInviaveis||=[];
 if(!s.enderecosInviaveis.includes(chave))s.enderecosInviaveis.push(chave);
 if(s.enderecosInviaveis.length>=2){s.etapa='encerrado';s.encerramentoInviavel=true;return responder('Consultei esse outro endereço e também não há disponibilidade no momento. Vou finalizar o atendimento por aqui. Obrigado pelo interesse! 💚','encerrar');}
 s.etapa='outro_endereco';
 return responder('No momento, não temos disponibilidade para esse endereço. Você tem outro endereço para consultar? Pode enviar o CEP ou a rua com número, cidade e estado. Se não tiver, me avise que finalizo por aqui. 💚');
}
module.exports={novoEndereco,semDisponibilidade};
