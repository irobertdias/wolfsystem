const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {gerarTestePortatil}=require('./gerar-teste-bko-portatil.cjs');
test('suíte do servidor executa sem TypeScript, arquivos Next ou node_modules',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vero-portatil-'));
 for(const f of ['bko-vero-core.js','bko-ia-regras.js'])fs.copyFileSync(path.join('deploy/vero',f),path.join(root,f));
 const codigo=gerarTestePortatil(fs.readFileSync('deploy/vero/bko-vero.test.cjs','utf8'));
 fs.writeFileSync(path.join(root,'runtime.test.cjs'),codigo);
 assert.ok(!codigo.includes("require('typescript')"));assert.ok(!fs.existsSync(path.join(root,'node_modules')));
 const env={...process.env,NODE_PATH:''};delete env.NODE_TEST_CONTEXT;delete env.NODE_TEST_WORKER_ID;
 const r=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(root,'runtime.test.cjs')],{cwd:root,encoding:'utf8',env});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.match(r.stdout,/(?:pass 20|"passed":20)/);assert.match(r.stdout,/(?:fail 0|"failed":0)/);
});
test('geração não ignora silenciosamente mudanças na suíte de origem',()=>{assert.throws(()=>gerarTestePortatil('test("outro",()=>{});'),/Estrutura/);});
