const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/lib/ordenacao-atendimentos.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: modulo.exports });
const { ordenarAtendimentos } = modulo.exports;

test('ordena por abertura nas duas direcoes sem alterar os dados originais', () => {
  const itens = [
    { id: 2, created_at: '2026-10-12T12:00:00Z' },
    { id: 1, created_at: '2026-10-11T12:00:00Z' },
    { id: 3, created_at: '2026-10-12T12:00:00Z' },
  ];
  assert.equal(ordenarAtendimentos(itens, 'antigos').map(a => a.id).join(), '1,2,3');
  assert.equal(ordenarAtendimentos(itens, 'recentes').map(a => a.id).join(), '3,2,1');
  assert.equal(itens.map(a => a.id).join(), '2,1,3');
  itens[1].updated_at = '2026-10-15T12:00:00Z';
  assert.equal(ordenarAtendimentos(itens, 'recentes').map(a => a.id).join(), '3,2,1');
});

test('envio nao forca fundo e scroll automatico respeita leitura iniciada durante o atraso', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/chatbot/_sections/ChatSection.tsx'), 'utf8');
  const envio = source.slice(source.indexOf('  const enviarMensagem ='), source.indexOf('  const aplicarRespostaRapida ='));
  assert.doesNotMatch(envio, /setStickyFundo\(true\)/);
  const inicio = source.indexOf('  useEffect(() => {\n    if (!stickyFundo) return;');
  const fim = source.indexOf('  }, [historico, stickyFundo]);', inicio);
  const efeito = source.slice(inicio, fim + '  }, [historico, stickyFundo]);'.length);
  const callbacks = [];
  const chamadas = [];
  const contexto = { stickyFundo: true, stickyFundoRef: { current: true }, historico: [],
    scrollContainerRef: { current: { scrollHeight: 2500, scrollTo: value => chamadas.push(value) } },
    useEffect: fn => fn(), setTimeout: fn => { callbacks.push(fn); return 1; }, clearTimeout() {} };
  vm.runInNewContext(efeito, contexto);
  contexto.stickyFundoRef.current = false;
  callbacks[0]();
  assert.equal(chamadas.length, 0);
  contexto.stickyFundoRef.current = true;
  callbacks[0]();
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].top, 2500);
});
