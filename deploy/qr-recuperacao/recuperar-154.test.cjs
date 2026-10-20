const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(inicial){
 const eventos=[],respostas=[inicial,{success:true,status:'inicializando'},{status:'aguardando_qr',qr:'dado-privado-nao-exibir'}];
 const mod={exports:{}},ctx={module:mod,require:n=>{
  if(n==='node:path')return path.posix;
  if(n==='node:fs')return{existsSync:p=>!p.includes('.backup-'),realpathSync:p=>p,renameSync:(a,b)=>eventos.push({mover:[a,b]})};
  if(n==='dotenv')return{config(){}};
  if(n.endsWith('webjs-perfil.js'))return{liberarPerfilWebjs:async id=>eventos.push({encerrar:id})};throw Error(n);
 },process:{env:{}},console:{log:s=>eventos.push({log:s}),error(){}},AbortSignal:{timeout:()=>undefined},setTimeout:f=>{f();return 0},Date,JSON,Number,Error,
 fetch:async(url,o)=>{eventos.push({rota:url,body:o.body?JSON.parse(o.body):null});return{ok:true,json:async()=>respostas.shift()};}};
 ctx.require.resolve=n=>n;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'recuperar-154.cjs'),'utf8')+'\nmodule.exports.main=main;',ctx);
 return{executar:mod.exports.main,eventos};
}
test('canal conectado ou QR pronto não encerra nem move sessão',async()=>{
 for(const s of [{status:'conectado'},{status:'aguardando_qr',qr:'privado'}]){const f=fixture(s);await f.executar();assert.equal(f.eventos.filter(e=>e.encerrar||e.mover||e.body).length,0);}
});
test('recuperação preserva perfil antes do reset e atua somente em 154/abcfinan',async()=>{
 const f=fixture({status:'inicializando'});await f.executar();
 assert.equal(f.eventos.find(e=>e.encerrar).encerrar,154);
 const move=f.eventos.findIndex(e=>e.mover),reset=f.eventos.findIndex(e=>e.body);
 assert.ok(move>=0&&reset>move);assert.equal(f.eventos[move].mover[0],'/root/wolf-whatsapp/.wwebjs_auth/session-canal_154');
 assert.equal(f.eventos[reset].body.canalId,154);assert.equal(f.eventos[reset].body.workspaceId,'abcfinan');
 assert.ok(f.eventos.some(e=>e.log?.startsWith('QR_154_GERADO')));assert.ok(!JSON.stringify(f.eventos).includes('dado-privado-nao-exibir'));
});
