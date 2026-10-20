const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {bridge,visao}=require('./patch.cjs');
const raiz=process.env.WOLF_BACKEND_DIR||(process.platform==='win32'?'D:/GERAL/wolf-whatsapp':'/root/wolf-whatsapp');
const original=fs.readFileSync(path.join(raiz,'src/services/fluxo-ia-multimidia-bridge.js'),'utf8'),codigo=bridge(original);
const c={module:{exports:{}}};vm.createContext(c);vm.runInContext(codigo,c);
const regras=[{id:'prime_rg_frente',nome:'RG frente',variavel:'rg_frente',descricao:'Não aceitar verso como frente',obrigatoria:true},{id:'prime_rg_verso',nome:'RG verso',variavel:'rg_verso',descricao:'Não aceitar frente como verso',obrigatoria:true},{id:'prime_comprovante',nome:'Comprovante',variavel:'comprovante_endereco',obrigatoria:true}];
test('leitor de documentos recebe apenas extração visual, sem campos de coleta nem instrução de face pendente',()=>{
 const a=codigo.indexOf('      // primeLeituraIsolada:'),b=codigo.indexOf('      const analise = await ctx.analisarMidiaFluxoIA(dadosLeitura',a);
 const cfg=vm.runInNewContext('(function(){'+codigo.slice(a,b)+';return dadosLeitura;})()', {workspaceId:'grupoprime',sessaoAntes:{no_atual:'prime_reversao_documentos_ia'},configuracao:{dados:{apiKey:'teste',prompt:'PEÇA A FRENTE AGORA',variaveis:[{nome:'rg_frente_validado'}],arquivos_salvar_regras:regras}},regrasConfiguradas:()=>regras});
 assert.ok(!cfg.prompt.includes('PEÇA A FRENTE'));assert.ok(cfg.prompt.includes('Impressão digital não é retrato'));
 assert.deepEqual(Array.from(cfg.variaveis,x=>x.nome),['nome','endereco_comprovante','cep_comprovante']);assert.equal(cfg.apiKey,'teste');
 assert.ok(cfg.arquivos_salvar_regras[1].descricao.includes('SEM retrato'));
});
test('verso não é confundido com frente por causa da descrição negativa',()=>{
 const validar=c.module.exports._test.validarIdentidadeArquivo;
 assert.equal(validar(regras[1],{ladoDocumento:'verso',dadosExtraidos:{}},{}).identidade.lado,'verso');
 assert.equal(validar(regras[0],{ladoDocumento:'frente',dadosExtraidos:{nome:'Ana Silva'}},{nome:'Ana Silva'}).identidade.nome,'Ana Silva');
 assert.throws(()=>validar(regras[0],{ladoDocumento:'frente',dadosExtraidos:{nome:'Outra Pessoa'}},{nome:'Ana Silva'}),e=>e.codigo==='IDENTIDADE_INCOMPATIVEL');
 assert.throws(()=>validar(regras[1],{ladoDocumento:'frente',dadosExtraidos:{}},{}),e=>e.codigo==='LADO_DOCUMENTO_INCORRETO');
});
test('impressão digital sem retrato prevalece sobre rótulo frente incoerente',()=>{
 const v=visao(fs.readFileSync(path.join(raiz,'src/services/fluxo-ia-multimidia.js'),'utf8'));
 const a=v.indexOf('      // primeFacePorRetrato:'),b=v.indexOf('      const descricaoVisual',a);
 const x={dados:{prime_leitura_documental:true},respostaJson:{identidade_visual:true,possui_retrato:false,lado_documento:'frente'},limitarTexto:x=>x,regraArquivoId:'prime_rg_frente'};
 const r=vm.runInNewContext('(function(){'+v.slice(a,b)+';return {ladoDocumento,regraArquivoId};})()',x);
 assert.equal(r.ladoDocumento,'verso');assert.equal(r.regraArquivoId,'prime_rg_verso');
 const fn=v.slice(v.indexOf('function criarInstrucaoLeitura('),v.indexOf('\nmodule.exports'));
 assert.ok(v.includes('primePromptVisualExclusivo'));
 const anterior=bridge(original).replace(' prime_leitura_documental: true,','');assert.equal(bridge(anterior),codigo);
});
test('face visual corrige ID incorreto sem deduzir a face pela ordem de chegada',()=>{
 const trecho=codigo.slice(codigo.indexOf('    let regra = localizarRegra('),codigo.indexOf('    const nomeRecebido ='));
 c.workspaceId='grupoprime';c.configuracao={arquivos_salvar_regras:regras};
 for(const [id,lado,esperado]of [['prime_rg_frente','verso','rg_verso'],['prime_rg_verso','frente','rg_frente']]){c.analise={regraArquivoId:id,ladoDocumento:lado};const r=vm.runInContext('(function(){'+trecho+';return regra;})()',c);assert.equal(r.variavel,esperado);}
 c.analise={regraArquivoId:'prime_rg_frente',ladoDocumento:'desconhecido'};assert.throws(()=>vm.runInContext('(function(){'+trecho+';return regra;})()',c),e=>e.codigo==='LADO_DOCUMENTO_INCORRETO');
});
test('frente e verso salvos pedem comprovante; flags sem arquivo não contam',async()=>{
 const a=codigo.indexOf('        if (captura && workspaceId'),b=codigo.indexOf('        if (captura) {',a),trecho=codigo.slice(a,b);
 for(const completos of [true,false]){
  const mensagens=[],vars={rg_frente_validado:'SIM',rg_verso_validado:'SIM',rg_frente:completos?JSON.stringify([{url:'privado'}]):'[]',rg_verso:JSON.stringify([{url:'privado'}])};
  const x={...c,ctx:{buscarSessaoFluxo:async()=>({variaveis:vars})},workspaceId:'grupoprime',canalId:157,numero:'teste',sessaoAntes:{no_atual:'prime_documentos_ia'},captura:{regra:regras[1]},configuracao:{dados:{arquivos_salvar_regras:regras}},fnEnviar:async s=>mensagens.push(s)};
  await vm.runInNewContext('(async function(){'+trecho+'})()',x);
  assert.ok(mensagens[0].includes(completos?'comprovante':'frente'));assert.ok(!mensagens[0].includes('Agora envie uma foto legível do verso'));
 }
});
test('patch é idempotente e visão específica só é aplicada às regras Prime',()=>{
 assert.equal(bridge(codigo),codigo);assert.throws(()=>bridge('incompatível'));
 const leitura=fs.readFileSync(path.join(raiz,'src/services/fluxo-ia-multimidia.js'),'utf8');const alterado=visao(leitura);assert.equal(visao(alterado),alterado);assert.ok(alterado.includes('regrasArquivo.some(r => /^prime_rg_/'));
});
test('boleto com endereço é comprovante e não altera os dados do titular',()=>{
 const texto=visao(fs.readFileSync(path.join(raiz,'src/services/fluxo-ia-multimidia.js'),'utf8'));
 const a=texto.indexOf('      // primeComprovanteAmplo:'),b=texto.indexOf('      corrigirBancosDoContracheque(',a),trecho=texto.slice(a,b);
 for(const legivel of [true,false]){
  const x={dados:{},listarRegrasArquivo:()=>[{id:'prime_comprovante'}],dadosExtraidosLidos:legivel?{nome:'Nome da fatura',endereco_comprovante:'Rua Teste, 10, Centro',cep_comprovante:'74480150'}:{},dadosExtraidos:{nome:'Nome da fatura'},regraArquivoId:legivel?'':'prime_comprovante',comprovanteSeguroNoPrint:false,referenciaComercialExternaLida:true};
  const r=vm.runInNewContext('(function(){'+trecho+';return {id:regraArquivoId,dados:dadosExtraidos,externo:referenciaComercialExterna};})()',x);
  assert.equal(r.id,legivel?'prime_comprovante':'');
  if(legivel){assert.equal(r.externo,false);assert.equal(r.dados.nome,undefined);assert.equal(r.dados.cep_comprovante,'74480150');}
 }
});
test('confirmação por texto não finge recebimento nem envio ao BKO sem arquivos',async()=>{
 const a=codigo.indexOf('    // primeTextoNaoValidaUpload:'),b=codigo.indexOf('    if ((!entradaEhMidia',a),trecho=codigo.slice(a,b);
 for(const mensagem of ['Sim','Já enviei tudo, pode finalizar','Esse é o comprovante']){
  const saidas=[],x={...c,workspaceId:'grupoprime',canalId:157,numero:'teste',mensagemCliente:mensagem,entradaEhMidia:false,fluxoIdPreferido:27,ctx:{buscarSessaoFluxo:async()=>({no_atual:'prime_documentos_ia',variaveis:{}}),configuracaoExtensoesFluxoIA:async()=>({dados:{arquivos_salvar_regras:regras}})},fnEnviar:async m=>saidas.push(m)};
  assert.equal(await vm.runInNewContext('(async function(){'+trecho+';return false;})()',x),true);
  assert.equal(saidas.length,1);assert.ok(saidas[0].includes('Ainda não consta'));assert.ok(!saidas[0].includes('BKO'));
 }
});
test('CEP divergente passa por nova leitura do arquivo, sem copiar o CEP esperado',async()=>{
 const a=codigo.indexOf('      // primeCepDuplaLeitura:'),b=codigo.indexOf('      if (analise.regraArquivoId && !pedidoReanalise)',a),trecho=codigo.slice(a,b);
 for(const revisado of ['74480150','75383126']){
  let chamadas=0;const x={workspaceId:'grupoprime',canalId:158,numero:'teste',fluxoIdPreferido:27,sessaoAntes:{variaveis:{cep:'74480150'}},analise:{regraArquivoId:'prime_comprovante',dadosExtraidos:{cep_comprovante:'74840510'},entrada:'leitura anterior'},configuracao:{dados:{prompt:'Coleta'},fluxo:{id:27}},entradaParaAnalise:'imagem original',ctx:{analisarMidiaFluxoIA:async()=>{chamadas++;return{dadosExtraidos:{cep_comprovante:revisado},entrada:'nova leitura'};}}};
  await vm.runInNewContext('(async function(){'+trecho+'})()',x);assert.equal(chamadas,1);assert.equal(x.analise.dadosExtraidos.cep_comprovante,revisado);
 }
});
