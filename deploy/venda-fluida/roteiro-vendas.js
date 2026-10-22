'use strict';
const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return{};}};
const campos=['nome','cpf','data_nascimento','email','endereco_confirmado','telefone1','vencimento','forma_pagamento','periodo_instalacao'];
const sim=v=>/^(sim|s|isso|isso mesmo|correto|confirmo|pode enviar|pode mandar|tudo certo|esta correto|esta certo|pode seguir)[.!]*$/.test(normal(v));
const conversa=v=>/\?|\b(caro|propaganda|anuncio|desconto|preco|precos|duvida|fidelidade|nao quero|desist|vou pensar|outro plano|muito enrolado)\b/.test(normal(v));
function publico(v){const t=normal(v);if(/\?|^(como|qual|por que|o que)\b/.test(t))return'';const pf=/\b(cpf|pf|pessoa fisica)\b/.test(t),pj=/\b(cnpj|pj|pessoa juridica)\b/.test(t);return pf===pj?'':pf?'PF':'PJ';}
function telefone(v,origem){const t=normal(v);if(/^(esse mesmo|esse aqui|o mesmo|mesmo numero|esse numero|este mesmo|este aqui|o que estamos conversando)[.!]*$/.test(t))v=origem;let n=String(v||'').replace(/\D/g,'');if(n.startsWith('55')&&[12,13].includes(n.length))n=n.slice(2);return /^[1-9]\d[2-9]\d{7,8}$/.test(n)?'55'+n:'';}
function planos(v,vero){const c=parse(v.resposta_viabilidade);return vero?(Array.isArray(c.planos)?c.planos:[]):c.planos?.[v.tipo_pessoa==='PJ'?'pessoa_juridica':'pessoa_fisica']||[];}
function endereco(texto,v){let r=String(texto||'').trim();const c=parse(v.resposta_viabilidade);for(const parte of [c.cidade||v.cidade,c.uf||v.estado])if(parte&&!new RegExp('\\b'+normal(parte).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(normal(r)))r+=', '+parte;return r;}
function resumo(v,vero){const p=planos(v,vero).find(p=>p.id===v.plano_interesse);return ['📋 *Confira os dados do seu pedido*','',`📦 *Plano:* ${p?p.nome+' — '+p.velocidade_mbps+' Mbps':v.plano_interesse||'A conferir'}`,`👤 *Nome:* ${v.nome||'Não informado'}`,`🪪 *CPF:* ${v.cpf||'Não informado'}`,`🎂 *Nascimento:* ${v.data_nascimento||'Não informado'}`,`✉️ *E-mail:* ${v.email||'Não informado'}`,`📍 *Endereço:* ${v.endereco_completo||'Não informado'}`,`💬 *Contato:* ${v.telefone1||'Não informado'}`,`📅 *Vencimento:* ${v.vencimento?'Dia '+v.vencimento:'Não informado'}`,`💳 *Pagamento:* ${v.forma_pagamento==='DEBITO_CONTA'?'Débito em conta':v.forma_pagamento==='BOLETO'?'Boleto':v.forma_pagamento||'A conferir'}`,`🕐 *Preferência de instalação:* ${v.periodo_instalacao||'A combinar'} (sujeita à confirmação da agenda)`,...Object.entries(parse(v.pendencias_coleta_bko)).filter(([k])=>campos.includes(k)).map(([k,p])=>'⚠️ '+k+': '+p.motivo),'','Está tudo certo? Responda *sim* para confirmar ou me diga o que deseja corrigir. Após sua confirmação, vou pedir os documentos.'].join('\n');}
function pergunta(k,v){return{nome:'Agora vou começar seu cadastro. Qual é o seu nome completo?',cpf:'Qual é o CPF do titular ou representante legal?',data_nascimento:'Qual é a sua data de nascimento?',email:'Qual é o seu e-mail?',endereco_confirmado:'Confirma este endereço de instalação?\n📍 '+v.endereco_completo,telefone1:'Qual telefone de contato podemos usar? Se for este mesmo WhatsApp, pode dizer “esse mesmo”.',vencimento:'Qual dia você prefere para o vencimento da fatura?',forma_pagamento:'Prefere pagar por boleto ou débito em conta?',periodo_instalacao:'Qual horário ou período você prefere para a instalação? Vou registrar a preferência para a equipe confirmar a agenda.'}[k];}
function decidir({no,vars:v,estado:e,mensagem='',entrada=false,cpfValido,normalizarData}){
 const t=normal(mensagem),vero=Number(no.fluxo_id)===28;
 v.roteiro_vendas_v3='SIM';v.venda_fluida_v1='SIM';
 if(no.id==='prime_vendedor'){
  const achado=/^(?:cep[\s.:]*)?(\d{5}[ .-]?\d{3})[.!]?$/.exec(t);
  if(entrada&&achado){const cep=achado[1].replace(/\D/g,'');if(v.cep!==cep){v.cep=cep;delete v.resposta_viabilidade;delete v.plano_interesse;delete v.tipo_pessoa;delete v.cidade;delete v.estado;delete e.catalogo;}}
  if(!v.cep)return{mensagem:'Olá! Sou a assistente virtual da Grupo Prime. 😊 Qual é o CEP do endereço onde deseja instalar a internet?'};
  const c=parse(v.resposta_viabilidade);
  if(c.cep!==v.cep||!c.status)return{consultar:true};
  if(c.status==='cidade_ambigua'){
   const cidade=(c.candidatos||[]).filter(x=>normal(x.cidade)===t);
   if(cidade.length===1){v.cidade=cidade[0].cidade;v.estado=cidade[0].uf;return{consultar:true};}
   return{mensagem:'Esse CEP tem mais de uma cidade na base. Qual é a sua: '+(c.candidatos||[]).map(x=>x.cidade+'/'+x.uf).join(' ou ')+'?'};
  }
  if(!['pre_viavel','pre_viavel_por_cidade'].includes(c.status))return{mensagem:'Ainda não consegui confirmar a disponibilidade para esse CEP. Pode conferir se o CEP está correto?',semDisponibilidade:true};
  v.cidade=c.cidade;v.estado=c.uf;
  const pub=publico(mensagem);if(entrada&&pub){v.tipo_pessoa=pub;delete e.catalogo;}
  if(!['PF','PJ'].includes(v.tipo_pessoa)){if(entrada&&e.publicoPerguntado&&!achado)return{conversar:true};e.publicoPerguntado=true;return{mensagem:'Temos disponibilidade para '+c.cidade+'/'+c.uf+'! ✅\nAs ofertas para pessoa física (CPF) e empresa (CNPJ) podem ser diferentes. Você quer contratar no *CPF ou no CNPJ*?'};}
  const lista=planos(v,vero);
  if(!lista.length||lista.some(p=>!p.id||!Number.isFinite(p.mensalidade)))return{mensagem:'Não encontrei uma oferta confirmada para esse tipo de contratação. Vou precisar conferir as condições antes de informar um preço.'};
  const assinatura=v.cep+':'+v.tipo_pessoa;
  const pedirCatalogo=/^(?:quais (?:sao )?(?:os )?planos|(?:me )?(?:mostra|mostrar|manda|enviar|ver) (?:os |as )?(?:planos|ofertas))(?:\?|[.!])?$/.test(t);
  if(entrada&&conversa(mensagem)&&!pub&&!pedirCatalogo)return{conversar:true};
  if(e.catalogo===assinatura&&entrada&&!pub&&!pedirCatalogo){
   const numero=/^(?:(?:eu )?(?:quero|escolho|prefiro) )?(?:(?:o|a) )?(?:plano |opcao |numero )?([1-9])[.!]*$/.exec(t);
   const nome=t.replace(/^(?:eu )?(?:quero|escolho|prefiro) (?:o plano |o )?/,'');
   const nomes=lista.filter(p=>normal(p.nome)===nome||normal(p.nome).replace(/^(nio|vero) /,'')===nome);
   const velocidade=/^(?:(?:eu )?(?:quero|escolho|prefiro) (?:o |o de )?)?(\d{3,4})\s*(?:mega|mbps|mb)[.!]*$/.exec(t);
   const porVelocidade=velocidade?lista.filter(p=>Number(p.velocidade_mbps)===Number(velocidade[1])):[];
   const escolhido=numero?lista[Number(numero[1])-1]:nomes.length===1?nomes[0]:porVelocidade.length===1?porVelocidade[0]:null;
   if(escolhido){v.plano_interesse=escolhido.id;return{avancar:true};}
   return{conversar:true};
  }
  e.catalogo=assinatura;
  const moeda=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
  return{mensagem:`*Planos ${vero?'Vero':'Nio'} para ${v.tipo_pessoa==='PF'?'CPF':'CNPJ'} em ${c.cidade}/${c.uf}*\n\n`+lista.map((p,i)=>`${i+1}️⃣ *${p.nome} — ${p.velocidade_mbps===1000?'1 Giga':p.velocidade_mbps+' Mbps'}*\n💰 ${moeda(p.mensalidade)}/mês`).join('\n\n')+'\n\nQual opção você prefere? Pode responder pelo número. 😊'};
 }
 if(no.id==='prime_endereco_ia'){
  if(entrada&&conversa(mensagem))return{conversar:true};
  if(v.endereco_completo){v.endereco_completo=endereco(v.endereco_completo,v);return{avancar:true};}
  const rua=/\b(rua|r\.?|av\.?|avenida|alameda|estrada|travessa|quadra|rodovia)\b/i.test(mensagem);
  if(entrada&&rua&&/\d|sem numero|s\/n/i.test(mensagem)){v.endereco_completo=endereco(mensagem,v);return{avancar:true};}
  if(entrada&&rua){e.enderecoParcial=mensagem.trim();return{mensagem:'Anotei '+mensagem.trim()+'. Qual é o número ou quadra/lote e o bairro? Se não houver número, pode dizer “sem número”.'};}
  if(entrada&&e.enderecoParcial&&/\d|sem numero|s\/n/i.test(mensagem)){v.endereco_completo=endereco(e.enderecoParcial+', '+mensagem,v);return{avancar:true};}
  if(entrada&&conversa(mensagem))return{conversar:true};
  return{mensagem:'Ótima escolha! Qual é o endereço completo da instalação: rua, número ou quadra/lote, bairro e complemento, se houver? A cidade e o estado eu aproveito da consulta do CEP.'};
 }
 if(no.id!=='prime_cadastro_ia')return null;
 const pend=parse(v.pendencias_coleta_bko);
 if(v.cpf&&!cpfValido(v.cpf)&&!pend.cpf)pend.cpf={informado:v.cpf,motivo:'CPF com dígitos inválidos; conferir pelo BKO'};
 if(v.data_nascimento){const data=normalizarData(v.data_nascimento);if(data)v.data_nascimento=data;else pend.data_nascimento={informado:v.data_nascimento,motivo:'Data recebida para conferência do BKO'};}
 v.pendencias_coleta_bko=JSON.stringify(pend);
 const falta=()=>e.corrigirCampo||campos.find(k=>!v[k]&&!pend[k]);let campo=falta();
 if(!campo&&e.resumoEnviado&&entrada&&!sim(mensagem)){
  const labels={nome:'nome',cpf:'cpf',nascimento:'data_nascimento',email:'email','e-mail':'email',endereco:'endereco_confirmado',telefone:'telefone1',contato:'telefone1',vencimento:'vencimento',pagamento:'forma_pagamento',horario:'periodo_instalacao',instalacao:'periodo_instalacao'};
  const chave=Object.keys(labels).find(k=>new RegExp('\\b'+k+'\\b').test(t));
  if(chave){e.corrigirCampo=labels[chave];e.resumoEnviado=false;return{mensagem:pergunta(e.corrigirCampo,v)};}
  if(!conversa(mensagem))return{mensagem:'Qual dado deseja corrigir: nome, CPF, nascimento, e-mail, endereço, contato, vencimento, pagamento ou horário de instalação?'};
 }
 if(entrada&&campo){
  if(conversa(mensagem)&&!/^(?:boleto|debito)/.test(t))return{conversar:true};
  if(/nao (tenho|sei|consigo)|sem (email|e-mail|telefone)/.test(t)){pend[campo]={informado:mensagem,motivo:'Cliente não tem ou não sabe informar; conferir pelo BKO'};}
  else{
   let valor='';
   if(campo==='nome'&&t.split(/\s+/).length>=2&&/[a-z]/.test(t)&&!/^\d/.test(t))valor=mensagem.trim();
   if(campo==='cpf'&&/^[\d .-]{11,}$/.test(mensagem)){const cpf=mensagem.replace(/\D/g,'');if(cpfValido(cpf))valor=cpf;else{e.cpfInvalido=(e.cpfInvalido||0)+1;if(e.cpfInvalido<2)return{mensagem:'Os dígitos desse CPF não conferem. Pode verificar o número? Se não conseguir corrigir agora, posso registrar a pendência para a equipe.'};pend.cpf={informado:cpf,motivo:'CPF com dígitos inválidos; conferir pelo BKO'};}}
   if(campo==='data_nascimento')valor=normalizarData(mensagem);
   if(campo==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mensagem.trim()))valor=mensagem.trim();
   if(campo==='endereco_confirmado'&&sim(mensagem))valor='SIM';
   if(campo==='endereco_confirmado'&&/\b(rua|avenida|av\.?|quadra)\b/i.test(mensagem)&&/\d/.test(mensagem)){v.endereco_completo=endereco(mensagem,v);valor='SIM';}
   if(campo==='telefone1'){
    valor=telefone(mensagem,v.numero);
    if(!valor&&e.telefoneSugerido&&sim(mensagem))valor=e.telefoneSugerido;
    const parcial=mensagem.replace(/\D/g,''),origem=telefone(v.numero);
    if(!valor&&/^\d[\d .()-]*$/.test(mensagem)&&parcial.length>=8&&parcial.length<=9&&origem&&origem.endsWith(parcial)){e.telefoneSugerido=origem;return{mensagem:'Você quer usar este mesmo WhatsApp, +'+origem+'?'};}
   }
   if(campo==='vencimento'){const n=/^(?:dia\s*)?(\d{1,2})$/.exec(t);if(n&&Number(n[1])>=1&&Number(n[1])<=31)valor=String(Number(n[1]));}
   if(campo==='forma_pagamento')valor=/boleto/.test(t)?'BOLETO':/debito/.test(t)?'DEBITO_CONTA':'';
   if(campo==='periodo_instalacao'&&/manha|tarde|noite|\d{1,2}(?:h|:)|qualquer|comercial/.test(t))valor=/manha/.test(t)?'Manhã':/tarde/.test(t)?'Tarde':mensagem.trim();
   if(valor){v[campo]=valor;delete pend[campo];delete e.corrigirCampo;}
   else if(!pend[campo]){e.tentativas=e.tentativas||{};e.tentativas[campo]=(e.tentativas[campo]||0)+1;if(e.tentativas[campo]<2)return{mensagem:pergunta(campo,v)};pend[campo]={informado:mensagem,motivo:'Informação recebida para conferência do BKO'};}
  }
  if(pend[campo])delete e.corrigirCampo;
  v.pendencias_coleta_bko=JSON.stringify(pend);campo=falta();
 }
 if(campo)return{mensagem:pergunta(campo,v)};
 if(e.resumoEnviado&&entrada&&sim(mensagem)){v.cadastro_confirmado=JSON.stringify(Object.fromEntries(campos.map(k=>[k,v[k]||''])));v.cadastro_encaminhavel='SIM';return{avancar:true};}
 if(e.resumoEnviado&&entrada){const email=mensagem.trim();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))v.email=email;else return{conversar:true};}
 e.resumoEnviado=true;return{mensagem:resumo(v,vero)};
}
module.exports={decidir,resumo,campos,publico,endereco,telefone,parse};
