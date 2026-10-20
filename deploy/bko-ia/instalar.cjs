// Executar na VPS: node instalar.cjs /root/wolf-whatsapp
// --check valida todos os encaixes sem alterar o servidor.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const raiz=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),check=process.argv.includes('--check');
function encaixar(texto,marca,antes,depois){if(texto.includes(marca))return texto;const partes=texto.split(antes);if(partes.length!==2)throw Error('Encaixe incompatível: '+marca);return partes.join(depois);}
const arquivos=['index.js','src/config/http.js','src/services/webjs-manager.js','src/routes/webhook.js'];
const plano=new Map(arquivos.map(f=>[f,fs.readFileSync(path.join(raiz,f),'utf8')]));
plano.set('index.js',encaixar(plano.get('index.js'),'require("./src/services/bko-ia.js")','require("./src/services/waba-client.js")(ctx);','require("./src/services/waba-client.js")(ctx);\nrequire("./src/services/bko-ia.js")(ctx);'));
plano.set('src/config/http.js',encaixar(plano.get('src/config/http.js'),'rawBodyBko','app.use(express.json({ limit: "50mb" }));',`// rawBodyBko: assinatura Meta deve usar os bytes exatos recebidos.
app.use(express.json({ limit: "50mb", verify(req,_res,buf) { if (String(req.originalUrl||'').split('?')[0] === '/webhook/meta') req.rawBody = buf; } }));`));
plano.set('src/services/webjs-manager.js',encaixar(plano.get('src/services/webjs-manager.js'),'// retornoBkoWebjs','    const numeroReal = numeroLimpo;',`    const numeroReal = numeroLimpo;
    // retornoBkoWebjs: interceptar antes de criar atendimento ou executar o vendedor.
    if (typeof ctx.tratarRetornoBko === 'function') {
      let quotedId = null;
      if (msg.hasQuotedMsg) { try { quotedId = (await msg.getQuotedMessage())?.id?._serialized || null; } catch (_) {} }
      if (await ctx.tratarRetornoBko({ workspaceId, canalId, numero: numeroReal, mensagem: msg.body || '', messageId: msg.id?._serialized, quotedId, verificado: true })) return;
    }`));
const ancora='          const nomeContato = contato?.profile?.name || `+${numeroRaw}`;';
plano.set('src/routes/webhook.js',encaixar(plano.get('src/routes/webhook.js'),'// retornoBkoWaba',ancora,ancora+`
          // retornoBkoWaba: remetente só é confiável após verificar a assinatura Meta.
          if (typeof ctx.tratarRetornoBko === 'function' && await ctx.tratarRetornoBko({ workspaceId, canalId, numero: numeroRaw, mensagem: msg.text?.body || '', messageId: msg.id, quotedId: msg.context?.id || null, verificado: ctx.assinaturaBkoValida(req) && String(value.metadata?.phone_number_id || '') === String(canal.phone_number_id || '') })) continue;
`));
for(const f of ['src/services/bko-ia.js','src/services/bko-ia-regras.js'])plano.set(f,fs.readFileSync(path.join(__dirname,f),'utf8'));
for(const [f,codigo]of plano){const r=spawnSync(process.execPath,['--check'],{input:codigo,encoding:'utf8'});if(r.status!==0)throw Error(f+': '+r.stderr);}
if(check){console.log('BKO_CHECK_OK: '+plano.size+' arquivos validados; nenhuma alteração feita.');process.exit(0);}
const backup=path.join(raiz,'backups','bko-ia-'+new Date().toISOString().replace(/[:.]/g,'-'));
for(const [f]of plano){const alvo=path.join(raiz,f);if(fs.existsSync(alvo)){const b=path.join(backup,f);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(alvo,b);}}
for(const [f,codigo]of plano)fs.writeFileSync(path.join(raiz,f),codigo);
console.log('Código instalado; backup: '+backup);
console.log('Reinicie quando concluir a instalação: pm2 restart wolf-whatsapp');
console.log('A configuração BKO e o vendedor permanecem no estado atual; a instalação não os ativa.');
