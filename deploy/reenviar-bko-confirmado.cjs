'use strict';
const fs=require('node:fs'),path=require('node:path');
async function enviarConfirmado(client,jid,conteudo,opcoes={},tempo=30000){
 let timer;let msg;
 try{msg=await Promise.race([client.sendMessage(jid,conteudo,{...opcoes,sendSeen:false,waitUntilMsgSent:true}),new Promise((_,rejeitar)=>{timer=setTimeout(()=>rejeitar(Error('WhatsApp não retornou o resultado; envio incerto, não repetido')),45000);})]);}finally{clearTimeout(timer);}
 const id=msg?.id?._serialized;if(!id)throw Error('WhatsApp retornou sem recibo; envio incerto');
 const fim=Date.now()+tempo;
 while(msg.ack==null||Number(msg.ack)===0){
  if(Date.now()>=fim)throw Error('WhatsApp manteve ACK pendente: '+id);
  await new Promise(r=>setTimeout(r,500));msg=await client.getMessageById(id)||msg;
 }
 if(Number(msg.ack)<1)throw Error('WhatsApp recusou a mensagem: ACK '+msg.ack+'; recibo '+id);
 return{id,ack:Number(msg.ack)};
}
async function executar(){
 const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp');
 require(require.resolve('dotenv',{paths:[root]})).config({path:path.join(root,'.env'),quiet:true});
 const{createClient}=require(require.resolve('@supabase/supabase-js',{paths:[root]}));
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
 let{data:v,error}=await db.from('proposta').select('*').eq('workspace_id','grupoprime').eq('id',534).single();if(error)throw error;
 const c=v.dados_customizados,meta=typeof c.bko_envio==='string'?JSON.parse(c.bko_envio):c.bko_envio;
 const destino=c.bko_responsavel;
 if(v.fluxo_id!==27||v.canal_id!==158||v.status_venda!=='AGUARDANDO AUDITORIA'||meta.canal_id!==161||destino!=='5562981072373'||Object.keys(meta.destinatarios||{}).length!==1||!meta.destinatarios[destino])throw Error('Venda ou regra mudou; nada enviado');
 if(new Date(meta.lease||0)>new Date())throw Error('Outro envio está em execução');
 if(c.bko_reenvio_direto?.concluido)throw Error('Reenvio direto já concluído; não repetido');
 const lib=require.resolve('whatsapp-web.js',{paths:[root]}),{Client,MessageMedia}=require(lib),pp=require(require.resolve('puppeteer',{paths:[path.dirname(lib)]}));
 const[porta,ws]=fs.readFileSync(path.join(root,'.wwebjs_auth','session-canal_161','DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
 if(!/^\d+$/.test(porta)||Number(porta)>65535||!/^\/devtools\/browser\/[\w-]+$/.test(ws))throw Error('Porta inválida');
 let browser,custom={...c},reservado=false;
 async function salvar(){const r=await db.from('proposta').update({dados_customizados:custom,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',v.id).eq('status_venda','AGUARDANDO AUDITORIA').eq('updated_at',v.updated_at).select('*').maybeSingle();if(r.error||!r.data)throw Error(r.error?.message||'Venda alterada em paralelo; envio interrompido');v=r.data;}
 try{
  browser=await pp.connect({browserWSEndpoint:`ws://127.0.0.1:${porta}${ws}`,protocolTimeout:45000});
  const page=(await browser.pages()).find(p=>new URL(p.url()).hostname==='web.whatsapp.com');if(!page)throw Error('Página WhatsApp ausente');
  const client=new Client({});client.pupPage=page;client.pupBrowser=browser;
  if(await client.getState()!=='CONNECTED')throw Error('WhatsApp ainda não conectou');
  const mapa=(await client.getContactLidAndPhone(['17296269565981@lid']))[0];
  if(mapa?.pn!=='556281072373@c.us'||mapa?.lid!=='17296269565981@lid')throw Error('Identidade do destinatário não corresponde ao diagnóstico; nada enviado');
  const jid=mapa.pn;
  const api=require(path.join(root,'src/services/bko-ia.js'))._test;
  const docs=api.documentosVenda(v),resumo=api.resumoVenda(v,meta.referencia);
  const partes=[{tipo:'texto'},...docs.map(d=>({tipo:d.tipo,doc:d}))];
  custom.bko_reenvio_direto={em:new Date().toISOString(),destino_canonico:jid,anteriores:JSON.parse(JSON.stringify(meta.destinatarios[destino].partes)),concluido:false};
  meta.destinatarios[destino].partes=partes.map(p=>({tipo:p.tipo,estado:'pendente'}));meta.destinatarios[destino].concluido=false;
  meta.lease=new Date(Date.now()+20*60000).toISOString();custom.bko_envio=JSON.stringify(meta);custom.bko_pendente='SIM';await salvar();reservado=true;
  for(const p of partes){
   let conteudo=resumo,opts={};
   if(p.doc){const{data,error}=await db.storage.from('documentos-clientes').download(p.doc.path);if(error||!data||!data.size||data.size>15*1024*1024)throw Error('Arquivo privado indisponível: '+p.tipo);if(!/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(data.type))throw Error('Formato não permitido');conteudo=new MessageMedia(data.type,Buffer.from(await data.arrayBuffer()).toString('base64'),p.doc.nome);opts={caption:p.tipo.replace(/_/g,' ')+' · #'+meta.referencia,sendMediaAsDocument:true};}
   const parte=meta.destinatarios[destino].partes.find(x=>x.tipo===p.tipo);parte.estado='em_envio';custom.bko_envio=JSON.stringify(meta);await salvar();
   const recibo=await enviarConfirmado(client,jid,conteudo,opts);parte.id=recibo.id;parte.ack=recibo.ack;parte.estado='enviado';custom.bko_reply_ids=[...new Set([...(custom.bko_reply_ids||[]),recibo.id])];custom.bko_envio=JSON.stringify(meta);await salvar();console.log(p.tipo+': ACK '+recibo.ack+' confirmado; '+recibo.id);
  }
  meta.lease=null;meta.destinatarios[destino].concluido=true;custom.bko_envio=JSON.stringify(meta);custom.bko_reenvio_direto.concluido=true;custom.bko_pendente='ENVIADO';custom.bko_erro='';await salvar();
  console.log('REENVIO_534_CONFIRMADO_PELO_SERVIDOR: resumo e três anexos; ACK 1 significa aceito pelo servidor, ACK 2 entrega, ACK 3 leitura.');
 }catch(e){
  if(reservado){meta.lease=null;custom.bko_envio=JSON.stringify(meta);custom.bko_pendente='REVISAR';custom.bko_erro='Reenvio direto não concluído: '+String(e.message).slice(0,600);try{await salvar();}catch{}}
  throw e;
 }finally{browser?.disconnect();}
}
module.exports={enviarConfirmado};if(require.main===module)executar().catch(e=>{console.error(e.message);process.exitCode=1});
