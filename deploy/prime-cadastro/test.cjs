const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {corrigir}=require('./patch.cjs');
const raiz=process.env.WOLF_BACKEND_DIR||(process.platform==='win32'?'D:/GERAL/wolf-whatsapp':'/root/wolf-whatsapp');
const codigo=corrigir(fs.readFileSync(path.join(raiz,'src/routes/fluxos.js'),'utf8'));
const contexto={};vm.createContext(contexto);
vm.runInContext(codigo.slice(codigo.indexOf('function validarValorFluxoIA('),codigo.indexOf('async function executarFluxoPorIA(')),contexto);
test('PF/PJ não é inferido como CPF, mesmo se o rótulo mencionar CPF',()=>{
 assert.equal(contexto.inferirTipoCampoFluxoIA({nome:'tipo_pessoa',tipo:'publico',label:'CPF ou CNPJ'}),'publico');
 for(const v of ['PF','CPF','pessoa física']){assert.equal(contexto.normalizarValorFluxoIA('publico',v),'PF');assert.equal(contexto.validarValorFluxoIA('publico',v),true);}
 for(const v of ['PJ','CNPJ','pessoa jurídica'])assert.equal(contexto.normalizarValorFluxoIA('publico',v),'PJ');
 for(const v of ['52998224725','12345678000195','sim','Rua Teste, 10'])assert.equal(contexto.validarValorFluxoIA('publico',v),false);
});
test('está sim confirma; ressalva ou correção na mesma mensagem não confirma',()=>{
 assert.equal(contexto.clienteConfirmouResumoFluxoIA('Está sim.'),true);
 for(const v of ['Está sim, mas o endereço está errado','Não está certo','Sim, quero corrigir o e-mail'])assert.equal(contexto.clienteConfirmouResumoFluxoIA(v),false);
});
test('plano/endereço seguem sem resumo técnico; cadastro mantém confirmação obrigatória',()=>{
 const inicio=codigo.indexOf('      // primeEtapas:'),fim=codigo.indexOf('      if (estado.aguardando_confirmacao && resultado.clienteConfirmou)',inicio);
 const trecho=codigo.slice(inicio,fim);
 for(const id of ['prime_vendedor','prime_endereco_ia','prime_cadastro_ia']){
  const vars={},c={ctx:{workspaceId:'grupoprime'},fluxo:{id:27},no:{id},variaveis:vars,estado:{valores_coletados:{cep:'74480150'}},resultado:{consolidados:{tipo_pessoa:'PF',endereco_completo:'Rua Teste, 10'}},estadoKey:'teste',proximoNo:()=>({id:'seguinte'})};
  const result=vm.runInNewContext('(function(){'+trecho+';return null;})()',c);
  assert.equal(result?.proximoNoId||null,id==='prime_cadastro_ia'?null:'seguinte');
 }
 assert.ok(codigo.indexOf('if (resultado.faltantes?.length)')<inicio);
});
test('instalador é idempotente e recusa arquivo incompatível',()=>{assert.equal(corrigir(codigo),codigo);assert.throws(()=>corrigir('inválido'));});
