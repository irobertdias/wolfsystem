'use strict';
const campos=['cep','logradouro','quadra','lote','numero','casa','apartamento','bloco','bairro','endereco'];
function novoEndereco(s,novos,parsed){
 if(s.etapa!=='outro_endereco')return false;
 if(!novos.cep&&!novos.logradouro&&!parsed.cep&&!parsed.logradouro)return false;
 for(const k of campos)delete s.dados[k];
 for(const k of ['consulta','consultaChave','enderecoAusenteConfirmacao','enderecoConfirmado','plano','ofertas','catalogoPendente'])delete s[k];
 delete s.esclarecimentosOutroEnderecoEnviados;
 s.etapa='cep';s.confirmado=false;return true;
}
function semDisponibilidade(s,responder){
 const chave=JSON.stringify(Object.fromEntries(['cidade','estado',...campos].map(k=>[k,s.dados[k]||''])));
 s.enderecosInviaveis||=[];
 if(!s.enderecosInviaveis.includes(chave))s.enderecosInviaveis.push(chave);
 s.etapa='encerrado';s.encerramentoInviavel=true;
 return responder('No momento, não temos disponibilidade para esse endereço. Vou finalizar este atendimento. Se quiser consultar outro endereço depois, é só chamar. Obrigado pelo interesse! 💚','encerrar');
}
function esclarecerOuEncerrar(s,texto,responder){
 if((s.esclarecimentosOutroEnderecoEnviados||0)>=1){s.etapa='encerrado';s.encerramentoInviavel=true;return responder('Como não há disponibilidade confirmada para esse imóvel e não recebemos outro endereço para consultar, vou finalizar o atendimento por enquanto. Se tiver outro endereço futuramente, é só chamar. 💚','encerrar');}
 s.esclarecimentosOutroEnderecoEnviados=(s.esclarecimentosOutroEnderecoEnviados||0)+1;
 const cabos=/CABEAMENTO|CABOS?|FIBRA/.test(require('./vtal.cjs').normalizar(texto));
 return responder((cabos?'Entendo que já existe cabeamento no local. A presença dos cabos, porém, não confirma a disponibilidade para uma nova contratação. ':'')+'A consulta não encontrou disponibilidade para esse imóvel. Posso consultar um endereço diferente, se você tiver. Sem outra opção, finalizaremos por enquanto.',undefined,'esclarecer_inviavel');
}
module.exports={novoEndereco,semDisponibilidade,esclarecerOuEncerrar};
