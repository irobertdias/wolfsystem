const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { exports, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; }, Set, Map, Buffer, process });
  return exports;
}
const catalogo = load('app/lib/planos-grupoprime.ts');
const fixture = { fonte: 'teste', ceps_planilha: '01239020', cidades: [
  { uf: 'GO', cidade: 'GOIANIA', ceps: '74085400,10,2,0\n74000000,1,0,0\n74000001,1,0,1\n12345678,1,1,0' },
  { uf: 'GO', cidade: 'TRINDADE', ceps: '75380000,8,3,0\n12345678,1,1,0' },
] };
const helper = load('app/lib/viabilidade-grupoprime.ts', { './data/viabilidade-grupoprime.json': fixture, './planos-grupoprime': catalogo });
test('base final reconcilia registros, preserva CEPs e carrega cidades com formatos especiais', () => {
  const base = JSON.parse(fs.readFileSync('app/lib/data/viabilidade-grupoprime.json', 'utf8'));
  const csvCeps = new Set(); let registros = 0;
  for (const cidade of base.cidades) for (const linha of cidade.ceps.split('\n')) {
    const [cep, total, disponiveis, desconhecidos] = linha.split(',');
    assert.match(cep, /^\d{8}$/); assert.ok(+disponiveis <= +total); assert.ok(+desconhecidos <= +total);
    csvCeps.add(cep); registros += +total;
  }
  assert.equal(registros, base.fontes.reduce((total, fonte) => total + fonte.linhas_validas, 0));
  assert.equal(base.fontes.length, 242);
  assert.ok(base.fontes.every(fonte => fonte.linhas_validas > 0 && /^[a-f0-9]{64}$/.test(fonte.sha256)));
  assert.ok(base.cidades.find(cidade => cidade.cidade === 'MARABA'));
  assert.ok(base.cidades.find(cidade => cidade.cidade === 'RIO DE JANEIRO').ceps.split('\n').some(linha => +linha.split(',')[2] > 0));
  const cepsPlanilha = new Set(base.ceps_planilha.split('\n'));
  assert.ok([...csvCeps].every(cep => cepsPlanilha.has(cep)));
});
test('CEP mantém zero inicial e rejeita conteúdo arbitrário e números', () => {
  assert.equal(helper.normalizarCep('01239-020'), '01239020');
  for (const invalido of ['0123902', 'abc01239020', '01239.020', '012390200', '00000-000', '99999999', 1239020, null]) assert.equal(helper.normalizarCep(invalido), null);
});
test('cidade promocional precisa corresponder também à UF', () => {
  assert.equal(catalogo.planosDaCidade('GO', 'Trindade').tabela, 'promocional');
  assert.equal(catalogo.planosDaCidade('PE', 'Trindade').tabela, 'padrao');
  assert.equal(catalogo.planosDaCidade('GO', 'Goiânia').tabela, 'padrao');
  assert.equal(catalogo.planosDaCidade('PR', 'Ibiporã').tabela, 'promocional');
});
test('preços PF e PJ seguem artes, sem desconto adicional na promoção', () => {
  const padrao = catalogo.planosDaCidade('GO', 'Goiânia'), promo = catalogo.planosDaCidade('GO', 'Trindade');
  assert.deepEqual(Array.from(padrao.pessoa_fisica, p => [p.velocidade_mbps, p.mensalidade, p.mensalidade_cartao]), [[600,110,95],[800,140,125],[1000,170,155],[1000,200,185]]);
  assert.deepEqual(Array.from(padrao.pessoa_juridica, p => [p.velocidade_mbps, p.mensalidade, p.mensalidade_cartao]), [[700,110,95],[800,130,115],[1000,180,165]]);
  assert.deepEqual(Array.from(promo.pessoa_fisica, p => p.mensalidade), [70,85,100]);
  assert.deepEqual(Array.from(promo.pessoa_juridica, p => p.mensalidade), [70,85,100]);
  assert.ok(promo.pessoa_fisica.every(p => p.mensalidade_cartao === null));
  assert.equal(promo.pessoa_juridica[2].wifi_mesh, false);
  assert.equal(promo.pessoa_fisica[2].wifi_mesh, true);
});
test('não oferta em CEP ausente, ambíguo, divergente ou com disponibilidade desconhecida', () => {
  for (const cep of ['99999998', '01239020', '12345678', '74000000', '74000001']) assert.equal(helper.consultarViabilidade(cep).planos, null);
  assert.equal(helper.consultarViabilidade('74085400', 'Trindade', 'GO').status, 'cidade_divergente');
  assert.equal(helper.consultarViabilidade('12345678', 'Trindade', 'GO').planos.tabela, 'promocional');
  assert.equal(helper.consultarViabilidade('74000001').status, 'disponibilidade_nao_informada');
});
test('pré-viabilidade positiva exige confirmação técnica e escolhe tabela pela cidade', () => {
  const r = helper.consultarViabilidade('74085-400');
  assert.equal(r.cidade, 'GOIANIA'); assert.equal(r.planos.tabela, 'padrao'); assert.equal(r.confirmacao_tecnica_necessaria, true);
});
test('rota exige autenticação antes de carregar a consulta e não revela erros internos', async () => {
  let consultou = false;
  const api = load('app/api/viabilidade/grupoprime/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '../../../lib/viabilidade-grupoprime': { consultarViabilidade() { consultou = true; } },
    '../../_auth': { respostaErroAcesso: e => ({ status: e.statusCode || 500, message: e.message }) },
    './_auth': { autenticarConsulta: async () => { throw Object.assign(Error('Não autenticado'), { statusCode: 401 }); } },
  });
  const r = await api.GET({ nextUrl: new URL('https://teste/api?cep=74085400') });
  assert.equal(r.status, 401); assert.equal(consultou, false);
});
test('credencial da base só autoriza leitura e bloqueia token malformado', async () => {
  const auth = load('app/api/viabilidade/grupoprime/_auth.ts', {
    'node:crypto': require('node:crypto'), '../../_auth': {
      autenticarWorkspace: async (_, workspace) => { assert.equal(workspace, 'grupoprime'); throw Object.assign(Error('Outro workspace'), { statusCode: 403 }); }, exigirPermissao() {},
    },
  });
  const anterior = process.env.WOLF_VIABILIDADE_SECRET;
  process.env.WOLF_VIABILIDADE_SECRET = 'segredo-de-teste';
  try {
    const token = auth.tokenConsultaGrupoPrime();
    await auth.autenticarConsulta({ headers: new Headers({ 'x-wolf-viabilidade-token': token }) });
    await assert.rejects(auth.autenticarConsulta({ headers: new Headers({ 'x-wolf-viabilidade-token': 'x'.repeat(64) }) }), e => e.statusCode === 401);
    await assert.rejects(auth.autenticarConsulta({ headers: new Headers() }), e => e.statusCode === 403);
  } finally { if (anterior === undefined) delete process.env.WOLF_VIABILIDADE_SECRET; else process.env.WOLF_VIABILIDADE_SECRET = anterior; }
});


