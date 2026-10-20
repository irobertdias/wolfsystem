const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const pacote=path.resolve(__dirname,'..'),prime=path.join(pacote,'prime');
const cadastro=require(path.join(prime,'prime-cadastro/patch.cjs')),docs=require(path.join(prime,'prime-documentos/patch.cjs')),atendimento=require(path.join(prime,'prime-atendimento/patch.cjs')),qr=require(path.join(pacote,'patch.cjs')),auditoria=require('./patch.cjs');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
const etapas=[['src/routes/fluxos.js',s=>auditoria.fluxos(cadastro.corrigir(s))],['src/services/fluxo-ia-multimidia-bridge.js',docs.bridge],['src/services/fluxo-ia-multimidia.js',docs.visao],['src/jobs/fluxo-ia-followups-worker.js',atendimento.worker],['src/services/fluxo-ia-followups.js',atendimento.entrada],['src/services/bko-ia.js',()=>fs.readFileSync(path.join(prime,'bko-ia.js'),'utf8')],['src/shared/estado.js',qr.estado],['src/services/webjs-manager.js',qr.gerente],['src/jobs/crm-automacoes-worker.js',auditoria.worker],['src/services/fluxo-ia-fila.js',auditoria.fila]];
const plano=etapas.map(([p,fn])=>{const original=fs.readFileSync(path.join(root,p),'utf8'),codigo=fn(original);if(fn(codigo)!==codigo)throw Error('Patch não idempotente: '+p);return{p,original,codigo}});
for(const [origem,p]of [['browser.cjs','src/shared/webjs-browser.cjs'],['webjs-ciclo.js','src/services/webjs-ciclo.js']])plano.push({p,original:fs.existsSync(path.join(root,p))?fs.readFileSync(path.join(root,p),'utf8'):null,codigo:fs.readFileSync(path.join(pacote,origem),'utf8')});
for(const x of plano){const alvo=path.resolve(root,x.p);if(!alvo.startsWith(root+path.sep))throw Error('Arquivo fora do aplicativo');const r=spawnSync(process.execPath,['--check'],{input:x.codigo,encoding:'utf8'});if(r.status)throw Error(x.p+': '+r.stderr)}
if(!process.argv.includes('--apply')){console.log('AUDITORIA_COMPLETA_CHECK_OK: '+plano.length+' arquivos compatíveis; nada alterado.');process.exit(0)}
const backup=path.join(root,'backups','auditoria-completa-'+Date.now());
for(const x of plano)if(x.original!==null){const b=path.join(backup,x.p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,x.original)}
try{for(const x of plano)fs.writeFileSync(path.join(root,x.p),x.codigo)}catch(e){for(const x of plano){const alvo=path.join(root,x.p);if(x.original!==null)fs.writeFileSync(alvo,x.original);else if(fs.existsSync(alvo))fs.unlinkSync(alvo)}throw e}
console.log('AUDITORIA_INSTALADA: '+plano.length+' arquivos; backup: '+backup);
