function corrigir(s){if(s.includes('// dadosContextuaisV1:'))return s;const a='      if (processarInput && estado.aguardando_confirmacao === true && clienteConfirmouResumoFluxoIA(entrada)) {';if(s.split(a).length!==2)throw Error('Confirmação de dados incompatível');return s.replace(a,`      // dadosContextuaisV1: propor interpretação com contexto e salvar só após confirmação.
      if(ctx.workspaceId==="grupoprime"&&[27,28].includes(Number(fluxo.id))&&processarInput){
        const contextual=require("../services/dados-contextuais.js").decidir(campos,variaveis,entrada,estado,validarValorFluxoIA);
        if(contextual){
          Object.assign(variaveis,contextual.dados);estado.valores_coletados={...(estado.valores_coletados||{}),...contextual.dados};
          estado.aguardando_confirmacao=false;
          estado.historico=[...(estado.historico||[]),{role:"user",content:entrada}];
          if(contextual.mensagem){estado.historico.push({role:"assistant",content:JSON.stringify({mensagem:contextual.mensagem,dados:contextual.dados,cliente_confirmou:false})});variaveis[estadoKey]=JSON.stringify(estado);await fnEnviar(contextual.mensagem);return{aguardarInput:true};}
          variaveis[estadoKey]=JSON.stringify(estado);
          entrada="O cliente confirmou os dados contextuais, já normalizados e salvos. Continue apenas com os dados ainda pendentes ou a confirmação do cadastro.";
        }
      }
`+a);}
module.exports={corrigir};
