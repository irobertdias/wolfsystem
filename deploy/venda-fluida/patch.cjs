function fluxos(s){
 if(s.includes('// vendaFluidaDadosV1:'))return s;
 if(!s.includes('    case "publico":'))s=s.replace('    case "email":','    case "publico":\n      return ["PF","PJ"].includes(normalizarValorFluxoIA("publico",valor));\n    case "email":');
 if(!/if\s*\(tipo === "publico"\)/.test(s)){const p=s.indexOf('function normalizarValorFluxoIA('),q=s.indexOf('  const texto = String(valor ?? "").trim();',p);if(q<0)throw Error('Normalização de público incompatível');s=s.slice(0,q)+s.slice(q).replace('  const texto = String(valor ?? "").trim();','  const texto = String(valor ?? "").trim();\n  if(tipo === "publico"){const t=texto.toUpperCase();return /^(PF|CPF)$/.test(t)?"PF":/^(PJ|CNPJ)$/.test(t)?"PJ":"";}');}
 if(!/if\s*\(configurado === "publico"\)/.test(s))s=s.replace('  // Campos criticos sao reconhecidos pelo significado, mesmo quando o editor','  if(configurado === "publico")return "publico";\n  // Campos criticos sao reconhecidos pelo significado, mesmo quando o editor');
 const a='async function processarNo(fluxo, no, variaveis, mensagemCliente, processarInput, fnEnviar, ctx) {';
 const p=s.indexOf(a),q=s.indexOf('  const d = no.dados || {};',p);if(p<0||q<0)throw Error('Processador do fluxo incompatível');
 s=s.slice(0,q)+s.slice(q).replace('  const d = no.dados || {};','  let d = no.dados || {};');
 const inicio=s.indexOf('    case "fluxo_ia":',p),campos=s.indexOf('      const campos = (Array.isArray(d.variaveis)',inicio);if(inicio<0||campos<0)throw Error('Campos IA incompatíveis');
 s=s.slice(0,campos)+`      // vendaFluidaDadosV1: pendência de negócio segue ao BKO, não vira loop de coleta.
      if(ctx.workspaceId==="grupoprime"&&[27,28].includes(Number(fluxo.id)))d=require("../services/venda-fluida-regras.js").ajustar(d,variaveis,mensagemCliente,processarInput);
`+s.slice(campos);
 const cpf=/    case "cpf":\r?\n      return [^\r\n]+;/g;if([...s.matchAll(cpf)].length!==1)throw Error('Validação do CPF incompatível');
 s=s.replace(cpf,'    case "cpf":\n      return require("../services/venda-fluida-regras.js").cpfValido(valor);');
 const recebidos=/  for \(const campo of campos\) \{\r?\n    if \(!\(campo.nome in recebidos\)\) continue;/g;if([...s.matchAll(recebidos)].length!==1)throw Error('Coleta estruturada incompatível');
 s=s.replace(recebidos,'  for (const campo of campos) {\n    if(dados.venda_fluida_v1===true&&dados.bko_campos_pendentes?.includes(campo.nome))continue;\n    if (!(campo.nome in recebidos)) continue;');
 const resumo=/      (?:const|let) resumo = resumoFluxoIA\(campos, resultado.consolidados \|\| variaveis\);/g;if([...s.matchAll(resumo)].length!==1)throw Error('Resumo de coleta incompatível');
 return s.replace(resumo,`      let resumo = resumoFluxoIA(campos, resultado.consolidados || variaveis);
      if(d.venda_fluida_v1===true){const pend=require("../services/venda-fluida-regras.js").parse(variaveis.pendencias_coleta_bko);const itens=Object.entries(pend).filter(([k])=>!k.startsWith("documento_")).map(([k,v])=>"• "+(campos.find(c=>c.nome===k)?.label||k)+": "+String(v.motivo||"conferir")+(v.informado?" (informado: "+String(v.informado)+")":""));if(itens.length)resumo+="\\n\\nA conferir pelo BKO:\\n"+itens.join("\\n");}
`);
}
function oferta(s,nome){if(s.includes('// vendaFluidaOfertaV1:'))return s;const a='function '+nome+'(d,';const p=s.indexOf(a),q=s.indexOf('{',p);if(p<0||q<0)throw Error('Oferta incompatível');
 // A assinatura tem um parâmetro de opções desestruturado: inserir após o fim da assinatura.
 const fim=s.indexOf('={}){',p);if(fim<0)throw Error('Opções de oferta incompatíveis');const i=fim+'={}){'.length;
 return s.slice(0,i)+'\n // vendaFluidaOfertaV1: catálogo imediatamente após disponibilidade.\n if(d.venda_fluida_v1===true)return require("./venda-fluida-regras.js").oferta(d,'+(nome==='decidirOfertaNio'?'v,entrada,e':'vars,entrada,estado')+',{aposConsulta});\n'+s.slice(i);
}
function bridge(s){if(s.includes('// vendaFluidaRecebidoV1:'))return s;const a='function validarIdentidadeArquivo(regra, analise, variaveis) {';if(s.split(a).length!==2)throw Error('Captura de documentos incompatível');return s.replace(a,a+'\n  // vendaFluidaRecebidoV1: anexo recebido para conferência, sem alegar identidade verificada.\n  if(analise?.recebido_bko===true&&/^prime_/.test(String(regra.id)))return{identidade:null};');}
function index(s){const a='require("./src/services/bloqueio-terminal.js")(ctx);',b='require("./src/services/venda-fluida.js")(ctx);';if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('Instale o bloqueio terminal antes do fluxo fluido');return s.replace(a,b+'\n'+a);}
function bko(s){
 if(s.includes('// vendaFluidaBkoV1:'))return s;
 const a='  return ["rg_frente","rg_verso","comprovante_endereco"].map(tipo=>{';const b='    if(!Array.isArray(lista)||lista.length!==1)throw Error("Documentação incompleta no CRM.");';
 if(s.split(a).length!==2||s.split(b).length!==2)throw Error('BKO incompatível');
 s=s.replace(a,'  // vendaFluidaBkoV1: enviar anexos disponíveis e destacar o que falta.\n  return ["rg_frente","rg_verso","comprovante_endereco"].flatMap(tipo=>{').replace(b,'    if(!Array.isArray(lista)||lista.length!==1){if(custom.venda_fluida_v1==="SIM")return[];throw Error("Documentação incompleta no CRM.");}');
 s=s.replace('return {tipo,path,nome:','return {tipo,path,recebido_bko:custom.venda_fluida_v1==="SIM",nome:');
 s=s.replace("if(doc.tipo!=='comprovante_endereco'&&data.type==='application/pdf')", "if(doc.tipo!=='comprovante_endereco'&&data.type==='application/pdf'&&!doc.recebido_bko)");
 const doc="'RG frente, RG verso e comprovante de endereço seguem anexados nesta conversa.'";
 if(s.split(doc).length!==2)throw Error('Resumo BKO incompatível');s=s.replace(doc,'v.dados_customizados?.venda_fluida_v1==="SIM"?"Anexos efetivamente recebidos seguem nesta conversa. Ausências e divergências estão listadas abaixo.":'+doc);
 const retorno="    '', '*↩️ RETORNO DO BKO*',";if(s.split(retorno).length!==2)throw Error('Retorno BKO incompatível');
 s=s.replace('versao:4,','versao:4,venda_fluida:ctx.vendaFluidaAtiva===true,');
 return s.replace(retorno,"    ...(v.dados_customizados?.venda_fluida_v1===\"SIM\"?['','*⚠️ CONFERÊNCIA DO BKO*',...(()=>{const p=parse(v.dados_customizados.pendencias_bko);return Array.isArray(p)&&p.length?p.map(x=>'• '+limpo(x)):['Conferir os dados e anexos recebidos.'];})()]:[]),\n"+retorno);
}
function captura(s){
 if(s.includes('// cepPreservadoV1:'))return s;
 const a='function aplicarCepNoEstado(no, variaveis, cep) {';
 const b='  const campo = camposCep[0];';
 const c='aplicarCepNoEstado(no, { ...(sessao.variaveis || {}) }, cep)';
 if(s.split(a).length!==2||s.split(b).length!==2||s.split(c).length!==2)throw Error('Proteção do CEP incompatível');
 return s.replace(a,'function aplicarCepNoEstado(no, variaveis, cep, mensagem = "") {').replace(b,b+'\n  // cepPreservadoV1: telefone parcial não substitui CEP já coletado.\n  if(/^\\d{8}$/.test(String(variaveis[campo]||""))&&String(variaveis[campo])!==cep&&!/\\bcep\\b/i.test(mensagem))return{alterado:false,variaveis};').replace(c,'aplicarCepNoEstado(no, { ...(sessao.variaveis || {}) }, cep, mensagemCliente)');
}
function retentativas(s){
 if(s.includes('// bkoRetentativaAutomaticaV1:'))return s;
 const trava='    if(meta.destinatarios&&Object.values(meta.destinatarios).some(d=>d.partes.some(p=>p.estado==="em_envio"))){custom.bko_pendente="REVISAR";custom.bko_erro="Entrega sem confirmação. Confira no WhatsApp antes de liberar nova tentativa.";await salvar(v,custom);return;}';
 const falha='      custom=clone(v.dados_customizados);meta.lease=null;custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="REVISAR";custom.bko_erro="Envio interrompido; retentativa automática das partes ainda não enviadas.";custom.bko_tentar_em=new Date(Date.now()+60000).toISOString();';
 if(s.split(trava).length!==2||s.split(falha).length!==2)throw Error('Retentativa BKO incompatível');
 s=s.replace(trava,'    // bkoRetentativaAutomaticaV1: retomar após falha sem exigir operação no CRM.\n    require("./bko-retentativa.js").retomar(meta);');
 s=s.replace(falha,'      custom=clone(v.dados_customizados);custom.bko_tentar_em=require("./bko-retentativa.js").falha(meta);custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="SIM";custom.bko_erro="Nova tentativa automática agendada para os anexos pendentes.";custom.bko_ultimo_erro_tecnico=String(e.message||e).slice(0,500);');
 return s.replace('meta.lease=null;custom=clone(v.dados_customizados);custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="ENVIADO"','meta.lease=null;meta.falhas_consecutivas=0;custom=clone(v.dados_customizados);custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="ENVIADO"');
}
function recibos(s){
 if(s.includes('// bkoAckV1:'))return s;
 const texto='return r.messageId;',midia='return r.id._serialized;';
 if(s.split(texto).length!==2||s.split(midia).length!==2)throw Error('Recibos BKO incompatíveis');
 return '// bkoAckV1: ID gerado sem ACK não confirma envio.\n'+s.replace(texto,'return await require("./bko-recibo.js").confirmar(ctx.sessoes[String(c.canalId)].client,r.messageId,r.ack);').replace(midia,'return await require("./bko-recibo.js").confirmar(ctx.sessoes[String(c.canalId)].client,r.id._serialized,r.ack);');
}
function cepEntrada(s){
 if(s.includes('// cepEntradaComercialV2:'))return s;
 const a='      // roteiroObrigatorioV1:';if(s.split(a).length!==2)throw Error('Captura comercial de CEP incompatível');
 return s.replace(a,`      // cepEntradaComercialV2: captura antecede a IA e dispara consulta na mesma interação.
      if(processarInput&&["nio-v1","vero-v1"].includes(d.perfil_vendedor)){
        const achado=String(entrada||"").trim().match(/^(?:cep[\\s.:]*)?(\\d{5}[ .-]?\\d{3})[.!]?$/i);
        if(achado){const cep=achado[1].replace(/\\D/g,"");if(validarValorFluxoIA("cep",cep)&&variaveis.cep!==cep){variaveis.cep=cep;estado.valores_coletados={...(estado.valores_coletados||{}),cep};estado.consultas={};estado.contexto_consultas={};delete estado.catalogo_fluido;delete estado.plano_fluido_pendente;delete variaveis.resposta_viabilidade;delete variaveis.plano_interesse;}}
      }
`+a);
}
function encaminhamento(s){
 if(s.includes('// bkoOperadoraV2:'))return s;
 const re=/  function rotaVenda\(cfg,v\)\{[\s\S]*?\r?\n  \}\r?\n  async function processar/;
 if(!re.test(s))throw Error('Roteamento por operadora incompatível');
 s=s.replace(re,'  // bkoOperadoraV2: configuração atual atende vendas históricas da mesma operadora.\n  function rotaVenda(cfg,v){return require("./bko-roteamento.js").rota(cfg,v,FLUXO);}\n  async function processar');
 const filtro=".in(\"canal_id\",cfg.modo==='por_canal'?cfg.contatos.map(x=>x.canal_trafego_id):[cfg.canal_trafego_id])";
 if(s.split(filtro).length!==2)throw Error('Filtro de vendas BKO incompatível');s=s.replace(filtro,'');
 const fila='if(cfg.fila_nome){const origem=await ctx.getConfigCanal(v.canal_id);';if(s.split(fila).length!==2)throw Error('Origem BKO incompatível');s=s.replace(fila,'if(cfg.fila_nome&&!cfg.historico_operadora){const origem=await ctx.getConfigCanal(v.canal_id);');
 s=s.replace('const r=await ctx.enviarTextoWebjs(ctx.sessoes[String(c.canalId)].client,n,m);','const enviada=await require("./bko-roteamento.js").enviar(ctx.sessoes[String(c.canalId)].client,n,m);\n    const r={success:true,messageId:enviada?.id?._serialized,ack:enviada?.ack};');
 s=s.replace('const r=await ctx.enviarMidiaWebjs(ctx.sessoes[String(c.canalId)].client,n,media,{caption,sendMediaAsDocument:true});','const r=await require("./bko-roteamento.js").enviar(ctx.sessoes[String(c.canalId)].client,n,media,{caption,sendMediaAsDocument:true});');
 return s.replace('versao:4,','versao:4,encaminhamento_operadora:2,');
}
function roteiro(s){
 if(s.includes('// roteiroVendasV3:'))return s;
 const alvo='      // vendaFluidaDadosV1:';if(s.split(alvo).length!==2)throw Error('Roteiro comercial incompatível');
 return s.replace(alvo,`      // roteiroVendasV3: ordem e confirmação são controladas pelo motor, não pela IA.
      if(d.roteiro_vendas_v3===true){
        const decisaoRoteiro=await require("../services/roteiro-runtime.js").processar({fluxo,no,variaveis,entrada:processarInput?mensagemCliente:"",processarInput,fnEnviar,conversar:executarFluxoPorIA,proximoNoId:proximoNo(fluxo,no.id,0)?.id||null});
        if(decisaoRoteiro)return decisaoRoteiro;
      }
`+alvo);
}
module.exports={fluxos,oferta,bridge,index,bko,captura,retentativas,recibos,cepEntrada,encaminhamento,roteiro};
