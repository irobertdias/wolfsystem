'use strict';
function lista(v){try{return typeof v==='string'?JSON.parse(v):v||[];}catch{return[];}}
function temArquivo(v,k){return v[k+'_validado']==='SIM'&&Array.isArray(lista(v[k]))&&lista(v[k]).some(a=>a?.url&&a.privado===true);}
function contexto(workspaceId,sessao,config){
 if(workspaceId!=='grupoprime'||![27,28].includes(Number(sessao?.fluxo_id))||!['prime_documentos_ia','prime_reversao_documentos_ia'].includes(sessao?.no_atual))return null;
 const regra=config?.arquivos_salvar_regras?.find(r=>r.id==='prime_comprovante'&&r.variavel==='comprovante_endereco');
 if(!regra||temArquivo(sessao.variaveis||{},'comprovante_endereco'))return null;
 return{regra,vars:sessao.variaveis||{}};
}
function decidir(workspaceId,sessao,config,entrada){
 const c=contexto(workspaceId,sessao,config);if(!c)return null;
 const nome=/^\[(?:file|img):([^\]\r\n]+)\]/i.exec(String(entrada||''))?.[1];
 if(!nome||/[\\/]/.test(nome)||!/^.+\.(?:pdf|jpe?g|png|webp|gif)$/i.test(nome))return null;
 const pdf=/\.pdf$/i.test(nome);
 // Identidades continuam com reconhecimento visual; PDF é formato do comprovante.
 if(!pdf&&!(temArquivo(c.vars,'rg_frente')&&temArquivo(c.vars,'rg_verso')))return null;
 return{tratado:true,ignorado:false,erro:false,nomeArquivo:nome,regraArquivoId:c.regra.id,dadosExtraidos:{},entrada:'Comprovante de endereço recebido como anexo. O servidor deve armazenar o arquivo original antes de confirmar o recebimento.'};
}
function resposta(workspaceId,sessao,config,entrada){
 if(!contexto(workspaceId,sessao,config))return null;
 const t=String(entrada||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(contrato|locacao|aluguel|comprovante|conta|fatura)\b/.test(t)&&/\?|\b(serve|aceita|pode ser|em nome)\b/.test(t))return'Sim, aceitamos contrato de locação e outros comprovantes, inclusive em nome de outra pessoa. Pode enviar uma foto ou o PDF por aqui.';
 return null;
}
module.exports={decidir,resposta};
