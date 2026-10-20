// Somente leitura do canal 154 e login temporário sem pareamento; não envia mensagens.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const raiz='/root/wolf-whatsapp';
const pp=require(require.resolve('puppeteer',{paths:[path.dirname(require.resolve('whatsapp-web.js',{paths:[raiz]}))]}));
const {Client,LocalAuth}=require(require.resolve('whatsapp-web.js',{paths:[raiz]}));
async function estadoPagina(page){
 return page.evaluate(()=>{let socket=null;try{socket=window.require?.('WAWebSocketModel')?.Socket?.state||null}catch{}
  return{url:location.origin+location.pathname,documento:document.readyState,versao:window.Debug?.VERSION||null,socket,temQR:!!document.querySelector('[data-ref] canvas'),temCanvas:!!document.querySelector('canvas'),leitorBiblioteca:!!window.AuthStore};
 });
}
(async()=>{
 const f=path.join(raiz,'.wwebjs_auth/session-canal_154/DevToolsActivePort');let conectado;
 if(fs.existsSync(f))try{
  const [porta,ws]=fs.readFileSync(f,'utf8').trim().split(/\r?\n/);
  if(!/^\d+$/.test(porta)||!ws.startsWith('/devtools/browser/'))throw Error('DevTools inválido');
  conectado=await pp.connect({browserWSEndpoint:'ws://127.0.0.1:'+porta+ws,protocolTimeout:10000});
  for(const p of await conectado.pages())if(p.url().includes('web.whatsapp.com'))console.log('CANAL_154',JSON.stringify(await estadoPagina(p)));
 }catch(e){console.log('CANAL_154_INSPECAO',e.message)}finally{conectado?.disconnect()}
 else console.log('CANAL_154: não existe porta de depuração no perfil esperado.');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'wolf-qr-isolado-'));
 const native=path.join(raiz,'src/shared/webjs-browser.cjs');if(!fs.existsSync(native))throw Error('Pacote Chrome nativo não está instalado');
 const client=new Client({authStrategy:new LocalAuth({clientId:'teste',dataPath:tmp}),authTimeoutMs:45000,puppeteer:{executablePath:require(native).selecionar(),headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],timeout:30000,protocolTimeout:60000},webVersionCache:{type:'none'}});
 let timer;
 try{
  const qr=new Promise((resolve,reject)=>{client.once('qr',()=>resolve('QR_TEMPORARIO_GERADO'));client.once('auth_failure',()=>reject(Error('auth_failure no perfil temporário')));timer=setTimeout(()=>reject(Error('Nenhum QR em 60 segundos')),60000)});
  client.initialize().catch(e=>console.log('INICIALIZACAO_ISOLADA',String(e?.message||e)));
  try{console.log(await qr)}catch(e){console.log('TESTE_ISOLADO',e.message);if(client.pupPage)console.log('PAGINA_ISOLADA',JSON.stringify(await estadoPagina(client.pupPage)))}
 }finally{
  clearTimeout(timer);const proc=client.pupBrowser?.process?.();
  let prazo;try{await Promise.race([client.destroy(),new Promise((_,reject)=>{prazo=setTimeout(()=>reject(Error('fechamento demorou')),5000)})])}catch{if(proc?.exitCode===null)proc.kill('SIGKILL')}finally{clearTimeout(prazo)}
  if(path.dirname(tmp)===path.resolve(os.tmpdir())&&path.basename(tmp).startsWith('wolf-qr-isolado-'))fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(e=>{console.error('DIAGNOSTICO',e.message);process.exitCode=1});
