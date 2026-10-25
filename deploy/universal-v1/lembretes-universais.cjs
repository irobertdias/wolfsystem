'use strict';
const {interpretar,configurar}=require('./agendamento-contato.cjs');
const {randomUUID}=require('node:crypto');
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
function receber(s,texto,d,agora=Date.now()){
 const cfg=configurar(d);if(!cfg.ativo||!String(texto||'').trim())return null;
 const anterior=s.lembretes||{},agenda=interpretar(texto,{agora,fuso:cfg.fuso,aguardandoHorario:anterior.aguardandoHorario||!!anterior.agendadoPara});
 if(anterior.ultimoEnvio?.recibo)for(const estado of new Set([s,s.nio].filter(Boolean)))if(estado.historico?.at(-1)?.content!==anterior.ultimoEnvio.texto)estado.historico=[...(estado.historico||[]),{role:'assistant',content:anterior.ultimoEnvio.texto,tipo:'lembrete',em:anterior.ultimoEnvio.em}].slice(-40);
 s.lembretes={clienteEm:new Date(agora).toISOString(),enviados:0,agendadoPara:null,aguardandoHorario:false};
 if(!agenda)return null;
 if(agenda.cancelar)return 'Tudo bem, cancelei o retorno agendado.';
 if(agenda.esclarecer){s.lembretes.aguardandoHorario=true;return 'Claro! Em qual dia e horário você prefere que eu chame?';}
 s.lembretes.agendadoPara=agenda.em;
 return 'Combinado! Vou chamar você em '+new Intl.DateTimeFormat('pt-BR',{timeZone:cfg.fuso,dateStyle:'short',timeStyle:'short'}).format(new Date(agenda.em))+'. As informações que você já enviou estão salvas. 😊';
}
function proximo(s,cfg,ultima,agora){
 const l=s.lembretes||{};if(l.aguardandoHorario||l.enviados>=5)return null;
 if(l.agendadoPara)return Date.parse(l.agendadoPara)<=agora?{tipo:'agendado',numero:1}:null;
 const base=Math.max(Date.parse(l.clienteEm)||0,Date.parse(l.retornoEnviadoEm)||0,Date.parse(ultima?.created_at)||0);
 if(!base)return null;const enviados=Number(l.enviados||0),inicio=Date.parse(l.baseSilencio)||base;
 const prazo=inicio+cfg.minutos[enviados]*60000,intervalo=enviados?(cfg.minutos[enviados]-cfg.minutos[enviados-1])*60000:0,aposUltimo=enviados?Date.parse(l.ultimoEnvio?.em||0)+intervalo:0;
 if(agora<Math.max(prazo,aposUltimo||0))return null;
 return {tipo:'lembrete',numero:enviados+1};
}
function criar({db,ctx,agora=Date.now,enviar,reconciliar=async()=>null,ocupado=()=>false}){
 let rodando=false,cursor=0;
 return async function executar(){if(rodando)return [];rodando=true;const feitos=[];
 try{
  const q=await db.from('fluxo_sessoes').select('*').eq('status','ativo').in('tipo_input_aguardado',['assistente_universal','nicho_atendimento']).gt('id',cursor).order('id',{ascending:true}).limit(500);if(q.error)throw q.error;
  cursor=q.data?.length===500?q.data.at(-1).id:0;
  const fluxos=new Map();
  for(const row of q.data||[]){
   if(feitos.length>=10)break;
   try{
   const ws=row.workspace_id,key=row.variaveis?.__universal_v2?'__universal_v2':'__universal_v1',s=parse(row.variaveis?.[key]),interno=s.nio||s;
   if(s.proposta_id||s.concluido||s.pronto||s.encerrado||interno.proposta_id||interno.etapa==='encerrado'||ocupado(ws,row.canal_id,row.numero)||s.pendentes?.length)continue;
   const fk=ws+':'+row.fluxo_id;if(!fluxos.has(fk)){const f=await db.from('fluxos').select('*').eq('workspace_id',ws).eq('id',row.fluxo_id).eq('ativo',true).limit(1);if(f.error)throw f.error;fluxos.set(fk,f.data?.[0]);}
   const f=fluxos.get(fk),origem=f?.conexoes?.find(c=>c.para===row.no_atual&&f.nos.some(n=>n.id===c.de&&n.tipo==='assistente_universal')),no=f?.nos?.find(n=>n.tipo==='assistente_universal'&&(n.id===row.no_atual||n.id===origem?.de)),cfg=configurar(no?.dados);if(!cfg.ativo)continue;
   const a=await db.from('atendimentos').select('*').eq('workspace_id',ws).eq('canal_id',row.canal_id).eq('numero',row.numero).order('updated_at',{ascending:false}).limit(1);if(a.error)throw a.error;const at=a.data?.[0];if(!at||at.status==='resolvido'||at.atendente!=='BOT'||at.bloqueado_ia||at.bloqueado_fluxo)continue;
   if((await ctx.verificarBloqueioManualBot(ws,row.canal_id,row.numero))?.bloqueado)continue;
   const m=await db.from('mensagens').select('id,de,mensagem,created_at,provider_message_id').eq('workspace_id',ws).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(30);if(m.error)throw m.error;const msgs=m.data||[],cliente=msgs.find(m=>m.de==='cliente');if(!msgs.length||msgs[0].de!=='bot')continue;
   s.lembretes||={};const l=s.lembretes;
   if(l.enviados>=5){if(!cliente||Date.parse(cliente.created_at)<=Date.parse(l.ultimoEnvio?.em||l.baseSilencio))await require('./finalizar-conversa.cjs').finalizarConversa(db,ws,row.canal_id,row.numero);continue;}
   const c=await ctx.getConfigCanal(row.canal_id);if(c?.workspaceId!==ws||c.modo!=='fluxo'||Number(c.fluxoId)!==Number(row.fluxo_id)||ctx.sessoes[String(row.canal_id)]?.status!=='conectado')continue;
   if(l.ultimoClienteId&&cliente?.id!==l.ultimoClienteId){for(const k of Object.keys(l))delete l[k];Object.assign(l,{clienteEm:cliente?.created_at,enviados:0});}
   const plano=proximo(s,cfg,msgs[0],agora());if(!plano&&!l.envio)continue;
   const persistir=async()=>{const r=await db.from('fluxo_sessoes').update({variaveis:{...row.variaveis,[key]:JSON.stringify(s)},updated_at:new Date(agora()).toISOString()}).eq('workspace_id',ws).eq('id',row.id).eq('updated_at',row.updated_at).eq('status','ativo').select('id,updated_at');if(r.error)throw r.error;if(!r.data?.length)return false;row.updated_at=r.data[0].updated_at;return true;};
   let recibo;
   if(l.envio){recibo=msgs.find(m=>m.de==='bot'&&m.mensagem===l.envio.texto&&Date.parse(m.created_at)>=Date.parse(l.envio.em)-3000)||await reconciliar(row,l.envio);if(!recibo)continue;}
   else{
    const numero=plano.numero,textos=['Posso ajudar com alguma dúvida para continuarmos de onde paramos? 😊','Se ainda quiser continuar, suas informações estão salvas. Posso ajudar no próximo passo?','Ficou alguma dúvida ou dificuldade? Estou por aqui para ajudar você a continuar.','Ainda deseja seguir com o atendimento? Pode me dizer como posso ajudar.','Como não tivemos retorno, vou finalizar este atendimento por enquanto. Quando quiser continuar, é só chamar. 💚'];
    l.baseSilencio=l.baseSilencio||new Date(Math.max(Date.parse(l.clienteEm)||0,Date.parse(l.retornoEnviadoEm)||0,Date.parse(msgs[0].created_at))).toISOString();l.ultimoClienteId=cliente?.id;
    l.envio={chave:randomUUID(),em:new Date(agora()).toISOString(),tipo:plano.tipo,numero,texto:plano.tipo==='agendado'?'Olá! Voltei no horário que você pediu. Podemos continuar de onde paramos? 😊':textos[numero-1]};if(!await persistir())continue;
    const atual=await db.from('mensagens').select('id').eq('workspace_id',ws).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(1);if(atual.error)throw atual.error;if(atual.data?.[0]?.id!==msgs[0].id){delete l.envio;await persistir();continue;}
    if((await ctx.verificarBloqueioManualBot(ws,row.canal_id,row.numero))?.bloqueado)continue;
    try{recibo=await enviar(row,l.envio.texto,l.envio.chave);}catch(e){console.error('[Lembrete universal: envio em reconciliação]',row.id,e.message);continue;}
   }
   if(!recibo)continue;
   const envio=l.envio;if(envio.tipo==='agendado'){l.agendadoPara=null;l.retornoEnviadoEm=new Date(agora()).toISOString();l.baseSilencio=l.retornoEnviadoEm;l.enviados=0;}else l.enviados=envio.numero;
   for(const estado of new Set([s,s.nio].filter(Boolean)))estado.historico=[...(estado.historico||[]),{role:'assistant',content:envio.texto,tipo:'lembrete',em:envio.em}].slice(-40);
   l.ultimoEnvio={...envio,recibo:recibo.id||recibo.provider_message_id||null};delete l.envio;if(!await persistir())continue;
   if(l.enviados>=5){const fim=await db.from('mensagens').select('id,de,created_at').eq('workspace_id',ws).eq('canal_id',row.canal_id).eq('numero',row.numero).order('created_at',{ascending:false}).limit(1);if(fim.error)throw fim.error;if(fim.data?.[0]?.de==='bot')await require('./finalizar-conversa.cjs').finalizarConversa(db,ws,row.canal_id,row.numero);}
   feitos.push({sessao:row.id,tipo:envio.tipo,numero:envio.numero});
   }catch(e){console.error('[Lembrete universal: sessão]',row.id,e.message);}
  }
 }finally{rodando=false;}return feitos;
 };
}
function instalar(ctx){if(ctx.lembretesUniversal)return ctx.lembretesUniversal;const executar=criar({db:ctx.supabase,ctx,enviar:async(row,texto)=>{const c=await ctx.getConfigCanal(row.canal_id),client=ctx.sessoes[String(row.canal_id)]?.client;if(!client)throw Error('Canal desconectado');const r=await require('../bko-roteamento.js').enviar(client,row.numero,texto);await ctx.salvarMensagem(row.workspace_id,row.canal_id,c.fila,row.numero,texto,'bot','BOT',r?.id?._serialized||null);return r;},reconciliar:async(row,e)=>{const client=ctx.sessoes[String(row.canal_id)]?.client;if(!client)return null;const id=await client.getNumberId(row.numero),chat=id&&await client.getChatById(id._serialized),ms=chat?await chat.fetchMessages({limit:30}):[];return ms.find(m=>m.fromMe&&m.body===e.texto&&Number(m.timestamp)*1000>=Date.parse(e.em)-3000)||null;}});const timer=setInterval(()=>executar().catch(e=>console.error('[Lembretes universais]',e.message)),20000);timer.unref();ctx.lembretesUniversal={receber,executar,parar:()=>clearInterval(timer)};return ctx.lembretesUniversal;}
module.exports={receber,proximo,criar,instalar};
