'use strict';
// Auditoria somente leitura. Snapshot privado permanece no diretório temporário do usuário.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const dir=process.env.WOLF_AUDITORIA_DIR||path.join(os.tmpdir(),'wolf-auditoria-grupoprime-20261026');fs.mkdirSync(dir,{recursive:true});
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const key=(c,n)=>String(c)+'|'+String(n),norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
async function coletar(){
 process.loadEnvFile(path.join(process.cwd(),'.env.local'));
 const db=require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const resultado={coletadoEm:new Date().toISOString(),workspace:'grupoprime',somenteLeitura:true};
 await Promise.all(['atendimentos','mensagens','fluxo_sessoes','proposta','fluxos'].map(async tabela=>{
  const topo=await db.from(tabela).select('id').eq('workspace_id','grupoprime').order('id',{ascending:false}).limit(1);if(topo.error)throw topo.error;
  const limite=topo.data[0]?.id||0,rows=[];
  for(let inicio=0;;inicio+=500){const r=await db.from(tabela).select('*').eq('workspace_id','grupoprime').lte('id',limite).order('id',{ascending:true}).range(inicio,inicio+499);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}
  if(tabela==='fluxos')for(const f of rows)for(const no of f.nos||[])if(no.dados){delete no.dados.apiKey;delete no.dados.api_key;}
  resultado[tabela]=rows;console.log(JSON.stringify({tabela,total:rows.length,ateId:limite}));
 }));
 fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify(resultado),{mode:0o600});return resultado;
}
function analisar(d){
 const conv=new Map(),sessoes=new Map(),vendas=new Map(),agora=Date.now(),casos=[];
 for(const m of d.mensagens){const k=key(m.canal_id,m.numero);if(!conv.has(k))conv.set(k,[]);conv.get(k).push(m);}
 for(const s of d.fluxo_sessoes){const k=key(s.canal_id,s.numero);if(!sessoes.has(k))sessoes.set(k,[]);sessoes.get(k).push(s);}
 for(const p of d.proposta){const c=parse(p.dados_customizados),k=key(p.canal_id,c.numero_origem_whatsapp);if(!vendas.has(k))vendas.set(k,[]);vendas.get(k).push(p);}
 const freq=(rows,k)=>rows.reduce((r,x)=>(r[x[k]??'(vazio)']=(r[x[k]??'(vazio)']||0)+1,r),{}),fl=new Map(d.fluxos.map(f=>[f.id,f]));
 for(const at of d.atendimentos){
  const k=key(at.canal_id,at.numero),msgs=(conv.get(k)||[]).filter(m=>m.de!=='sistema').sort((a,b)=>a.id-b.id),ss=(sessoes.get(k)||[]).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)),row=ss[0],ext=parse(row?.variaveis?.__universal_v2||row?.variaveis?.__universal_v1),s=ext.aberturaConcluida?ext:(ext.nio||ext),pedidos=vendas.get(k)||[],last=msgs.at(-1),bot=msgs.filter(m=>m.de==='bot'),flags=[],historicos=[];
  const fechado=at.status==='resolvido',humano=!!at.atendente&&at.atendente!=='BOT',bloqueado=at.bloqueado_ia||at.bloqueado_fluxo||at.bloqueado_contato,esperaMin=last?Math.round((agora-Date.parse(last.created_at))/60000):null;
  if(!fechado&&!humano&&!bloqueado&&last?.de==='cliente'&&esperaMin>10)flags.push('CLIENTE_SEM_RESPOSTA');
  if(!fechado&&!humano&&!bloqueado&&(ext.retryEm||ext.pendentes?.length||s.retryEm||s.pendentes?.length))flags.push('RETENTATIVA_OU_ENTRADA_PENDENTE');
  if(!fechado&&!humano&&!bloqueado&&(ext.encerrado||s.etapa==='encerrado'||row?.status==='finalizado'&&!pedidos.length))flags.push('ENCERRAMENTO_INCONSISTENTE');
  if(!fechado&&!humano&&!bloqueado&&row?.status==='ativo'&&!row.no_atual&&!ext.proposta_id&&!s.proposta_id&&!ext.concluido)flags.push('SEM_PONTEIRO_DE_FLUXO');
  if((ext.lembretes?.enviados||0)>=5&&!fechado&&!pedidos.length)flags.push('CINCO_LEMBRETES_SEM_ENCERRAR');
  for(const p of pedidos){const c=parse(p.dados_customizados);if(c.universal_acoes?.some(a=>!['enviado','cancelado'].includes(a.estado)))flags.push('POS_VENDA_PENDENTE');if(c.bko_pendente==='SIM')flags.push('VENDA_AGUARDANDO_ENVIO_BKO');}
  const repetidas=[];for(let i=1;i<bot.length;i++){const antes=bot.slice(Math.max(0,i-5),i).find(m=>norm(m.mensagem)===norm(bot[i].mensagem));if(antes&&norm(bot[i].mensagem).length>30&&msgs.some(m=>m.de==='cliente'&&m.id>antes.id&&m.id<bot[i].id))repetidas.push({antes:antes.id,depois:bot[i].id,texto:bot[i].mensagem.slice(0,400)});}
  if(repetidas.length)historicos.push('RESPOSTAS_REPETIDAS');
  if(bot.some(m=>/instabilidade|temporariamente indisponível|não processado|nao processado/i.test(m.mensagem)))historicos.push('FALHA_TECNICA_OU_MIDIA');
  if(bot.some(m=>/localidade diferente|corresponde a.*mas a instalação|CEP retornou/i.test(m.mensagem)))historicos.push('DIVERGENCIA_LOCALIDADE');
  const fim=bot.filter(m=>/vou (?:encerrar|finalizar) (?:o |seu )?atendimento|encerrei (?:o |seu )?atendimento/i.test(m.mensagem)).at(-1);
  if(fim&&!fechado&&last?.id===fim.id)flags.push('ANUNCIOU_ENCERRAMENTO_MAS_ABERTO');
  const item={id:at.id,canal:at.canal_id,status:at.status,atendente:at.atendente,fechado,humano,bloqueado:!!bloqueado,sessao:row?.id,sessaoStatus:row?.status,fluxo:row?.fluxo_id,etapa:s.pendente||s.etapa,quantidadeMensagens:msgs.length,ultimaDe:last?.de,esperaMin,flags:[...new Set(flags)],historicos,repeticoes:repetidas.length,erro:ext.erro||s.erro,propostas:pedidos.map(p=>({id:p.id,operadora:p.operadora,status:p.status_venda})),agendadoPara:ext.lembretes?.agendadoPara||s.lembretes?.agendadoPara,lembretes:ext.lembretes?.enviados??s.lembretes?.enviados??0};
  casos.push(item);
 }
 const resumo={coletadoEm:d.coletadoEm,auditadoEm:new Date().toISOString(),totais:{atendimentos:d.atendimentos.length,mensagens:d.mensagens.length,sessoes:d.fluxo_sessoes.length,vendas:d.proposta.length},status:freq(d.atendimentos,'status'),canais:freq(d.atendimentos,'canal_id'),flags:{},historicos:{},camposAtendimento:Object.keys(d.atendimentos[0]||{}),conversas:conv.size};
 for(const c of casos){for(const f of c.flags)resumo.flags[f]=(resumo.flags[f]||0)+1;for(const f of c.historicos)resumo.historicos[f]=(resumo.historicos[f]||0)+1;}
 fs.writeFileSync(path.join(dir,'casos.json'),JSON.stringify(casos),{mode:0o600});fs.writeFileSync(path.join(dir,'resumo.json'),JSON.stringify(resumo,null,2),{mode:0o600});console.log(JSON.stringify(resumo));console.log(JSON.stringify({pendentes:casos.filter(c=>c.flags.length),diretorioPrivado:dir}));
}
(async()=>{const d=process.argv.includes('--coletar')?await coletar():JSON.parse(fs.readFileSync(path.join(dir,'snapshot.json')));analisar(d);})().catch(e=>{console.error(e.message||String(e));process.exitCode=1;});
