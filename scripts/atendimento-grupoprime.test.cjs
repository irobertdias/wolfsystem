const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsTS = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/vendedor-grupoprime.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsTS });
const workerPath = 'D:/GERAL/wolf-whatsapp/src/jobs/fluxo-ia-followups-worker.js';
const patch=require('../deploy/prime-atendimento/patch.cjs');

test('escolha de plano não exige endereço, nome ou questionário; endereço fica na etapa seguinte', () => {
  const principal = exportsTS.criarVendedorGrupoPrime('https://example.com', '').nos.find(n => n.id === 'prime_vendedor');
  assert.deepEqual(Array.from(principal.dados.variaveis.filter(v => v.obrigatoria), v => v.nome), ['cep', 'tipo_pessoa', 'plano_interesse']);
  assert.match(principal.dados.prompt, /CEP → consulta → CPF ou CNPJ → planos apenas do público escolhido/);
  assert.match(principal.dados.prompt, /Nunca envie os dois catálogos juntos/);
  assert.match(principal.dados.prompt, /Você quer contratar no CPF ou no CNPJ/);
  const endereco = exportsTS.etapaEnderecoGrupoPrime('teste');
  assert.deepEqual(Array.from(endereco.dados.variaveis, v => v.nome), ['endereco_completo']);
  assert.match(endereco.dados.mensagem_inicial, /endereço completo/);
  const variaveis = {};
  vm.runInNewContext(exportsTS.inicioAcompanhamentoGrupoPrime().dados.codigo.replace('return true;', ''), { setVariable: (k, v) => { variaveis[k] = v; } });
  assert.equal(JSON.parse(variaveis.__wolf_followups_v1).aguardandoRespostaCliente, true);
  assert.equal(JSON.parse(variaveis.__wolf_followups_v1).lembretesEnviados, 0);
});

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
