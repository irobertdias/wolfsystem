'use strict';
// Executa chamadas reais. Somente dados/arquivos sintéticos; não envia WhatsApp nem cadastra CRM.
const fs=require('node:fs'),path=require('node:path');
const raiz=process.argv[2],saida=process.argv[3];if(!raiz||!saida)throw Error('Informe diretório do motor e diretório do relatório');
fs.mkdirSync(saida,{recursive:true,mode:0o700});
const cred=JSON.parse(fs.readFileSync(path.join(raiz,'credencial.json'))),{criarIA}=require(path.join(raiz,'ia-configuravel.cjs'));
const ia=criarIA({apiKey:cred.apiKey,modelo:cred.model||'gpt-4o-mini'}),gen=require(path.join(raiz,'generico.cjs'));
const casos=require('./casos-conversa-1000.cjs').casos();
const dados=['cep','cpf','telefone1','tipo_pessoa','quadra','numero','data_nascimento','email','vencimento','forma_pagamento'];
const coleta=dados.map(variavel=>({variavel,rotulo:variavel,obrigatorio:true,tipo:variavel==='cpf'?'cpf':variavel==='telefone1'?'telefone':variavel==='data_nascimento'?'data':'texto'}));
const ofertas=[{id:'basico',nome:'Básico',preco:50},{id:'completo',nome:'Completo',preco:90}],nicho={prompt:'Atendimento universal. Entenda abreviações, erros de digitação e linguagem informal. Não invente dígitos ou dados ausentes.',coleta,documentos_config:[{variavel:'comprovante',rotulo:'Comprovante de endereço',descricao:'Conta com endereço do destinatário'}]},assistente={nome:'Ana',empresa:'Empresa Exemplo'};
const log=path.join(saida,'resultados.jsonl');
let proximaChamada=Date.now();
const anteriores=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
const ultimos=new Map(anteriores.map(r=>[r.id,r]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function fala(c){const file=path.join(saida,c.id+'.mp3');if(!fs.existsSync(file)){const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+cred.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'coral',input:c.texto,speed:c.velocidade,response_format:'mp3'}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Síntese '+r.status);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
 const ctx={fs,path};require(path.join(raiz,'../audio.js'))(ctx);return await ctx.transcreverAudio(file,cred.apiKey);
}
async function executar(c){
 const base={...c,em:new Date().toISOString()};
 try{
  if(c.tipo==='imagem'||c.tipo==='pdf'){
   const nome=c.id+(c.tipo==='imagem'?'.png':'.pdf'),buffer=fs.readFileSync(path.join(__dirname,'fixtures-conversas',nome));
   const r=await ia.lerDocumento({buffer,mime:c.tipo==='imagem'?'image/png':'application/pdf',nome,documentos:nicho.documentos_config,endereco:'',autorizado:true});
   const end=r.enderecos?.find(e=>e.papel==='destinatario');const valor=end?.dados?.cep;
   return {...base,ok:valor===c.esperado,obtido:valor||null,resposta:r,arquivo:nome};
  }
  const texto=c.tipo==='audio'?await fala(c):c.texto;if(!texto)throw Error('Transcrição vazia');
  const perguntaAnterior=({cep:'Qual é o CEP?',cpf:'Qual é o CPF?',telefone1:'Qual telefone de contato?',usar_whatsapp:'Qual telefone? Posso usar este WhatsApp?',confirmacao:'Confira o resumo do seu pedido. Está tudo correto?',tipo_pessoa:'A contratação será como pessoa física (CPF) ou jurídica (CNPJ)?',quadra:'Qual a quadra e lote?',numero:'Qual número do imóvel?',data_nascimento:'Qual data de nascimento?',email:'Qual seu email?',vencimento:'Qual dia de vencimento?',forma_pagamento:'Qual forma de pagamento?',plano_id:'Básico por 50 reais ou Completo por 90 reais: qual prefere?',recusa_documentos:'Pode enviar o comprovante de endereço?',encerrar:'Como posso ajudar?'})[c.campo];
  const estado={dados:{},historico:[{role:'assistant',content:perguntaAnterior}],pendente:c.campo==='usar_whatsapp'?'telefone1':c.campo,ofertasMostradas:true,confirmado:c.grupo==='recusa_documentos',documentos:{},anexos:[],pendencias:[],apresentou:true};
  const r=await ia.extrair({estado,texto,numero:'5511999998888',nicho,assistente,ofertas});
  const proximo=await gen.avancar({estado,texto,numero:'5511999998888',nicho:{...nicho,exigir_oferta:c.campo==='plano_id',catalogo:ofertas},assistente,vars:{},extrair:async()=>r});
  let valor=c.campo==='plano_id'?(proximo.estado.oferta?.id||''):c.campo==='encerrar'&&proximo.estado.encerrado?true:['confirmacao','encerrar','plano_id','recusa_documentos'].includes(c.campo)?r[c.campo]:c.campo==='usar_whatsapp'?proximo.estado.dados.telefone1:proximo.estado.dados[c.campo];
  const esperado=c.campo==='usar_whatsapp'?'5511999998888':c.esperado;
  if(c.campo==='telefone1'&&String(valor||'').replace(/\D/g,'').length===11)valor='55'+String(valor).replace(/\D/g,'');
  return {...base,transcricao:c.tipo==='audio'?texto:undefined,ok:typeof esperado==='boolean'?valor===esperado:(['quadra','numero','vencimento'].includes(c.campo)&&valor!=null&&Number.isFinite(Number(valor))?Number(valor)===Number(esperado):norm(valor)===norm(esperado)),obtido:valor??null,resposta:r,proximaMensagem:proximo.mensagem};
 }catch(e){return {...base,ok:false,erro:String(e.message).slice(0,300)};}
}
async function main(){
 const fila=casos.filter(c=>!ultimos.get(c.id)?.ok);let indice=0,feitos=0;
 async function worker(){while(indice<fila.length){const c=fila[indice++];const vez=Math.max(Date.now(),proximaChamada);proximaChamada=vez+350;await new Promise(res=>setTimeout(res,Math.max(0,vez-Date.now())));let r=await executar(c);if(r.erro&&/429|503|502|fetch failed/.test(r.erro)){await new Promise(res=>setTimeout(res,2000));r=await executar(c);}fs.appendFileSync(log,JSON.stringify(r)+'\n');ultimos.set(c.id,r);feitos++;if(feitos%25===0)console.log(JSON.stringify({rodada:feitos,total:ultimos.size,aprovados:[...ultimos.values()].filter(r=>r.ok).length}));}}
 await Promise.all(Array.from({length:16},worker));
 const resultados=casos.map(c=>ultimos.get(c.id)||{...c,ok:false,erro:'Não executado'}),resumo={total:casos.length,executados:ultimos.size,aprovados:resultados.filter(r=>r.ok).length,falhas:resultados.filter(r=>!r.ok).length,porTipo:Object.fromEntries(['texto','imagem','pdf','audio'].map(t=>[t,{total:resultados.filter(r=>r.tipo===t).length,aprovados:resultados.filter(r=>r.tipo===t&&r.ok).length}]))};
 fs.writeFileSync(path.join(saida,'resultado-final.json'),JSON.stringify({resumo,resultados},null,2));fs.writeFileSync(path.join(saida,'resumo.json'),JSON.stringify(resumo,null,2));console.log(JSON.stringify(resumo));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
