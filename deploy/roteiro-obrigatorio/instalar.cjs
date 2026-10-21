const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),base=path.dirname(__dirname),alvo=path.join(root,'src/routes/fluxos.js');
const executar=(args,env=process.env)=>{const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status!==0)throw Error('Verificação falhou: '+args.join(' '));};
executar(['--test',path.join(base,'nio-oferta/oferta.test.cjs'),path.join(base,'vero/oferta.test.cjs'),path.join(__dirname,'test.cjs'),path.join(base,'bloqueio-terminal/test.cjs'),path.join(base,'comprovante-direto/test.cjs'),path.join(base,'datas-flexiveis/test.cjs'),path.join(base,'dados-contextuais/test.cjs'),path.join(base,'venda-fluida/test.cjs')],{...process.env,WOLF_BACKEND_DIR:root});
const original=fs.readFileSync(alvo,'utf8');let codigo=original;
for(const patch of ['vero/oferta-patch.cjs','nio-oferta/oferta-patch.cjs','roteiro-obrigatorio/patch.cjs'])codigo=require(path.join(base,patch)).corrigir(codigo);
codigo=require(path.join(base,'datas-flexiveis/patch.cjs')).fluxos(codigo);
codigo=require(path.join(base,'dados-contextuais/patch.cjs')).corrigir(codigo);
const terminal=require(path.join(base,'bloqueio-terminal/patch.cjs'));
const arquivos=[['src/routes/fluxos.js',codigo],['src/services/nio-oferta-direta.js',fs.readFileSync(path.join(base,'nio-oferta/oferta-direta.js'),'utf8')],['src/services/vero-oferta-direta.js',fs.readFileSync(path.join(base,'vero/oferta-direta.js'),'utf8')],['src/services/roteiro-obrigatorio.js',fs.readFileSync(path.join(__dirname,'guard.js'),'utf8')],['index.js',terminal.index(fs.readFileSync(path.join(root,'index.js'),'utf8'))],['src/services/mensagens.js',terminal.mensagens(fs.readFileSync(path.join(root,'src/services/mensagens.js'),'utf8'))],['src/services/bloqueio-terminal.js',fs.readFileSync(path.join(base,'bloqueio-terminal/service.js'),'utf8')]];
arquivos.push(['src/services/fluxo-ia-multimidia-bridge.js',require(path.join(base,'comprovante-direto/patch.cjs')).bridge(fs.readFileSync(path.join(root,'src/services/fluxo-ia-multimidia-bridge.js'),'utf8'))],['src/services/comprovante-direto.js',fs.readFileSync(path.join(base,'comprovante-direto/service.cjs'),'utf8')]);
arquivos.push(['src/services/fluxo-ia-captura-deterministica.js',require(path.join(base,'datas-flexiveis/patch.cjs')).captura(fs.readFileSync(path.join(root,'src/services/fluxo-ia-captura-deterministica.js'),'utf8'))],['src/services/datas-flexiveis.js',fs.readFileSync(path.join(base,'datas-flexiveis/service.cjs'),'utf8')]);
arquivos.push(['src/services/dados-contextuais.js',fs.readFileSync(path.join(base,'dados-contextuais/service.cjs'),'utf8')]);
const fluido=require(path.join(base,'venda-fluida/patch.cjs'));
for(const a of arquivos)if(a[0]==='src/services/fluxo-ia-captura-deterministica.js')a[1]=fluido.captura(a[1]);
for(const a of arquivos){if(a[0]==='src/routes/fluxos.js')a[1]=fluido.fluxos(a[1]);if(a[0]==='index.js')a[1]=fluido.index(a[1]);if(a[0]==='src/services/fluxo-ia-multimidia-bridge.js')a[1]=fluido.bridge(a[1]);if(a[0]==='src/services/nio-oferta-direta.js')a[1]=fluido.oferta(a[1],'decidirOfertaNio');if(a[0]==='src/services/vero-oferta-direta.js')a[1]=fluido.oferta(a[1],'decidirOfertaVero');}
arquivos.push(['src/services/venda-fluida-regras.js',fs.readFileSync(path.join(base,'venda-fluida/regras.js'),'utf8')],['src/services/venda-fluida.js',fs.readFileSync(path.join(base,'venda-fluida/service.js'),'utf8')]);
for(const nome of ['bko-ia.js','bko-vero-core.js'])arquivos.push(['src/services/'+nome,fluido.bko(fs.readFileSync(path.join(root,'src/services',nome),'utf8'))]);
for(const[,texto]of arquivos){const r=spawnSync(process.execPath,['--check'],{input:texto,encoding:'utf8'});if(r.status)throw Error(r.stderr);}
if(process.argv.includes('--check')){console.log('ROTEIRO_CHECK_OK: Nio, Vero, confirmação e bloqueio terminal; nenhuma alteração feita.');process.exit(0);}
const backup=path.join(root,'backups','roteiro-obrigatorio-'+Date.now()),anteriores=[];fs.mkdirSync(backup,{recursive:true});
for(const[rel]of arquivos){const p=path.join(root,rel),conteudo=fs.existsSync(p)?fs.readFileSync(p):null;anteriores.push([p,conteudo]);if(conteudo){const b=path.join(backup,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,conteudo);}}
try{for(const[rel,conteudo]of arquivos)fs.writeFileSync(path.join(root,rel),conteudo);}catch(e){for(const[p,antes]of anteriores){if(antes)fs.writeFileSync(p,antes);else if(fs.existsSync(p))fs.unlinkSync(p);}throw e;}
console.log('ROTEIRO_INSTALADO; backup: '+backup);
const restart=spawnSync('pm2',['restart','wolf-whatsapp'],{stdio:'inherit'});if(restart.status!==0)throw Error('Arquivos instalados; reinício do PM2 não confirmado.');
console.log('ROTEIRO_REINICIADO: valide uma conversa de cada operador.');
executar([path.join(base,'venda-fluida/ativar.cjs'),root]);
