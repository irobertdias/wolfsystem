'use strict';
const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function publico(v){if(/[?]|^(?:como|por que|porque|qual|precisa)\b/i.test(String(v||"")))return "";const n=normalizar(v),pj=/\b(cnpj|pj|pessoa juridica)\b/.test(n),pf=/\b(cpf|pf|pessoa fisica)\b/.test(n);return pj===pf?'':pj?'PJ':'PF';}
function decidirOfertaVero(d,vars,entrada,estado,{aposConsulta=false}={}){
 if(d.perfil_vendedor!=='vero-v1')return null;
 if(/\b(encerrar|cancelar|parar|desistir|nao quero)\b/.test(normalizar(entrada)))return null;
 let c;try{c=typeof vars.resposta_viabilidade==='string'?JSON.parse(vars.resposta_viabilidade):vars.resposta_viabilidade;}catch{return null;}
 if(c?.operadora!=='Vero'||c.status!=='pre_viavel_por_cidade'||!Array.isArray(c.planos)||!c.planos.length)return null;
 if(String(c.cep).replace(/\D/g,'')!==String(vars.cep).replace(/\D/g,''))return null;
 const novoCep=String(entrada||'').match(/(?:^|\D)(\d{5}-?\d{3})(?:\D|$)/)?.[1]?.replace(/\D/g,'');
 if(!aposConsulta&&novoCep&&novoCep!==String(c.cep).replace(/\D/g,''))return null;
 if(c.planos.some(p=>!/^vero-(neutra|especial|prata)-(420|550|700|850)$/.test(p.id)||!Number.isFinite(p.mensalidade)||p.mensalidade<=0))return null;
 const dados={};let tipo=publico(vars.tipo_pessoa);
 if(!aposConsulta){const recebido=publico(entrada);if(recebido)tipo=recebido;}
 if(!aposConsulta&&/^\s*\d{3}\.?\d{3}\.?\d{3}[.-]?\d{2}\s*$/.test(String(entrada))){dados.cpf=String(entrada).replace(/\D/g,'');tipo='PF';}
 if(!tipo){
  const jaPerguntou=estado.vero_etapa_oferta==='publico';estado.vero_etapa_oferta='publico';
  if(!aposConsulta&&/plan|preco|valor|oferta|enrolad|demora/.test(normalizar(entrada))){
   const lista=c.planos.map((p,i)=>`${i+1}. *Vero ${p.velocidade_mbps} Mega${p.movel_incluso?' + Móvel':''}* — ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.mensalidade)}/mês${p.gb_movel===30?' (30 GB no móvel)':''}`).join('\n\n');
   return{dados,mensagem:`Claro! Estas são as ofertas Vero em ${c.cidade}/${c.uf}:\n\n${lista}\n\nQual opção te interessa, e será para CPF ou CNPJ?`};
  }
  if(jaPerguntou&&!aposConsulta&&/\?|como|por que|porque|duvida|caro|instala|fidelidade/.test(normalizar(entrada)))return null;
  return{mensagem:jaPerguntou?'A contratação será como pessoa física (CPF) ou empresa (CNPJ)?':`Temos ofertas Vero para ${c.cidade}/${c.uf}! ✅\n\nVocê quer contratar no CPF (pessoa física) ou no CNPJ (pessoa jurídica)?`,dados};
 }
 dados.tipo_pessoa=tipo;
 if(!aposConsulta&&estado.vero_etapa_oferta==='plano'&&!publico(entrada)){
  const texto=normalizar(entrada).replace(/[.!?]+$/,'');
  const numero=/^(?:(?:eu\s+)?(?:quero|escolho|prefiro)\s+)?(?:(?:o|a)\s+)?(?:(?:plano|opcao|numero)\s*)?([1-4])$/.exec(texto);
  const velocidade=/\b(420|550|700|850)\s*(?:mega|mbps|mb)?\b/.exec(texto);
  const escolhido=numero?c.planos[Number(numero[1])-1]:velocidade?c.planos.find(p=>Number(p.velocidade_mbps)===Number(velocidade[1])):null;
  if(escolhido){dados.plano_interesse=escolhido.id;return{avancar:true,dados};}
  if(/\?|como|por que|porque|duvida|caro|instala|fidelidade/.test(normalizar(entrada)))return null;
  // Sem escolha válida, mantenha o catálogo; uma rua ou "sim" não libera endereço.
 }
 estado.vero_etapa_oferta='plano';
 const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
 const planos=c.planos.map((p,i)=>`${['1️⃣','2️⃣','3️⃣','4️⃣'][i]} *Vero ${p.velocidade_mbps} Mega${p.movel_incluso?' + Móvel':''}*\n💰 ${moeda(p.mensalidade)}/mês${p.gb_movel===30?'\n📱 Móvel com 30 GB':''}`);
 return{mensagem:`*Planos Vero para ${tipo==='PF'?'CPF':'CNPJ'} em ${c.cidade}/${c.uf}*\n\n${planos.join('\n\n')}\n\nQual opção você prefere? Pode responder só o número 😊`,dados};
}
module.exports={decidirOfertaVero};
