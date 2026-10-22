'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),check=process.argv.includes('--check');
const executar=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)throw Error('Verificação falhou; instalação interrompida');};
executar(['--test',path.join(__dirname,'regressao.test.cjs'),path.join(__dirname,'recuperacao.test.cjs')]);
const nomes=['mensagem-resposta.js','citacao-recuperacao.js'],alvo=path.join(root,'src/services/mensagem-resposta.js'),atual=fs.readFileSync(alvo,'utf8');
for(const marca of ['function normalizarIdResposta(','async function enviarRespostaWebjs(','function textoHistoricoResposta('])if(!atual.includes(marca))throw Error('Versão do envio incompatível; nenhum arquivo alterado');
for(const nome of nomes)executar(['--check',path.join(__dirname,nome)]);
if(check){console.log('CITACAO_V6_CHECK_OK; nenhuma alteração aplicada');process.exit(0);}
const backup=path.join(root,'backups','citacao-v6-'+Date.now());fs.mkdirSync(backup,{recursive:true});const anteriores=[];
for(const nome of nomes){const destino=path.join(root,'src/services',nome),antes=fs.existsSync(destino)?fs.readFileSync(destino):null;anteriores.push({destino,antes});if(antes)fs.writeFileSync(path.join(backup,nome),antes);}
try{for(const nome of nomes)fs.copyFileSync(path.join(__dirname,nome),path.join(root,'src/services',nome));}catch(e){for(const p of anteriores)if(p.antes)fs.writeFileSync(p.destino,p.antes);else if(fs.existsSync(p.destino))fs.unlinkSync(p.destino);throw e;}
console.log('CITACAO_V6_INSTALADA; backup: '+backup);
const reinicio=spawnSync('pm2',['restart','wolf-whatsapp'],{stdio:'inherit'});if(reinicio.status!==0)throw Error('Arquivos instalados; reinício do processo não confirmado');
console.log('CITACAO_V6_REINICIADA; atualização limitada à recuperação da mensagem citada.');
