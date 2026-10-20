const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const raiz='deploy/prime-correcao-completa';
for(const dir of ['prime-cadastro','prime-documentos','prime-atendimento']){
 fs.mkdirSync(path.join(raiz,dir),{recursive:true});
 for(const file of ['patch.cjs','test.cjs'])fs.copyFileSync(path.join('deploy',dir,file),path.join(raiz,dir,file));
}
fs.copyFileSync('deploy/bko-ia/src/services/bko-ia.js',path.join(raiz,'bko-ia.js'));
const r=spawnSync('tar',['-czf','deploy/wolf-prime-envio-automatico-20261020.tar.gz','-C',raiz,'instalar.cjs','bko-destino.cjs','bko-ia.js','LEIA-ME.md','prime-cadastro','prime-documentos','prime-atendimento'],{encoding:'utf8'});if(r.status)throw Error(r.stderr);
console.log('Pacote completo gerado sem dados de clientes ou credenciais.');
