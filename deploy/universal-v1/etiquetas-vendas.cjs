'use strict';
const filas=new Map();
async function aplicar(db,workspace,canal,numero,nome,cor){
 const chave=workspace+':'+nome,anterior=filas.get(chave)||Promise.resolve();
 const tarefa=anterior.catch(()=>{}).then(async()=>{
  const at=await db.from('atendimentos').select('id').eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).order('created_at',{ascending:false}).limit(1);if(at.error)throw at.error;if(!at.data?.length)return;
  let tag=await db.from('etiquetas').select('id').eq('workspace_id',workspace).eq('nome',nome).limit(1);if(tag.error)throw tag.error;
  if(!tag.data?.length){tag=await db.from('etiquetas').insert({workspace_id:workspace,nome,cor,icone:'🏷️'}).select('id');if(tag.error)throw tag.error;}
  const id=tag.data[0].id,ligada=await db.from('atendimento_etiquetas').select('atendimento_id').eq('atendimento_id',at.data[0].id).eq('etiqueta_id',id).limit(1);if(ligada.error)throw ligada.error;
  if(!ligada.data?.length){const r=await db.from('atendimento_etiquetas').insert({atendimento_id:at.data[0].id,etiqueta_id:id});if(r.error&&r.error.code!=='23505')throw r.error;}
 });filas.set(chave,tarefa);try{await tarefa;}finally{if(filas.get(chave)===tarefa)filas.delete(chave);}
}
async function limparInviavel(db,workspace,canal,numero){
 const at=await db.from('atendimentos').select('id').eq('workspace_id',workspace).eq('canal_id',canal).eq('numero',numero).order('created_at',{ascending:false}).limit(1);if(at.error)throw at.error;if(!at.data?.length)return;
 const tag=await db.from('etiquetas').select('id').eq('workspace_id',workspace).eq('nome','INVIÁVEL').limit(1);if(tag.error)throw tag.error;if(!tag.data?.length)return;
 const r=await db.from('atendimento_etiquetas').delete().eq('atendimento_id',at.data[0].id).eq('etiqueta_id',tag.data[0].id);if(r.error)throw r.error;
}
const venda=(db,w,c,n,id)=>aplicar(db,w,c,n,'VENDA REALIZADA '+id,'#16a34a');
const inviavel=(db,w,c,n)=>aplicar(db,w,c,n,'INVIÁVEL','#dc2626');
module.exports={venda,inviavel,limparInviavel};
