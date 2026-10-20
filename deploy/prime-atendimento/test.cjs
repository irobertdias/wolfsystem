const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const raiz=process.env.WOLF_BACKEND_DIR||(process.platform==='win32'?'D:/GERAL/wolf-whatsapp':'/root/wolf-whatsapp');
const workerPath=path.join(raiz,'src/jobs/fluxo-ia-followups-worker.js');
const patch=require('./patch.cjs');
const exportsTS={lembretesGrupoPrime:()=>({reengajamento_ativo:true,reengajamento_inteligente_ativo:false,reengajamento_finalizar_automatico:false,reengajamento_repetir_ultimo:true,reengajamento_lembretes:[{minutos:20,mensagem:'Continuar?'},{minutos:20,mensagem:'Podemos seguir?'},{minutos:20,mensagem:'Continuar ou encerrar?'}]})};
test('motor repete aos 20/40/60/80/100/120, sem duplicar, e respeita resposta, encerramento e janela oficial', { skip: !fs.existsSync(workerPath) }, async () => {
  let agora = Date.parse('2026-10-20T15:00:00Z');
  const RealDate = Date;
  class Clock extends RealDate { constructor(...args) { super(...(args.length ? args : [agora])); } static now() { return agora; } }
  const state = { id: 1, workspace_id: 'grupoprime', canal_id: 1, fluxo_id: 27, numero: '5500000000000', no_atual: 'prime_vendedor', status: 'ativo', aguardando_input: true,
    created_at: new Clock().toISOString(), updated_at: new Clock().toISOString(), variaveis: { __wolf_followups_v1: { aguardandoRespostaCliente: true, respondeuEm: new Clock().toISOString(), lembretesEnviados: 0 } } };
  let encerrado = false;
  const enviados = [];
  const ctx = {
    supabase: { from(tabela) {
      const q = { payload: null, update(p) { this.payload = p; return this; }, select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
        async maybeSingle() { if (tabela === 'atendimentos') return { data: encerrado ? { status: 'resolvido', updated_at: new Clock().toISOString() } : null }; Object.assign(state, this.payload); return { data: { id: state.id } }; },
        then(ok, no) { if (this.payload) Object.assign(state, this.payload); return Promise.resolve({ error: null }).then(ok, no); } }; return q;
    } },
    sessoes: {}, FOLLOWUPS_IA_STATE_KEY: '__wolf_followups_v1',
    getConfigCanal: async () => ({ workspaceId: 'grupoprime', modo: 'fluxo', fluxoId: 27, tipo: 'waba' }),
    enviarMensagemWaba: async (_config, _numero, mensagem) => { enviados.push({ minuto: (agora - Date.parse(state.created_at)) / 60000, mensagem }); return {}; },
    substituirVariaveis: s => s, verificarBloqueioManualBot: async () => ({ bloqueado: false }), salvarMensagem: async () => {},
  };
  const moduleWorker = { exports: {} };
  vm.runInNewContext(patch.worker(fs.readFileSync(workerPath, 'utf8')), { module: moduleWorker, Date: Clock, console: { log() {}, error() {} }, process, setInterval: () => ({}), setTimeout: () => ({}) });
  moduleWorker.exports(ctx);
  const fluxo = { nos: [{ id: 'prime_vendedor', tipo: 'fluxo_ia', dados: exportsTS.lembretesGrupoPrime() }] };
  for (const minuto of [19, 20, 20, 39, 40, 59, 60, 61, 80, 100, 120]) {
    agora = Date.parse(state.created_at) + minuto * 60000;
    await ctx.processarFollowupFluxoIA(state, fluxo);
  }
  assert.deepEqual(enviados.map(e => e.minuto), [20, 40, 60, 80, 100, 120]);
  assert.equal(state.status, 'ativo');
  agora = Date.parse(state.created_at) + 24*60*60000;
  await ctx.processarFollowupFluxoIA(state, fluxo);
  assert.equal(enviados.length, 6);
  assert.equal(state.variaveis.__wolf_followups_v1.motivoCancelamento, 'janela_api_oficial_expirada_precisa_template');
  state.variaveis.__wolf_followups_v1 = { aguardandoRespostaCliente: false, respondeuEm: new Clock().toISOString(), lembretesEnviados: 0 };
  agora += 21 * 60000;
  await ctx.processarFollowupFluxoIA(state, fluxo);
  assert.equal(enviados.length, 6);
  state.variaveis.__wolf_followups_v1.aguardandoRespostaCliente = true;
  encerrado = true;
  await ctx.processarFollowupFluxoIA(state, fluxo);
  assert.equal(enviados.length, 6);
  assert.equal(state.status, 'finalizado');
});

test('pedido de encerrar cancela sessão e lembretes em todas as etapas; concluir contratação continua',async()=>{
 for(const etapa of ['prime_vendedor','prime_endereco_ia','prime_cadastro_ia','prime_documentos_ia','prime_reversao_ia']){
  const sessao={id:1,fluxo_id:27,no_atual:etapa,variaveis:{__wolf_followups_v1:{aguardandoRespostaCliente:true}}},enviados=[];
  let principal=0;const ctx={executarFluxo:async()=>{principal++;return true;},buscarSessaoFluxo:async()=>sessao,supabase:{from(t){return{payload:null,update(p){this.payload=p;return this;},eq(){return this;},in(){return this;},then(ok,no){if(t==='fluxo_sessoes')Object.assign(sessao,this.payload);return Promise.resolve({error:null}).then(ok,no);}};}}};
  const mod={exports:{}};vm.runInNewContext(patch.entrada(fs.readFileSync(path.join(raiz,'src/services/fluxo-ia-followups.js'),'utf8')),{module:mod,console,process});mod.exports(ctx);
  await ctx.executarFluxo('grupoprime',157,'5562999990000','Quero encerrar',async m=>enviados.push(m));
  assert.equal(sessao.status,'finalizado');assert.equal(sessao.variaveis.__wolf_followups_v1.aguardandoRespostaCliente,false);assert.equal(principal,0);assert.equal(enviados.length,1);
  await ctx.executarFluxo('grupoprime',157,'5562999990000','Quero finalizar a contratação',async()=>{});assert.equal(principal,1);
  await ctx.executarFluxo('outro',157,'5562999990000','encerrar',async()=>{});assert.equal(principal,2);
 }
});
test('instalação é idempotente e não aceita código sem os encaixes esperados',()=>{
 for(const [file,fn]of [['src/jobs/fluxo-ia-followups-worker.js',patch.worker],['src/services/fluxo-ia-followups.js',patch.entrada]]){const s=fn(fs.readFileSync(path.join(raiz,file),'utf8'));assert.equal(fn(s),s);assert.throws(()=>fn('incompatível'));}
});
