'use strict';
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return{};}};
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function cpfValido(v){const n=String(v||'').replace(/\D/g,'');if(!/^\d{11}$/.test(n)||/^(\d)\1{10}$/.test(n))return false;for(let p=9;p<11;p++){let s=0;for(let i=0;i<p;i++)s+=Number(n[i])*(p+1-i);let d=s*10%11;if(d===10)d=0;if(d!==Number(n[p]))return false;}return true;}
function oferta(d,vars,entrada,e,{aposConsulta=false}={}){
 const c=parse(vars.resposta_viabilidade),vero=d.perfil_vendedor==='vero-v1';
 if((vero?c.status!=='pre_viavel_por_cidade':c.status!=='pre_viavel')||String(c.cep).replace(/\D/g,'')!==String(vars.cep).replace(/\D/g,''))return null;
 const texto=normal(entrada),tipo=/^(?:cpf|pf|pessoa fisica)$/.test(texto)?'PF':/^(?:cnpj|pj|pessoa juridica)$/.test(texto)?'PJ':vars.tipo_pessoa;
 const lista=vero?(Array.isArray(c.planos)?c.planos:[]):[...(c.planos?.pessoa_fisica||[]),...(c.planos?.pessoa_juridica||[])].filter(p=>!['PF','PJ'].includes(tipo)||p.publico===tipo);
 if(!lista.length||lista.some(p=>!p.id||!Number.isFinite(p.mensalidade)))return null;
 const novoCep=String(entrada||'').match(/(?:^|\D)(\d{5}-?\d{3})(?:\D|$)/)?.[1]?.replace(/\D/g,'');if(!aposConsulta&&novoCep&&novoCep!==String(c.cep))return null;
 const exibidos=e.catalogo_fluido||[];
 if(d.publico_apos_plano_v1===true&&e.plano_fluido_pendente){
  const pend=e.plano_fluido_pendente,pub=/^(?:cpf|pf|pessoa fisica)$/.test(texto)?'PF':/^(?:cnpj|pj|pessoa juridica)$/.test(texto)?'PJ':'';
  if(pend.cep!==String(c.cep)){delete e.plano_fluido_pendente;}
  else if(pub){
   if(vero||pend.publico===pub){delete e.plano_fluido_pendente;return{avancar:true,dados:{plano_interesse:pend.id,tipo_pessoa:pub,venda_fluida_v1:'SIM'}};}
   delete e.plano_fluido_pendente;vars.tipo_pessoa=pub;e.catalogo_fluido=[];
   return oferta(d,vars,'',e,{aposConsulta:true});
  }else if(!/^(?:quero |escolho |prefiro |plano |opcao )?[1-9][.!]*$/.test(texto))return null;
 }
 if(!aposConsulta&&exibidos.length){
  const n=/^(?:(?:eu )?(?:quero|escolho|prefiro) )?(?:(?:o|a) )?(?:(?:plano|opcao|numero)\s*)?([1-9])(?:\s*(?:no |para |em )?(cpf|cnpj|pf|pj))?[.!]*$/.exec(texto);
  const nomeTexto=texto.replace(/^(?:eu )?(?:quero|escolho|prefiro)\s+(?:o plano |o |a opcao )?/,'');
  const nomes=lista.filter(p=>normal(p.nome)===nomeTexto||normal(p.nome).replace(/^(nio|vero) /,'')===nomeTexto);
  const velocidade=/^(\d{3,4})\s*(?:mega|mbps|mb)$/.exec(texto),velocidades=velocidade?lista.filter(p=>p.velocidade_mbps===Number(velocidade[1])):[];
  let escolhido=n?lista.find(p=>p.id===exibidos[Number(n[1])-1]):nomes.length===1?nomes[0]:velocidades.length===1?velocidades[0]:null;
  if(n?.[2]&&!vero){const pub=/^(cpf|pf)$/.test(n[2])?'PF':'PJ';if(escolhido?.publico!==pub)escolhido=lista.filter(p=>p.publico===pub)[Number(n[1])-1];}
  if(escolhido){
   if(d.publico_apos_plano_v1===true){e.plano_fluido_pendente={id:escolhido.id,publico:escolhido.publico,cep:String(c.cep)};e[vero?'vero_etapa_oferta':'nio_etapa_oferta']='publico';return{dados:{venda_fluida_v1:'SIM'},mensagem:`Você escolheu ${escolhido.nome}, ${escolhido.velocidade_mbps} Mbps. A contratação será no CPF ou no CNPJ?`};}
   return{avancar:true,dados:{plano_interesse:escolhido.id,...(!vero?{tipo_pessoa:escolhido.publico}:{}),venda_fluida_v1:'SIM'}};
  }
  if(!/plan|preco|valor|oferta|enrolad/.test(texto)&&!['CPF','CNPJ','PF','PJ'].includes(String(entrada).toUpperCase()))return null;
 }
 e.catalogo_fluido=lista.map(p=>p.id);e[vero?'vero_etapa_oferta':'nio_etapa_oferta']='plano';
 const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 const linhas=lista.map((p,i)=>`${i+1}. *${p.nome} — ${p.velocidade_mbps} Mbps${!vero?' · '+(p.publico==='PJ'?'CNPJ':'CPF'):''}*\n💰 ${moeda(p.mensalidade)}/mês${Number.isFinite(p.mensalidade_cartao)?'\n💳 '+moeda(p.mensalidade_cartao)+'/mês no cartão':''}${p.gb_movel===30?'\n📱 Móvel com 30 GB':''}`);
 return{dados:{venda_fluida_v1:'SIM',...(['PF','PJ'].includes(tipo)?{tipo_pessoa:tipo}:{})},mensagem:`${vero?'Temos ofertas Vero':'Temos disponibilidade sim'} para ${c.cidade}/${c.uf}! ✅\n\n${linhas.join('\n\n')}\n\nQual plano você prefere? Pode responder pelo número.`};
}
function ajustar(d,vars,mensagem,processarInput){
 if(d.venda_fluida_v1!==true)return d;
 vars.venda_fluida_v1='SIM';if(['nio-v1','vero-v1'].includes(d.perfil_vendedor))return d;
 vars.venda_fluida_v1='SIM';const pend=parse(vars.pendencias_coleta_bko),tent=parse(vars.tentativas_coleta_bko);
 for(const c of d.variaveis||[])if(c.tipo==='cpf'&&vars[c.nome]&&!cpfValido(vars[c.nome]))pend[c.nome]={informado:String(vars[c.nome]),motivo:'CPF informado requer conferência dos dígitos'};
 const validado=(c,v)=>{if(!String(v||'').trim())return false;if(c.diferente_de&&String(v).replace(/\D/g,'')===String(vars[c.diferente_de]||'').replace(/\D/g,''))return false;if(c.tipo==='cpf')return cpfValido(v);if(c.tipo==='telefone')return String(v).replace(/\D/g,'').length>=10;if(c.tipo==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));if(c.tipo==='nome')return !/^\d+$/.test(String(v));return true;};
 const campo=(d.variaveis||[]).find(c=>c.obrigatoria!==false&&!pend[c.nome]&&!validado(c,vars[c.nome]));const t=normal(mensagem);
 if(processarInput&&campo&&!/[?]/.test(t)&&!/^(como|qual|porque|por que|sim|isso|ok|agora foi)\b/.test(t)){
  const sem=/nao (?:sei|tenho|consigo)|sem (?:email|telefone|documento|comprovante)|pode (?:mandar|enviar|seguir).*(?:assim|bko)/.test(t);
  const formatoIncorreto=campo.tipo==='cpf'&&/^\d[\d .-]*$/.test(t)&&!cpfValido(t);
  const telefoneCurto=campo.tipo==='telefone'&&/^[\d\s()+.-]{4,}$/.test(t)&&!validado(campo,t);
  const emailIncompleto=campo.tipo==='email'&&!validado(campo,t);
  const igualAnterior=campo.diferente_de&&String(mensagem).replace(/\D/g,'')===String(vars[campo.diferente_de]||'').replace(/\D/g,'')&&/\d/.test(String(mensagem));
  const invalido=formatoIncorreto||telefoneCurto||emailIncompleto||igualAnterior;
  if(sem||invalido){tent[campo.nome]=(tent[campo.nome]||0)+1;if(sem||tent[campo.nome]>=2){pend[campo.nome]={informado:String(mensagem),motivo:sem?'Cliente não tem ou não sabe informar':'Dado informado requer conferência'};}}
 }
 vars.pendencias_coleta_bko=JSON.stringify(pend);vars.tentativas_coleta_bko=JSON.stringify(tent);
 return{...d,bko_campos_pendentes:Object.keys(pend),variaveis:(d.variaveis||[]).map(c=>({...c,obrigatoria:pend[c.nome]?false:c.obrigatoria,diferente_de:pend[c.nome]?undefined:c.diferente_de})),prompt:String(d.prompt||'')+'\nNome de exibição do contato, somente como sugestão para confirmar com o cliente: '+String(vars.nome_contato_sugerido||'não disponível')+'. Nunca preencha o nome do titular automaticamente a partir dele.\nPendências já encaminhadas para conferência do BKO, não volte a exigir estes dados: '+JSON.stringify(pend)+'. Continue coletando os dados disponíveis, sem inventar informações.'};
}
module.exports={parse,cpfValido,oferta,ajustar};
