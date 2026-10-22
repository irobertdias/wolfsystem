'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
const executar=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)throw Error('Verificação falhou; instalação interrompida');};
(async()=>{
 executar(['--test',path.join(__dirname,'regressao.test.cjs'),path.join(__dirname,'recuperacao.test.cjs'),path.join(__dirname,'store.test.cjs')]);
 const nomes=['mensagem-resposta.js','citacao-recuperacao.js','citacao-store.js'];for(const n of nomes)executar(['--check',path.join(__dirname,n)]);
 const atual=fs.readFileSync(path.join(root,'src/services/mensagem-resposta.js'),'utf8');for(const marca of['function normalizarIdResposta(','async function enviarRespostaWebjs(','function textoHistoricoResposta('])if(!atual.includes(marca))throw Error('Envio instalado incompatível; nenhum arquivo alterado');
 if(process.argv.includes('--check')){console.log('CITACAO_V7_CHECK_OK; nenhuma alteração aplicada');return;}
 const foto=await require('./verificar.cjs')(root);console.log('FOTO_RECUPERADA_SEM_ENVIO '+JSON.stringify(foto));
 const backup=path.join(root,'backups','citacao-v7-'+Date.now());fs.mkdirSync(backup,{recursive:true});const anteriores=[];
 for(const n of nomes){const destino=path.join(root,'src/services',n),antes=fs.existsSync(destino)?fs.readFileSync(destino):null;anteriores.push({destino,antes});if(antes)fs.writeFileSync(path.join(backup,n),antes);}
 try{for(const n of nomes)fs.copyFileSync(path.join(__dirname,n),path.join(root,'src/services',n));}catch(e){for(const p of anteriores)if(p.antes)fs.writeFileSync(p.destino,p.antes);else if(fs.existsSync(p.destino))fs.unlinkSync(p.destino);throw e;}
 console.log('CITACAO_V7_INSTALADA; backup: '+backup);const r=spawnSync('pm2',['restart','wolf-whatsapp'],{stdio:'inherit'});if(r.status!==0)throw Error('Arquivos instalados; reinício não confirmado');console.log('CITACAO_V7_REINICIADA');
})().catch(e=>{console.error(String(e.stack||e));process.exitCode=1;});
