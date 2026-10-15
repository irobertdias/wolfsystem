const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const backend = process.env.WOLF_BACKEND_DIR || path.resolve(__dirname, '../../wolf-whatsapp');
const { editarMensagemWhatsapp, validarEdicao } = require(path.join(backend, 'src/services/mensagem-edicao'));
const id = 'true_5561999999999@c.us_ORIGINAL';
const registro = () => ({ id: 42, de: 'humano', mensagem: '*Robert*\nOriginal', provider_message_id: 'webjs:154:' + id, created_at: new Date().toISOString() });

test('edicao chama a funcao nativa com ID normalizado e texto sem marcador artificial', async () => {
  let enviado;
  const client = { getMessageById: async key => { assert.equal(key, id); return { id: { _serialized: id }, fromMe: true, edit: async texto => { enviado = texto; return { body: texto }; } }; } };
  const r = await editarMensagemWhatsapp({}, client, '5561999999999', registro(), '*Robert*\nCorrigida');
  assert.equal(enviado, '*Robert*\nCorrigida');
  assert.equal(r.edicaoNativa, true);
  assert.equal(r.mensagem, '*Robert*\nCorrigida *(editado)*');
});

test('prazo, autoria e recusa do WhatsApp impedem falso sucesso', async () => {
  assert.throws(() => validarEdicao({ ...registro(), de: 'cliente' }, 'Corrigida'), error => error.statusCode === 403);
  assert.throws(() => validarEdicao({ ...registro(), created_at: new Date(Date.now() - 16 * 60000).toISOString() }, 'Corrigida'), /prazo/);
  assert.throws(() => validarEdicao({ ...registro(), provider_message_id: id.replace('true_', 'false_') }, 'Corrigida'), /nao foi enviada/);
  const client = { getMessageById: async () => ({ id: { _serialized: id }, fromMe: true, edit: async () => null }) };
  await assert.rejects(editarMensagemWhatsapp({}, client, '5561999999999', registro(), 'Corrigida'), /nao confirmou/);
});

test('rota so altera banco depois que WhatsApp confirma a edicao', async () => {
  for (const confirmar of [true, false]) {
    const eventos = [], handlers = {};
    const ctx = { app: { get() {}, post: (rota, handler) => handlers[rota] = handler }, validarCanalDoWorkspace: async () => ({ ok: true }), sessoes: { 154: { tipo: 'webjs', status: 'conectado', client: { getMessageById: async () => ({ id: { _serialized: id }, fromMe: true, edit: async texto => { eventos.push('whatsapp'); return confirmar ? { body: texto } : null; } }) } } }, supabase: { from: () => { let update; return { select() { return this; }, eq() { return this; }, in() { return this; }, maybeSingle: async () => ({ data: registro(), error: null }), update(valor) { update = valor; return this; }, then(resolve) { if (update) eventos.push('banco'); resolve({ error: null }); } }; } } };
    require(path.join(backend, 'src/routes/mensagens'))(ctx);
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.data = value; return this; } };
    await handlers['/editar-mensagem']({ body: { workspaceId: 'ws', canalId: 154, numero: '5561999999999', mensagemId: 42, mensagem: '*Robert*\nCorrigida' } }, res);
    assert.equal(res.data.success, confirmar);
    assert.deepEqual(eventos, confirmar ? ['whatsapp', 'banco'] : ['whatsapp']);
    if (confirmar) assert.equal(res.data.edicaoNativa, true);
  }
});

test('frontend envia edicao ao backend e so atualiza a bolha se confirmado', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  const enviarMensagem ='), source.indexOf('  const inserirEmoji ='));
  const code = ts.transpileModule(fn + '\nthis.run = enviarMensagem;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const confirmado of [true, false]) {
    let atualizou = false, request;
    const context = { mensagem: 'Corrigida', atendimentoAtivo: { canal_id: 154, numero: '5561999999999' }, enviandoMsgRef: { current: false }, editandoMsg: { id: 42 }, respondendoMsg: null, meuNome: 'Robert', wsId: 'ws', setEnviandoMsg() {}, notify() {}, traduzirErro: value => value, setHistorico: fn => { const result = fn([{ id: 42, mensagem: 'Original' }]); atualizou = result[0].mensagem === 'Corrigida *(editado)*'; }, setMensagem() {}, setEditandoMsg() {}, supabase: { from() { throw Error('Frontend nao deve editar banco diretamente'); } }, wa: async (rota, payload) => { request = { rota, payload }; return { success: confirmado, edicaoNativa: confirmado, mensagem: 'Corrigida *(editado)*', persisted: true }; } };
    vm.createContext(context); vm.runInContext(code, context); await context.run();
    assert.equal(request.rota, 'editar-mensagem');
    assert.equal(request.payload.mensagem, '*Robert*\nCorrigida');
    assert.equal(atualizou, confirmado);
    assert.equal(context.enviandoMsgRef.current, false);
  }
});
