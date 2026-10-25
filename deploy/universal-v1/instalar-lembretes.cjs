'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp');
if(root!=='/root/wolf-whatsapp')throw Error('Raiz inesperada');
const arquivos=['runtime.cjs','nativo.cjs','ponto-retomada.cjs','agendamento-contato.cjs','lembretes-universais.cjs'],destino=path.join(root,'src/services/universal-v1');
for(const f of arquivos)execFileSync(process.execPath,['--check',path.join(__dirname,f)]);
const backup=path.join(root,'backups','lembretes-universais-'+Date.now());fs.mkdirSync(backup,{mode:0o700});
for(const f of arquivos){if(fs.existsSync(path.join(destino,f)))fs.copyFileSync(path.join(destino,f),path.join(backup,f));fs.copyFileSync(path.join(__dirname,f),path.join(destino,f));}
console.log('Lembretes instalados. Backup:',backup);
