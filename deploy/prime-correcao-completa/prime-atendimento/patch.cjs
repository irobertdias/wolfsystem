const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function substituir(s,a,b){if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('Versão incompatível: encaixe não encontrado');return s.replace(a,b);}
function worker(s){
 s=substituir(s,'    if (enviados >= lista.length) {','    // primeRepetirUltimo: repetição apenas no vendedor Grupo Prime.\n    const repetir = sessao.workspace_id === "grupoprime" && Number(sessao.fluxo_id) === 27 && config.reengajamento_repetir_ultimo === true;\n    if (enviados >= lista.length && !repetir) {');
 s=substituir(s,'    const atual = lista[enviados];','    const atual = lista[Math.min(enviados, lista.length - 1)];');
 s=substituir(s,'    if (tipo === "waba") {','    if (tipo === "waba") {\n      // primeJanelaOficial: mensagens livres só dentro da janela de atendimento.\n      if (sessao.workspace_id === "grupoprime" && Number(sessao.fluxo_id) === 27) {\n        const ultimaResposta = new Date(lerEstado(sessao.variaveis).respondeuEm || 0).getTime();\n        if (!ultimaResposta || !Number.isFinite(ultimaResposta) || Date.now() - ultimaResposta >= 24 * 3600000) { await cancelarAgendamento(sessao, "janela_api_oficial_expirada_precisa_template"); return false; }\n      }');
 return s;
}
function entrada(s){
 const a='    const extensaoAtiva = typeof ctx.extensaoFluxoIAAtiva === "function"';
 const b=`    // primeEncerrarExplicito: respeitar desistência em qualquer etapa sem depender do modelo.
    if (workspaceId === "grupoprime" && /^(?:(?:pode |quero )?encerrar(?: o atendimento)?|(?:pode |quero )?finalizar o atendimento|sair|parar|(?:quero )?cancelar(?: o)? atendimento|quero encerrar(?: o atendimento)?|nao quero(?: mais)?(?: continuar| contratar)?|nao tenho interesse(?: em contratar)?|nao me (?:mande|envie|chame)(?: mais)?(?: mensagens)?)$/.test(normalizar(mensagemCliente).replace(/[.!?]+$/g, ""))) {
      const sessao = await ctx.buscarSessaoFluxo(workspaceId, canalId, numero);
      if (sessao && Number(sessao.fluxo_id) === 27) {
        const agora = new Date().toISOString();
        const estado = { ...lerEstado(sessao.variaveis), aguardandoRespostaCliente: false, agendadoPara: null, dispararEm: null, canceladoEm: agora, motivoCancelamento: "pedido_cliente" };
        const r = await ctx.supabase.from("fluxo_sessoes").update({ status: "finalizado", aguardando_input: false, tipo_input_aguardado: null, variaveis: gravarEstado(sessao.variaveis, estado), updated_at: agora }).eq("id", sessao.id).eq("workspace_id", workspaceId);
        if (r.error) throw r.error;
        const n = String(numero).replace(/\\D/g, "");
        const a = await ctx.supabase.from("atendimentos").update({ status: "resolvido", updated_at: agora }).eq("workspace_id", workspaceId).eq("canal_id", canalId).in("numero", [n, "+" + n]);
        if (a.error) throw a.error;
        await fnEnviar("Tudo bem! Seu atendimento foi encerrado e os lembretes foram cancelados. Se precisar de nós novamente, é só chamar. 💚");
        return true;
      }
    }
`+a;
 // A mesma declaração existe em duas funções: aplicar só após a assinatura pública.
 const i=s.indexOf('  async function executarFluxoComFollowups(');if(i<0)throw Error('Entrada incompatível');
 return s.slice(0,i)+substituir(s.slice(i),a,b);
}
module.exports={worker,entrada};
if(require.main===module){
 const raiz=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),check=process.argv.includes('--check');
 const plano=[['src/jobs/fluxo-ia-followups-worker.js',worker],['src/services/fluxo-ia-followups.js',entrada]].map(([p,fn])=>[p,fn(fs.readFileSync(path.join(raiz,p),'utf8'))]);
 for(const [p,s]of plano){const r=spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8'});if(r.status)throw Error(p+': '+r.stderr);}
 if(check){console.log('ATENDIMENTO_CHECK_OK: 2 arquivos validados; nada alterado.');process.exit(0);}
 const backup=path.join(raiz,'backups','prime-atendimento-'+new Date().toISOString().replace(/[:.]/g,'-'));
 for(const [p,s]of plano){const destino=path.join(raiz,p),b=path.join(backup,p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(destino,b);fs.writeFileSync(destino,s);}
 console.log('Instalado; backup: '+backup+'. Reinicie: pm2 restart wolf-whatsapp');
}
