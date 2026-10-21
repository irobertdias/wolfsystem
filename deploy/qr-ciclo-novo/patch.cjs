const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function corrigir(s){if(s.includes('// wolfNovoQrSequencialV2'))return s;const a=s.indexOf('// Mostrar QR reutiliza'),b=s.indexOf('// 🆕 ═',a);if(a<0||b<0||!s.slice(a,b).includes('app.post("/resetar"'))throw Error('Rotas incompatíveis; código preservado');return s.slice(0,a)+`// wolfNovoQrSequencialV2: QR e reset encerram o browser antes de recriar.
const novoQrSequencial = require("../services/webjs-novo-qr.js").criarNovoQr(ctx, {
  comPrazoInicio, encerrarClienteWebjs,
  liberarPerfilWebjs: require("../services/webjs-perfil.js").liberarPerfilWebjs,
});
app.post("/iniciar-qr", novoQrSequencial);
app.post("/resetar", novoQrSequencial);

`+s.slice(b);}
module.exports={corrigir};
if(require.main===module){const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),alvo=path.join(root,'src/routes/canais.js'),original=fs.readFileSync(alvo,'utf8'),codigo=corrigir(original),aux=path.join(root,'src/services/webjs-novo-qr.js'),helper=fs.readFileSync(path.join(__dirname,'novo-qr.js'),'utf8');for(const s of [codigo,helper]){const c=spawnSync(process.execPath,['--check'],{input:s,encoding:'utf8'});if(c.status)throw Error(c.stderr)}if(process.argv.includes('--check')){console.log('QR_SEQUENCIAL_CHECK_OK');process.exit(0)}const backup=path.join(root,'backups','qr-sequencial-'+Date.now());fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'canais.js'),original);const anterior=fs.existsSync(aux)?fs.readFileSync(aux):null;if(anterior)fs.writeFileSync(path.join(backup,'webjs-novo-qr.js'),anterior);try{fs.writeFileSync(aux,helper);fs.writeFileSync(alvo,codigo)}catch(e){fs.writeFileSync(alvo,original);if(anterior)fs.writeFileSync(aux,anterior);else if(fs.existsSync(aux))fs.unlinkSync(aux);throw e}console.log('QR_SEQUENCIAL_INSTALADO; backup: '+backup);}
