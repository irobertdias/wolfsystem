const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/lib/notificacoes-atendimento.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} }; vm.createContext(sandbox); vm.runInContext(code, sandbox);
const { deveNotificarAtendimento } = sandbox.exports;
const contexto = { workspaceId: 'ws', email: 'x@example.com', podeAcessarChat: true, todosCanais: true, carregandoCanais: false, canaisPermitidos: null };
const meu = { id: 1, workspace_id: 'ws', atendente: 'X@EXAMPLE.COM', canal_id: 154, status: 'aberto' };
const outro = { ...meu, id: 2, atendente: 'y@example.com' };

test('acesso a todos os chats nao libera som dos chats de outra pessoa', () => {
  assert.equal(deveNotificarAtendimento(meu, contexto), true);
  assert.equal(deveNotificarAtendimento(outro, contexto), false);
  for (const atendente of ['BOT', 'Humano', '', null]) assert.equal(deveNotificarAtendimento({ ...meu, atendente }, contexto), false);
});

test('respeita workspace, canal, atendimento encerrado e permissoes', () => {
  assert.equal(deveNotificarAtendimento({ ...meu, workspace_id: 'outro' }, contexto), false);
  assert.equal(deveNotificarAtendimento({ ...meu, status: 'resolvido' }, contexto), false);
  assert.equal(deveNotificarAtendimento(meu, { ...contexto, canaisExcluidos: new Set([154]) }), false);
  assert.equal(deveNotificarAtendimento(meu, { ...contexto, todosCanais: false, canaisPermitidos: new Set([155]) }), false);
  assert.equal(deveNotificarAtendimento(meu, { ...contexto, todosCanais: false, carregandoCanais: true, canaisPermitidos: new Set([154]) }), false);
  assert.equal(deveNotificarAtendimento(meu, { ...contexto, podeAcessarChat: false }), false);
  assert.equal(deveNotificarAtendimento(meu, { ...contexto, todosCanais: false, canaisPermitidos: new Set([154]) }), true);
});

function calcular(novoMap, inicializada = true, ativo = null) {
  let sons = 0, badges;
  const inicio = source.indexOf('        const ultimas = ultimaQtdNaoLidasRef.current;');
  const fim = source.indexOf('        setNaoLidasPorAtendimento(novoMap);', inicio) + '        setNaoLidasPorAtendimento(novoMap);'.length;
  const context = { novoMap, ativos: [meu, outro], atendimentoAtivo: ativo, ultimaQtdNaoLidasRef: { current: { 1: 0, 2: 0 } }, contagemNotificacoesInicializadaRef: { current: inicializada }, contextoNotificacaoRef: { current: contexto }, canaisExclusivosValidacaoRef: { current: new Set() }, deveNotificarAtendimento, tocarSomMsgExistente: () => sons++, setNaoLidasPorAtendimento: value => badges = value };
  vm.createContext(context); vm.runInContext(source.slice(inicio, fim), context);
  return { sons, badges };
}

test('fluxo real de mensagens novas toca so para o atendimento proprio', () => {
  assert.equal(calcular({ 2: 1 }).sons, 0);
  assert.equal(calcular({ 1: 1, 2: 1 }).sons, 1);
  assert.equal(calcular({ 1: 1 }, false).sons, 0);
  assert.equal(calcular({ 1: 1 }, true, { id: 1 }).sons, 0);
  assert.deepEqual(calcular({ 2: 1 }).badges, { 2: 1 });
});

test('conversas novas usam a mesma regra e toggle de som usa valor atual', () => {
  const inicio = source.indexOf('        const novosVisiveis = novos.filter(');
  const fim = source.indexOf('        // Adiciona os novos', inicio);
  let sons = 0;
  const context = { novos: [outro], contextoNotificacaoRef: { current: contexto }, canaisExclusivosValidacaoRef: { current: new Set() }, deveNotificarAtendimento, tocarSomChatNovo: () => sons++ };
  vm.createContext(context); vm.runInContext(source.slice(inicio, fim), context);
  assert.equal(sons, 0);
  const segundo = { ...context, novos: [meu] }; vm.createContext(segundo); vm.runInContext(source.slice(inicio, fim), segundo);
  assert.equal(sons, 1);
  assert.equal((source.match(/if \(!somAtivoRef\.current\) return;/g) || []).length, 2);
});
