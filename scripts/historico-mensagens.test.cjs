const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsModule = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/historico-mensagens.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsModule, AbortController });
const { mesclarHistorico, atualizarRecibo, criarSincronizadorHistorico } = exportsModule;
const mensagem = { id: 1, numero: '123', workspace_id: '7', canal_id: 134, de: 'sistema', mensagem: 'oi', created_at: '2026-10-09T12:00:00Z', status_entrega: 'enviado' };
const diferido = () => { let resolver; const promise = new Promise(r => { resolver = r; }); return { promise, resolver }; };

test('snapshot antigo não desfaz leitura recebida pelo Realtime', () => {
  const lida = atualizarRecibo([mensagem], { id: '1', status_entrega: 'read' });
  assert.equal(mesclarHistorico(lida, [mensagem])[0].status_entrega, 'read');
});
test('INSERT duplicado incorpora o recibo e identificador do provedor', () => {
  const rows = mesclarHistorico([mensagem], [{ ...mensagem, id: '1', provider_message_id: 'wa-1', status_entrega: 'played' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status_entrega, 'played');
  assert.equal(rows[0].provider_message_id, 'wa-1');
});
test('UPDATE parcial altera conteúdo mesmo quando status permanece igual', () => {
  const rows = atualizarRecibo([mensagem], { id: '1', mensagem: 'corrigida', provider_message_id: 'wa-1' });
  assert.equal(rows[0].mensagem, 'corrigida');
  assert.equal(rows[0].status_entrega, 'enviado');
  assert.equal(rows[0].numero, '123');
});
test('snapshot mantém mensagens que chegaram depois que a consulta começou', () => {
  const nova = { ...mensagem, id: 2, created_at: '2026-10-09T12:01:00Z' };
  const rows = mesclarHistorico([mensagem, nova], [mensagem]);
  assert.deepEqual(Array.from(rows, m => m.id), [1, 2]);
});
test('recibo de outro ID não modifica a conversa', () => {
  assert.equal(atualizarRecibo([mensagem], { id: 99, status_entrega: 'read' })[0], mensagem);
});
test('troca de chat descarta resposta atrasada e cancela a consulta antiga', async () => {
  const d = diferido(); const resultados = []; let signal;
  const sync = criarSincronizadorHistorico(async (_, s) => { signal = s; return d.promise; }, rows => resultados.push(rows), assert.fail);
  const consulta = sync.atualizar(); sync.encerrar(); d.resolver([mensagem]); await consulta;
  assert.equal(signal.aborted, true); assert.equal(resultados.length, 0);
});
test('polling e atualização manual compartilham uma única consulta pendente', async () => {
  const d = diferido(); const cargas = []; const resultados = [];
  const sync = criarSincronizadorHistorico(async inicial => { cargas.push(inicial); return d.promise; }, r => resultados.push(r), assert.fail);
  const primeira = sync.atualizar(); const segunda = sync.atualizar();
  assert.equal(primeira, segunda); assert.equal(cargas.length, 1);
  d.resolver([mensagem]); await primeira; await sync.atualizar();
  assert.deepEqual(cargas, [true, false]); assert.equal(resultados.length, 2);
});
test('erro de consulta preserva histórico e tenta carga inicial novamente', async () => {
  let chamadas = 0; const iniciais = []; const erros = []; const resultados = [];
  const sync = criarSincronizadorHistorico(async inicial => {
    iniciais.push(inicial); if (++chamadas === 1) throw Error('rede'); return [mensagem];
  }, rows => resultados.push(rows), e => erros.push(e));
  await sync.atualizar(); assert.equal(resultados.length, 0);
  await sync.atualizar(); assert.deepEqual(iniciais, [true, true]); assert.equal(erros.length, 1);
});

function montarChat(rows) {
  const source = fs.readFileSync('app/chatbot/_sections/ChatSection.tsx', 'utf8');
  const inicio = source.indexOf('  useEffect(() => {\n    setHistorico([]);\n    if (!wsId || !atendimentoAtivo)');
  const fim = source.indexOf('// 🔧 FIX: SINCRONIZA atendimentoAtivo', inicio);
  assert.ok(inicio >= 0 && fim > inicio);
  let historico = []; let cleanup; const callbacks = {}; const consultas = [];
  const channel = { on(_, filtro, cb) { callbacks[filtro.event] = cb; return this; }, subscribe() { return this; } };
  const query = () => {
    const chamada = { filtros: [], ordens: [] }; consultas.push(chamada);
    const q = {
      select() { return q; }, eq(...filtro) { chamada.filtros.push(filtro); return q; },
      order(...ordem) { chamada.ordens.push(ordem); return q; },
      range(a, b) { chamada.range = [a, b]; return q; },
      async abortSignal() { return { data: rows.slice(chamada.range[0], chamada.range[1] + 1), error: null }; },
    }; return q;
  };
  const ref = { current: null };
  vm.runInNewContext(ts.transpileModule(source.slice(inicio, fim), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    ...exportsModule, wsId: '7', atendimentoAtivo: { id: 1, numero: '123', canal_id: 134 },
    useEffect(fn) { cleanup = fn(); }, setHistorico(fn) { historico = typeof fn === 'function' ? fn(historico) : fn; },
    supabase: { from: query, channel: () => channel, removeChannel() {} },
    sincronizadorHistoricoRef: ref, setEtiquetasAtendimento() {}, setStickyFundo() {}, setTemMensagemNova() {},
    fetchEtiquetasAtendimento() {}, refletirAtividadeAtendimento() {}, stickyFundoRef: { current: true },
    setInterval() {}, clearInterval() {}, console,
    window: { addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  });
  return { ref, callbacks, consultas, cleanup: () => cleanup(), historico: () => historico };
}
test('chat carrega mais de 1000 mensagens e sincroniza pela página mais recente', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => ({ ...mensagem, id: 1201 - i }));
  const chat = montarChat(rows); await chat.ref.current.atualizar();
  assert.equal(chat.historico().length, 1201);
  assert.deepEqual(Array.from(chat.consultas, c => Array.from(c.range)), [[0, 499], [500, 999], [1000, 1499]]);
  await chat.ref.current.atualizar();
  assert.deepEqual(Array.from(chat.consultas.at(-1).range), [0, 199]);
  assert.equal(chat.consultas.at(-1).ordens[0][1].ascending, false);
  assert.deepEqual(Array.from(chat.consultas[0].filtros, c => Array.from(c)), [['numero', '123'], ['workspace_id', '7'], ['canal_id', 134]]);
  chat.cleanup();
});
test('chat aceita IDs em string e UPDATE parcial sem aceitar outro workspace/canal', async () => {
  const chat = montarChat([mensagem]); await chat.ref.current.atualizar();
  chat.callbacks.INSERT({ new: { ...mensagem, id: 2, workspace_id: 7, canal_id: '134' } });
  assert.equal(chat.historico().length, 2);
  chat.callbacks.UPDATE({ new: { id: '1', status_entrega: 'read' } });
  assert.equal(chat.historico().find(m => String(m.id) === '1').status_entrega, 'read');
  chat.callbacks.UPDATE({ new: { id: 2, workspace_id: 'outro', status_entrega: 'read' } });
  chat.callbacks.UPDATE({ new: { id: 2, canal_id: 999, status_entrega: 'read' } });
  assert.equal(chat.historico().find(m => m.id === 2).status_entrega, 'enviado');
  await chat.ref.current.atualizar();
  assert.equal(chat.historico().find(m => String(m.id) === '1').status_entrega, 'read');
  chat.cleanup();
  chat.callbacks.UPDATE({ new: { id: 2, status_entrega: 'read' } });
  assert.equal(chat.historico().find(m => m.id === 2).status_entrega, 'enviado');
});
