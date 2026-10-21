const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function corrigir(s){
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
