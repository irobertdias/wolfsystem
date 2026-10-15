const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/lib/ultima-mensagem-atendimentos.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: modulo.exports });
const { criarIndiceUltimasMensagens } = modulo.exports;

function banco(mensagens) {
  const consultas = [];
  return { consultas, from(table) {
    assert.equal(table, 'mensagens');
    let filtros = [], ordens = [], inicio = 0, fim = 999;
    const q = { select() { return q; },
      eq(k, v) { filtros.push(m => m[k] === v); return q; },
      neq(k, v) { filtros.push(m => m[k] !== v); return q; },
      is(k, v) { filtros.push(m => (m[k] ?? null) === v); return q; },
      in(k, valores) { filtros.push(m => valores.includes(m[k])); return q; },
      gte(k, v) { filtros.push(m => m[k] >= v); return q; },
      order(k, op) { ordens.push([k, op.ascending ? 1 : -1]); return q; },
      limit(n) { fim = n - 1; return q; }, range(a, b) { inicio = a; fim = b; return q; },
      then(resolve) {
        consultas.push(true);
        const dados = mensagens.filter(m => filtros.every(fn => fn(m))).sort((a, b) => {
          for (const [k, dir] of ordens) {
            const delta = typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]));
            if (delta) return delta * dir;
          }
          return 0;
        });
        return Promise.resolve(resolve({ data: dados.slice(inicio, fim + 1), error: null }));
      },
    }; return q;
  } };
}
const msg = (id, numero, canal_id, created_at, de = 'cliente', workspace_id = 'ws') => ({ id, numero, canal_id, created_at, de, workspace_id, mensagem: `mensagem ${id}` });
const conversa = (id, numero, canal_id) => ({ id, numero, canal_id, created_at: '2026-01-01T00:00:00Z', updated_at: '2030-01-01T00:00:00Z' });

test('ultima mensagem enviada ou recebida define horario e resumo; sistema e outro workspace/canal nao interferem', async () => {
  const mensagens = [msg(1, '111', 1, '2026-10-15T12:00:00Z'), msg(2, '111', 1, '2026-10-15T13:00:00Z', 'humano'),
    msg(3, '222', 1, '2026-10-15T14:00:00Z', 'bot'), msg(4, '111', 1, '2026-10-15T15:00:00Z', 'sistema'),
    msg(5, '111', 2, '2026-10-15T16:00:00Z'), msg(6, '111', 1, '2026-10-15T17:00:00Z', 'cliente', 'outro')];
  const db = banco(mensagens);
  const indice = criarIndiceUltimasMensagens(db, 'ws');
  const lista = [conversa(1, '111', 1), conversa(2, '222', 1), conversa(3, '333', 1)];
  const primeira = await indice.carregar(lista);
  assert.equal(primeira[0].ultima_mensagem_em, '2026-10-15T13:00:00Z');
  assert.equal(primeira[0].mensagem, 'mensagem 2');
  assert.equal(primeira[1].ultima_mensagem_em, '2026-10-15T14:00:00Z');
  assert.equal(primeira[2].ultima_mensagem_em, null);
  mensagens.push(msg(7, '111', 1, '2026-10-15T18:00:00Z'));
  const segunda = await indice.carregar(lista);
  assert.equal(segunda[0].ultima_mensagem_em, '2026-10-15T18:00:00Z');
  indice.registrar(msg(8, '111', 1, '2026-10-15T19:00:00Z', 'humano'));
  indice.registrar(msg(9, '111', 1, '2026-10-15T12:00:00Z'));
  const terceira = await indice.carregar(lista);
  assert.equal(terceira[0].ultima_mensagem_em, '2026-10-15T19:00:00Z');
});

test('conversa com mais de 1000 mensagens nao esconde a ultima mensagem das outras', async () => {
  const mensagens = Array.from({ length: 1001 }, (_, i) => msg(i + 1, '111', 1, '2026-10-15T12:00:00Z'));
  mensagens.push(msg(1002, '222', 1, '2026-10-14T12:00:00Z'));
  const indice = criarIndiceUltimasMensagens(banco(mensagens), 'ws');
  const lista = await indice.carregar([conversa(1, '111', 1), conversa(2, '222', 1)]);
  assert.equal(lista[1].ultima_mensagem_em, '2026-10-14T12:00:00Z');
  assert.equal(lista[0].mensagem, 'mensagem 1001');
});
