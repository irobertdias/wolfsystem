'use strict';
const fs=require('node:fs'),path=require('node:path');
async function verificar(root){
 const carregar=n=>require(require.resolve(n,{paths:[root]}));carregar('dotenv').config({path:path.join(root,'.env'),quiet:true});
 const{createClient}=carregar('@supabase/supabase-js'),db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY);
 const{data:m,error}=await db.from('mensagens').select('id,workspace_id,canal_id,numero,provider_message_id').eq('id',503829).eq('workspace_id','abcfinan').eq('canal_id',154).single();if(error)throw error;
 const provider=String(m.provider_message_id).replace(/^webjs:154:/,''),jid=/^(?:true|false)_([^_]+)_/.exec(provider)?.[1];if(!jid)throw Error('ID de mensagem inválido');
 const [porta,ws]=fs.readFileSync(path.join(root,'.wwebjs_auth/session-canal_154/DevToolsActivePort'),'utf8').trim().split(/\r?\n/);if(!/^\d+$/.test(porta)||Number(porta)>65535||!/^\/devtools\/browser\/[\w-]+$/.test(ws))throw Error('Porta de depuração inválida');
 let pp;try{pp=carregar('puppeteer-core');}catch{pp=carregar('puppeteer');}const browser=await pp.connect({browserWSEndpoint:`ws://127.0.0.1:${porta}${ws}`,protocolTimeout:18000});
 try{
  const pages=(await browser.pages()).filter(p=>{try{return new URL(p.url()).hostname==='web.whatsapp.com';}catch{return false;}});if(pages.length!==1)throw Error('Não há uma única página do WhatsApp no perfil 154');
  const page=pages[0],{Client}=carregar('whatsapp-web.js'),client=new Client();client.pupPage=page;client.pupBrowser=browser;client.sendMessage=()=>{throw Error('Envio desativado na pré-verificação');};
  const remotos=new Set([jid,String(m.numero).replace(/\D/g,'')+'@c.us']);for(const r of [...remotos])try{for(const x of await client.getContactLidAndPhone([r]))for(const a of[x.pn,x.lid])if(/^\d+@(lid|c\.us)$/.test(a||''))remotos.add(a);}catch{}
  const r=await require('./citacao-store')(client,[...remotos],provider,12000);if(!r?.encontrada)throw Error('FOTO_NAO_RECUPERADA '+JSON.stringify(r));
  const citavel=await page.evaluate(({id,destino})=>{const c=window.require('WAWebCollections'),msg=c.Msg.get(id),wid=window.require('WAWebWidFactory').createWid(destino),chat=c.Chat.get(wid)||c.Chat.get(destino);if(!msg||!chat)return{disponivel:false};const reply=window.require('WAWebMsgReply'),pode=reply?reply.canReplyMsg(msg.unsafe()):msg.canReply();if(!pode)return{disponivel:true,citavel:false};const contexto=msg.msgContextInfo(chat);return{disponivel:true,citavel:true,camposContexto:Object.keys(contexto||{})};},r.encontrada);
  if(citavel.citavel!==true)throw Error('FOTO_NAO_CITAVEL '+JSON.stringify(citavel));
  return{mensagem:m.id,workspace:m.workspace_id,canal:m.canal_id,chave:r.encontrada.id,citavel:true};
 }finally{await browser.disconnect();}
}
module.exports=verificar;if(require.main===module)verificar(path.resolve(process.argv[2]||'/root/wolf-whatsapp')).then(r=>console.log('FOTO_RECUPERADA '+JSON.stringify(r))).catch(e=>{console.error(String(e.stack||e));process.exitCode=1;});
