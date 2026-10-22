'use strict';
const regras=require('./roteiro-vendas.js');
const{cpfValido}=require('./venda-fluida-regras.js');
const{normalizarData}=require('./datas-flexiveis.js');
async function processar({fluxo,no,variaveis,entrada,processarInput,fnEnviar,conversar,proximoNoId}){
 if(fluxo.workspace_id!=='grupoprime'||![27,28].includes(Number(fluxo.id))||!no.dados.roteiro_vendas_v3||!['prime_vendedor','prime_endereco_ia','prime_cadastro_ia'].includes(no.id))return null;
 const chave='__roteiro_vendas_v3_'+no.id,e=regras.parse(variaveis[chave]);
 const executar=()=>regras.decidir({no:{...no,fluxo_id:fluxo.id},vars:variaveis,estado:e,mensagem:entrada,entrada:processarInput,cpfValido,normalizarData});
 let r=executar();
 if(r.consultar){
  const q=no.dados.consultas?.find(c=>['prime_viabilidade','vero_viabilidade'].includes(c.id));if(!q)throw Error('Consulta oficial não configurada');
  const url=new URL(String(q.url).replace(/{{cep}}/g,encodeURIComponent(variaveis.cep)));
  if(url.origin!=='https://app.wolfgyn.com.br'||!url.pathname.startsWith('/api/viabilidade/'))throw Error('API fora do escopo');
  url.searchParams.set('cep',variaveis.cep);if(variaveis.cidade)url.searchParams.set('cidade',variaveis.cidade);
  const headers=typeof q.headers==='string'?JSON.parse(q.headers):q.headers;
  let dados;
  for(let tentativa=0;tentativa<2;tentativa++)try{
   const resp=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});dados=await resp.json();if(!resp.ok||dados.success===false)throw Error('Consulta não confirmada');break;
  }catch(erro){if(tentativa===1){variaveis[chave]=JSON.stringify({...e,consultaPendente:true});await fnEnviar('A consulta de disponibilidade não respondeu agora. Seu CEP ficou salvo; não vou informar uma oferta sem confirmar os dados.');return{aguardarInput:true};}}
  variaveis.resposta_viabilidade=JSON.stringify(dados);r=executar();
 }
 if(r.conversar){
  const estado={historico:e.historico||[],valores_coletados:{},consultas:{},contexto_consultas:{disponibilidade:variaveis.resposta_viabilidade}};
  let resposta;
  try{resposta=await conversar({...no.dados,consultas:[],prompt:no.dados.prompt+'\nRESPONDA APENAS À DÚVIDA/OBJEÇÃO ATUAL, sem repetir catálogo, sem pedir documentos fora da etapa e sem declarar venda concluída. Use apenas os planos e benefícios oficiais fornecidos. Volte com uma pergunta curta ao ponto pendente. Nenhum dado seu pode avançar a etapa. Dados atuais: '+JSON.stringify(variaveis)},JSON.parse(JSON.stringify(variaveis)),entrada,estado);}catch{}
  r={mensagem:resposta?.mensagem||'Entendi. O que está pesando para você: o valor, as condições ou alguma dúvida sobre o plano? Posso ajudar a comparar as opções disponíveis.'};
 }
 if(r.avancar){delete variaveis[chave];return{proximoNoId};}
 if(!r.mensagem)throw Error('Etapa comercial sem próxima ação');
 if(no.id==='prime_cadastro_ia'&&!e.iniciou){e.iniciou=true;if(!r.mensagem.startsWith('Agora vou começar')&&!r.mensagem.startsWith('📋'))r.mensagem='Agora vou começar seu cadastro. '+r.mensagem;}
 e.historico=[...(e.historico||[]),...(processarInput?[{role:'user',content:entrada}]:[]),{role:'assistant',content:r.mensagem}].slice(-30);
 variaveis[chave]=JSON.stringify(e);await fnEnviar(r.mensagem);return{aguardarInput:true};
}
module.exports={processar};
