const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const backend = process.env.WOLF_BACKEND_DIR || path.resolve(__dirname, '../../wolf-whatsapp');

function banco(horas = 24, erroConfig = false, prazo = new Date(Date.now() + 3600000).toISOString()) {
  const updates = [], inserts = [];
  const resolvido = { id: 77, bloqueado_ate: prazo, atendente_finalizou: 'x@example.com', atendente: 'x@example.com', updated_at: new Date(Date.now() - 3600000).toISOString(), fila: 'Principal' };
  const db = { from(table) {
    let cols = '', op, payload;
    return { select(value) { cols = value; return this; }, update(value) { op = 'update'; payload = value; return this; }, insert(value) { op = 'insert'; payload = value; return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle() { return this; }, single() { return this; }, then(resolve) {
      if (op === 'update') { updates.push({ table, payload }); return resolve({ data: null, error: null }); }
      if (op === 'insert') { inserts.push({ table, payload }); return resolve({ data: null, error: null }); }
      if (table === 'workspaces') return resolve({ data: { bloqueio_pos_finalizacao_horas: horas, owner_email: 'x@example.com' }, error: erroConfig ? { message: 'Falha de consulta' } : null });
      if (table === 'usuarios_workspace') return resolve({ data: { email: 'x@example.com' }, error: null });
      if (table === 'atendimentos' && cols.includes('bloqueado_ate')) return resolve({ data: resolvido, error: null });
      return resolve({ data: null, error: null });
    } };
  } };
  return { db, updates, inserts };
}

test('cliente durante bloqueio permanece finalizado, mensagem e preservada e nao passa pela roleta', async () => {
  for (const horas of [24, null]) {
    const { db, updates, inserts } = banco(horas);
    const ctx = { supabase: db, sessoes: {}, normalizarNumero: value => value, formatarNumero: value => value };
    require(path.join(backend, 'src/services/mensagens'))(ctx);
    const resultado = await ctx.salvarMensagem('ws', 154, 'Principal', '5561999999999', 'Oi', 'cliente', 'Cliente', 'wamid.nova');
    assert.equal(resultado.bloqueado, true);
    assert.equal(updates.length, 0);
    assert.equal(inserts.filter(item => item.table === 'mensagens').length, 1);
    assert.equal(inserts.filter(item => item.table === 'atendimentos').length, 0);
  }
});

test('bloqueio desligado ou vencido retoma o mesmo responsavel sem novo atendimento', async () => {
  for (const [horas, prazo] of [[0, new Date(Date.now() + 3600000).toISOString()], [24, new Date(Date.now() - 1000).toISOString()]]) {
    const { db, updates, inserts } = banco(horas, false, prazo);
    const ctx = { supabase: db, sessoes: {}, normalizarNumero: value => value, formatarNumero: value => value };
    require(path.join(backend, 'src/services/mensagens'))(ctx);
    const result = await ctx.salvarMensagem('ws', 154, 'Principal', '5561999999999', 'Oi', 'cliente', 'Cliente', 'wamid.nova');
    assert.equal(result.reaberto, true);
    assert.equal(updates[0].payload.atendente, 'x@example.com');
    assert.equal(inserts.filter(item => item.table === 'atendimentos').length, 0);
  }
});

test('finalizacao antiga sem prazo usa hora original, e erro de consulta nao libera automacao', async () => {
  for (const falha of [false, true]) {
    const { db, updates } = banco(24, falha, null);
    const ctx = { supabase: db, sessoes: {}, normalizarNumero: value => value, formatarNumero: value => value };
    require(path.join(backend, 'src/services/mensagens'))(ctx);
    const result = await ctx.salvarMensagem('ws', 154, 'Principal', '5561999999999', 'Oi', 'cliente', 'Cliente', 'wamid.nova');
    assert.equal(result.bloqueado, true);
    if (!falha) {
      const restantes = Date.parse(updates[0].payload.bloqueado_ate) - Date.now();
      assert.ok(restantes > 22.9 * 3600000 && restantes < 23.1 * 3600000);
    } else assert.equal(result.erroVerificacao, true);
  }
});

test('backend grava prazo e flags juntos; falha de configuracao nao finaliza', async () => {
  for (const [horas, falha] of [[24, false], [null, false], [0, false], [24, true]]) {
    const { db, updates } = banco(horas, falha);
    const realFrom = db.from;
    db.from = table => {
      const q = realFrom(table);
      if (table === 'atendimentos') {
        const originalThen = q.then;
        let alterando = false;
        const originalUpdate = q.update;
        q.update = function(value) { alterando = true; return originalUpdate.call(this, value); };
        q.then = resolve => alterando ? originalThen(resolve) : resolve({ data: { id: 77 }, error: null });
      }
      return q;
    };
    const rotas = {};
    const ctx = { app: { post: (url, fn) => rotas[url] = fn, get() {} }, supabase: db, sessoes: {}, validarCanalDoWorkspace: async () => ({ ok: true }), finalizarSessaoFluxo: async () => {}, normalizarHorasBloqueioPosFinalizacao: require(path.join(backend, 'src/services/mensagens'))._internals.normalizarHorasBloqueioPosFinalizacao };
    require(path.join(backend, 'src/routes/mensagens'))(ctx);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; } };
    await rotas['/finalizar']({ body: { numero: '5561999999999', canalId: 154, workspaceId: 'ws', quemFinalizou: 'x@example.com' } }, res);
    assert.equal(res.data.success, !falha);
    if (falha) { assert.equal(updates.length, 0); assert.equal(res.statusCode, 503); }
    else { assert.equal(updates[0].payload.status, 'resolvido'); assert.equal(updates[0].payload.bloqueado_ia, true); assert.equal(Boolean(updates[0].payload.bloqueado_ate), horas !== 0); }
  }
});

test('frontend nao altera banco antes da confirmacao e nao mostra sucesso em falha', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  const finalizarChat ='), source.indexOf('  const devolverBot ='));
  const code = ts.transpileModule(fn + '\nthis.run = finalizarChat;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const success of [false, true]) {
    let sucesso = false, atualizou = false;
    const context = { isDono: true, permissoes: {}, wsId: 'ws', user: { email: 'x@example.com' }, atendimentoAtivo: { numero: '5561999999999', canal_id: 154 }, meuNome: 'X', wa: async () => ({ success, error: 'Falha' }), inserirMensagemSistema: async () => { assert.equal(success, true); }, fetchAtendimentos: async () => { atualizou = true; }, setAbaConversa() {}, setAtendimentoAtivo() {}, setHistorico() {}, notify: (msg, tipo) => { if (tipo === 'sucesso') sucesso = true; }, traduzirErro: value => value, console: { error() {} } };
    vm.createContext(context); vm.runInContext(code, context); await context.run('5561999999999', 154);
    assert.equal(sucesso, success); assert.equal(atualizou, success);
  }
});
