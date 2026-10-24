'use strict';
const etiquetasVendas=require('./etiquetas-vendas.cjs');
const {finalizarConversa}=require('./finalizar-conversa.cjs');
const {prepararEntrega,confirmarEntrega}=require('./entrega-resposta.cjs');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {criarIA}=require('./ia-configuravel.cjs'),generico=require('./generico.cjs');
const {modelo}=require('./modelo-vendas.cjs');
const {dadosDaMidia}=require('./endereco-midia.cjs');
const KEY='__universal_v2';
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
module.exports=function instalar(ctx){
 const db=ctx.supabase,operacoes=new Map([['grupoprime',ctx.universalOperacoes]]),filas=new Map();
 const proximo=(f,id,i=0)=>(f.conexoes||[]).find(a=>a.de===id&&Number(a.saidaIndex)===i)?.para||null;
 async function permitido(ws){
  const {data:w,error}=await db.from('workspaces').select('ia,owner_email').eq('username',ws).single();if(error)throw error;
  if(w.owner_email?.toLowerCase()==='robert.dias@live.com')return;
  const {data:c,error:e}=await db.from('cadastros').select('ia').ilike('email',w.owner_email).maybeSingle();if(e)throw e;
  if(!String(c?.ia||w.ia||'').trim()||['nao','não','false','0'].includes(String(c?.ia||w.ia).toLowerCase()))throw Error('Módulo de IA não liberado para o workspace.');
 }
 function obter(ws){
  if(!operacoes.has(ws)){
   const filho=Object.create(ctx);
   require('./runtime.cjs')(filho,{workspace:ws,semRotas:true,semEnvolver:true,credencial:{apiKey:'',documentosOpenai:false}});
   operacoes.set(ws,filho.universalOperacoes);
  }return operacoes.get(ws);
 }
 async function arquivos(texto,s,meta,nicho,ia,autorizado,persistir){
  for(const m of texto.matchAll(/\[(?:img|image|file|document):([^\]\r\n]+)\]/gi)){
   const nome=path.basename(m[1]);if(nome!==m[1]||nome.includes('..'))throw Error('Arquivo fora do diretório de mídia.');
   const origem=createHash('sha256').update(nome).digest('hex'),existente=s.anexos.find(a=>a.origem===origem);if(existente?.classificado)continue;
   const buffer=fs.readFileSync(path.join(ctx.AUDIOS_DIR,nome));if(!buffer.length||buffer.length>25*1024*1024)throw Error('Arquivo excede o limite de armazenamento.');
   const ext=path.extname(nome).toLowerCase(),tipo=({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf'})[ext]||'application/octet-stream';
   const hash=createHash('sha256').update(`${meta.workspaceId}:${meta.canalId}:${meta.numero}`).digest('hex').slice(0,24),storagePath=`${meta.workspaceId}/${hash}/arquivos/universal/${origem}${ext}`;
   const up=await db.storage.from('documentos-clientes').upload(storagePath,buffer,{contentType:tipo,upsert:true});if(up.error)throw up.error;
   const a=existente||{path:storagePath,nome,tipo,origem,tamanho:buffer.length,privado:true,url:'/api/documentos-clientes/arquivo?'+new URLSearchParams({workspaceId:meta.workspaceId,path:storagePath,nome}),enviado_em:new Date().toISOString()};
   // Persist the original before OCR, and independently for every file in a batch.
   if(!existente)s.anexos.push(a);await persistir();
   let leitura;try{leitura=await ia.lerDocumento({buffer,mime:tipo,nome,documentos:nicho.documentos_config||[],endereco:s.dados.endereco,autorizado});}catch{leitura={categorias:[],leitura:'inconclusiva'};}
   Object.assign(a,leitura);let categorias=a.categorias||[];
   if(s.confirmado&&(!categorias.length||categorias.every(k=>s.documentos[k]?.length))){const falta=(nicho.documentos_config||[]).find(d=>!s.documentos[d.variavel]?.length);if(falta)categorias=[falta.variavel];s.pendencias.push('Conferir original recebido: '+nome);}
   for(const k of categorias){s.documentos[k]||=[];if(!s.documentos[k].some(x=>x.path===a.path))s.documentos[k].push(a);}
   a.classificado=true;await persistir();
  }
 }
 async function processar(f,no,vars,texto,input,enviar,meta){
  if(!['assistente_universal','nicho_atendimento','concluir_venda_universal'].includes(no.tipo))return null;
  await permitido(meta.workspaceId);
  const persistir=()=>ctx.persistirVariaveis(meta.workspaceId,meta.canalId,meta.numero,vars);
  if(no.tipo==='assistente_universal')return {proximoNoId:proximo(f,no.id)};
  if(no.tipo==='concluir_venda_universal'){
   const s=parse(vars[KEY]);if(!s.pronto)throw Error('Confirme a coleta antes de concluir a venda.');
   const d=no.dados||{},ops=obter(meta.workspaceId);
   if(d.crm!==false){
    const venda={...s,dados:s.dados,plano:s.plano||{id:s.dados.plano_id||'',nome:s.dados.plano||'',mensalidade:Number(s.dados.valor_plano)||0},resumoPersonalizado:s.resumo,variaveisPublicas:{...vars,...s.dados}};
    delete venda.variaveisPublicas[KEY];delete venda.variaveisPublicas.__universal_v1;
    s.proposta_id=await ops.registrar(f,meta.canalId,meta.numero,venda,d);vars.proposta_id=String(s.proposta_id);
   }
   s.concluido=true;vars[KEY]=JSON.stringify(s);await persistir();
   const mensagem=modelo(d.mensagem_sucesso||'✅ Pedido #{{proposta_id}} registrado. Seus dados e arquivos foram salvos.',{...vars,...s.dados,proposta_id:s.proposta_id||''});
   if(!s.avisouConclusao&&mensagem){await enviar(mensagem);s.avisouConclusao=true;vars[KEY]=JSON.stringify(s);await persistir();}
   if(d.whatsapp!==false&&s.proposta_id)setTimeout(()=>ops.entregarPendentes().catch(e=>console.error('[Universal entrega]',e.message)),100);
   return d.continuar_fluxo===false?{parar:true}:{proximoNoId:proximo(f,no.id)};
  }
  const origem=(f.conexoes||[]).find(a=>a.para===no.id&&f.nos.some(n=>n.id===a.de&&n.tipo==='assistente_universal'));
  const assistente=f.nos.find(n=>n.id===origem?.de)?.dados||{},nicho=no.dados||{};
  if(!Array.isArray(nicho.coleta))throw Error('Configure a coleta editável no bloco de nicho.');
  let apiKey=assistente.apiKey||process.env.OPENAI_API_KEY;
  if(!apiKey&&meta.workspaceId==='grupoprime'){try{apiKey=JSON.parse(fs.readFileSync(path.join(__dirname,'credencial.json'),'utf8')).apiKey;}catch{}}
  const ia=criarIA({apiKey,modelo:assistente.modelo||'gpt-4o-mini'});
  let s=parse(vars[KEY]);if(s.versao!==2){const legado=parse(vars.__universal_v1);s={versao:2,inicio:legado.inicio||new Date().toISOString(),dados:legado.dados||{},historico:legado.historico||[],documentos:legado.documentos||{},anexos:legado.anexos||[],pendencias:legado.pendencias||[],apresentou:!!legado.apresentou,confirmado:!!legado.confirmado,...(legado.versao===1?{nio:legado,aberturaConcluida:!!(legado.plano&&legado.dados.endereco&&legado.dados.bairro),plano:legado.plano,consulta:legado.consulta}:{})};}
  if(s.plano&&!s.oferta)s.oferta={...s.plano,preco:s.plano.mensalidade};
  const salvar=async()=>{Object.assign(vars,s.dados);for(const [k,v]of Object.entries(s.documentos))vars[k]=JSON.stringify(v);vars[KEY]=JSON.stringify(s);await persistir();await ctx.salvarSessaoFluxo(meta.workspaceId,meta.canalId,meta.numero,f.id,no.id,vars,true,'nicho_atendimento');};
  const novaEntrada=!!String(texto||'').trim();
  s.pendentes=[...(s.pendentes||[]),...(novaEntrada?[String(texto)]:[])].filter(m=>String(m).trim()).slice(-20);texto=s.pendentes.join('\n');await salvar();
  await arquivos(String(texto||''),s,meta,nicho,ia,assistente.autorizar_leitura_documentos===true,salvar);
  let r;
  if(['vtal_nio','vero_vtal'].includes(nicho.integracao)&&!s.aberturaConcluida){
   const {inicial,avancar}=require('./conversa.cjs'),{criarConsulta}=require('./vtal.cjs'),{criarInterpretador}=require('./interpretacao.cjs'),{planosDaCidade}=require('./planos-grupoprime.cjs');
   const configuradas=generico.catalogo(nicho,vars);
   const vero=nicho.integracao==='vero_vtal'?require('./vero.cjs').criarVero({consultaVtal:criarConsulta(),estado:s.nio||{},politica:nicho.vero_config}):null;
   const catalogo=vero?.catalogo||(configuradas.length?()=>({pessoa_fisica:configuradas.filter(p=>p.tipo_pessoa!=='PJ').map(p=>({...p,mensalidade:p.preco,velocidade_mbps:Number(p.velocidade_mbps)||0})),pessoa_juridica:configuradas.filter(p=>p.tipo_pessoa==='PJ').map(p=>({...p,mensalidade:p.preco,velocidade_mbps:Number(p.velocidade_mbps)||0}))}):planosDaCidade);
   const abertura=s.nio||inicial();Object.assign(abertura.dados,dadosDaMidia(s.anexos,abertura.dados).dados);abertura.enderecosMidia=s.anexos.flatMap(a=>a.enderecos||[]);
   const entradaChave=createHash('sha256').update(texto).digest('hex'),retomadaInterpretada=!novaEntrada&&s.entradaInterpretadaChave===entradaChave;
   const antigo=await avancar({estado:abertura,entrada:retomadaInterpretada?'':texto,numero:meta.numero,extrair:criarInterpretador({apiKey,model:assistente.modelo||'gpt-4o-mini',catalogo}).extrair,consultar:vero?.consultar||criarConsulta(),catalogo,config:{...assistente,promptNicho:nicho.prompt,regrasNicho:nicho.regras}});
   s.entradaInterpretadaChave=entradaChave;
   s.nio=antigo.estado;prepararEntrega(s.nio,antigo);
   if(antigo.inviavel)await etiquetasVendas.inviavel(db,meta.workspaceId,meta.canalId,meta.numero);
   else if(s.nio.enderecosInviaveis?.length&&s.nio.consulta?.status==='disponivel_na_base')await etiquetasVendas.limparInviavel(db,meta.workspaceId,meta.canalId,meta.numero);
   if(s.nio.enderecosInviaveis?.length)for(const k of ['cep','logradouro','quadra','lote','numero','casa','apartamento','bloco','bairro','endereco'])if(!s.nio.dados[k]){delete s.dados[k];delete vars[k];}
   s.dados={...s.dados,...s.nio.dados};s.apresentou=s.nio.apresentou;
   if(s.nio.plano&&s.dados.endereco&&s.dados.bairro){s.aberturaConcluida=true;s.plano=s.nio.plano;s.oferta={...s.plano,preco:s.plano.mensalidade};s.dados.plano=s.plano.nome;s.dados.valor_plano=s.plano.mensalidade;s.consulta=s.nio.consulta;s.historico=s.nio.historico;r=await generico.avancar({estado:s,texto:'',numero:meta.numero,nicho,assistente,vars,extrair:async()=>({dados:[],resposta:''})});}
   else r={estado:s,mensagem:antigo.mensagem,tipo:antigo.tipo,abertura:true,concluido:false,encerrar:antigo.acao==='encerrar'};
  }else r=await generico.avancar({estado:s,texto:String(texto||''),numero:meta.numero,nicho,assistente,vars,extrair:ia.extrair});
  s=r.estado;
  if(!r.abertura)prepararEntrega(s,r);
  if(!s.aberturaConcluida&&s.nio?.consulta?.status==='consulta_inconclusiva'){
   s.retryEm=Date.now()+60000;const avisou=s.instabilidadeAvisada;s.instabilidadeAvisada=true;await salvar();if(!avisou&&r.mensagem)await enviar(r.mensagem);return {aguardarInput:true};
  }
  s.pendentes=[];s.erroAvisado=false;delete s.retryEm;delete s.instabilidadeAvisada;await salvar();
  if(s.encerrado||r.encerrar){await enviar(r.mensagem);await finalizarConversa(db,meta.workspaceId,meta.canalId,meta.numero);return {parar:true};}
  if(r.concluido){s.pronto=true;await salvar();return {proximoNoId:proximo(f,no.id)};}
  const filaAtual=filas.get(`${meta.workspaceId}:${meta.canalId}:${meta.numero}`);
  if(r.mensagem&&!filaAtual?.mensagens.length){await enviar(r.mensagem);confirmarEntrega(r.abertura?s.nio:s,r);await salvar();}return {aguardarInput:true};
 }
 ctx.processarUniversalNativo=async(...args)=>{
  try{return await processar(...args);}catch(e){
   const [f,no,vars,, ,enviar,meta]=args;
   if(!['nicho_atendimento','concluir_venda_universal'].includes(no.tipo))throw e;
   const s=parse(vars[KEY]);s.retryEm=Date.now()+60000;s.erro=String(e.message).slice(0,200);
   const erroNo=no.tipo==='concluir_venda_universal'?proximo(f,no.id,1):null;
   if(erroNo){delete s.retryEm;vars.universal_erro=s.erro;vars[KEY]=JSON.stringify(s);await ctx.persistirVariaveis(meta.workspaceId,meta.canalId,meta.numero,vars);return {proximoNoId:erroNo};}
   if(!s.erroAvisado){await enviar('Tive uma instabilidade, mas preservei as informações que você enviou. Vou retomar daqui sem começar de novo.');s.erroAvisado=true;}
   vars[KEY]=JSON.stringify(s);await ctx.salvarSessaoFluxo(meta.workspaceId,meta.canalId,meta.numero,f.id,no.id,vars,true,'nicho_atendimento');
   console.error('[Universal configuração]',e.message);return {aguardarInput:true};
  }
 };
 // Generic flows retain the native execution loop (including CRM triggers and tags).
 const executar=ctx.executarFluxo;
 ctx.executarFluxo=async function(ws,canal,numero,texto,enviar,fluxoId,opts={}){
  if(opts.proposta||opts.iniciarNoId)return executar(ws,canal,numero,texto,enviar,fluxoId,opts);
  const {data:f}=await db.from('fluxos').select('nos').eq('workspace_id',ws).eq('id',fluxoId||0).maybeSingle();
  if(!f?.nos?.some(n=>n.tipo==='nicho_atendimento'&&Array.isArray(n.dados?.coleta)))return executar(ws,canal,numero,texto,enviar,fluxoId,opts);
  const key=`${ws}:${canal}:${numero}`,fila=filas.get(key)||{mensagens:[],esperas:[],rodando:false};filas.set(key,fila);
  fila.mensagens.push(String(texto||''));
  return new Promise((resolve,reject)=>{fila.esperas.push({resolve,reject});if(fila.rodando)return;clearTimeout(fila.timer);fila.timer=setTimeout(async()=>{fila.rodando=true;try{while(fila.mensagens.length){const msgs=fila.mensagens.splice(0),esperas=fila.esperas.splice(0);try{const r=await executar(ws,canal,numero,msgs.join('\n'),enviar,fluxoId,opts);esperas.forEach(p=>p.resolve(r));}catch(e){esperas.forEach(p=>p.reject(e));}}}finally{filas.delete(key);}},1500);});
 };
 ctx.encaminharVendaNativa=async(ws,id)=>{
  await permitido(ws);const ops=obter(ws),r=await db.from('proposta').select('*').eq('workspace_id',ws).eq('id',id).single();if(r.error)throw r.error;
  const p=r.data,c=structuredClone(p.dados_customizados||{});if(c.universal_entrega?.concluido)return;
  Object.assign(c,{universal_v1:'SIM',bko_pendente:'SIM',envio_whatsapp_ativo:true,universal_entrega:c.universal_entrega||{partes:[],tentativas:0}});
  await ops.salvarEntrega(p,c);setTimeout(()=>ops.entregarPendentes().catch(e=>console.error('[Universal encaminhamento]',e.message)),100);
 };
 const retorno=ctx.tratarRetornoBko;
 ctx.tratarRetornoBko=async e=>{
  if(e.workspaceId==='grupoprime')return retorno?.(e)||false;
  try{if(operacoes.has(e.workspaceId)&&await operacoes.get(e.workspaceId).posVenda.tratar(e))return true;}catch(err){console.error('[Universal retorno]',err.message);}
  return retorno?.(e)||false;
 };
 // Restore only configured tenants' workers, without enabling any flow or channel.
 async function restaurar(){
  const r=await db.from('fluxos').select('workspace_id').eq('nome','__wolf_configuracao_vendas__');if(r.error)throw r.error;for(const f of r.data||[])obter(f.workspace_id);
  const ativos=await db.from('fluxos').select('workspace_id,nos').eq('ativo',true);if(ativos.error)throw ativos.error;for(const f of ativos.data||[])if(f.nos?.some(n=>n.tipo==='nicho_atendimento'&&Array.isArray(n.dados?.coleta)))obter(f.workspace_id);
 }
 restaurar().catch(e=>console.error('[Universal configuração]',e.message));
 let retomando=false;
 async function retomar(){if(retomando)return;retomando=true;try{for(const ws of operacoes.keys()){
  const r=await db.from('fluxo_sessoes').select('*').eq('workspace_id',ws).eq('status','ativo').eq('tipo_input_aguardado','nicho_atendimento').limit(100);if(r.error)throw r.error;
  for(const row of r.data||[]){const s=parse(row.variaveis?.[KEY]);if(!s.retryEm||s.retryEm>Date.now()||filas.has(`${ws}:${row.canal_id}:${row.numero}`))continue;const c=await ctx.getConfigCanal(row.canal_id),sessao=ctx.sessoes[String(row.canal_id)];if(c?.workspaceId!==ws||c.tipo!=='webjs'||sessao?.status!=='conectado')continue;
   await ctx.executarFluxo(ws,row.canal_id,row.numero,'',async m=>{await require('../bko-roteamento.js').enviar(sessao.client,row.numero,m);await ctx.salvarMensagem(ws,row.canal_id,c.fila,row.numero,m,'bot','BOT',null);},row.fluxo_id);
  }
 }}finally{retomando=false;}}
 const timer=setInterval(()=>{restaurar().catch(e=>console.error('[Universal configuração]',e.message));retomar().catch(e=>console.error('[Universal retomada]',e.message));},60000);timer.unref();
 ctx.universalConfiguravel=true;
 return {obter,parar:()=>clearInterval(timer)};
};
