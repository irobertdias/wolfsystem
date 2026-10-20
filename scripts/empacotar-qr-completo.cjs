const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root='deploy/qr-recuperacao';
fs.cpSync('deploy/prime-correcao-completa',path.join(root,'prime'),{recursive:true});
for(const p of [path.join(root,'instalar.sh')])fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'));
const r=spawnSync('tar',['-czf','deploy/wolf-qr-vendas-completo-20261020.tar.gz','-C',root,'browser.cjs','patch.cjs','webjs-ciclo.js','smoke.cjs','instalar.sh','test.cjs','ciclo.test.cjs','prime'],{encoding:'utf8'});if(r.status)throw Error(r.stderr);console.log('Pacote conjunto gerado sem credenciais ou dados de clientes.');
