const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),patch=require('./flexivel.cjs');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
const plano=[['src/services/fluxo-ia-multimidia-bridge.js',patch.bridge],['src/services/fluxo-ia-multimidia.js',patch.visao]].map(([p,fn])=>{const original=fs.readFileSync(path.join(root,p),'utf8'),codigo=fn(original);if(fn(codigo)!==codigo)throw Error('Patch não idempotente: '+p);const c=spawnSync(process.execPath,['--check'],{input:codigo,encoding:'utf8'});if(c.status)throw Error(c.stderr);return{p,original,codigo}});
if(!process.argv.includes('--apply')){console.log('DOCUMENTOS_FLEXIVEIS_CHECK_OK');process.exit(0)}
const backup=path.join(root,'backups','documentos-flexiveis-'+Date.now());for(const x of plano){const b=path.join(backup,x.p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,x.original)}
try{for(const x of plano)fs.writeFileSync(path.join(root,x.p),x.codigo)}catch(e){for(const x of plano)fs.writeFileSync(path.join(root,x.p),x.original);throw e}
console.log('DOCUMENTOS_FLEXIVEIS_INSTALADOS; backup: '+backup);
