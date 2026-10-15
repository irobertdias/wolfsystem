const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/lib/conversas-fixadas.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: modulo.exports });
const { chaveConversasFixadas, lerConversasFixadas } = modulo.exports;

test('preferencia fica isolada por usuario e workspace', () => {
  assert.equal(chaveConversasFixadas('ws', 'Robert@teste.com'), chaveConversasFixadas('ws', 'robert@teste.com'));
  assert.notEqual(chaveConversasFixadas('ws', 'a@teste.com'), chaveConversasFixadas('ws', 'b@teste.com'));
  assert.notEqual(chaveConversasFixadas('ws1', 'a@teste.com'), chaveConversasFixadas('ws2', 'a@teste.com'));
  assert.equal(chaveConversasFixadas(null, 'a@teste.com'), null);
  assert.equal(chaveConversasFixadas('ws', null), null);
});

test('recupera fixadas sem duplicatas e ignora dados corrompidos', () => {
  assert.equal(lerConversasFixadas('[1,2,2,"3",null,-1,0,1.5]').join(), '1,2');
  for (const valor of [null, 'invalido', '{}', 'null']) assert.equal(lerConversasFixadas(valor).length, 0);
});
