const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function carregar(arquivo, dependencias = {}) {
  const modulo = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports: modulo.exports, require: nome => dependencias[nome] || require(nome), process: { env: {} } });
  return modulo.exports;
}
const lib = carregar('app/lib/teste-cliente.ts');
const inicio = Date.parse('2026-10-16T15:00:00Z');
const cliente = lib.lerTesteCliente(null);
test('24h, 48h, 3 dias e prazo personalizado vencem pela hora exata', () => {
  for (const horas of [24, 48, 72, 168, 100]) {
    const teste = lib.configurarTesteCliente(cliente, { modo: 'teste', duracao_horas: horas }, inicio);
    assert.equal(Date.parse(teste.termina_em) - inicio, horas * 3600000);
    assert.equal(lib.testeEncerrado(teste, Date.parse(teste.termina_em) - 1), false);
    assert.equal(lib.testeEncerrado(teste, Date.parse(teste.termina_em)), true);
  }
});
test('salvar sem renovar conserva prazo; renovacao e conversao para cliente sao explicitas', () => {
  const teste = lib.configurarTesteCliente(cliente, { modo: 'teste', duracao_horas: 24 }, inicio);
  const manter = lib.configurarTesteCliente(teste, { modo: 'teste', duracao_horas: 24 }, inicio + 7200000);
  assert.equal(manter.termina_em, teste.termina_em);
  const renovar = lib.configurarTesteCliente(teste, { modo: 'teste', duracao_horas: 24, renovar: true }, inicio + 7200000);
  assert.equal(Date.parse(renovar.termina_em), inicio + 26 * 3600000);
  const pago = lib.configurarTesteCliente(teste, { modo: 'cliente' }, inicio);
  assert.equal(pago.termina_em, null);
  assert.equal(lib.testeEncerrado(pago, inicio + 999999999), false);
  assert.equal(lib.lerTesteCliente({}).modo, 'cliente');
});
test('duracao invalida e metadata de teste corrompida nao liberam prazo', () => {
  for (const horas of [0, -1, 0.5, 8761, NaN]) assert.throws(() => lib.configurarTesteCliente(cliente, { modo: 'teste', duracao_horas: horas }, inicio));
  const corrompido = lib.lerTesteCliente({ wolf_teste: { modo: 'teste', termina_em: 'invalido' } });
  assert.equal(lib.testeEncerrado(corrompido), true);
  assert.throws(() => lib.exigirTesteClienteAtivo(corrompido), e => e.statusCode === 403 && e.message.includes('Seu teste encerrou'));
});

function authPara({ dono, expirado, admin = false }) {
  const teste = { modo: 'teste', duracao_horas: 24, iniciado_em: '2020-01-01T00:00:00Z', termina_em: expirado ? '2020-01-02T00:00:00Z' : '2099-01-01T00:00:00Z' };
  const banco = { auth: {
    getUser: async () => ({ data: { user: { id: 'usuario', email: admin ? 'robert.dias@live.com' : 'usuario@teste.com', app_metadata: dono ? { wolf_teste: teste } : {} } } }),
    admin: { getUserById: async id => { assert.equal(id, 'dono'); return { data: { user: { app_metadata: { wolf_teste: teste } } } }; } },
  }, from(tabela) {
    const filtros = {};
    const q = { select() { return q; }, eq(k,v) { filtros[k]=v; return q; }, ilike(k,v) { filtros[k]=v; return q; }, limit() { return q; }, order() { return q; }, maybeSingle() { return q; }, then(resolve) {
      const data = tabela === 'usuarios_workspace' ? { workspace_id: 'ws', perfil: 'Atendente', grupo_id: null }
        : filtros.owner_id ? (dono ? { username: 'ws', ativo: true } : null)
        : { username: 'ws', owner_id: 'dono', ativo: true };
      return Promise.resolve(resolve({ data, error: null }));
    } }; return q;
  } };
  return carregar('app/api/_auth.ts', { '@supabase/supabase-js': { createClient: () => banco }, '../lib/teste-cliente': lib });
}
test('API bloqueia dono e subusuario no teste expirado e permite teste valido', async () => {
  const req = { headers: { get: () => 'Bearer token' }, cookies: { get: () => null } };
  for (const dono of [true, false]) {
    await assert.rejects(authPara({ dono, expirado: true }).autenticarWorkspace(req, 'ws'), e => e.statusCode === 403);
    const acesso = await authPara({ dono, expirado: false }).autenticarWorkspace(req, 'ws');
    assert.equal(acesso.workspaceId, 'ws');
  }
  const admin = await authPara({ dono: true, expirado: true, admin: true }).autenticarWorkspace(req, 'ws');
  assert.equal(admin.isSuperAdmin, true);
});
test('indisponibilidade ao consultar teste do dono nao concede acesso', async () => {
  await assert.rejects(lib.buscarTesteDoDono({ auth: { admin: { getUserById: async () => ({ data: {}, error: { message: 'falha' } }) } } }, 'dono'), e => e.statusCode === 503);
});

test('modo teste nunca mostra cobranca, mesmo com cadastro anteriormente bloqueado', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Popup = carregar('app/components/PopupCobranca.tsx', {
    '../hooks/useLembretePagamento': { useLembretePagamento: () => ({ fase: 'bloqueado', popupVisivel: true, ehAdm: true, valorMensalidade: 999, diasAteVencimento: -30 }) },
    './AcessoTeste': { useAcessoTeste: () => ({ teste: { modo: 'teste' }, carregando: false, erro: null }) },
  }).default;
  assert.equal(renderToStaticMarkup(React.createElement(Popup)), '');
});

test('teste expirado desmonta conteudo privado e mostra mensagem propria sem divida', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Gate = carregar('app/components/AcessoTeste.tsx', {
    react: { ...React, useState: () => [{ teste: { modo: 'teste' }, encerrado: true, carregando: false, erro: null, restante: 0 }, () => {}], useEffect() {}, useRef: () => ({ current: () => {} }) },
    'next/navigation': { usePathname: () => '/chatbot' },
    '../lib/supabase': { supabase: {} },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Gate, null, React.createElement('div', null, 'CONTEUDO PRIVADO')));
  assert.ok(html.includes('Seu teste encerrou'));
  assert.ok(!html.includes('CONTEUDO PRIVADO'));
  assert.ok(!html.includes('Valor pendente'));
});
