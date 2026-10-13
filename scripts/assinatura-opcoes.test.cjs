const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const backend = process.env.WOLF_BACKEND_DIR || path.resolve(__dirname, '../../wolf-whatsapp');
const opcoes = require(path.join(backend, 'src/services/assinatura-wolf-opcoes'));
const base = require(path.join(backend, 'src/services/assinatura-wolf'))._envelopes;
const service = require(path.join(backend, 'src/services/assinatura-wolf-envelopes'))._test;
const { PDFDocument } = require(path.join(backend, 'node_modules/pdf-lib'));
process.env.WOLF_SIGNATURE_SECRET ||= 'teste-opcoes-012345678901234567890123456789';
const imagem = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const desafios = ['rosto_enquadrado', 'sorriso_solicitado', 'movimento_esquerda_solicitado', 'selfie_capturada'].map(etapa => ({ etapa, em: new Date().toISOString() }));

test('contratos antigos mantem OTP/selfie e documento conforme sessao', () => {
  assert.deepEqual(opcoes.opcoesSignatario({}, { exigir_documento_identidade: true }), { exigir_otp: true, facial: 'foto', exigir_documento_identidade: true });
  assert.throws(() => opcoes.normalizarOpcoes({ exigir_otp: 'false' }), /invalida/);
  assert.throws(() => opcoes.normalizarOpcoes({ facial: 'biometria_verificada' }), /invalido/);
});

test('etapas obrigatorias sao validadas e etapas desligadas ignoram dados enviados', () => {
  const body = { aceite_contrato: true, aceite_assinatura_eletronica: true, aceite_selfie: true, assinatura: imagem };
  const simples = opcoes.normalizarOpcoes({ exigir_otp: false, facial: 'nenhuma' });
  assert.equal(opcoes.validarColeta(base, simples, { ...body, selfie: 'invalida' }).selfie, null);
  assert.throws(() => opcoes.validarColeta(base, opcoes.normalizarOpcoes(), body), /Imagem/);
  assert.throws(() => opcoes.validarColeta(base, { ...simples, exigir_documento_identidade: true }, body), /Imagem/);
  assert.throws(() => opcoes.validarColeta(base, { ...simples, facial: 'guiada' }, { ...body, selfie: imagem }), /guiada/);
  assert.ok(opcoes.validarColeta(base, { ...simples, facial: 'guiada' }, { ...body, selfie: imagem, selfie_desafios: desafios }).selfie);
});

async function preparar(opcao) {
  const original = await PDFDocument.create(); original.addPage();
  const arquivos = new Map();
  const sessao = { id: 'sessao-1', workspace_id: 'ws', status: 'pendente', expira_em: new Date(Date.now() + 600000).toISOString(), contrato_arquivo_original: 'original.pdf', contrato_nome: 'contrato.pdf', contrato_hash_original: 'hash-original' };
  const signer = { id: 'signer-1', sessao_id: sessao.id, papel: 'cliente', nome: 'Pessoa Teste', ordem: 1, status: 'pendente', empresa_snapshot: { assinatura_opcoes: opcao }, otp_hash: base.hmac(crypto, process.env.WOLF_SIGNATURE_SECRET, 'signer-1:123456'), otp_expira_em: new Date(Date.now() + 600000).toISOString() };
  const ctx = { crypto, path, ROOT_DIR: path.resolve('teste-virtual'), fs: { existsSync: p => !path.extname(p) || arquivos.has(p), mkdirSync() {}, readFileSync: p => arquivos.get(p), writeFileSync: (p, bytes) => arquivos.set(p, bytes) }, supabase: { from(table) { let patch; const query = { update(value) { patch = value; return this; }, eq() { return this; }, select() { return this; }, order() { return this; }, maybeSingle: async () => { Object.assign(signer, patch); return { data: { id: signer.id }, error: null }; }, then(resolve) { if (patch) Object.assign(table === 'assinatura_wolf_signatarios' ? signer : sessao, patch); resolve({ data: table === 'assinatura_wolf_signatarios' ? [signer] : sessao, error: null }); } }; return query; } } };
  arquivos.set(base.caminhoSeguro(ctx, sessao.id, 'original.pdf'), Buffer.from(await original.save()));
  const envelope = { sessao, signatario: signer, signatarios: [signer] };
  const body = { aceite_contrato: true, aceite_assinatura_eletronica: true, aceite_selfie: true, assinatura: imagem, otp: opcao.exigir_otp ? '123456' : undefined, selfie: opcao.facial !== 'nenhuma' ? imagem : undefined, selfie_desafios: desafios, documento_frente: opcao.exigir_documento_identidade ? imagem : undefined, documento_verso: opcao.exigir_documento_identidade ? imagem : undefined };
  return { ctx, envelope, body, arquivos, signer, sessao };
}

test('conclusao real e PDF auditado para as 12 combinacoes por participante', async t => {
  const enviarEmail = base.tentarEnviarEmailAssinatura;
  base.tentarEnviarEmailAssinatura = async () => ({ enviado: true });
  try {
    for (const facial of ['nenhuma', 'foto', 'guiada']) for (const exigir_otp of [false, true]) for (const exigir_documento_identidade of [false, true]) {
      await t.test(`${facial}, OTP=${exigir_otp}, documento=${exigir_documento_identidade}`, async () => {
        const policy = { facial, exigir_otp, exigir_documento_identidade };
        const { ctx, envelope, body, arquivos, signer, sessao } = await preparar(policy);
        const resultado = await service.concluir(ctx, envelope, { body, headers: {}, ip: '127.0.0.1' });
        assert.equal(resultado.status, 'concluida');
        assert.equal(signer.auditoria.otp_confirmado, exigir_otp);
        assert.equal(signer.auditoria.selfie_capturada, facial !== 'nenhuma');
        assert.deepEqual(signer.auditoria.assinatura_opcoes, policy);
        assert.equal(Boolean(signer.selfie_arquivo), facial !== 'nenhuma');
        assert.equal(Boolean(signer.documento_frente_hash), exigir_documento_identidade);
        assert.equal(Boolean(sessao.otp_confirmado_em), exigir_otp);
        assert.equal(signer.auditoria_hmac, base.hmac(crypto, process.env.WOLF_SIGNATURE_SECRET, JSON.stringify(signer.auditoria)));
        const pdf = await PDFDocument.load(arquivos.get(base.caminhoSeguro(ctx, sessao.id, 'contrato-assinado.pdf')));
        assert.equal(pdf.getPageCount(), 4);
        await new Promise(resolve => setImmediate(resolve));
      });
    }
  } finally { base.tentarEnviarEmailAssinatura = enviarEmail; }
});

test('navegador nao pode dispensar OTP obrigatorio nem enviar OTP quando dispensado', async () => {
  const dados = await preparar({ exigir_otp: true, facial: 'nenhuma', exigir_documento_identidade: false });
  await assert.rejects(service.concluir(dados.ctx, dados.envelope, { headers: {}, body: { ...dados.body, otp: '', exigir_otp: false, assinatura_opcoes: { exigir_otp: false } } }), /Código inválido/);
  dados.envelope.signatario.empresa_snapshot.assinatura_opcoes.exigir_otp = false;
  await assert.rejects(service.solicitarOtp(dados.ctx, dados.envelope), /nao precisa/);
});

test('front sem token e sem foto conclui sem exigir esses campos', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/assinar/[token]/page.tsx'), 'utf8');
  const fn = source.slice(source.indexOf('  async function concluir()'), source.indexOf('  if (carregando)', source.indexOf('  async function concluir()'))).replace('e: any', 'e');
  let payload;
  const context = { exigirOtp: false, exigirSelfie: false, capturaGuiada: false, otp: '', selfie: '', info: { exigir_localizacao: false }, aceiteContrato: true, aceiteAssinatura: true, aceiteSelfie: true, assinou: true, canvasAssinaturaRef: { current: { toDataURL: () => imagem } }, assinaturaCapturadaRef: { current: imagem }, desafiosSelfie: [], documentoFrente: '', documentoVerso: '', token: 'token', CONSENTIMENTO: '', setErro: error => { if (error) throw Error(error); }, setEnviando() {}, setInfo() {}, setConcluida() {}, window: { scrollTo() {} }, fetch: async (url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ success: true, status: 'concluida' }) }; } };
  vm.createContext(context); vm.runInContext(fn + '\nthis.run = concluir;', context); await context.run();
  assert.equal(payload.selfie, undefined);
  assert.equal(payload.assinatura, imagem);
  assert.ok(source.includes('{exigirOtp && <section'));
  assert.ok(source.includes('{exigirSelfie && <section'));
});

test('criacao salva opcoes diferentes no snapshot de representante, cliente e testemunha', async () => {
  const liberar = base.moduloContratosLiberado;
  const enviarEmail = base.tentarEnviarEmailAssinatura;
  base.moduloContratosLiberado = async () => true;
  base.tentarEnviarEmailAssinatura = async () => ({ enviado: true });
  process.env.WOLF_SIGNATURE_PUBLIC_URL = 'https://assinatura.example.com';
  try {
    const snapshot = [];
    const configs = [ { exigir_otp: true, facial: 'guiada', exigir_documento_identidade: true }, { exigir_otp: false, facial: 'foto', exigir_documento_identidade: false }, { exigir_otp: false, facial: 'nenhuma', exigir_documento_identidade: true } ];
    const pdf = await PDFDocument.create(); pdf.addPage();
    const ctx = { crypto, path, ROOT_DIR: path.resolve('teste-virtual'), fs: { existsSync: () => true, writeFileSync() {} }, supabase: { from(table) {
      let insert;
      return { eq() { return this; }, select() { return this; }, insert(value) { insert = value; return this; }, maybeSingle: async () => ({ data: table === 'assinatura_wolf_empresas' ? { id: 'empresa', razao_social: 'Empresa Teste', cnpj: '12345678000100' } : { id: 'rep', empresa_id: 'empresa', nome: 'Representante Teste', cpf: '12345678900', email: 'rep@example.com', numero: '62981234567' }, error: null }), single: async () => ({ data: { ...insert, id: 'sessao' }, error: null }), then(resolve) { snapshot.push(...insert); resolve({ data: insert.map((item, i) => ({ ...item, id: 'signer-' + i })), error: null }); } };
    } } };
    const resultado = await service.criarEnvelope(ctx, { workspace_id: 'ws', representante_id: 'rep', nome_signatario: 'Cliente Teste', email_signatario: 'cliente@example.com', numero: '', pdf_base64: Buffer.from(await pdf.save()).toString('base64'), assinatura_opcoes_representante: configs[0], assinatura_opcoes_cliente: configs[1], participantes_adicionais: [{ papel: 'testemunha', nome: 'Testemunha Teste', email: 'testemunha@example.com', assinatura_opcoes: configs[2] }] });
    assert.deepEqual(snapshot.map(item => item.empresa_snapshot.assinatura_opcoes), configs);
    assert.deepEqual(resultado.signatarios.map(item => item.status), ['pendente', 'aguardando', 'aguardando']);
    assert.equal(snapshot[1].empresa_snapshot.empresa_id, 'empresa');
  } finally { base.moduloContratosLiberado = liberar; base.tentarEnviarEmailAssinatura = enviarEmail; }
});

test('frontend recusa backend antigo que ainda nao entende as opcoes', async () => {
  const ts = require('typescript');
  const source = fs.readFileSync(path.join(__dirname, '../app/api/contratos/_opcoes.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, process: { env: {} }, AbortSignal, fetch: async url => { assert.ok(url.endsWith('/assinaturas-wolf/admin/capacidades')); return { ok: false, json: async () => ({}) }; } };
  vm.createContext(context); vm.runInContext(compiled, context);
  await assert.rejects(context.exports.exigirSuporteOpcoesAssinatura('https://backend.example.com'), error => error.statusCode === 503);
  context.fetch = async () => ({ ok: true, json: async () => ({ opcoes_assinatura: true }) });
  await context.exports.exigirSuporteOpcoesAssinatura('https://backend.example.com');
});
