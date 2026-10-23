'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process'),patch=require('./patch.cjs');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),backup=path.join(root,'backups','motor-removido-'+Date.now());
const alterados=[['src/routes/fluxos.js',patch.fluxos],['index.js',patch.index],['src/jobs/fluxo-ia-followups-worker.js',patch.worker],['src/services/fluxo-ia-multimidia-bridge.js',patch.bridge]].map(([rel,fn])=>{const alvo=path.resolve(root,rel);if(!alvo.startsWith(root+path.sep))throw Error('Caminho inválido');const antes=fs.readFileSync(alvo,'utf8'),depois=fn(antes);new vm.Script(depois);return{rel,alvo,antes,depois};});
if(process.argv.includes('--check')){console.log('REMOCAO_MOTOR_CHECK_OK');process.exit(0);}
fs.mkdirSync(backup,{recursive:true});
for(const a of alterados){const destino=path.join(backup,a.rel);fs.mkdirSync(path.dirname(destino),{recursive:true});fs.writeFileSync(destino,a.antes);}
const movidos=[];
try{
 for(const a of alterados)fs.writeFileSync(a.alvo,a.depois);
 for(const nome of patch.arquivos){const origem=path.resolve(root,'src/services',nome),destino=path.resolve(backup,'src/services',nome);if(!origem.startsWith(root+path.sep)||!destino.startsWith(backup+path.sep))throw Error('Caminho inválido');if(fs.existsSync(origem)){fs.mkdirSync(path.dirname(destino),{recursive:true});fs.renameSync(origem,destino);movidos.push({origem,destino});}}
}catch(e){for(const a of alterados)fs.writeFileSync(a.alvo,a.antes);for(const m of movidos)fs.renameSync(m.destino,m.origem);throw e;}
console.log('Implementação antiga retirada. Backup: '+backup);
const r=spawnSync('pm2',['restart','wolf-whatsapp'],{stdio:'inherit'});if(r.status!==0)throw Error('Código removido; reinício ainda não confirmado');
console.log('MOTOR_VENDEDOR_REMOVIDO');
