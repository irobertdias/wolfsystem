'use strict';
module.exports=ctx=>{
 const executar=ctx.executarFluxo,{parse}=require('./venda-fluida-regras');
 ctx.executarFluxo=async function(ws,canal,numero,mensagem,enviar,preferido,opts={}){
  if(ws!=='grupoprime')return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  const s=await ctx.buscarSessaoFluxo(ws,canal,numero);if(!s||![27,28].includes(Number(s.fluxo_id)))return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  const{data:f,error}=await ctx.supabase.from('fluxos').select('id,nos,conexoes').eq('workspace_id',ws).eq('id',s.fluxo_id).single();if(error)throw error;const no=f.nos.find(n=>n.id===s.no_atual);
  if(no?.dados?.venda_fluida_v1!==true)return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  if(!['prime_documentos_ia','prime_reversao_documentos_ia'].includes(s.no_atual)){
   if(!s.variaveis?.nome&&s.no_atual==='prime_cadastro_ia'){
    const n=String(numero).replace(/\D/g,'');const{data:c}=await ctx.supabase.from('atendimentos').select('nome').eq('workspace_id',ws).eq('canal_id',canal).in('numero',[n,'+'+n]).in('status',['pendente','aberto','em_atendimento']).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(c?.nome&&/[a-zÀ-ÿ]{2}/i.test(c.nome))opts={...opts,variaveisIniciais:{...(opts.variaveisIniciais||{}),nome_contato_sugerido:String(c.nome).slice(0,120)}};
   }
   return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  }
  let snapshot=s;const vars={...(s.variaveis||{}),venda_fluida_v1:'SIM'},recebidos=parse(vars.documentos_solicitados_bko),pend=parse(vars.pendencias_coleta_bko),tipos=['rg_frente','rg_verso','comprovante_endereco'];
  if(vars.__retomar_apos_objecao==='SIM'){delete vars.__retomar_apos_objecao;const u=await ctx.supabase.from('fluxo_sessoes').update({variaveis:vars,updated_at:new Date().toISOString()}).eq('workspace_id',ws).eq('canal_id',canal).eq('id',s.id);if(u.error)throw u.error;const proximo=tipos.find(k=>!parse(vars[k])?.some?.(a=>a?.url)&&!recebidos[k]);if(proximo){await enviar('Vamos continuar de onde paramos. Pode enviar '+({rg_frente:'a frente da identidade, o lado com a foto',rg_verso:'o verso da identidade',comprovante_endereco:'o comprovante de endereço; se não tiver, pode avisar'}[proximo])+'?');return true;}return executar(ws,canal,numero,'',enviar,preferido,opts);}
  const tem=k=>Array.isArray(parse(vars[k]))&&parse(vars[k]).some(a=>a?.url);
  const falta=tipos.find(k=>!tem(k)&&!recebidos[k]);const arquivo=/^\[(?:img|file):([^\]\r\n]+)\]/i.exec(String(mensagem||''));const texto=String(mensagem||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/^(?:esquece|desisto|quero encerrar|nao quero mais)/.test(texto))return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  if(arquivo&&falta){
   const regras=no.dados.arquivos_salvar_regras||[],regra=regras.find(r=>r.variavel===falta);if(!regra)throw Error('Regra documental não configurada');
   let selecionada=regra,ladoReconhecido='';
   if(falta!=='comprovante_endereco'&&typeof ctx.analisarMidiaFluxoIA==='function'){
    try{const a=await ctx.analisarMidiaFluxoIA(no.dados,mensagem,{workspaceId:ws,canalId:canal,numero,fluxoId:f.id});const l=a?.ladoDocumento;if(a?.regraArquivoId==='prime_comprovante')selecionada=regras.find(r=>r.variavel==='comprovante_endereco')||regra;else if(['frente','verso'].includes(l)){ladoReconhecido=l;selecionada=regras.find(r=>r.variavel==='rg_'+l)||regra;}}catch{}
   }
   const captura=await ctx.capturarArquivoPrivado({workspaceId:ws,canalId:canal,numero,sessao:s,configuracao:no.dados,analise:{nomeArquivo:arquivo[1],regraArquivoId:selecionada.id,recebido_bko:true}});
   if(!captura)throw Error('O armazenamento não confirmou o recebimento');
   const atual=await ctx.buscarSessaoFluxo(ws,canal,numero);if(!atual||atual.id!==s.id||atual.no_atual!==s.no_atual)throw Error('Etapa alterada durante a captura; arquivo preservado');Object.assign(vars,atual.variaveis||{});snapshot=atual;
   recebidos[selecionada.variavel]=true;vars[selecionada.variavel]=JSON.stringify([captura.meta]);vars[selecionada.variavel+'_validado']='SIM';
   pend['documento_'+selecionada.variavel]={motivo:'Arquivo original recebido; conferência documental pelo BKO.'+(!ladoReconhecido&&selecionada.variavel==='rg_frente'?' Conferir se a frente contém o retrato; classificação automática inconclusiva.':'')};
  }else if(falta&&/nao (?:tenho|consigo|sei)|sem (?:documento|comprovante)|pode (?:enviar|mandar|seguir).*(?:assim|bko)/.test(texto)){
   const ausente=/comprovante/.test(texto)?'comprovante_endereco':falta;
   recebidos[ausente]=true;pend['documento_'+ausente]={informado:String(mensagem),motivo:ausente==='comprovante_endereco'?'Cliente não tem comprovante de endereço.':'Documento não disponível; solicitar pelo BKO.'};
  }else if(falta){
   if(/contrato|locacao|comprovante/.test(texto)&&/serve|em nome|\?/.test(texto)){await enviar('Sim, aceitamos contrato de locação e outros comprovantes, inclusive em nome de outra pessoa. Pode enviar o arquivo por aqui.');return true;}
   return executar(ws,canal,numero,mensagem,enviar,preferido,opts);
  }
  vars.documentos_solicitados_bko=JSON.stringify(recebidos);vars.pendencias_coleta_bko=JSON.stringify(pend);
  const proximo=tipos.find(k=>!tem(k)&&!recebidos[k]);
  const destino=proximo?s.no_atual:(s.no_atual==='prime_reversao_documentos_ia'?'prime_reversao_payload':'prime_documentos_conferir');
  const r=await ctx.supabase.from('fluxo_sessoes').update({variaveis:vars,no_atual:destino,aguardando_input:true,tipo_input_aguardado:proximo?'fluxo_ia':'http_request',updated_at:new Date().toISOString()}).eq('workspace_id',ws).eq('canal_id',canal).eq('id',s.id).eq('updated_at',snapshot.updated_at).select('id').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('Sessão alterada; nenhum dado foi sobrescrito');
  if(proximo){await enviar((arquivo?'Recebi o arquivo.':'Tudo bem, registrei a ausência para a equipe conferir.')+' Agora envie '+({rg_frente:'a frente da identidade, o lado com a foto da pessoa',rg_verso:'o verso da identidade',comprovante_endereco:'o comprovante de endereço (foto ou PDF)'}[proximo])+', por favor.');return true;}
  if(!arquivo)await enviar('Tudo bem, registrei a ausência do documento na observação e vou continuar com o pedido.');
  return executar(ws,canal,numero,'',enviar,preferido,opts);
 };
 ctx.vendaFluidaAtiva=true;
};
