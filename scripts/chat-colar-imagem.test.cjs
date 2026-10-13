const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function preparar() {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const trecho = source.slice(source.indexOf('  const prepararArquivoParaEnvio'), source.indexOf('  const cancelarEnvioArquivo'));
  const code = ts.transpileModule(trecho + '\nthis.colar = handleColarImagem;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const state = { arquivo: null, preview: null, avisos: [], revogados: [] };
  const context = { File, Date, atendimentoAtivo: { canal_id: 1 }, canais: [{ id: 1, tipo: 'webjs' }], historico: [], arquivoPreviewUrl: '', arquivoSelecionado: null, enviandoMidia: false, fileUploadRef: { current: { value: '' } }, URL: { createObjectURL: () => 'blob:preview', revokeObjectURL: url => state.revogados.push(url) }, notify: texto => state.avisos.push(texto), setArquivoSelecionado: file => state.arquivo = file, setArquivoPreviewUrl: url => state.preview = url, setLegendaArquivo: texto => state.legenda = texto, setShowEmojiPicker: value => state.emojis = value };
  vm.createContext(context); vm.runInContext(code, context);
  return { state, context, source };
}

function evento(imagem, filesOnly = false) {
  const e = { prevenido: false, clipboardData: { items: !imagem || filesOnly ? [] : [{ kind: 'file', type: imagem.type, getAsFile: () => imagem }], files: imagem ? [imagem] : [] }, preventDefault() { this.prevenido = true; } };
  return e;
}

test('Ctrl+V de recorte abre previa pelo mesmo fluxo do anexo', () => {
  const { state, context, source } = preparar();
  const imagem = new File(['png'], 'image.png', { type: 'image/png' });
  const e = evento(imagem); context.colar(e);
  assert.equal(e.prevenido, true);
  assert.equal(state.arquivo, imagem);
  assert.equal(state.preview, 'blob:preview');
  assert.equal(state.legenda, '');
  assert.ok(source.includes('<textarea onPaste={handleColarImagem}'));
});

test('texto normal nao e interceptado e fallback clipboard.files aceita imagem', () => {
  const { state, context } = preparar();
  const texto = evento(null); context.colar(texto);
  assert.equal(texto.prevenido, false); assert.equal(state.arquivo, null);
  const imagem = new File(['jpg'], 'recorte.jpg', { type: 'image/jpeg' });
  context.colar(evento(imagem, true)); assert.equal(state.arquivo, imagem);
});

test('respeita limite de imagem sem abrir previa de arquivo grande', () => {
  const { state, context } = preparar();
  const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'recorte.png', { type: 'image/png' });
  context.colar(evento(grande));
  assert.equal(state.arquivo, null); assert.equal(state.preview, null);
  assert.equal(state.avisos.length, 1);
});

test('anexo em andamento nao e substituido ao colar outra imagem', () => {
  const { state, context } = preparar();
  context.enviandoMidia = true;
  context.colar(evento(new File(['png'], 'image.png', { type: 'image/png' })));
  assert.equal(state.arquivo, null); assert.equal(state.avisos.length, 1);
});
