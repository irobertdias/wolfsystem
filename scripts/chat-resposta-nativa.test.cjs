const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const backend = process.env.WOLF_BACKEND_DIR || path.resolve(__dirname, '../../wolf-whatsapp');
const reply = require(path.join(backend, 'src/services/mensagem-resposta'));

test('mensagem original precisa pertencer ao workspace, canal e numero', async () => {
  const filtros = [];
  const ctx = { supabase: { from: table => { assert.equal(table, 'mensagens'); return { select() { return this; }, eq(key, value) { filtros.push([key, value]); return this; }, in(key, value) { filtros.push([key, value]); return this; }, maybeSingle: async () => ({ data: null, error: null }) }; } } };
  await assert.rejects(reply.buscarMensagemRespondida(ctx, 42, 'ws', 154, '5561999999999'), /nao pertence/);
  assert.deepEqual(filtros, [['id', 42], ['workspace_id', 'ws'], ['canal_id', 154], ['numero', ['5561999999999']]]);
});

test('WebJS recebe quotedMessageId e texto sem citacao artificial', async () => {
  const chamadas = [];
  const client = { sendMessage: async (...args) => { chamadas.push(args); return { id: { _serialized: 'nova' }, hasQuotedMsg: true }; } };
  const ctx = { resolverDestinoWebjs: async () => ({ jid: '5561999999999@c.us' }) };
  const id = 'true_5561999999999@c.us_ORIGINAL';
  await reply.enviarRespostaWebjs(ctx, client, '5561999999999', '*Robert*\nSua resposta', id);
  assert.deepEqual(chamadas, [['5561999999999@c.us', '*Robert*\nSua resposta', { quotedMessageId: id, ignoreQuoteErrors: false }]]);
});

test('recuperacao LID conserva citacao e falha da citacao nao envia texto comum', async () => {
  const chamadas = [];
  const id = 'false_5561999999999@c.us_ORIGINAL';
  const client = { sendMessage: async (...args) => { chamadas.push(args); if (chamadas.length === 1) throw Error('No LID for user'); return { id: { _serialized: 'nova' }, hasQuotedMsg: true }; }, getContactLidAndPhone: async () => [{ lid: '123456789012345@lid' }] };
  const ctx = { resolverDestinoWebjs: async () => ({ jid: '5561999999999@c.us' }) };
  await reply.enviarRespostaWebjs(ctx, client, '5561999999999', 'resposta', id);
  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[1][0], '123456789012345@lid');
  assert.equal(chamadas[1][2].quotedMessageId, id);
  client.sendMessage = async () => { throw Error('Could not get the quoted message.'); };
  await assert.rejects(reply.enviarRespostaWebjs(ctx, client, '5561999999999', 'resposta', id), /quoted message/);
});

test('WABA envia context.message_id, sem acrescentar a citacao no texto', async () => {
  const originalFetch = global.fetch;
  let payload;
  global.fetch = async (url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ messages: [{ id: 'wamid.nova' }] }) }; };
  try {
    await reply.enviarRespostaWaba({ phone_number_id: '123', token: 'teste' }, '5561999999999', 'Resposta', 'wamid.original');
    assert.deepEqual(payload.context, { message_id: 'wamid.original' });
    assert.equal(payload.text.body, 'Resposta');
  } finally { global.fetch = originalFetch; }
});

test('WhatsApp que descarta a citacao nao e informado como sucesso nem retransmitido', async () => {
  let chamadas = 0;
  const client = { sendMessage: async () => { chamadas++; return { id: { _serialized: 'nova' }, hasQuotedMsg: false }; } };
  await assert.rejects(reply.enviarRespostaWebjs({ resolverDestinoWebjs: async () => ({ jid: '5561999999999@c.us' }) }, client, '5561999999999', 'resposta', 'false_5561999999999@c.us_ORIGINAL'), error => error.envioIncerto === true);
  assert.equal(chamadas, 1);
});

test('citacao visual fica apenas no historico interno; frontend envia id da mensagem', () => {
  const historico = reply.textoHistoricoResposta({ de: 'bot', mensagem: 'Mensagem original' }, '*Robert*\nResposta');
  assert.match(historico, /^↪️ \*BOT\*:/);
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  assert.ok(source.includes('mensagem: nomeHeader + mensagem, responderMensagemId: respondendoMsg?.id'));
});

test('aba antiga nao pode mandar citacao artificial como mensagem comum', () => {
  assert.throws(() => reply.validarFormatoResposta('↪️ *Marcia*: "29/09/26"\n\n*Robert*\nResposta', undefined), error => error.statusCode === 409);
  assert.doesNotThrow(() => reply.validarFormatoResposta('*Robert*\nResposta', 42));
  assert.doesNotThrow(() => reply.validarFormatoResposta('Mensagem normal', undefined));
});

test('funcao real do frontend separa texto enviado e citacao visual', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  const enviarMensagem ='), source.indexOf('  const inserirEmoji ='));
  const code = ts.transpileModule(fn + '\nthis.run = enviarMensagem;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let payload;
  const context = { mensagem: 'Resposta', atendimentoAtivo: { id: 1, canal_id: 154, numero: '5561999999999', nome: 'Marcia' }, respondendoMsg: { id: 42, de: 'cliente', mensagem: '29/09/26' }, editandoMsg: null, enviandoMsgRef: { current: false }, meuNome: 'Robert', wsId: 'ws', canais: [{ id: 154, tipo: 'webjs' }], mensagemTextareaRef: { current: null }, setEnviandoMsg() {}, setStickyFundo() {}, setTemMensagemNova() {}, setMensagem() {}, setRespondendoMsg() {}, refletirAtividadeAtendimento() {}, notify: message => { throw Error(message); }, traduzirErro: value => value, wa: async (rota, body) => { assert.equal(rota, 'enviar'); payload = body; return { success: true, respostaNativa: true }; } };
  vm.createContext(context); vm.runInContext(code, context); await context.run();
  assert.equal(payload.mensagem, '*Robert*\nResposta');
  assert.equal(payload.responderMensagemId, 42);
  assert.equal(context.enviandoMsgRef.current, false);
});
