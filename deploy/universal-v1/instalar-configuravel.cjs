'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=fs.realpathSync(process.argv[2]||'/root/wolf-whatsapp');
if(root!=='/root/wolf-whatsapp')throw Error('Raiz de instalação inesperada.');
const destino=path.join(root,'src/services/universal-v1'),rota=path.join(root,'src/routes/fluxos.js'),index=path.join(root,'index.js');
const backup=path.join(root,'backups','universal-configuravel-'+Date.now());fs.mkdirSync(backup,{mode:0o700});
fs.cpSync(destino,path.join(backup,'universal-v1'),{recursive:true});fs.copyFileSync(rota,path.join(backup,'fluxos.js'));fs.copyFileSync(index,path.join(backup,'index.js'));
const arquivos=['endereco-midia.cjs','documentos.cjs','interpretacao.cjs','vtal.cjs','conversa.cjs','runtime.cjs','pos-venda.cjs','generico.cjs','modelo-vendas.cjs','ia-configuravel.cjs','nativo.cjs','vero.cjs','vero-tabelas.cjs'];
for(const f of arquivos)execFileSync(process.execPath,['--check',path.join(__dirname,f)]);
let s=fs.readFileSync(rota,'utf8');
if(!s.includes('const motorUniversalCompartilhado = ctx;'))s=s.replace('module.exports = function carregar_fluxos(ctx) {','module.exports = function carregar_fluxos(ctx) {\n  const motorUniversalCompartilhado = ctx;');
const ancora='async function processarNo(fluxo, no, variaveis, mensagemCliente, processarInput, fnEnviar, ctx) {';
if(!s.includes('processarUniversalNativo(fluxo')){
 if(!s.includes(ancora))throw Error('Assinatura do motor nativo mudou.');
 s=s.replace(ancora,ancora+`\n  if (motorUniversalCompartilhado.processarUniversalNativo) {\n    const universal = await motorUniversalCompartilhado.processarUniversalNativo(fluxo, no, variaveis, mensagemCliente, processarInput, fnEnviar, ctx);\n    if (universal) return universal;\n  }`);
}
if(!s.includes('motorUniversalCompartilhado.encaminharVendaNativa')){
 const marco='variaveis.proposta_id = String(propostaId);';
 if(!s.includes(marco))throw Error('Cadastro nativo mudou.');
 s=s.replace(marco,marco+`\n        if (d.encaminhar_bko === true && motorUniversalCompartilhado.encaminharVendaNativa) await motorUniversalCompartilhado.encaminharVendaNativa(workspaceId, propostaId);`);
}
let boot=fs.readFileSync(index,'utf8'),linha='require("./src/services/universal-v1/nativo.cjs")(ctx);';
if(!boot.includes(linha)){
 const marco='require("./src/services/universal-v1/runtime.cjs")(ctx);';if(!boot.includes(marco))throw Error('Inicializador universal não encontrado.');boot=boot.replace(marco,marco+'\n'+linha);
}
// No database flows, connections or channels are activated by this installer.
for(const f of arquivos)fs.copyFileSync(path.join(__dirname,f),path.join(destino,f));
fs.writeFileSync(rota,s);fs.writeFileSync(index,boot);
try{execFileSync(process.execPath,['--check',rota]);execFileSync(process.execPath,['--check',index]);}
catch(e){fs.copyFileSync(path.join(backup,'fluxos.js'),rota);fs.copyFileSync(path.join(backup,'index.js'),index);throw e;}
console.log(JSON.stringify({instalado:true,backup,fluxos_ativados:0}));
