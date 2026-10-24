import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso, segredoInternoWolf, supabaseServer } from '../../../_auth';
import { exigirVendas, lerConfiguracaoVendas, NOME_CONFIG_VENDAS } from '../../_vendas';
import { validarConfigBko } from '../../../../lib/bko-grupoprime';
export const dynamic = 'force-dynamic';
async function acesso(request: NextRequest, ws: string) {
  const a = await autenticarWorkspace(request, ws);
  await exigirVendas(a,true);
  return a;
}
function erro(e: unknown) { const r=respostaErroAcesso(e);return NextResponse.json({success:false,error:r.status===500?'Não foi possível atualizar o BKO.':r.message},{status:r.status}); }
async function servidorUniversalPronto(){try{const r=await fetch((process.env.WHATSAPP_URL||process.env.NEXT_PUBLIC_WHATSAPP_URL||'https://api.wolfgyn.com.br')+'/universal/health',{headers:{'x-wolf-internal-secret':segredoInternoWolf()},cache:'no-store',signal:AbortSignal.timeout(4000)});const j=await r.json();return r.ok&&j.configuracao_multitenant===true;}catch{return false;}}
export async function GET(request: NextRequest) {
  try {
    const a=await acesso(request,request.nextUrl.searchParams.get('workspaceId')||'');
    if(request.nextUrl.searchParams.get('perfil')==='workspace'||a.workspaceId!=='grupoprime') {
      const salvo=await lerConfiguracaoVendas(a.workspaceId);
      let config=salvo?.nos?.[0]?.dados?.bko_configuracao;
      if(!config&&a.workspaceId==='grupoprime') { const legado=await supabaseServer.from('fluxos').select('nos').eq('workspace_id',a.workspaceId).eq('id',27).single();if(legado.error)throw legado.error;config=legado.data.nos.find((n:{id:string})=>n.id==='prime_documentos_enviar')?.dados?.bko_configuracao; }
      const [canais,filas]=await Promise.all([supabaseServer.from('conexoes').select('id,nome,tipo,status,modo').eq('workspace_id',a.workspaceId),supabaseServer.from('filas').select('id,nome,conexao').eq('workspace_id',a.workspaceId)]);if(canais.error)throw canais.error;if(filas.error)throw filas.error;
      return NextResponse.json({success:true,config:config||{ativo:false,canal_id:null,contatos:[],modo:'por_canal'},canais:canais.data,filas:filas.data,envios:[],fluxo_ativo:true,servidor_pronto:await servidorUniversalPronto(),waba_pronto:false,versao:salvo?.nos?.[0]?.dados?.versao||''});
    }
    const fluxoId=Number(request.nextUrl.searchParams.get('fluxoId')||27);if(![27,28].includes(fluxoId))throw Object.assign(Error('Fluxo inválido.'),{statusCode:400});
    const {data:f,error}=await supabaseServer.from('fluxos').select('nos,ativo').eq('workspace_id',a.workspaceId).eq('id',fluxoId).single();if(error)throw error;
    const config=f.nos.find((n: {id:string})=>n.id==='prime_documentos_enviar')?.dados?.bko_configuracao || {ativo:false,canal_id:null,contatos:[]};
    const {data:canais,error:ec}=await supabaseServer.from('conexoes').select('id,nome,tipo,status,modo').eq('workspace_id',a.workspaceId);if(ec)throw ec;
    let queryEnvios=supabaseServer.from('proposta').select('id,status_venda,dados_customizados,updated_at').eq('workspace_id',a.workspaceId);
    queryEnvios=fluxoId===27?queryEnvios.or('fluxo_id.eq.27,dados_customizados->>universal_v1.eq.SIM'):queryEnvios.eq('fluxo_id',28);
    const {data:envios,error:ee}=await queryEnvios.not('dados_customizados->>bko_pendente','is',null).order('updated_at',{ascending:false}).limit(20);if(ee)throw ee;
    const {data:piloto}=fluxoId===27?await supabaseServer.from('fluxos').select('ativo').eq('workspace_id',a.workspaceId).eq('id',29).maybeSingle():{data:null};
    const {data:filas,error:ef}=await supabaseServer.from('filas').select('id,nome,conexao').eq('workspace_id',a.workspaceId).order('nome');if(ef)throw ef;
    let servidor_pronto=false,waba_pronto=false;
    try {const r=await fetch(`${process.env.WHATSAPP_URL||process.env.NEXT_PUBLIC_WHATSAPP_URL||'https://api.wolfgyn.com.br'}/bko/health`,{headers:{'x-wolf-internal-secret':segredoInternoWolf()},cache:'no-store',signal:AbortSignal.timeout(4000)});if(r.ok){const j=await r.json();servidor_pronto=j.versao>=4&&(fluxoId===27||j.vero_fluxo===28);waba_pronto=!!(j.waba_assinatura&&j.waba_versao);}}catch{}
    return NextResponse.json({success:true,config,canais,filas,fluxo_ativo:f.ativo||!!piloto?.ativo,servidor_pronto,waba_pronto,envios:(envios||[]).map(p=>({id:p.id,status:p.status_venda,estado:p.dados_customizados?.bko_pendente,erro:p.dados_customizados?.bko_erro||'',referencia:p.dados_customizados?.bko_ref||''}))});
  }catch(e){return erro(e);}
}
export async function PATCH(request: NextRequest) {
  try {
    const texto=await request.text();if(texto.length>128000)return NextResponse.json({success:false,error:'Dados excedem o limite.'},{status:400});
    let body;try{body=JSON.parse(texto);}catch{return NextResponse.json({success:false,error:'JSON inválido.'},{status:400});}
    if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({success:false,error:'Dados inválidos.'},{status:400});
    const a=await acesso(request,String(body.workspaceId||''));
    if(body.perfil==='workspace'||a.workspaceId!=='grupoprime') {
      const config=validarConfigBko(body.config);
      if(config.canal_id){const r=await supabaseServer.from('conexoes').select('numero').eq('workspace_id',a.workspaceId).eq('id',config.canal_id).single();if(r.error)throw r.error;if(config.contatos.some(x=>x.numero===String(r.data.numero||'').replace(/\D/g,'')))throw Object.assign(Error('O próprio canal não pode ser o destinatário BKO.'),{statusCode:422});}
      for(const id of [config.canal_id,...config.contatos.map(x=>x.canal_trafego_id)].filter(Boolean)) { const r=await supabaseServer.from('conexoes').select('id').eq('workspace_id',a.workspaceId).eq('id',id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Object.assign(Error('Canal não pertence ao workspace.'),{statusCode:422}); }
      for(const regra of config.contatos) if(regra.fila_nome) { const r=await supabaseServer.from('filas').select('id').eq('workspace_id',a.workspaceId).eq('nome',regra.fila_nome).limit(1).maybeSingle();if(!r.data)throw Object.assign(Error('Fila não pertence ao workspace.'),{statusCode:422}); }
      const antigo=await lerConfiguracaoVendas(a.workspaceId),versao=randomUUID();
      if(antigo&&body.versao!==antigo.nos?.[0]?.dados?.versao)throw Object.assign(Error('A configuração foi alterada. Atualize a tela antes de salvar.'),{statusCode:409});
      const nos=[{id:'bko_workspace',tipo:'configuracao_vendas',dados:{bko_configuracao:config,versao}}];
      const gravacao=antigo?await supabaseServer.from('fluxos').update({nos}).eq('workspace_id',a.workspaceId).eq('id',antigo.id).eq('nos',JSON.stringify(antigo.nos)).select('id').maybeSingle():await supabaseServer.from('fluxos').insert({workspace_id:a.workspaceId,nome:NOME_CONFIG_VENDAS,ativo:false,trigger_tipo:'configuracao_vendas',nos,conexoes:[]}).select('id').single();
      if(gravacao.error)throw gravacao.error;if(!gravacao.data)throw Object.assign(Error('Configuração mudou. Atualize a tela.'),{statusCode:409});
      return NextResponse.json({success:true,config,versao});
    }
    const fluxoId=Number(body.fluxoId||27);if(![27,28].includes(fluxoId))throw Object.assign(Error('Fluxo inválido.'),{statusCode:400});
    if(body.acao==='retentar'){
      if(!Number.isSafeInteger(body.proposta_id)||body.proposta_id<=0)throw Object.assign(new Error('Venda inválida.'),{statusCode:422});
      const {data:p,error:ep}=await supabaseServer.from('proposta').select('id,status_venda,dados_customizados,updated_at').eq('workspace_id',a.workspaceId).eq('fluxo_id',fluxoId).eq('id',body.proposta_id).maybeSingle();if(ep)throw ep;
      if(!p||p.status_venda!=='AGUARDANDO AUDITORIA'||p.dados_customizados?.bko_pendente!=='REVISAR')throw Object.assign(new Error('Venda não está aguardando revisão do envio.'),{statusCode:409});
      const custom=JSON.parse(JSON.stringify(p.dados_customizados));let meta;
      try{meta=JSON.parse(custom.bko_envio||'{}');}catch{throw Object.assign(new Error('Registro de envio inválido. Encaminhe ao suporte.'),{statusCode:422});}
      for(const dest of Object.values(meta.destinatarios||{}) as {partes:{estado:string}[]}[])for(const parte of dest.partes||[])if(parte.estado==='em_envio'||parte.estado==='erro')parte.estado='pendente';
      meta.lease=null;custom.bko_envio=JSON.stringify(meta);custom.bko_pendente='SIM';custom.bko_erro='';
      custom.bko_retentativa={por:a.email,em:new Date().toISOString()};
      const {data:atualizado,error:er}=await supabaseServer.from('proposta').update({dados_customizados:custom,updated_at:new Date().toISOString()}).eq('workspace_id',a.workspaceId).eq('id',p.id).eq('status_venda',p.status_venda).eq('updated_at',p.updated_at).select('id').maybeSingle();if(er)throw er;
      if(!atualizado)throw Object.assign(new Error('A venda foi alterada. Recarregue a tela.'),{statusCode:409});
      return NextResponse.json({success:true});
    }
    const config=validarConfigBko(body.config);
    if(config.ativo&&config.modo!=='por_canal')throw Object.assign(new Error('Atualize a tela e configure uma regra por canal de entrada.'),{statusCode:422});
    if(config.canal_id){const {data:c}=await supabaseServer.from('conexoes').select('id,numero').eq('workspace_id',a.workspaceId).eq('id',config.canal_id).maybeSingle();if(!c)throw Object.assign(new Error('Canal não pertence ao workspace.'),{statusCode:422});if(config.contatos.some(x=>x.numero===String(c.numero||'').replace(/\D/g,'')))throw Object.assign(new Error('O próprio canal não pode ser um destinatário BKO.'),{statusCode:422});}
    const regras=config.modo==='por_canal'?config.contatos:[config];
    for(const regra of regras){
      if(config.ativo&&(!regra.canal_trafego_id||!regra.fila_nome))throw Object.assign(new Error('Selecione o canal e a fila de entrada de cada regra.'),{statusCode:422});
      if(regra.canal_trafego_id){const {data:c}=await supabaseServer.from('conexoes').select('id').eq('workspace_id',a.workspaceId).eq('id',regra.canal_trafego_id).maybeSingle();if(!c)throw Object.assign(new Error('Canal de tráfego não pertence ao workspace.'),{statusCode:422});}
      if(regra.fila_nome){const {data:fila}=await supabaseServer.from('filas').select('id').eq('workspace_id',a.workspaceId).eq('nome',regra.fila_nome).limit(1).maybeSingle();if(!fila)throw Object.assign(new Error('Fila não pertence ao workspace.'),{statusCode:422});}
    }
    const {data:f,error}=await supabaseServer.from('fluxos').select('nos').eq('workspace_id',a.workspaceId).eq('id',fluxoId).single();if(error)throw error;
    const indice=f.nos.findIndex((n:{id:string})=>n.id==='prime_documentos_enviar');if(indice<0)throw Error('Vendedor ausente');
    const anterior=f.nos[indice].dados.bko_versao;
    const nos=f.nos.map((n:{id:string;dados:Record<string,unknown>})=>n.id==='prime_documentos_enviar'?{...n,dados:{...n.dados,bko_configuracao:config,bko_versao:randomUUID()}}:n);
    let gravar=supabaseServer.from('fluxos').update({nos}).eq('workspace_id',a.workspaceId).eq('id',fluxoId);
    gravar=anterior?gravar.eq(`nos->${indice}->dados->>bko_versao`,anterior):gravar.is(`nos->${indice}->dados->>bko_versao`,null);
    const {data:salvo,error:es}=await gravar.select('id').maybeSingle();if(es)throw es;
    if(!salvo)return NextResponse.json({success:false,error:'O fluxo foi alterado. Recarregue antes de salvar.'},{status:409});
    return NextResponse.json({success:true,config});
  }catch(e){return erro(e);}
}
