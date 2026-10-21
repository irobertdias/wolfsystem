'use strict';
// Somente leitura: não envia mensagens, não reinicia Chrome e não altera a venda.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
async function executar(){
 require(require.resolve('dotenv',{paths:[root]})).config({path:path.join(root,'.env'),quiet:true});
 const{createClient}=require(require.resolve('@supabase/supabase-js',{paths:[root]}));
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:v,error}=await db.from('proposta').select('id,canal_id,fluxo_id,dados_customizados').eq('workspace_id','grupoprime').eq('id',534).single();if(error)throw error;
 if(v.canal_id!==158||v.fluxo_id!==27)throw Error('Venda fora do escopo');
 const c=v.dados_customizados,m=typeof c.bko_envio==='string'?JSON.parse(c.bko_envio):c.bko_envio;
 if(m.canal_id!==161||c.bko_responsavel!=='5562981072373')throw Error('Rota mudou');
 const ids=[...new Set([...Object.values(m.destinatarios||{}).flatMap(d=>d.partes.map(p=>p.id)).filter(Boolean),c.__reenvio_whatsapp_20261021?.resumo_id].filter(Boolean))];
 const[porta,ws]=fs.readFileSync(path.join(root,'.wwebjs_auth','session-canal_161','DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
 if(!/^\d+$/.test(porta)||Number(porta)>65535||!/^\/devtools\/browser\/[\w-]+$/.test(ws))throw Error('Porta inválida');
 const lib=require.resolve('whatsapp-web.js',{paths:[root]}),pp=require(require.resolve('puppeteer',{paths:[path.dirname(lib)]}));let browser;
 try{
  browser=await pp.connect({browserWSEndpoint:`ws://127.0.0.1:${porta}${ws}`,protocolTimeout:20000});
  const page=(await browser.pages()).find(p=>new URL(p.url()).hostname==='web.whatsapp.com');if(!page)throw Error('WhatsApp não abriu');
  const resultado=await page.evaluate(async({ids,destino})=>{
   const r={socket:window.require('WAWebSocketModel').Socket.state,destino,identificadores:[],recibos:[]};
   const remotos=[...new Set(ids.map(id=>id.match(/^true_([^_]+)_/)?.[1]).filter(Boolean))];
   for(const remoto of [destino+'@c.us',...remotos])try{
    const x=await window.WWebJS.enforceLidAndPnRetrieval(remoto);
    r.identificadores.push({consultado:remoto,telefone:x.phone?._serialized,lid:x.lid?._serialized});
   }catch(e){r.identificadores.push({consultado:remoto,erro:String(e.message).slice(0,180)});}
   const colecao=window.require('WAWebCollections').Msg;
   for(const id of ids)try{
    let msg=colecao.get(id);
    if(!msg){const encontrados=await colecao.getMessagesById([id]);msg=encontrados?.messages?.[0];}
    r.recibos.push({id,encontrado:!!msg,ack:msg?.ack,tipo:msg?.type,erro:msg?.errorCode||msg?.sendError||null});
   }catch(e){r.recibos.push({id,erro:String(e.message).slice(0,180)});}
   return r;
  },{ids,destino:c.bko_responsavel});
  console.log(JSON.stringify(resultado,null,2));
 }finally{browser?.disconnect();}
}
if(require.main===module)executar().catch(e=>{console.error(e.message);process.exitCode=1});
