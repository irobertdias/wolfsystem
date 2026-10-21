function index(s){const marca='require("./src/services/bloqueio-terminal.js")(ctx);';if(s.includes(marca))return s;const antes='require("./src/services/webjs-manager.js")(ctx);';if(s.split(antes).length!==2)throw Error('Ordem de módulos incompatível');return s.replace(antes,marca+'\n'+antes);}
function mensagens(s){if(s.includes('// bloqueioTerminalV1:'))return s;const antes='    // 🆕 ═══════════════════════════════════════════════════════════════\n    // VERIFICAÇÃO DE BLOQUEIO PÓS-FINALIZAÇÃO (só pra mensagens DO CLIENTE)';
 // O trecho vem depois da persistência da mensagem e antes de criar/reativar cards.
 const marca='    if (!erroInsercaoMensagem && providerMessageId && de !== "cliente") {';
 if(s.split(marca).length!==2)throw Error('Persistência de mensagens incompatível');
 return s.replace(marca,`    // bloqueioTerminalV1: mensagens ficam no histórico; bloqueio não pode criar outro card.
    if(de === "cliente" || de === "bot"){
      try{
        const bloqueio=await require("./bloqueio-terminal.js").buscarBloqueio(supabase,workspaceId,canalId,numeroLimpo);
        if(bloqueio)return{bloqueado:true,origem:"encerramento",atendimentoId:bloqueio.id};
      }catch(e){console.error("[Bloqueio terminal] mensagem preservada; automação suspensa:",e.message);return{bloqueado:true,erroVerificacao:true};}
    }
`+marca);
}
module.exports={index,mensagens};
