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
async function recuperar(ctx,ws,canal,numero,sessao,config){
 const c=contexto(ws,sessao,config);if(!c||!temArquivo(c.vars,'rg_frente')||!temArquivo(c.vars,'rg_verso'))return null;
 const datas=[sessao.created_at,...['rg_frente','rg_verso'].flatMap(k=>lista(c.vars[k]).map(a=>a.enviado_em))].map(v=>Date.parse(v||'')).filter(Number.isFinite);
 if(!datas.length||typeof ctx.capturarArquivoPrivado!=='function')return null;
 const n=String(numero).replace(/\D/g,'');
 const{data,error}=await ctx.supabase.from('mensagens').select('mensagem,created_at').eq('workspace_id',ws).eq('canal_id',canal).in('numero',[n,'+'+n]).eq('de','cliente').gte('created_at',new Date(Math.max(...datas)).toISOString()).order('created_at',{ascending:false}).limit(30);
 if(error)throw error;
 for(const m of data||[]){const analise=decidir(ws,sessao,config,m.mensagem);if(analise){const captura=await ctx.capturarArquivoPrivado({workspaceId:ws,canalId:canal,numero,sessao,configuracao:config,analise});if(captura)return captura;}}
 return null;
}
module.exports={decidir,resposta,recuperar};
