function bridge(s){
 if(s.includes('// comprovanteDiretoV1:')&&!s.includes('.recuperar(ctx,')){
  const ponto='        const resposta=require("./comprovante-direto.js").resposta';if(s.split(ponto).length!==2)throw Error('Atualização da recuperação de comprovante incompatível');
  return s.replace(ponto,`        // comprovanteRecuperacaoV2: recuperar anexo já recebido antes de pedir outro.
        if(!/esquece|encerrar|cancelar|desistir|nao quero|não quero|parar/i.test(String(mensagemCliente))){
          let recuperado;
          try{recuperado=await require("./comprovante-direto.js").recuperar(ctx,workspaceId,canalId,numero,s,config?.dados||{});}catch(e){console.error("[Comprovante] recuperação do anexo anterior:",e.message);}
          if(recuperado){const novos=[...args];novos[3]="CAPTURA_SEGURA_ARQUIVO=SIM; comprovante_endereco_validado=SIM. Comprovante recuperado e salvo. Continue sem pedir reenvio. Mensagem do cliente: "+String(mensagemCliente||"");return executarFluxoBase(...novos);}
        }
`+ponto);
 }
 if(s.includes('// comprovanteDiretoV1:'))return s;
 const re=/      const analise = await ctx\.analisarMidiaFluxoIA\((dadosLeitura|configuracao\?\.dados \|\| \{\}), entradaParaAnalise, \{\r?\n        workspaceId, canalId, numero, fluxoId: configuracao\?\.fluxo\?\.id \|\| fluxoIdPreferido \|\| null,\r?\n      \}\);/g;
 const matches=[...s.matchAll(re)];if(matches.length!==1)throw Error('Leitura de mídia incompatível');
 const chamada=matches[0][0].trim().replace(/^const analise = /,'').replace(/;$/,'');
 s=s.replace(re,`      // comprovanteDiretoV1: salvar o anexo solicitado sem exigir classificação ou OCR.
      const comprovanteDireto=require("./comprovante-direto.js").decidir(workspaceId,sessaoAntes,configuracao?.dados||{},entradaParaAnalise);
      const analise = comprovanteDireto || ${chamada};`);
 const ponto='    let arquivoReanalise = null;';if(s.split(ponto).length!==2)throw Error('Entrada da ponte incompatível');
 s=s.replace(ponto,ponto+`
    if(!entradaEhMidia && typeof ctx.buscarSessaoFluxo==="function" && typeof ctx.configuracaoExtensoesFluxoIA==="function"){
      const s=await ctx.buscarSessaoFluxo(workspaceId,canalId,numero);
      if(["prime_documentos_ia","prime_reversao_documentos_ia"].includes(s?.no_atual)){
        const config=await ctx.configuracaoExtensoesFluxoIA(workspaceId,canalId,numero,fluxoIdPreferido);
        if(!/esquece|encerrar|cancelar|desistir|nao quero|não quero|parar/i.test(String(mensagemCliente))){
          let recuperado;
          try{recuperado=await require("./comprovante-direto.js").recuperar(ctx,workspaceId,canalId,numero,s,config?.dados||{});}catch(e){console.error("[Comprovante] recuperação do anexo anterior:",e.message);}
          if(recuperado){
            const novos=[...args];novos[3]="CAPTURA_SEGURA_ARQUIVO=SIM; comprovante_endereco_validado=SIM. Comprovante já recebido recuperado e salvo no pedido. Continue sem pedir reenvio. Mensagem do cliente: "+String(mensagemCliente||"");
            return executarFluxoBase(...novos);
          }
        }
        const resposta=require("./comprovante-direto.js").resposta(workspaceId,s,config?.dados||{},mensagemCliente);
        if(resposta){await fnEnviar(resposta);return true;}
      }
    }
`);
 return s;
}
module.exports={bridge};
