'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
function corrigirRecuperacao(s){const marcador='  return ctx;';if(s.includes('require("./webjs-conexao-segura").instalar(ctx);'))return s;if(s.split(marcador).length!==2)throw Error('Exportação da recuperação mudou');return s.replace(marcador,'  require("./webjs-conexao-segura").instalar(ctx);\n'+marcador);}
function corrigirManager(s){
 const antes='ctx.reconectarCanalSilencioso(canalId, `evento disconnected transitório: ${reason || "UNKNOWN"}`).catch(() => {});';
 const depois='if (clienteAindaAtual() && sessao.status === "desconectado") ctx.reconectarCanalSilencioso(canalId, `evento disconnected transitório: ${reason || "UNKNOWN"}`, sessao).catch(() => {});';
 if(s.includes(depois))return s;if(s.split(antes).length!==2)throw Error('Callback da reconexão mudou');return s.replace(antes,depois);
}
if(require.main===module){const root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp');if(root!=='/root/wolf-whatsapp')throw Error('Raiz inesperada');const pasta=path.join(root,'src/services'),arquivos={'recuperacao.js':corrigirRecuperacao(fs.readFileSync(path.join(pasta,'recuperacao.js'),'utf8')),'webjs-manager.js':corrigirManager(fs.readFileSync(path.join(pasta,'webjs-manager.js'),'utf8')),'webjs-conexao-segura.js':fs.readFileSync(path.join(__dirname,'webjs-conexao-segura.js'),'utf8')},backup=path.join(root,'backups','helio-conexao-'+Date.now());fs.mkdirSync(backup);for(const [nome,s]of Object.entries(arquivos)){const file=path.join(pasta,nome);if(fs.existsSync(file))fs.copyFileSync(file,path.join(backup,nome));fs.writeFileSync(file,s);try{cp.execFileSync(process.execPath,['--check',file]);}catch(e){for(const n of Object.keys(arquivos)){const b=path.join(backup,n);if(fs.existsSync(b))fs.copyFileSync(b,path.join(pasta,n));}throw e;}}console.log(JSON.stringify({backup,instalado:true,reiniciado:false}));}
module.exports={corrigirRecuperacao,corrigirManager};
