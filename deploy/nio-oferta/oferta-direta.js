'use strict';
const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function publico(v){if(/[?]|^(?:como|por que|porque|qual|precisa)\b/i.test(String(v||"")))return "";const t=normalizar(v),pf=/\b(cpf|pf|pessoa fisica)\b/.test(t),pj=/\b(cnpj|pj|pessoa juridica)\b/.test(t);return pf===pj?'':pf?'PF':'PJ';}
function decidirOfertaNio(d,v,entrada,e,{aposConsulta=false}={}){
 if(d.perfil_vendedor!=='nio-v1')return null;
 const texto=normalizar(entrada);
 if(/\b(encerrar|cancelar|parar|desistir|nao quero|humano|atendente)\b/.test(texto))return null;
 let c;try{c=typeof v.resposta_viabilidade==='string'?JSON.parse(v.resposta_viabilidade):v.resposta_viabilidade;}catch{return null;}
 if(c?.workspace_id!=='grupoprime'||c.status!=='pre_viavel'||!c.planos||!c.cidade||!c.uf)return null;
 const cep=String(c.cep).replace(/\D/g,'');if(cep!==String(v.cep).replace(/\D/g,''))return null;
 const novo=String(entrada||'').match(/(?:^|\D)(\d{5}-?\d{3})(?:\D|$)/)?.[1]?.replace(/\D/g,'');
 if(!aposConsulta&&novo&&novo!==cep)return null;
 const dados={};const recebido=aposConsulta?'':publico(entrada);
 let tipo=recebido||publico(v.tipo_pessoa);
 // Um CPF enviado espontaneamente é documento, nunca endereço de IP.
 if(!aposConsulta&&/^\s*\d{3}\.?\d{3}\.?\d{3}[.-]?\d{2}\s*$/.test(String(entrada))){dados.cpf=String(entrada).replace(/\D/g,'');tipo='PF';}
 if(!tipo){
  const jaPerguntou=e.nio_etapa_oferta==='publico';e.nio_etapa_oferta='publico';
  if(!aposConsulta&&/plan|preco|valor|oferta|enrolad|demora/.test(texto)){
   const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
   const grupo=(label,lista)=>'*'+label+'*\n'+lista.map(p=>`• ${p.nome} — ${p.velocidade_mbps} Mbps: ${moeda(p.mensalidade)}/mês${Number.isFinite(p.mensalidade_cartao)?' ('+moeda(p.mensalidade_cartao)+' no cartão)':''}`).join('\n');
   if([c.planos.pessoa_fisica,c.planos.pessoa_juridica].every(lista=>Array.isArray(lista)&&lista.length&&lista.every(p=>Number.isFinite(p.mensalidade)&&p.mensalidade>0)))return{dados,mensagem:`Claro! Estas são as ofertas em ${c.cidade}/${c.uf}:\n\n${grupo('CPF — pessoa física',c.planos.pessoa_fisica)}\n\n${grupo('CNPJ — pessoa jurídica',c.planos.pessoa_juridica)}\n\nQual opção te interessa, e será para CPF ou CNPJ?`};
  }
  if(jaPerguntou&&!aposConsulta&&/\?|como|por que|porque|duvida|caro|instala|fidelidade/.test(texto))return null;
  return{dados,mensagem:jaPerguntou?'Os planos e preços mudam entre pessoa física e empresa. A contratação será no CPF ou no CNPJ?':'Temos disponibilidade sim para esse endereço! ✅\nA confirmação técnica do imóvel será feita com o endereço completo.\n\nVocê quer contratar no CPF ou no CNPJ?'};
 }
 dados.tipo_pessoa=tipo;
 const planos=c.planos[tipo==='PF'?'pessoa_fisica':'pessoa_juridica'];
 if(!Array.isArray(planos)||!planos.length||planos.length>4||planos.some(p=>!new RegExp('^'+tipo.toLowerCase()+'-(fibra|essencial|super|ultra)-(promo|padrao)$').test(p.id)||!Number.isFinite(p.mensalidade)||p.mensalidade<=0))return null;
 if(!aposConsulta&&e.nio_etapa_oferta==='plano'&&!recebido){
  const n=/^(?:(?:eu\s+)?(?:quero|escolho|prefiro)\s+)?(?:(?:o|a)\s+)?(?:(?:plano|opcao|numero)\s*)?([1-4])[.!?]*$/.exec(texto);
  const nome=planos.filter(p=>new RegExp('\\b'+normalizar(p.nome).replace(/^nio /,'')+'\\b').test(texto));
  const escolhido=n?planos[Number(n[1])-1]:nome.length===1?nome[0]:null;
  if(escolhido)return{avancar:true,dados:{...dados,plano_interesse:escolhido.id}};
  if(/\?|como|por que|porque|duvida|caro|instala|fidelidade/.test(texto))return null;
 }
 e.nio_etapa_oferta='plano';
 const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 const lista=planos.map((p,i)=>`${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} *${p.nome} — ${p.velocidade_mbps===1000?'1 Giga':p.velocidade_mbps+' Mbps'}*\n💰 ${moeda(p.mensalidade)}/mês${Number.isFinite(p.mensalidade_cartao)?'\n💳 '+moeda(p.mensalidade_cartao)+'/mês no cartão':''}${p.chips_5g?'\n📱 '+p.chips_5g+' chip(s) com '+p.gb_por_chip+' GB por chip':''}${p.wifi_mesh?'\n📶 Wi-Fi Mesh':''}${p.globoplay_meses?'\n🎬 Globoplay por '+p.globoplay_meses+' meses':''}`);
 return{dados,mensagem:`*Planos Nio para ${tipo==='PF'?'CPF':'CNPJ'} em ${c.cidade}/${c.uf}*\n\n${lista.join('\n\n')}\n\nQual opção você prefere? Pode responder só o número 😊`};
}
module.exports={decidirOfertaNio};
