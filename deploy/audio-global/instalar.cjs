'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root='/root/wolf-whatsapp',source=__dirname,route=path.join(root,'src/routes/midias.js'),helper=path.join(root,'src/services/audio-seguro.cjs');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(sha(route)!==sha(path.join(source,'midias-original.js')))throw Error('A rota mudou desde a análise. Instalação cancelada para preservar alterações.');
for(const p of ['midias.js','audio-seguro.cjs'])cp.execFileSync(process.execPath,['--check',path.join(source,p)],{stdio:'pipe'});
const backup=path.join(root,'backups','audio-global-'+Date.now());fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.copyFileSync(route,path.join(backup,'midias.js'));
if(fs.existsSync(helper))fs.copyFileSync(helper,path.join(backup,'audio-seguro.cjs'));
for(const [name,dest]of [['audio-seguro.cjs',helper],['midias.js',route]]){fs.copyFileSync(path.join(source,name),dest+'.audio-novo');fs.renameSync(dest+'.audio-novo',dest);}
cp.execFileSync('pm2',['restart','wolf-whatsapp'],{stdio:'pipe'});
console.log(JSON.stringify({instalado:true,escopo:'todos os workspaces na rota compartilhada de áudio',backup,hashRota:sha(route),processos:JSON.parse(cp.execFileSync('pm2',['jlist'],{encoding:'utf8'})).map(p=>({nome:p.name,status:p.pm2_env.status,pid:p.pid}))}));
