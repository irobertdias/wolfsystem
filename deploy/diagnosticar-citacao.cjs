'use strict';
// Diagnóstico da mensagem selecionada: não abre navegador, não reinicia
// processos, não grava no banco e não envia mensagens à cliente.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),id=Number(process.argv[3]||503829);
const carregar=n=>require(require.resolve(n,{paths:[root]}));
carregar('dotenv').config({path:path.join(root,'.env'),quiet:true});
const{createClient}=carregar('@supabase/supabase-js');
const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY);
const saida=(etapa,dados)=>console.log(JSON.stringify({etapa,...dados}));
async function tentar(etapa,fn){let timer;try{const resultado=await Promise.race([Promise.resolve().then(fn),new Promise((_,r)=>{timer=setTimeout(()=>r(Error('Prazo de 8 segundos excedido')),8000);})]);saida(etapa,{resultado});return resultado;}catch(e){saida(etapa,{erro:String(e.message||e)});return null;}finally{clearTimeout(timer);}}
const resumir=m=>m?{id:m.id?._serialized,fromMe:m.fromMe,tipo:m.type,timestamp:m.timestamp,hasMedia:m.hasMedia}:null;
(async()=>{
 if(!Number.isSafeInteger(id)||id<=0)throw Error('ID de mensagem inválido');
 const{data:m,error}=await db.from('mensagens').select('id,workspace_id,canal_id,numero,provider_message_id,created_at').eq('id',id).eq('workspace_id','abcfinan').eq('canal_id',154).single();if(error)throw error;
 const{data:c,error:ec}=await db.from('conexoes').select('id,workspace_id,tipo,numero,status').eq('id',m.canal_id).eq('workspace_id',m.workspace_id).single();if(ec)throw ec;if(c.tipo!=='webjs')throw Error('Canal não é WhatsApp Web');
 const modulo=path.join(root,'src/services/mensagem-resposta.js'),fonte=fs.readFileSync(modulo,'utf8');
 saida('BANCO',{mensagem:m,canal:c,helperV6:fonte.includes('citacaoRecuperacaoV6'),recuperadorExiste:fs.existsSync(path.join(root,'src/services/citacao-recuperacao.js'))});
 const provider=String(m.provider_message_id||'').replace(/^webjs:\d+:/,''),key=/^(?:true|false)_(\d+@(?:lid|c\.us))_([^_]+)(?:_.*)?$/.exec(provider);if(!key)throw Error('ID do provedor não reconhecido');
 const arquivo=path.join(root,'.wwebjs_auth','session-canal_'+m.canal_id,'DevToolsActivePort'),[porta,ws]=fs.readFileSync(arquivo,'utf8').trim().split(/\r?\n/);if(!/^\d+$/.test(porta)||Number(porta)>65535||!/^\/devtools\/browser\/[\w-]+$/.test(ws))throw Error('Porta de depuração inválida');
 let pp;try{pp=carregar('puppeteer-core');}catch{pp=carregar('puppeteer');}
 const browser=await pp.connect({browserWSEndpoint:`ws://127.0.0.1:${porta}${ws}`,protocolTimeout:10000});
 try{
  const pages=(await browser.pages()).filter(p=>{try{return new URL(p.url()).hostname==='web.whatsapp.com';}catch{return false;}});saida('NAVEGADOR',{paginas:pages.length,versao:await browser.version()});
  for(const page of pages){
   const{Client}=carregar('whatsapp-web.js'),client=new Client();client.pupPage=page;client.pupBrowser=browser;client.sendMessage=()=>{throw Error('Envio desativado no diagnóstico');};
   await tentar('CACHE',()=>page.evaluate(stanza=>{const store=window.require('WAWebCollections'),prefs=window.require('WAWebUserPrefsMeUser');let estado;try{estado=window.require('WAWebSocketModel').Socket.state;}catch{}return{socket:estado,conta:prefs.getMaybeMePnUser?.()?._serialized,leitor:typeof window.WWebJS?.getChat,mensagensMesmaChave:store.Msg.getModelsArray().filter(x=>x.id?.id===stanza).map(x=>({id:x.id?._serialized,tipo:x.type,fromMe:x.id?.fromMe}))};},key[2]));
   const remotos=new Set([key[1],String(m.numero).replace(/\D/g,'')+'@c.us']);
   for(const jid of [...remotos]){const mapa=await tentar('MAPA_'+jid,()=>client.getContactLidAndPhone([jid]));for(const item of mapa||[])for(const alias of[item.pn,item.lid])if(/^\d+@(lid|c\.us)$/.test(alias||''))remotos.add(alias);}
   for(const jid of remotos){const candidato=provider.replace(key[1],jid);await tentar('MENSAGEM_'+jid,async()=>resumir(await client.getMessageById(candidato)));}
   for(const jid of [...remotos].slice(0,3))await tentar('HISTORICO_'+jid,async()=>{const chat=await client.getChatById(jid);if(!chat)return{chat:false};const lista=await chat.fetchMessages({limit:100});return{chat:chat.id?._serialized,total:lista.length,alvo:lista.filter(x=>x.id?.id===key[2]).map(resumir),primeira:lista[0]?.timestamp,ultima:lista.at(-1)?.timestamp};});
   await tentar('RECUPERADOR_INSTALADO',async()=>{const helper=require(modulo);return helper.recuperarMensagemCitacao(client,String(m.numero).replace(/\D/g,''),provider,key[1],false,Date.now()+7000);});
  }
 }finally{await browser.disconnect();}
})().catch(e=>{console.error(JSON.stringify({erro:String(e.message||e)}));process.exitCode=1});
