const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function corrigir(s){
 if(!s.includes('// roteiroEstadoConversaV1:')){
  const estado=/      estado = \{\r?\n        historico: resultado\.historico \|\| \[\],/g;if([...s.matchAll(estado)].length!==1)throw Error('Estado da conversa incompatível');
  s=s.replace(estado,'      estado = {\n        // roteiroEstadoConversaV1: conversar não apaga a etapa de escolha.\n        ...estado,\n        historico: resultado.historico || [],');
 }
 if(!s.includes('// roteiroConversaV1:')){
  const ponto='      const dadosAceitos = resultado.dados || {};';if(s.split(ponto).length!==2)throw Error('Resultado da conversa incompatível');
  s=s.replace(ponto,`      // roteiroConversaV1: a IA responde dúvidas, mas não escolhe um plano pelo cliente.
      if(["nio-v1","vero-v1"].includes(d.perfil_vendedor)&&(estado.nio_etapa_oferta||estado.vero_etapa_oferta)&&!/humano|atendente/i.test(String(entrada))){
        if(resultado.dados)delete resultado.dados.plano_interesse;
        if(resultado.consolidados)delete resultado.consolidados.plano_interesse;
        if(!variaveis.plano_interesse)resultado.faltantes=[...new Set([...(resultado.faltantes||[]),"Escolha do plano"])];
      }
`+ponto);
 }
 if(s.includes('// roteiroObrigatorioV1:'))return s;
 const pre='      if (processarInput && estado.aguardando_confirmacao === true && clienteConfirmouResumoFluxoIA(entrada)) {';
 const pos='      if (estado.aguardando_confirmacao && resultado.clienteConfirmou) {';
 if(s.split(pre).length!==2||s.split(pos).length!==2)throw Error('Encaixes da confirmação incompatíveis');
 const conferir=`      // roteiroObrigatorioV1: nenhuma IA avança por um "sim" com cadastro incompleto.
      const pendenciasRoteiro=require("../services/roteiro-obrigatorio.js").pendencias;
      if(estado.aguardando_confirmacao && pendenciasRoteiro(campos,{...variaveis,...(estado.valores_coletados||{})},validarValorFluxoIA,normalizarComparacaoFluxoIA).length){
        estado.aguardando_confirmacao=false;
      }
`;
 const final=`      const pendentesRoteiro=pendenciasRoteiro(campos,{...variaveis,...(estado.valores_coletados||{}),...(resultado.consolidados||{})},validarValorFluxoIA,normalizarComparacaoFluxoIA);
      if(pendentesRoteiro.length){
        estado.aguardando_confirmacao=false;variaveis[estadoKey]=JSON.stringify(estado);
        await fnEnviar("Para continuar, preciso de "+String(pendentesRoteiro[0].label||pendentesRoteiro[0].nome)+". Pode me informar, por favor?");
        return{aguardarInput:true};
      }
`;
 // Vem antes dos atalhos específicos de endereço/plano, quando instalados.
 const atalho=s.indexOf('      // primeEtapas:');
 s=s.replace(pre,conferir+pre);
 if(atalho>=0)s=s.replace('      // primeEtapas:',final+'      // primeEtapas:');else s=s.replace(pos,final+pos);
 return s;
}
module.exports={corrigir};
