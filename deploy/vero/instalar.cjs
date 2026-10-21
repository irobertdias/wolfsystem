const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
const index=fs.readFileSync(path.join(root,'index.js'),'utf8'),bko=fs.readFileSync(path.join(root,'src/services/bko-ia.js'),'utf8');
const ancora='require("./src/services/bko-ia.js")(ctx);';if(!index.includes(ancora))throw Error('Instale a integração BKO antes da extensão Vero');
const novo=index.includes('require("./src/services/bko-vero.js")')?index:index.replace(ancora,ancora+'\nrequire("./src/services/bko-vero.js")(ctx);');
const health=bko.includes('vero_fluxo:')?bko:bko.replace('versao:4,','versao:4,vero_fluxo:ctx.veroBkoFluxo||null,');if(!health.includes('vero_fluxo:'))throw Error('Health BKO incompatível');
const planos=[['index.js',novo],['src/services/bko-ia.js',health],['src/services/bko-vero.js',fs.readFileSync(path.join(__dirname,'bko-vero.js'),'utf8')],['src/services/bko-vero-core.js',fs.readFileSync(path.join(__dirname,'bko-vero-core.js'),'utf8')]];
for(const [p,s]of planos){const r=spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8'});if(r.status)throw Error(p+': '+r.stderr)}
if(!process.argv.includes('--apply')){console.log('VERO_BKO_CHECK_OK');process.exit(0)}
const backup=path.join(root,'backups','vero-'+Date.now()),originais=new Map();for(const [p]of planos){const alvo=path.join(root,p),s=fs.existsSync(alvo)?fs.readFileSync(alvo):null;originais.set(p,s);if(s){const b=path.join(backup,p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,s)}}
try{for(const [p,s]of planos)fs.writeFileSync(path.join(root,p),s)}catch(e){for(const [p,s]of originais){if(s)fs.writeFileSync(path.join(root,p),s);else if(fs.existsSync(path.join(root,p)))fs.unlinkSync(path.join(root,p))}throw e}
console.log('VERO_BKO_INSTALADO; fluxo Nio preservado; backup: '+backup);
