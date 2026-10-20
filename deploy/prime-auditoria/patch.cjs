const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function substituirFuncao(s,nome,proxima,novo){const a=s.indexOf('async function '+nome+'('),b=s.indexOf('async function '+proxima+'(',a);if(a<0||b<0)throw Error('Função incompatível: '+nome);return s.slice(0,a)+novo+'\n\n'+s.slice(b);}
function fluxos(s){
 if(!s.includes('ctx.primeAuditoriaSessoes = true;'))s=s.replace('const CACHE_MODULO_VENDEDOR_IA = new Map();','ctx.primeAuditoriaSessoes = true;\nconst CACHE_MODULO_VENDEDOR_IA = new Map();');
 if(!s.includes('// primeSessaoConfirmada')){
  s=substituirFuncao(s,'buscarSessaoFluxo','salvarSessaoFluxo',`async function buscarSessaoFluxo(workspaceId, canalId, numero) {
  // primeSessaoConfirmada: erro de banco nunca significa cliente sem sessão.
  const {data,error}=await supabase.from("fluxo_sessoes").select("*").eq("workspace_id",workspaceId).eq("canal_id",canalId).eq("numero",numero).eq("status","ativo").maybeSingle();
  if(error)throw error;if(data)return data;
  const legado=await supabase.from("fluxo_sessoes").select("*").eq("workspace_id",workspaceId).is("canal_id",null).eq("numero",numero).eq("status","ativo").maybeSingle();
  if(legado.error)throw legado.error;if(!legado.data)return null;
  const migrado=await supabase.from("fluxo_sessoes").update({canal_id:canalId,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("id",legado.data.id).is("canal_id",null).select("*").maybeSingle();
  if(migrado.error)throw migrado.error;if(!migrado.data)throw Error("Sessão legada alterada durante a retomada");return migrado.data;
}`);
  s=substituirFuncao(s,'salvarSessaoFluxo','finalizarSessaoFluxo',`async function salvarSessaoFluxo(workspaceId, canalId, numero, fluxoId, noAtual, variaveis, aguardandoInput, tipoInputAguardado) {
  const expiraEm=new Date(Date.now()+SESSAO_TTL_HORAS*3600000).toISOString();
  const atual=await supabase.from("fluxo_sessoes").select("id").eq("workspace_id",workspaceId).eq("canal_id",canalId).eq("numero",numero).eq("status","ativo").maybeSingle();
  if(atual.error)throw atual.error;
  const payload={workspace_id:workspaceId,canal_id:canalId,fluxo_id:fluxoId,numero,no_atual:noAtual,variaveis,status:"ativo",aguardando_input:!!aguardandoInput,tipo_input_aguardado:tipoInputAguardado||null,ultimo_no_executado:noAtual,expira_em:expiraEm,updated_at:new Date().toISOString()};
  const q=atual.data?supabase.from("fluxo_sessoes").update(payload).eq("workspace_id",workspaceId).eq("canal_id",canalId).eq("id",atual.data.id):supabase.from("fluxo_sessoes").insert([payload]);
  const r=await q.select("id").maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error("O banco não confirmou a sessão do atendimento");return r.data;
}`);
  // Todos os pontos internos conhecem o canal; chamadas externas antigas continuam compatíveis.
  s=s.replaceAll('finalizarSessaoFluxo(workspaceId, numero)','finalizarSessaoFluxo(workspaceId, numero, canalId)');
  const a=s.indexOf('async function finalizarSessaoFluxo('),b=s.indexOf('async function persistirVariaveis(',a);
  s=s.slice(0,a)+`async function finalizarSessaoFluxo(workspaceId, numero, canalId) {
  let q=supabase.from("fluxo_sessoes").update({status:"finalizado",aguardando_input:false,tipo_input_aguardado:null,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId).eq("numero",numero).eq("status","ativo");
  if(canalId!=null)q=q.eq("canal_id",canalId);const r=await q;if(r.error)throw r.error;
}
\n`+s.slice(b);
 }
 if(!s.includes('// primeLiteralPersistida')){
  const a=s.indexOf('          await fnEnviar(mensagemInicialLiteral);'),b=s.indexOf('          return { aguardarInput: true };',a);
  if(a<0||b<0)throw Error('Encaixe da mensagem inicial incompatível');
  let trecho=s.slice(a,b).replace('          await fnEnviar(mensagemInicialLiteral);\n','').replace('          await fnEnviar(mensagemInicialLiteral);\r\n','');
  trecho+=`          // primeLiteralPersistida: não anunciar recuperação sem a sessão salva.
          await salvarSessaoFluxo(ctx.workspaceId, ctx.canalId, ctx.numero, fluxo.id, no.id, variaveis, true, no.tipo);
          await fnEnviar(mensagemInicialLiteral);
`;
  s=s.slice(0,a)+trecho+s.slice(b);
 }
 if(!s.includes('// primeDocumentosRetomada')){
  const a='        const mensagemInicialLiteral = substituirVariaveis(d.mensagem_inicial || "", variaveis).trim();';
  const b=`        let mensagemInicialLiteral = substituirVariaveis(d.mensagem_inicial || "", variaveis).trim();
        // primeDocumentosRetomada: perguntar somente por arquivos realmente ausentes.
        if (ctx.workspaceId === "grupoprime" && ["prime_documentos_ia","prime_reversao_documentos_ia"].includes(no.id)) {
          const pendente=["rg_frente","rg_verso","comprovante_endereco"].find(k=>{let a;try{a=typeof variaveis[k]==="string"?JSON.parse(variaveis[k]):variaveis[k]}catch{}return variaveis[k+"_validado"]!=="SIM"||!Array.isArray(a)||!a.some(x=>x?.url)});
          mensagemInicialLiteral=pendente?"Para continuar, envie "+({rg_frente:"a frente da identidade",rg_verso:"o verso da identidade",comprovante_endereco:"o comprovante de endereço (foto ou PDF)"}[pendente])+", por favor.":"Os três documentos já estão salvos. Não precisa reenviar. Posso tentar concluir o registro no CRM novamente?";
        }`;
  if(!s.includes(a))throw Error('Mensagem literal incompatível');s=s.replace(a,b);
 }
 if(!s.includes('// primeRetomarPedidoExistente')){
  const marca='  // 4. Determina nó atual';
  const b=`  // primeRetomarPedidoExistente: uma resposta ao BKO não abre nova venda por falta de sessão.
  if(workspaceId==="grupoprime" && Number(fluxo.id)===27 && !sessao && !opts.forcarNovaSessao && /^\\d+$/.test(String(variaveis.proposta_id||""))) {
    const novo=/^(?:\\/(?:reiniciar|menu)|reiniciar atendimento|novo pedido|nova venda|nova contratacao|nova contratação|outra instalacao|outra instalação)$/i.test(String(mensagemCliente||"").trim());
    if(novo)variaveis={numero:String(numero).replace(/\\D/g,""),mensagem:mensagemCliente||""};
    else {
      const r=await supabase.from("proposta").select("*").eq("workspace_id",workspaceId).eq("canal_id",canalId).eq("id",Number(variaveis.proposta_id)).maybeSingle();
      if(r.error)throw r.error;
      if(r.data){const v=r.data,status=String(v.status_venda||"").toUpperCase();
        if(status==="CPF REPROVADO"){
          const no=fluxo.nos.find(x=>x.id==="prime_reversao_ia");if(!no)throw Error("Recuperação do pedido não configurada");
          for(const k of ["cpf_novo","nome_novo_titular","nascimento_novo_titular","nome_mae_novo_titular","autorizacao_novo_titular","recuperacao_payload","recuperacao_resposta"])delete variaveis[k];
          for(const k of ["cpf","nome","nome_mae","data_nascimento"])variaveis[k]=String(v[k]||"");
          variaveis.cpf_reprovado=String(v.cpf||"");
          variaveis["__fluxo_ia_"+no.id]=JSON.stringify({mensagem_inicial_enviada:true,aguardando_confirmacao:false,valores_coletados:{},historico:[{role:"assistant",content:no.dados?.mensagem_inicial||"Informe outro CPF para continuar o pedido."}]});
          await salvarSessaoFluxo(workspaceId,canalId,numero,fluxo.id,no.id,variaveis,true,"fluxo_ia");sessao=await buscarSessaoFluxo(workspaceId,canalId,numero);
        }else{
          if(/status|pedido|instal|andamento/i.test(String(mensagemCliente||"")))await fnEnviar("Seu pedido #"+v.id+" está em "+v.status_venda+". Vamos acompanhar por este atendimento.");
          return true;
        }
      }
    }
  }

`+marca;
  if(!s.includes(marca))throw Error('Entrada do motor incompatível');s=s.replace(marca,b);
 }
 if(!s.includes('// primeResumoDocumentos')){
  const a='      const resumo = resumoFluxoIA(campos, resultado.consolidados || variaveis);';
  const b=`      let resumo = resumoFluxoIA(campos, resultado.consolidados || variaveis);
      // primeResumoDocumentos: não exibir flags e campos auxiliares de OCR ao cliente.
      if (ctx.workspaceId === "grupoprime" && ["prime_documentos_ia","prime_reversao_documentos_ia"].includes(no.id)) {
        const cpf=String(variaveis.cpf||"").replace(/\\D/g,"");
        resumo="Titular: "+String(variaveis.nome||"")+"\\nCPF: ***.***.***-"+cpf.slice(-2)+"\\n\\n✅ Frente da identidade recebida\\n✅ Verso da identidade recebido\\n✅ Comprovante recebido\\n\\nPodemos enviar o pedido para auditoria?";
      }`;
  if(!s.includes(a))throw Error('Resumo incompatível');s=s.replace(a,b);
 }
 if(!s.includes('// primeVendaIdempotente')){
  const a=s.indexOf('        const { data: propCriada, error: errProp } = await supabase'),b=s.indexOf('        const propostaId = propCriada?.id;',a);
  if(a<0||b<0)throw Error('INSERT venda incompatível');
  s=s.slice(0,a)+`        // primeVendaIdempotente: uma sessão validada retoma a mesma proposta após falha de confirmação.
        let propCriada=null;
        if(workspaceId==="grupoprime") {
          const origem=String(variaveis.sessao_origem_id||"");
          if(!/^\\d+$/.test(origem))throw Error("Sessão validada ausente; pedido não foi duplicado");
          const anterior=await supabase.from("proposta").select("id").eq("workspace_id",workspaceId).eq("canal_id",canalId).eq("fluxo_id",fluxo.id).eq("dados_customizados->>sessao_origem_id",origem).maybeSingle();
          if(anterior.error)throw anterior.error;propCriada=anterior.data;
        }
        if(!propCriada){const r=await supabase.from("proposta").insert([proposta]).select("id").single();if(r.error)throw r.error;if(!r.data)throw Error("CRM não confirmou o registro");propCriada=r.data;}

`+s.slice(b);
 }
 if(!s.includes('// primeVendaConfirmacaoIndependente')){
  const a='        if (msgOk) await fnEnviar(msgOk);';
  const b=`        // primeVendaConfirmacaoIndependente: falha do aviso não desfaz CRM nem duplica a venda.
        if (msgOk) {if(workspaceId==="grupoprime"){try{await fnEnviar(msgOk)}catch(e){console.error("[CRM] Venda salva; confirmação ao cliente falhou: "+e.message)}}else await fnEnviar(msgOk);}`;
  if(!s.includes(a))throw Error('Aviso de venda incompatível');s=s.replace(a,b);
 }
 return s;
}
function fila(s){const a='    if (!extensaoAtiva && !configuracaoNatural) return executarAnterior(...args);',b='    // primeFilaSempre: eventos CRM e mensagens do cliente compartilham a mesma fila.\n    if (!extensaoAtiva && !configuracaoNatural && workspaceId !== "grupoprime") return executarAnterior(...args);';if(s.includes(b))return s;if(!s.includes(a))throw Error('Fila incompatível');return s.replace(a,b);}
function worker(s){
 const a='    Object.assign(vars, proposta.dados_customizados || {});';
 const b=a+`\n    // primeTitularCanonico: campos atuais do CRM prevalecem sobre snapshots antigos.
    if (proposta.workspace_id === "grupoprime") for (const k of ["cpf","nome","nome_mae","data_nascimento","rg","email","cep","endereco","plano","valor_plano","status_venda"]) if(Object.prototype.hasOwnProperty.call(proposta,k))vars[k]=texto(proposta[k]);`;
 if(!s.includes('// primeTitularCanonico:')){if(!s.includes(a))throw Error('Snapshot CRM incompatível');s=s.replace(a,b);}
 if(!s.includes('// primeEventoExecutado')){
  const a='      await ctx.executarFluxo(proposta.workspace_id, canalId, numero, "", envio.enviarTexto, fluxo.id, {';
  if(!s.includes(a))throw Error('Execução CRM incompatível');s=s.replace(a,a.replace('await ctx.executarFluxo','const executado = await ctx.executarFluxo'));
  const marca='      await supabase.from("crm_automacao_eventos").update({ status: "concluido", processed_at: new Date().toISOString() }).eq("id", criado.id);';
  if(!s.includes(marca))throw Error('Conclusão CRM incompatível');s=s.replace(marca,'      // primeEventoExecutado: não registrar sucesso quando o motor recusou o fluxo.\n      if(executado === false)throw Error("O motor não confirmou a execução da automação CRM");\n'+marca);
 }
 return s;
}
module.exports={fluxos,fila,worker};
if(require.main===module){
 const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');const plano=[['src/routes/fluxos.js',fluxos],['src/services/fluxo-ia-fila.js',fila],['src/jobs/crm-automacoes-worker.js',worker]].map(([p,f])=>({p,codigo:f(fs.readFileSync(path.join(root,p),'utf8'))}));
 for(const x of plano){const r=spawnSync(process.execPath,['--check'],{input:x.codigo,encoding:'utf8'});if(r.status)throw Error(r.stderr);}
 if(process.argv.includes('--check')){console.log('AUDITORIA_CHECK_OK: nenhum arquivo alterado.');process.exit(0)}
 const backup=path.join(root,'backups','auditoria-prime-'+Date.now());for(const x of plano){const b=path.join(backup,x.p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(path.join(root,x.p),b);}
 try{for(const x of plano)fs.writeFileSync(path.join(root,x.p),x.codigo)}catch(e){for(const x of plano)fs.copyFileSync(path.join(backup,x.p),path.join(root,x.p));throw e}console.log('Auditoria instalada; backup: '+backup);
}
