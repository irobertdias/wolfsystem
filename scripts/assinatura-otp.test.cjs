const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');

process.env.WOLF_SIGNATURE_SECRET ||= 'teste-otp-012345678901234567890123456789';
const backend = process.env.WOLF_BACKEND_DIR || path.resolve(__dirname, '../../wolf-whatsapp');
const otp = require(path.join(backend, 'src/services/assinatura-wolf-envelopes.js'))._test.solicitarOtp;

function contexto(falha) {
  const updates = [];
  const env = { sessao: { id: 'sessao', workspace_id: 'ws', canal_id: 154, status: 'pendente', expira_em: new Date(Date.now() + 600000).toISOString() }, signatario: { id: 'signer', numero: '5561999999999', otp_meio: 'whatsapp', status: 'pendente', otp_envios: 0 } };
  const ctx = { crypto, sessoes: { 154: { tipo: 'webjs', status: 'conectado', client: {} } }, validarCanalDoWorkspace: async () => ({ ok: true }), enviarTextoWebjs: async () => falha ? { success: false, error: 'Canal indisponivel' } : { success: true, messageId: 'msg-1' }, salvarMensagem: async () => {}, supabase: { from: () => ({ update(patch) { updates.push(patch); return { eq() { return this; }, then(resolve) { resolve({ error: null }); } }; } }) } };
  return { ctx, env, updates };
}

test('falha de envio libera tentativa e remove hash do codigo nao entregue', async () => {
  const { ctx, env, updates } = contexto(true);
  await assert.rejects(otp(ctx, env), /Canal indisponivel/);
  assert.equal(updates.length, 2);
  assert.equal(updates[1].otp_hash, null);
  assert.equal(updates[1].otp_enviado_em, null);
  assert.equal(updates[1].otp_envios, 0);
});

test('envio aceito mantem hash, validade e limite para impedir reenvios imediatos', async () => {
  const { ctx, env, updates } = contexto(false);
  await otp(ctx, env);
  assert.equal(updates.length, 1);
  assert.ok(updates[0].otp_hash);
  assert.equal(updates[0].otp_envios, 1);
  env.signatario = { ...env.signatario, ...updates[0] };
  await assert.rejects(otp(ctx, env), /Aguarde um minuto/);
  assert.equal(updates.length, 1);
});

test('front mostra erro junto ao OTP e libera botao apos falha', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/assinar/[token]/page.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  async function solicitarOtp()'), source.indexOf('  useEffect(() =>', source.indexOf('  async function solicitarOtp()'))).replace('e: any', 'e');
  const state = {};
  const context = { token: 'token', AbortSignal, fetch: async () => ({ ok: false, json: async () => ({ success: false, error: 'Canal desconectado' }) }), setErro: value => state.erro = value, setErroOtp: value => state.erroOtp = value, setOtpEnviado: value => state.enviado = value, setEnviandoOtp: value => state.loading = value };
  vm.createContext(context);
  vm.runInContext(fn + '\nthis.run = solicitarOtp;', context);
  await context.run();
  assert.equal(state.erroOtp, 'Canal desconectado');
  assert.equal(state.loading, false);
  assert.equal(state.enviado, false);
  assert.ok(source.indexOf('{erroOtp &&') < source.indexOf('Tire uma selfie de evidência'));
});
