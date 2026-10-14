const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function preparar(entrada, resposta) {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  const enviarMensagem ='), source.indexOf('  const inserirEmoji ='));
  const code = ts.transpileModule(fn + '\nthis.run = enviarMensagem;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const envios = [], avisos = [];
  const context = { mensagem: entrada, atendimentoAtivo: { id: 1, canal_id: 154, numero: '5561999999999', nome: 'Cliente' }, respondendoMsg: null, editandoMsg: null, enviandoMsgRef: { current: false }, meuNome: 'Robert', wsId: 'ws', permissoes: { respostas_rapidas: true }, respostasRapidas: resposta ? [resposta] : [], canais: [{ id: 154, tipo: 'webjs' }], mensagemTextareaRef: { current: null }, setEnviandoMsg() {}, setShowRespostas() {}, setStickyFundo() {}, setTemMensagemNova() {}, setMensagem: value => context.mensagem = value, setRespondendoMsg() {}, refletirAtividadeAtendimento() {}, notify: value => avisos.push(value), traduzirErro: value => value, wa: async (rota, body) => { envios.push({ rota, body }); return { success: true }; }, fetch: async (url, options) => { envios.push({ rota: url, body: JSON.parse(options.body) }); return { json: async () => ({ success: true }) }; } };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, envios, avisos };
}

test('Enter com /oi envia a resposta cadastrada em um unico envio', async () => {
  const { context, envios } = preparar(' /Oi ', { atalho: '/oi', mensagem: 'Olá! Como posso ajudar?' });
  await context.run();
  assert.equal(envios.length, 1);
  assert.equal(envios[0].body.mensagem, '*Robert*\nOlá! Como posso ajudar?');
  assert.equal(context.mensagem, '');
});

test('atalho inexistente nao e enviado literalmente', async () => {
  const { context, envios, avisos } = preparar('/naoexiste', { atalho: '/oi', mensagem: 'Olá' });
  await context.run();
  assert.equal(envios.length, 0); assert.equal(avisos.length, 1);
  assert.equal(context.mensagem, '/naoexiste');
});

test('resposta com midia envia arquivo e legenda sem enviar atalho ou texto duplicado', async () => {
  const { context, envios } = preparar('/video', { atalho: 'video', mensagem: 'Veja o passo a passo', midia_url: 'https://example.com/video.mp4', midia_nome: 'video.mp4' });
  await context.run();
  assert.equal(envios.length, 1);
  assert.match(envios[0].rota, /enviar-midia-url/);
  assert.equal(envios[0].body.legenda, 'Veja o passo a passo');
  assert.equal(context.enviandoMsgRef.current, false);
});

test('mensagem normal continua sendo enviada normalmente', async () => {
  const { context, envios } = preparar('Oi, tudo bem?', { atalho: '/oi', mensagem: 'Olá' });
  await context.run();
  assert.equal(envios[0].body.mensagem, '*Robert*\nOi, tudo bem?');
});
