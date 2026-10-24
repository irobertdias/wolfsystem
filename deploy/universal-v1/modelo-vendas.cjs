'use strict';
const FIXOS=new Set(['data_proposta','nome','cpf','rg','data_nascimento','nome_mae','email','endereco','cep','cidade','estado','telefone1','telefone2','telefone3','vencimento','forma_pagamento','plano','valor_plano','vendedor','status_venda','data_agendamento','periodo_instalacao','data_instalacao','data_cancelamento','operadora']);
function modelo(texto,vars){return String(texto||'').replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,k)=>{const v=vars[k]??(k.startsWith('custom.')?vars.dados_customizados?.[k.slice(7)]:undefined);return v==null?'':typeof v==='object'?JSON.stringify(v):String(v)});}
function registro(dados,conclusao={}) {
 const campos={},custom={};
 if(conclusao.modo_mapeamento!=='manual')for(const k of FIXOS)if(dados[k]!=null)campos[k]=dados[k];
 for(const m of Array.isArray(conclusao.mapeamento)?conclusao.mapeamento:[]){
   const k=String(m.campo||''),v=m.origem==='valor'?modelo(m.valor,dados):dados[String(m.variavel||'').replace(/^\{\{|\}\}$/g,'').trim()];
   if(v==null)continue;
   if(FIXOS.has(k))campos[k]=v;
   else if(/^custom\.[a-zA-Z][\w]{0,80}$/.test(k))custom[k.slice(7)]=v;
 }
 if(campos.valor_plano!=null){const n=typeof campos.valor_plano==='number'?campos.valor_plano:Number(String(campos.valor_plano).replace(/R\$|\s/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));if(!Number.isFinite(n))throw Error('Valor do plano inválido no mapeamento.');campos.valor_plano=n;}
 return {campos,custom};
}
async function configuracao(db,ws){
 const r=await db.from('fluxos').select('nos').eq('workspace_id',ws).eq('nome','__wolf_configuracao_vendas__').maybeSingle();if(r.error)throw r.error;
 const cfg=r.data?.nos?.[0]?.dados?.bko_configuracao;if(cfg)return cfg;
 if(ws==='grupoprime'){const legado=await db.from('fluxos').select('nos').eq('workspace_id',ws).eq('id',27).single();if(legado.error)throw legado.error;return legado.data?.nos.find(n=>n.id==='prime_documentos_enviar')?.dados?.bko_configuracao;}
 return {ativo:false,canal_id:null,contatos:[]};
}
module.exports={FIXOS,modelo,registro,configuracao};
