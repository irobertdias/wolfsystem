const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {selecionar}=require('./browser.cjs'),{estado,gerente}=require('./patch.cjs');
test('Chrome nativo prevalece sobre wrappers e links Snap; sem navegador válido falha explicitamente',()=>{
 const mock={env:{},existe:p=>['/snap/bin/chromium','/usr/bin/google-chrome-stable','/usr/bin/chromium'].includes(p),ler:()=>'',resolver:p=>p};
 assert.equal(selecionar(mock),'/usr/bin/google-chrome-stable');
 assert.equal(selecionar({...mock,env:{WOLF_CHROME_PATH:'/usr/bin/chromium'},ler:p=>p.includes('chromium')?'exec /snap/bin/chromium "$@"':''}),'/usr/bin/google-chrome-stable');
 assert.throws(()=>selecionar({...mock,existe:p=>p==='/usr/bin/chromium',resolver:()=>'/snap/chromium/current/chrome'}),/Nenhum Chrome nativo/);
});
test('patch incremental mantém o retorno BKO e não remove autenticação',()=>{
 const root=process.env.WOLF_BACKEND_DIR||(process.platform==='win32'?'D:/GERAL/wolf-whatsapp':'/root/wolf-whatsapp');
 let g=fs.readFileSync(path.join(root,'src/services/webjs-manager.js'),'utf8');
 if(!g.includes('// retornoBkoWebjs'))g=g.replace('    const numeroReal = numeroLimpo;','    const numeroReal = numeroLimpo;\n    // retornoBkoWebjs\n    if (ctx.tratarRetornoBko) console.log("interceptor preservado");');
 const novo=gerente(g);assert.ok(novo.includes('// retornoBkoWebjs'));assert.ok(novo.includes('LocalAuth'));assert.equal(gerente(novo),novo);assert.ok(!novo.includes('Date.now() - ultimaInjectConcluidaEm < 1000'));
 const e=estado(fs.readFileSync(path.join(root,'src/shared/estado.js'),'utf8'));assert.equal(estado(e),e);assert.ok(e.includes('webjs-browser.cjs'));assert.throws(()=>gerente('código diferente'));
});
