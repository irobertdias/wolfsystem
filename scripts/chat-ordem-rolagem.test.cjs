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
const { ordenarAtendimentos, capturarPosicaoLista, restaurarPosicaoLista } = modulo.exports;

test('fixadas ficam no topo nos dois sentidos sem alterar a ordem por ultima mensagem de cada grupo', () => {
  const itens = [1, 2, 3, 4].map(id => ({ id, created_at: '2026-01-01T00:00:00Z', ultima_mensagem_em: `2026-10-${10 + id}T12:00:00Z` }));
  const fixadas = new Set([1, 3]);
  assert.equal(ordenarAtendimentos(itens, 'recentes', fixadas).map(a => a.id).join(), '3,1,4,2');
  assert.equal(ordenarAtendimentos(itens, 'antigos', fixadas).map(a => a.id).join(), '1,3,2,4');
  fixadas.delete(1);
  assert.equal(ordenarAtendimentos(itens, 'recentes', fixadas).map(a => a.id).join(), '3,4,2,1');
  assert.equal(ordenarAtendimentos(itens.filter(a => a.id !== 3), 'recentes', fixadas).map(a => a.id).join(), '4,2,1');
});

test('ordena pela ultima mensagem, nao pela alteracao administrativa ou abertura', () => {
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
  itens[1].ultima_mensagem_em = '2026-10-15T12:00:00Z';
  assert.equal(ordenarAtendimentos(itens, 'recentes').map(a => a.id).join(), '1,3,2');
  assert.equal(ordenarAtendimentos(itens, 'antigos').map(a => a.id).join(), '2,3,1');
});

test('resposta muda a ordem sem arrastar a lista para o atendimento que foi ao topo', () => {
  let ordem = [1, 2, 3, 4, 5, 6];
  const lista = { scrollTop: 200, clientHeight: 300,
    getBoundingClientRect: () => ({ top: 50 }),
    querySelectorAll: () => ordem.map(id => ({
      dataset: { atendimentoId: String(id) },
      getBoundingClientRect: () => ({ top: 50 + ordem.indexOf(id) * 100 - lista.scrollTop,
        bottom: 150 + ordem.indexOf(id) * 100 - lista.scrollTop }),
    })),
  };
  const posicao = capturarPosicaoLista(lista, 3);
  assert.equal(posicao.ancoras[0].id, '4');
  ordem = [3, 1, 2, 4, 5, 6];
  restaurarPosicaoLista(lista, posicao);
  assert.equal(lista.scrollTop, 200);
  ordem = [3, 1, 2, 5, 6]; // atendimento finalizado sai da lista
  restaurarPosicaoLista(lista, posicao);
  assert.equal(lista.scrollTop, 100);
  lista.scrollTop = 0;
  const inicio = capturarPosicaoLista(lista);
  ordem = [7, ...ordem];
  restaurarPosicaoLista(lista, inicio);
  assert.equal(lista.scrollTop, 0);
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
