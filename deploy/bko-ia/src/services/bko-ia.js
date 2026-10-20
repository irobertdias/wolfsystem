"use strict";
const { randomBytes, randomUUID, createHmac, timingSafeEqual, createHash } = require("node:crypto");
const { validarConfigBko, numeroBko, interpretarRetornoBko, transicaoBkoPermitida } = require("./bko-ia-regras");
const WS="grupoprime", FLUXO=27;
const parse=v=>{try{return typeof v==="string"?JSON.parse(v):v||{};}catch{return {};}};
const clone=v=>JSON.parse(JSON.stringify(v));
function documentosVenda(venda) {
  const custom=venda.dados_customizados||{};
  const origem=String(custom.numero_origem_whatsapp||"").replace(/\D/g,"");
  if(!origem||!venda.canal_id)throw Error("Venda sem origem de atendimento.");
  const hash=createHash("sha256").update(`${WS}:${venda.canal_id}:${origem}`).digest("hex").slice(0,24);
  return ["rg_frente","rg_verso","comprovante_endereco"].map(tipo=>{
    const lista=parse(custom[tipo]);
    if(!Array.isArray(lista)||lista.length!==1)throw Error("Documentação incompleta no CRM.");
    const doc=lista[0],url=new URL(doc.url,"https://app.wolfgyn.com.br"),path=url.searchParams.get("path")||"";
    if(url.origin!=="https://app.wolfgyn.com.br"||url.pathname!=="/api/documentos-clientes/arquivo"||url.searchParams.get("workspaceId")!==WS||doc.privado!==true||doc.regra_id!==`prime_${tipo==='comprovante_endereco'?'comprovante':tipo}`||!path.startsWith(`${WS}/${hash}/arquivos/${tipo}/`)||path.includes(".."))throw Error("Documento não pertence à venda.");
    return {tipo,path,nome:tipo+(String(doc.tipo).includes("pdf")?".pdf":".jpg")};
  });
}
function resumoVenda(v,ref) {
  const campos={Nome:v.nome,CPF:v.cpf,RG:v.rg,"Nome da mãe":v.nome_mae,Nascimento:v.data_nascimento,"E-mail":v.email,Endereço:v.endereco,CEP:v.cep,Cidade:v.cidade,UF:v.estado,"WhatsApp de contato":v.telefone1,"Telefone para ligação":v.telefone2,"WhatsApp da solicitação":v.dados_customizados?.numero_origem_whatsapp,Plano:v.plano,Mensalidade:v.valor_plano,Operadora:v.operadora,Vencimento:v.vencimento,Pagamento:v.forma_pagamento,"Data do pedido":v.data_proposta,Vendedor:v.vendedor,Status:v.status_venda};
  return `VENDA #${v.id}\n#${ref}\n\n`+Object.entries(campos).map(([k,x])=>`${k}: ${String(x??"Não informado").replace(/[\r\n]/g," ")}`).join("\n")+"\n\nResponda a esta mensagem com CPF REPROVADO, APROVADO, GERADA, AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE ou CANCELADA. Para agendamento, acrescente:\nDATA: DD/MM/AAAA\nPERIODO: MANHÃ ou TARDE";
}
function assinaturaValida(raw,header,segredo) {
  if(!Buffer.isBuffer(raw)||!segredo||!/^sha256=[a-f0-9]{64}$/.test(String(header||"")))return false;
  const esperado=createHmac("sha256",segredo).update(raw).digest();
  return timingSafeEqual(esperado,Buffer.from(header.slice(7),"hex"));
}
module.exports=function carregarBko(ctx) {
  const {supabase:db}=ctx;let rodando=false;
  const segredoMeta=()=>process.env.META_APP_SECRET||process.env.WHATSAPP_APP_SECRET||"";
  ctx.assinaturaBkoValida=req=>assinaturaValida(req.rawBody,req.get("x-hub-signature-256"),segredoMeta());
  ctx.app.get("/bko/health",(_req,res)=>res.json({versao:2,waba_assinatura:!!segredoMeta(),waba_versao:/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||'')}));
  async function configuracao(){
    const {data:f,error}=await db.from("fluxos").select("id,ativo,nos").eq("workspace_id",WS).eq("id",FLUXO).maybeSingle();if(error)throw error;
    const no=f?.nos?.find(n=>n.id==="prime_documentos_enviar");if(!no?.dados?.bko_configuracao)return null;
    return {fluxo:f,no,...validarConfigBko(no.dados.bko_configuracao),janelas:no.dados.bko_janelas||{}};
  }
  async function salvar(v,custom,patch={}){
    const {data,error}=await db.from("proposta").update({...patch,dados_customizados:custom,updated_at:new Date().toISOString()})
      .eq("id",v.id).eq("workspace_id",WS).eq("fluxo_id",FLUXO).eq("status_venda",v.status_venda)
      .eq("updated_at",v.updated_at).select("*").maybeSingle();
    if(error)throw error;if(!data)throw Error("Venda alterada durante o processamento; nenhuma alteração foi sobrescrita.");return data;
  }
  async function configCanal(cfg){
    const c=await ctx.getConfigCanal(cfg.canal_id);
    if(!c||c.workspaceId!==WS)throw Error("Canal BKO não pertence ao workspace.");
    if(c.tipo==="webjs"){
      const s=ctx.sessoes[String(cfg.canal_id)];
      if(!s?.client||s.status!=="conectado"||!s.conectadoEm||Date.now()-s.conectadoEm<30000)throw Error("Canal BKO desconectado ou estabilizando.");
    }else if(c.tipo!=="waba"||!segredoMeta()||!/^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION||""))throw Error("Configure assinatura e versão da API oficial para o BKO.");
    return c;
  }
  async function texto(c,n,m){
    if(c.tipo==="waba"){
      const r=await fetch(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${c.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:n,type:'text',text:{body:m}}),signal:AbortSignal.timeout(30000)});
      const resultado=await r.json();if(!r.ok||!resultado.messages?.[0]?.id)throw Error("Envio sem confirmação da API oficial.");return resultado.messages[0].id;
    }
    const r=await ctx.enviarTextoWebjs(ctx.sessoes[String(c.canalId)].client,n,m);
    if(!r?.success||!r.messageId)throw Error("Envio sem confirmação do provedor.");return r.messageId;
  }
  async function arquivo(c,n,doc,ref){
    const {data,error}=await db.storage.from("documentos-clientes").download(doc.path);
    if(error||!data||data.size>15*1024*1024||!data.size)throw Error("Documento privado indisponível ou inválido.");
    if(!/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(data.type))throw Error("Formato de documento não permitido.");
    if(doc.tipo!=='comprovante_endereco'&&data.type==='application/pdf')throw Error("O RG precisa ser uma foto.");
    const nome=doc.tipo+({'application/pdf':'.pdf','image/png':'.png','image/webp':'.webp','image/gif':'.gif'}[data.type]||'.jpg');
    const caption=`${doc.tipo.replace(/_/g," ")} · #${ref}`;
    if(c.tipo==="webjs"){
      const media=new ctx.MessageMedia(data.type,Buffer.from(await data.arrayBuffer()).toString("base64"),nome);
      const r=await ctx.enviarMidiaWebjs(ctx.sessoes[String(c.canalId)].client,n,media,{caption,sendMediaAsDocument:true});
      if(!r?.id?._serialized)throw Error("Arquivo sem confirmação do provedor.");return r.id._serialized;
    }
    if(!['image/jpeg','image/png','application/pdf'].includes(data.type))throw Error('Na API oficial, envie RG em JPEG/PNG e comprovante em JPEG/PNG/PDF.');
    const base=`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${c.phone_number_id}`;
    const form=new FormData();form.append("messaging_product","whatsapp");form.append("type",data.type);form.append("file",data,nome);
    const u=await fetch(`${base}/media`,{method:"POST",headers:{Authorization:`Bearer ${c.token}`},body:form,signal:AbortSignal.timeout(45000)});const uploaded=await u.json();
    if(!u.ok||!uploaded.id)throw Error("Não foi possível carregar documento na API oficial.");
    const tipo=data.type==='application/pdf'?'document':'image';
    const r=await fetch(`${base}/messages`,{method:"POST",headers:{Authorization:`Bearer ${c.token}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:n,type:tipo,[tipo]:{id:uploaded.id,...(tipo==='document'?{filename:nome}:{}),caption}}),signal:AbortSignal.timeout(45000)});const result=await r.json();
    if(!r.ok||!result.messages?.[0]?.id)throw Error("Arquivo sem confirmação da API oficial.");return result.messages[0].id;
  }
  async function processar(v,cfg){
    if(v.workspace_id!==WS||Number(v.fluxo_id)!==FLUXO||v.status_venda!=="AGUARDANDO AUDITORIA"||!cfg.ativo||!cfg.fluxo.ativo)return;
    if(!cfg.canal_trafego_id||!cfg.fila_nome)return;
    if(cfg.canal_trafego_id&&Number(v.canal_id)!==cfg.canal_trafego_id)return;
    if(cfg.fila_nome){const origem=await ctx.getConfigCanal(v.canal_id);if(origem?.workspaceId!==WS||origem.fila!==cfg.fila_nome)return;}
    const c=await configCanal(cfg);const docs=documentosVenda(v);
    let custom=clone(v.dados_customizados||{}),meta=parse(custom.bko_envio);
    if(custom.bko_envio&&!meta.destinatarios)throw Error("Registro de envio inválido; nenhuma mensagem reenviada.");
    if(meta.destinatarios&&Object.keys(meta.destinatarios).length>1){custom.bko_pendente='REVISAR';custom.bko_erro='Envio antigo para múltiplos BKOs. Confira no CRM antes de continuar.';await salvar(v,custom);return;}
    if(meta.lease&&new Date(meta.lease).getTime()>Date.now())return;
    if(meta.destinatarios&&Object.values(meta.destinatarios).some(d=>d.partes.some(p=>p.estado==="em_envio"))){custom.bko_pendente="REVISAR";custom.bko_erro="Entrega sem confirmação. Confira no WhatsApp antes de liberar nova tentativa.";await salvar(v,custom);return;}
    if(!meta.destinatarios){
      // Reserva uma vez na configuração compartilhada; CAS impede dois workers de consumir o mesmo turno.
      const atual=await configuracao();if(!atual?.ativo||!atual.fluxo.ativo||!atual.contatos.length)return;
      if(atual.canal_id!==cfg.canal_id||atual.canal_trafego_id!==cfg.canal_trafego_id||atual.fila_nome!==cfg.fila_nome)return;
      const fixo=custom.bko_responsavel;
      if(fixo&&!atual.contatos.some(x=>x.numero===fixo))throw Error('BKO responsável removido; revisão necessária.');
      const ultimo=atual.no.dados.bko_ultimo_numero;
      const escolhido=atual.contatos.find(x=>x.numero===fixo)||atual.contatos[(atual.contatos.findIndex(x=>x.numero===ultimo)+1)%atual.contatos.length];
      const nos=clone(atual.fluxo.nos),indice=nos.findIndex(x=>x.id===atual.no.id),versao=atual.no.dados.bko_versao;
      if(!fixo)nos[indice].dados.bko_ultimo_numero=escolhido.numero;nos[indice].dados.bko_versao=randomUUID();
      let reserva=db.from('fluxos').update({nos}).eq('workspace_id',WS).eq('id',FLUXO);
      reserva=versao?reserva.eq(`nos->${indice}->dados->>bko_versao`,versao):reserva.is(`nos->${indice}->dados->>bko_versao`,null);
      const {data:reservado,error:er}=await reserva.select('id').maybeSingle();if(er)throw er;if(!reservado)return;
      const ref=`BKO-${v.id}-${randomBytes(8).toString("hex").toUpperCase()}`;
      meta={referencia:ref,canal_id:cfg.canal_id,cpf:String(v.cpf),distribuicao:'roleta',destinatarios:{[escolhido.numero]:{partes:[{tipo:"texto",estado:"pendente"},...docs.map(x=>({tipo:x.tipo,estado:"pendente"}))],concluido:false}}};
      custom.bko_responsavel=escolhido.numero;custom.bko_ref=ref;custom.bko_reply_ids=[];
    }
    if(meta.canal_id!==cfg.canal_id||meta.cpf!==String(v.cpf))throw Error("A configuração ou titular mudou; revisão do envio necessária.");
    meta.lease=new Date(Date.now()+10*60000).toISOString();custom.bko_envio=JSON.stringify(meta);v=await salvar(v,custom);
    try{
      for(const [n,dest]of Object.entries(meta.destinatarios)){
        const atual=await configuracao();if(!atual?.ativo||!atual.fluxo.ativo||atual.canal_id!==cfg.canal_id)throw Error("Encaminhamento pausado.");
        if(!atual.contatos.some(x=>x.numero===n))throw Error('BKO responsável removido; revisão necessária.');
        if([v.telefone1,v.telefone2,v.dados_customizados.numero_origem_whatsapp,c.numero].some(x=>numeroBko(x)===n))throw Error("Destinatário BKO coincide com cliente ou canal de envio.");
        const janelaMs=new Date(atual.janelas[n]||0).getTime();
        if(c.tipo==="waba"&&(!Number.isFinite(janelaMs)||janelaMs>Date.now()+60000||Date.now()-janelaMs>23*3600000)){custom=clone(v.dados_customizados);custom.bko_pendente="JANELA";custom.bko_erro="O BKO precisa enviar uma mensagem ao canal da API oficial para iniciar o atendimento.";meta.lease=null;custom.bko_envio=JSON.stringify(meta);await salvar(v,custom);return;}
        for(const parte of dest.partes){
          if(parte.estado==="enviado")continue;
          const permissao=await configuracao();
          if(!permissao?.ativo||!permissao.fluxo.ativo||permissao.canal_id!==cfg.canal_id||!permissao.contatos.some(x=>x.numero===n))throw Error("Destinatário removido ou encaminhamento pausado.");
          // Reservar ANTES da chamada: após crash/timeout não reenviar às cegas.
          parte.estado="em_envio";custom=clone(v.dados_customizados);custom.bko_envio=JSON.stringify(meta);v=await salvar(v,custom);
          const id=parte.tipo==="texto"?await texto(c,n,resumoVenda(v,meta.referencia)):await arquivo(c,n,docs.find(x=>x.tipo===parte.tipo),meta.referencia);
          parte.id=id;parte.estado="enviado";custom=clone(v.dados_customizados);custom.bko_reply_ids=[...new Set([...(custom.bko_reply_ids||[]),id])];custom.bko_envio=JSON.stringify(meta);v=await salvar(v,custom);
          await new Promise(r=>setTimeout(r,1500));
        }
        dest.concluido=true;custom=clone(v.dados_customizados);custom.bko_envio=JSON.stringify(meta);v=await salvar(v,custom);
      }
      meta.lease=null;custom=clone(v.dados_customizados);custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="ENVIADO";custom.bko_erro="";await salvar(v,custom);
    }catch(e){
      custom=clone(v.dados_customizados);meta.lease=null;custom.bko_envio=JSON.stringify(meta);custom.bko_pendente="REVISAR";custom.bko_erro="Envio interrompido. Confira as partes pendentes antes de tentar novamente.";
      try{await salvar(v,custom);}catch{}throw e;
    }
  }
  async function janela(cfg,n){
    const nos=clone(cfg.fluxo.nos),no=nos.find(x=>x.id===cfg.no.id);
    no.dados.bko_janelas={...(no.dados.bko_janelas||{}),[n]:new Date().toISOString()};
    no.dados.bko_versao=randomUUID();
    const indice=cfg.fluxo.nos.findIndex(x=>x.id===cfg.no.id),versao=cfg.no.dados.bko_versao;
    let q=db.from("fluxos").update({nos}).eq("workspace_id",WS).eq("id",FLUXO);
    q=versao?q.eq(`nos->${indice}->dados->>bko_versao`,versao):q.is(`nos->${indice}->dados->>bko_versao`,null);
    const {data,error}=await q.select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Configuração BKO alterada; retorno não aplicado.');
  }
  const tratarRetorno=async({workspaceId,canalId,numero,mensagem,messageId,quotedId,verificado})=>{
    if(workspaceId!==WS)return false;
    const cfg=await configuracao(),n=numeroBko(numero);
    if(!cfg?.ativo||Number(canalId)!==cfg.canal_id||!cfg.contatos.some(x=>x.numero===n))return false;
    if(!verificado)return true; // webhook não autenticado nunca atualiza ou envia resposta.
    if(!cfg.fluxo.ativo)return true;
    await janela(cfg,n);
    const c=await configCanal(cfg);
    const responder=m=>texto(c,n,m);
    const retorno=interpretarRetornoBko(String(mensagem||""));
    if(!retorno||!messageId){await responder("Para atualizar, responda à mensagem da venda com um único status: CPF REPROVADO, APROVADO, GERADA, AGUARDANDO INSTALAÇÃO, INSTALADA, SEM DISPONIBILIDADE ou CANCELADA. Também pode incluir a referência #BKO da venda.");return true;}
    async function buscar(ref,id){let q=db.from("proposta").select("*").eq("workspace_id",WS).eq("fluxo_id",FLUXO);q=ref?q.eq("dados_customizados->>bko_ref",ref):q.contains("dados_customizados",{bko_reply_ids:[id]});const {data,error}=await q.limit(2);if(error)throw error;return data||[];}
    const porRef=retorno.referencia?await buscar(retorno.referencia):[];
    const porQuote=quotedId?await buscar(null,quotedId):[];
    const lista=retorno.referencia?porRef:porQuote;
    if(lista.length!==1||(retorno.referencia&&quotedId&&(porQuote.length!==1||porQuote[0].id!==lista[0].id))){await responder("Não identifiquei uma única venda. Use Responder na mensagem original ou informe a referência #BKO completa.");return true;}
    const v=lista[0],custom=clone(v.dados_customizados||{}),meta=parse(custom.bko_envio),dest=meta.destinatarios?.[n];
    if(meta.canal_id!==cfg.canal_id||meta.cpf!==String(v.cpf)||!dest?.concluido||dest.cancelado||(quotedId&&!dest.partes.some(p=>p.id===quotedId))){await responder("Essa referência não está liberada para este BKO. Aguarde o envio completo da venda atual.");return true;}
    const eventos=Array.isArray(custom.bko_retornos)?custom.bko_retornos:[];
    if(eventos.some(e=>e.message_id===messageId))return true;
    if(!transicaoBkoPermitida(v.status_venda,retorno.status)){await responder(`A venda #${v.id} está em ${v.status_venda}. Essa transição exige conferência no CRM.`);return true;}
    const patch={status_venda:retorno.status,...(retorno.data_agendamento?{data_agendamento:retorno.data_agendamento}:{}),...(retorno.periodo_instalacao?{periodo_instalacao:retorno.periodo_instalacao}:{})};
    if(v.status_venda===retorno.status&&['GERADA','AGUARDANDO INSTALAÇÃO'].includes(retorno.status)&&((retorno.data_agendamento&&retorno.data_agendamento!==v.data_agendamento)||(retorno.periodo_instalacao&&retorno.periodo_instalacao!==v.periodo_instalacao)))custom.bko_agenda_revisada=messageId;
    custom.bko_retornos=[...eventos,{message_id:messageId,numero:n,em:new Date().toISOString(),anterior:v.status_venda,status:retorno.status,...patch}].slice(-100);
    // Garantir baseline antes do primeiro retorno rápido do BKO.
    const {error:ee}=await db.from("crm_automacao_estado").upsert({workspace_id:WS,proposta_id:v.id,snapshot:v,proposta_updated_at:v.updated_at},{onConflict:"proposta_id",ignoreDuplicates:true});if(ee)throw ee;
    try{await salvar(v,custom,patch);}catch{await responder("A venda foi alterada por outro atendimento. Confira o status atual no CRM e envie novamente se necessário.");return true;}
    await responder(`Venda #${v.id} atualizada para ${retorno.status}. O acompanhamento do cliente seguirá pelo fluxo configurado.`);return true;
  };
  ctx.tratarRetornoBko=async entrada=>{try{return await tratarRetorno(entrada);}catch(e){console.error('[BKO retorno] '+e.message);return entrada.workspaceId===WS;}};
  async function verificar(){
    if(rodando)return;rodando=true;
    try{
      const cfg=await configuracao();if(!cfg?.ativo||!cfg.fluxo.ativo||!cfg.canal_trafego_id||!cfg.fila_nome)return;
      await configCanal(cfg);
      const {data,error}=await db.from("proposta").select("*").eq("workspace_id",WS).eq("fluxo_id",FLUXO).eq("status_venda","AGUARDANDO AUDITORIA").eq("canal_id",cfg.canal_trafego_id).in("dados_customizados->>bko_pendente",["SIM","JANELA"]).order("id").limit(20);if(error)throw error;
      for(const v of data||[])try{await processar(v,cfg);}catch(e){
        console.error(`[BKO] venda=${v.id}: ${e.message}`);
        if(/Documento|Documentação|Registro de envio|Venda sem origem|BKO responsável removido/.test(e.message))try{
          const {data:atual}=await db.from('proposta').select('*').eq('workspace_id',WS).eq('id',v.id).eq('fluxo_id',FLUXO).maybeSingle();
          if(atual&&atual.status_venda==='AGUARDANDO AUDITORIA'&&['SIM','JANELA'].includes(atual.dados_customizados?.bko_pendente))await salvar(atual,{...atual.dados_customizados,bko_pendente:'REVISAR',bko_erro:'Confira os dados e documentos da venda no CRM antes de liberar nova tentativa.'});
        }catch{}
      }
    }catch(e){console.error("[BKO] "+e.message);}finally{rodando=false;}
  }
  ctx.verificarVendasBko=verificar;
  ctx.processarVendaBko=processar;
  setInterval(verificar,30000).unref?.();
  console.log("[BKO] Integração carregada; respeita configuração e pausa do vendedor.");
  return ctx;
};
module.exports._test={documentosVenda,resumoVenda,assinaturaValida};
