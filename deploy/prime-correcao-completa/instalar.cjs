const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const cadastro=require('./prime-cadastro/patch.cjs'),documentos=require('./prime-documentos/patch.cjs'),atendimento=require('./prime-atendimento/patch.cjs');
const raiz=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
const patches=[['src/routes/fluxos.js',cadastro.corrigir],['src/services/fluxo-ia-multimidia-bridge.js',documentos.bridge],['src/services/fluxo-ia-multimidia.js',documentos.visao],['src/jobs/fluxo-ia-followups-worker.js',atendimento.worker],['src/services/fluxo-ia-followups.js',atendimento.entrada]];
// Preparar e validar tudo antes de escrever qualquer arquivo.
const plano=patches.map(([p,fn])=>{const original=fs.readFileSync(path.join(raiz,p),'utf8'),codigo=fn(original);if(fn(codigo)!==codigo)throw Error('Patch não idempotente: '+p);return {p,original,codigo};});
for(const {p,codigo}of plano){const r=spawnSync(process.execPath,['--check'],{input:codigo,encoding:'utf8'});if(r.status)throw Error(p+': '+r.stderr);}
if(process.argv.includes('--check')){console.log('PRIME_COMPLETO_CHECK_OK: 5 arquivos validados; nada alterado.');process.exit(0);}
const backup=path.join(raiz,'backups','prime-completo-'+new Date().toISOString().replace(/[:.]/g,'-'));
for(const {p,original}of plano){const b=path.join(backup,p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,original);}
try{for(const {p,codigo}of plano)fs.writeFileSync(path.join(raiz,p),codigo);}catch(e){for(const {p,original}of plano)fs.writeFileSync(path.join(raiz,p),original);throw e;}
console.log('Correções instaladas. Backup: '+backup);
console.log('Reinicie: pm2 restart wolf-whatsapp. Nenhum canal ou fluxo foi ativado por este instalador.');
