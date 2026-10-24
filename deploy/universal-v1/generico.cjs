'use strict';
const {createHash}=require('node:crypto');
const {positivo,cpfValido,dataBR}=require('./conversa.cjs');
const {modelo}=require('./modelo-vendas.cjs');
const {normalizar}=require('./vtal.cjs');
const chaveResumo=s=>createHash('sha256').update(JSON.stringify({dados:s.dados,oferta:s.oferta})).digest('hex');
const nomeValido=v=>/^[a-zA-Z][\w]{0,80}$/.test(String(v));
function validar(nicho){
 for(const tipo of ['coleta','documentos_config']){const nomes=new Set();for(const c of nicho[tipo]||[]){if(!nomeValido(c.variavel)||nomes.has(c.variavel))throw Error('Confira os nomes das variáveis em '+tipo);nomes.add(c.variavel);}}
 for(const p of nicho.catalogo||[])if(!p.id||!p.nome||!Number.isFinite(Number(String(p.preco).replace(',','.'))))throw Error('Confira código, nome e preço das ofertas.');
}
function catalogo(nicho,vars){let v=nicho.catalogo_variavel?vars[nicho.catalogo_variavel]:nicho.catalogo||[];try{if(typeof v==='string')v=JSON.parse(v);}catch{throw Error('A variável do catálogo não contém JSON válido.');}if(!Array.isArray(v))v=v?.ofertas||v?.items||v?.results||[];return v.slice(0,100).filter(p=>p?.id&&p.nome&&Number.isFinite(Number(p.preco))).map(p=>({...p,id:String(p.id),preco:Number(p.preco)}));}
function resumo(s,nicho){if(nicho.resumo_template)return modelo(nicho.resumo_template,s.dados);return ['📋 *Confira seu pedido*',s.oferta?`📦 *${s.oferta.nome}* · R$ ${Number(s.oferta.preco).toFixed(2).replace('.',',')}`:'',...(nicho.coleta||[]).filter(c=>s.dados[c.variavel]!=null&&s.dados[c.variavel]!=='').map(c=>`• *${c.rotulo||c.variavel}:* ${s.dados[c.variavel]}`),'','Está tudo certo? Pode confirmar com suas palavras ou me dizer o que deseja corrigir. 😊'].filter(Boolean).join('\n');}
async function avancar({estado,texto,numero,nicho,assistente,vars,extrair}) {
 validar(nicho);const s=structuredClone(estado||{versao:2,dados:{},historico:[],documentos:{},anexos:[],pendencias:[],apresentou:false,confirmado:false});
 const campos=nicho.coleta||[],docs=nicho.documentos_config||[],ofertas=catalogo(nicho,vars);
 const r=await extrair({estado:s,texto,numero,nicho,assistente,ofertas});
 for(const item of r.dados||[]){const c=campos.find(c=>c.variavel===item.campo);if(!c||!item.trecho||!normalizar(texto).includes(normalizar(item.trecho)))continue;let valor=String(item.valor||'').trim();if(!valor)continue;
   if(c.tipo==='data')valor=dataBR(valor)||valor;
   if(c.tipo==='cpf')valor=valor.replace(/\D/g,'');
   if(c.tipo==='telefone')valor=valor.replace(/\D/g,'');
   if(normalizar(s.dados[c.variavel])!==normalizar(valor)){s.dados[c.variavel]=valor;s.confirmado=false;}
 }
 const pendente=campos.find(c=>c.variavel===s.pendente);
 if(pendente&&(!pendente.tipo||pendente.tipo==='texto')&&!r.dados?.some(d=>d.campo===pendente.variavel)&&!r.pergunta&&!r.objecao&&!r.encerrar&&!positivo(texto)&&texto.trim()&&!/[?]|\[(?:img|file|document):/i.test(texto)&&!/^\s*(?:NÃO|NAO|N|CANCELAR|DESISTIR|PARE|OK|SIM)\b/i.test(texto))s.dados[pendente.variavel]=texto.trim().slice(0,1000);
 if(pendente?.tipo==='confirmacao'&&(r.confirmacao||positivo(texto)))s.dados[pendente.variavel]='Confirmado';
 if(pendente?.tipo==='telefone'&&(/\b(?:ESSE|ESTE|MESMO|AQUI)\b/.test(normalizar(texto))||positivo(texto)))s.dados[pendente.variavel]=String(numero).replace(/\D/g,'');
 if(pendente&&pendente.tipo==='data'&&dataBR(texto))s.dados[pendente.variavel]=dataBR(texto);
 if(pendente&&pendente.tipo==='cpf'&&/^\d{11}$/.test(texto.replace(/\D/g,'')))s.dados[pendente.variavel]=texto.replace(/\D/g,'');
 const registrarResposta=(mensagem,concluido=false,tipo)=>{
   if(!tipo&&s.historico.at(-1)?.content===mensagem&&!concluido)mensagem=r.resposta&&!/[?]/.test(r.resposta)?r.resposta+'\n\n'+(pendente?.pergunta||'Como prefere continuar?'):'Vamos continuar de onde paramos. '+mensagem;
   s.historico=[...s.historico,{role:'user',content:texto},{role:'assistant',content:mensagem}].slice(-30);return {estado:s,mensagem,concluido,historicoProposto:true,tipo:tipo||(s.pendente==='__oferta'&&mensagem.includes('R$')?'ofertas':undefined)};
 };
 let documentosEncaminhar=false;
 if(docs.some(d=>d.variavel===s.pendente)){
  const contorno=require('./objecao-documentos.cjs').tratar(s,texto,docs);
  if(contorno?.mensagem)return registrarResposta(contorno.mensagem,false,contorno.tipo);
  if(contorno?.seguir){documentosEncaminhar=true;r.encerrar=false;r.resposta='';r.sem_documento=[];}
 }
 if(!documentosEncaminhar){const retencao=require('./retencao-venda.cjs').tratar(s,texto,r.encerrar===true);if(retencao?.mensagem)return registrarResposta(retencao.mensagem,false,retencao.tipo);if(retencao?.encerrar)r.encerrar=true;}
 if(r.encerrar){s.encerrado=true;return registrarResposta('Entendido. Vou encerrar o atendimento por aqui. Se precisar, estamos à disposição.');}
 let inicio='';if(!s.apresentou){s.apresentou=true;inicio=(assistente.apresentacao||`Olá! Sou ${assistente.nome}, assistente virtual da ${assistente.empresa}. Vou ajudar você por aqui. 😊`)+'\n\n';}
 const responder=msg=>registrarResposta(inicio+(r.resposta&&!/[?]|R\$/.test(r.resposta)?r.resposta+'\n\n':'')+msg);
 const perguntar=c=>{s.pendente=c.variavel;return responder(modelo(c.pergunta||`Pode me informar ${c.rotulo}?`,s.dados));};
 const antes=campos.find(c=>c.etapa==='antes_oferta'&&c.obrigatorio!==false&&!s.dados[c.variavel]);if(antes)return perguntar(antes);
 if(nicho.exigir_oferta&&!s.oferta){
   const escolhido=s.ofertasMostradas?ofertas.find(p=>p.id===r.plano_id):null;
   if(escolhido){s.oferta=escolhido;s.dados.plano=escolhido.nome;s.dados.valor_plano=escolhido.preco;s.dados.plano_id=escolhido.id;s.confirmado=false;}
   else {s.pendente='__oferta';if(s.ofertasMostradas&&r.resposta&&!/OFERTA|PLANO|PRECO|VALOR|OPCOES/.test(normalizar(texto)))return registrarResposta(r.resposta+'\n\nQual das opções apresentadas você prefere?');s.ofertasMostradas=true;return responder(ofertas.length?ofertas.map((p,i)=>`${i+1}️⃣ *${p.nome}* · R$ ${p.preco.toFixed(2).replace('.',',')}${p.descricao?'\n'+p.descricao:''}`).join('\n\n')+'\n\nQual opção combina com o que você precisa?':'Vou precisar confirmar as ofertas com a equipe. Não há um catálogo disponível nesta configuração.');}
 }
 for(const c of campos){if(c.obrigatorio!==false&&!s.dados[c.variavel])return perguntar(c);if(c.tipo==='cpf'&&s.dados[c.variavel]&&!cpfValido(s.dados[c.variavel])){s.pendencias=[...new Set([...s.pendencias,'Conferir CPF informado no cadastro.'])];}}
 if(!s.confirmado){if(s.resumoHash===chaveResumo(s)&&(r.confirmacao||positivo(texto)))s.confirmado=true;else{s.pendente='__confirmacao';s.resumoHash=chaveResumo(s);return responder(resumo(s,nicho));}}
 for(const nome of r.sem_documento||[])if(docs.some(d=>d.variavel===nome)){s.semDocumento||=[];s.semDocumento=[...new Set([...s.semDocumento,nome])];s.pendencias.push('Cliente informou não possuir '+(docs.find(d=>d.variavel===nome).rotulo));}
 for(const doc of docs)if(!s.documentos[doc.variavel]?.length&&!s.semDocumento?.includes(doc.variavel)&&!s.documentosDispensados?.includes(doc.variavel)){s.pendente=doc.variavel;return responder(`Agora pode enviar *${doc.rotulo}*? ${doc.descricao||''}${doc.obrigatorio===false?' Se não tiver esse documento, pode me avisar que seguimos com uma observação.':''}`);}
 s.resumo=resumo(s,nicho);s.pendente='__concluir';return registrarResposta(s.documentosDispensados?.length?'Vou encaminhar o pedido para análise com a documentação pendente. A equipe continuará a conferência com você. ✅':'Recebi as informações e os arquivos. Vou registrar o pedido. ✅',true);
}
module.exports={avancar,validar,catalogo,resumo,nomeValido};
