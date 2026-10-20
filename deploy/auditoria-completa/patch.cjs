const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function estado(s){if(s.includes('// wolfQrBrowserNativo'))return s;const a=s.indexOf('function detectarChromium() {'),b=s.indexOf('\nconst CHROMIUM_PATH =',a);if(a<0||b<0)throw Error('Encaixe do navegador incompatível');return s.slice(0,a)+`function detectarChromium() {
  // wolfQrBrowserNativo: não iniciar Snap com namespace recusado.
  return require("./webjs-browser.cjs").selecionar();
}
`+s.slice(b);}
function gerente(s){
 if(s.includes('protegerCicloWebjs(client,'))return s;
 const a=s.indexOf('  // O whatsapp-web.js pode pedir inject()'),b=s.indexOf('  client.on("qr",',a);
 if(a<0||b<0||!s.slice(a,b).includes('const clienteAindaAtual'))throw Error('Encaixe do ciclo incompatível; nenhum arquivo foi trocado');
 const bloco=`  const clienteAindaAtual = () => !sessao.substituida && !sessao.encerrando && sessoes[canalId] === sessao && sessoes[canalId]?.client === client;
  require("./webjs-ciclo.js").protegerCicloWebjs(client, {
    ativo: clienteAindaAtual,
    diagnostico: m => console.warn("[WebJS ciclo] Canal " + canalId + ": " + m),
    falhou: async (origem, erro) => {
      if (!clienteAindaAtual()) return;
      sessao.status = "desconectado"; sessao.erroInicializacao = origem + ": " + erro.message;
      console.error("[WebJS ciclo] Canal " + canalId + ": " + sessao.erroInicializacao);
      await ctx.atualizarStatusCanal(canalId, "desconectado", "");
    }
  });

`;
 return s.slice(0,a)+bloco+s.slice(b);
}
function executar(raiz,check=false){
 const planos=[['src/shared/estado.js',estado],['src/services/webjs-manager.js',gerente]].map(([p,fn])=>({p,codigo:fn(fs.readFileSync(path.join(raiz,p),'utf8'))}));
 for(const f of planos){const r=spawnSync(process.execPath,['--check'],{input:f.codigo,encoding:'utf8'});if(r.status)throw Error(r.stderr);}
 if(check){console.log('QR_CHECK_OK: encaixes compatíveis, nada alterado.');return;}
 const backup=path.join(raiz,'backups','qr-nativo-'+Date.now());
 for(const f of planos){const alvo=path.join(raiz,f.p),b=path.join(backup,f.p);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(alvo,b);}
 const auxiliares=[['browser.cjs','src/shared/webjs-browser.cjs'],['webjs-ciclo.js','src/services/webjs-ciclo.js']];
 const anteriores=new Map(auxiliares.map(([,p])=>[p,fs.existsSync(path.join(raiz,p))?fs.readFileSync(path.join(raiz,p)):null]));
 try{
  for(const f of planos)fs.writeFileSync(path.join(raiz,f.p),f.codigo);
  for(const [origem,destino]of auxiliares)fs.copyFileSync(path.join(__dirname,origem),path.join(raiz,destino));
 }catch(e){
  for(const f of planos)fs.copyFileSync(path.join(backup,f.p),path.join(raiz,f.p));
  for(const [p,conteudo]of anteriores){const alvo=path.join(raiz,p);if(conteudo)fs.writeFileSync(alvo,conteudo);else if(fs.existsSync(alvo))fs.unlinkSync(alvo);}
  throw e;
 }
 console.log('Código QR aplicado; backup: '+backup);
}
module.exports={estado,gerente};if(require.main===module)executar(path.resolve(process.argv[2]||'/root/wolf-whatsapp'),process.argv.includes('--check'));
