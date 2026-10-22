'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{createRequire}=require('node:module'),cp=require('node:child_process');
const pacote=path.resolve(process.argv[2]),referencia=path.resolve(process.argv[3]||'D:/GERAL/wolf-whatsapp');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-pacote-')),root=path.join(temp,'backend'),extraido=path.join(temp,'pacote');fs.mkdirSync(extraido,{recursive:true});
for(const rel of ['index.js','src/routes/fluxos.js','src/routes/canais.js','src/services/mensagens.js','src/services/fluxo-ia-multimidia-bridge.js','src/services/fluxo-ia-captura-deterministica.js']){const destino=path.join(root,rel);fs.mkdirSync(path.dirname(destino),{recursive:true});fs.copyFileSync(path.join(referencia,rel),destino);}
for(const[origem,nome]of [['deploy/auditoria-completa/prime/bko-ia.js','bko-ia.js'],['deploy/vero/bko-vero-core.js','bko-vero-core.js']])fs.copyFileSync(origem,path.join(root,'src/services',nome));
const tar=cp.spawnSync('tar',['-xzf',pacote,'-C',extraido],{encoding:'utf8'});if(tar.status)throw Error(tar.stderr);
const arquivo=path.join(extraido,'roteiro-obrigatorio/instalar.cjs'),req=createRequire(arquivo);let testes=0;
const spawnSync=(comando,args,opts={})=>{
 if(comando==='pm2'||/[\\/]venda-fluida[\\/]ativar\.cjs$/.test(args?.[0]||''))return{status:0};
 const r=cp.spawnSync(comando,args,{...opts,cwd:temp,stdio:'pipe',encoding:'utf8'});
 if(args?.[0]==='--test'){const m=/tests (\d+)/.exec(r.stdout||'');testes+=Number(m?.[1]||0);}
 if(r.status)throw Error((r.stdout||'')+(r.stderr||''));return r;
};
new vm.Script(fs.readFileSync(arquivo,'utf8'),{filename:arquivo}).runInNewContext({require:n=>n==='node:child_process'?{spawnSync}:req(n),__dirname:path.dirname(arquivo),console,process:{argv:[process.execPath,arquivo,root],execPath:process.execPath,env:process.env,exit:c=>{throw Error('Saída inesperada '+c);}}});
const segunda=cp.spawnSync(process.execPath,[arquivo,root,'--check'],{cwd:temp,encoding:'utf8'});if(segunda.status)throw Error(segunda.stdout+segunda.stderr);
console.log(JSON.stringify({pacote:path.basename(pacote),testes_instalacao:testes,instalacao:'OK',reinstalacao:'OK',temporario:temp}));
