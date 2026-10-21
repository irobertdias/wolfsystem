const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),patch=require('./patch.cjs');
const teste=spawnSync(process.execPath,['--test',path.join(__dirname,'test.cjs')],{stdio:'inherit',env:{...process.env,WOLF_BACKEND_DIR:root}});if(teste.status)throw Error('Testes falharam; nada instalado');
const arquivos=[['index.js',patch.index(fs.readFileSync(path.join(root,'index.js'),'utf8'))],['src/services/mensagens.js',patch.mensagens(fs.readFileSync(path.join(root,'src/services/mensagens.js'),'utf8'))],['src/services/bloqueio-terminal.js',fs.readFileSync(path.join(__dirname,'service.js'),'utf8')]];
for(const[,codigo]of arquivos){const r=spawnSync(process.execPath,['--check'],{input:codigo,encoding:'utf8'});if(r.status)throw Error(r.stderr);}
if(process.argv.includes('--check')){console.log('BLOQUEIO_TERMINAL_CHECK_OK; nenhuma alteração feita');process.exit(0);}
const backup=path.join(root,'backups','bloqueio-terminal-'+Date.now()),antes=[];fs.mkdirSync(backup,{recursive:true});
for(const[rel]of arquivos){const p=path.join(root,rel),a=fs.existsSync(p)?fs.readFileSync(p):null;antes.push([p,a]);if(a){const b=path.join(backup,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,a);}}
try{for(const[rel,codigo]of arquivos)fs.writeFileSync(path.join(root,rel),codigo);}catch(e){for(const[p,a]of antes){if(a)fs.writeFileSync(p,a);else if(fs.existsSync(p))fs.unlinkSync(p);}throw e;}
console.log('BLOQUEIO_TERMINAL_INSTALADO; backup: '+backup);
const r=spawnSync('pm2',['restart','wolf-whatsapp'],{stdio:'inherit'});if(r.status!==0)throw Error('Arquivos instalados; reinício não confirmado');
