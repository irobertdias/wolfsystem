'use strict';
// Confere recibos existentes. Nunca envia ou marca como entregue sem evidência do WhatsApp.
const fs=require('node:fs'),path=require('node:path');
function reconciliar(meta,recibos){
 const novo=JSON.parse(JSON.stringify(meta));let alterados=0;
 for(const dest of Object.values(novo.destinatarios||{}))for(const parte of dest.partes||[]){
  if(parte.estado!=='em_envio')continue;
  const encontrados=recibos.filter(r=>r.tipo===parte.tipo&&r.confirmado&&typeof r.id==='string');
  if(encontrados.length!==1)continue;
  parte.estado='enviado';parte.id=encontrados[0].id;alterados++;
 }
 return{meta:novo,alterados};
}
async function executar(){
 const root=path.resolve(process.argv[2]||'/root/wolf-whatsapp'),id=Number(process.argv[3]||534);
 if(id!==534)throw Error('Esta conferência é específica da venda 534.');
 require(require.resolve('dotenv',{paths:[root]})).config({path:path.join(root,'.env'),quiet:true});
 const{createClient}=require(require.resolve('@supabase/supabase-js',{paths:[root]}));
 const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY);
 const{data:v,error}=await db.from('proposta').select('*').eq('workspace_id','grupoprime').eq('fluxo_id',27).eq('id',id).single();if(error)throw error;
 const c=v.dados_customizados||{},meta=typeof c.bko_envio==='string'?JSON.parse(c.bko_envio):c.bko_envio;
 if(v.canal_id!==158||v.status_venda!=='AGUARDANDO AUDITORIA'||meta?.canal_id!==161||Object.keys(meta.destinatarios||{}).length!==1)throw Error('Venda ou rota mudou; nada alterado.');
 if(new Date(meta.lease||0)>new Date())throw Error('Envio ainda em execução; aguarde.');
 const destino=Object.keys(meta.destinatarios)[0];if(!destino.endsWith('2373'))throw Error('Destino não corresponde ao Nio.');
 const texto=meta.destinatarios[destino].partes.find(p=>p.tipo==='texto'&&p.estado==='enviado');
 const remoto=String(texto?.id||'').match(/^true_([^_]+)_/)?.[1];if(!remoto)throw Error('Resumo sem recibo; nada alterado.');
 const porta=fs.readFileSync(path.join(root,'.wwebjs_auth','session-canal_161','DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
 if(!/^\d+$/.test(porta[0])||!/^\/devtools\/browser\/[\w-]+$/.test(porta[1]))throw Error('Porta inválida');
 const lib=require.resolve('whatsapp-web.js',{paths:[root]}),pp=require(require.resolve('puppeteer',{paths:[path.dirname(lib)]}));let browser;
 try{
  browser=await pp.connect({browserWSEndpoint:`ws://127.0.0.1:${porta[0]}${porta[1]}`,protocolTimeout:15000});
  const page=(await browser.pages()).find(p=>new URL(p.url()).hostname==='web.whatsapp.com');if(!page)throw Error('Página WhatsApp ausente');
  const recibos=await page.evaluate(({remoto,ref})=>{
   const colecao=window.require('WAWebCollections').Msg;
   return colecao.getModelsArray().flatMap(m=>{
    const jid=m.id?.remote?._serialized||m.id?.remote,id=m.id?._serialized;
    if(!m.id?.fromMe||jid!==remoto||!id||!(Number(m.ack)>=1))return[];
    const legenda=String(m.caption||m.body||'');
    const tipo=['rg_frente','rg_verso','comprovante_endereco'].find(t=>legenda===`${t.replace(/_/g,' ')} · #${ref}`);
    return tipo&&(m.hasMedia||['document','image'].includes(m.type))?[{tipo,id,confirmado:true}]:[];
   });
  },{remoto,ref:meta.referencia});
  const r=reconciliar(meta,recibos);
  if(!r.alterados){console.log('SEM_RECIBO_COMPROVADO: não houve reenvio. Confira o RG frente no WhatsApp do BKO; a ausência no cache não comprova falha de entrega.');return;}
  const incertos=Object.values(r.meta.destinatarios).some(d=>d.partes.some(p=>p.estado==='em_envio'));
  const custom={...c,bko_envio:JSON.stringify(r.meta),bko_reply_ids:[...new Set([...(c.bko_reply_ids||[]),...recibos.map(r=>r.id)])],bko_pendente:incertos?'REVISAR':'SIM',bko_erro:incertos?c.bko_erro:'',bko_tentar_em:new Date().toISOString()};
  const u=await db.from('proposta').update({dados_customizados:custom,updated_at:new Date().toISOString()}).eq('workspace_id','grupoprime').eq('id',v.id).eq('updated_at',v.updated_at).select('id').maybeSingle();if(u.error||!u.data)throw Error(u.error?.message||'Venda mudou; nada sobrescrito.');
  console.log('RECIBO_RECUPERADO: '+r.alterados+' anexo(s) confirmado(s). O BKO pode continuar somente as partes pendentes; nenhum arquivo foi reenviado por este script.');
 }finally{browser?.disconnect();}
}
module.exports={reconciliar};if(require.main===module)executar().catch(e=>{console.error(e.message);process.exitCode=1});
