'use strict';
// Scoped migration for active pilot conversations; private backups and optimistic locking.
const fs=require('node:fs'),path=require('node:path');
const root=process.argv.find(v=>v.startsWith('--root='))?.slice(7)||'/root/wolf-whatsapp';
const motor=process.argv.find(v=>v.startsWith('--motor='))?.slice(8)||path.join(root,'src/services/universal-v1');
const aplicar=process.argv.includes('--aplicar'),enviar=process.argv.includes('--enviar');
require(require.resolve('dotenv',{paths:[root]})).config({path:path.join(root,'.env'),quiet:true});
const {createClient}=require(require.resolve('@supabase/supabase-js',{paths:[root]}));
const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_KEY);
const {avancar}=require(path.join(motor,'conversa.cjs')),{criarConsulta}=require(path.join(motor,'vtal.cjs')),{localidadeDaBase}=require(path.join(motor,'descoberta-vtal.cjs')),{planosDaCidade}=require(path.join(motor,'planos-grupoprime.cjs'));
const parse=v=>typeof v==='string'?JSON.parse(v):v||{};
(async()=>{
 const {data:rows,error}=await db.from('fluxo_sessoes').select('*').eq('workspace_id','grupoprime').eq('status','ativo').in('canal_id',[164,165]).in('fluxo_id',[29,31]).limit(500);if(error)throw error;
 const {data:flows,error:ef}=await db.from('fluxos').select('id,nos').eq('workspace_id','grupoprime').in('id',[29,31]);if(ef)throw ef;
 const consulta=criarConsulta({diretorio:path.join(root,'src/services/universal-v1/indice-vtal')}),report=[];
 for(const row of rows){
  const vars=row.variaveis||{},v2=!!vars.__universal_v2,externo=parse(v2?vars.__universal_v2:vars.__universal_v1),s=externo.nio||externo;
  if(!s.dados||s.proposta_id||externo.proposta_id||s.resolucaoEnderecoV2||externo.aberturaConcluida||!['localidade','cep','complemento','endereco'].includes(s.etapa))continue;
  if(s.etapa==='localidade'&&!s.dados.cidade)continue;
  if(s.etapa==='cep'&&!s.dados.logradouro)continue;
  const {data:at,error:ea}=await db.from('atendimentos').select('status,bloqueado_ia,bloqueado_fluxo').eq('workspace_id','grupoprime').eq('canal_id',row.canal_id).eq('numero',row.numero).maybeSingle();if(ea)throw ea;
  if(!at||at.status==='finalizado'||at.bloqueado_ia||at.bloqueado_fluxo)continue;
  if(!s.dados.estado&&!localidadeDaBase(s.dados.cidade)){
   const cidadeAnterior=[...(s.historico||[])].reverse().filter(h=>h.role==='user').map(h=>localidadeDaBase(String(h.content).trim())).find(Boolean);
   if(cidadeAnterior){s.dados.bairro=s.dados.bairro||s.dados.cidade;s.dados.cidade=cidadeAnterior.cidade;s.dados.estado=cidadeAnterior.estado;}
  }
  delete s.consultaChave;
  const flow=flows.find(f=>f.id===row.fluxo_id),nicho=flow?.nos.find(n=>n.tipo==='nicho_atendimento')?.dados||{},assistente=flow?.nos.find(n=>n.tipo==='assistente_universal')?.dados||{};
  const vero=row.fluxo_id===31?require(path.join(motor,'vero.cjs')).criarVero({consultaVtal:consulta,estado:s,politica:nicho.vero_config}):null;
  const r=await avancar({estado:s,entrada:'',numero:row.numero,extrair:async()=>({dados:{}}),consultar:vero?.consultar||consulta,catalogo:vero?.catalogo||planosDaCidade,config:{...assistente,promptNicho:nicho.prompt}});
  if(r.estado.consulta?.status==='consulta_inconclusiva'||r.acao==='registrar')continue;
  if(r.estado.etapa===s.etapa&&JSON.stringify(r.estado.dados)===JSON.stringify(s.dados)&&r.estado.consulta?.status===s.consulta?.status&&s.etapa==='localidade')continue;
  const item={id:row.id,canal:row.canal_id,etapaAnterior:s.etapa,etapa:r.estado.etapa,consulta:r.estado.consulta?.status,mensagem:r.mensagem};report.push(item);console.log(JSON.stringify(item));
  if(!aplicar)continue;
  const backup=path.join(root,'backups',`endereco-v2-sessao-${row.id}-${Date.now()}.json`);fs.writeFileSync(backup,JSON.stringify(row),{mode:0o600});
  const novo=r.estado;novo.pendentes=[];delete novo.retryEm;delete novo.instabilidadeAvisada;delete novo.erro;novo.resolucaoEnderecoV2=new Date().toISOString();
  if(externo.nio){externo.nio=novo;externo.dados={...externo.dados,...novo.dados};externo.pendentes=[];delete externo.retryEm;delete externo.instabilidadeAvisada;}
  const estado=externo.nio?externo:novo;
  const atualizado=await db.from('fluxo_sessoes').update({variaveis:{...vars,...novo.dados,[v2?'__universal_v2':'__universal_v1']:JSON.stringify(estado)}}).eq('id',row.id).eq('workspace_id','grupoprime').eq('canal_id',row.canal_id).eq('updated_at',row.updated_at).select('id,updated_at');if(atualizado.error)throw atualizado.error;if(atualizado.data.length!==1){console.log('CONCORRENCIA',row.id);continue;}
  if(!enviar)continue;
  const antes=await db.from('fluxo_sessoes').select('updated_at').eq('id',row.id).eq('workspace_id','grupoprime').single();if(antes.error)throw antes.error;if(antes.data.updated_at!==atualizado.data[0].updated_at){console.log('NOVA_ENTRADA',row.id);continue;}
  const manual=await db.from('atendimentos').select('status,bloqueado_ia,bloqueado_fluxo').eq('workspace_id','grupoprime').eq('canal_id',row.canal_id).eq('numero',row.numero).maybeSingle();if(manual.error)throw manual.error;if(!manual.data||manual.data.status==='finalizado'||manual.data.bloqueado_ia||manual.data.bloqueado_fluxo)continue;
  const recibo=backup+'.envio';fs.writeFileSync(recibo,JSON.stringify({status:'iniciado'}),{mode:0o600,flag:'wx'});
  const resp=await fetch('http://127.0.0.1:3001/enviar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({numero:row.numero,mensagem:r.mensagem,canalId:row.canal_id,workspaceId:'grupoprime'}),signal:AbortSignal.timeout(45000)});
  const j=await resp.json();fs.writeFileSync(recibo,JSON.stringify(j),{mode:0o600});console.log('ENVIO',row.id,JSON.stringify(j));if(!j.success)continue;
  if(j.providerMessageId){const up=await db.from('mensagens').update({de:'bot'}).eq('workspace_id','grupoprime').eq('canal_id',row.canal_id).eq('numero',row.numero).eq('provider_message_id',j.providerMessageId);if(up.error)throw up.error;}
  const atual=await db.from('fluxo_sessoes').select('variaveis,updated_at').eq('id',row.id).eq('workspace_id','grupoprime').single();if(atual.error)throw atual.error;
  const st=parse(atual.data.variaveis[v2?'__universal_v2':'__universal_v1']),interno=st.nio||st;
  if(interno.resolucaoEnderecoV2!==novo.resolucaoEnderecoV2)continue;
  interno.historico=[...interno.historico,{role:'assistant',content:r.mensagem}].slice(-40);interno.resolucaoEnderecoEnvio=j.providerMessageId||'confirmado';
  await db.from('fluxo_sessoes').update({variaveis:{...atual.data.variaveis,[v2?'__universal_v2':'__universal_v1']:JSON.stringify(st)}}).eq('id',row.id).eq('workspace_id','grupoprime').eq('updated_at',atual.data.updated_at);
  if(r.acao==='encerrar'){const fim=await db.from('atendimentos').update({status:'finalizado',bloqueado_ia:true,bloqueado_fluxo:true,bloqueado_typebot:true}).eq('workspace_id','grupoprime').eq('canal_id',row.canal_id).eq('numero',row.numero);if(fim.error)throw fim.error;}
 }
 const arq=path.join(root,'backups',`auditoria-endereco-v2-${Date.now()}.json`);fs.writeFileSync(arq,JSON.stringify(report),{mode:0o600});console.log('TOTAL',report.length,'APLICAR',aplicar,'ENVIAR',enviar,'RELATORIO',arq);
})().catch(e=>{console.error(e.message);process.exitCode=1});
