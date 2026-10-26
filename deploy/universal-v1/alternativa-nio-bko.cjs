'use strict';
const {normalizar,interpretarEndereco,parte,criarConsulta,corresponde,viavel}=require('./vtal.cjs');
const {planosDaCidade}=require('./planos-grupoprime.cjs');
const {escolherPlano,resumo}=require('./conversa.cjs');
const {randomBytes}=require('node:crypto');
const VERSAO_CONSULTA=2;
const pendente=c=>['verificar_configuracao','consultar','consulta_inconclusiva'].includes(c.universal_alternativa_nio?.estado);
const precisaConferir=(p,c)=>normalizar(p.operadora)==='VERO'&&p.status_venda==='SEM DISPONIBILIDADE'&&(!c.universal_alternativa_nio||(['sem_disponibilidade','conferencia_endereco'].includes(c.universal_alternativa_nio.estado)&&Number(c.universal_alternativa_nio.versao_consulta||0)<VERSAO_CONSULTA));
function endereco(p,c){
 const vars=c.universal_variaveis||{},r=c.vtal?.resultados?.[0]||{},comps=[r.complemento1,r.complemento2,r.complemento3].join(' '),e={...interpretarEndereco(p.endereco||'')};
 for(const k of ['logradouro','quadra','lote','numero','casa','apartamento','bloco','bairro'])if(vars[k]&&(k!=='numero'||/^\d{1,6}[A-Z]?$/i.test(vars[k])))e[k]=vars[k];
 if(r.logradouro)e.logradouro=r.logradouro;
 for(const k of ['quadra','lote','casa','apartamento','bloco'])e[k]=e[k]||parte([r.logradouro,comps].join(' '),k);
 e.numero=e.numero||parte(comps,'numero')||(!/^(?:|SN|S\/N)$/i.test(r.numero||'')?r.numero:'')||parte(p.endereco||'','numero');
 if(!/^\d{1,6}[A-Z]?$/i.test(e.numero||''))e.numero='';
 if(!e.numero){const n=String(p.endereco||'').match(/\b(\d{1,6}[A-Z]?)\s+(?:casa|apartamento|apto|fundos|esquina)\b/i);if(n)e.numero=n[1];}
 return {...e,cep:p.cep||c.vtal?.cep||vars.cep||'',cidade:p.cidade||vars.cidade||'',uf:p.estado||vars.estado||'',bairro:p.bairro||c.bairro||e.bairro||''};
}
function mensagemOfertas(p,a){return `A equipe informou que não foi possível atender seu pedido pela Vero nesse endereço. Consultei a rede neutra e encontrei disponibilidade da *Nio*. Podemos aproveitar os dados e documentos que você já enviou. 😊\n\n${a.ofertas.map((o,i)=>`${i+1}. *${o.nome}* · ${o.velocidade_mbps===1000?'1 Giga':o.velocidade_mbps+' Mega'} · *R$ ${o.mensalidade.toFixed(2).replace('.',',')}/mês*`).join('\n')}\n\nQual plano da Nio você prefere para continuarmos o pedido?`;}
function criar({db,workspace,consultar=criarConsulta(),catalogo=planosDaCidade,agora=Date.now}){
 async function habilitado(p){const f=await db.from('fluxos').select('nos').eq('workspace_id',workspace).eq('id',p.fluxo_id).maybeSingle();if(f.error)throw f.error;return f.data?.nos?.some(n=>n.tipo==='nicho_atendimento'&&n.dados?.integracao==='vero_vtal'&&n.dados?.alternativa_nio_bko?.ativo===true);}
 function preparar(p,c){if(!precisaConferir(p,c))return false;c.universal_acoes||=[];if(c.universal_alternativa_nio){c.universal_alternativa_nio.consulta_anterior=c.universal_alternativa_nio.consulta;c.universal_alternativa_nio.estado='verificar_configuracao';}else c.universal_alternativa_nio={estado:'verificar_configuracao',origem:{operadora:p.operadora,plano:p.plano,valor_plano:p.valor_plano,bko_ref:c.bko_ref},criado_em:new Date(agora()).toISOString()};return true;}
 async function conferir(p,c){
  const a=c.universal_alternativa_nio;if(!pendente(c)||Number(a.tentarEm)>agora())return false;
  try{
   if(!await habilitado(p)){a.estado='desativada';return true;}
   if(normalizar(p.operadora)!=='VERO'||p.status_venda!=='SEM DISPONIBILIDADE'){a.estado='cancelada';return true;}
   a.estado='consultar';let e=endereco(p,c);a.endereco=e;
   if(!e.cidade||!e.uf||(!e.cep&&!e.logradouro))throw Error('Endereço salvo incompleto para a consulta');
   let r=await consultar(e);a.consultas=[{endereco:e,status:r.status}];
   if(['nao_localizado','endereco_nao_localizado','logradouro_nao_localizado','confirmar_logradouro'].includes(r.status)&&e.cep&&e.logradouro){
    // O único logradouro do CEP é a referência canônica; número e bairro continuam obrigatórios.
    const rua=r.logradouros?.length===1?r.logradouros[0]:null;
    const canonico=rua&&e.numero&&e.bairro?{...e,logradouro:rua}:{...e,cep:''};
    const outro=await consultar(canonico);a.consultas.push({endereco:canonico,status:outro.status});
    const registros=outro.resultados||[];
    const exatos=registros.length&&registros.every(x=>corresponde(x,canonico)&&normalizar(x.cidade)===normalizar(e.cidade)&&normalizar(x.uf)===normalizar(e.uf)&&(!e.bairro||normalizar(x.bairro)===normalizar(e.bairro)));
    if(outro.status==='consulta_inconclusiva'||exatos){r=outro;e=canonico;a.endereco=e;if(rua)a.observacao_logradouro=`O CEP ${p.cep} identifica ${rua} na VTAL; endereço informado: ${p.endereco}. Número e bairro conferidos na consulta.`;}
   }
   a.consulta=r;a.consultado_em=new Date(agora()).toISOString();a.versao_consulta=VERSAO_CONSULTA;
   if(r.status==='consulta_inconclusiva')throw Error(r.erro||'Consulta VTAL temporariamente indisponível');
   // Várias casas no mesmo número não impedem a oferta quando todas são viáveis.
   // A unidade técnica continua pendente, sem escolher uma casa pelo cliente.
   const unidadesViaveis=r.status==='endereco_ambiguo'&&e.logradouro&&e.numero&&r.resultados?.length>1&&r.resultados.every(x=>corresponde(x,e)&&viavel(x)&&normalizar(x.cidade)===normalizar(e.cidade)&&normalizar(x.uf)===normalizar(e.uf));
   if(r.status!=='disponivel_na_base'&&!unidadesViaveis){
    a.estado=['sem_disponibilidade_na_base','nao_localizado'].includes(r.status)?'sem_disponibilidade':'conferencia_endereco';
    return true;
   }
   if(unidadesViaveis)a.observacao_unidade='VTAL: todas as unidades retornadas no endereço são viáveis. Conferir a unidade técnica com os dados e documentos já salvos; nenhuma casa foi escolhida automaticamente.';
   const tabela=catalogo(p.estado,p.cidade),pj=c.tipo_pessoa==='PJ'||!!c.cnpj,cartao=/CARTAO|CREDITO/.test(normalizar(p.forma_pagamento));a.ofertas=(pj?tabela.pessoa_juridica:tabela.pessoa_fisica)?.map(o=>({...o,mensalidade:cartao&&o.mensalidade_cartao?o.mensalidade_cartao:o.mensalidade,mensalidade_cartao:null}));
   if(!a.ofertas?.length)throw Error('Nenhuma oferta Nio configurada para a modalidade e cidade');
   a.estado='aguardando_cliente';c.universal_migracao_nio_pendente='SIM';a.chave_oferta='alternativa_nio_ofertas:'+p.id;
   if(!c.universal_acoes.some(x=>x.chave===a.chave_oferta))c.universal_acoes.push({chave:a.chave_oferta,alvo:'cliente',estado:'pendente',texto:mensagemOfertas(p,a)+`\nPedido #${p.id}`,criado_em:new Date(agora()).toISOString()});
   delete a.erro;delete a.tentarEm;return true;
  }catch(e){a.estado='consulta_inconclusiva';a.erro=String(e.message).slice(0,250);a.tentarEm=agora()+60000;return true;}
 }
 function cliente(p,texto){
  const c=structuredClone(p.dados_customizados),a=c.universal_alternativa_nio;if(c.universal_migracao_nio_pendente!=='SIM'||a?.estado!=='aguardando_cliente')return false;
  if(!c.universal_acoes?.some(x=>x.chave===a.chave_oferta&&x.estado==='enviado'))return {mensagem:'Estou concluindo a conferência da alternativa para o seu pedido. Seus dados e documentos continuam salvos.'};
  const t=normalizar(texto);if(/^(?:NAO|NAO QUERO|NAO TENHO INTERESSE|PODE CANCELAR|CANCELAR|PARE|NAO ME CHAME)[.! ]*$/.test(t)){a.estado='recusada';c.universal_migracao_nio_pendente='NAO';return {c,mensagem:'Tudo bem, não vou alterar seu pedido para a Nio. Os dados que você enviou continuam registrados.'};}
  const pergunta=/[?]|\b(?:QUAL|QUAIS|QUANTO|COMO|PRECO|PRECOS|VALORES)\b/.test(t)&&!/\b(?:QUERO|ESCOLHO|PODE SER|VOU FICAR)\b/.test(t);
  const escolhido=!pergunta&&escolherPlano(texto,a.ofertas);if(!escolhido)return {mensagem:mensagemOfertas(p,a)};
  a.estado='migrada';a.plano=escolhido;a.aceite={texto:String(texto).slice(0,1000),em:new Date(agora()).toISOString()};
  c.universal_migracao_nio_pendente='NAO';c.universal_entregas_anteriores=[...(c.universal_entregas_anteriores||[]),{operadora:p.operadora,status_venda:p.status_venda,bko_ref:c.bko_ref,bko_reply_ids:c.bko_reply_ids,entrega:c.universal_entrega,conclusao:c.universal_conclusao,em:new Date(agora()).toISOString()}];
  c.universal_referencias_anteriores=[...(c.universal_referencias_anteriores||[]),c.bko_ref];c.bko_ref=`BKO-${p.id}-${randomBytes(8).toString('hex')}`.toUpperCase();c.bko_reply_ids=[];
  c.universal_entrega={partes:[],tentativas:0};c.bko_pendente='SIM';c.envio_whatsapp_ativo=true;c.bko_erro='';c.plano_id=escolhido.id;c.velocidade_mbps=escolhido.velocidade_mbps;c.vtal=a.consulta;c.universal_novo_cpf=false;
  if(a.observacao_unidade||a.observacao_logradouro){const pendencias=typeof c.pendencias_bko==='string'?JSON.parse(c.pendencias_bko||'[]'):c.pendencias_bko||[];c.pendencias_bko=JSON.stringify([...new Set([...pendencias,...[a.observacao_unidade,a.observacao_logradouro].filter(Boolean)])]);}
  if(c.universal_conclusao)c.universal_conclusao={...c.universal_conclusao,mensagem_bko:''};
  const patch={operadora:'Nio',plano:escolhido.nome,valor_plano:escolhido.mensalidade,status_venda:'AGUARDANDO AUDITORIA'};
  c.universal_variaveis={...c.universal_variaveis,...patch,plano_id:escolhido.id,valor_plano:escolhido.mensalidade};
  c.universal_resumo=resumo({dados:{...c.universal_variaveis,...p,...patch,cnpj:c.cnpj},plano:escolhido}).split('Está tudo certo?')[0];
  for(const acao of c.universal_acoes||[])if(!['enviado','cancelado'].includes(acao.estado))acao.estado='cancelado';
  return {c,patch,migrada:true,mensagem:`Atualizei seu pedido #${p.id} para *${escolhido.nome}*, da *Nio*, por *R$ ${escolhido.mensalidade.toFixed(2).replace('.',',')}/mês*. ✅ Seus dados e documentos foram aproveitados. O encaminhamento ao BKO da Nio está na fila automática; a equipe dará continuidade à análise.`};
 }
 return {preparar,conferir,cliente,precisaConferir};
}
module.exports={criar,pendente,endereco,mensagemOfertas};
