const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function carregar(arquivo, contexto = {}) {
  const modulo = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: modulo.exports, Blob, Response, Headers, AbortSignal, process: { env: { WOLF_SIGNATURE_PROXY_SECRET: 'teste'.repeat(10), WHATSAPP_URL: 'https://backend.exemplo.com' } }, ...contexto });
  return modulo.exports;
}
const { lerPdfAssinado, nomePdfAssinado } = carregar('app/lib/contrato-pdf.ts');
test('visualizador aceita PDF e rejeita erro ou HTML sem exibir como contrato', async () => {
  const arquivo = await lerPdfAssinado(new Response('%PDF-1.7\nconteudo', { headers: { 'content-type':'application/octet-stream' } }));
  assert.equal(arquivo.type, 'application/pdf');
  assert.equal(await arquivo.text(), '%PDF-1.7\nconteudo');
  await assert.rejects(lerPdfAssinado(new Response('<html>Erro</html>')), /PDF válido/);
  await assert.rejects(lerPdfAssinado(new Response(JSON.stringify({error:'Sem permissão'}), {status:403})), /Sem permissão/);
  assert.equal(nomePdfAssinado('contrato.pdf'), 'assinado_contrato.pdf');
});

const id = '12345678-1234-4123-8123-123456789abc';
function api({ permitido = true, status = 200 } = {}) {
  const chamadas = [], permissoes = [];
  class NextResponse extends Response { static json(data, init) { return new NextResponse(JSON.stringify(data), init); } }
  const auth = {
    autenticarContratos: async () => ({workspaceId:'workspace-autenticado'}),
    exigirPermissaoContratos: (acesso, permissao) => { permissoes.push(permissao); if (!permitido) throw Object.assign(new Error('Sem permissão'), {statusCode:403}); },
    respostaErroContratos: e => ({status:e.statusCode || 500,message:e.message}),
  };
  const route = carregar('app/api/contratos/[id]/arquivo/route.ts', {
    require: nome => nome === 'next/server' ? {NextResponse} : auth,
    fetch: async (url, opts) => { chamadas.push({url,opts}); return status === 200 ? new Response('%PDF-1.7\nassinado', {headers:{'content-disposition':'attachment; filename="final.pdf"'}}) : new Response(JSON.stringify({error:'PDF assinado não encontrado'}), {status}); },
  });
  return {...route,chamadas,permissoes};
}
test('preview abre arquivo final com autenticacao e workspace confiavel; download continua disponivel', async () => {
  for (const visualizar of [true,false]) {
    const a = api();
    const response = await a.GET({nextUrl:new URL(`https://app.exemplo.com/arquivo?workspaceId=forjado${visualizar?'&visualizar=1':''}`)}, {params:Promise.resolve({id})});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Content-Disposition').startsWith(visualizar?'inline':'attachment'),true);
    assert.ok(a.chamadas[0].url.endsWith(`${id}/arquivo?workspaceId=workspace-autenticado`));
    assert.ok(a.chamadas[0].opts.headers['X-Wolf-Signature-Proxy']);
    assert.equal(a.permissoes.join(), 'contratos_baixar');
    assert.equal(await response.text(), '%PDF-1.7\nassinado');
  }
});
test('sem permissao nao consulta backend; arquivo ausente mostra erro', async () => {
  const bloqueada = api({permitido:false});
  const req = {nextUrl:new URL('https://app.exemplo.com/arquivo?visualizar=1')};
  assert.equal((await bloqueada.GET(req,{params:Promise.resolve({id})})).status,403);
  assert.equal(bloqueada.chamadas.length,0);
  const ausente = api({status:404});
  const response = await ausente.GET(req,{params:Promise.resolve({id})});
  assert.equal(response.status,404);
  assert.equal((await response.json()).error,'PDF assinado não encontrado');
});
