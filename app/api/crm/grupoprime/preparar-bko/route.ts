import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { autenticarWorkspace, exigirPermissao, respostaErroAcesso, supabaseServer } from '../../../_auth';
import { documentosDaSessaoGrupoPrime } from '../_documentos';
import { prepararPedidoFluido } from '../../../../lib/pedido-fluido';
import { consultarViabilidade } from '../../../../lib/viabilidade-grupoprime';
import { consultarVero } from '../../../../lib/vero';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({versao:'venda-fluida-v1',roteiro_comercial:3},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){
 const responder=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 try{
  const texto=await req.text();if(texto.length>1000)return responder({success:false,error:'Dados inválidos.'},400);
  let body;try{body=JSON.parse(texto);}catch{return responder({success:false,error:'JSON inválido.'},400);}
  if(!['Nio','Vero'].includes(body?.operadora))return responder({success:false,error:'Operadora inválida.'},400);
  const vero=body.operadora==='Vero',token=req.headers.get('x-wolf-documentos-token');
  if(token!==null){const segredo=process.env.WOLF_VIABILIDADE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!segredo)throw Object.assign(Error('Integração não configurada.'),{statusCode:503});const esperado=createHmac('sha256',segredo).update(vero?'wolf:documentos:grupoprime:vero:v1':'wolf:documentos:grupoprime:v1').digest('hex');if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(esperado)))throw Object.assign(Error('Credencial inválida.'),{statusCode:401});}
  else{const acesso=await autenticarWorkspace(req,'grupoprime');exigirPermissao(acesso,'configuracoes_workspace');}
  const propostaId=body.proposta_id===undefined?undefined:Number(body.proposta_id);
  if(propostaId!==undefined&&(!Number.isSafeInteger(propostaId)||propostaId<=0))return responder({success:false,error:'Pedido inválido.'},400);
  const d=await documentosDaSessaoGrupoPrime(supabaseServer,body.numero,'',propostaId,vero,true);
  let consulta:any=null;const pendencias=[...d.pendencias];
  try{consulta=vero?await consultarVero(d.variaveis.cep):consultarViabilidade(d.variaveis.cep);}catch{pendencias.push('Reconsulta de viabilidade indisponível; conferir no BKO.');}
  const preparado=prepararPedidoFluido(d.variaveis,consulta,body.operadora,pendencias);
  if(propostaId){
   const{data:anterior,error}=await supabaseServer.from('proposta').select('*').eq('workspace_id','grupoprime').eq('fluxo_id',vero?28:27).eq('canal_id',d.sessao.canal_id).eq('id',propostaId).single();if(error||!anterior)throw Object.assign(Error('Pedido não pertence ao atendimento.'),{statusCode:409});
   const origem=String(anterior.dados_customizados?.numero_origem_whatsapp||'').replace(/\D/g,'');if(origem!==String(d.sessao.numero).replace(/\D/g,''))throw Object.assign(Error('Origem do pedido divergente.'),{statusCode:409});
   if(anterior.status_venda!=='CPF REPROVADO'){
    const historico=anterior.dados_customizados?.recuperacao_bko_historico,ultima=Array.isArray(historico)?historico[historico.length-1]:null;
    if(anterior.status_venda==='AGUARDANDO AUDITORIA'&&ultima?.sessao_id===d.sessao.id)return responder({success:true,proposta_id:propostaId,sessao_id:d.sessao.id,ja_atualizada:true});
    throw Object.assign(Error('O BKO já alterou o status deste pedido. Os documentos foram preservados.'),{statusCode:409});
   }
   if(preparado.cadastro.cpf&&preparado.cadastro.cpf===String(anterior.cpf||'').replace(/\D/g,'')){preparado.pendencias.push('O CPF informado continua sendo o CPF reprovado; confirmar novo titular.');preparado.cadastro.pendencias_bko=JSON.stringify(preparado.pendencias);}
   const dados={...(anterior.dados_customizados||{}),venda_fluida_v1:'SIM',bko_pendente:'SIM',pendencias_bko:preparado.cadastro.pendencias_bko,cadastro_informado_json:preparado.cadastro.cadastro_informado_json,preferencia_instalacao:String(d.variaveis.periodo_instalacao||'')};
   for(const k of ['bko_envio','bko_ref','bko_reply_ids','bko_erro','bko_tentar_em'])delete dados[k];
   for(const k of ['rg_frente','rg_verso','comprovante_endereco'])dados[k]=d.documentos[k]||[];
   dados.recuperacao_bko_historico=[...(Array.isArray(dados.recuperacao_bko_historico)?dados.recuperacao_bko_historico:[]),{em:new Date().toISOString(),cpf_anterior:anterior.cpf,cpf_informado:preparado.cadastro.cpf,sessao_id:d.sessao.id}];
   const colunas=['nome','cpf','data_nascimento','nome_mae','rg','email','telefone1','telefone2','vencimento','forma_pagamento','cep','cidade','estado','endereco','plano','valor_plano','operadora'];
   const atualizacao:Record<string,unknown>={status_venda:'AGUARDANDO AUDITORIA',dados_customizados:dados,updated_at:new Date().toISOString()};
   for(const k of colunas){const v=(preparado.cadastro as Record<string,unknown>)[k];if(v!==''&&v!==undefined)atualizacao[k]=v;}
   let q=supabaseServer.from('proposta').update(atualizacao).eq('workspace_id','grupoprime').eq('id',propostaId);if(anterior.updated_at)q=q.eq('updated_at',anterior.updated_at);
   const r=await q.select('id').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Object.assign(Error('Pedido foi alterado durante a atualização. Os anexos foram preservados.'),{statusCode:409});
   return responder({success:true,proposta_id:propostaId,sessao_id:d.sessao.id,documentos:d.documentos,...preparado});
  }
  return responder({success:true,sessao_id:d.sessao.id,documentos:d.documentos,...preparado});
 }catch(e){const{status,message}=respostaErroAcesso(e);return responder({success:false,error:status===500?'Não foi possível preparar o pedido. Os dados permanecem salvos.':message},status);}
}
