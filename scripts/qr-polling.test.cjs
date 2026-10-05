const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source=fs.readFileSync('app/chatbot/_sections/ConexoesSection.tsx','utf8');
const parsed=ts.createSourceFile('ConexoesSection.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node) { if(ts.isCallExpression(node) && node.expression.getText(parsed)==='useEffect' && node.arguments[0]?.getText(parsed).includes('if (!qrPolling || !showModalQR || !qrCanalId)')) callback=node.arguments[0].getText(parsed); ts.forEachChild(node,visit); }
visit(parsed); assert.ok(callback);
const code=ts.transpileModule('module.exports = '+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(fetchImpl) {
 const timers=[], updates=[], notices=[]; let requests=0;
 const sandbox={module:{exports:{}},qrPolling:true,showModalQR:true,qrCanalId:134,wsId:'teste',qrImageUrl:'',console:{log(){},warn(){}},AbortController,
 setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},
 setQrTentativas(){},setQrPolling:v=>updates.push(['poll',v]),setQrImageUrl:v=>updates.push(['image',v]),
 notify:(...args)=>notices.push(args),traduzirErro:String,
 fetch:(...args)=>{requests++;return fetchImpl(...args);}};
 vm.runInNewContext(code,sandbox);const cleanup=sandbox.module.exports();
 return {timers,updates,notices,cleanup,count:()=>requests};
}
test('consulta imediatamente e agenda proxima apenas apos resposta',async()=>{
 let finish;const s=setup(()=>new Promise(resolve=>finish=resolve));
 assert.equal(s.count(),1);assert.equal(s.timers.length,0);
 finish(Response.json({qr:'data:image/png;base64,qr',status:'aguardando_qr'}));await flush();
 assert.equal(s.timers.length,1);assert.equal(s.updates[0][0],'image');s.cleanup();
});
test('fechar modal aborta consulta e ignora resposta tardia',async()=>{
 let finish,signal;const s=setup((url,init)=>{signal=init.signal;return new Promise(resolve=>finish=resolve);});
 s.cleanup();assert.equal(signal.aborted,true);finish(Response.json({qr:'qr',status:'aguardando_qr'}));await flush();
 assert.equal(s.updates.length,0);assert.equal(s.timers.length,0);
});
test('erro de inicializacao para polling e informa usuario',async()=>{
 const s=setup(async()=>Response.json({erro:'Chromium falhou',status:'desconectado'}));await flush();
 assert.equal(s.notices.length,1);assert.equal(s.updates[0][1],false);assert.equal(s.timers.length,0);s.cleanup();
});
test('erro de rede agenda nova consulta sem sobrepor',async()=>{
 const s=setup(async()=>{throw new Error('rede');});await flush();
 assert.equal(s.count(),1);assert.equal(s.timers.length,1);s.cleanup();
});
